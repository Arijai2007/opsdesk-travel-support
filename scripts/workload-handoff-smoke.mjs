import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import { Prisma } from "../backend/dist/generated/prisma/client.js";
import { PrismaService } from "../backend/dist/prisma/prisma.service.js";
import { TravelMailService } from "../backend/dist/src/travel/travel-mail.service.js";
import { SyntheticTravelMailTransport } from "../backend/dist/src/travel/travel-mail.transport.js";
import { TravelService } from "../backend/dist/src/travel/travel.service.js";
Object.assign(
  process.env,
  dotenv.parse(readFileSync(new URL("../backend/.env", import.meta.url))),
);
assert.equal(process.env.OPSDESK_DEMO, "true");
assert.equal(new URL(process.env.DATABASE_URL).hostname, "127.0.0.1");
const db = new PrismaService(),
  peerDb = new PrismaService();
const service = new TravelService(
    db,
    new TravelMailService(db, new SyntheticTravelMailTransport()),
  ),
  peer = new TravelService(
    peerDb,
    new TravelMailService(peerDb, new SyntheticTravelMailTransport()),
  );
const ids = [];
const agents = await db.travelProfile.findMany({ where: { kind: "AGENT" } });
let checks = 0;
const check = (actual, expected) => {
  assert.deepEqual(actual, expected);
  checks++;
};
const base = process.env.OPSDESK_TEST_URL || "http://127.0.0.1:3001";
const request = async (path, body, token, expected = 200) => {
  const response = await fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, expected);
  checks++;
  return response.json();
};
const policy = async (id, token, enabled, expected = 200) => {
  const response = await fetch(base + `/ops/tickets/${id}/handoff-policy`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ enabled, reason: "Synthetic workload policy" }),
  });
  assert.equal(response.status, expected);
  checks++;
  return response.json();
};
const saved = async (id) =>
  db.travelTicket.findUniqueOrThrow({ where: { id } });
const create = async () => {
  const t = await service.create("manager", {
    agencyId: "atlas",
    customerId: "customer-0",
    bookingReference: "BK-1042",
    title: "Workload test " + randomUUID(),
    description: "Synthetic workload handoff case",
    category: "REFUND",
  });
  ids.push(t.id);
  return t;
};
try {
  await db.travelProfile.updateMany({
    where: { kind: "AGENT" },
    data: {
      available: true,
      shiftCalendar: Prisma.DbNull,
      specialties: [],
      maxActiveCases: null,
    },
  });
  const t = await create();
  check(t.autoHandoff, false);
  const tokens = {};
  for (const role of ["manager", "asia", "agency", "maya", "supplier"]) {
    tokens[role] = (
      await request("/auth/login", {
        email: `${role}@opsdesk.demo`,
        password: "OpsDeskDemo!2026",
      })
    ).accessToken;
  }
  await policy(t.id, null, true, 401);
  for (const role of ["asia", "agency", "maya", "supplier"])
    await policy(t.id, tokens[role], true, 403);
  await policy(t.id, tokens.manager, true);
  await policy(t.id, tokens.manager, false);
  await db.travelEvent.deleteMany({
    where: { ticketId: t.id, kind: "HANDOFF_POLICY_CHANGED" },
  });
  await db.travelProfile.update({
    where: { userId: t.agentId },
    data: { available: false },
  });
  await service.sweep();
  check((await saved(t.id)).agentId, t.agentId);
  await assert.rejects(
    service.handoffPolicy("customer-0", t.id, {
      enabled: true,
      reason: "Denied customer",
    }),
  );
  checks++;
  await service.handoffPolicy("manager", t.id, {
    enabled: true,
    reason: "Test opted coverage",
  });
  await service.handoffPolicy("manager", t.id, {
    enabled: true,
    reason: "Test idempotency",
  });
  check(
    await db.travelEvent.count({
      where: { ticketId: t.id, kind: "HANDOFF_POLICY_CHANGED" },
    }),
    1,
  );
  await Promise.all([service.sweep(), peer.sweep()]);
  const next = await saved(t.id);
  assert(next.agentId && next.agentId !== t.agentId);
  checks++;
  check(
    await db.travelEvent.count({
      where: { ticketId: t.id, kind: "ASSIGNED", actorId: "system" },
    }),
    1,
  );
  await service.update("manager", t.id, { agentId: next.agentId });
  check((await saved(t.id)).autoHandoff, false);
  await service.handoffPolicy("manager", t.id, {
    enabled: true,
    reason: "Retry when no coverage",
  });
  await db.travelProfile.updateMany({
    where: { kind: "AGENT" },
    data: { available: false },
  });
  await service.sweep();
  check((await saved(t.id)).agentId, null);
  const events = await db.travelEvent.count({
    where: { ticketId: t.id, kind: "ASSIGNED" },
  });
  await service.sweep();
  check(
    await db.travelEvent.count({ where: { ticketId: t.id, kind: "ASSIGNED" } }),
    events,
  );
  await db.travelProfile.update({
    where: { userId: "agent-global" },
    data: { available: true },
  });
  await peer.sweep();
  check((await saved(t.id)).agentId, "agent-global");
  await service.pauseSla("manager", t.id, {
    paused: true,
    reason: "Paused while awaiting customer",
  });
  const paused = await saved(t.id);
  await db.travelTicket.update({
    where: { id: t.id },
    data: { status: "WAITING_CUSTOMER" },
  });
  await db.travelProfile.update({
    where: { userId: "agent-global" },
    data: { available: false },
  });
  await service.sweep();
  const after = await saved(t.id);
  check(after.slaPausedAt, paused.slaPausedAt);
  check(after.deadline, paused.deadline);
  check(after.agentId, null);
  await db.travelProfile.update({
    where: { userId: "agent-global" },
    data: {
      available: true,
      shiftCalendar: {
        timeZone: "UTC",
        week: [{ day: 0, start: 0, end: 1 }],
        holidays: [],
      },
    },
  });
  await service.sweep();
  check((await saved(t.id)).agentId, null);
  await db.travelProfile.update({
    where: { userId: "agent-global" },
    data: { shiftCalendar: Prisma.DbNull, status: "SUSPENDED" },
  });
  await service.sweep();
  check((await saved(t.id)).agentId, null);
  await db.travelProfile.update({
    where: { userId: "agent-global" },
    data: { status: "ACTIVE", specialties: ["CHECK_IN"] },
  });
  await service.sweep();
  check((await saved(t.id)).agentId, null);
  await db.travelProfile.update({
    where: { userId: "agent-global" },
    data: { specialties: [] },
  });
  await service.update("manager", t.id, {
    status: "CLOSED",
    reason: "Test closed exclusion",
  });
  await db.travelProfile.update({
    where: { userId: "agent-global" },
    data: { available: true },
  });
  await service.sweep();
  check((await saved(t.id)).agentId, null);
  const pendingCase = await create();
  await db.travelProfile.updateMany({
    where: { kind: "AGENT" },
    data: { available: false },
  });
  await service.handoffPolicy("manager", pendingCase.id, {
    enabled: true,
    reason: "Capacity race test",
  });
  await db.travelTicket.update({
    where: { id: pendingCase.id },
    data: { agentId: null },
  });
  const load = await db.travelTicket.count({
    where: {
      agentId: "agent-global",
      status: { notIn: ["CLOSED", "RESOLVED"] },
    },
  });
  await db.travelProfile.update({
    where: { userId: "agent-global" },
    data: { available: true, maxActiveCases: load + 1 },
  });
  await Promise.all([service.sweep(), peer.sweep(), create()]);
  check(
    await db.travelTicket.count({
      where: {
        agentId: "agent-global",
        status: { notIn: ["CLOSED", "RESOLVED"] },
      },
    }),
    load + 1,
  );
  const before = await db.travelEvent.count({
    where: { ticketId: pendingCase.id, kind: "ASSIGNED" },
  });
  const reconnect = new PrismaService();
  try {
    await new TravelService(
      reconnect,
      new TravelMailService(reconnect, new SyntheticTravelMailTransport()),
    ).sweep();
  } finally {
    await reconnect.$disconnect();
  }
  check(
    await db.travelEvent.count({
      where: { ticketId: pendingCase.id, kind: "ASSIGNED" },
    }),
    before,
  );
  await Promise.all([
    service.update("manager", pendingCase.id, { agentId: "agent-global" }),
    peer.sweep(),
  ]);
  check((await saved(pendingCase.id)).autoHandoff, false);
  check((await saved(pendingCase.id)).agentId, "agent-global");
  console.log(`PASS: ${checks} workload policy, multi-worker and pause checks`);
} finally {
  await db.travelTicket.deleteMany({ where: { id: { in: ids } } });
  for (const a of agents)
    await db.travelProfile.update({
      where: { userId: a.userId },
      data: {
        available: a.available,
        status: a.status,
        shiftCalendar: a.shiftCalendar ?? Prisma.DbNull,
        specialties: a.specialties,
        maxActiveCases: a.maxActiveCases,
      },
    });
  await Promise.all([db.$disconnect(), peerDb.$disconnect()]);
}
