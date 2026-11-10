import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import {
  CreateBookingRequestDto,
  CancelBookingRequestDto,
  ReviewBookingRequestDto,
} from './booking-requests.dto';
import { readPage, TravelPageDto } from './travel-page.dto';
type Tx = Prisma.TransactionClient;
const fingerprint = (value: unknown) =>
  createHash('sha256')
    .update(
      JSON.stringify(value, (_key, item: unknown) => {
        if (item && typeof item === 'object' && !Array.isArray(item))
          return Object.fromEntries(
            Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
          );
        return item;
      }),
    )
    .digest('hex');

@Injectable()
export class BookingRequestsService {
  constructor(private readonly db: PrismaService) {}
  private async member(userId: string, tx: Tx = this.db) {
    const member = await tx.travelProfile.findUnique({ where: { userId } });
    if (
      !member ||
      member.status !== 'ACTIVE' ||
      !['MANAGER', 'AGENCY', 'CUSTOMER'].includes(member.kind)
    )
      throw new ForbiddenException('Booking review access required.');
    return member;
  }
  private locked<T>(fn: (tx: Tx) => Promise<T>) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(804204)`;
        return fn(tx);
      },
      { maxWait: 15000, timeout: 20000 },
    );
  }
  private async identities(tx: Tx, dto: CreateBookingRequestDto) {
    const [agency, customer, supplier] = await Promise.all([
      tx.travelAgency.findUnique({ where: { id: dto.agencyId } }),
      tx.travelProfile.findFirst({
        where: {
          userId: dto.customerId,
          agencyId: dto.agencyId,
          kind: 'CUSTOMER',
          status: 'ACTIVE',
        },
      }),
      tx.travelSupplier.findUnique({ where: { id: dto.supplierId } }),
    ]);
    if (!agency || !customer || !supplier)
      throw new BadRequestException(
        'Verify the agency, active customer and supplier IDs.',
      );
    for (const value of [
      dto.checkInAt,
      dto.departureAt,
      dto.cancellationCutoffAt,
    ].filter(Boolean))
      if (!value!.endsWith('Z'))
        throw new BadRequestException(
          'Booking timestamps must be UTC instants ending in Z.',
        );
    try {
      new Intl.DateTimeFormat('en', { timeZone: dto.timezone }).format();
    } catch {
      throw new BadRequestException('Use an IANA timezone.');
    }
    if (
      dto.departureAt &&
      Date.parse(dto.departureAt) < Date.parse(dto.checkInAt)
    )
      throw new BadRequestException('Departure cannot precede check-in.');
  }
  async list(userId: string, query: TravelPageDto) {
    const member = await this.member(userId);
    const where: Prisma.TravelBookingRequestWhereInput =
      member.kind === 'MANAGER'
        ? {}
        : {
            agencyId: member.agencyId || '__none__',
            ...(member.kind === 'CUSTOMER' ? { submitterId: userId } : {}),
          };
    const page = await readPage(
      query,
      () => this.db.travelBookingRequest.count({ where }),
      (skip, take) =>
        this.db.travelBookingRequest.findMany({
          where,
          skip,
          take,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
    );
    const proposals = page.items.map(
      (item) => item.payload as { customerId?: string; supplierId?: string },
    );
    const [customers, suppliers, agencies] = await Promise.all([
      this.db.user.findMany({
        where: {
          id: {
            in: proposals.flatMap((p) => (p.customerId ? [p.customerId] : [])),
          },
        },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.db.travelSupplier.findMany({
        where: {
          id: {
            in: proposals.flatMap((p) => (p.supplierId ? [p.supplierId] : [])),
          },
        },
        select: { id: true, name: true },
      }),
      this.db.travelAgency.findMany({
        where: { id: { in: page.items.map((p) => p.agencyId) } },
        select: { id: true, name: true },
      }),
    ]);
    return {
      ...page,
      items: page.items.map((item, i) => {
        const customer = customers.find(
          (p) => p.id === proposals[i].customerId,
        );
        return {
          ...item,
          agencyName: agencies.find((a) => a.id === item.agencyId)?.name,
          customerName: customer
            ? `${customer.firstName} ${customer.lastName}`
            : undefined,
          supplierName: suppliers.find((s) => s.id === proposals[i].supplierId)
            ?.name,
        };
      }),
    };
  }
  async create(userId: string, dto: CreateBookingRequestDto) {
    return this.locked(async (tx) => {
      const member = await this.member(userId, tx);
      if (
        member.kind === 'CUSTOMER' ||
        (member.kind === 'AGENCY' && member.agencyId !== dto.agencyId)
      )
        throw new ForbiddenException(
          'Agency or manager creation access required.',
        );
      await this.identities(tx, dto);
      const { requestId, reason, ...proposal } = dto;
      proposal.reference = proposal.reference.trim().toUpperCase();
      if (!proposal.reference)
        throw new BadRequestException('Booking reference required.');
      return this.submit(
        tx,
        userId,
        requestId,
        dto.agencyId,
        null,
        'CREATE',
        proposal,
        reason,
      );
    });
  }
  async cancel(
    userId: string,
    bookingId: string,
    dto: CancelBookingRequestDto,
  ) {
    return this.locked(async (tx) => {
      const member = await this.member(userId, tx);
      const booking = await tx.travelBooking.findFirst({
        where: {
          id: bookingId,
          ...(member.kind !== 'MANAGER'
            ? { agencyId: member.agencyId || '__none__' }
            : {}),
          ...(member.kind === 'CUSTOMER' ? { customerId: userId } : {}),
        },
        include: { providerImport: true },
      });
      if (!booking) throw new NotFoundException('Booking not found.');
      const existing = await tx.travelBookingRequest.findUnique({
        where: { id: dto.requestId },
      });
      if (existing) {
        if (
          existing.submitterId !== userId ||
          existing.kind !== 'CANCEL' ||
          existing.bookingId !== bookingId ||
          existing.reason !== dto.reason.trim()
        )
          throw new ConflictException('Request ID already used.');
        return existing;
      }
      if (booking.providerImport?.providerStatus === 'CANCELLED')
        throw new ConflictException('Booking is already cancelled.');
      return this.submit(
        tx,
        userId,
        dto.requestId,
        booking.agencyId,
        bookingId,
        'CANCEL',
        {
          bookingHash: fingerprint(booking),
          reference: booking.reference,
          customerId: booking.customerId,
          supplierId: booking.supplierId,
        },
        dto.reason,
      );
    });
  }
  private async submit(
    tx: Tx,
    userId: string,
    id: string,
    agencyId: string,
    bookingId: string | null,
    kind: string,
    payload: object,
    reason: string,
  ) {
    if (reason.trim().length < 10)
      throw new BadRequestException('Provide a meaningful reason.');
    const existing = await tx.travelBookingRequest.findUnique({
      where: { id },
    });
    if (existing) {
      if (
        existing.submitterId !== userId ||
        existing.kind !== kind ||
        fingerprint(existing.payload) !== fingerprint(payload) ||
        existing.reason !== reason.trim()
      )
        throw new ConflictException('Request ID already used.');
      return existing;
    }
    return tx.travelBookingRequest.create({
      data: {
        id,
        submitterId: userId,
        agencyId,
        bookingId,
        kind,
        payload: payload,
        reason: reason.trim(),
      },
    });
  }
  async review(userId: string, id: string, dto: ReviewBookingRequestDto) {
    return this.locked(async (tx) => {
      const member = await this.member(userId, tx);
      if (member.kind !== 'MANAGER')
        throw new ForbiddenException('Manager review required.');
      const request = await tx.travelBookingRequest.findUnique({
        where: { id },
      });
      if (!request) throw new NotFoundException('Request not found.');
      if (request.status !== 'PENDING') {
        if (request.status !== dto.decision)
          throw new ConflictException('Request already reviewed.');
        return request;
      }
      if (dto.reason.trim().length < 10)
        throw new BadRequestException('Provide a meaningful decision reason.');
      let bookingId = request.bookingId;
      const now = new Date();
      if (dto.decision === 'APPROVED') {
        if (
          process.env.OPSDESK_DEMO !== 'true' ||
          process.env.NODE_ENV === 'production'
        )
          throw new ForbiddenException(
            'Only isolated synthetic booking changes are enabled.',
          );
        const submitter = await this.member(request.submitterId, tx);
        if (
          submitter.kind !== 'MANAGER' &&
          submitter.agencyId !== request.agencyId
        )
          throw new ConflictException(
            'Requester scope changed; submit a new request.',
          );
        if (request.kind === 'CREATE') {
          const proposal =
            request.payload as unknown as CreateBookingRequestDto;
          await this.identities(tx, proposal);
          if (
            await tx.travelBooking.findUnique({
              where: {
                agencyId_reference: {
                  agencyId: proposal.agencyId,
                  reference: proposal.reference,
                },
              },
            })
          )
            throw new ConflictException(
              'Booking reference already exists within this agency.',
            );
          const booking = await tx.travelBooking.create({
            data: {
              ...proposal,
              checkInAt: new Date(proposal.checkInAt),
              departureAt: proposal.departureAt
                ? new Date(proposal.departureAt)
                : null,
              cancellationCutoffAt: proposal.cancellationCutoffAt
                ? new Date(proposal.cancellationCutoffAt)
                : null,
            },
          });
          bookingId = booking.id;
          await tx.travelBookingImport.create({
            data: {
              bookingId,
              providerSource: 'synthetic-review',
              providerBookingId: bookingId,
              providerUpdatedAt: now,
              providerStatus: 'ACTIVE',
              providerPayloadHash: fingerprint(proposal),
            },
          });
        } else {
          const booking = await tx.travelBooking.findUnique({
            where: { id: bookingId! },
            include: { providerImport: true },
          });
          const payload = request.payload as { bookingHash: string };
          if (!booking || fingerprint(booking) !== payload.bookingHash)
            throw new ConflictException(
              'Booking changed; submit a new cancellation request.',
            );
          if (
            booking.providerImport &&
            booking.providerImport.providerSource !== 'synthetic-review'
          )
            throw new ConflictException(
              'Provider-managed cancellations require its adapter.',
            );
          await tx.travelBookingImport.upsert({
            where: { bookingId: booking.id },
            create: {
              bookingId: booking.id,
              providerSource: 'synthetic-review',
              providerBookingId: booking.id,
              providerUpdatedAt: now,
              providerStatus: 'CANCELLED',
              providerPayloadHash: fingerprint({ id, status: 'CANCELLED' }),
            },
            update: {
              providerUpdatedAt: now,
              providerStatus: 'CANCELLED',
              providerPayloadHash: fingerprint({ id, status: 'CANCELLED' }),
            },
          });
          const tickets = await tx.travelTicket.findMany({
            where: { bookingId: booking.id },
            select: { id: true },
          });
          for (const ticket of tickets)
            await tx.travelEvent.create({
              data: {
                ticketId: ticket.id,
                actorId: userId,
                kind: 'BOOKING_CANCELLED',
                uniqueKey: `booking-cancel:${id}:${ticket.id}`,
                text: 'Manager approved synthetic booking cancellation. Review this case; it remains open with its saved deadlines.',
                createdAt: now,
              },
            });
        }
      }
      await tx.membershipAudit.create({
        data: {
          actorId: userId,
          entityId: id,
          action: `BOOKING_${request.kind}_${dto.decision}`,
          reason: dto.reason.trim(),
        },
      });
      return tx.travelBookingRequest.update({
        where: { id },
        data: {
          bookingId,
          status: dto.decision,
          reviewerId: userId,
          decisionReason: dto.reason.trim(),
          reviewedAt: now,
        },
      });
    });
  }
}
