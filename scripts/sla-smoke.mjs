import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaService } from "../backend/dist/prisma/prisma.service.js";
import { TravelMailService } from "../backend/dist/src/travel/travel-mail.service.js";
import { SyntheticTravelMailTransport } from "../backend/dist/src/travel/travel-mail.transport.js";
import { TravelService } from "../backend/dist/src/travel/travel.service.js";
import { addServiceTime } from "../backend/dist/src/travel/sla-calendar.js";
Object.assign(
  process.env,
  dotenv.parse(readFileSync(new URL("../backend/.env", import.meta.url))),
);
assert.equal(process.env.OPSDESK_DEMO, "true");
assert.equal(new URL(process.env.DATABASE_URL).hostname, "127.0.0.1");
const base = process.env.OPSDESK_TEST_URL || "http://127.0.0.1:3001";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaService(),
  peerDb = new PrismaService(),
  service = new TravelService(
    db,
    new TravelMailService(db, new SyntheticTravelMailTransport()),
  ),
  peer = new TravelService(
    peerDb,
    new TravelMailService(peerDb, new SyntheticTravelMailTransport()),
  );
const prefix = "sla-" + randomUUID().slice(0, 8),
  agency = prefix + "-agency",
  customer = prefix + "-customer",
  backup = prefix + "-manager";
const tickets = [];
let checks = 0,
  concurrency = 0;
const clock = await db.travelClock.findUnique({ where: { id: "demo" } });
const profiles = await db.travelProfile.findMany({
  where: { kind: { in: ["AGENT", "MANAGER"] } },
});
const calendar = {
  timeZone: "Europe/London",
  week: [1, 2, 3, 4, 5].map((day) => ({ day, start: 540, end: 1020 })),
  holidays: ["2026-01-12"],
};
const off = {
  timeZone: "UTC",
  week: [{ day: 0, start: 0, end: 1 }],
  holidays: [],
};
async function call(
  path,
  token,
  body,
  expected = 200,
  method = body ? "PATCH" : "GET",
) {
  if (body && typeof body.reason === "string" && body.reason.trim().length >= 3)
    body = { ...body, reason: prefix + " " + body.reason };
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await r.json();
  assert.equal(r.status, expected, `${path}: ${JSON.stringify(result)}`);
  checks++;
  return result;
}
const login = async (name) =>
  (
    await call(
      "/auth/login",
      null,
      { email: `${name}@opsdesk.demo`, password: "OpsDeskDemo!2026" },
      200,
      "POST",
    )
  ).accessToken;
async function setTime(iso) {
  await db.travelClock.update({
    where: { id: "demo" },
    data: { offsetMinutes: Math.round((Date.parse(iso) - Date.now()) / 60000) },
  });
}
async function create(manager, category = "REFUND", bookingReference) {
  const t = await call(
    "/ops/tickets",
    manager,
    {
      agencyId: agency,
      customerId: customer,
      title: prefix + " refund case",
      description: "Synthetic SLA calendar regression fixture.",
      category,
      ...(bookingReference ? { bookingReference } : {}),
    },
    201,
    "POST",
  );
  tickets.push(t.id);
  return t;
}
try {
  const manager = await login("manager"),
    agent = await login("asia"),
    europe = await login("europe"),
    maya = await login("maya"),
    supplier = await login("supplier"),
    other = await login("horizon");
  await db.travelAgency.create({
    data: {
      id: agency,
      name: "SLA fixture",
      code: prefix,
      responseTargetHours: 4,
    },
  });
  for (const [id, kind, role] of [
    [customer, "CUSTOMER", "CUSTOMER"],
    [backup, "MANAGER", "ADMIN"],
  ]) {
    await db.user.create({
      data: {
        id,
        email: id + "@example.invalid",
        passwordHash: "unused",
        firstName: "SLA",
        lastName: "Fixture",
        role,
      },
    });
    await db.travelProfile.create({
      data: {
        userId: id,
        kind,
        agencyId: kind === "CUSTOMER" ? agency : null,
        region: "ASIA",
        available: true,
      },
    });
  }
  await setTime("2026-01-09T16:00:00Z");
  const config = { calendar, reason: "Synthetic business policy" };
  for (const token of [agent, maya, supplier, other]) {
    await call(`/ops/agencies/${agency}/calendar`, token, config, 403);
    await call(
      "/ops/members/agent-asia/shift",
      token,
      { calendar: off, reason: "Coverage test" },
      403,
    );
  }
  await call(`/ops/agencies/${agency}/calendar`, null, config, 401);
  for (const invalid of [
    { ...calendar, timeZone: "Unknown/Zone" },
    { ...calendar, week: [] },
    { ...calendar, week: [{ day: 0, start: 0, end: 1 }] },
    { ...calendar, holidays: ["2026-02-30"] },
    { ...calendar, week: [{ day: 1, start: 1000, end: 900 }] },
  ])
    await call(
      `/ops/agencies/${agency}/calendar`,
      manager,
      { calendar: invalid, reason: "Invalid policy" },
      400,
    );
  await call(
    `/ops/agencies/${agency}/calendar`,
    manager,
    { reason: "Missing policy" },
    400,
  );
  await call(
    `/ops/agencies/${agency}/calendar`,
    manager,
    { calendar: null, reason: "  " },
    400,
  );
  const configured = await call(
    `/ops/agencies/${agency}/calendar`,
    manager,
    config,
  );
  const retry = await call(`/ops/agencies/${agency}/calendar`, manager, config);
  assert.equal(retry.responsePolicyVersion, configured.responsePolicyVersion);
  const t = await create(manager);
  assert.equal(
    t.responseDeadline,
    addServiceTime(
      new Date(t.responseStartedAt),
      4 * 3600000,
      calendar,
    ).toISOString(),
  );
  assert.equal(
    new Date(t.responseDeadline).getUTCDay(),
    2,
    "Monday holiday moves deadline to Tuesday",
  );
  assert.deepEqual(t.slaSnapshot.calendar, calendar);
  const paused = await call(`/ops/tickets/${t.id}/sla-pause`, manager, {
    paused: true,
    reason: "Waiting for customer approval",
  });
  assert(paused.slaPausedAt);
  assert(paused.deadline.startsWith("9999"));
  const deadline = paused.responseDeadline;
  await call(
    `/ops/tickets/${t.id}/sla-pause`,
    maya,
    { paused: false, reason: "Forbidden customer action" },
    403,
  );
  await call(
    `/ops/tickets/${t.id}/sla-pause`,
    other,
    { paused: false, reason: "Wrong agency action" },
    403,
  );
  await call(
    `/ops/tickets/${t.id}/sla-pause`,
    supplier,
    { paused: false, reason: "Wrong supplier action" },
    403,
  );
  await setTime("2026-01-13T15:00:00Z");
  await service.sweep();
  assert.equal(
    await db.travelEvent.count({
      where: { ticketId: t.id, kind: "ESCALATED" },
    }),
    0,
  );
  await call(`/ops/agencies/${agency}/calendar`, manager, {
    calendar: null,
    reason: "New cycles use elapsed time",
  });
  const still = await call(`/ops/tickets/${t.id}`, manager);
  assert.equal(still.responseDeadline, deadline);
  assert.deepEqual(still.slaSnapshot.calendar, calendar);
  const resumed = await call(`/ops/tickets/${t.id}/sla-pause`, manager, {
    paused: false,
    reason: "Customer provided approval",
  });
  assert.equal(
    resumed.responseDeadline,
    addServiceTime(
      new Date(resumed.updatedAt),
      paused.slaRemainingMs,
      calendar,
    ).toISOString(),
  );
  const data = { paused: true, reason: "Concurrent pause request" };
  await Promise.all([
    service.pauseSla("manager", t.id, data),
    peer.pauseSla("manager", t.id, data),
  ]);
  assert.equal(
    await db.travelEvent.count({
      where: { ticketId: t.id, kind: "SLA_PAUSED" },
    }),
    2,
  );
  concurrency++;
  await Promise.all([
    service.pauseSla("manager", t.id, { ...data, paused: false }),
    peer.pauseSla("manager", t.id, { ...data, paused: false }),
  ]);
  assert.equal(
    await db.travelEvent.count({
      where: { ticketId: t.id, kind: "SLA_RESUMED" },
    }),
    2,
  );
  concurrency++;
  await call(`/ops/tickets/${t.id}`, manager, {
    status: "CLOSED",
    reason: "Fixture closure",
  });
  await call(`/ops/tickets/${t.id}/sla-pause`, manager, data, 400);
  const reopened = await call(`/ops/tickets/${t.id}`, manager, {
    status: "OPEN",
    reason: "New response cycle",
  });
  assert.equal(reopened.slaSnapshot.calendar, null);
  assert.equal(reopened.slaPausedAt, null);
  assert.equal(
    Date.parse(reopened.responseDeadline) -
      Date.parse(reopened.responseStartedAt),
    4 * 3600000,
  );
  // All agents off-duty means unassigned. No existing assignment is moved.
  for (const p of profiles.filter((p) => p.kind === "AGENT"))
    await call(`/ops/members/${p.userId}/shift`, manager, {
      calendar: off,
      reason: "After hours test",
    });
  const unassigned = await create(manager);
  assert.equal(unassigned.agentId, null);
  await call(
    `/ops/tickets/${unassigned.id}`,
    manager,
    { agentId: "agent-asia", reason: "Off-duty override rejected" },
    400,
  );
  await call(
    `/ops/tickets/${unassigned.id}/sla-pause`,
    europe,
    { paused: true, reason: "Wrong regional team" },
    404,
  );
  await call(`/ops/tickets/${unassigned.id}/sla-pause`, agent, {
    paused: true,
    reason: "Regional team pause",
  });
  await call(`/ops/tickets/${unassigned.id}/sla-pause`, agent, {
    paused: false,
    reason: "Regional team resume",
  });
  // Real travel targets continue while the response clock is paused.
  const booking = await db.travelBooking.create({
    data: {
      id: prefix + "-booking",
      reference: prefix.toUpperCase(),
      agencyId: agency,
      customerId: customer,
      supplierId: "supplier-0",
      destination: "Synthetic",
      region: "ASIA",
      service: "Flight",
      timezone: "UTC",
      checkInAt: new Date("2026-01-14T17:00:00Z"),
    },
  });
  const travel = await create(manager, "CHECK_IN", booking.reference);
  await call(`/ops/tickets/${travel.id}/sla-pause`, manager, {
    paused: true,
    reason: "Pause response only",
  });
  await setTime("2026-01-14T18:00:00Z");
  await Promise.all([service.sweep(), peer.sweep()]);
  assert.equal(
    await db.travelEvent.count({
      where: {
        ticketId: travel.id,
        kind: "ESCALATED",
        text: "Travel deadline breached",
      },
    }),
    1,
  );
  concurrency++;
  await call(
    `/ops/tickets/${t.id}/sla-pause`,
    manager,
    { paused: true, reason: "Cannot hide a breached target" },
    400,
  );
  // Configured coverage controls manager ownership, including unowned fallback.
  await call(`/ops/tickets/${travel.id}/escalation-owner`, manager, {
    ownerId: backup,
    reason: "Manager handoff",
  });
  await call(
    `/ops/tickets/${travel.id}/escalation-owner`,
    agent,
    { ownerId: null, reason: "Agent cannot own escalation" },
    403,
  );
  await call(`/ops/members/${backup}/shift`, manager, {
    calendar: off,
    reason: "Coverage ended",
  });
  await service.sweep();
  assert.equal(
    (await db.travelTicket.findUnique({ where: { id: travel.id } }))
      .escalationOwnerId,
    "manager",
  );
  await call("/ops/members/manager/shift", manager, {
    calendar: off,
    reason: "No manager on duty",
  });
  await Promise.all([service.sweep(), peer.sweep()]);
  assert.equal(
    (await db.travelTicket.findUnique({ where: { id: travel.id } }))
      .escalationOwnerId,
    null,
  );
  concurrency++;
  await call(
    `/ops/tickets/${travel.id}/escalation-owner`,
    manager,
    { ownerId: backup, reason: "Off-duty manager rejected" },
    400,
  );
  await call("/ops/members/manager/shift", manager, {
    calendar: null,
    reason: "Coverage restored",
  });
  await service.sweep();
  assert.equal(
    (await db.travelTicket.findUnique({ where: { id: travel.id } }))
      .escalationOwnerId,
    "manager",
  );
  // Ownership must not race a member availability/status update. A separate
  // connection keeps the profile update uncommitted while a worker starts.
  await call("/ops/members/manager/shift", manager, {
    calendar: off,
    reason: "No manager on duty",
  });
  await call(`/ops/members/${backup}/shift`, manager, {
    calendar: null,
    reason: "Coverage restored",
  });
  await call(`/ops/tickets/${travel.id}/escalation-owner`, manager, {
    ownerId: backup,
    reason: "Manager handoff",
  });
  const holder = await pool.connect();
  let sweep;
  try {
    await holder.query("BEGIN");
    await holder.query(
      'UPDATE "TravelProfile" SET available=false WHERE "userId"=$1',
      [backup],
    );
    sweep = peer.sweep();
    const outcome = await Promise.race([
      sweep.then(() => "early"),
      new Promise((resolve) => setTimeout(() => resolve("waiting"), 200)),
    ]);
    assert.equal(
      outcome,
      "waiting",
      "Coverage selection waits for the in-flight profile update",
    );
    await holder.query("COMMIT");
    await sweep;
    assert.equal(
      (await db.travelTicket.findUnique({ where: { id: travel.id } }))
        .escalationOwnerId,
      null,
    );
    concurrency++;
  } finally {
    await holder.query("ROLLBACK");
    holder.release();
    if (sweep) await sweep;
  }
  const before = await db.travelEvent.count({
    where: { ticketId: travel.id, kind: "ESCALATED" },
  });
  await db.$disconnect();
  await service.sweep();
  assert.equal(
    await db.travelEvent.count({
      where: { ticketId: travel.id, kind: "ESCALATED" },
    }),
    before,
  );
  concurrency++;
  console.log(
    `PASS: ${checks} SLA HTTP checks and ${concurrency} concurrency/reconnect checks; calendars, scopes, snapshot, pause, shifts, travel urgency and ownership.`,
  );
} finally {
  await db.travelTicket.deleteMany({ where: { id: { in: tickets } } });
  await db.travelBooking.deleteMany({ where: { id: prefix + "-booking" } });
  for (const p of profiles)
    await pool.query(
      'UPDATE "TravelProfile" SET "shiftCalendar"=$1::jsonb WHERE "userId"=$2',
      [p.shiftCalendar ? JSON.stringify(p.shiftCalendar) : null, p.userId],
    );
  if (clock)
    await db.travelClock.update({
      where: { id: "demo" },
      data: { offsetMinutes: clock.offsetMinutes },
    });
  await db.membershipAudit.deleteMany({
    where: {
      OR: [
        {
          entityId: { in: [agency, backup, ...profiles.map((p) => p.userId)] },
          action: { in: ["SLA_CALENDAR_CHANGED", "SHIFT_CALENDAR_CHANGED"] },
          reason: { startsWith: prefix + " " },
        },
      ],
    },
  });
  await db.travelProfile.deleteMany({
    where: { userId: { in: [customer, backup] } },
  });
  await db.user.deleteMany({ where: { id: { in: [customer, backup] } } });
  await db.travelAgency.delete({ where: { id: agency } });
  await db.$disconnect();
  await peerDb.$disconnect();
  await pool.end();
}
