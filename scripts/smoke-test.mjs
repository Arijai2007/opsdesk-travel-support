import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import pg from "pg";
const base = process.env.OPSDESK_TEST_URL || "http://127.0.0.1:3001";
const env = dotenv.parse(
  readFileSync(new URL("../backend/.env", import.meta.url)),
);
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const created = [];
const notes = [];
let checks = 0;
let previousClock;
let temporaryBookingId;
let previousAgencyPolicy;
let previousCapacities;
async function call(path, token, body, method = "POST", expected = 200) {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await r.json();
  assert.equal(
    r.status,
    expected,
    `${method} ${path}: ${data.message || data.error || "unexpected status"}`,
  );
  checks++;
  return data;
}
async function login(id) {
  return (
    await call(
      "/auth/login",
      null,
      { email: `${id}@opsdesk.demo`, password: "OpsDeskDemo!2026" },
      "POST",
      200,
    )
  ).accessToken;
}
try {
  await call("/ops/workspace", null, undefined, "GET", 401);
  const manager = await login("manager"),
    customer = await login("maya"),
    agency = await login("agency"),
    other = await login("horizon"),
    agent = await login("asia"),
    supplier = await login("supplier"),
    wrongSupplier = await login("skyline");
  const initial = await call("/ops/workspace", manager);
  assert(initial.tickets.length >= 60);
  assert.equal(initial.bookings.length, 30);
  assert.equal(initial.me.kind, "MANAGER");
  const asiaSpecialties = initial.people.find(
    (p) => p.id === "agent-asia",
  ).specialties;
  await call(
    "/ops/agents/agent-asia/specialties",
    agent,
    { specialties: ["REFUND"] },
    "PATCH",
    403,
  );
  await call(
    "/ops/agents/agent-asia/specialties",
    manager,
    { specialties: "REFUND" },
    "PATCH",
    400,
  );
  await call(
    "/ops/agents/agent-asia/specialties",
    manager,
    { specialties: asiaSpecialties },
    "PATCH",
  );
  const customerData = await call("/ops/workspace", customer);
  assert(customerData.tickets.every((t) => t.customerId === "customer-0"));
  assert(
    customerData.tickets
      .flatMap((t) => t.messages)
      .every((m) => m.visibility === "CUSTOMER"),
  );
  assert.equal(customerData.conversations.length, 0);
  const agencyData = await call("/ops/workspace", agency),
    otherData = await call("/ops/workspace", other);
  assert(agencyData.tickets.every((t) => t.agencyId === "atlas"));
  assert(otherData.tickets.every((t) => t.agencyId === "horizon"));
  const agentData = await call("/ops/workspace", agent);
  assert(agentData.tickets.every((t) => t.region === "ASIA"));
  await call("/tickets/queue", agent, undefined, "GET", 403);
  await call("/tickets/queue", manager, undefined, "GET", 403);
  await call(
    "/users/me",
    customer,
    { currentPassword: "OpsDeskDemo!2026" },
    "DELETE",
    403,
  );
  await call(
    "/ops/tickets",
    other,
    {
      title: "Cross agency probe",
      description: "Cannot access someone else's booking.",
      bookingReference: "BK-1042",
      customerId: "customer-0",
      agencyId: "atlas",
    },
    "POST",
    400,
  );
  const foreignReference = await call(
    "/ops/tickets",
    other,
    {
      title: "Booking reference outside this agency",
      description:
        "Save the complaint without linking the other agency’s booking.",
      bookingReference: "BK-1042",
      customerId: "customer-1",
    },
    "POST",
    201,
  );
  created.push(foreignReference.id);
  assert.equal(foreignReference.bookingId, null);
  assert.equal(foreignReference.agencyId, "horizon");
  const unmatched = await call(
    "/ops/tickets",
    customer,
    {
      title: "Unknown booking reference",
      description: "Please verify the booking reference.",
      bookingReference: "NO-SUCH-BOOKING",
    },
    "POST",
    201,
  );
  created.push(unmatched.id);
  assert.equal(unmatched.bookingId, null);
  await call(
    "/ops/tickets",
    customer,
    {
      title: "Forbidden field probe",
      description: "Validation should reject privilege fields.",
      role: "MANAGER",
    },
    "POST",
    400,
  );
  const ticket = await call(
    "/ops/tickets",
    customer,
    {
      title: "Smoke test recurring refund",
      description:
        "Our refund for booking BK-1042 is still pending after previous contacts.",
      bookingReference: "BK-1042",
    },
    "POST",
    201,
  );
  created.push(ticket.id);
  assert.equal(ticket.bookingId, "booking-0");
  assert.equal(ticket.category, "REFUND");
  assert(ticket.agentId);
  const current = await call("/ops/workspace", manager);
  const saved = current.tickets.find((t) => t.id === ticket.id);
  assert(saved.relatedIds.includes("ticket-0"));
  assert(saved.relatedIds.includes("ticket-30"));
  const pending = current.tickets.find((t) => t.id === unmatched.id);
  assert.equal(
    pending.messages[0].content,
    "Please verify the booking reference.",
  );
  assert(
    pending.events.some(
      (event) =>
        event.kind === "BOOKING_REVIEW_REQUIRED" &&
        event.text.includes("NO-SUCH-BOOKING"),
    ),
  );
  await call(
    `/ops/tickets/${ticket.id}`,
    other,
    { status: "CLOSED", reason: "Unauthorized" },
    "PATCH",
    404,
  );
  await call(
    `/ops/tickets/${ticket.id}`,
    customer,
    { priority: "URGENT" },
    "PATCH",
    403,
  );
  await call(
    `/ops/tickets/${ticket.id}/messages`,
    customer,
    { content: "Forbidden private note.", visibility: "INTERNAL" },
    "POST",
    403,
  );
  await call(
    `/ops/tickets/${ticket.id}/messages`,
    agent,
    { content: "A staff-only refund note.", visibility: "INTERNAL" },
    "POST",
    201,
  );
  const afterNote = await call("/ops/workspace", customer);
  assert(
    !afterNote.tickets
      .find((t) => t.id === ticket.id)
      .messages.some((m) => m.content.includes("staff-only")),
  );
  const conversation = await call(
    `/ops/tickets/${ticket.id}/conversations`,
    agent,
    {
      subject: "Refund approval request",
      content: "Please confirm whether this refund has been approved.",
    },
    "POST",
    201,
  );
  const parallelConversation = await call(
    `/ops/tickets/${ticket.id}/conversations`,
    agent,
    {
      subject: "Separate supplier follow-up",
      content: "Please confirm the refund reference separately.",
    },
    "POST",
    201,
  );
  const supplierData = await call("/ops/workspace", supplier);
  assert.equal(supplierData.tickets.length, 0);
  assert.equal(supplierData.bookings.length, 0);
  assert(supplierData.conversations.some((c) => c.id === conversation.id));
  assert(!JSON.stringify(supplierData).includes("staff-only"));
  await call(
    `/ops/conversations/${conversation.id}/reply`,
    wrongSupplier,
    { content: "Unauthorized supplier reply" },
    "POST",
    404,
  );
  await call(
    `/ops/conversations/${conversation.id}/reply`,
    supplier,
    {
      content:
        "Refund approved. Reference RF-SMOKE. Please notify the traveler.",
    },
    "POST",
    201,
  );
  const afterReply = await call("/ops/workspace", manager);
  assert.equal(
    afterReply.tickets.find((t) => t.id === ticket.id).status,
    "WAITING_SUPPLIER",
  );
  await call(
    `/ops/conversations/${parallelConversation.id}`,
    agent,
    { status: "CLOSED" },
    "PATCH",
  );
  const afterLastPending = await call("/ops/workspace", manager);
  assert.equal(
    afterLastPending.tickets.find((t) => t.id === ticket.id).status,
    "IN_PROGRESS",
  );
  await call(
    `/ops/conversations/${conversation.id}`,
    customer,
    { status: "CLOSED" },
    "PATCH",
    403,
  );
  await call(
    `/ops/conversations/${conversation.id}`,
    supplier,
    { status: "CLOSED" },
    "PATCH",
    403,
  );
  await call(
    `/ops/conversations/${conversation.id}`,
    agent,
    { status: "CLOSED" },
    "PATCH",
  );
  await call(
    `/ops/conversations/${conversation.id}/reply`,
    supplier,
    { content: "A reply to a closed thread must be rejected." },
    "POST",
    400,
  );
  await call(
    `/ops/conversations/${conversation.id}`,
    agent,
    { status: "AWAITING_REPLY" },
    "PATCH",
  );
  const afterReopen = await call("/ops/workspace", manager);
  assert.equal(
    afterReopen.tickets.find((t) => t.id === ticket.id).status,
    "WAITING_SUPPLIER",
  );
  const reopenedDueAt = afterReopen.conversations.find(
    (c) => c.id === conversation.id,
  ).dueAt;
  await call(
    `/ops/conversations/${conversation.id}`,
    agent,
    { status: "AWAITING_REPLY" },
    "PATCH",
  );
  const afterRetry = await call("/ops/workspace", manager);
  assert.equal(
    afterRetry.conversations.find((c) => c.id === conversation.id).dueAt,
    reopenedDueAt,
  );
  assert.equal(
    afterReply.conversations.find((c) => c.id === conversation.id).status,
    "REPLIED",
  );
  await call(
    `/ops/tickets/${ticket.id}`,
    agent,
    { agentId: "agent-europe" },
    "PATCH",
    403,
  );
  await call(
    `/ops/tickets/${ticket.id}`,
    manager,
    { agentId: "agent-europe" },
    "PATCH",
    400,
  );
  await call(
    `/ops/tickets/${ticket.id}`,
    agent,
    { status: "RESOLVED" },
    "PATCH",
    400,
  );
  await call(
    `/ops/tickets/${ticket.id}`,
    agent,
    {
      status: "RESOLVED",
      reason: "Private resolution detail from the supplier.",
    },
    "PATCH",
  );
  const resolvedCustomer = await call("/ops/workspace", customer);
  const resolved = resolvedCustomer.tickets.find((t) => t.id === ticket.id);
  assert.equal(resolved.status, "RESOLVED");
  assert(
    resolved.events.some(
      (event) => event.text === "WAITING_SUPPLIER → RESOLVED",
    ),
  );
  assert(!JSON.stringify(resolved).includes("Private resolution detail"));
  await call(
    `/ops/tickets/${ticket.id}`,
    customer,
    { status: "OPEN", reason: "Refund has not arrived yet." },
    "PATCH",
  );
  const manual = await call(
    "/ops/tickets",
    customer,
    {
      title: "Missing reference requires review",
      description:
        "I cannot find my booking reference. Please help the support team locate it.",
    },
    "POST",
    201,
  );
  created.push(manual.id);
  assert.equal(manual.bookingId, null);
  await call(
    `/ops/tickets/${manual.id}`,
    agent,
    { bookingReference: "BK-1042" },
    "PATCH",
  );
  // Durable state survives a fresh database connection; lifecycle restart tested separately.
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int AS n FROM "TravelTicket" WHERE id=$1',
        [ticket.id],
      )
    ).rows[0].n,
    1,
  );
  const clock = (
    await pool.query(
      'SELECT "offsetMinutes" FROM "TravelClock" WHERE id=\'demo\'',
    )
  ).rows[0].offsetMinutes;
  previousClock = clock;
  await call("/ops/clock/advance", customer, { minutes: 1 }, "POST", 403);
  await call("/ops/clock/advance", manager, { minutes: -1 }, "POST", 400);
  // Expire this test case and its supplier target, then verify repeat-safe alerts.
  await pool.query(
    `UPDATE "TravelTicket"
     SET deadline=(now() AT TIME ZONE 'UTC')-interval '1 minute',
         "responseDeadline"=(now() AT TIME ZONE 'UTC')-interval '1 minute'
     WHERE id=$1`,
    [ticket.id],
  );
  await pool.query(
    `UPDATE "TravelConversation"
     SET "dueAt"=(now() AT TIME ZONE 'UTC')-interval '1 minute'
     WHERE id=$1`,
    [conversation.id],
  );
  await call("/ops/clock/advance", manager, { minutes: 1 }, "POST", 201);
  await call("/ops/clock/advance", manager, { minutes: 1 }, "POST", 201);
  const events = await pool.query(
    "SELECT count(*)::int AS n FROM \"TravelEvent\" WHERE \"ticketId\"=$1 AND kind='ESCALATED' AND text='Response deadline breached'",
    [ticket.id],
  );
  assert.equal(events.rows[0].n, 1);
  const alerts = (await call("/ops/workspace", manager)).notifications.filter(
    (event) => event.ticketId === ticket.id,
  );
  assert.equal(alerts.filter((event) => event.kind === "ESCALATED").length, 1);
  assert.equal(
    alerts.filter((event) => event.kind === "SUPPLIER_OVERDUE").length,
    1,
  );
  await pool.query(
    'UPDATE "TravelClock" SET "offsetMinutes"=$1 WHERE id=\'demo\'',
    [clock],
  );
  await call("/ops/availability", agent, { available: false }, "PATCH");
  const routed = await call(
    "/ops/tickets",
    customer,
    {
      title: "Check-in routing while agent away",
      description: "The voucher needs confirmation before our arrival.",
      bookingReference: "BK-1042",
    },
    "POST",
    201,
  );
  created.push(routed.id);
  assert.equal(routed.agentId, "agent-global");
  await call("/ops/availability", agent, { available: true }, "PATCH");

  temporaryBookingId = randomUUID();
  const schedulePath = `/ops/bookings/${temporaryBookingId}/schedule`;
  const workspaceTime = Date.parse((await call("/ops/workspace", manager)).now);
  const at = (hours) => new Date(workspaceTime + hours * 3600000).toISOString();
  await pool.query(
    `INSERT INTO "TravelBooking"
       (id, reference, "agencyId", "customerId", "supplierId", destination, region, service, timezone, "checkInAt")
     SELECT $1, $2, "agencyId", "customerId", "supplierId", destination, region, service, timezone, $3
     FROM "TravelBooking" WHERE id = 'booking-0'`,
    [temporaryBookingId, temporaryBookingId.toUpperCase(), at(22)],
  );
  await call(schedulePath, agent, { departureAt: at(10) }, "PATCH", 403);
  await call(
    schedulePath,
    manager,
    { departureAt: "2026-11-09T12:00:00" },
    "PATCH",
    400,
  );
  await call(
    schedulePath,
    manager,
    { departureAt: at(10), cancellationCutoffAt: at(11) },
    "PATCH",
    400,
  );
  await call(
    schedulePath,
    manager,
    { departureAt: at(10), cancellationCutoffAt: at(4) },
    "PATCH",
  );
  const cancellation = await call(
    "/ops/tickets",
    customer,
    {
      title: "Cancellation before cutoff",
      description: "Please cancel my booking before the cutoff.",
      bookingReference: temporaryBookingId,
    },
    "POST",
    201,
  );
  created.push(cancellation.id);
  assert.equal(cancellation.deadline, at(4));
  await call(schedulePath, manager, { cancellationCutoffAt: null }, "PATCH");
  const rescheduled = (await call("/ops/workspace", manager)).tickets.find(
    (t) => t.id === cancellation.id,
  );
  assert.equal(rescheduled.deadline, at(10));
  assert.equal(rescheduled.responseDeadline, cancellation.responseDeadline);
  assert.equal(
    rescheduled.events.filter((event) => event.kind === "DEADLINE_CHANGED")
      .length,
    1,
  );
  const policyPath = "/ops/agencies/atlas/response-policy";
  previousAgencyPolicy = initial.agencies.find((value) => value.id === "atlas");
  await call(policyPath, agency, { responseTargetHours: 6 }, "PATCH", 403);
  await call(policyPath, manager, { responseTargetHours: 0 }, "PATCH", 400);
  const policy = await call(
    policyPath,
    manager,
    { responseTargetHours: 6 },
    "PATCH",
  );
  const unchangedPolicy = await call(
    policyPath,
    manager,
    { responseTargetHours: 6 },
    "PATCH",
  );
  assert.equal(
    unchangedPolicy.responsePolicyVersion,
    policy.responsePolicyVersion,
  );
  const routingAgents = initial.people.filter((person) =>
    ["agent-asia", "agent-global"].includes(person.id),
  );
  previousCapacities = routingAgents;
  const globalCount = (
    await pool.query(
      `SELECT count(*)::int AS n FROM "TravelTicket"
     WHERE "agentId"='agent-global' AND status NOT IN ('RESOLVED','CLOSED')`,
    )
  ).rows[0].n;
  for (const person of routingAgents)
    await call(
      `/ops/agents/${person.id}/specialties`,
      manager,
      {
        specialties: person.specialties,
        maxActiveCases: person.id === "agent-global" ? globalCount + 1 : 1,
      },
      "PATCH",
    );
  const routedAtCapacity = await Promise.all(
    [1, 2].map(async (attempt) => {
      const result = await call(
        "/ops/tickets",
        customer,
        {
          title: `Capacity routing probe ${attempt}`,
          description: "Please review the refund for this booking.",
          bookingReference: "BK-1042",
        },
        "POST",
        201,
      );
      created.push(result.id);
      return result;
    }),
  );
  assert.deepEqual(routedAtCapacity.map((value) => value.agentId).sort(), [
    "agent-global",
    null,
  ]);
  for (const result of routedAtCapacity)
    assert.equal(
      Date.parse(result.responseDeadline) -
        Date.parse(result.responseStartedAt),
      6 * 3600000,
    );
  const afterPolicy = (await call("/ops/workspace", manager)).tickets.find(
    (value) => value.id === cancellation.id,
  );
  assert.equal(afterPolicy.responseDeadline, cancellation.responseDeadline);
  const completed = routedAtCapacity[0];
  await call(
    `/ops/tickets/${completed.id}`,
    manager,
    { status: "RESOLVED", reason: "Capacity test complete." },
    "PATCH",
  );
  const renewed = await call(
    `/ops/tickets/${completed.id}`,
    customer,
    { status: "OPEN", reason: "Reopen test." },
    "PATCH",
  );
  assert.equal(
    Date.parse(renewed.responseDeadline) -
      Date.parse(renewed.responseStartedAt),
    6 * 3600000,
  );
  assert.equal((await call("/health/ready", null)).status, "ready");
  assert.equal((await call("/health/worker", null)).status, "ready");
  const activeCases = (await call("/ops/workspace", manager)).tickets.filter(
    (value) => !["RESOLVED", "CLOSED"].includes(value.status),
  ).length;
  const candidateSweep = await call(
    "/ops/clock/advance",
    manager,
    { minutes: 1 },
    "POST",
    201,
  );
  assert(
    candidateSweep.checked < activeCases,
    "The sweep should skip future refund cases without supplier deadlines.",
  );
  notes.push(
    "Role and agency isolation, message privacy, booking linking and schedule edits, specialty settings and routing, parallel supplier threads, resolution/reopening, durable records and repeat-safe deadline alerts passed.",
  );
  console.log(`PASS: ${checks} real HTTP checks. ${notes.join(" ")}`);
} finally {
  if (previousAgencyPolicy)
    await pool.query(
      'UPDATE "TravelAgency" SET "responseTargetHours"=$1, "responsePolicyVersion"=$2 WHERE id=$3',
      [
        previousAgencyPolicy.responseTargetHours,
        previousAgencyPolicy.responsePolicyVersion,
        previousAgencyPolicy.id,
      ],
    );
  if (previousCapacities)
    for (const person of previousCapacities)
      await pool.query(
        'UPDATE "TravelProfile" SET "maxActiveCases"=$1 WHERE "userId"=$2',
        [person.maxActiveCases, person.id],
      );
  if (previousClock !== undefined)
    await pool.query(
      'UPDATE "TravelClock" SET "offsetMinutes"=$1 WHERE id=\'demo\'',
      [previousClock],
    );
  await pool.query('DELETE FROM "TravelTicket" WHERE id=ANY($1::text[])', [
    created,
  ]);
  if (temporaryBookingId)
    await pool.query('DELETE FROM "TravelBooking" WHERE id=$1', [
      temporaryBookingId,
    ]);
  await pool.query(
    'UPDATE "TravelProfile" SET available=true WHERE "userId"=\'agent-asia\'',
  );
  await pool.end();
}
