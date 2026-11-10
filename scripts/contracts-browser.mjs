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
const base = process.env.OPSDESK_BROWSER_URL || "http://127.0.0.1:3000";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const reason = "Contract browser " + randomUUID().slice(0, 8);
let browser, contractId, ticketId;
try {
  const engine = process.env.OPSDESK_BROWSER_ENGINE || "chromium";
  assert(["chromium", "firefox"].includes(engine));
  browser = await (engine === "firefox" ? firefox : chromium).launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(base);
  await page.getByLabel("Email address").fill("manager@opsdesk.demo");
  await page.getByLabel("Password", { exact: true }).fill("OpsDeskDemo!2026");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page.getByRole("button", { name: /Needs attention/ }).click();
  await page
    .getByText("SLA calendars and duty coverage", { exact: true })
    .click();
  await page
    .getByLabel("Contract agency", { exact: true })
    .selectOption("atlas");
  const form = page
    .locator("form")
    .filter({ has: page.getByLabel("Contract name", { exact: true }) });
  await form.getByLabel("Contract name", { exact: true }).fill(reason);
  await form.getByLabel("Contract response hours", { exact: true }).fill("2");
  await form.getByLabel("Contract change reason", { exact: true }).fill(reason);
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith("/ops/agencies/atlas/contracts") &&
      r.request().method() === "POST",
  );
  await form
    .getByRole("button", { name: "Save contract", exact: true })
    .click();
  const response = await created;
  assert.equal(response.status(), 201);
  const c = await response.json();
  contractId = c.id;
  if (process.env.OPSDESK_CONTRACT_SCREENSHOTS)
    await page.screenshot({
      path: "../contracts-settings.png",
      fullPage: true,
    });
  await page
    .getByLabel("Contract to edit", { exact: true })
    .selectOption(contractId);
  assert.equal(
    await form
      .getByLabel("Contract response hours", { exact: true })
      .inputValue(),
    "2",
  );
  await page.getByRole("button", { name: /All conversations/ }).click();
  await page.getByRole("button", { name: "New ticket", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Start a conversation" });
  await dialog.getByLabel("Search Booking", { exact: true }).fill("BK-1042");
  const bookingOption = dialog
    .getByLabel("Booking", { exact: true })
    .locator("option")
    .filter({ hasText: "BK-1042" });
  await bookingOption.waitFor({ state: "attached" });
  await dialog
    .getByLabel("Booking", { exact: true })
    .selectOption(await bookingOption.getAttribute("value"));
  const selector = dialog.getByLabel("Agency contract", { exact: true });
  await selector.waitFor();
  assert.equal(await selector.getAttribute("required"), "");
  await dialog.getByLabel("Subject", { exact: true }).fill(reason + " refund");
  await dialog
    .getByLabel("Tell us what happened", { exact: true })
    .fill("Refund follow-up using the explicitly selected agency contract.");
  await selector.selectOption(contractId);
  await page.setViewportSize({ width: 390, height: 844 });
  await selector.scrollIntoViewIfNeeded();
  const bounds = await dialog.boundingBox();
  assert(bounds.width <= 390);
  if (process.env.OPSDESK_CONTRACT_SCREENSHOTS)
    await page.screenshot({ path: "../contracts-intake-mobile.png" });
  const saved = page.waitForResponse(
    (r) => r.url().endsWith("/ops/tickets") && r.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "Create & route ticket", exact: true })
    .click();
  const ticketResponse = await saved;
  assert.equal(ticketResponse.status(), 201);
  const t = await ticketResponse.json();
  ticketId = t.id;
  assert.equal(t.contractId, contractId);
  assert.equal(t.slaSnapshot.hours, 2);
  await page.getByText(new RegExp("Contract " + reason)).waitFor();
  console.log(
    `Agency contract ${engine} manager creation, explicit intake selection and snapshot display passed.`,
  );
} finally {
  await browser?.close();
  if (ticketId)
    await pool.query('DELETE FROM "TravelTicket" WHERE id=$1', [ticketId]);
  if (contractId)
    await pool.query('DELETE FROM "TravelContract" WHERE id=$1', [contractId]);
  await pool.query('DELETE FROM "MembershipAudit" WHERE reason=$1', [reason]);
  await pool.end();
}
