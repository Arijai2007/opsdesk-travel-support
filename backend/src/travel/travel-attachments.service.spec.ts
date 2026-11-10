import {
  inspectAttachment,
  TravelAttachmentsService,
} from './travel-attachments.service';
jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('travel attachments', () => {
  const png = Buffer.from('89504e470d0a1a0a010203', 'hex');
  it('accepts only content matching a supported type', () => {
    expect(inspectAttachment(png, 'image/png')).toBe('image/png');
    expect(() => inspectAttachment(png, 'text/plain')).toThrow();
    expect(() =>
      inspectAttachment(Buffer.from([0, 1, 2]), 'text/plain'),
    ).toThrow();
    expect(() =>
      inspectAttachment(Buffer.alloc(2 * 1024 * 1024 + 1), 'text/plain'),
    ).toThrow();
  });

  it('limits supplier access to their own conversation', async () => {
    const db = {
      travelProfile: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          kind: 'SUPPLIER',
          supplierId: 'other',
        }),
      },
      travelMessage: {
        findUnique: jest.fn().mockResolvedValue({
          conversationId: 'c',
          conversation: { supplierId: 'supplier' },
          ticket: { region: 'GLOBAL' },
        }),
      },
      travelAttachment: { findMany: jest.fn() },
    };
    const service = new TravelAttachmentsService(db as never);
    await expect(service.list('user', 'message')).rejects.toThrow(
      'Message not found',
    );
    expect(db.travelAttachment.findMany).not.toHaveBeenCalled();
  });

  it('rejects expired download links before reading bytes', async () => {
    const db = { travelAttachment: { findUnique: jest.fn() } };
    const service = new TravelAttachmentsService(db as never);
    await expect(
      service.download('user', 'a', String(Date.now() - 1), '0'.repeat(64)),
    ).rejects.toThrow();
    expect(db.travelAttachment.findUnique).not.toHaveBeenCalled();
  });

  it('fails closed when no scanner is configured', async () => {
    const oldDemo = process.env.OPSDESK_DEMO;
    const oldHost = process.env.OPSDESK_CLAMD_HOST;
    delete process.env.OPSDESK_DEMO;
    delete process.env.OPSDESK_CLAMD_HOST;
    const db = {
      travelProfile: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: 'ACTIVE', kind: 'MANAGER' }),
      },
      travelMessage: {
        findUnique: jest.fn().mockResolvedValue({
          conversationId: null,
          senderId: 'user',
          visibility: 'INTERNAL',
          ticket: { region: 'GLOBAL' },
        }),
      },
      travelAttachment: { create: jest.fn() },
    };
    try {
      const service = new TravelAttachmentsService(db as never);
      await expect(
        service.upload('user', 'message', {
          filename: 'x.txt',
          mimeType: 'text/plain',
          base64: Buffer.from('safe').toString('base64'),
        }),
      ).rejects.toThrow('scanner is not configured');
      expect(db.travelAttachment.create).not.toHaveBeenCalled();
    } finally {
      if (oldDemo === undefined) delete process.env.OPSDESK_DEMO;
      else process.env.OPSDESK_DEMO = oldDemo;
      if (oldHost === undefined) delete process.env.OPSDESK_CLAMD_HOST;
      else process.env.OPSDESK_CLAMD_HOST = oldHost;
    }
  });
});
