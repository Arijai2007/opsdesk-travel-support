import {
  BadRequestException,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Webhook } from 'standardwebhooks';
import { PrismaService } from '../../prisma/prisma.service';
import { resendId } from './resend-mail.transport';

const receiptKinds = new Map([
  ['email.sent', 'SENT'],
  ['email.delivered', 'DELIVERED'],
  ['email.delivery_delayed', 'DELIVERY_DELAYED'],
  ['email.bounced', 'BOUNCED'],
  ['email.failed', 'FAILED'],
]);

@Controller('ops/mail/webhooks/resend')
export class ResendMailWebhookController {
  constructor(private readonly db: PrismaService) {}

  @Post()
  @HttpCode(204)
  async receipt(@Req() req: RawBodyRequest<Request>) {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (process.env.OPSDESK_DEMO !== 'false' || !secret) {
      throw new NotFoundException();
    }
    const raw = req.rawBody;
    const id = req.get('svix-id');
    const timestamp = req.get('svix-timestamp');
    const signature = req.get('svix-signature');
    if (
      !raw ||
      !id ||
      !/^msg_[a-zA-Z0-9_-]{1,120}$/.test(id) ||
      !timestamp ||
      !signature
    ) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    let value: unknown;
    try {
      value = new Webhook(secret).verify(raw, {
        'webhook-id': id,
        'webhook-timestamp': timestamp,
        'webhook-signature': signature,
      });
    } catch {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    const event = value as {
      type?: unknown;
      created_at?: unknown;
      data?: { email_id?: unknown; tags?: { opsdesk_job?: unknown } };
    } | null;
    const kind =
      typeof event?.type === 'string'
        ? receiptKinds.get(event.type)
        : undefined;
    const jobId = event?.data?.tags?.opsdesk_job;
    if (!kind || typeof jobId !== 'string' || !/^[a-z0-9]{20,32}$/.test(jobId))
      return;
    const providerId = event?.data?.email_id;
    const date =
      typeof event?.created_at === 'string' ? new Date(event.created_at) : null;
    if (
      typeof providerId !== 'string' ||
      !resendId.test(providerId) ||
      !date ||
      Number.isNaN(+date)
    ) {
      throw new BadRequestException('Invalid delivery receipt.');
    }

    await this.db.$transaction(async (tx) => {
      const job = await tx.travelMailJob.findFirst({
        where: {
          id: jobId,
          transport: 'RESEND',
          attempts: { gt: 0 },
          OR: [{ providerId }, { providerId: null }],
        },
        select: { id: true },
      });
      if (job) {
        await tx.travelMailReceipt.createMany({
          data: [{ id, jobId, providerId, kind, occurredAt: date }],
          skipDuplicates: true,
        });
      }
    });
  }
}
