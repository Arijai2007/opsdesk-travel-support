import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { TravelMailTransport } from './travel-mail.transport';
import {
  ResendTravelMailTransport,
  resendConfig,
  resendWindow,
  syntheticAddress,
} from './resend-mail.transport';

const MAX_ATTEMPTS = 5;
const LEASE_MS = 60_000;

@Injectable()
export class TravelMailService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private readonly logger = new Logger(TravelMailService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly transport: TravelMailTransport,
    @Optional() private readonly resend?: ResendTravelMailTransport,
  ) {}

  private demo() {
    return (
      process.env.OPSDESK_DEMO === 'true' &&
      process.env.NODE_ENV !== 'production'
    );
  }

  private mode() {
    if (this.demo() && process.env.OPSDESK_MAIL_SYNTHETIC === 'true')
      return 'SYNTHETIC';
    return this.resend && resendConfig() ? 'RESEND' : 'PAUSED';
  }

  onApplicationBootstrap() {
    if (this.mode() === 'PAUSED') return;
    this.timer = setInterval(() => {
      if (this.busy) return;
      this.busy = true;
      void this.processOne()
        .catch(() =>
          this.logger.error('Mail worker could not process the queue.'),
        )
        .finally(() => {
          this.busy = false;
        });
    }, 2_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async envelope(tx: Prisma.TransactionClient, messageId: string) {
    const message = await tx.travelMessage.findUnique({
      where: { id: messageId },
      include: {
        ticket: { include: { booking: true } },
        conversation: { include: { supplier: true } },
      },
    });
    if (!message || !['CUSTOMER', 'SUPPLIER'].includes(message.visibility))
      return null;
    const { ticket, conversation } = message;
    const sender = await tx.travelProfile.findUnique({
      where: { userId: message.senderId },
    });
    if (
      sender?.status !== 'ACTIVE' ||
      (sender.kind !== 'MANAGER' &&
        (sender.kind !== 'AGENT' ||
          (sender.region !== 'GLOBAL' && sender.region !== ticket.region)))
    )
      return null;

    let recipient: string;
    if (message.visibility === 'CUSTOMER' && !conversation) {
      const customer = await tx.travelProfile.findFirst({
        where: {
          userId: ticket.customerId,
          agencyId: ticket.agencyId,
          kind: 'CUSTOMER',
          status: 'ACTIVE',
        },
        include: { user: { select: { email: true } } },
      });
      if (!customer) return null;
      recipient = customer.user.email;
    } else if (
      message.visibility === 'SUPPLIER' &&
      conversation?.ticketId === ticket.id &&
      conversation.status !== 'CLOSED' &&
      ticket.booking?.supplierId === conversation.supplierId
    ) {
      const member = await tx.travelProfile.findFirst({
        where: {
          supplierId: conversation.supplierId,
          kind: 'SUPPLIER',
          status: 'ACTIVE',
        },
        select: { userId: true },
      });
      if (!member) return null;
      recipient = conversation.supplier.email;
    } else return null;
    return { recipient, text: message.content };
  }

  async enqueue(tx: Prisma.TransactionClient, messageId: string) {
    const config = this.resend && resendConfig();
    if (!this.demo() && !config) return;
    const envelope = await this.envelope(tx, messageId);
    if (!envelope) return;
    const permitted = config
      ? config.recipients.includes(envelope.recipient)
      : syntheticAddress.test(envelope.recipient);
    if (permitted)
      await tx.travelMailJob.create({
        data: {
          messageId,
          recipient: envelope.recipient,
          transport: config ? 'RESEND' : 'SYNTHETIC',
        },
      });
  }

  async processOne() {
    const mode = this.mode();
    if (mode === 'PAUSED') return;
    const now = new Date();
    const eligible: Prisma.TravelMailJobWhereInput = {
      transport: mode,
      OR: [
        { status: 'QUEUED', nextAttemptAt: { lte: now } },
        { status: 'PROCESSING', leaseUntil: { lte: now } },
      ],
    };
    const job = await this.db.$transaction(async (tx) => {
      const candidate = await tx.travelMailJob.findFirst({
        where: eligible,
        orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
      });
      if (!candidate) return null;
      const token = randomUUID();
      const claimed = await tx.travelMailJob.updateMany({
        where: {
          id: candidate.id,
          leaseToken: candidate.leaseToken,
          attempts: candidate.attempts,
          ...eligible,
        },
        data: {
          status: 'PROCESSING',
          leaseToken: token,
          leaseUntil: new Date(+now + LEASE_MS),
          attempts: { increment: 1 },
        },
      });
      if (!claimed.count) return null;
      if (candidate.leaseToken)
        await tx.travelMailAttempt.updateMany({
          where: { id: candidate.leaseToken, outcome: 'STARTED' },
          data: { outcome: 'EXPIRED' },
        });
      await tx.travelMailAttempt.create({
        data: { id: token, jobId: candidate.id, outcome: 'STARTED' },
      });
      return { ...candidate, token, attempts: candidate.attempts + 1 };
    });
    if (!job) return;

    let outcome = 'FAILED';
    let status = 'FAILED';
    let providerId: string | undefined;
    if (mode === 'RESEND' && Date.now() - +job.createdAt >= resendWindow) {
      outcome = 'RECONCILIATION_REQUIRED';
    } else if (job.attempts <= MAX_ATTEMPTS) {
      try {
        const envelope = await this.envelope(this.db, job.messageId);
        const permitted =
          mode === 'RESEND'
            ? resendConfig()?.recipients.includes(job.recipient)
            : syntheticAddress.test(job.recipient);
        if (!envelope || envelope.recipient !== job.recipient || !permitted) {
          outcome = 'BLOCKED';
          status = 'CANCELLED';
        } else if (mode === 'RESEND' && this.resend) {
          providerId = await this.resend.deliver({
            ...envelope,
            idempotencyKey: job.id,
          });
          outcome = 'PROVIDER_ACCEPTED';
          status = 'PROVIDER_ACCEPTED';
        } else {
          await this.transport.deliver({ ...envelope, idempotencyKey: job.id });
          outcome = 'SIMULATED';
          status = 'SIMULATED';
        }
      } catch {
        status = job.attempts < MAX_ATTEMPTS ? 'QUEUED' : 'FAILED';
      }
    }
    await this.db.$transaction(async (tx) => {
      const finished = await tx.travelMailJob.updateMany({
        where: { id: job.id, status: 'PROCESSING', leaseToken: job.token },
        data: {
          status,
          providerId,
          leaseToken: null,
          leaseUntil: null,
          nextAttemptAt: new Date(
            Date.now() + 30_000 * 2 ** Math.min(job.attempts - 1, 4),
          ),
        },
      });
      if (finished.count)
        await tx.travelMailAttempt.update({
          where: { id: job.token },
          data: { outcome },
        });
    });
  }

  private async manager(tx: Prisma.TransactionClient, userId: string) {
    const profile = await tx.travelProfile.findUnique({ where: { userId } });
    if (profile?.kind !== 'MANAGER' || profile.status !== 'ACTIVE')
      throw new ForbiddenException('Manager access required.');
  }

  async list(userId: string) {
    await this.manager(this.db, userId);
    const jobs = await this.db.travelMailJob.findMany({
      take: 30,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        status: true,
        attempts: true,
        providerId: true,
        transport: true,
        receipts: {
          take: 10,
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          select: { id: true, kind: true, occurredAt: true, providerId: true },
        },
        createdAt: true,
        nextAttemptAt: true,
        message: { select: { ticket: { select: { reference: true } } } },
        history: {
          take: 10,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true, outcome: true, actorId: true, createdAt: true },
        },
      },
    });
    return {
      mode: this.mode(),
      jobs: jobs.map(({ providerId, transport, receipts, ...job }) => ({
        ...job,
        retryable:
          job.status === 'FAILED' &&
          (transport === 'SYNTHETIC' ||
            Date.now() - +job.createdAt < resendWindow),
        receipts: receipts
          .filter((receipt) => receipt.providerId === providerId)
          .map(({ id, kind, occurredAt }) => ({ id, kind, occurredAt })),
      })),
    };
  }

  async change(userId: string, id: string, action: 'retry' | 'cancel') {
    return this.db.$transaction(async (tx) => {
      await this.manager(tx, userId);
      const result = await tx.travelMailJob.updateMany({
        where: {
          id,
          status: action === 'retry' ? 'FAILED' : { in: ['QUEUED', 'FAILED'] },
          ...(action === 'retry' && {
            OR: [
              { transport: 'SYNTHETIC' },
              {
                transport: 'RESEND',
                createdAt: { gt: new Date(Date.now() - resendWindow) },
              },
            ],
          }),
        },
        data:
          action === 'retry'
            ? { status: 'QUEUED', attempts: 0, nextAttemptAt: new Date() }
            : { status: 'CANCELLED' },
      });
      if (!result.count)
        throw new ConflictException(
          'Mail job is not available for that action.',
        );
      await tx.travelMailAttempt.create({
        data: {
          jobId: id,
          actorId: userId,
          outcome: action === 'retry' ? 'MANAGER_RETRY' : 'MANAGER_CANCELLED',
        },
      });
      return { success: true };
    });
  }
}
