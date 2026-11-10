import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import pg from "pg";
const env = dotenv.parse(
  readFileSync(new URL("../backend/.env", import.meta.url)),
);
assert.equal(env.OPSDESK_DEMO, "true");
assert.equal(new URL(env.DATABASE_URL).hostname, "127.0.0.1");
const base = process.env.OPSDESK_TEST_URL || "http://127.0.0.1:3001";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const id = "supplier-0",
  reason = "Supplier calendar test " + randomUUID();
const original = (
  await pool.query('SELECT * FROM "TravelSupplier" WHERE id=$1', [id])
).rows[0];
const clock = (
  await pool.query('SELECT "offsetMinutes" FROM "TravelClock" WHERE id=$1', [
    "demo",
  ])
).rows[0];
let ticketId,
  checks = 0;
async function call(method, path, body, token, expected) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${data.message ?? response.status}`,
  );
  checks++;
  return data;
}
async function login(name) {
  return (
    await call(
      "POST",
      "/auth/login",
      { email: name + "@opsdesk.demo", password: "OpsDeskDemo!2026" },
      null,
      200,
    )
  ).accessToken;
}
const rule = {
  timeZone: "UTC",
  week: [1, 2, 3, 4, 5].map((day) => ({ day, start: 540, end: 1020 })),
  holidays: ["2026-01-12"],
};
async function thread(id) {
  return (
    await pool.query(
      'SELECT "slaSnapshot","dueAt" FROM "TravelConversation" WHERE id=$1',
      [id],
    )
  ).rows[0];
}
try {
  const manager = await login("manager"),
    supplier = await login("supplier"),
    agent = await login("asia");
  const configure = (token, calendar, hours, expected) =>
    call(
      "PATCH",
      `/ops/suppliers/${id}/calendar`,
      { calendar, responseTargetHours: hours, reason },
      token,
      expected,
    );
  await configure(supplier, rule, 4, 403);
  await configure(agent, rule, 4, 403);
  await configure(manager, rule, 0, 400);
  await pool.query('UPDATE "TravelClock" SET "offsetMinutes"=$1 WHERE id=$2', [
    Math.round((Date.parse("2026-01-09T16:00:00Z") - Date.now()) / 60000),
    "demo",
  ]);
  const t = await call(
    "POST",
    "/ops/tickets",
    {
      agencyId: "atlas",
      customerId: "customer-0",
      bookingReference: "BK-1042",
      title: reason,
      description: "Synthetic supplier reply deadline check",
      category: "REFUND",
    },
    manager,
    201,
  );
  ticketId = t.id;
  await configure(manager, null, 4, 200);
  const create = () =>
    call(
      "POST",
      `/ops/tickets/${ticketId}/conversations`,
      { subject: reason, content: "Confirm booking." },
      manager,
      201,
    );
  const legacy = await create();
  assert.equal(
    Date.parse(legacy.dueAt) - Date.parse(legacy.createdAt),
    4 * 3600000,
  );
  const applied = await configure(manager, rule, 4, 200);
  assert.equal(
    (await configure(manager, rule, 4, 200)).responsePolicyVersion,
    applied.responsePolicyVersion,
  );
  const conversation = await create(),
    saved = await thread(conversation.id);
  assert.deepEqual(saved.slaSnapshot, {
    calendar: rule,
    hours: 4,
    version: applied.responsePolicyVersion,
  });
  assert(
    Math.abs(Date.parse(conversation.dueAt) - Date.parse("2026-01-13T12:00:00Z")) < 60000,
    "Skip weekend and Monday holiday",
  );
  const updated = await configure(manager, null, 2, 200);
  assert.deepEqual(await thread(conversation.id), saved);
  await call(
    "POST",
    `/ops/conversations/${conversation.id}/reply`,
    { content: "Supplier replied" },
    supplier,
    201,
  );
  assert.deepEqual(await thread(conversation.id), saved);
  await call(
    "POST",
    `/ops/conversations/${conversation.id}/reply`,
    { content: "Please confirm again" },
    manager,
    201,
  );
  const next = await thread(conversation.id);
  assert.equal(next.slaSnapshot.version, updated.responsePolicyVersion);
  assert.equal(next.slaSnapshot.hours, 2);
  const status = (value) =>
    call(
      "PATCH",
      `/ops/conversations/${conversation.id}`,
      { status: value },
      manager,
      200,
    );
  await status("CLOSED");
  await configure(manager, null, 3, 200);
  await status("AWAITING_REPLY");
  const reopened = await thread(conversation.id);
  assert.equal(reopened.slaSnapshot.hours, 3);
  await status("AWAITING_REPLY");
  assert.deepEqual(await thread(conversation.id), reopened);
  console.log(
    `PASS: ${checks} supplier calendar HTTP checks plus deadline, snapshot and idempotency assertions`,
  );
} finally {
  if (ticketId)
    await pool.query('DELETE FROM "TravelTicket" WHERE id=$1', [ticketId]);
  await pool.query(
    'UPDATE "TravelSupplier" SET "slaCalendar"=$1::jsonb,"responseTargetHours"=$2,"responsePolicyVersion"=$3 WHERE id=$4',
    [
      original.slaCalendar ? JSON.stringify(original.slaCalendar) : null,
      original.responseTargetHours,
      original.responsePolicyVersion,
      id,
    ],
  );
  await pool.query('UPDATE "TravelClock" SET "offsetMinutes"=$1 WHERE id=$2', [
    clock.offsetMinutes,
    "demo",
  ]);
  await pool.query('DELETE FROM "MembershipAudit" WHERE reason=$1', [reason]);
  await pool.end();
}

