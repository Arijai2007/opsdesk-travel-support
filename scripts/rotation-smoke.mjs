import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaService } from "../backend/dist/prisma/prisma.service.js";
import { TravelService } from "../backend/dist/src/travel/travel.service.js";
Object.assign(
  process.env,
  dotenv.parse(readFileSync(new URL("../backend/.env", import.meta.url))),
);
assert.equal(process.env.OPSDESK_DEMO, "true");
assert.equal(new URL(process.env.DATABASE_URL).hostname, "127.0.0.1");
const base = process.env.OPSDESK_TEST_URL || "http://127.0.0.1:3001";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaService(),
  peerDb = new PrismaService();
const service = new TravelService(db),
  peer = new TravelService(peerDb);
const reason = "Rotation test " + randomUUID(),
  prefix = randomUUID();
const a = prefix + "-a",
  b = prefix + "-b",
  ids = [];
let http = 0,
  checks = 0;
const check = (actual, expected) => {
  assert.deepEqual(actual, expected);
  checks++;
};
const originalRotations = await db.travelEscalationRotation.findMany();
const clock = await db.travelClock.findUniqueOrThrow({ where: { id: "demo" } });
const owners = await db.travelTicket.findMany({
  select: {
    id: true,
    escalationOwnerId: true,
    escalationManual: true,
    escalationOverrideUntil: true,
  },
});
const ownerEvents = await db.travelEvent.findMany({
  where: {
    kind: { in: ["ESCALATION_OWNER_CHANGED", "ESCALATION_OVERRIDE_ENDED"] },
  },
  select: { id: true },
});
async function call(method, path, body, token, expected = 200) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  assert.equal(
    r.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  http++;
  return data;
}
const login = async (email) =>
  (
    await call(
      "POST",
      "/auth/login",
      { email, password: "OpsDeskDemo!2026" },
      null,
    )
  ).accessToken;
const setTime = async (iso) =>
  db.travelClock.update({
    where: { id: "demo" },
    data: { offsetMinutes: Math.round((Date.parse(iso) - Date.now()) / 60000) },
  });
const saved = (id) => db.travelTicket.findUniqueOrThrow({ where: { id } });
const sweep = () => Promise.all([service.sweep(), peer.sweep()]);
const countEvents = (id, kind) =>
  db.travelEvent.count({ where: { ticketId: id, kind } });
const off = {
  timeZone: "UTC",
  week: [{ day: 0, start: 0, end: 1 }],
  holidays: [],
};
try {
  const manager = await login("manager@opsdesk.demo");
  const roles = [];
  for (const name of ["asia", "agency", "maya", "supplier"])
    roles.push(await login(name + "@opsdesk.demo"));
  const password = (
    await db.user.findUniqueOrThrow({
      where: { id: "manager" },
      select: { passwordHash: true },
    })
  ).passwordHash;
  for (const id of [a, b]) {
    await db.user.create({
      data: {
        id,
        email: id + "@example.invalid",
        passwordHash: password,
        firstName: "Rotation",
        lastName: id === a ? "Primary" : "Backup",
        role: "ADMIN",
      },
    });
    await db.travelProfile.create({
      data: { userId: id, kind: "MANAGER", available: true, region: "GLOBAL" },
    });
  }
  const tempToken = await login(b + "@example.invalid");
  await setTime("2026-11-10T00:30:00Z");
  const policy = {
    enabled: true,
    managerIds: [a, b],
    slotHours: 1,
    anchorAt: "2026-11-10T00:00:00Z",
    reason,
  };
  const configure = (region, body = policy, token = manager, status = 200) =>
    call("PATCH", "/ops/escalation-rotations/" + region, body, token, status);
  await call("GET", "/ops/escalation-rotations", null, null, 401);
  for (const token of roles) {
    await call("GET", "/ops/escalation-rotations", null, token, 403);
    await configure("GLOBAL", policy, token, 403);
  }
  await configure("UNKNOWN", policy, manager, 400);
  for (const body of [
    { ...policy, managerIds: [] },
    { ...policy, managerIds: [a, a] },
    { ...policy, managerIds: ["agent-asia"] },
    { ...policy, managerIds: ["missing"] },
    { ...policy, slotHours: 0 },
    { ...policy, slotHours: 169 },
    { ...policy, anchorAt: "2026-11-10T00:00:00" },
    { ...policy, anchorAt: "1969-01-01T00:00:00Z" },
    { ...policy, reason: "   " },
  ])
    await configure("GLOBAL", body, manager, 400);
  const global = await configure("GLOBAL");
  check(global.version, 1);
  const list = await call("GET", "/ops/escalation-rotations", null, manager);
  check(
    list.items.find((p) => p.region === "GLOBAL").members.map((m) => m.id),
    [a, b],
  );
  const identical = await Promise.all([
    configure("GLOBAL"),
    configure("GLOBAL"),
  ]);
  check(
    identical.map((p) => p.version),
    [1, 1],
  );
  check(
    await db.membershipAudit.count({
      where: { reason, action: "ESCALATION_ROTATION_CHANGED" },
    }),
    1,
  );
  const t = await call(
    "POST",
    "/ops/tickets",
    {
      agencyId: "atlas",
      customerId: "customer-0",
      category: "REFUND",
      title: reason,
      description: "Synthetic manager rotation test case",
    },
    manager,
    201,
  );
  ids.push(t.id);
  const overdue = new Date("2026-11-09T23:00:00Z");
  await db.travelTicket.update({
    where: { id: t.id },
    data: { responseDeadline: overdue, deadline: overdue },
  });
  await sweep();
  check((await saved(t.id)).escalationOwnerId, a);
  const firstEvents = await countEvents(t.id, "ESCALATION_OWNER_CHANGED");
  await sweep();
  check(await countEvents(t.id, "ESCALATION_OWNER_CHANGED"), firstEvents);
  check(await countEvents(t.id, "ESCALATED"), 1);
  await setTime("2026-11-10T01:30:00Z");
  await sweep();
  check((await saved(t.id)).escalationOwnerId, b);
  await db.travelProfile.update({
    where: { userId: b },
    data: { available: false },
  });
  await sweep();
  check((await saved(t.id)).escalationOwnerId, a);
  await db.travelProfile.update({
    where: { userId: b },
    data: { available: true },
  });
  await sweep();
  check((await saved(t.id)).escalationOwnerId, b);
  await configure("ASIA", { ...policy, managerIds: [a] });
  await sweep();
  check((await saved(t.id)).escalationOwnerId, a);
  await db.travelProfile.update({
    where: { userId: a },
    data: { available: false },
  });
  await sweep();
  check((await saved(t.id)).escalationOwnerId, null); // No fallback outside an enabled regional roster.
  await db.travelProfile.update({
    where: { userId: a },
    data: { available: true },
  });
  await sweep();
  check((await saved(t.id)).escalationOwnerId, a);
  await configure("ASIA", { ...policy, managerIds: [a], enabled: false });
  await sweep();
  check((await saved(t.id)).escalationOwnerId, b);
  const own = (ownerId, overrideUntil = null, token = manager, status = 200) =>
    call(
      "PATCH",
      `/ops/tickets/${t.id}/escalation-owner`,
      { ownerId, overrideUntil, reason },
      token,
      status,
    );
  for (const token of roles) await own(a, null, token, 403);
  await own(a);
  await sweep();
  check((await saved(t.id)).escalationManual, true);
  check((await saved(t.id)).escalationOwnerId, a);
  await setTime("2026-11-10T03:30:00Z");
  await sweep();
  check((await saved(t.id)).escalationOwnerId, a);
  await call(
    "PATCH",
    `/ops/members/${a}/shift`,
    { calendar: off, reason },
    manager,
  );
  await sweep();
  check((await saved(t.id)).escalationOwnerId, b);
  check((await saved(t.id)).escalationManual, false);
  check(await countEvents(t.id, "ESCALATION_OVERRIDE_ENDED"), 1);
  await own(a, null, manager, 400);
  await call(
    "PATCH",
    `/ops/members/${a}/shift`,
    { calendar: null, reason },
    manager,
  );
  const beforeHold = await countEvents(t.id, "ESCALATION_OWNER_CHANGED");
  await Promise.all([
    own(a, "2026-11-10T04:00:00Z"),
    own(a, "2026-11-10T04:00:00Z"),
  ]);
  check(await countEvents(t.id, "ESCALATION_OWNER_CHANGED"), beforeHold + 1);
  await sweep();
  check((await saved(t.id)).escalationOwnerId, a);
  check((await saved(t.id)).escalationManual, true);
  const privateFields = (item) => [
    item.escalationOwnerId,
    item.escalationManual,
    item.escalationOverrideUntil,
  ];
  check(
    privateFields(await call("GET", `/ops/tickets/${t.id}`, null, roles[2])),
    [null, false, null],
  );
  const scopedQueue = await call(
    "GET",
    `/ops/queue?search=${encodeURIComponent(reason)}`,
    null,
    roles[1],
  );
  check(privateFields(scopedQueue.items.find((item) => item.id === t.id)), [
    null,
    false,
    null,
  ]);
  const legacyWorkspace = await call("GET", "/ops/workspace", null, roles[2]);
  check(
    privateFields(legacyWorkspace.tickets.find((item) => item.id === t.id)),
    [null, false, null],
  );
  await setTime("2026-11-10T05:30:00Z");
  await sweep();
  check((await saved(t.id)).escalationOwnerId, b);
  check((await saved(t.id)).escalationManual, false);
  check((await saved(t.id)).escalationOverrideUntil, null);
  check(await countEvents(t.id, "ESCALATION_OVERRIDE_ENDED"), 2);
  await sweep();
  check(await countEvents(t.id, "ESCALATION_OVERRIDE_ENDED"), 2);
  await own(a, "2026-11-10T04:00:00Z", manager, 400);
  await own(a, "2027-01-01T00:00:00Z", manager, 400);
  await own(null, "2026-11-10T06:00:00Z", manager, 400);
  await own(a, "2026-11-10T06:00:00", manager, 400);
  await own(null);
  await sweep();
  check((await saved(t.id)).escalationOwnerId, b);
  await call(
    "PATCH",
    `/ops/admin/members/${b}/status`,
    { status: "SUSPENDED", reason },
    manager,
  );
  await call("GET", "/ops/escalation-rotations", null, tempToken, 401);
  await sweep();
  check((await saved(t.id)).escalationOwnerId, a);
  await configure("GLOBAL", policy, manager, 400);
  // Disabling a saved roster is permitted even after one member is suspended.
  await configure("GLOBAL", { ...policy, enabled: false });
  await call(
    "PATCH",
    `/ops/admin/members/${b}/status`,
    { status: "ACTIVE", reason },
    manager,
  );
  await call("GET", "/ops/escalation-rotations", null, tempToken, 401);
  await configure("GLOBAL");
  // A policy edit cannot be read before its row update commits.
  const holder = await pool.connect();
  let pending;
  try {
    await holder.query("BEGIN");
    await holder.query(
      'UPDATE "TravelEscalationRotation" SET "managerIds"=$1::text[],version=version+1 WHERE region=$2',
      [[b, a], "GLOBAL"],
    );
    pending = peer.sweep();
    const outcome = await Promise.race([
      pending.then(() => "early"),
      new Promise((r) => setTimeout(() => r("waiting"), 200)),
    ]);
    check(outcome, "waiting");
    await holder.query("COMMIT");
    await pending;
    check((await saved(t.id)).escalationOwnerId, a); // Slot 5 in [b,a].
  } finally {
    await holder.query("ROLLBACK");
    holder.release();
    if (pending) await pending;
  }
  // In-flight membership changes also gate a rotation choice.
  const membership = await pool.connect();
  let memberSweep;
  try {
    await membership.query("BEGIN");
    await membership.query(
      'UPDATE "TravelProfile" SET available=false WHERE "userId"=$1',
      [a],
    );
    memberSweep = peer.sweep();
    check(
      await Promise.race([
        memberSweep.then(() => "early"),
        new Promise((r) => setTimeout(() => r("waiting"), 200)),
      ]),
      "waiting",
    );
    await membership.query("COMMIT");
    await memberSweep;
    check((await saved(t.id)).escalationOwnerId, b);
  } finally {
    await membership.query("ROLLBACK");
    membership.release();
    if (memberSweep) await memberSweep;
  }
  await db.travelProfile.update({
    where: { userId: a },
    data: { available: true },
  });
  await sweep();
  // Paused response budgets do not suppress an outstanding escalation rotation.
  await db.travelTicket.update({
    where: { id: t.id },
    data: {
      slaPausedAt: new Date("2026-11-10T05:30:00Z"),
      slaRemainingMs: 600000,
    },
  });
  await setTime("2026-11-10T06:30:00Z");
  await sweep();
  check((await saved(t.id)).escalationOwnerId, b);
  const final = await saved(t.id);
  check(final.responseDeadline, overdue);
  check(final.deadline, overdue);
  check(final.slaSnapshot, t.slaSnapshot);
  check(final.slaRemainingMs, 600000);
  const customerView = await call(
    "GET",
    `/ops/tickets/${t.id}`,
    null,
    roles[2],
  );
  check(customerView.escalationOwnerId, null);
  check(customerView.escalationManual, false);
  check(customerView.escalationOverrideUntil, null);
  await own(a);
  await call(
    "PATCH",
    `/ops/tickets/${t.id}`,
    { status: "CLOSED", reason },
    manager,
  );
  await own(a, null, manager, 400);
  const closed = await saved(t.id);
  await setTime("2026-11-10T07:30:00Z");
  await sweep();
  check((await saved(t.id)).escalationOwnerId, closed.escalationOwnerId);
  await call("PATCH", `/ops/tickets/${t.id}`, { status: "OPEN" }, manager);
  check((await saved(t.id)).escalationManual, false);
  check((await saved(t.id)).escalationOverrideUntil, null);
  const beforeReconnect = await countEvents(t.id, "ESCALATION_OWNER_CHANGED");
  await db.$disconnect();
  await sweep();
  const afterReconnect = await countEvents(t.id, "ESCALATION_OWNER_CHANGED");
  await sweep();
  check(await countEvents(t.id, "ESCALATION_OWNER_CHANGED"), afterReconnect);
  assert(afterReconnect >= beforeReconnect);
  const quiet = await service.create("manager", {
    agencyId: "atlas",
    customerId: "customer-0",
    category: "REFUND",
    title: reason + " quiet",
    description: "A quiet active case still expires manual coverage holds.",
  });
  ids.push(quiet.id);
  await call(
    "PATCH",
    `/ops/tickets/${quiet.id}/escalation-owner`,
    { ownerId: a, overrideUntil: "2026-11-10T08:00:00Z", reason },
    manager,
  );
  await setTime("2026-11-10T08:30:00Z");
  await sweep();
  check((await saved(quiet.id)).escalationManual, false);
  check((await saved(quiet.id)).escalationOwnerId, a);
  check((await saved(quiet.id)).responseDeadline, quiet.responseDeadline);
  check(await countEvents(quiet.id, "ESCALATED"), 0);
  check(await countEvents(quiet.id, "ESCALATION_OVERRIDE_ENDED"), 1);
  console.log(
    `Escalation rotations: ${http} HTTP checks and ${checks} policy/concurrency/state assertions passed.`,
  );
} finally {
  await db.travelEscalationRotation.deleteMany();
  if (originalRotations.length)
    await db.travelEscalationRotation.createMany({ data: originalRotations });
  await db.travelTicket.deleteMany({ where: { id: { in: ids } } });
  for (const { id, ...data } of owners)
    await db.travelTicket.update({ where: { id }, data });
  await db.travelEvent.deleteMany({
    where: {
      ticketId: { in: owners.map((t) => t.id) },
      kind: { in: ["ESCALATION_OWNER_CHANGED", "ESCALATION_OVERRIDE_ENDED"] },
      id: { notIn: ownerEvents.map((e) => e.id) },
      actorId: "system",
    },
  });
  await db.membershipAudit.deleteMany({ where: { reason } });
  await db.travelProfile.deleteMany({ where: { userId: { in: [a, b] } } });
  await db.user.deleteMany({ where: { id: { in: [a, b] } } });
  await db.travelClock.update({
    where: { id: "demo" },
    data: { offsetMinutes: clock.offsetMinutes },
  });
  await Promise.all([db.$disconnect(), peerDb.$disconnect(), pool.end()]);
}
