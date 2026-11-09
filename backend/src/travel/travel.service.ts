import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import {
  BookingScheduleDto,
  NewConversationDto,
  NewTravelTicketDto,
  SupplierReplyDto,
  TravelMessageDto,
  UpdateTravelTicketDto,
} from './travel.dto';
import {
  active,
  chooseAgent,
  classify,
  effectiveDeadline,
  PRIORITIES,
  responseDeadlineFor,
  RESPONSE_WINDOW_MS,
  STAFF,
  urgency,
} from './travel.rules';
type Tx = Prisma.TransactionClient;
type Profile = Prisma.TravelProfileGetPayload<{ include: { user: true } }>;
type Case = Prisma.TravelTicketGetPayload<object>;
@Injectable()
export class TravelService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval>;
  private readonly logger = new Logger(TravelService.name);
  constructor(private readonly db: PrismaService) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.sweep().catch((e: unknown) =>
        this.logger.error(
          `Deadline check failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }, 15000);
    this.timer.unref();
  }
  onModuleDestroy() {
    clearInterval(this.timer);
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
  private async profile(userId: string, tx: Tx = this.db): Promise<Profile> {
    const profile = await tx.travelProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!profile)
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
  private scope(p: Profile): Prisma.TravelTicketWhereInput {
    if (p.kind === 'MANAGER') return {};
    if (p.kind === 'AGENT')
      return p.region === 'GLOBAL' ? {} : { region: p.region || 'NONE' };
    if (p.kind === 'AGENCY') return { agencyId: p.agencyId || 'NONE' };
    if (p.kind === 'CUSTOMER')
      return { customerId: p.userId, agencyId: p.agencyId || 'NONE' };
    return { id: '__not_visible__' };
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
  async workspace(userId: string) {
    const p = await this.profile(userId);
    const staff = STAFF.includes(p.kind);
    const now = await this.now();
    const tickets = await this.db.travelTicket.findMany({
      where: this.scope(p),
      orderBy: { updatedAt: 'desc' },
      include: {
        booking: true,
        messages: {
          where: {
            visibility: staff ? { in: ['CUSTOMER', 'INTERNAL'] } : 'CUSTOMER',
          },
          orderBy: { createdAt: 'asc' },
        },
        events: staff
          ? { orderBy: { createdAt: 'desc' } }
          : {
              where: {
                kind: { in: ['CREATED', 'STATUS_CHANGED', 'BOOKING_LINKED'] },
              },
              orderBy: { createdAt: 'desc' },
            },
      },
    });
    const ids = tickets.map((t) => t.id);
    const conversations = await this.db.travelConversation.findMany({
      where:
        p.kind === 'SUPPLIER'
          ? { supplierId: p.supplierId || 'NONE' }
          : staff
            ? { ticketId: { in: ids } }
            : { id: '__none__' },
      include: { messages: { orderBy: { createdAt: 'asc' } }, supplier: true },
      orderBy: { createdAt: 'desc' },
    });
    const bookings =
      p.kind === 'SUPPLIER'
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
        ...conversations.flatMap((c) => c.messages.map((m) => m.senderId)),
      ]),
    ];
    const people = await this.db.travelProfile.findMany({
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
      bookings,
      conversations,
      people: people.map((v) => ({
        id: v.userId,
        name: `${v.user.firstName} ${v.user.lastName}`,
        kind: v.kind,
        region: v.region,
        available: v.available,
        ...(p.kind === 'MANAGER' && v.kind === 'AGENT'
          ? { specialties: v.specialties }
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
        return { ...t, events, relatedIds: related.map((v) => v.id), summary };
      }),
      notifications: staff
        ? await this.db.travelEvent.findMany({
            where: {
              ticketId: { in: ids },
              kind: { in: ['ESCALATED', 'SUPPLIER_OVERDUE'] },
            },
            orderBy: { createdAt: 'desc' },
            take: 30,
          })
        : [],
    };
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
      const current = await tx.travelTicket.findMany({
        where: { status: { notIn: ['RESOLVED', 'CLOSED'] } },
        select: { agentId: true },
      });
      const loads: Record<string, number> = {};
      current.forEach((t) => {
        if (t.agentId) loads[t.agentId] = (loads[t.agentId] || 0) + 1;
      });
      const agent = chooseAgent(agents, region, loads, category);
      const responseDeadline = responseDeadlineFor(now);
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
          data.responseDeadline,
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
          data.responseDeadline = responseDeadlineFor(now);
          data.deadline = effectiveDeadline(
            t.category,
            data.responseDeadline,
            booking,
            now,
          );
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
            !agent.available ||
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
    return this.locked(async (tx) => {
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
    return this.locked(async (tx) => {
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
    return this.locked(async (tx) => {
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
    return this.locked(async (tx) => {
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
    const p = await this.profile(userId);
    this.staff(p);
    return this.db.travelProfile.update({
      where: { userId },
      data: { available },
    });
  }
  private responseCycleStart(ticket: Case) {
    return new Date(
      Math.max(
        ticket.createdAt.getTime(),
        (ticket.responseDeadline?.getTime() ?? 0) - RESPONSE_WINDOW_MS,
      ),
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
      const booking = await tx.travelBooking.update({
        where: { id },
        data: schedule,
      });
      const tickets = await tx.travelTicket.findMany({
        where: { bookingId: id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      });
      const now = await this.now(tx);
      for (const ticket of tickets) {
        const responseDeadline = ticket.responseDeadline ?? ticket.deadline;
        const deadline = effectiveDeadline(
          ticket.category,
          responseDeadline,
          booking,
          this.responseCycleStart(ticket),
        );
        if (+deadline === +ticket.deadline) continue;
        await tx.travelTicket.update({
          where: { id: ticket.id },
          data: { deadline, responseDeadline, updatedAt: now },
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
  async updateSpecialties(userId: string, id: string, specialties: string[]) {
    return this.locked(async (tx) => {
      this.manager(await this.profile(userId, tx));
      const agent = await tx.travelProfile.findUnique({
        where: { userId: id },
      });
      if (agent?.kind !== 'AGENT')
        throw new NotFoundException('Agent not found.');
      return tx.travelProfile.update({
        where: { userId: id },
        data: { specialties },
        select: { userId: true, specialties: true },
      });
    });
  }
  async sweep() {
    return this.locked(async (tx) => {
      const now = await this.now(tx);
      const tickets = await tx.travelTicket.findMany({
        where: { status: { notIn: ['RESOLVED', 'CLOSED'] } },
        include: { booking: true, conversations: true },
      });
      for (const t of tickets) {
        const rule = urgency(
          t.category,
          t.deadline,
          t.booking?.checkInAt,
          now,
          t.responseDeadline,
        );
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
                  rule.priority === 'URGENT' ? 'ESCALATED' : 'PRIORITY_CHANGED',
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
        for (const c of t.conversations.filter(
          (c) => c.status === 'AWAITING_REPLY' && c.dueAt <= now,
        )) {
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
      }
      return { now: now.toISOString(), checked: tickets.length };
    });
  }
}
