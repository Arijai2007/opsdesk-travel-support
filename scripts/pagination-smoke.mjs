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
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const base = process.env.OPSDESK_TEST_URL || "http://127.0.0.1:3001";
const prefix = `pagination-${randomUUID()}`;
let checks = 0;
async function call(path, token, expected = 200, body) {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(result)}`);
  checks++;
  return result;
}
const login = async (account) =>
  (
    await call("/auth/login", null, 200, {
      email: `${account}@opsdesk.demo`,
      password: "OpsDeskDemo!2026",
    })
  ).accessToken;
async function allPages(path, token, expected) {
  const first = await call(path, token);
  const ids = [];
  for (let page = 1; page <= first.totalPages; page++) {
    const result =
      page === 1 ? first : await call(`${path}?page=${page}`, token);
    assert(result.items.length <= 20);
    assert.equal(result.total, expected);
    ids.push(...result.items.map((item) => item.id));
  }
  assert.equal(ids.length, expected);
  assert.equal(
    new Set(ids).size,
    expected,
    "No overlap at identical timestamps",
  );
  const last = await call(`${path}?page=10000`, token);
  assert.equal(last.page, last.totalPages);
  for (const invalid of ["0", "-1", "1.5", "abc", "10001"])
    await call(`${path}?page=${invalid}`, token, 400);
  return first;
}
try {
  const manager = await login("manager"),
    customer = await login("maya"),
    agency = await login("agency"),
    other = await login("horizon"),
    agent = await login("asia"),
    europe = await login("europe"),
    supplier = await login("supplier"),
    wrongSupplier = await login("skyline");
  const workspace = await call("/ops/workspace", manager);
  const source = workspace.tickets.find((t) => t.reference === "OPS-1042");
  const booking = workspace.bookings.find((b) => b.id === source.bookingId);
  const supplierProfile = (
    await pool.query(
      'SELECT "userId" FROM "TravelProfile" WHERE "supplierId" = $1 LIMIT 1',
      [booking.supplierId],
    )
  ).rows[0];
  assert(supplierProfile);
  const date = new Date("2026-01-01T00:00:00Z");
  // Identical timestamps force pagination to use its ID tie breaker.
  for (let i = 0; i < 45; i++) {
    await pool.query(
      `INSERT INTO "TravelTicket" (id, reference, title, description, "agencyId", "customerId", "bookingId", category, status, priority, region, deadline, "createdAt", "updatedAt") VALUES ($1,$1,'Pagination case','Isolated pagination fixture',$2,$3,$4,'REFUND','RESOLVED','LOW',$5,$6,$6,$6)`,
      [
        `${prefix}-${i}`,
        source.agencyId,
        source.customerId,
        source.bookingId,
        source.region,
        date,
      ],
    );
  }
  const ticketId = `${prefix}-0`;
  for (let i = 0; i < 45; i++) {
    const conversationId = `${prefix}-thread-${i}`;
    await pool.query(
      `INSERT INTO "TravelConversation" (id,"ticketId","supplierId",subject,status,"dueAt","createdAt") VALUES ($1,$2,$3,'Pagination supplier thread','CLOSED',$4,$4)`,
      [conversationId, ticketId, booking.supplierId, date],
    );
    for (const visibility of ["CUSTOMER", "INTERNAL", "SUPPLIER"]) {
      await pool.query(
        `INSERT INTO "TravelMessage" (id,"ticketId","conversationId","senderId",visibility,content,"createdAt") VALUES ($1,$2,$3,$4,$5,$5,$6)`,
        [
          `${prefix}-${visibility}-${i}`,
          ticketId,
          visibility === "SUPPLIER" ? `${prefix}-thread-0` : null,
          visibility === "SUPPLIER" ? supplierProfile.userId : "manager-demo",
          visibility,
          date,
        ],
      );
    }
    await pool.query(
      `INSERT INTO "TravelEvent" (id,"ticketId",kind,text,"actorId","createdAt") VALUES ($1,$2,'STATUS_CHANGED','Status changed: private reason','manager-demo',$3)`,
      [`${prefix}-event-${i}`, ticketId, date],
    );
  }
  const compact = await call("/ops/workspace?compact=1", manager);
  assert.deepEqual(compact.tickets, []);
  assert.deepEqual(compact.conversations, []);
  assert.equal(compact.counts.total, workspace.tickets.length + 45);
  const queue = await call("/ops/queue?tab=all", manager);
  assert.equal(queue.items.length, queue.ids.length);
  assert(
    queue.items.every(
      (t) => !("description" in t) && !("messages" in t) && !("events" in t),
    ),
  );
  for (const token of [manager, customer, agency, agent]) {
    const detail = await call(`/ops/tickets/${ticketId}`, token);
    assert.equal(detail.description, "Isolated pagination fixture");
    assert.deepEqual(detail.messages, []);
    assert.deepEqual(detail.events, []);
  }
  const staffMessages = await allPages(
    `/ops/tickets/${ticketId}/messages`,
    manager,
    90,
  );
  assert(staffMessages.items.every((m) => m.visibility !== "SUPPLIER"));
  assert(staffMessages.items.every((m) => typeof m.senderName === "string"));
  const customerMessages = await allPages(
    `/ops/tickets/${ticketId}/messages`,
    customer,
    45,
  );
  assert(customerMessages.items.every((m) => m.visibility === "CUSTOMER"));
  await allPages(`/ops/tickets/${ticketId}/conversations`, manager, 45);
  const threadMessages = await allPages(
    `/ops/conversations/${prefix}-thread-0/messages`,
    supplier,
    45,
  );
  assert(threadMessages.items.every((m) => m.visibility === "SUPPLIER"));
  await allPages(`/ops/tickets/${ticketId}/events`, manager, 45);
  const publicEvents = await allPages(
    `/ops/tickets/${ticketId}/events`,
    customer,
    45,
  );
  assert(publicEvents.items.every((e) => !e.text.includes("private reason")));
  const related = workspace.tickets.filter(
    (t) => t.bookingId === source.bookingId,
  ).length;
  await allPages(`/ops/tickets/${ticketId}/related`, customer, related + 44);
  await allPages(
    `/ops/bookings/${source.bookingId}/tickets`,
    customer,
    related + 45,
  );
  for (const suffix of ["", "/messages", "/events", "/related"]) {
    for (const token of [other, europe, supplier])
      await call(`/ops/tickets/${ticketId}${suffix}`, token, 404);
    await call(`/ops/tickets/${ticketId}${suffix}`, null, 401);
    await call(`/ops/tickets/missing${suffix}`, manager, 404);
  }
  for (const token of [customer, agency, supplier])
    await call(`/ops/tickets/${ticketId}/conversations`, token, 403);
  await call(`/ops/tickets/${ticketId}/conversations`, europe, 404);
  for (const token of [wrongSupplier, europe])
    await call(`/ops/conversations/${prefix}-thread-0/messages`, token, 404);
  for (const token of [customer, agency])
    await call(`/ops/conversations/${prefix}-thread-0/messages`, token, 403);
  for (const token of [other, europe, supplier])
    await call(`/ops/bookings/${source.bookingId}/tickets`, token, 404);
  const supplierThreads = await call("/ops/conversations", supplier);
  assert(
    supplierThreads.items.every(
      (c) => c.supplierId === booking.supplierId && c.messages.length === 0,
    ),
  );
  await call("/ops/conversations?page=0", supplier, 400);
  await call("/ops/conversations", customer, 403);
  await call("/ops/conversations", manager, 403);
  console.log(
    `PASS: ${checks} pagination HTTP checks; bounded case reads, tied timestamps, privacy and all access roles.`,
  );
} finally {
  await pool.query('DELETE FROM "TravelTicket" WHERE id LIKE $1', [
    `${prefix}%`,
  ]);
  await pool.end();
}
