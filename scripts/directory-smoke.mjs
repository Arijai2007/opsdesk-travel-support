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
  const allItems = [];
  for (let page = 1; page <= first.totalPages; page++) {
    const result =
      page === 1 ? first : await call(`${path}?page=${page}`, token);
    allItems.push(...result.items);
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
  return {...first, allItems};
}
try {
  const roles = [
    "manager",
    "maya",
    "agency",
    "horizon",
    "asia",
    "europe",
    "supplier",
  ];
  const tokens = Object.fromEntries(
    await Promise.all(roles.map(async (r) => [r, await login(r)])),
  );
  const workspace = await call("/ops/workspace", tokens.manager);
  const source = workspace.bookings.find((b) => b.reference === "BK-1042");
  for (let i = 0; i < 45; i++) {
    const id = `${prefix}-${String(i).padStart(2, "0")}`;
    await pool.query(
      `INSERT INTO "User" (id,email,"passwordHash","firstName","lastName",role,"updatedAt") VALUES ($1,$2,'unused','Directory','Fixture','CUSTOMER',NOW())`,
      [id, `${id}@example.invalid`],
    );
    await pool.query(
      `INSERT INTO "TravelProfile" ("userId",kind,"agencyId",available,specialties) VALUES ($1,'CUSTOMER',$2,true,'{}')`,
      [id, source.agencyId],
    );
    await pool.query(
      `INSERT INTO "TravelBooking" (id,reference,"agencyId","customerId","supplierId",destination,region,service,"checkInAt",timezone) VALUES ($1,$1,$2,$3,$4,'Directory fixture',$5,'Flight',NOW(),'UTC')`,
      [id, source.agencyId, id, source.supplierId, source.region],
    );
  }
  for (let i = 0; i < 45; i++) {
    const id = `${prefix}-agent-${String(i).padStart(2, "0")}`;
    await pool.query(
      `INSERT INTO "User" (id,email,"passwordHash","firstName","lastName",role,"updatedAt") VALUES ($1,$2,'unused','Directory','Fixture','AGENT',NOW())`,
      [id, `${id}@example.invalid`],
    );
    await pool.query(
      `INSERT INTO "TravelProfile" ("userId",kind,region,available,specialties) VALUES ($1,'AGENT','GLOBAL',false,'{}')`,
      [id],
    );
  }
  if (process.env.OPSDESK_DIRECTORY_BROWSER === "1") {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(process.env.OPSDESK_WEB_URL || "http://127.0.0.1:3000");
      await page.getByLabel("Email address").fill("manager@opsdesk.demo");
      await page.getByLabel("Password").fill("OpsDeskDemo!2026");
      await page.getByRole("button", { name: "Sign in to workspace" }).click();
      await page.getByLabel("Search Filter owner").fill("Fixture");
      await page
        .getByRole("button", { name: "Older Filter owner", exact: true })
        .click();
      await page
        .getByLabel("Filter owner", { exact: true })
        .selectOption(`${prefix}-agent-20`);
      await page
        .getByRole("button", { name: "Newer Filter owner", exact: true })
        .click();
      assert.equal(
        await page.getByLabel("Filter owner", { exact: true }).inputValue(),
        `${prefix}-agent-20`,
      );
      await page
        .getByRole("button", { name: "New ticket", exact: true })
        .click();
      await page.getByLabel("Search Booking", { exact: true }).fill(prefix);
      await page
        .getByRole("button", { name: "Older Booking", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("combobox")
        .selectOption(`${prefix}-20`);
      await page
        .getByRole("button", { name: "Newer Booking", exact: true })
        .click();
      assert.equal(
        await page.getByRole("dialog").getByRole("combobox").inputValue(),
        `${prefix}-20`,
      );
      console.log(
        "PASS: browser booking and owner search, second-page selection and retained selection.",
      );
    } finally {
      await browser.close();
    }
  }
  for (const role of roles) {
    const token = tokens[role];
    const legacy = await call("/ops/workspace", token);
    const bookings = await allPages(
      "/ops/bookings",
      token,
      legacy.bookings.length,
    );
    assert(
      bookings.allItems.every((b) => legacy.bookings.some((v) => v.id === b.id)),
    );
    const people = await allPages("/ops/people", token, legacy.people.length);
    assert(people.allItems.every((p) => legacy.people.some((v) => v.id === p.id)));
    if (role !== "manager")
      assert(
        people.allItems.every(
          (p) => !("specialties" in p) && !("maxActiveCases" in p),
        ),
      );
    const compact = await call("/ops/workspace?compact=1", token);
    assert.deepEqual(compact.bookings, []);
    assert.deepEqual(compact.people, []);
    const filtered = await call(`/ops/bookings?search=${prefix}`, token);
    assert.equal(
      filtered.total,
      legacy.bookings.filter((b) => b.id.startsWith(prefix)).length,
    );
    const named = await call("/ops/people?search=Fixture", token);
    assert.equal(
      named.total,
      legacy.people.filter((p) => p.name.includes("Fixture")).length,
    );
    const staff = await call("/ops/people?kind=AGENT", token);
    assert(staff.items.every((p) => p.kind === "AGENT"));
  }
  for (const path of ["/ops/bookings", "/ops/people"]) {
    await call(path, null, 401);
    await call(`${path}?search=${"x".repeat(101)}`, tokens.manager, 400);
    await call(`${path}?kind=INVALID`, tokens.manager, 400);
  }
  console.log(
    `PASS: ${checks} directory HTTP checks; multi-page fixtures, scope, search, validation, compact metadata.`,
  );
} finally {
  await pool.query('DELETE FROM "TravelBooking" WHERE id LIKE $1', [
    `${prefix}%`,
  ]);
  await pool.query('DELETE FROM "TravelProfile" WHERE "userId" LIKE $1', [
    `${prefix}%`,
  ]);
  await pool.query('DELETE FROM "User" WHERE id LIKE $1', [`${prefix}%`]);
  await pool.end();
}
