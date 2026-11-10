import { createHmac, timingSafeEqual } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import { resendId, resendMailbox } from './resend-mail.transport';

const MAX_RESPONSE_BYTES = 256 * 1024;
const replyJobId = /^[a-z0-9]{20,29}$/;
const replyMailbox = /^r\+([a-z0-9]{20,29})\.([0-9a-f]{32})$/;

export function incomingConfig() {
  const domain = process.env.OPSDESK_MAIL_REPLY_DOMAIN?.trim().toLowerCase();
  const secret = process.env.OPSDESK_MAIL_REPLY_SECRET?.trim();
  const apiKey = process.env.RESEND_RECEIVING_API_KEY?.trim();
  if (
    process.env.OPSDESK_DEMO !== 'false' ||
    process.env.OPSDESK_MAIL_REPLIES !== 'true' ||
    !domain ||
    domain.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) ||
    !secret ||
    !/^[0-9a-f]{64}$/i.test(secret) ||
    !apiKey ||
    !process.env.RESEND_WEBHOOK_SECRET?.trim()
  )
    return null;
  return { domain, secret, apiKey };
}

export function supplierRepliesEnabled() {
  return process.env.OPSDESK_MAIL_SUPPLIER_REPLIES === 'true';
}

type IncomingConfig = NonNullable<ReturnType<typeof incomingConfig>>;

function token(config: IncomingConfig, jobId: string) {
  return createHmac('sha256', Buffer.from(config.secret, 'hex'))
    .update('opsdesk/customer-reply/v1\0' + config.domain + '\0' + jobId)
    .digest()
    .subarray(0, 16);
}

export function replyAddress(config: IncomingConfig, jobId: string) {
  if (!replyJobId.test(jobId)) throw new Error('Invalid mail job ID.');
  return (
    'r+' +
    jobId +
    '.' +
    token(config, jobId).toString('hex') +
    '@' +
    config.domain
  );
}

export function replyJob(config: IncomingConfig, recipients: unknown) {
  if (
    !Array.isArray(recipients) ||
    recipients.length !== 1 ||
    typeof recipients[0] !== 'string'
  )
    return null;
  const [local, domain, extra] = recipients[0].toLowerCase().split('@');
  if (domain !== config.domain || extra !== undefined) return null;
  const match = replyMailbox.exec(local);
  if (
    !match ||
    !timingSafeEqual(Buffer.from(match[2], 'hex'), token(config, match[1]))
  )
    return null;
  return match[1];
}

export function replySender(value: unknown) {
  if (typeof value !== 'string' || value.length > 512 || /[\r\n]/.test(value))
    return null;
  const mailbox =
    /^(?:[^<>]*)<([^<>]+)>$/.exec(value.trim())?.[1] ?? value.trim();
  return resendMailbox.test(mailbox) ? mailbox : null;
}

export async function receiveReplyText(config: IncomingConfig, id: string) {
  if (!resendId.test(id)) return null;
  try {
    const response = await fetch(
      'https://api.resend.com/emails/receiving/' + id,
      {
        headers: { Authorization: 'Bearer ' + config.apiKey },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('Resend did not return the inbound email.');
    }
    if (!response.body) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(chunk.value);
    }
    const payload: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('id' in payload) ||
      payload.id !== id ||
      !('text' in payload) ||
      typeof payload.text !== 'string'
    )
      return null;
    const text = payload.text.trim();
    return text.length > 0 && text.length <= 10_000 && !text.includes('\0')
      ? text
      : null;
  } catch {
    throw new ServiceUnavailableException(
      'Incoming email is temporarily unavailable.',
    );
  }
}
