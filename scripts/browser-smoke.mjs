import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import pg from "pg";
import { chromium, firefox } from "playwright";

const env = dotenv.parse(
  readFileSync(new URL("../backend/.env", import.meta.url)),
);
const dbUrl = new URL(env.DATABASE_URL);
const browserUrl = new URL(
  process.env.OPSDESK_BROWSER_URL || "http://127.0.0.1:3000",
);
assert(
  ["127.0.0.1", "localhost"].includes(browserUrl.hostname),
  "Use a local browser test target",
);
assert.equal(browserUrl.username, "");
assert.equal(browserUrl.password, "");
assert.equal(env.OPSDESK_DEMO, "true", "Use the seeded OpsDesk demo.");
assert.equal(dbUrl.hostname, "127.0.0.1", "Use an isolated local database.");
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const title = `Browser refund follow-up ${randomUUID().slice(0, 8)}`;
const subject = `BK-1042: ${title}`;
let browser;
const opsReads = [];

async function signIn(account, options) {
  const page = await browser.newPage(options);
  page.setDefaultTimeout(10_000);
  page.on("request", (request) => {
    if (
      request.method() === "GET" &&
      request.url().includes("/api/backend/ops/")
    )
      opsReads.push(request.url());
  });
  await page.goto(browserUrl.href);
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
  const engine = process.env.OPSDESK_BROWSER_ENGINE || "chromium";
  assert(
    ["chromium", "firefox"].includes(engine),
    "Choose chromium or firefox",
  );
  assert(
    !channel || engine === "chromium",
    "Browser channels require Chromium",
  );
  const browserType = engine === "firefox" ? firefox : chromium;
  browser = await browserType.launch(channel ? { channel } : {});

  const manager = await signIn("manager");
  await manager.getByRole("button", { name: /All cases/ }).waitFor();
  const context = manager.context();
  const original = (await context.cookies()).find(
    (cookie) => cookie.name === "hd_refresh_token",
  );
  assert(original, "Manager sign-in must set the refresh cookie");
  const refreshUrl = new URL("/api/auth/refresh", manager.url()).href;
  const rotatedStatus = await manager.evaluate(async (url) => {
    const response = await fetch(url, { method: "POST" });
    return response.status;
  }, refreshUrl);
  assert.equal(rotatedStatus, 200);
  const replay = await context.request.post(refreshUrl, {
    headers: { Cookie: `${original.name}=${original.value}` },
  });
  assert.equal(replay.status(), 401);
  assert.equal(
    replay.headers()["set-cookie"],
    undefined,
    "A stale refresh response must preserve the browser's replacement cookies",
  );
  await manager.getByRole("button", { name: /All cases/ }).click();
  await manager.getByRole("button", { name: "Next page" }).click();
  await manager.getByText(/^Page 2 of /).waitFor();
  await manager.getByRole("button", { name: "Previous page" }).click();
  await manager.getByText(/^Page 1 of /).waitFor();
  await manager.getByLabel("Filter status").selectOption("OPEN");
  await manager
    .getByLabel("Filter owner", { exact: true })
    .selectOption("agent-asia");
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

  // Exercise native modal focus containment, accessible naming and restoration.
  const opener = manager.getByRole("button", {
    name: "New ticket",
    exact: true,
  });
  await opener.click();
  const namedDialog = manager.getByRole("dialog", {
    name: "Start a conversation",
    exact: true,
  });
  await namedDialog.waitFor();
  const closeDialog = namedDialog.getByRole("button", { name: "Close dialog" });
  await closeDialog.focus();
  await manager.keyboard.press("Shift+Tab");
  assert(
    await namedDialog.evaluate((dialog) =>
      dialog.contains(document.activeElement),
    ),
    "Reverse Tab must remain in the modal",
  );
  assert(
    !(await closeDialog.evaluate(
      (button) => button === document.activeElement,
    )),
  );
  await manager.keyboard.press("Tab");
  assert(
    await closeDialog.evaluate((button) => button === document.activeElement),
    "Forward Tab from the last control must wrap to the first",
  );
  for (let i = 0; i < 16; i++) {
    await manager.keyboard.press("Tab");
    assert(
      await namedDialog.evaluate((dialog) =>
        dialog.contains(document.activeElement),
      ),
      "Tab focus must remain in the modal",
    );
  }
  await manager.keyboard.press("Escape");
  await namedDialog.waitFor({ state: "hidden" });
  assert(
    await opener.evaluate((button) => button === document.activeElement),
    "Escape must return focus to the opener",
  );
  await opener.click();
  await namedDialog.getByRole("button", { name: "Close dialog" }).click();
  await namedDialog.waitFor({ state: "hidden" });
  assert(
    await opener.evaluate((button) => button === document.activeElement),
    "Close button must restore opener focus",
  );
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
  assert.equal(
    await supplier.getByLabel("Filter owner", { exact: true }).count(),
    0,
  );
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
  // Exercise actual browser page navigation with a history larger than one page.
  const testCase = (
    await pool.query('SELECT id FROM "TravelTicket" WHERE title = $1', [title])
  ).rows[0];
  for (let i = 0; i < 23; i++) {
    await pool.query(
      'INSERT INTO "TravelMessage" (id, "ticketId", "senderId", visibility, content, "createdAt") VALUES ($1,$2,$3,$4,$5,$6)',
      [
        randomUUID(),
        testCase.id,
        "agent-asia",
        "CUSTOMER",
        `Browser pagination message ${i}`,
        new Date(Date.now() + i * 1000),
      ],
    );
  }
  const noticeText = `Browser test escalation for ${title}`;
  await pool.query(
    `INSERT INTO "TravelEvent" (id, "ticketId", kind, text, "actorId", "createdAt")
     SELECT $1, $2, 'ESCALATED', $3, 'system',
       greatest(max("createdAt"), now() AT TIME ZONE 'UTC') + interval '1 millisecond'
     FROM "TravelEvent"`,
    [randomUUID(), testCase.id, noticeText],
  );
  await manager.reload();
  const bell = manager.getByRole("button", {
    name: "Notifications",
    exact: true,
  });
  await bell.click();
  const acknowledge = manager.getByRole("button", {
    name: `Acknowledge: ${noticeText}`,
    exact: true,
  });
  await acknowledge.press("Enter");
  await manager.getByText("Alert acknowledged.", { exact: true }).waitFor();
  await acknowledge.waitFor({ state: "hidden" });
  assert(await bell.evaluate((element) => element === document.activeElement));
  await bell.click();
  assert.equal(await acknowledge.count(), 0);
  await bell.click();
  await openCase(manager, title, title);
  await manager
    .getByRole("button", { name: "Older messages", exact: true })
    .click();
  await manager
    .getByRole("navigation", { name: "messages pagination", exact: true })
    .getByText(/Page 2 of 2/)
    .waitFor();
  await manager.getByText(customerReply, { exact: true }).waitFor();
  await manager
    .getByRole("button", { name: "Newer messages", exact: true })
    .click();
  await manager
    .getByText("Browser pagination message 22", { exact: true })
    .waitFor();
  await manager.getByRole("button", { name: "Resolve case" }).click();
  await manager
    .getByLabel("What was resolved?")
    .fill("Private browser test resolution reason.");
  await manager.getByRole("button", { name: "Save outcome" }).click();
  await manager.getByRole("button", { name: "Reopen case" }).waitFor();
  await manager.getByRole("button", { name: "Insights" }).click();
  await manager.getByText("Median first response", { exact: true }).waitFor();
  await manager
    .getByRole("heading", { name: "Supplier performance" })
    .waitFor();
  await manager.close();

  const customer = await signIn("maya", {
    viewport: { width: 390, height: 844 },
  });
  await customer.getByRole("button", { name: /All cases/ }).click();
  await openCase(customer, title, title);
  await customer
    .getByRole("button", { name: "Older messages", exact: true })
    .click();
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
  assert(
    opsReads.some(
      (url) => url.includes("/tickets/") && url.includes("/messages"),
    ),
  );
  assert(
    opsReads.some(
      (url) => url.includes("/conversations/") && url.includes("/messages"),
    ),
  );
  assert(
    opsReads
      .filter((url) => url.includes("/workspace"))
      .every((url) => url.includes("compact=1")),
    "Browser must never load the full workspace snapshot",
  );
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
