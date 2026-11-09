import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const hour = 3600000;
async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo accounts must not be seeded into production.');
  if (await db.travelTicket.count()) {
    console.log('Travel records already exist; preserved all data.');
    return;
  }
  const hash = await bcrypt.hash('OpsDeskDemo!2026', 10),
    now = new Date();
  const agencies = [
    ['atlas', 'Atlas Travel', 'ATL'],
    ['horizon', 'Horizon Journeys', 'HOR'],
    ['meridian', 'Meridian Holidays', 'MER'],
  ];
  for (const [id, name, code] of agencies)
    await db.travelAgency.upsert({
      where: { id },
      create: { id, name, code },
      update: {},
    });
  const supplierNames = [
    'Aster Hotels',
    'Skyline Airways',
    'Coastline Stays',
    'Terra Experiences',
    'Vista Transfers',
  ];
  for (let i = 0; i < 5; i++)
    await db.travelSupplier.upsert({
      where: { id: `supplier-${i}` },
      create: {
        id: `supplier-${i}`,
        name: supplierNames[i],
        email: `desk${i}@supplier.example`,
      },
      update: {},
    });
  const names = [
    'Maya Sen',
    'Arjun Mehta',
    'Sofia Rossi',
    'Liam Carter',
    'Aisha Khan',
    'Noah Wilson',
    'Isabella Costa',
    'Ethan Park',
    'Priya Nair',
    'Lucas Martin',
    'Zara Ali',
    'Oliver Brown',
    'Amelia Chen',
    'Mateo Silva',
    'Ananya Rao',
    'Leo Garcia',
    'Ella Thompson',
    'Kabir Shah',
    'Mia Novak',
    'Daniel Lee',
  ];
  const regions = ['ASIA', 'EUROPE', 'AMERICAS'];
  async function user(
    id: string,
    name: string,
    email: string,
    role: 'CUSTOMER' | 'AGENT' | 'ADMIN',
    kind: string,
    agencyId?: string,
    region?: string,
    supplierId?: string,
  ) {
    const [firstName, ...last] = name.split(' ');
    await db.user.upsert({
      where: { id },
      create: {
        id,
        email,
        firstName,
        lastName: last.join(' '),
        passwordHash: hash,
        role,
      },
      update: {},
    });
    await db.travelProfile.upsert({
      where: { userId: id },
      create: {
        userId: id,
        kind,
        agencyId,
        region,
        supplierId,
        specialties:
          kind === 'AGENT' && region === 'ASIA' ? ['CHECK_IN', 'REFUND'] : [],
      },
      update: {},
    });
  }
  for (let i = 0; i < 20; i++)
    await user(
      `customer-${i}`,
      names[i],
      i === 0 ? 'maya@opsdesk.demo' : `traveler${i + 1}@opsdesk.demo`,
      'CUSTOMER',
      'CUSTOMER',
      agencies[i % 3][0],
      regions[i % 3],
    );
  await user(
    'manager',
    'Alex Morgan',
    'manager@opsdesk.demo',
    'ADMIN',
    'MANAGER',
    undefined,
    'GLOBAL',
  );
  await user(
    'agent-asia',
    'Riya Sharma',
    'asia@opsdesk.demo',
    'AGENT',
    'AGENT',
    undefined,
    'ASIA',
  );
  await user(
    'agent-europe',
    'James Clarke',
    'europe@opsdesk.demo',
    'AGENT',
    'AGENT',
    undefined,
    'EUROPE',
  );
  await user(
    'agent-americas',
    'Elena Ruiz',
    'americas@opsdesk.demo',
    'AGENT',
    'AGENT',
    undefined,
    'AMERICAS',
  );
  await user(
    'agent-global',
    'Sam Rivera',
    'global@opsdesk.demo',
    'AGENT',
    'AGENT',
    undefined,
    'GLOBAL',
  );
  await user(
    'agency-atlas',
    'Nisha Kapoor',
    'agency@opsdesk.demo',
    'CUSTOMER',
    'AGENCY',
    'atlas',
  );
  await user(
    'agency-horizon',
    'Marco Bell',
    'horizon@opsdesk.demo',
    'CUSTOMER',
    'AGENCY',
    'horizon',
  );
  await user(
    'supplier-user',
    'Aster Reservations',
    'supplier@opsdesk.demo',
    'CUSTOMER',
    'SUPPLIER',
    undefined,
    undefined,
    'supplier-0',
  );
  await user(
    'supplier-other',
    'Skyline Support',
    'skyline@opsdesk.demo',
    'CUSTOMER',
    'SUPPLIER',
    undefined,
    undefined,
    'supplier-1',
  );
  const destinations = [
    'Bali, Indonesia',
    'Paris, France',
    'New York, USA',
    'Tokyo, Japan',
    'Rome, Italy',
    'Cancun, Mexico',
  ];
  const zones = [
    'Asia/Makassar',
    'Europe/Paris',
    'America/New_York',
    'Asia/Tokyo',
    'Europe/Rome',
    'America/Cancun',
  ];
  for (let i = 0; i < 30; i++) {
    const customer = i % 20,
      r = customer % 3;
    const flight = i % 5 === 1;
    const checkInAt = new Date(
      now.getTime() + (i === 0 ? 20 : i === 1 ? 3 : 24 + i * 5) * hour,
    );
    await db.travelBooking.create({
      data: {
        id: `booking-${i}`,
        reference: i === 0 ? 'BK-1042' : `BK-${1042 + i}`,
        agencyId: agencies[customer % 3][0],
        customerId: `customer-${customer}`,
        supplierId: `supplier-${i % 5}`,
        destination: destinations[r + (i % 2) * 3],
        region: regions[r],
        service: flight ? 'Flight' : 'Hotel stay',
        checkInAt,
        departureAt: flight ? new Date(+checkInAt + 2 * hour) : null,
        cancellationCutoffAt: new Date(+checkInAt - 8 * hour),
        timezone: zones[r + (i % 2) * 3],
      },
    });
  }
  const titles = [
    'Hotel voucher not recognized at check-in',
    'Refund still pending after cancellation',
    'Please change the arrival date',
    'Cancellation fee needs clarification',
    'Baggage allowance confirmation',
    'Airport pickup details missing',
  ];
  const cats = [
    'CHECK_IN',
    'REFUND',
    'BOOKING_CHANGE',
    'CANCELLATION',
    'BAGGAGE',
    'OTHER',
  ];
  const statuses = [
    'OPEN',
    'IN_PROGRESS',
    'WAITING_SUPPLIER',
    'RESOLVED',
    'CLOSED',
  ];
  for (let i = 0; i < 60; i++) {
    const b = i % 30,
      customer = b % 20,
      region = regions[customer % 3],
      status = i === 0 ? 'OPEN' : statuses[i % 5];
    const created = new Date(now.getTime() - ((i % 14) + 1) * 24 * hour),
      category = i === 0 ? 'CHECK_IN' : cats[i % 6];
    const ticketId = `ticket-${i}`,
      agentId = `agent-${region.toLowerCase()}`;
    const description =
      i === 0
        ? 'The hotel reception cannot find our booking confirmation. We arrive tomorrow and need a verified voucher. I have contacted support before about this booking.'
        : `${titles[i % 6]}. Please review booking ${b === 0 ? 'BK-1042' : `BK-${1042 + b}`} and the earlier correspondence. We need an update from the supplier.`;
    await db.travelTicket.create({
      data: {
        id: ticketId,
        reference: `OPS-${1042 + i}`,
        title: titles[i % 6],
        description,
        agencyId: agencies[customer % 3][0],
        customerId: `customer-${customer}`,
        bookingId: `booking-${b}`,
        category,
        status,
        region,
        agentId: i % 11 === 0 && i !== 0 ? null : agentId,
        priority: i % 9 === 0 ? 'HIGH' : 'MEDIUM',
        deadline: new Date(
          now.getTime() +
            (i === 0 ? 20 : i % 8 === 0 ? -2 : 8 + (i % 30)) * hour,
        ),
        createdAt: created,
        updatedAt: new Date(now.getTime() - (i % 12) * hour),
        resolvedAt: ['RESOLVED', 'CLOSED'].includes(status)
          ? new Date(created.getTime() + 6 * hour)
          : null,
      },
    });
    await db.travelMessage.create({
      data: {
        ticketId,
        senderId: `customer-${customer}`,
        content: description,
        visibility: 'CUSTOMER',
        createdAt: created,
      },
    });
    await db.travelMessage.create({
      data: {
        ticketId,
        senderId: agentId,
        content:
          'I have reviewed your booking and requested the relevant confirmation. Your earlier messages are attached to this case; you do not need to repeat the details.',
        visibility: 'CUSTOMER',
        createdAt: new Date(created.getTime() + (0.5 + (i % 4)) * hour),
      },
    });
    await db.travelMessage.create({
      data: {
        ticketId,
        senderId: agentId,
        content:
          'Internal handover: verify the supplier response against the booking record before confirming to the customer.',
        visibility: 'INTERNAL',
        createdAt: new Date(created.getTime() + 5 * hour),
      },
    });
    await db.travelEvent.create({
      data: {
        ticketId,
        kind: 'CREATED',
        text: 'Case received and linked to its verified booking.',
        actorId: `customer-${customer}`,
        createdAt: created,
      },
    });
    if (['RESOLVED', 'CLOSED'].includes(status))
      await db.travelEvent.create({
        data: {
          ticketId,
          kind: 'STATUS_CHANGED',
          text: `IN_PROGRESS → ${status}: Supplier confirmation received and customer informed.`,
          actorId: agentId,
          createdAt: new Date(created.getTime() + 6 * hour),
        },
      });
    if (status === 'WAITING_SUPPLIER') {
      const c = await db.travelConversation.create({
        data: {
          ticketId,
          supplierId: `supplier-${b % 5}`,
          subject: `Booking confirmation for ${b === 0 ? 'BK-1042' : `BK-${1042 + b}`}`,
          dueAt: new Date(now.getTime() + (i % 3 === 0 ? -2 : 2) * hour),
          createdAt: new Date(now.getTime() - 2 * hour),
        },
      });
      await db.travelMessage.create({
        data: {
          ticketId,
          conversationId: c.id,
          senderId: agentId,
          visibility: 'SUPPLIER',
          content:
            'Please confirm the current booking status and advise the next steps. The traveler is waiting for an update.',
          createdAt: new Date(now.getTime() - 2 * hour),
        },
      });
    }
  }
  await db.travelClock.upsert({
    where: { id: 'demo' },
    create: { id: 'demo', offsetMinutes: 0 },
    update: {},
  });
  console.log(
    'Seeded 3 agencies, 20 customers, 30 bookings, 60 cases, 4 agents, 1 manager and 5 suppliers. All records are synthetic.',
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
