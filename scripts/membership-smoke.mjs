import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import pg from "pg";

const env = dotenv.parse(
  readFileSync(new URL("../backend/.env", import.meta.url)),
);
assert.equal(env.OPSDESK_DEMO, "true", "Use an isolated synthetic demo.");
assert.equal(new URL(env.DATABASE_URL).hostname, "127.0.0.1");
const base = new URL(process.env.OPSDESK_TEST_URL || "http://127.0.0.1:3001");
assert(["127.0.0.1", "localhost"].includes(base.hostname));
const db = new pg.Pool({ connectionString: env.DATABASE_URL });
const run = randomUUID().replaceAll("-", "").slice(0, 12);
const ids = [];
const agencyIds = [];
const supplierIds = [];
const tokenHashes = [];
const password = "MembershipFixture!2026";
const reason = `Membership regression ${run}`;
let checks = 0;
const rateKeys = ["127.0.0.1", "::ffff:127.0.0.1"].map(
  (ip) =>
    `invitation-accept:${createHash("sha256").update(ip).digest("hex").slice(0, 16)}`,
);
const previousCounters = (
  await db.query('SELECT * FROM "OpsCounter" WHERE key=ANY($1::text[])', [
    rateKeys,
  ])
).rows;
await db.query('DELETE FROM "OpsCounter" WHERE key=ANY($1::text[])', [
  rateKeys,
]);
async function call(
  path,
  token,
  body,
  expected = 200,
  method = body ? "POST" : "GET",
) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${value.message || value.error || "unexpected status"}`,
  );
  checks++;
  return value;
}
const login = (email, pass = password, status = 200) =>
  call("/auth/login", null, { email, password: pass }, status);
const status = (manager, id, state, expected = 200) =>
  call(
    `/ops/admin/members/${id}/status`,
    manager,
    { status: state, reason },
    expected,
    "PATCH",
  );
async function invite(manager, kind, extra = {}) {
  const email = `${kind.toLowerCase()}-${randomUUID()}@opsdesk.demo`;
  const value = await call(
    "/ops/admin/invitations",
    manager,
    {
      email,
      firstName: "Membership",
      lastName: "Fixture",
      kind,
      reason,
      ...extra,
    },
    201,
  );
  ids.push(value.member.id);
  tokenHashes.push(createHash("sha256").update(value.token).digest("hex"));
  assert.match(value.token, /^[a-f0-9]{64}$/);
  assert.equal(value.member.status, "INVITED");
  assert(Date.parse(value.expiresAt) > Date.now());
  return { ...value, email };
}
async function accept(invitation, expected = 200) {
  return call(
    "/ops/invitations/accept",
    null,
    { token: invitation.token, password },
    expected,
  );
}
try {
  const manager = (await login("manager@opsdesk.demo", "OpsDeskDemo!2026"))
    .accessToken;
  const page = await call("/ops/admin/members", manager);
  assert.equal(page.pageSize, 20);
  assert(
    page.items.length <= 20 &&
      page.items.every((x) => !("passwordHash" in x) && !("tokenHash" in x)),
  );
  await call("/ops/admin/members", null, undefined, 401);
  for (const role of ["asia", "agency", "maya", "supplier"]) {
    const token = (await login(`${role}@opsdesk.demo`, "OpsDeskDemo!2026"))
      .accessToken;
    await call("/ops/admin/members", token, undefined, 403);
    await call("/ops/admin/audit", token, undefined, 403);
    await call("/ops/admin/agencies", token, undefined, 403);
    await call("/ops/admin/suppliers", token, undefined, 403);
    await call(
      "/ops/admin/invitations",
      token,
      {
        email: "forbidden@opsdesk.demo",
        firstName: "No",
        lastName: "Access",
        kind: "MANAGER",
        reason,
      },
      403,
    );
  }
  await call("/ops/admin/members?page=0", manager, undefined, 400);
  const invalid = {
    email: `invalid-${run}@opsdesk.demo`,
    firstName: "Invalid",
    lastName: "Fixture",
    kind: "CUSTOMER",
    reason,
  };
  await call("/ops/admin/invitations", manager, invalid, 400);
  await call(
    "/ops/admin/invitations",
    manager,
    { ...invalid, agencyId: "atlas", supplierId: "supplier-0" },
    400,
  );
  await call(
    "/ops/admin/invitations",
    manager,
    { ...invalid, agencyId: "atlas", reason: "   " },
    400,
  );
  await call(
    "/ops/admin/invitations",
    manager,
    { ...invalid, agencyId: "atlas", isAdmin: true },
    400,
  );

  const customer = await invite(manager, "CUSTOMER", { agencyId: "atlas" });
  await login(customer.email, password, 401);
  await status(manager, customer.member.id, "ACTIVE", 400);
  await call(
    "/ops/admin/invitations",
    manager,
    { ...invalid, email: customer.email.toUpperCase(), agencyId: "atlas" },
    409,
  );
  const hash = createHash("sha256").update(customer.token).digest("hex");
  const invitation = await db.query(
    'SELECT "tokenHash" FROM "TravelInvitation" WHERE "memberId"=$1',
    [customer.member.id],
  );
  assert(invitation.rows.some((x) => x.tokenHash === hash));
  assert(!invitation.rows.some((x) => x.tokenHash === customer.token));
  const customerRateKeys = rateKeys.map((key) => `${key}:${hash}`);
  for (const key of customerRateKeys)
    await db.query(
      "INSERT INTO \"OpsCounter\" (key,value,expires_at) VALUES ($1,'20',now()+interval '15 minutes') ON CONFLICT (key) DO UPDATE SET value='20',expires_at=EXCLUDED.expires_at",
      [key],
    );
  await accept(customer, 429);
  const independent = await invite(manager, "AGENCY", { agencyId: "atlas" });
  await accept(independent);
  await db.query('DELETE FROM "OpsCounter" WHERE key=ANY($1::text[])', [
    customerRateKeys,
  ]);
  await call(
    "/ops/invitations/accept",
    null,
    { token: customer.token, password: "weak" },
    400,
  );
  await accept(customer);
  await accept(customer, 400);
  const session = await login(customer.email);
  const workspace = await call("/ops/workspace?compact=1", session.accessToken);
  assert.equal(workspace.me.kind, "CUSTOMER");
  const recordsBefore = (
    await db.query(
      'SELECT id,"agencyId","customerId","bookingId","agentId",title,description FROM "TravelTicket" ORDER BY id',
    )
  ).rows;
  await status(manager, customer.member.id, "SUSPENDED");
  await call("/ops/workspace?compact=1", session.accessToken, undefined, 401);
  await call(
    "/auth/refresh",
    null,
    { refreshToken: session.refreshToken },
    401,
  );
  await login(customer.email, password, 401);
  await status(manager, customer.member.id, "SUSPENDED");
  await status(manager, customer.member.id, "ACTIVE");
  await call("/ops/workspace?compact=1", session.accessToken, undefined, 401);
  await call(
    "/auth/refresh",
    null,
    { refreshToken: session.refreshToken },
    401,
  );
  await call(
    "/ops/workspace?compact=1",
    (await login(customer.email)).accessToken,
  );
  assert.deepEqual(
    (
      await db.query(
        'SELECT id,"agencyId","customerId","bookingId","agentId",title,description FROM "TravelTicket" ORDER BY id',
      )
    ).rows,
    recordsBefore,
  );

  const agent = await invite(manager, "AGENT", { region: "ASIA" });
  const reissued = await call(
    `/ops/admin/members/${agent.member.id}/invitation`,
    manager,
    { reason },
    201,
  );
  tokenHashes.push(createHash("sha256").update(reissued.token).digest("hex"));
  await accept(agent, 400);
  const attempts = await Promise.all(
    Array.from({ length: 5 }, () =>
      fetch(new URL("/ops/invitations/accept", base), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: reissued.token, password }),
      }),
    ),
  );
  assert.deepEqual(
    attempts.map((r) => r.status).sort(),
    [200, 400, 400, 400, 400],
  );
  checks += 5;
  await login(agent.email);
  const assignedCase = (await db.query('SELECT id FROM "TravelTicket" LIMIT 1'))
    .rows[0].id;
  await status(manager, agent.member.id, "SUSPENDED");
  await call(
    `/ops/tickets/${assignedCase}`,
    manager,
    { agentId: agent.member.id, reason },
    400,
    "PATCH",
  );

  const expired = await invite(manager, "SUPPLIER", {
    supplierId: "supplier-0",
  });
  await db.query(
    'UPDATE "TravelInvitation" SET "expiresAt"=(now() AT TIME ZONE \'UTC\')-interval \'1 minute\' WHERE "memberId"=$1',
    [expired.member.id],
  );
  await accept(expired, 400);
  await call(
    "/ops/invitations/accept",
    null,
    { token: "0".repeat(64), password },
    400,
  );
  const unknownHash = createHash("sha256").update("0".repeat(64)).digest("hex");
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM "OpsCounter" WHERE key=ANY($1::text[])',
        [rateKeys.map((key) => `${key}:${unknownHash}`)],
      )
    ).rows[0].n,
    0,
  );
  await status(manager, "manager", "SUSPENDED", 400);

  const extraManager = await invite(manager, "MANAGER");
  await accept(extraManager);
  const managerTwo = (await login(extraManager.email)).accessToken;
  await call("/ops/admin/members", managerTwo);
  await status(manager, extraManager.member.id, "SUSPENDED");
  await call("/ops/admin/members", managerTwo, undefined, 401);

  const agency = await call(
    "/ops/admin/agencies",
    manager,
    { name: `Fixture ${run}`, code: `M${run}`, reason },
    201,
  );
  agencyIds.push(agency.id);
  await call(
    "/ops/admin/agencies",
    manager,
    { name: "Duplicate fixture", code: `m${run}`, reason },
    409,
  );
  const supplier = await call(
    "/ops/admin/suppliers",
    manager,
    { name: `Fixture ${run}`, email: `supplier-${run}@opsdesk.demo`, reason },
    201,
  );
  supplierIds.push(supplier.id);
  const memberPage = await call(
    `/ops/admin/members?search=${encodeURIComponent(customer.email)}`,
    manager,
  );
  assert.equal(memberPage.total, 1);
  assert.equal(memberPage.items[0].id, customer.member.id);
  const audit = await call("/ops/admin/audit", manager);
  assert(audit.items.some((x) => x.action === "SUPPLIER_CREATED"));
  assert(!JSON.stringify(audit).includes(customer.token));
  assert(!JSON.stringify(audit).includes(password));
  const suspensionAudit = await db.query(
    'SELECT count(*)::int AS n FROM "MembershipAudit" WHERE "entityId"=$1 AND action=\'MEMBER_SUSPENDED\'',
    [customer.member.id],
  );
  assert.equal(
    suspensionAudit.rows[0].n,
    1,
    "Same-state retry must not duplicate audit events",
  );
  console.log(
    `PASS: ${checks} membership HTTP checks, hashed invitations, single-use concurrency, live authorization and durable audit.`,
  );
} finally {
  if (ids.length) {
    await db.query(
      'DELETE FROM "MembershipAudit" WHERE "entityId"=ANY($1::text[]) OR "actorId"=ANY($1::text[])',
      [[...ids, ...agencyIds, ...supplierIds]],
    );
    await db.query(
      'DELETE FROM "TravelInvitation" WHERE "memberId"=ANY($1::text[])',
      [ids],
    );
    await db.query(
      'DELETE FROM "TravelProfile" WHERE "userId"=ANY($1::text[])',
      [ids],
    );
    await db.query('DELETE FROM "User" WHERE id=ANY($1::text[])', [ids]);
    await db.query('DELETE FROM "TravelAgency" WHERE id=ANY($1::text[])', [
      agencyIds,
    ]);
    await db.query('DELETE FROM "TravelSupplier" WHERE id=ANY($1::text[])', [
      supplierIds,
    ]);
  }
  await db.query('DELETE FROM "OpsCounter" WHERE key=ANY($1::text[])', [
    tokenHashes.flatMap((hash) => rateKeys.map((key) => `${key}:${hash}`)),
  ]);
  await db.query('DELETE FROM "OpsCounter" WHERE key=ANY($1::text[])', [
    rateKeys,
  ]);
  for (const row of previousCounters)
    await db.query(
      'INSERT INTO "OpsCounter" (key,value,expires_at) VALUES ($1,$2,$3)',
      [row.key, row.value, row.expires_at],
    );
  await db.end();
}
