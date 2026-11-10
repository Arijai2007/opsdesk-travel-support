import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import pg from "pg";
import { chromium, firefox } from "playwright";
const env = dotenv.parse(
  readFileSync(new URL("../backend/.env", import.meta.url)),
);
assert.equal(env.OPSDESK_DEMO, "true");
assert.equal(new URL(env.DATABASE_URL).hostname, "127.0.0.1");
const url = process.env.OPSDESK_BROWSER_URL || "http://127.0.0.1:3000";
assert(["127.0.0.1", "localhost"].includes(new URL(url).hostname));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const suffix = randomUUID().slice(0, 8),
  reason = "Rotation browser " + suffix;
const a = "rotation-ui-" + suffix + "-a",
  b = "rotation-ui-" + suffix + "-b";
const names = {
  [a]: "Rotation Primary " + suffix,
  [b]: "Rotation Backup " + suffix,
};
const rotations = (await pool.query('SELECT * FROM "TravelEscalationRotation"'))
  .rows;
const clock = (
  await pool.query('SELECT * FROM "TravelClock" WHERE id=$1', ["demo"])
).rows[0];
const owners = (
  await pool.query(
    'SELECT id,"escalationOwnerId","escalationManual","escalationOverrideUntil" FROM "TravelTicket"',
  )
).rows;
const events = (
  await pool.query('SELECT id FROM "TravelEvent" WHERE kind=ANY($1::text[])', [
    ["ESCALATION_OWNER_CHANGED", "ESCALATION_OVERRIDE_ENDED"],
  ])
).rows;
let browser, ticketId;
async function patch(page, path, action) {
  const wait = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/backend/ops/" + path) &&
      r.request().method() === "PATCH",
  );
  await action();
  const r = await wait;
  assert.equal(r.status(), 200);
  return r.json();
}
try {
  for (const id of [a, b]) {
    await pool.query(
      'INSERT INTO "User" (id,email,"passwordHash","firstName","lastName",role,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW())',
      [
        id,
        id + "@example.invalid",
        "unused",
        "Rotation",
        (id === a ? "Primary " : "Backup ") + suffix,
        "ADMIN",
      ],
    );
    await pool.query(
      'INSERT INTO "TravelProfile" ("userId",kind,region) VALUES ($1,$2,$3)',
      [id, "MANAGER", "GLOBAL"],
    );
  }
  await pool.query('UPDATE "TravelClock" SET "offsetMinutes"=$1 WHERE id=$2', [
    Math.round((Date.parse("2026-11-10T00:30:00Z") - Date.now()) / 60000),
    "demo",
  ]);
  const engine = process.env.OPSDESK_BROWSER_ENGINE || "chromium";
  assert(["chromium", "firefox"].includes(engine));
  browser = await (engine === "firefox" ? firefox : chromium).launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  let delayReadback = false;
  await page.route("**/api/backend/ops/escalation-rotations", async (route) => {
    if (delayReadback && route.request().method() === "GET") {
      delayReadback = false;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    await route.continue();
  });
  await page.goto(url);
  await page.getByLabel("Email address").fill("manager@opsdesk.demo");
  await page.getByLabel("Password", { exact: true }).fill("OpsDeskDemo!2026");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page.getByRole("button", { name: /Needs attention/ }).click();
  await page
    .getByText("SLA calendars and duty coverage", { exact: true })
    .click();
  await page
    .getByLabel("Rotation region", { exact: true })
    .selectOption("ASIA");
  const editor = page
    .locator("form")
    .filter({ has: page.getByLabel("Rotation slot hours", { exact: true }) });
  await editor.getByLabel("Rotation slot hours", { exact: true }).fill("1");
  await editor
    .getByLabel("Rotation anchor (UTC)", { exact: true })
    .fill("2026-11-10T01:00");
  await editor.getByLabel("Enable this rotation", { exact: true }).check();
  await editor
    .getByLabel("Search Rotation manager", { exact: true })
    .fill(suffix);
  for (const id of [a, b]) {
    await editor
      .getByLabel("Rotation manager", { exact: true })
      .selectOption(id);
    await editor
      .getByRole("button", { name: "Add rotation manager", exact: true })
      .click();
  }
  const roster = editor.getByRole("list", { name: "Ordered rotation roster" });
  await roster
    .getByRole("button", { name: `Move ${names[b]} earlier`, exact: true })
    .click();
  assert(
    (await roster.innerText()).indexOf(names[b]) <
      (await roster.innerText()).indexOf(names[a]),
  );
  await roster
    .getByRole("button", { name: `Move ${names[a]} earlier`, exact: true })
    .click();
  await editor
    .getByLabel("Rotation change reason", { exact: true })
    .fill(reason);
  delayReadback = true;
  const policy = await patch(page, "escalation-rotations/ASIA", () =>
    editor
      .getByRole("button", { name: "Save escalation rotation", exact: true })
      .click(),
  );
  assert.deepEqual(policy.managerIds, [a, b]);
  assert.equal(policy.enabled, true);
  await page
    .getByLabel("Rotation region", { exact: true })
    .selectOption("EUROPE");
  await page
    .getByLabel("Rotation region", { exact: true })
    .selectOption("ASIA");
  assert.equal(
    await editor
      .getByLabel("Rotation slot hours", { exact: true })
      .inputValue(),
    "1",
  );
  await page.getByRole("button", { name: /All conversations/ }).click();
  await page.getByRole("button", { name: "New ticket", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Start a conversation" });
  await dialog.getByLabel("Search Booking", { exact: true }).fill("BK-1042");
  const option = dialog
    .getByLabel("Booking", { exact: true })
    .locator("option")
    .filter({ hasText: "BK-1042" });
  await option.waitFor({ state: "attached" });
  await dialog
    .getByLabel("Booking", { exact: true })
    .selectOption(await option.getAttribute("value"));
  await dialog.getByLabel("Subject", { exact: true }).fill(reason + " refund");
  await dialog
    .getByLabel("Tell us what happened", { exact: true })
    .fill("Synthetic escalation rotation browser regression case.");
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/ops/tickets") && r.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "Create & route ticket", exact: true })
    .click();
  const response = await created;
  assert.equal(response.status(), 201);
  const ticket = await response.json();
  ticketId = ticket.id;
  await pool.query(
    'UPDATE "TravelTicket" SET deadline=$1,"responseDeadline"=$1 WHERE id=$2',
    ["2026-11-09T23:00:00Z", ticketId],
  );
  async function advance(hours) {
    await page.getByRole("button", { name: "Demo clock", exact: true }).click();
    const clockDialog = page.getByRole("dialog", {
      name: "Move the demo clock",
    });
    const waiting = page.waitForResponse(
      (r) =>
        r.url().endsWith("/ops/clock/advance") &&
        r.request().method() === "POST",
    );
    await clockDialog
      .getByRole("button", { name: `Advance ${hours}h`, exact: true })
      .click();
    const response = await waiting;
    assert(response.ok(), await response.text());
    await clockDialog.waitFor({ state: "hidden" });
  }
  async function open() {
    await page.reload();
    await page.getByLabel("Search conversations", { exact: true }).fill(reason);
    await page
      .getByRole("button", { name: reason + " refund", exact: true })
      .click();
  }
  await advance(1);
  await open();
  const controls = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "SLA and escalation coverage",
      exact: true,
    }),
  });
  await controls
    .getByText("Escalation owner: " + names[a], { exact: true })
    .waitFor();
  await controls
    .getByLabel("Escalation manager", { exact: true })
    .selectOption(b);
  await controls
    .getByLabel("Expire manual hold at a chosen time", { exact: true })
    .check();
  await controls
    .getByLabel("Manual hold expiry (UTC)", { exact: true })
    .fill("2026-11-10T03:00");
  await controls
    .getByLabel("Ownership change reason", { exact: true })
    .fill(reason);
  const held = await patch(page, `tickets/${ticketId}/escalation-owner`, () =>
    controls
      .getByRole("button", { name: "Save escalation owner", exact: true })
      .click(),
  );
  assert.equal(held.escalationManual, true);
  assert.equal(held.escalationOverrideUntil, "2026-11-10T03:00:00.000Z");
  await advance(4);
  await open();
  await controls
    .getByText("Escalation owner: " + names[a], { exact: true })
    .waitFor();
  await controls
    .getByText("Escalation control: Automatic coverage and rotations.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await controls
      .getByLabel("Escalation manager", { exact: true })
      .inputValue(),
    a,
  );
  // A coverage-only hold also ends if the chosen manager becomes unavailable.
  await controls
    .getByLabel("Escalation manager", { exact: true })
    .selectOption(b);
  await controls
    .getByLabel("Ownership change reason", { exact: true })
    .fill(reason);
  await patch(page, `tickets/${ticketId}/escalation-owner`, () =>
    controls
      .getByRole("button", { name: "Save escalation owner", exact: true })
      .click(),
  );
  await pool.query(
    'UPDATE "TravelProfile" SET available=false WHERE "userId"=$1',
    [b],
  );
  await advance(1);
  await open();
  await controls
    .getByText("Escalation owner: " + names[a], { exact: true })
    .waitFor();
  await controls
    .getByText("Escalation control: Automatic coverage and rotations.", {
      exact: true,
    })
    .waitFor();
  const final = (
    await pool.query(
      'SELECT "responseDeadline","slaSnapshot" FROM "TravelTicket" WHERE id=$1',
      [ticketId],
    )
  ).rows[0];
  assert.deepEqual(final.slaSnapshot, ticket.slaSnapshot);
  await page.setViewportSize({ width: 390, height: 844 });
  await controls
    .getByLabel("Escalation manager", { exact: true })
    .scrollIntoViewIfNeeded();
  if (process.env.OPSDESK_ROTATION_SCREENSHOTS)
    await page.screenshot({ path: "../rotation-controls-mobile.png" });
  console.log(
    `Escalation rotation ${engine}: ordered roster, save/readback, automatic owner, timed expiry, coverage loss and manual controls passed.`,
  );
} finally {
  await browser?.close();
  await pool.query('DELETE FROM "TravelEscalationRotation"');
  for (const r of rotations)
    await pool.query(
      'INSERT INTO "TravelEscalationRotation" (region,enabled,"managerIds","slotHours","anchorAt",version) VALUES ($1,$2,$3,$4,$5,$6)',
      [r.region, r.enabled, r.managerIds, r.slotHours, r.anchorAt, r.version],
    );
  if (ticketId)
    await pool.query('DELETE FROM "TravelTicket" WHERE id=$1', [ticketId]);
  for (const t of owners)
    await pool.query(
      'UPDATE "TravelTicket" SET "escalationOwnerId"=$2,"escalationManual"=$3,"escalationOverrideUntil"=$4 WHERE id=$1',
      [
        t.id,
        t.escalationOwnerId,
        t.escalationManual,
        t.escalationOverrideUntil,
      ],
    );
  await pool.query(
    'DELETE FROM "TravelEvent" WHERE "ticketId"=ANY($1::text[]) AND kind=ANY($2::text[]) AND NOT(id=ANY($3::text[])) AND "actorId"=$4',
    [
      owners.map((t) => t.id),
      ["ESCALATION_OWNER_CHANGED", "ESCALATION_OVERRIDE_ENDED"],
      events.map((e) => e.id),
      "system",
    ],
  );
  await pool.query('DELETE FROM "MembershipAudit" WHERE reason=$1', [reason]);
  await pool.query(
    'DELETE FROM "TravelProfile" WHERE "userId"=ANY($1::text[])',
    [[a, b]],
  );
  await pool.query('DELETE FROM "User" WHERE id=ANY($1::text[])', [[a, b]]);
  await pool.query('UPDATE "TravelClock" SET "offsetMinutes"=$1 WHERE id=$2', [
    clock.offsetMinutes,
    "demo",
  ]);
  await pool.end();
}
