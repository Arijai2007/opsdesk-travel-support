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
const reason = "Contract regression " + randomUUID();
const tickets = [],
  contracts = [];
let checks = 0;
async function call(method, path, body, token, status) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(
    response.status,
    status,
    `${method} ${path}: ${JSON.stringify(data)}`,
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
try {
  const manager = await login("manager"),
    agency = await login("agency"),
    customer = await login("maya"),
    foreign = await login("horizon"),
    supplier = await login("supplier"),
    agent = await login("asia");
  const body = {
    agencyId: "atlas",
    customerId: "customer-0",
    bookingReference: "BK-1042",
    title: reason,
    description: "Synthetic contract response policy test",
    category: "REFUND",
  };
  async function create(contractId, token = manager, status = 201) {
    const t = await call(
      "POST",
      "/ops/tickets",
      { ...body, ...(contractId !== undefined ? { contractId } : {}) },
      token,
      status,
    );
    if (status === 201) tickets.push(t.id);
    return t;
  }
  const legacy = await create();
  assert.equal(legacy.contractId, null);
  const policy = {
    name: reason + " A",
    active: true,
    responseTargetHours: 2,
    calendar: null,
    reason,
  };
  const path = "/ops/agencies/atlas/contracts";
  for (const token of [agency, customer, foreign, supplier, agent])
    await call("POST", path, policy, token, 403);
  await call("POST", path, { ...policy, responseTargetHours: 0 }, manager, 400);
  await call(
    "POST",
    path,
    { ...policy, calendar: { timeZone: "invalid", week: [], holidays: [] } },
    manager,
    400,
  );
  await call("POST", path, { ...policy, name: "   " }, manager, 400);
  const a = await call("POST", path, policy, manager, 201);
  contracts.push(a.id);
  const b = await call(
    "POST",
    path,
    { ...policy, name: reason + " B", responseTargetHours: 8 },
    manager,
    201,
  );
  contracts.push(b.id);
  await call("GET", "/ops/contracts?agencyId=atlas", undefined, null, 401);
  await call("GET", "/ops/contracts?agencyId=atlas", undefined, foreign, 403);
  await call("GET", "/ops/contracts?agencyId=atlas", undefined, supplier, 403);
  await call(
    "GET",
    "/ops/contracts?agencyId=atlas&includeInactive=1",
    undefined,
    customer,
    403,
  );
  await call(
    "GET",
    "/ops/contracts?agencyId=atlas&page=0",
    undefined,
    manager,
    400,
  );
  await call(
    "GET",
    "/ops/contracts?agencyId=atlas&includeInactive=x",
    undefined,
    manager,
    400,
  );
  const list = await call(
    "GET",
    "/ops/contracts?agencyId=atlas",
    undefined,
    agency,
    200,
  );
  assert.equal(list.selectionRequired, true);
  assert(list.items.some((c) => c.id === a.id));
  assert(list.items.length <= 20);
  const search = await call(
    "GET",
    `/ops/contracts?agencyId=atlas&search=${encodeURIComponent(policy.name)}`,
    undefined,
    manager,
    200,
  );
  assert.deepEqual(
    search.items.map((c) => c.id),
    [a.id],
  );
  await create(undefined, manager, 400);
  await create("missing", manager, 400);
  const foreignSelection = await call(
    "POST",
    "/ops/tickets",
    {
      ...body,
      agencyId: "atlas",
      customerId: "customer-1",
      bookingReference: undefined,
      contractId: a.id,
    },
    foreign,
    400,
  );
  assert.match(foreignSelection.message, /active contract in this agency/);
  const t = await create(a.id),
    second = await create(b.id, customer);
  assert.equal(t.contractId, a.id);
  assert.equal(t.slaSnapshot.contractId, a.id);
  assert.equal(t.slaSnapshot.contractName, a.name);
  assert.equal(
    Date.parse(t.responseDeadline) - Date.parse(t.responseStartedAt),
    2 * 3600000,
  );
  assert.equal(
    Date.parse(second.responseDeadline) - Date.parse(second.responseStartedAt),
    8 * 3600000,
  );
  const updated = {
    ...policy,
    name: reason + " A revised",
    responseTargetHours: 3,
  };
  const [u, v] = await Promise.all([
    call("PATCH", path + "/" + a.id, updated, manager, 200),
    call("PATCH", path + "/" + a.id, updated, manager, 200),
  ]);
  assert.equal(u.responsePolicyVersion, 2);
  assert.equal(v.responsePolicyVersion, 2);
  const audits = await pool.query(
    'SELECT * FROM "MembershipAudit" WHERE "entityId"=$1',
    [a.id],
  );
  assert.equal(audits.rows.length, 2);
  await call(
    "PATCH",
    "/ops/agencies/horizon/contracts/" + a.id,
    updated,
    manager,
    404,
  );
  const saved = await call(
    "GET",
    "/ops/tickets/" + t.id,
    undefined,
    manager,
    200,
  );
  assert.equal(saved.responseDeadline, t.responseDeadline);
  assert.deepEqual(saved.slaSnapshot, t.slaSnapshot);
  const paused = await call(
    "PATCH",
    `/ops/tickets/${t.id}/sla-pause`,
    { paused: true, reason },
    manager,
    200,
  );
  assert.deepEqual(paused.slaSnapshot, t.slaSnapshot);
  assert(paused.slaRemainingMs > 0 && paused.slaRemainingMs <= 2 * 3600000);
  const resumed = await call(
    "PATCH",
    `/ops/tickets/${t.id}/sla-pause`,
    { paused: false, reason },
    manager,
    200,
  );
  assert.deepEqual(resumed.slaSnapshot, t.slaSnapshot);
  await call(
    "PATCH",
    "/ops/tickets/" + t.id,
    { contractId: b.id },
    manager,
    400,
  );
  const retired = { ...updated, active: false };
  await call("PATCH", path + "/" + a.id, retired, manager, 200);
  await create(a.id, manager, 400);
  const active = await call(
    "GET",
    "/ops/contracts?agencyId=atlas",
    undefined,
    agency,
    200,
  );
  assert(!active.items.some((c) => c.id === a.id));
  await call(
    "PATCH",
    "/ops/tickets/" + t.id,
    { status: "CLOSED", reason },
    manager,
    200,
  );
  const reopened = await call(
    "PATCH",
    "/ops/tickets/" + t.id,
    { status: "OPEN" },
    customer,
    200,
  );
  assert.equal(reopened.contractId, a.id);
  assert.equal(reopened.slaSnapshot.hours, 3);
  assert.equal(reopened.slaSnapshot.version, 3);
  const reopenedLegacy = await call(
    "PATCH",
    "/ops/tickets/" + legacy.id,
    { status: "CLOSED", reason },
    manager,
    200,
  );
  assert.equal(reopenedLegacy.contractId, null);
  const legacyAgain = await call(
    "PATCH",
    "/ops/tickets/" + legacy.id,
    { status: "OPEN" },
    manager,
    200,
  );
  assert.equal(legacyAgain.contractId, null);
  assert.equal(legacyAgain.slaSnapshot.contractId, undefined);
  // A composite FK enforces agency scope even for direct database writers.
  await assert.rejects(
    pool.query('UPDATE "TravelTicket" SET "agencyId"=$1 WHERE id=$2', [
      "horizon",
      t.id,
    ]),
    (e) => e.code === "23503",
  );
  await assert.rejects(
    pool.query('DELETE FROM "TravelContract" WHERE id=$1', [a.id]),
    (e) => ["23503", "23001"].includes(e.code),
  );
  // Business-hour contracts use the same calendar engine, and snapshots survive edits.
  const calendar = {
    timeZone: "UTC",
    week: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: 0, end: 1440 })),
    holidays: [],
  };
  const business = await call(
    "PATCH",
    path + "/" + b.id,
    { ...policy, name: reason + " B", responseTargetHours: 1, calendar },
    manager,
    200,
  );
  const timed = await create(b.id);
  assert.deepEqual(timed.slaSnapshot.calendar, calendar);
  assert.equal(
    Date.parse(timed.responseDeadline) - Date.parse(timed.responseStartedAt),
    3600000,
  );
  assert.equal(timed.slaSnapshot.version, business.responsePolicyVersion);
  // Independent requests cannot mix calendar/hours/version from two policies.
  const racingPolicy = {
    ...policy,
    name: reason + " B",
    responseTargetHours: 5,
    calendar: null,
  };
  const [racingTicket] = await Promise.all([
    create(b.id),
    call("PATCH", path + "/" + b.id, racingPolicy, manager, 200),
  ]);
  assert([1, 5].includes(racingTicket.slaSnapshot.hours));
  assert.equal(
    racingTicket.slaSnapshot.version,
    racingTicket.slaSnapshot.hours === 1
      ? business.responsePolicyVersion
      : business.responsePolicyVersion + 1,
  );
  assert.deepEqual(
    racingTicket.slaSnapshot.calendar,
    racingTicket.slaSnapshot.hours === 1 ? calendar : null,
  );
  assert.equal(
    Date.parse(racingTicket.responseDeadline) -
      Date.parse(racingTicket.responseStartedAt),
    racingTicket.slaSnapshot.hours * 3600000,
  );
  // Search and tied names retain deterministic, bounded pages.
  for (let i = 0; i < 23; i++) {
    const id = randomUUID();
    contracts.push(id);
    await pool.query(
      'INSERT INTO "TravelContract" (id,"agencyId",name,"responseTargetHours",active) VALUES ($1,$2,$3,24,false)',
      [id, "atlas", reason + " paged"],
    );
  }
  const pages = [];
  for (const page of [1, 2]) {
    const result = await call(
      "GET",
      `/ops/contracts?agencyId=atlas&includeInactive=1&search=${encodeURIComponent(reason + " paged")}&page=${page}`,
      undefined,
      manager,
      200,
    );
    assert.equal(result.total, 23);
    assert(result.items.length <= 20);
    pages.push(...result.items.map((c) => c.id));
  }
  assert.equal(new Set(pages).size, 23);
  await call(
    "PATCH",
    path + "/" + b.id,
    { ...policy, name: reason + " B", active: false },
    manager,
    200,
  );
  await create(undefined, manager, 400); // No silent default when all contracts retire.
  console.log(
    `Agency contracts: ${checks} HTTP checks plus policy, concurrency, snapshot and FK assertions passed.`,
  );
} finally {
  await pool.query('DELETE FROM "TravelTicket" WHERE id=ANY($1::text[])', [
    tickets,
  ]);
  await pool.query('DELETE FROM "TravelContract" WHERE id=ANY($1::text[])', [
    contracts,
  ]);
  await pool.query('DELETE FROM "MembershipAudit" WHERE reason=$1', [reason]);
  await pool.end();
}
