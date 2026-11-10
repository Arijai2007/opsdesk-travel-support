import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import { chromium, firefox } from "playwright";
import pg from "pg";
const env = dotenv.parse(
  readFileSync(new URL("../backend/.env", import.meta.url)),
);
assert.equal(env.OPSDESK_DEMO, "true");
assert.equal(new URL(env.DATABASE_URL).hostname, "127.0.0.1");
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const original = (
  await pool.query(
    'SELECT "slaCalendar","responsePolicyVersion" FROM "TravelAgency" WHERE id=\'atlas\'',
  )
).rows[0];
const shift = (
  await pool.query(
    'SELECT "shiftCalendar" FROM "TravelProfile" WHERE "userId"=\'agent-asia\'',
  )
).rows[0];
const reason = "SLA browser " + randomUUID().slice(0, 8),
  title = reason + " refund";
let ticketId, browser;
async function patch(page, path, action) {
  const waiting = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/backend/ops/" + path) &&
      r.request().method() === "PATCH",
  );
  await action();
  const response = await waiting;
  assert.equal(response.status(), 200, `Browser mutation ${path}`);
  return response.json();
}
try {
  const engine = process.env.OPSDESK_BROWSER_ENGINE || "chromium";
  assert(["chromium", "firefox"].includes(engine));
  browser = await (engine === "firefox" ? firefox : chromium).launch(
    engine === "chromium" && process.env.OPSDESK_BROWSER_CHANNEL
      ? { channel: process.env.OPSDESK_BROWSER_CHANNEL }
      : {},
  );
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(process.env.OPSDESK_BROWSER_URL || "http://127.0.0.1:3000");
  await page.getByLabel("Email address").fill("manager@opsdesk.demo");
  await page.getByLabel("Password").fill("OpsDeskDemo!2026");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page.getByRole("button", { name: /Needs attention/ }).click();
  await page
    .getByText("SLA calendars and duty coverage", { exact: true })
    .click();
  const agency = page.locator("form").filter({
    has: page.getByRole("heading", {
      name: "Atlas Travel business calendar",
      exact: true,
    }),
  });
  await agency.getByLabel("Use scheduled hours").check();
  await agency.getByLabel("Calendar time zone").fill("Asia/Kolkata");
  await agency
    .getByLabel("Holidays (one YYYY-MM-DD date per line)", { exact: true })
    .fill("2026-12-25");
  await agency.getByLabel("Calendar change reason").fill(reason);
  const saved = await patch(page, "agencies/atlas/calendar", () =>
    agency.getByRole("button", { name: "Save calendar", exact: true }).click(),
  );
  assert.equal(saved.slaCalendar.timeZone, "Asia/Kolkata");
  assert.deepEqual(saved.slaCalendar.holidays, ["2026-12-25"]);
  await page
    .getByLabel("Coverage member", { exact: true })
    .selectOption("agent-asia");
  const member = page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: /Coverage for/ }) });
  await member.getByLabel("Use scheduled hours").check();
  await member.getByLabel("Shift change reason").fill(reason);
  await patch(page, "members/agent-asia/shift", () =>
    member.getByRole("button", { name: "Save shift", exact: true }).click(),
  );
  await page.getByRole("button", { name: /All conversations/ }).click();
  await page.getByRole("button", { name: "New ticket", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Start a conversation" });
  const booking = dialog.getByRole("combobox");
  await booking.selectOption("booking-0");
  await dialog.getByLabel("Subject", { exact: true }).fill(title);
  await dialog
    .getByLabel("Tell us what happened")
    .fill("Synthetic browser SLA regression case. Please refund the booking.");
  await dialog.getByRole("button", { name: "Create & route ticket" }).click();
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  ticketId = (
    await pool.query('SELECT id FROM "TravelTicket" WHERE title=$1', [title])
  ).rows[0].id;
  const controls = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "SLA and escalation coverage",
      exact: true,
    }),
  });
  await controls.getByLabel("SLA pause or resume reason").fill(reason);
  await patch(page, `tickets/${ticketId}/sla-pause`, () =>
    controls
      .getByRole("button", { name: "Pause response clock", exact: true })
      .click(),
  );
  await page
    .getByText(
      "Response clock paused. Travel and supplier deadlines remain active.",
      { exact: true },
    )
    .waitFor();
  await controls.getByLabel("SLA pause or resume reason").fill(reason);
  await patch(page, `tickets/${ticketId}/sla-pause`, () =>
    controls
      .getByRole("button", { name: "Resume response clock", exact: true })
      .click(),
  );
  await page.getByText("Response clock running.", { exact: true }).waitFor();
  await controls
    .getByLabel("Escalation manager", { exact: true })
    .selectOption("manager");
  await controls.getByLabel("Ownership change reason").fill(reason);
  await patch(page, `tickets/${ticketId}/escalation-owner`, () =>
    controls
      .getByRole("button", { name: "Save escalation owner", exact: true })
      .click(),
  );
  await controls
    .getByText("Escalation owner: Alex Morgan", { exact: true })
    .waitFor();
  console.log(
    `PASS: ${engine} SLA policy, holiday, shift, case pause/resume and escalation ownership browser flow.`,
  );
} finally {
  await browser?.close();
  if (ticketId)
    await pool.query('DELETE FROM "TravelTicket" WHERE id=$1', [ticketId]);
  await pool.query('DELETE FROM "TravelTicket" WHERE title=$1', [title]);
  await pool.query(
    'UPDATE "TravelAgency" SET "slaCalendar"=$1::jsonb,"responsePolicyVersion"=$2 WHERE id=\'atlas\'',
    [
      original.slaCalendar ? JSON.stringify(original.slaCalendar) : null,
      original.responsePolicyVersion,
    ],
  );
  await pool.query(
    'UPDATE "TravelProfile" SET "shiftCalendar"=$1::jsonb WHERE "userId"=\'agent-asia\'',
    [shift.shiftCalendar ? JSON.stringify(shift.shiftCalendar) : null],
  );
  await pool.query('DELETE FROM "MembershipAudit" WHERE reason=$1', [reason]);
  await pool.end();
}
