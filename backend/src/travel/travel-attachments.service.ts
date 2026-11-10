import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Socket } from 'node:net';
import { PrismaService } from '../../prisma/prisma.service';
import { STAFF } from './travel.rules';

const MAX_BYTES = 2 * 1024 * 1024;
const LINK_MS = 5 * 60 * 1000;
const RETENTION_DAYS = 30;

export function inspectAttachment(bytes: Buffer, claimedType: string) {
  if (!bytes.length || bytes.length > MAX_BYTES)
    throw new BadRequestException(
      'Attachment must be between 1 byte and 2 MiB.',
    );
  let type: string;
  if (bytes.subarray(0, 5).toString() === '%PDF-') type = 'application/pdf';
  else if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')))
    type = 'image/png';
  else if (bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')))
    type = 'image/jpeg';
  else {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (bytes.includes(0) || bytes.some((b) => b < 9 || (b > 13 && b < 32)))
        throw new Error();
      type = 'text/plain';
    } catch {
      throw new BadRequestException('Unsupported attachment type.');
    }
  }
  if (type !== claimedType)
    throw new BadRequestException(
      'Attachment type does not match its contents.',
    );
  return type;
}

async function scan(bytes: Buffer): Promise<void> {
  // Synthetic preview has no external scanner. EICAR catches accidental test uploads.
  if (
    process.env.OPSDESK_DEMO === 'true' &&
    process.env.NODE_ENV !== 'production'
  ) {
    if (bytes.includes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')))
      throw new BadRequestException('Attachment failed malware scanning.');
    return;
  }
  const host = process.env.OPSDESK_CLAMD_HOST;
  const port = Number(process.env.OPSDESK_CLAMD_PORT || 3310);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new ServiceUnavailableException(
      'Attachment scanner is not configured.',
    );
  const verdict = await new Promise<string>((resolve, reject) => {
    const socket = new Socket();
    let response = '';
    socket.setTimeout(10000);
    socket.on('timeout', () => socket.destroy(new Error('Scanner timeout')));
    socket.on('error', reject);
    socket.on('data', (chunk: Buffer) => {
      response += chunk.toString();
    });
    socket.on('close', () => resolve(response.replace(/\0/g, '').trim()));
    socket.connect(port, host, () => {
      socket.write('zINSTREAM\0');
      const length = Buffer.alloc(4);
      length.writeUInt32BE(bytes.length);
      socket.write(length);
      socket.write(bytes);
      socket.write(Buffer.alloc(4));
    });
  }).catch(() => {
    throw new ServiceUnavailableException('Attachment scanner unavailable.');
  });
  if (verdict !== 'stream: OK') {
    if (verdict.includes('FOUND'))
      throw new BadRequestException('Attachment failed malware scanning.');
    throw new ServiceUnavailableException(
      'Attachment scanner returned no clean verdict.',
    );
  }
}

@Injectable()
export class TravelAttachmentsService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly db: PrismaService) {}
  private cleanup?: ReturnType<typeof setInterval>;
  private readonly logger = new Logger(TravelAttachmentsService.name);
  onModuleInit() {
    this.cleanup = setInterval(
      () => {
        void this.purgeExpired().catch((error: unknown) =>
          this.logger.error(
            `Attachment retention cleanup failed: ${String(error)}`,
          ),
        );
      },
      60 * 60 * 1000,
    );
    this.cleanup.unref();
  }
  onModuleDestroy() {
    if (this.cleanup) clearInterval(this.cleanup);
  }

  private async visibleMessage(userId: string, messageId: string) {
    const profile = await this.db.travelProfile.findUnique({
      where: { userId },
    });
    if (!profile || profile.status !== 'ACTIVE')
      throw new ForbiddenException('OpsDesk access required.');
    const message = await this.db.travelMessage.findUnique({
      where: { id: messageId },
      include: { ticket: true, conversation: true },
    });
    if (!message) throw new NotFoundException('Message not found.');
    if (message.conversationId) {
      if (profile.kind === 'SUPPLIER') {
        if (profile.supplierId !== message.conversation?.supplierId)
          throw new NotFoundException('Message not found.');
      } else if (
        !STAFF.includes(profile.kind) ||
        (profile.kind !== 'MANAGER' &&
          profile.region !== 'GLOBAL' &&
          profile.region !== message.ticket.region)
      )
        throw new NotFoundException('Message not found.');
    } else if (
      profile.kind === 'SUPPLIER' ||
      (message.visibility === 'INTERNAL' && !STAFF.includes(profile.kind)) ||
      (STAFF.includes(profile.kind)
        ? profile.kind !== 'MANAGER' &&
          profile.region !== 'GLOBAL' &&
          profile.region !== message.ticket.region
        : profile.kind === 'CUSTOMER'
          ? profile.userId !== message.ticket.customerId ||
            profile.agencyId !== message.ticket.agencyId
          : profile.kind !== 'AGENCY' ||
            profile.agencyId !== message.ticket.agencyId)
    )
      throw new NotFoundException('Message not found.');
    return message;
  }

  async upload(
    userId: string,
    messageId: string,
    body: { filename?: string; mimeType?: string; base64?: string },
  ) {
    const message = await this.visibleMessage(userId, messageId);
    if (message.senderId !== userId)
      throw new ForbiddenException(
        'Only the message author can add attachments.',
      );
    if (
      !body ||
      typeof body.filename !== 'string' ||
      typeof body.mimeType !== 'string' ||
      typeof body.base64 !== 'string' ||
      body.filename.length < 1 ||
      body.filename.length > 120 ||
      Array.from(body.filename).some(
        (c) =>
          c === '/' ||
          c === '\\' ||
          c.charCodeAt(0) < 32 ||
          c.charCodeAt(0) === 127,
      ) ||
      body.base64.length > Math.ceil(MAX_BYTES / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        body.base64,
      )
    )
      throw new BadRequestException('Invalid attachment.');
    const bytes = Buffer.from(body.base64, 'base64');
    const { filename, mimeType } = body;
    inspectAttachment(bytes, body.mimeType);
    await scan(bytes);
    // Recheck after scanning: membership or message scope may have changed.
    const current = await this.visibleMessage(userId, messageId);
    if (current.senderId !== userId)
      throw new ForbiddenException(
        'Only the message author can add attachments.',
      );
    const row = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "TravelMessage" WHERE id = ${messageId} FOR UPDATE`;
      const count = await tx.travelAttachment.count({ where: { messageId } });
      if (count >= 5)
        throw new BadRequestException(
          'Each message can have at most five attachments.',
        );
      const attachment = await tx.travelAttachment.create({
        data: {
          messageId,
          filename,
          mimeType,
          size: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
          bytes,
          expiresAt: new Date(Date.now() + RETENTION_DAYS * 86400000),
        },
      });
      await tx.travelEvent.create({
        data: {
          ticketId: current.ticketId,
          actorId: userId,
          kind: 'ATTACHMENT_ADDED',
          uniqueKey: `attachment:${attachment.id}`,
          text: 'A scanned attachment was added to a message.',
          createdAt: new Date(),
        },
      });
      return attachment;
    });
    return {
      id: row.id,
      filename: row.filename,
      mimeType: row.mimeType,
      size: row.size,
      sha256: row.sha256,
      expiresAt: row.expiresAt,
    };
  }

  async list(userId: string, messageId: string) {
    await this.visibleMessage(userId, messageId);
    return this.db.travelAttachment.findMany({
      where: { messageId, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        sha256: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private secret() {
    const secret = process.env.OPSDESK_ATTACHMENT_SIGNING_SECRET;
    if (!secret || secret.length < 32)
      throw new ServiceUnavailableException(
        'Attachment signing key is not configured.',
      );
    return secret;
  }

  async link(userId: string, id: string) {
    const row = await this.db.travelAttachment.findUnique({
      where: { id },
      select: { messageId: true, expiresAt: true },
    });
    if (!row || row.expiresAt <= new Date())
      throw new NotFoundException('Attachment not found.');
    await this.visibleMessage(userId, row.messageId);
    const expires = Date.now() + LINK_MS;
    const signature = createHmac('sha256', this.secret())
      .update(`${id}:${userId}:${expires}`)
      .digest('hex');
    return {
      url: `/ops/attachments/${id}/download?expires=${expires}&signature=${signature}`,
      expiresAt: new Date(expires),
    };
  }

  async download(
    userId: string,
    id: string,
    expiresRaw: string,
    signature: string,
  ) {
    const expires = Number(expiresRaw);
    if (
      !Number.isSafeInteger(expires) ||
      expires <= Date.now() ||
      expires > Date.now() + LINK_MS ||
      !/^[a-f0-9]{64}$/.test(signature || '')
    )
      throw new ForbiddenException('Download link expired or invalid.');
    const expected = createHmac('sha256', this.secret())
      .update(`${id}:${userId}:${expires}`)
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
      throw new ForbiddenException('Download link expired or invalid.');
    const row = await this.db.travelAttachment.findUnique({ where: { id } });
    if (!row || row.expiresAt <= new Date())
      throw new NotFoundException('Attachment not found.');
    await this.visibleMessage(userId, row.messageId);
    return row;
  }

  async purgeExpired() {
    return this.db.travelAttachment.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
  }
}
