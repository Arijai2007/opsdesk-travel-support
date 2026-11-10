import type { PrismaService } from '../../prisma/prisma.service';
import { TravelMailService } from './travel-mail.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('synthetic mail processing', () => {
  const originalDemo = process.env.OPSDESK_DEMO;
  const originalFlag = process.env.OPSDESK_MAIL_SYNTHETIC;
  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };

  beforeEach(() => {
    process.env.OPSDESK_DEMO = 'true';
    process.env.OPSDESK_MAIL_SYNTHETIC = 'true';
  });
  afterEach(() => {
    restore('OPSDESK_DEMO', originalDemo);
    restore('OPSDESK_MAIL_SYNTHETIC', originalFlag);
  });

  function fixture({
    recipient = 'traveler@opsdesk.demo',
    expired = false,
    stale = false,
  } = {}) {
    const job = {
      id: 'job',
      messageId: 'message',
      recipient: 'traveler@opsdesk.demo',
      attempts: expired ? 1 : 0,
      leaseToken: expired ? 'old-lease' : null,
    };
    const finish = jest
      .fn<
        Promise<{ count: number }>,
        [
          {
            data: { status: string; nextAttemptAt: Date };
            where: { leaseToken: string };
          },
        ]
      >()
      .mockResolvedValue({ count: stale ? 0 : 1 });
    const history = {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const transaction = jest
      .fn()
      .mockImplementationOnce((fn: (tx: unknown) => unknown) =>
        fn({
          travelMailJob: {
            findFirst: jest.fn().mockResolvedValue(job),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          travelMailAttempt: history,
        }),
      )
      .mockImplementationOnce((fn: (tx: unknown) => unknown) =>
        fn({
          travelMailJob: { updateMany: finish },
          travelMailAttempt: history,
        }),
      );
    const db = {
      $transaction: transaction,
      travelMessage: {
        findUnique: jest.fn().mockResolvedValue({
          visibility: 'CUSTOMER',
          content: 'Reviewed reply',
          senderId: 'manager',
          conversation: null,
          ticket: {
            id: 'ticket',
            agencyId: 'agency',
            customerId: 'customer',
            region: 'ASIA',
          },
        }),
      },
      travelProfile: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ kind: 'MANAGER', status: 'ACTIVE' }),
        findFirst: jest.fn().mockResolvedValue({ user: { email: recipient } }),
      },
    };
    const deliver = jest.fn().mockResolvedValue(undefined);
    const worker = new TravelMailService(db as unknown as PrismaService, {
      deliver,
    });
    return { worker, deliver, finish, history, transaction };
  }

  it('does not claim jobs while delivery is paused', async () => {
    delete process.env.OPSDESK_MAIL_SYNTHETIC;
    const { worker, transaction } = fixture();
    await worker.processOne();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('blocks a changed recipient without sending the message', async () => {
    const { worker, deliver, finish } = fixture({
      recipient: 'changed@opsdesk.demo',
    });
    await worker.processOne();
    expect(deliver).not.toHaveBeenCalled();
    expect(finish.mock.calls[0][0].data.status).toBe('CANCELLED');
  });

  it('records a simulated result with the stable job id', async () => {
    const { worker, deliver, finish, history } = fixture();
    await worker.processOne();
    expect(deliver).toHaveBeenCalledWith({
      idempotencyKey: 'job',
      recipient: 'traveler@opsdesk.demo',
      text: 'Reviewed reply',
    });
    expect(finish.mock.calls[0][0].data.status).toBe('SIMULATED');
    expect(history.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { outcome: 'SIMULATED' } }),
    );
  });

  it('queues a transient failure after a delay', async () => {
    const { worker, deliver, finish } = fixture();
    const started = Date.now();
    deliver.mockRejectedValueOnce(new Error('synthetic failure'));
    await worker.processOne();
    const [update] = finish.mock.calls[0];
    expect(update.data.status).toBe('QUEUED');
    expect(+update.data.nextAttemptAt).toBeGreaterThanOrEqual(started + 30_000);
  });

  it('expires the old attempt and does not finalize with a stale token', async () => {
    const { worker, deliver, finish, history } = fixture({
      expired: true,
      stale: true,
    });
    await worker.processOne();
    expect(deliver).toHaveBeenCalledWith({
      idempotencyKey: 'job',
      recipient: 'traveler@opsdesk.demo',
      text: 'Reviewed reply',
    });
    expect(history.updateMany).toHaveBeenCalledWith({
      where: { id: 'old-lease', outcome: 'STARTED' },
      data: { outcome: 'EXPIRED' },
    });
    expect(finish.mock.calls[0][0].where.leaseToken).not.toBe('old-lease');
    expect(history.update).not.toHaveBeenCalled();
  });
});
