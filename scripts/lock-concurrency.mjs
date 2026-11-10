import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { effectiveDeadline } from "../backend/dist/src/travel/travel.rules.js";
import { performance } from "node:perf_hooks";
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
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaService(),
  otherDb = new PrismaService();
const service = new TravelService(db),
  other = new TravelService(otherDb);
const originalAvailability = await db.travelProfile.findUniqueOrThrow({
  where: { userId: "agent-asia" },
  select: { available: true },
});
const holder = await pool.connect();
const ids = [];
let checks = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = async (p) => {
  let timer;
  try {
    return await Promise.race([
      p,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Concurrent operation timed out")),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
async function create(bookingReference = "BK-1042", category = "REFUND") {
  const t = await service.create("manager", {
    agencyId: "atlas",
    customerId: "customer-0",
    bookingReference,
    title: "Concurrency refund investigation",
    description: "Synthetic isolated lock contention test case.",
    category,
  });
  ids.push(t.id);
  return t;
}
async function note(s, id) {
  return s.message("manager", id, {
    content: "Synthetic concurrency note",
    visibility: "INTERNAL",
  });
}
try {
  const a = await create(),
    b = await create();
  await holder.query("BEGIN");
  await holder.query("SELECT pg_advisory_xact_lock(804204)");
  const baselineStart = performance.now();
  const baseline = pool.query("SELECT pg_advisory_xact_lock(804204)");
  await sleep(150);
  await holder.query("COMMIT");
  await baseline;
  const baselineMs = performance.now() - baselineStart;
  await holder.query("BEGIN");
  await holder.query("SELECT pg_advisory_xact_lock(804204)");
  const start = performance.now();
  await deadline(note(service, b.id));
  const independentMs = performance.now() - start;
  await holder.query("ROLLBACK");
  checks++;
  await holder.query("BEGIN");
  await holder.query('SELECT id FROM "TravelTicket" WHERE id=$1 FOR UPDATE', [
    a.id,
  ]);
  let sameDone = false;
  const same = note(service, a.id).then(() => {
    sameDone = true;
  });
  await deadline(note(other, b.id));
  await sleep(80);
  assert.equal(sameDone, false);
  await holder.query("COMMIT");
  await deadline(same);
  checks += 2;
  const conversation = await service.conversation("manager", a.id, {
    subject: "Synthetic supplier race",
    content: "Please confirm synthetic refund status.",
  });
  const race = await deadline(
    Promise.allSettled([
      service.update("manager", a.id, {
        status: "CLOSED",
        reason: "Synthetic closure",
      }),
      other.reply("supplier-user", conversation.id, {
        content: "Synthetic supplier answer",
      }),
    ]),
  );
  assert.equal(race[0].status, "fulfilled");
  if (race[1].status === "rejected")
    assert.equal(race[1].reason.getStatus(), 400);
  assert.equal(
    (await db.travelTicket.findUniqueOrThrow({ where: { id: a.id } })).status,
    "CLOSED",
  );
  checks++;
  await service.update("manager", a.id, { status: "OPEN" });
  await db.travelTicket.update({
    where: { id: a.id },
    data: {
      deadline: new Date(Date.now() - 3600000),
      responseDeadline: new Date(Date.now() - 3600000),
      priority: "LOW",
    },
  });
  const batch = Array.from({ length: 104 }, () => ({
    ...a,
    id: randomUUID(),
    reference: `LOCK-${randomUUID()}`,
    priority: "LOW",
    deadline: new Date(Date.now() - 3600000),
    responseDeadline: new Date(Date.now() - 3600000),
  }));
  ids.push(...batch.map((t) => t.id));
  await db.travelTicket.createMany({ data: batch });
  await deadline(Promise.all([service.sweep(), other.sweep()]));
  assert.equal(
    await db.travelTicket.count({
      where: { id: { in: batch.map((t) => t.id) }, priority: "URGENT" },
    }),
    104,
  );
  checks++;
  const batchAlerts = await db.travelEvent.groupBy({
    by: ["ticketId"],
    where: { ticketId: { in: batch.map((t) => t.id) }, kind: "ESCALATED" },
    _count: { _all: true },
  });
  assert.equal(batchAlerts.length, 104);
  assert(batchAlerts.every((e) => e._count._all === 1));
  checks++;

  const first = await db.travelEvent.count({
    where: { ticketId: a.id, kind: "ESCALATED" },
  });
  assert.equal(first, 1);
  checks++;
  await otherDb.$disconnect();
  const restartedDb = new PrismaService();
  try {
    await new TravelService(restartedDb).sweep();
  } finally {
    await restartedDb.$disconnect();
  }
  assert.equal(
    await db.travelEvent.count({
      where: { ticketId: a.id, kind: "ESCALATED" },
    }),
    first,
  );
  checks++;
  await holder.query("BEGIN");
  await holder.query("SELECT pg_advisory_xact_lock(804204)");
  let availabilityDone = false;
  const availability = service.availability("agent-asia", true).then(() => {
    availabilityDone = true;
  });
  await sleep(80);
  assert.equal(availabilityDone, false);
  await holder.query("COMMIT");
  await deadline(availability);
  checks++;
  const original = await db.travelBooking.findUniqueOrThrow({
    where: { id: "booking-0" },
  });
  const clone = await db.travelBooking.create({
    data: {
      ...original,
      id: randomUUID(),
      reference: `LOCK-${randomUUID()}`.toUpperCase(),
    },
  });
  try {
    const c = await create(clone.reference, "CHECK_IN");
    const thread = await service.conversation("manager", c.id, {
      subject: "Schedule and reply race",
      content: "Synthetic booking verification.",
    });
    await deadline(
      Promise.all([
        service.updateSchedule("manager", clone.id, {
          checkInAt: new Date(Date.now() + 3 * 3600000).toISOString(),
          departureAt: null,
          cancellationCutoffAt: null,
        }),
        other.reply("supplier-user", thread.id, {
          content: "Synthetic supplier reply.",
        }),
        service.update("manager", c.id, { agentId: "agent-global" }),
      ]),
    );
    const saved = await db.travelTicket.findUniqueOrThrow({
      where: { id: c.id },
      include: { booking: true },
    });
    assert.equal(
      +saved.deadline,
      +effectiveDeadline(
        saved.category,
        saved.responseDeadline,
        saved.booking,
        saved.responseStartedAt,
      ),
    );
    checks++;
    assert.equal(saved.agentId, "agent-global");
    checks++;
    await deadline(
      Promise.all([
        service.update("manager", c.id, {
          status: "CLOSED",
          reason: "Concurrent close",
        }),
        other.sweep(),
      ]),
    );
    assert.equal(
      (await db.travelTicket.findUniqueOrThrow({ where: { id: c.id } })).status,
      "CLOSED",
    );
    checks++;
    await service.update("manager", c.id, { status: "OPEN" });
    const clock = await db.travelClock.findUnique({ where: { id: "demo" } });
    try {
      await deadline(
        Promise.all([service.advance("manager", 1), other.sweep()]),
      );
      checks++;
    } finally {
      await db.travelClock.update({
        where: { id: "demo" },
        data: { offsetMinutes: clock.offsetMinutes },
      });
    }
  } finally {
    await db.travelTicket.deleteMany({ where: { bookingId: clone.id } });
    await db.travelBooking.delete({ where: { id: clone.id } });
  }
  console.log(
    JSON.stringify({
      checks,
      baselineSharedLockWaitMs: Math.round(baselineMs),
      independentMessageUnderHeldRoutingLockMs: Math.round(independentMs),
      note: "Controlled 150ms blocker; synthetic evidence, not production throughput.",
    }),
  );
} finally {
  await holder.query("ROLLBACK");
  holder.release();
  for (const id of ids) await db.travelTicket.deleteMany({ where: { id } });
  await db.travelProfile.update({
    where: { userId: "agent-asia" },
    data: { available: originalAvailability.available },
  });
  await Promise.all([db.$disconnect(), otherDb.$disconnect(), pool.end()]);
}
