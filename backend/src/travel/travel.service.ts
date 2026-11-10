import { HandoffPolicyDto } from './sla.dto';
import {
  addServiceTime as calculateServiceDeadline,
  serviceTimeBetween,
  isOnDuty,
  validateCalendar,
  chooseEscalationOwner,
  type ServiceCalendar,
} from './sla-calendar';
import { CalendarPolicyDto, SlaPauseDto, EscalationOwnerDto } from './sla.dto';
import { TravelDirectoryDto } from './travel-directory.dto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { readTravelInsights } from './travel-insights';
import { TravelQueueDto } from './travel-queue.dto';
import { readPage, TravelPageDto } from './travel-page.dto';
import { readTravelQueue, type TravelTicketScope } from './travel-queue';
import {
  AgentSpecialtiesDto,
  BookingScheduleDto,
  NewConversationDto,
  NewTravelTicketDto,
  SupplierReplyDto,
  TravelMessageDto,
  UpdateTravelTicketDto,
} from './travel.dto';
import {
  active,
  CHECK_IN_HIGH_HOURS,
  chooseAgent,
  classify,
  effectiveDeadline,
  PRIORITIES,
  RESPONSE_WINDOW_MS,
  STAFF,
  urgency,
} from './travel.rules';
type Tx = Prisma.TransactionClient;
type Profile = Prisma.TravelProfileGetPayload<{ include: { user: true } }>;
type Case = Prisma.TravelTicketGetPayload<object>;
const ALERT_KINDS = ['ESCALATED', 'SUPPLIER_OVERDUE'];
@Injectable()
export class TravelService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval>;
  private sweepRunning = false;
  private lastSweepCompletedAt: number | undefined;
  private static readonly sweepIntervalMs = 15_000;
  private readonly logger = new Logger(TravelService.name);
  constructor(private readonly db: PrismaService) {}
  onApplicationBootstrap() {
    const check = () => {
      if (this.sweepRunning) return;
      this.sweepRunning = true;
      void this.sweep()
        .catch((e: unknown) =>
          this.logger.error(
            `Deadline check failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        )
        .finally(() => {
          this.sweepRunning = false;
        });
    };
    this.timer = setInterval(check, TravelService.sweepIntervalMs);
    this.timer.unref();
    check();
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
  workerHealthy() {
    return (
      this.lastSweepCompletedAt !== undefined &&
      Date.now() - this.lastSweepCompletedAt < 4 * TravelService.sweepIntervalMs
    );
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
  // Lock order: routing capacity (when needed), then ticket rows in ID order.
  // Ticket-only operations must never acquire the routing lock.
  private ticketLocked<T>(id: string, fn: (tx: Tx) => Promise<T>) {
    return this.db.$transaction(
      async (tx) => {
        await this.lockTicket(tx, id);
        return fn(tx);
      },
      { maxWait: 15000, timeout: 20000 },
    );
  }
  private async lockTicket(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM "TravelTicket" WHERE id = ${id} FOR UPDATE`;
  }
  private async conversationLocked<T>(id: string, fn: (tx: Tx) => Promise<T>) {
    const conversation = await this.db.travelConversation.findUnique({
      where: { id },
      select: { ticketId: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    return this.ticketLocked(conversation.ticketId, fn);
  }
  private async profile(userId: string, tx: Tx = this.db): Promise<Profile> {
    const profile = await tx.travelProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!profile || profile.status !== 'ACTIVE')
      throw new ForbiddenException(
        'This account has no OpsDesk workspace access.',
      );
    return profile;
  }
  private staff(p: Profile) {
    if (!STAFF.includes(p.kind))
      throw new ForbiddenException('Support team access required.');
  }
  private manager(p: Profile) {
    if (p.kind !== 'MANAGER')
      throw new ForbiddenException('Manager access required.');
  }
  private staffRegion(p: Profile): string | null {
    return p.kind === 'MANAGER' || p.region === 'GLOBAL'
      ? null
      : p.region || 'NONE';
  }
  private scope(p: Profile): TravelTicketScope {
    if (STAFF.includes(p.kind)) {
      const region = this.staffRegion(p);
      return region === null ? {} : { region };
    }
    if (p.kind === 'AGENCY') return { agencyId: p.agencyId || 'NONE' };
    if (p.kind === 'CUSTOMER')
      return { customerId: p.userId, agencyId: p.agencyId || 'NONE' };
    return { id: '__not_visible__' };
  }
  async insights(userId: string) {
    const p = await this.profile(userId);
    this.staff(p);
    return readTravelInsights(this.db, this.staffRegion(p), await this.now());
  }
  async queue(userId: string, query: TravelQueueDto) {
    const p = await this.profile(userId);
    if (query.attention) this.staff(p);
    const page = await readTravelQueue(
      this.db,
      this.scope(p),
      query,
      userId,
      await this.now(),
    );
    const tickets = await this.db.travelTicket.findMany({
      where: { AND: [this.scope(p), { id: { in: page.ids } }] },
      omit: { description: true },
      include: { booking: true },
    });
    const groups = await this.db.travelTicket.groupBy({
      by: ['bookingId'],
      where: {
        AND: [
          this.scope(p),
          {
            bookingId: {
              in: tickets.flatMap((t) => (t.bookingId ? [t.bookingId] : [])),
            },
          },
        ],
      },
      _count: true,
    });
    const names = await this.db.user.findMany({
      where: {
        id: {
          in: tickets.flatMap((t) => [
            t.customerId,
            ...(t.agentId ? [t.agentId] : []),
          ]),
        },
      },
      select: { id: true, firstName: true, lastName: true },
    });
    const name = (id: string | null) =>
      names
        .filter((u) => u.id === id)
        .map((u) => `${u.firstName} ${u.lastName}`)[0];
    return {
      ...page,
      items: page.ids.flatMap((id) => {
        const ticket = tickets.find((t) => t.id === id);
        return ticket
          ? [
              {
                ...ticket,
                ...(!STAFF.includes(p.kind) ? { escalationOwnerId: null } : {}),
                customerName: name(ticket.customerId),
                ownerName: name(ticket.agentId),
                relatedCount: ticket.bookingId
                  ? (groups.find((g) => g.bookingId === ticket.bookingId)
                      ?._count ?? 1) - 1
                  : 0,
              },
            ]
          : [];
      }),
    };
  }
  async detail(userId: string, id: string) {
    const p = await this.profile(userId);
    const t = await this.ticket(p, id, this.db);
    const booking = t.bookingId
      ? await this.db.travelBooking.findUnique({
          where: { id: t.bookingId },
          include: { supplier: true, agency: true },
        })
      : null;
    const relatedCount = t.bookingId
      ? await this.db.travelTicket.count({
          where: {
            AND: [this.scope(p), { bookingId: t.bookingId, id: { not: id } }],
          },
        })
      : 0;
    const pending = STAFF.includes(p.kind)
      ? await this.db.travelConversation.count({
          where: { ticketId: id, status: 'AWAITING_REPLY' },
        })
      : 0;
    const supplierReplied =
      STAFF.includes(p.kind) &&
      (await this.db.travelEvent.count({
        where: {
          ticketId: id,
          kind: 'SUPPLIER_REPLY',
          text: 'Supplier replied; agent review required.',
        },
      })) > 0;
    const people = await this.db.travelProfile.findMany({
      where: {
        userId: { in: [t.customerId, ...(t.agentId ? [t.agentId] : [])] },
      },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    const escalationOwner =
      STAFF.includes(p.kind) && t.escalationOwnerId
        ? await this.db.user.findUnique({
            where: { id: t.escalationOwnerId },
            select: { firstName: true, lastName: true },
          })
        : null;
    return {
      ...t,
      ...(STAFF.includes(p.kind)
        ? {
            escalationOwnerName: escalationOwner
              ? `${escalationOwner.firstName} ${escalationOwner.lastName}`
              : null,
          }
        : { escalationOwnerId: null }),
      booking,
      supplierReplied,
      people: people.map((v) => ({
        id: v.userId,
        name: `${v.user.firstName} ${v.user.lastName}`,
        kind: v.kind,
        region: v.region,
        available: v.available,
        ...(p.kind === 'MANAGER' ? { shiftCalendar: v.shiftCalendar } : {}),
      })),
      messages: [],
      events: [],
      relatedIds: [],
      summary: [
        relatedCount
          ? `${relatedCount} earlier or related cases for this booking.`
          : 'No other linked cases in your authorized history.',
        booking
          ? `Booking ${booking.reference}: ${booking.destination}.`
          : 'Booking reference needs verification.',
        ...(STAFF.includes(p.kind)
          ? [`${pending} supplier conversation(s) awaiting a reply.`]
          : []),
      ].join(' '),
    };
  }
  async messages(userId: string, id: string, query: TravelPageDto) {
    const p = await this.profile(userId);
    await this.ticket(p, id, this.db);
    const where: Prisma.TravelMessageWhereInput = {
      ticketId: id,
      conversationId: null,
      visibility: STAFF.includes(p.kind)
        ? { in: ['CUSTOMER', 'INTERNAL'] }
        : 'CUSTOMER',
    };
    return this.messagePage(where, query);
  }
  private async messagePage(
    where: Prisma.TravelMessageWhereInput,
    query: TravelPageDto,
  ) {
    const page = await readPage(
      query,
      () => this.db.travelMessage.count({ where }),
      (skip, take) =>
        this.db.travelMessage.findMany({
          where,
          skip,
          take,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
    );
    const users = await this.db.user.findMany({
      where: { id: { in: page.items.map((m) => m.senderId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    return {
      ...page,
      items: page.items.map((message) => {
        const user = users.find((u) => u.id === message.senderId);
        return {
          ...message,
          senderName: user
            ? `${user.firstName} ${user.lastName}`
            : 'Support team',
        };
      }),
    };
  }
  async events(userId: string, id: string, query: TravelPageDto) {
    const p = await this.profile(userId);
    await this.ticket(p, id, this.db);
    const staff = STAFF.includes(p.kind);
    const where: Prisma.TravelEventWhereInput = {
      ticketId: id,
      ...(!staff
        ? { kind: { in: ['CREATED', 'STATUS_CHANGED', 'BOOKING_LINKED'] } }
        : {}),
    };
    const page = await readPage(
      query,
      () => this.db.travelEvent.count({ where }),
      (skip, take) =>
        this.db.travelEvent.findMany({
          where,
          skip,
          take,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
    );
    return {
      ...page,
      items: page.items.map((event) =>
        !staff && event.kind === 'STATUS_CHANGED'
          ? { ...event, text: event.text.split(':', 1)[0] }
          : event,
      ),
    };
  }
  private caseLinks(
    p: Profile,
    where: Prisma.TravelTicketWhereInput,
    query: TravelPageDto,
  ) {
    const scoped = { AND: [this.scope(p), where] };
    return readPage(
      query,
      () => this.db.travelTicket.count({ where: scoped }),
      (skip, take) =>
        this.db.travelTicket.findMany({
          where: scoped,
          skip,
          take,
          select: {
            id: true,
            reference: true,
            title: true,
            status: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
    );
  }
  async related(userId: string, id: string, query: TravelPageDto) {
    const p = await this.profile(userId);
    const t = await this.ticket(p, id, this.db);
    return this.caseLinks(
      p,
      t.bookingId
        ? { bookingId: t.bookingId, id: { not: id } }
        : { id: '__none__' },
      query,
    );
  }
  async bookingTickets(userId: string, id: string, query: TravelPageDto) {
    const p = await this.profile(userId);
    const scope = this.scope(p);
    const booking = await this.db.travelBooking.findFirst({
      where: {
        id,
        ...(scope.region ? { region: scope.region } : {}),
        ...(scope.agencyId ? { agencyId: scope.agencyId } : {}),
        ...(scope.customerId ? { customerId: scope.customerId } : {}),
      },
    });
    if (!booking || p.kind === 'SUPPLIER')
      throw new NotFoundException('Booking not found.');
    return this.caseLinks(p, { bookingId: id }, query);
  }
  async conversations(userId: string, query: TravelPageDto, ticketId?: string) {
    const p = await this.profile(userId);
    if (ticketId) {
      this.staff(p);
      await this.ticket(p, ticketId, this.db);
    } else if (p.kind !== 'SUPPLIER')
      throw new ForbiddenException('Supplier access required.');
    const where = ticketId
      ? { ticketId }
      : { supplierId: p.supplierId || 'NONE' };
    return readPage(
      query,
      () => this.db.travelConversation.count({ where }),
      async (skip, take) => {
        const rows = await this.db.travelConversation.findMany({
          where,
          skip,
          take,
          include: { supplier: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        return rows.map((c) => ({ ...c, messages: [] }));
      },
    );
  }
  async conversationMessages(userId: string, id: string, query: TravelPageDto) {
    const p = await this.profile(userId);
    const c = await this.db.travelConversation.findFirst({
      where: {
        id,
        ...(p.kind === 'SUPPLIER'
          ? { supplierId: p.supplierId || 'NONE' }
          : {}),
      },
    });
    if (!c) throw new NotFoundException('Conversation not found.');
    if (p.kind !== 'SUPPLIER') {
      this.staff(p);
      await this.ticket(p, c.ticketId, this.db);
    }
    const where = { conversationId: id };
    return this.messagePage(where, query);
  }
  private async ticket(p: Profile, id: string, tx: Tx): Promise<Case> {
    const ticket = await tx.travelTicket.findFirst({
      where: { AND: [{ id }, this.scope(p)] },
    });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    return ticket;
  }
  private async now(tx: Tx = this.db) {
    if (process.env.OPSDESK_DEMO !== 'true') return new Date();
    const clock = await tx.travelClock.findUnique({ where: { id: 'demo' } });
    return new Date(Date.now() + (clock?.offsetMinutes || 0) * 60000);
  }
  private event(
    tx: Tx,
    ticketId: string,
    kind: string,
    text: string,
    actorId: string,
    now: Date,
  ) {
    return tx.travelEvent.create({
      data: { ticketId, kind, text, actorId, createdAt: now },
    });
  }
  private bookingScope(p: Profile): Prisma.TravelBookingWhereInput {
    if (p.kind === 'SUPPLIER') return { id: '__none__' };
    if (STAFF.includes(p.kind)) {
      const region = this.staffRegion(p);
      return region === null ? {} : { region };
    }
    return {
      agencyId: p.agencyId || 'NONE',
      ...(p.kind === 'CUSTOMER' ? { customerId: p.userId } : {}),
    };
  }
  async bookings(userId: string, query: TravelDirectoryDto) {
    const p = await this.profile(userId);
    const search = query.search?.trim();
    const where: Prisma.TravelBookingWhereInput = {
      AND: [
        this.bookingScope(p),
        search
          ? {
              OR: [
                { reference: { contains: search, mode: 'insensitive' } },
                { destination: { contains: search, mode: 'insensitive' } },
                { agency: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {},
      ],
    };
    const page = await readPage(
      query,
      () => this.db.travelBooking.count({ where }),
      (skip, take) =>
        this.db.travelBooking.findMany({
          where,
          skip,
          take,
          orderBy: [{ reference: 'asc' }, { id: 'asc' }],
          include: { supplier: true, agency: true },
        }),
    );
    const customers = await this.db.user.findMany({
      where: { id: { in: page.items.map((b) => b.customerId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    return {
      ...page,
      items: page.items.map((b) => ({
        ...b,
        customerName:
          customers
            .filter((c) => c.id === b.customerId)
            .map((c) => `${c.firstName} ${c.lastName}`)[0] || 'Traveler',
      })),
    };
  }
  async people(userId: string, query: TravelDirectoryDto) {
    const p = await this.profile(userId);
    const region = this.staffRegion(p);
    const bookingScope =
      p.kind === 'SUPPLIER'
        ? Prisma.sql`FALSE`
        : STAFF.includes(p.kind)
          ? region === null
            ? Prisma.sql`TRUE`
            : Prisma.sql`b.region = ${region}`
          : Prisma.sql`b."agencyId" = ${p.agencyId || 'NONE'} AND ${p.kind === 'CUSTOMER' ? Prisma.sql`b."customerId" = ${p.userId}` : Prisma.sql`TRUE`}`;
    const ticketScope = STAFF.includes(p.kind)
      ? region === null
        ? Prisma.sql`TRUE`
        : Prisma.sql`t.region = ${region}`
      : p.kind === 'AGENCY'
        ? Prisma.sql`t."agencyId" = ${p.agencyId || 'NONE'}`
        : p.kind === 'CUSTOMER'
          ? Prisma.sql`t."agencyId" = ${p.agencyId || 'NONE'} AND t."customerId" = ${p.userId}`
          : Prisma.sql`FALSE`;
    const threadScope =
      p.kind === 'SUPPLIER'
        ? Prisma.sql`c."supplierId" = ${p.supplierId || 'NONE'}`
        : STAFF.includes(p.kind)
          ? Prisma.sql`EXISTS (SELECT 1 FROM "TravelTicket" t WHERE t.id = c."ticketId" AND ${ticketScope})`
          : Prisma.sql`FALSE`;
    // Build authorized IDs once. Correlated OR/EXISTS predicates repeated the
    // ticket/thread scans for every profile, including out-of-region customers.
    const visible = Prisma.sql`WITH visible AS MATERIALIZED (
      SELECT ${p.userId}::text AS id
      UNION SELECT "userId" FROM "TravelProfile" WHERE kind IN ('AGENT', 'MANAGER')
      UNION SELECT b."customerId" FROM "TravelBooking" b WHERE ${bookingScope}
      UNION SELECT t."customerId" FROM "TravelTicket" t WHERE ${ticketScope}
      UNION SELECT m."senderId" FROM "TravelMessage" m
        JOIN "TravelConversation" c ON c.id = m."conversationId" WHERE ${threadScope}
    )`;
    const search = query.search?.trim() || '';
    const predicate = Prisma.sql`${query.kind ? Prisma.sql`p.kind = ${query.kind}` : Prisma.sql`TRUE`} AND (strpos(lower(u."firstName"), lower(${search})) > 0 OR strpos(lower(u."lastName"), lower(${search})) > 0)`;
    const from = Prisma.sql`FROM visible v JOIN "TravelProfile" p ON p."userId" = v.id JOIN "User" u ON u.id = p."userId" WHERE ${predicate}`;
    const result = await readPage(
      query,
      async () =>
        Number(
          (
            await this.db.$queryRaw<{ count: bigint }[]>(
              Prisma.sql`${visible} SELECT count(*) ${from}`,
            )
          )[0].count,
        ),
      (skip, take) =>
        this.db.$queryRaw<{ id: string }[]>(
          Prisma.sql`${visible} SELECT p."userId" AS id ${from} ORDER BY u."firstName", p."userId" LIMIT ${take} OFFSET ${skip}`,
        ),
    );
    const where = { userId: { in: result.items.map((v) => v.id) } };
    const records = await this.db.travelProfile.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    const page = {
      ...result,
      items: result.items.flatMap((id) =>
        records.filter((v) => v.userId === id.id),
      ),
    };
    return {
      ...page,
      items: page.items.map((v) => ({
        id: v.userId,
        name: `${v.user.firstName} ${v.user.lastName}`,
        kind: v.kind,
        region: v.region,
        available: v.available,
        ...(p.kind === 'MANAGER' ? { shiftCalendar: v.shiftCalendar } : {}),
        ...(p.kind === 'MANAGER' && v.kind === 'AGENT'
          ? { specialties: v.specialties, maxActiveCases: v.maxActiveCases }
          : {}),
      })),
    };
  }
  async workspace(userId: string, compact = false) {
    const p = await this.profile(userId);
    const staff = STAFF.includes(p.kind);
    const now = await this.now();
    const scoped = this.scope(p);
    const count = (where: Prisma.TravelTicketWhereInput = {}) =>
      this.db.travelTicket.count({ where: { AND: [scoped, where] } });
    const activeWhere = { status: { notIn: ['RESOLVED', 'CLOSED'] } };
    const [total, open, urgent, waiting, mine, attention, supplierThreads] =
      compact
        ? await Promise.all([
            count(),
            count(activeWhere),
            count({ ...activeWhere, priority: 'URGENT' }),
            count({ status: 'WAITING_SUPPLIER' }),
            count({ ...activeWhere, agentId: userId }),
            staff
              ? count({
                  ...activeWhere,
                  OR: [
                    { priority: 'URGENT' },
                    { agentId: null },
                    { deadline: { lte: now } },
                    {
                      conversations: {
                        some: { status: 'AWAITING_REPLY', dueAt: { lte: now } },
                      },
                    },
                  ],
                })
              : 0,
            p.kind === 'SUPPLIER'
              ? this.db.travelConversation.count({
                  where: { supplierId: p.supplierId || 'NONE' },
                })
              : 0,
          ])
        : [0, 0, 0, 0, 0, 0, 0];
    const tickets = compact
      ? []
      : await this.db.travelTicket.findMany({
          where: this.scope(p),
          orderBy: { updatedAt: 'desc' },
          include: {
            booking: true,
            messages: {
              where: {
                visibility: staff
                  ? { in: ['CUSTOMER', 'INTERNAL'] }
                  : 'CUSTOMER',
              },
              orderBy: { createdAt: 'asc' },
            },
            events: staff
              ? { orderBy: { createdAt: 'desc' } }
              : {
                  where: {
                    kind: {
                      in: ['CREATED', 'STATUS_CHANGED', 'BOOKING_LINKED'],
                    },
                  },
                  orderBy: { createdAt: 'desc' },
                },
          },
        });
    const ids = tickets.map((t) => t.id);
    const conversations = compact
      ? []
      : await this.db.travelConversation.findMany({
          where:
            p.kind === 'SUPPLIER'
              ? { supplierId: p.supplierId || 'NONE' }
              : staff
                ? { ticketId: { in: ids } }
                : { id: '__none__' },
          include: {
            messages: { orderBy: { createdAt: 'asc' } },
            supplier: true,
          },
          orderBy: { createdAt: 'desc' },
        });
    const bookings =
      compact || p.kind === 'SUPPLIER'
        ? []
        : await this.db.travelBooking.findMany({
            where: staff
              ? p.kind === 'MANAGER' || p.region === 'GLOBAL'
                ? {}
                : { region: p.region || 'NONE' }
              : {
                  agencyId: p.agencyId || 'NONE',
                  ...(p.kind === 'CUSTOMER' ? { customerId: p.userId } : {}),
                },
            include: { supplier: true, agency: true },
            orderBy: { reference: 'asc' },
          });
    const visibleUserIds = [
      ...new Set([
        p.userId,
        ...tickets.map((t) => t.customerId),
        ...bookings.map((b) => b.customerId),
        ...conversations.flatMap((c) => c.messages.map((m) => m.senderId)),
      ]),
    ];
    const people = compact
      ? []
      : await this.db.travelProfile.findMany({
          where: {
            OR: [
              { userId: { in: visibleUserIds } },
              { kind: { in: ['AGENT', 'MANAGER'] } },
            ],
          },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        });
    const agencies = await this.db.travelAgency.findMany({
      where: staff ? {} : { id: p.agencyId || 'NONE' },
    });
    const clock = await this.db.travelClock.findUnique({
      where: { id: 'demo' },
    });
    return {
      me: {
        id: p.userId,
        name: `${p.user.firstName} ${p.user.lastName}`,
        kind: p.kind,
        region: p.region,
        available: p.available,
        agencyId: p.agencyId,
      },
      now: now.toISOString(),
      clockOffsetMinutes: clock?.offsetMinutes || 0,
      demoClockEnabled: process.env.OPSDESK_DEMO === 'true',
      assistant: {
        mode: 'RECORDS',
        description:
          'Case briefs use saved records. External AI is not configured.',
      },
      agencies,
      counts: {
        total,
        open,
        urgent,
        waiting,
        mine,
        attention,
        supplierThreads,
      },
      bookings,
      conversations,
      people: people.map((v) => ({
        id: v.userId,
        name: `${v.user.firstName} ${v.user.lastName}`,
        kind: v.kind,
        region: v.region,
        available: v.available,
        ...(p.kind === 'MANAGER' ? { shiftCalendar: v.shiftCalendar } : {}),
        ...(p.kind === 'MANAGER' && v.kind === 'AGENT'
          ? { specialties: v.specialties, maxActiveCases: v.maxActiveCases }
          : {}),
      })),
      tickets: tickets.map((t) => {
        const related = t.bookingId
          ? tickets.filter((v) => v.bookingId === t.bookingId && v.id !== t.id)
          : [];
        const threads = conversations.filter((c) => c.ticketId === t.id);
        const summary = [
          `${related.length ? `${related.length} earlier or related case${related.length === 1 ? '' : 's'} for this booking.` : 'No other linked cases in your authorized history.'}`,
          t.booking
            ? `Booking ${t.booking.reference}: ${t.booking.destination}.`
            : 'Booking reference needs verification.',
          `${threads.filter((c) => c.status === 'AWAITING_REPLY').length} supplier conversation(s) awaiting a reply.`,
        ].join(' ');
        const events = staff
          ? t.events
          : t.events.map((event) =>
              event.kind === 'STATUS_CHANGED'
                ? { ...event, text: event.text.split(':', 1)[0] }
                : event,
            );
        return {
          ...t,
          ...(!staff ? { escalationOwnerId: null } : {}),
          events,
          relatedIds: related.map((v) => v.id),
          summary,
        };
      }),
      notifications: staff
        ? await this.db.travelEvent.findMany({
            where: {
              ...(compact
                ? { ticket: this.scope(p) }
                : { ticketId: { in: ids } }),
              kind: { in: ALERT_KINDS },
              acknowledgedAt: null,
            },
            orderBy: { createdAt: 'desc' },
            take: 30,
          })
        : [],
    };
  }
  async acknowledgeAlert(userId: string, ticketId: string, alertId: string) {
    this.manager(await this.profile(userId));
    return this.ticketLocked(ticketId, async (tx) => {
      const alert = await tx.travelEvent.findFirst({
        where: { id: alertId, ticketId, kind: { in: ALERT_KINDS } },
        select: { id: true, text: true, acknowledgedAt: true },
      });
      if (!alert) throw new NotFoundException('Alert not found.');
      if (alert.acknowledgedAt) return { acknowledgedAt: alert.acknowledgedAt };
      const now = await this.now(tx);
      await tx.travelEvent.update({
        where: { id: alert.id },
        data: { acknowledgedAt: now },
      });
      await this.event(
        tx,
        ticketId,
        'ALERT_ACKNOWLEDGED',
        `Acknowledged alert: ${alert.text}`,
        userId,
        now,
      );
      return { acknowledgedAt: now };
    });
  }
  async create(userId: string, dto: NewTravelTicketDto) {
    return this.locked(async (tx) => {
      const p = await this.profile(userId, tx);
      if (dto.title.trim().length < 5 || dto.description.trim().length < 10)
        throw new BadRequestException(
          'Provide a meaningful subject and description.',
        );
      if (p.kind === 'SUPPLIER')
        throw new ForbiddenException(
          'Suppliers reply only to shared conversations.',
        );
      const staff = STAFF.includes(p.kind);
      const agencyId = staff ? dto.agencyId : p.agencyId;
      if (!agencyId) throw new BadRequestException('Select the agency.');
      const customerId = p.kind === 'CUSTOMER' ? userId : dto.customerId;
      if (!customerId)
        throw new BadRequestException('Select the customer booking.');
      const customer = await tx.travelProfile.findFirst({
        where: { userId: customerId, kind: 'CUSTOMER', agencyId },
      });
      if (!customer)
        throw new BadRequestException('Customer is not part of this agency.');
      const reference = dto.bookingReference?.trim().toUpperCase();
      const booking = reference
        ? await tx.travelBooking.findFirst({
            where: {
              reference,
              agencyId,
              customerId,
            },
          })
        : null;
      const region = booking?.region || customer.region || 'ASIA';
      if (p.kind === 'AGENT' && p.region !== 'GLOBAL' && p.region !== region)
        throw new ForbiddenException(
          'This booking belongs to another regional team.',
        );
      const now = await this.now(tx);
      const category =
        dto.category || classify(`${dto.title} ${dto.description}`);
      const agents = await tx.travelProfile.findMany({
        where: { kind: 'AGENT' },
      });
      const current = await tx.travelTicket.groupBy({
        by: ['agentId'],
        where: {
          agentId: { not: null },
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        },
        _count: { _all: true },
      });
      const loads: Record<string, number> = {};
      for (const group of current)
        if (group.agentId) loads[group.agentId] = group._count._all;
      const agent = chooseAgent(
        agents.filter((a) => isOnDuty(this.calendar(a.shiftCalendar), now)),
        region,
        loads,
        category,
      );
      const policy = await tx.travelAgency.findUniqueOrThrow({
        where: { id: agencyId },
      });
      const slaSnapshot = this.policySnapshot(policy);
      const responseDeadline = this.responseTarget(
        now,
        policy.responseTargetHours * 3600000,
        slaSnapshot.calendar,
      );
      const deadline = effectiveDeadline(
        category,
        responseDeadline,
        booking,
        now,
      );
      const ticket = await tx.travelTicket.create({
        data: {
          reference: `OPS-${randomUUID().slice(0, 8).toUpperCase()}`,
          title: dto.title.trim(),
          description: dto.description.trim(),
          agencyId,
          customerId,
          bookingId: booking?.id,
          category,
          region,
          deadline,
          responseDeadline,
          responseStartedAt: now,
          slaSnapshot: JSON.parse(
            JSON.stringify(slaSnapshot),
          ) as Prisma.InputJsonValue,
          agentId: agent?.userId,
          priority:
            urgency(category, deadline, booking?.checkInAt, now)?.priority ||
            'MEDIUM',
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.travelMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: userId,
          content: dto.description.trim(),
          visibility: 'CUSTOMER',
          createdAt: now,
        },
      });
      await this.event(
        tx,
        ticket.id,
        'CREATED',
        booking
          ? `Linked to booking ${booking.reference}.`
          : 'Awaiting a verified booking reference.',
        userId,
        now,
      );
      await this.recordResponseTarget(tx, ticket.id, policy, userId, now);
      if (reference && !booking)
        await this.event(
          tx,
          ticket.id,
          'BOOKING_REVIEW_REQUIRED',
          `Submitted reference ${reference} needs manual verification.`,
          userId,
          now,
        );
      await this.event(
        tx,
        ticket.id,
        'ASSIGNED',
        agent
          ? `Routed ${category} to ${region}; assigned the least-loaded eligible ${agent.specialties.length ? 'specialist' : 'generalist'}.`
          : `No eligible available agent for ${category} in ${region}; retained in unassigned queue.`,
        userId,
        now,
      );
      return ticket;
    });
  }
  async update(userId: string, id: string, dto: UpdateTravelTicketDto) {
    return this.locked(async (tx) => {
      await this.lockTicket(tx, id);
      const p = await this.profile(userId, tx),
        t = await this.ticket(p, id, tx),
        now = await this.now(tx);
      const staff = STAFF.includes(p.kind);
      if (
        !staff &&
        (dto.priority || dto.agentId !== undefined || dto.bookingReference)
      )
        throw new ForbiddenException('Support team action required.');
      const data: Prisma.TravelTicketUncheckedUpdateInput = { updatedAt: now };
      let booking = t.bookingId
        ? await tx.travelBooking.findUnique({ where: { id: t.bookingId } })
        : null;
      if (dto.bookingReference) {
        booking = await tx.travelBooking.findFirst({
          where: {
            reference: dto.bookingReference.trim().toUpperCase(),
            agencyId: t.agencyId,
            customerId: t.customerId,
            region: t.region,
          },
        });
        if (!booking)
          throw new BadRequestException(
            'No accessible booking matches this customer and region.',
          );
        data.bookingId = booking.id;
        data.responseDeadline = t.responseDeadline ?? t.deadline;
        data.deadline = effectiveDeadline(
          t.category,
          t.slaPausedAt
            ? new Date('9999-01-01T00:00:00Z')
            : data.responseDeadline,
          booking,
          this.responseCycleStart(t),
        );
        await this.event(
          tx,
          id,
          'BOOKING_LINKED',
          `Booking verified: ${booking.reference}.`,
          userId,
          now,
        );
      }
      if (dto.status && dto.status !== t.status) {
        if (!staff && !['OPEN', 'CLOSED'].includes(dto.status))
          throw new ForbiddenException(
            'Customers can close or reopen their own case.',
          );
        if (!staff && dto.status === 'OPEN' && active(t.status))
          throw new BadRequestException('This ticket is already active.');
        if (['RESOLVED', 'CLOSED'].includes(dto.status) && !dto.reason?.trim())
          throw new BadRequestException('Add a resolution or closure reason.');
        data.status = dto.status;
        data.resolvedAt = active(dto.status) ? null : now;
        if (!active(t.status) && active(dto.status)) {
          const policy = await tx.travelAgency.findUniqueOrThrow({
            where: { id: t.agencyId },
          });
          const snapshot = this.policySnapshot(policy);
          data.slaSnapshot = JSON.parse(
            JSON.stringify(snapshot),
          ) as Prisma.InputJsonValue;
          data.slaPausedAt = null;
          data.slaRemainingMs = null;
          data.responseDeadline = this.responseTarget(
            now,
            policy.responseTargetHours * 3600000,
            snapshot.calendar,
          );
          data.responseStartedAt = now;
          data.deadline = effectiveDeadline(
            t.category,
            data.responseDeadline,
            booking,
            now,
          );
          await this.recordResponseTarget(tx, t.id, policy, userId, now);
        }
        await this.event(
          tx,
          id,
          'STATUS_CHANGED',
          `${t.status} → ${dto.status}${dto.reason?.trim() ? ': ' + dto.reason.trim() : ''}`,
          userId,
          now,
        );
      }
      if (dto.priority && dto.priority !== t.priority) {
        data.priority = dto.priority;
        await this.event(
          tx,
          id,
          'PRIORITY_CHANGED',
          `${t.priority} → ${dto.priority}. ${dto.reason?.trim() || 'Agent review.'}`,
          userId,
          now,
        );
      }
      if (dto.agentId !== undefined) {
        if (p.kind !== 'MANAGER' && dto.agentId !== p.userId)
          throw new ForbiddenException(
            'Only a manager can reassign another agent.',
          );
        if (t.autoHandoff) {
          data.autoHandoff = false;
          await this.event(
            tx,
            id,
            'HANDOFF_POLICY_CHANGED',
            'Automatic workload handoff disabled by manual assignment.',
            userId,
            now,
          );
        }
      }
      if (dto.agentId !== undefined && dto.agentId !== t.agentId) {
        if (p.kind !== 'MANAGER' && dto.agentId !== p.userId)
          throw new ForbiddenException(
            'Only a manager can reassign another agent.',
          );
        const agent = dto.agentId
          ? await tx.travelProfile.findUnique({
              where: { userId: dto.agentId },
            })
          : null;
        if (
          dto.agentId &&
          (!agent ||
            agent.kind !== 'AGENT' ||
            agent.status !== 'ACTIVE' ||
            !agent.available ||
            !isOnDuty(this.calendar(agent.shiftCalendar), now) ||
            ![t.region, 'GLOBAL'].includes(agent.region || ''))
        )
          throw new BadRequestException(
            'Choose an available agent in this regional team.',
          );
        data.agentId = dto.agentId || null;
        await this.event(
          tx,
          id,
          'ASSIGNED',
          `Owner changed from ${t.agentId || 'unassigned'} to ${dto.agentId || 'unassigned'}. ${dto.reason || ''}`,
          userId,
          now,
        );
      }
      return tx.travelTicket.update({ where: { id }, data });
    });
  }
  async message(userId: string, id: string, dto: TravelMessageDto) {
    return this.ticketLocked(id, async (tx) => {
      const p = await this.profile(userId, tx);
      await this.ticket(p, id, tx);
      if (dto.visibility === 'INTERNAL') this.staff(p);
      if (!dto.content.trim())
        throw new BadRequestException('Message cannot be empty.');
      const now = await this.now(tx);
      const message = await tx.travelMessage.create({
        data: {
          ticketId: id,
          senderId: userId,
          content: dto.content.trim(),
          visibility: dto.visibility,
          createdAt: now,
        },
      });
      await tx.travelTicket.update({ where: { id }, data: { updatedAt: now } });
      return message;
    });
  }
  async conversation(userId: string, id: string, dto: NewConversationDto) {
    return this.ticketLocked(id, async (tx) => {
      const p = await this.profile(userId, tx);
      this.staff(p);
      const t = await this.ticket(p, id, tx);
      if (!active(t.status))
        throw new BadRequestException(
          'Reopen the case before contacting the supplier.',
        );
      const booking = t.bookingId
        ? await tx.travelBooking.findUnique({ where: { id: t.bookingId } })
        : null;
      if (!booking)
        throw new BadRequestException(
          'Verify the booking before contacting a supplier.',
        );
      if (dto.subject.trim().length < 3 || !dto.content.trim())
        throw new BadRequestException(
          'Provide a supplier subject and message.',
        );
      const now = await this.now(tx);
      const c = await tx.travelConversation.create({
        data: {
          ticketId: id,
          supplierId: booking.supplierId,
          subject: dto.subject.trim(),
          dueAt: new Date(now.getTime() + 4 * 3600000),
          createdAt: now,
        },
      });
      await tx.travelMessage.create({
        data: {
          ticketId: id,
          conversationId: c.id,
          senderId: userId,
          visibility: 'SUPPLIER',
          content: dto.content.trim(),
          createdAt: now,
        },
      });
      await tx.travelTicket.update({
        where: { id },
        data: { status: 'WAITING_SUPPLIER', updatedAt: now },
      });
      await this.event(
        tx,
        id,
        'SUPPLIER_CONTACTED',
        `Supplier conversation opened: ${c.subject}.`,
        userId,
        now,
      );
      return c;
    });
  }
  async reply(userId: string, id: string, dto: SupplierReplyDto) {
    return this.conversationLocked(id, async (tx) => {
      const p = await this.profile(userId, tx);
      const c = await tx.travelConversation.findUnique({ where: { id } });
      if (!c) throw new NotFoundException('Conversation not found.');
      if (p.kind === 'SUPPLIER') {
        if (p.supplierId !== c.supplierId)
          throw new NotFoundException('Conversation not found.');
      } else {
        this.staff(p);
        await this.ticket(p, c.ticketId, tx);
      }
      if (c.status === 'CLOSED')
        throw new BadRequestException(
          'This supplier conversation is closed. Ask the support team to reopen it.',
        );
      if (!dto.content.trim())
        throw new BadRequestException('Message cannot be empty.');
      const now = await this.now(tx);
      await tx.travelMessage.create({
        data: {
          ticketId: c.ticketId,
          conversationId: id,
          senderId: userId,
          visibility: 'SUPPLIER',
          content: dto.content.trim(),
          createdAt: now,
        },
      });
      await tx.travelConversation.update({
        where: { id },
        data: {
          status: p.kind === 'SUPPLIER' ? 'REPLIED' : 'AWAITING_REPLY',
          ...(p.kind === 'SUPPLIER'
            ? {}
            : { dueAt: new Date(now.getTime() + 4 * 3600000) }),
        },
      });
      const ticket = await tx.travelTicket.findUniqueOrThrow({
        where: { id: c.ticketId },
      });
      await this.syncSupplierWait(tx, ticket, p.kind !== 'SUPPLIER', now);
      await this.event(
        tx,
        c.ticketId,
        'SUPPLIER_REPLY',
        p.kind === 'SUPPLIER'
          ? 'Supplier replied; agent review required.'
          : 'Agent followed up with supplier.',
        userId,
        now,
      );
      return { success: true };
    });
  }

  private async syncSupplierWait(
    tx: Tx,
    ticket: Case,
    requestedReply: boolean,
    now: Date,
  ) {
    if (!active(ticket.status)) return;
    let status = ticket.status;
    if (requestedReply) {
      status = 'WAITING_SUPPLIER';
    } else if (status === 'WAITING_SUPPLIER') {
      const pending = await tx.travelConversation.findFirst({
        where: { ticketId: ticket.id, status: 'AWAITING_REPLY' },
        select: { id: true },
      });
      if (!pending) status = 'IN_PROGRESS';
    }
    await tx.travelTicket.update({
      where: { id: ticket.id },
      data: { status, updatedAt: now },
    });
  }

  async conversationStatus(userId: string, id: string, status: string) {
    return this.conversationLocked(id, async (tx) => {
      const p = await this.profile(userId, tx);
      this.staff(p);
      const conversation = await tx.travelConversation.findUnique({
        where: { id },
      });
      if (!conversation) throw new NotFoundException('Conversation not found.');
      const ticket = await this.ticket(p, conversation.ticketId, tx);
      if (conversation.status === status) return { success: true };
      if (!active(ticket.status) && status !== 'CLOSED')
        throw new BadRequestException(
          'Reopen the ticket before reopening a supplier conversation.',
        );
      const now = await this.now(tx);
      await tx.travelConversation.update({
        where: { id },
        data: {
          status,
          ...(status === 'AWAITING_REPLY'
            ? { dueAt: new Date(now.getTime() + 4 * 3600000) }
            : {}),
        },
      });
      await this.syncSupplierWait(tx, ticket, status === 'AWAITING_REPLY', now);
      await this.event(
        tx,
        ticket.id,
        'SUPPLIER_THREAD_UPDATED',
        `Supplier conversation ${status === 'CLOSED' ? 'closed' : 'reopened'}: ${conversation.subject}.`,
        userId,
        now,
      );
      return { success: true };
    });
  }
  async advance(userId: string, minutes: number) {
    this.manager(await this.profile(userId));
    if (process.env.OPSDESK_DEMO !== 'true')
      throw new ForbiddenException('Demo clock is disabled.');
    await this.locked((tx) =>
      tx.travelClock.upsert({
        where: { id: 'demo' },
        create: { id: 'demo', offsetMinutes: minutes },
        update: { offsetMinutes: { increment: minutes } },
      }),
    );
    return this.sweep();
  }
  async availability(userId: string, available: boolean) {
    return this.locked(async (tx) => {
      const p = await this.profile(userId, tx);
      this.staff(p);
      return tx.travelProfile.update({
        where: { userId },
        data: { available },
      });
    });
  }
  private responseCycleStart(ticket: Case) {
    return (
      ticket.responseStartedAt ??
      new Date(
        Math.max(
          ticket.createdAt.getTime(),
          (ticket.responseDeadline?.getTime() ?? 0) - RESPONSE_WINDOW_MS,
        ),
      )
    );
  }
  private recordResponseTarget(
    tx: Tx,
    ticketId: string,
    policy: { responseTargetHours: number; responsePolicyVersion: number },
    userId: string,
    now: Date,
  ) {
    return this.event(
      tx,
      ticketId,
      'RESPONSE_TARGET_SET',
      `Agency policy v${policy.responsePolicyVersion}: ${policy.responseTargetHours} service hours to respond.`,
      userId,
      now,
    );
  }
  async updateSchedule(userId: string, id: string, dto: BookingScheduleDto) {
    return this.locked(async (tx) => {
      this.manager(await this.profile(userId, tx));
      const previous = await tx.travelBooking.findUnique({ where: { id } });
      if (!previous) throw new NotFoundException('Booking not found.');
      const schedule = {
        checkInAt: dto.checkInAt ? new Date(dto.checkInAt) : previous.checkInAt,
        departureAt:
          dto.departureAt === undefined
            ? previous.departureAt
            : dto.departureAt && new Date(dto.departureAt),
        cancellationCutoffAt:
          dto.cancellationCutoffAt === undefined
            ? previous.cancellationCutoffAt
            : dto.cancellationCutoffAt && new Date(dto.cancellationCutoffAt),
      };
      if (
        schedule.cancellationCutoffAt &&
        (schedule.cancellationCutoffAt > schedule.checkInAt ||
          (schedule.departureAt &&
            schedule.cancellationCutoffAt > schedule.departureAt))
      )
        throw new BadRequestException(
          'The cancellation cutoff must precede travel.',
        );
      if (
        +schedule.checkInAt === +previous.checkInAt &&
        Number(schedule.departureAt) === Number(previous.departureAt) &&
        Number(schedule.cancellationCutoffAt) ===
          Number(previous.cancellationCutoffAt)
      )
        return previous;
      // Acquire affected rows before reading ticket state or changing the booking.
      await tx.$queryRaw`SELECT id FROM "TravelTicket" WHERE "bookingId" = ${id} ORDER BY id FOR UPDATE`;
      const booking = await tx.travelBooking.update({
        where: { id },
        data: schedule,
      });
      const tickets = await tx.travelTicket.findMany({
        where: { bookingId: id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      });
      const now = await this.now(tx);
      for (const ticket of tickets) {
        const responseDeadline = ticket.slaPausedAt
          ? new Date('9999-01-01T00:00:00Z')
          : (ticket.responseDeadline ?? ticket.deadline);
        const deadline = effectiveDeadline(
          ticket.category,
          responseDeadline,
          booking,
          this.responseCycleStart(ticket),
        );
        if (+deadline === +ticket.deadline) continue;
        await tx.travelTicket.update({
          where: { id: ticket.id },
          data: {
            deadline,
            ...(ticket.slaPausedAt ? {} : { responseDeadline }),
            updatedAt: now,
          },
        });
        await this.event(
          tx,
          ticket.id,
          'DEADLINE_CHANGED',
          `Booking schedule changed the case deadline from ${ticket.deadline.toISOString()} to ${deadline.toISOString()}.`,
          userId,
          now,
        );
      }
      return booking;
    });
  }
  async updateSpecialties(
    userId: string,
    id: string,
    dto: AgentSpecialtiesDto,
  ) {
    return this.locked(async (tx) => {
      this.manager(await this.profile(userId, tx));
      const agent = await tx.travelProfile.findUnique({
        where: { userId: id },
      });
      if (agent?.kind !== 'AGENT')
        throw new NotFoundException('Agent not found.');
      return tx.travelProfile.update({
        where: { userId: id },
        data: {
          specialties: dto.specialties,
          maxActiveCases: dto.maxActiveCases,
        },
        select: { userId: true, specialties: true, maxActiveCases: true },
      });
    });
  }
  async updateAgencyResponsePolicy(userId: string, id: string, hours: number) {
    return this.locked(async (tx) => {
      this.manager(await this.profile(userId, tx));
      const agency = await tx.travelAgency.findUnique({ where: { id } });
      if (!agency) throw new NotFoundException('Agency not found.');
      if (agency.responseTargetHours === hours) return agency;
      return tx.travelAgency.update({
        where: { id },
        data: {
          responseTargetHours: hours,
          responsePolicyVersion: { increment: 1 },
        },
      });
    });
  }
  private responseTarget(
    start: Date,
    milliseconds: number,
    calendar: ServiceCalendar | null,
  ) {
    try {
      return calculateServiceDeadline(start, milliseconds, calendar);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Insufficient calendar coverage.',
      );
    }
  }
  private calendar(value: unknown): ServiceCalendar | null {
    if (value === null) return null;
    try {
      return validateCalendar(value);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid calendar.',
      );
    }
  }
  private policySnapshot(policy: {
    slaCalendar: Prisma.JsonValue | null;
    responseTargetHours: number;
    responsePolicyVersion: number;
  }) {
    return {
      calendar: this.calendar(policy.slaCalendar),
      hours: policy.responseTargetHours,
      version: policy.responsePolicyVersion,
    };
  }
  private reason(value: string) {
    if (value.trim().length < 3)
      throw new BadRequestException('Add a meaningful audit reason.');
    return value.trim();
  }
  async configureCalendar(userId: string, id: string, dto: CalendarPolicyDto) {
    this.manager(await this.profile(userId));
    const calendar = this.calendar(dto.calendar),
      reason = this.reason(dto.reason);
    // Reject configurations that cannot satisfy the largest supported target.
    if (calendar) this.responseTarget(new Date(), 168 * 3600000, calendar);
    return this.locked(async (tx) => {
      this.manager(await this.profile(userId, tx));
      const agency = await tx.travelAgency.findUnique({ where: { id } });
      if (!agency) throw new NotFoundException('Agency not found.');
      if (
        JSON.stringify(this.calendar(agency.slaCalendar)) ===
        JSON.stringify(calendar)
      )
        return agency;
      const updated = await tx.travelAgency.update({
        where: { id },
        data: {
          slaCalendar: calendar
            ? (JSON.parse(JSON.stringify(calendar)) as Prisma.InputJsonValue)
            : Prisma.DbNull,
          responsePolicyVersion: { increment: 1 },
        },
      });
      await tx.membershipAudit.create({
        data: {
          actorId: userId,
          entityId: id,
          action: 'SLA_CALENDAR_CHANGED',
          reason,
        },
      });
      return updated;
    });
  }
  async configureShift(userId: string, id: string, dto: CalendarPolicyDto) {
    const calendar = this.calendar(dto.calendar),
      reason = this.reason(dto.reason);
    return this.locked(async (tx) => {
      this.manager(await this.profile(userId, tx));
      const target = await tx.travelProfile.findUnique({
        where: { userId: id },
      });
      if (!target || !STAFF.includes(target.kind))
        throw new NotFoundException('Support member not found.');
      if (
        JSON.stringify(this.calendar(target.shiftCalendar)) ===
        JSON.stringify(calendar)
      )
        return { id, calendar };
      await tx.travelProfile.update({
        where: { userId: id },
        data: {
          shiftCalendar: calendar
            ? (JSON.parse(JSON.stringify(calendar)) as Prisma.InputJsonValue)
            : Prisma.DbNull,
        },
      });
      await tx.membershipAudit.create({
        data: {
          actorId: userId,
          entityId: id,
          action: 'SHIFT_CALENDAR_CHANGED',
          reason,
        },
      });
      return { id, calendar };
    });
  }
  async pauseSla(userId: string, id: string, dto: SlaPauseDto) {
    const reason = this.reason(dto.reason);
    return this.locked(async (tx) => {
      await this.lockTicket(tx, id);
      const actor = await this.profile(userId, tx);
      this.staff(actor);
      const ticket = await this.ticket(actor, id, tx),
        now = await this.now(tx);
      if (!active(ticket.status))
        throw new BadRequestException('Only active cases can pause or resume.');
      if (Boolean(ticket.slaPausedAt) === dto.paused) return ticket;
      const snapshot = ticket.slaSnapshot as {
        calendar?: Prisma.JsonValue;
      } | null;
      const calendar = this.calendar(snapshot?.calendar ?? null);
      let responseDeadline = ticket.responseDeadline ?? ticket.deadline;
      let remaining: number | null = null;
      if (dto.paused) {
        if (responseDeadline <= now)
          throw new BadRequestException(
            'An already breached response target cannot be paused.',
          );
        remaining = serviceTimeBetween(now, responseDeadline, calendar);
      } else
        responseDeadline = this.responseTarget(
          now,
          ticket.slaRemainingMs ?? 0,
          calendar,
        );
      const booking = ticket.bookingId
        ? await tx.travelBooking.findUnique({ where: { id: ticket.bookingId } })
        : null;
      const deadline = effectiveDeadline(
        ticket.category,
        dto.paused ? new Date('9999-01-01T00:00:00Z') : responseDeadline,
        booking,
        this.responseCycleStart(ticket),
      );
      const updated = await tx.travelTicket.update({
        where: { id },
        data: {
          responseDeadline,
          deadline,
          slaPausedAt: dto.paused ? now : null,
          slaRemainingMs: remaining,
          updatedAt: now,
        },
      });
      await this.event(
        tx,
        id,
        dto.paused ? 'SLA_PAUSED' : 'SLA_RESUMED',
        reason,
        userId,
        now,
      );
      return updated;
    });
  }
  async assignEscalationOwner(
    userId: string,
    id: string,
    dto: EscalationOwnerDto,
  ) {
    const reason = this.reason(dto.reason);
    if (
      dto.ownerId !== null &&
      (typeof dto.ownerId !== 'string' ||
        !dto.ownerId ||
        dto.ownerId.length > 200)
    )
      throw new BadRequestException('Choose a manager or release ownership.');
    const ownerId = dto.ownerId;
    return this.locked(async (tx) => {
      await this.lockTicket(tx, id);
      const actor = await this.profile(userId, tx);
      this.manager(actor);
      const ticket = await this.ticket(actor, id, tx),
        now = await this.now(tx);
      const managers = await tx.travelProfile.findMany({
        where: { kind: 'MANAGER', status: 'ACTIVE' },
      });
      if (
        ownerId &&
        !managers.some(
          (m) =>
            m.userId === ownerId &&
            m.available &&
            isOnDuty(this.calendar(m.shiftCalendar), now),
        )
      )
        throw new BadRequestException('Choose an active on-duty manager.');
      if (ticket.escalationOwnerId === ownerId) return ticket;
      const result = await tx.travelTicket.update({
        where: { id },
        data: { escalationOwnerId: ownerId },
      });
      await this.event(
        tx,
        id,
        'ESCALATION_OWNER_CHANGED',
        `Owner ${ticket.escalationOwnerId ?? 'unowned'} -> ${ownerId ?? 'unowned'}: ${reason}`,
        userId,
        now,
      );
      return result;
    });
  }
  private async refreshEscalationOwner(tx: Tx, ticket: Case, now: Date) {
    const outstanding = await tx.travelEvent.count({
      where: {
        ticketId: ticket.id,
        kind: { in: ALERT_KINDS },
        acknowledgedAt: null,
      },
    });
    if (!outstanding) return;
    const current = await tx.travelTicket.findUniqueOrThrow({
      where: { id: ticket.id },
      select: { escalationOwnerId: true },
    });
    // Membership/coverage writers take profile UPDATE locks but never ticket
    // locks. Shared locks here prevent committing a choice based on a profile
    // that was concurrently suspended or taken off duty. Lock IDs consistently.
    const lockedManagers = await tx.$queryRaw<{ userId: string }[]>`
      SELECT "userId" FROM "TravelProfile" WHERE kind = 'MANAGER'
      ORDER BY "userId" FOR SHARE
    `;
    const managers = await tx.travelProfile.findMany({
      where: {
        userId: { in: lockedManagers.map((m) => m.userId) },
        kind: 'MANAGER',
        status: 'ACTIVE',
      },
    });
    const ownerId = chooseEscalationOwner(
      managers.map((m) => ({
        ...m,
        shiftCalendar: this.calendar(m.shiftCalendar),
      })),
      now,
      current.escalationOwnerId,
    );
    if (ownerId === current.escalationOwnerId) return;
    await tx.travelTicket.update({
      where: { id: ticket.id },
      data: { escalationOwnerId: ownerId },
    });
    await this.event(
      tx,
      ticket.id,
      'ESCALATION_OWNER_CHANGED',
      `Coverage handoff ${current.escalationOwnerId ?? 'unowned'} -> ${ownerId ?? 'unowned'}.`,
      'system',
      now,
    );
  }
  async handoffPolicy(userId: string, id: string, dto: HandoffPolicyDto) {
    return this.locked(async (tx) => {
      await this.lockTicket(tx, id);
      const p = await this.profile(userId, tx);
      this.manager(p);
      const ticket = await this.ticket(p, id, tx);
      if (!active(ticket.status))
        throw new BadRequestException('Case is no longer active.');
      const reason = dto.reason.trim();
      if (reason.length < 3)
        throw new BadRequestException('Add a handoff policy reason.');
      if (ticket.autoHandoff === dto.enabled) return ticket;
      const now = await this.now(tx);
      const updated = await tx.travelTicket.update({
        where: { id },
        data: { autoHandoff: dto.enabled, updatedAt: now },
      });
      await this.event(
        tx,
        id,
        'HANDOFF_POLICY_CHANGED',
        `Automatic workload handoff ${dto.enabled ? 'enabled' : 'disabled'}: ${reason}`,
        userId,
        now,
      );
      return updated;
    });
  }
  private async handoffWorkload() {
    let cursor: string | undefined;
    for (;;) {
      const candidates = await this.db.travelTicket.findMany({
        where: {
          autoHandoff: true,
          status: { notIn: ['CLOSED', 'RESOLVED'] },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 100,
      });
      if (!candidates.length) return;
      for (const { id } of candidates) {
        await this.locked(async (tx) => {
          await this.lockTicket(tx, id);
          const ticket = await tx.travelTicket.findUnique({ where: { id } });
          if (!ticket?.autoHandoff || !active(ticket.status)) return;
          const now = await this.now(tx);
          const agents = await tx.travelProfile.findMany({
            where: { kind: 'AGENT' },
          });
          const eligible = agents.filter((a) =>
            isOnDuty(this.calendar(a.shiftCalendar), now),
          );
          const current = eligible.find((a) => a.userId === ticket.agentId);
          // Capacity gates new assignments. It does not evict a covered owner.
          if (
            current &&
            chooseAgent(
              [{ ...current, maxActiveCases: null }],
              ticket.region,
              {},
              ticket.category,
            )
          )
            return;
          const counts = await tx.travelTicket.groupBy({
            by: ['agentId'],
            where: {
              agentId: { not: null },
              status: { notIn: ['CLOSED', 'RESOLVED'] },
            },
            _count: { _all: true },
          });
          const loads: Record<string, number> = {};
          for (const row of counts)
            if (row.agentId) loads[row.agentId] = row._count._all;
          const next =
            chooseAgent(eligible, ticket.region, loads, ticket.category)
              ?.userId ?? null;
          if (next === ticket.agentId) return;
          await tx.travelTicket.update({
            where: { id },
            data: { agentId: next, updatedAt: now },
          });
          await this.event(
            tx,
            id,
            'ASSIGNED',
            `Automatic coverage handoff ${ticket.agentId || 'unassigned'} -> ${next || 'unassigned'}.`,
            'system',
            now,
          );
        });
      }
      cursor = candidates[candidates.length - 1].id;
    }
  }
  async sweep() {
    await this.handoffWorkload();
    // Keyset batches bound memory and transaction duration; every candidate is
    // reread after its row lock, including status, booking and supplier state.
    let cursor: string | undefined;
    let checked = 0;
    for (;;) {
      const selectionTime = await this.now();
      const candidates = await this.db.travelTicket.findMany({
        where: {
          status: { notIn: ['RESOLVED', 'CLOSED'] },
          OR: [
            {
              events: {
                some: { kind: { in: ALERT_KINDS }, acknowledgedAt: null },
              },
            },
            { deadline: { lte: selectionTime } },
            {
              category: { not: 'REFUND' },
              booking: {
                is: {
                  checkInAt: {
                    gt: selectionTime,
                    lte: new Date(
                      +selectionTime + CHECK_IN_HIGH_HOURS * 3600000,
                    ),
                  },
                },
              },
            },
            {
              conversations: {
                some: {
                  status: 'AWAITING_REPLY',
                  dueAt: { lte: selectionTime },
                },
              },
            },
          ],
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 100,
      });
      if (!candidates.length) break;
      for (const candidate of candidates) {
        await this.ticketLocked(candidate.id, async (tx) => {
          const now = await this.now(tx);
          const t = await tx.travelTicket.findUnique({
            where: { id: candidate.id },
            include: {
              booking: { select: { checkInAt: true } },
              conversations: {
                where: { status: 'AWAITING_REPLY', dueAt: { lte: now } },
                select: { id: true, dueAt: true, subject: true },
              },
            },
          });
          if (!t || !active(t.status)) return;

          const rule = urgency(
            t.category,
            t.deadline,
            t.booking?.checkInAt,
            now,
            t.slaPausedAt
              ? new Date('9999-01-01T00:00:00Z')
              : t.responseDeadline,
          );
          await this.refreshEscalationOwner(tx, t, now);
          if (!rule && t.conversations.length === 0) return;
          checked++;
          if (rule) {
            const key = `${t.id}:${rule.reason}:${t.deadline.toISOString()}`;
            const exists = await tx.travelEvent.findUnique({
              where: { uniqueKey: key },
            });
            if (!exists) {
              await tx.travelEvent.create({
                data: {
                  ticketId: t.id,
                  kind:
                    rule.priority === 'URGENT'
                      ? 'ESCALATED'
                      : 'PRIORITY_CHANGED',
                  text: rule.reason,
                  actorId: 'system',
                  uniqueKey: key,
                  createdAt: now,
                },
              });
            }
            if (
              PRIORITIES.indexOf(rule.priority) > PRIORITIES.indexOf(t.priority)
            )
              await tx.travelTicket.update({
                where: { id: t.id },
                data: { priority: rule.priority, updatedAt: now },
              });
          }
          for (const c of t.conversations) {
            const key = `${c.id}:overdue:${c.dueAt.toISOString()}`;
            await tx.travelEvent.upsert({
              where: { uniqueKey: key },
              create: {
                ticketId: t.id,
                kind: 'SUPPLIER_OVERDUE',
                text: `Supplier response target missed: ${c.subject}`,
                actorId: 'system',
                uniqueKey: key,
                createdAt: now,
              },
              update: {},
            });
          }
          await this.refreshEscalationOwner(tx, t, now);
        });
      }
      cursor = candidates[candidates.length - 1].id;
    }
    this.lastSweepCompletedAt = Date.now();
    return { now: (await this.now()).toISOString(), checked };
  }
}
