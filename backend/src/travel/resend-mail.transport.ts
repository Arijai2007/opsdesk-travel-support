import { Injectable } from '@nestjs/common';

const address = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
export const syntheticAddress =
  /^[^\s@]+@(?:opsdesk\.demo|supplier\.example)$/i;
export const resendId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const resendWindow = 23 * 60 * 60 * 1000;

export function resendConfig() {
  const {
    OPSDESK_MAIL_RESEND,
    OPSDESK_DEMO,
    RESEND_API_KEY,
    OPSDESK_MAIL_FROM,
    OPSDESK_MAIL_ALLOWLIST,
  } = process.env;
  const from = OPSDESK_MAIL_FROM?.trim();
  const recipients = (OPSDESK_MAIL_ALLOWLIST ?? '')
    .split(',')
    .map((email) => email.trim());
  if (
    OPSDESK_MAIL_RESEND !== 'true' ||
    OPSDESK_DEMO !== 'false' ||
    !RESEND_API_KEY?.trim() ||
    !from ||
    !address.test(from) ||
    syntheticAddress.test(from) ||
    recipients.some(
      (email) => !address.test(email) || syntheticAddress.test(email),
    )
  )
    return null;
  return { apiKey: RESEND_API_KEY.trim(), from, recipients };
}

@Injectable()
export class ResendTravelMailTransport {
  async deliver(envelope: {
    idempotencyKey: string;
    recipient: string;
    text: string;
  }) {
    const config = resendConfig();
    if (!config?.recipients.includes(envelope.recipient)) {
      throw new Error('Recipient is outside the configured Resend pilot.');
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: 'Bearer ' + config.apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': envelope.idempotencyKey,
      },
      body: JSON.stringify({
        from: config.from,
        to: [envelope.recipient],
        subject: 'OpsDesk support reply',
        text: envelope.text,
        tags: [{ name: 'opsdesk_job', value: envelope.idempotencyKey }],
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('Resend did not accept the mail request.');
    }
    const result: unknown = await response.json();
    if (
      !result ||
      typeof result !== 'object' ||
      !('id' in result) ||
      typeof result.id !== 'string' ||
      !resendId.test(result.id)
    ) {
      throw new Error('Resend did not return a valid mail ID.');
    }
    return result.id;
  }
}
