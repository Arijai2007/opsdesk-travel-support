import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { TravelMailTransport } from './travel-mail.transport';

const MAX_ATTEMPTS = 5;
const LEASE_MS = 60_000;
const syntheticAddress = /^[^\s@]+@(?:opsdesk\.demo|supplier\.example)$/i;

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
  ) {}

  private demo() {
    return (
      process.env.OPSDESK_DEMO === 'true' &&
      process.env.NODE_ENV !== 'production'
    );
  }

  private enabled() {
    return this.demo() && process.env.OPSDESK_MAIL_SYNTHETIC === 'true';
  }

  onApplicationBootstrap() {
    if (!this.enabled()) return;
    this.timer = setInterval(() => {
      if (this.busy) return;
      this.busy = true;
      void this.processOne()
        .catch(() =>
          this.logger.error(
            'Synthetic mail worker could not process the queue.',
          ),
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
    return syntheticAddress.test(recipient)
      ? { recipient, text: message.content }
      : null;
  }

  async enqueue(tx: Prisma.TransactionClient, messageId: string) {
    if (!this.demo()) return;
    const envelope = await this.envelope(tx, messageId);
    if (envelope)
      await tx.travelMailJob.create({
        data: { messageId, recipient: envelope.recipient },
      });
  }

  async processOne() {
    if (!this.enabled()) return;
    const now = new Date();
    const eligible: Prisma.TravelMailJobWhereInput = {
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
    if (job.attempts <= MAX_ATTEMPTS) {
      try {
        const envelope = await this.envelope(this.db, job.messageId);
        if (!envelope || envelope.recipient !== job.recipient) {
          outcome = 'BLOCKED';
          status = 'CANCELLED';
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
    return { mode: this.enabled() ? 'SYNTHETIC' : 'PAUSED', jobs };
  }

  async change(userId: string, id: string, action: 'retry' | 'cancel') {
    return this.db.$transaction(async (tx) => {
      await this.manager(tx, userId);
      const result = await tx.travelMailJob.updateMany({
        where: {
          id,
          status: action === 'retry' ? 'FAILED' : { in: ['QUEUED', 'FAILED'] },
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
