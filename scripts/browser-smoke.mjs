import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import pg from "pg";
import { chromium } from "playwright";

const env = dotenv.parse(
  readFileSync(new URL("../backend/.env", import.meta.url)),
);
const dbUrl = new URL(env.DATABASE_URL);
assert.equal(env.OPSDESK_DEMO, "true", "Use the seeded OpsDesk demo.");
assert.equal(dbUrl.hostname, "127.0.0.1", "Use an isolated local database.");
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const title = `Browser refund follow-up ${randomUUID().slice(0, 8)}`;
const subject = `BK-1042: ${title}`;
let browser;

async function signIn(account, options) {
  const page = await browser.newPage(options);
  page.setDefaultTimeout(10_000);
  await page.goto("http://127.0.0.1:3000");
  await page.getByLabel("Email address").fill(`${account}@opsdesk.demo`);
  await page.getByLabel("Password").fill("OpsDeskDemo!2026");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  return page;
}

async function openCase(page, search, name) {
  await page.getByLabel("Search conversations").fill(search);
  await page.getByRole("button", { name, exact: true }).click();
}

try {
  const channel = process.env.OPSDESK_BROWSER_CHANNEL;
  browser = await chromium.launch(channel ? { channel } : {});

  const manager = await signIn("manager");
  await manager.getByLabel("Filter status").selectOption("OPEN");
  await manager.getByLabel("Filter owner").selectOption("agent-asia");
  await manager.getByLabel("Filter deadline").selectOption("ALL");
  await manager.getByRole("button", { name: /Needs attention/ }).click();
  await manager.getByText("Agent specialties", { exact: true }).click();
  await manager.getByLabel("Maximum active cases (optional)").first().waitFor();
  await manager
    .getByRole("button", { name: "Save specialties" })
    .first()
    .waitFor();
  await manager.getByText("Agency response targets", { exact: true }).click();
  await manager.getByLabel("Atlas Travel (hours)").waitFor();
  await manager.getByRole("button", { name: /All conversations/ }).click();
  await openCase(
    manager,
    "OPS-1042",
    "Hotel voucher not recognized at check-in",
  );
  await manager.getByText("Edit booking schedule", { exact: true }).click();
  await manager.getByLabel("Departure (UTC)").waitFor();
  await manager.getByLabel("Cancellation cutoff (UTC)").waitFor();
  await manager.getByRole("button", { name: "Back to conversations" }).click();

  await manager.getByRole("button", { name: "New ticket" }).click();
  const booking = manager.getByRole("dialog").getByRole("combobox");
  const bookingId = await booking
    .locator("option", { hasText: "BK-1042" })
    .getAttribute("value");
  await booking.selectOption(bookingId);
  await manager.getByLabel("Subject", { exact: true }).fill(title);
  await manager
    .getByLabel("Tell us what happened")
    .fill("Our refund is still pending after earlier contacts.");
  await manager.getByRole("button", { name: "Create & route ticket" }).click();
  await manager.getByRole("heading", { name: title }).waitFor();
  await manager.getByRole("button", { name: /OPS-1042/ }).waitFor();

  await manager.getByRole("button", { name: /Supplier threads/ }).click();
  await manager.getByRole("button", { name: "Contact supplier" }).click();
  await manager
    .getByLabel("Message", { exact: true })
    .fill("Please confirm the status of this refund.");
  await manager
    .getByRole("button", { name: "Send to supplier thread" })
    .click();
  await manager.getByRole("heading", { name: subject }).waitFor();

  const supplier = await signIn("supplier");
  const thread = supplier.getByRole("article").filter({ hasText: subject });
  await thread
    .getByLabel("Supplier reply")
    .fill("The demo refund has been confirmed.");
  await thread.getByRole("button", { name: "Send reply" }).click();
  await thread
    .getByText("The demo refund has been confirmed.", { exact: true })
    .waitFor();
  assert.equal(await supplier.getByLabel("Filter owner").count(), 0);
  await supplier.close();

  await manager.reload();
  await openCase(manager, title, title);
  await manager.getByRole("button", { name: /Supplier threads/ }).click();
  await manager
    .getByText("The demo refund has been confirmed.", { exact: true })
    .waitFor();
  await manager.getByRole("button", { name: /^Conversation/ }).click();
  await manager.getByRole("button", { name: "Draft reply" }).click();
  const draft = await manager.getByLabel("Message content").inputValue();
  assert.match(draft, /booking BK-1042/);
  assert.match(draft, /received an update from the supplier/);
  assert(!draft.includes("The demo refund has been confirmed."));
  const customerThread = manager.locator(".od-thread");
  assert.equal(
    await customerThread.getByText(draft, { exact: true }).count(),
    0,
  );
  assert(
    await manager.getByRole("button", { name: "Send reply" }).isDisabled(),
  );
  const customerReply =
    "We reviewed your refund request and recorded the confirmed outcome.";
  await manager.getByLabel("Message content").fill(customerReply);
  await manager.getByRole("button", { name: "Send reply" }).click();
  await customerThread.getByText(customerReply, { exact: true }).waitFor();
  await manager.getByRole("button", { name: "Resolve case" }).click();
  await manager
    .getByLabel("What was resolved?")
    .fill("Private browser test resolution reason.");
  await manager.getByRole("button", { name: "Save outcome" }).click();
  await manager.getByRole("button", { name: "Reopen case" }).waitFor();
  await manager.close();

  const customer = await signIn("maya", {
    viewport: { width: 390, height: 844 },
  });
  await customer.getByRole("button", { name: /All cases/ }).click();
  await openCase(customer, title, title);
  await customer.getByText(customerReply, { exact: true }).waitFor();
  assert.equal(await customer.getByText("Edit booking schedule").count(), 0);
  assert.equal(
    await customer.getByRole("button", { name: /Supplier threads/ }).count(),
    0,
  );
  await customer.getByRole("button", { name: /Activity/ }).click();
  assert.equal(
    await customer.getByText("Private browser test resolution reason.").count(),
    0,
  );
  await customer.close();

  const agency = await signIn("agency");
  await agency.getByRole("button", { name: /All cases/ }).click();
  await openCase(agency, title, title);
  assert.equal(
    await agency.getByRole("button", { name: /Supplier threads/ }).count(),
    0,
  );
  await agency.close();

  const agent = await signIn("asia");
  await agent.getByRole("button", { name: /All cases/ }).click();
  await openCase(agent, title, title);
  await agent.getByRole("button", { name: /Supplier threads/ }).waitFor();
  assert.equal(await agent.getByText("Edit booking schedule").count(), 0);
  console.log(
    "PASS: five travel roles, booking-linked intake, supplier reply, resolution, private history and manager controls.",
  );
} finally {
  await browser?.close();
  try {
    await pool.query('DELETE FROM "TravelTicket" WHERE title = $1', [title]);
  } finally {
    await pool.end();
  }
}
