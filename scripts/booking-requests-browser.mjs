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
const reference = (
  "BROWSER-APPROVAL-" + randomUUID().slice(0, 8)
).toUpperCase();
const engine = process.env.OPSDESK_BROWSER_ENGINE || "chromium";
assert(["chromium", "firefox"].includes(engine));
let browser;
try {
  const {
    rows: [seed],
  } = await pool.query(
    `SELECT * FROM "TravelBooking" WHERE reference='BK-1042'`,
  );
  browser = await (engine === "firefox" ? firefox : chromium).launch();
  async function signIn(account, title) {
    const page = await browser.newPage();
    await page.goto(url);
    await page.getByLabel("Email address").fill(account + "@opsdesk.demo");
    await page.getByLabel("Password", { exact: true }).fill("OpsDeskDemo!2026");
    await page.getByRole("button", { name: "Sign in to workspace" }).click();
    await page.getByRole("button", { name: title, exact: true }).click();
    return {
      page,
      panel: page.getByRole("dialog", { name: title, exact: true }),
    };
  }
  const { page: agencyPage, panel } = await signIn(
    "agency",
    "Booking requests",
  );
  assert.equal(
    await panel.getByLabel("Booking agency", { exact: true }).count(),
    0,
  );
  await panel
    .getByLabel("Booking customer", { exact: true })
    .selectOption(seed.customerId);
  await panel
    .getByLabel("Booking supplier", { exact: true })
    .selectOption(seed.supplierId);
  await panel.getByLabel("Booking reference", { exact: true }).fill(reference);
  await panel
    .getByLabel("Destination", { exact: true })
    .fill("Synthetic approval destination");
  await panel.getByLabel("Service", { exact: true }).fill("Hotel");
  await panel
    .getByLabel("Check-in (UTC)", { exact: true })
    .fill("2027-02-01T10:00");
  await panel
    .getByLabel("Request reason", { exact: true })
    .fill("Browser synthetic booking approval rehearsal");
  // Drop the response after the API commits. Retrying must reuse the request ID.
  await agencyPage.route(
    "**/api/backend/ops/booking-requests",
    async (route) => {
      await route.fetch();
      await route.abort();
    },
    { times: 1 },
  );
  await panel
    .getByRole("button", { name: "Submit booking request", exact: true })
    .click();
  await panel.getByRole("alert").waitFor();
  await panel
    .getByRole("button", { name: "Submit booking request", exact: true })
    .click();
  const creation = panel
    .locator("article")
    .filter({ hasText: reference })
    .filter({ hasText: "CREATE:" });
  await creation.getByText(/PENDING/).waitFor();
  const {
    rows: [{ count }],
  } = await pool.query(
    `SELECT count(*)::int AS count FROM "TravelBookingRequest" WHERE payload->>'reference'=$1`,
    [reference],
  );
  assert.equal(count, 1);

  assert.equal(
    await creation.getByRole("button", { name: "Approve request" }).count(),
    0,
  );
  await agencyPage.close();
  const { panel: managerPanel } = await signIn("manager", "Booking reviews");
  const managerCreation = managerPanel
    .locator("article")
    .filter({ hasText: reference })
    .filter({ hasText: "CREATE:" });
  await managerCreation
    .getByRole("textbox")
    .fill("Manager verified this synthetic booking request");
  await managerCreation
    .getByRole("button", { name: "Approve request", exact: true })
    .click();
  await managerCreation.getByText(/APPROVED/).waitFor();
  const {
    rows: [booking],
  } = await pool.query(`SELECT id FROM "TravelBooking" WHERE reference=$1`, [
    reference,
  ]);
  assert(booking);
  const { page: customerPage, panel: customerPanel } = await signIn(
    "maya",
    "Booking requests",
  );
  assert.equal(
    await customerPanel.getByLabel("Request type", { exact: true }).count(),
    0,
  );
  await customerPanel
    .getByLabel("Search Booking to cancel", { exact: true })
    .fill(reference);
  await customerPanel
    .getByLabel("Booking to cancel", { exact: true })
    .selectOption(booking.id);
  await customerPanel
    .getByLabel("Request reason", { exact: true })
    .fill("Browser cancellation after verified manager review");
  await customerPanel
    .getByRole("button", { name: "Submit booking request", exact: true })
    .click();
  const cancellation = customerPanel
    .locator("article")
    .filter({ hasText: reference })
    .filter({ hasText: "CANCEL:" });
  await cancellation.getByText(/PENDING/).waitFor();
  assert.equal(
    await cancellation.getByRole("button", { name: "Approve request" }).count(),
    0,
  );
  assert.equal(
    await customerPanel
      .locator("article")
      .filter({ hasText: reference })
      .count(),
    1,
  );
  await customerPage.close();
  const { panel: reviewer } = await signIn("manager", "Booking reviews");
  const managerCancellation = reviewer
    .locator("article")
    .filter({ hasText: reference })
    .filter({ hasText: "CANCEL:" });
  await managerCancellation
    .getByRole("textbox")
    .fill("Manager approves synthetic cancellation only");
  await managerCancellation
    .getByRole("button", { name: "Approve request", exact: true })
    .click();
  await managerCancellation.getByText(/APPROVED/).waitFor();
  const {
    rows: [state],
  } = await pool.query(
    `SELECT "providerStatus" FROM "TravelBookingImport" WHERE "bookingId"=$1`,
    [booking.id],
  );
  assert.equal(state.providerStatus, "CANCELLED");
  console.log(
    `Booking review ${engine} browser passed: agency creation request, customer cancellation, manager approvals and persistence.`,
  );
} finally {
  await browser?.close();
  await pool.query(
    `DELETE FROM "MembershipAudit" WHERE "entityId" IN (SELECT id FROM "TravelBookingRequest" WHERE payload->>'reference'=$1)`,
    [reference],
  );
  await pool.query(
    `DELETE FROM "TravelBookingRequest" WHERE payload->>'reference'=$1`,
    [reference],
  );
  await pool.query(`DELETE FROM "TravelBooking" WHERE reference=$1`, [
    reference,
  ]);
  await pool.end();
}
