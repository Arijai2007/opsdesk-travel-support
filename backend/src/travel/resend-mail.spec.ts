import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Webhook } from 'standardwebhooks';
import type { PrismaService } from '../../prisma/prisma.service';
import type { TravelService } from './travel.service';
import { ResendMailWebhookController } from './resend-mail-webhook.controller';
import {
  ResendTravelMailTransport,
  resendConfig,
} from './resend-mail.transport';

jest.mock('./travel.service', () => ({
  TravelService: class TravelService {},
}));

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const providerId = '56761188-7520-42d8-8898-ff6fc54ce618';
const jobId = 'cl0123456789abcdefghijkl';
const secret = 'whsec_' + Buffer.alloc(32, 7).toString('base64');
const config = {
  OPSDESK_DEMO: 'false',
  OPSDESK_MAIL_RESEND: 'true',
  OPSDESK_MAIL_FROM: 'support@example.com',
  OPSDESK_MAIL_ALLOWLIST: 'traveler@example.com',
  RESEND_API_KEY: 'fixture-key',
  RESEND_WEBHOOK_SECRET: secret,
};

const envelope = {
  idempotencyKey: jobId,
  recipient: 'traveler@example.com',
  text: 'Reviewed reply',
};

describe('Resend mail pilot', () => {
  const original = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, config);
  });
  afterEach(() => {
    for (const key of Object.keys(config)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    jest.restoreAllMocks();
  });

  it('requires deliberate opt-in, non-demo mode and a non-synthetic allowlist', () => {
    expect(resendConfig()).not.toBeNull();
    process.env.OPSDESK_DEMO = 'true';
    expect(resendConfig()).toBeNull();
    process.env.OPSDESK_DEMO = 'false';
    process.env.OPSDESK_MAIL_ALLOWLIST = 'customer@opsdesk.demo';
    expect(resendConfig()).toBeNull();
    delete process.env.OPSDESK_MAIL_RESEND;
    expect(resendConfig()).toBeNull();
  });

  it('sends only the allowlisted plaintext reply with a stable provider key', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ id: providerId }));
    const adapter = new ResendTravelMailTransport();
    await expect(adapter.deliver(envelope)).resolves.toBe(providerId);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init?.redirect).toBe('error');
    expect(init?.headers).toEqual({
      Authorization: 'Bearer fixture-key',
      'Content-Type': 'application/json',
      'Idempotency-Key': jobId,
    });
    if (typeof init?.body !== 'string') throw new Error('Expected JSON body');
    expect(JSON.parse(init.body)).toEqual({
      from: 'support@example.com',
      to: ['traveler@example.com'],
      subject: 'OpsDesk support reply',
      text: 'Reviewed reply',
      tags: [{ name: 'opsdesk_job', value: jobId }],
    });
    await expect(
      adapter.deliver({ ...envelope, recipient: 'other@example.com' }),
    ).rejects.toThrow('outside');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  function webhook() {
    const rows = new Map<string, { id: string; kind: string }>();
    const lookup = jest.fn().mockResolvedValue({ id: jobId });
    const create = jest.fn(
      ({ data }: { data: { id: string; kind: string }[] }) => {
        for (const row of data) if (!rows.has(row.id)) rows.set(row.id, row);
      },
    );
    const tx = {
      travelMailJob: { findFirst: lookup },
      travelMailReceipt: { createMany: create },
    };
    const db = { $transaction: (fn: (value: typeof tx) => unknown) => fn(tx) };
    return {
      controller: new ResendMailWebhookController(
        db as unknown as PrismaService,
        { receiveCustomerMail: jest.fn() } as unknown as TravelService,
      ),
      create,
      lookup,
      rows,
    };
  }

  function request({
    type = 'email.delivered',
    id = 'msg_test1',
    date = new Date(),
    tampered = false,
  } = {}) {
    const body = JSON.stringify({
      type,
      created_at: date.toISOString(),
      data: {
        email_id: providerId,
        tags: { opsdesk_job: jobId },
        to: ['traveler@example.com'],
      },
    });
    const headers: Record<string, string> = {
      'svix-id': id,
      'svix-timestamp': String(Math.floor(+date / 1000)),
      'svix-signature': new Webhook(secret).sign(id, date, body),
    };
    return {
      rawBody: Buffer.from(tampered ? body + ' ' : body),
      get: (key: string) => headers[key],
    } as unknown as RawBodyRequest<Request>;
  }

  it('rejects tampered and stale signatures before looking up a job', async () => {
    const { controller, lookup } = webhook();
    await expect(
      controller.receipt(request({ tampered: true })),
    ).rejects.toThrow('Invalid webhook signature');
    await expect(
      controller.receipt(request({ date: new Date(Date.now() - 600_000) })),
    ).rejects.toThrow('Invalid webhook signature');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('keeps distinct out-of-order receipt types and deduplicates retries without storing addresses', async () => {
    const { controller, create, lookup, rows } = webhook();
    const receivedAt = new Date();
    const delivery = request({ date: receivedAt });
    await controller.receipt(delivery);
    await controller.receipt(delivery);
    await controller.receipt(
      request({
        type: 'email.sent',
        id: 'msg_test2',
        date: new Date(Date.now() - 60_000),
      }),
    );
    await controller.receipt(
      request({ type: 'email.received', id: 'msg_test3' }),
    );
    expect(lookup).toHaveBeenCalledTimes(3);
    expect(create.mock.calls[0][0]).toEqual({
      data: [
        {
          id: 'msg_test1',
          jobId,
          providerId,
          kind: 'DELIVERED',
          occurredAt: receivedAt,
        },
      ],
      skipDuplicates: true,
    });
    expect([...rows.values()].map((row) => row.kind)).toEqual([
      'DELIVERED',
      'SENT',
    ]);
  });
});
