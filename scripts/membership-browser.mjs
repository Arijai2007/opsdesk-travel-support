import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { chromium, firefox } from "playwright";

const env = dotenv.parse(
  readFileSync(new URL("../backend/.env", import.meta.url)),
);
assert.equal(env.OPSDESK_DEMO, "true");
assert.equal(new URL(env.DATABASE_URL).hostname, "127.0.0.1");
const url = new URL(process.env.OPSDESK_BROWSER_URL || "http://127.0.0.1:3000");
assert(["127.0.0.1", "localhost"].includes(url.hostname));
const db = new pg.Pool({ connectionString: env.DATABASE_URL });
const email = `browser-${randomUUID()}@opsdesk.demo`;
const password = "BrowserMembership!2026";
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
const engine = process.env.OPSDESK_BROWSER_ENGINE || "chromium";
assert(["chromium", "firefox"].includes(engine));
const channel = process.env.OPSDESK_BROWSER_CHANNEL;
assert(!channel || engine === "chromium");
const browser = await (engine === "firefox" ? firefox : chromium).launch(
  channel ? { channel } : {},
);
let memberId;
async function signIn(account, pass = "OpsDeskDemo!2026") {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(20000);
  await page.goto(url.href);
  await page.getByLabel("Email address").fill(account);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page.getByRole("button", { name: /All cases/ }).waitFor();
  return page;
}
async function picture(page, name) {
  if (process.env.OPSDESK_SCREENSHOT_DIR) {
    await page.screenshot({
      path: resolve(process.env.OPSDESK_SCREENSHOT_DIR, name),
      fullPage: true,
    });
  }
}
try {
  const manager = await signIn("manager@opsdesk.demo");
  await manager.getByRole("button", { name: /Needs attention/ }).click();
  const panel = manager.locator('section[aria-labelledby="membership-title"]');
  await panel
    .getByRole("heading", { name: "Membership administration" })
    .waitFor();
  await panel.getByText("manager@opsdesk.demo", { exact: true }).waitFor();
  await picture(manager, "06-membership-administration.png");
  await panel.getByText("Invite a member", { exact: true }).focus();
  await manager.keyboard.press("Enter");
  const form = panel
    .locator("form")
    .filter({
      has: manager.getByRole("button", {
        name: "Create invitation",
        exact: true,
      }),
    });
  await form.getByLabel("First name", { exact: true }).fill("Browser");
  await form.getByLabel("Last name", { exact: true }).fill("Member");
  await form.getByLabel("Email address", { exact: true }).fill(email);
  await form.getByLabel("Role", { exact: true }).selectOption("CUSTOMER");
  await form
    .getByLabel("Invitation agency", { exact: true })
    .selectOption("atlas");
  await form
    .getByLabel("Reason", { exact: true })
    .fill("Browser invitation regression");
  await form
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  const link = await panel.getByLabel("One-time activation link").inputValue();
  assert.match(new URL(link).hash, /^#token=[a-f0-9]{64}$/);
  memberId = (await db.query('SELECT id FROM "User" WHERE email=$1', [email]))
    .rows[0].id;
  await panel.getByRole("button", { name: "Dismiss invitation link" }).click();
  await panel.getByLabel("Search members", { exact: true }).fill(email);
  await panel.getByText(email, { exact: true }).waitFor();
  await panel
    .getByRole("row")
    .filter({ hasText: email })
    .getByText("Invited", { exact: true })
    .waitFor();

  const activation = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  activation.setDefaultTimeout(20000);
  await activation.goto(link);
  await activation.getByLabel("New password", { exact: true }).waitFor();
  assert.equal(
    new URL(activation.url()).hash,
    "",
    "Fragment must be cleared after capture",
  );
  await activation.getByLabel("New password", { exact: true }).focus();
  await activation.keyboard.press("Tab");
  assert(
    await activation
      .getByLabel("Confirm password", { exact: true })
      .evaluate((el) => document.activeElement === el),
  );
  await picture(activation, "07-member-activation.png");
  await activation.getByLabel("New password", { exact: true }).fill(password);
  await activation
    .getByLabel("Confirm password", { exact: true })
    .fill("Different!2026");
  await activation
    .getByRole("button", { name: "Activate membership", exact: true })
    .click();
  await activation
    .getByRole("alert")
    .filter({ hasText: "Passwords do not match." })
    .waitFor();
  await activation
    .getByLabel("Confirm password", { exact: true })
    .fill(password);
  await activation
    .getByRole("button", { name: "Activate membership", exact: true })
    .click();
  await activation.getByText(/Your membership is active/).waitFor();
  const member = await signIn(email, password);
  assert.equal(
    await member
      .getByRole("heading", { name: "Membership administration" })
      .count(),
    0,
  );
  const denied = await member.evaluate(
    async () => (await fetch("/api/backend/ops/admin/members")).status,
  );
  assert.equal(denied, 403);

  await manager.reload();
  await manager.getByRole("button", { name: /Needs attention/ }).click();
  await panel.getByLabel("Search members", { exact: true }).fill(email);
  const row = panel.getByRole("row").filter({ hasText: email });
  await row.getByRole("button", { name: "Suspend", exact: true }).click();
  const modal = manager.getByRole("dialog", { name: "Suspend membership" });
  await modal.getByLabel("Reason", { exact: true }).focus();
  await manager.keyboard.press("Escape");
  await modal.waitFor({ state: "hidden" });
  assert(
    await row
      .getByRole("button", { name: "Suspend", exact: true })
      .evaluate((el) => document.activeElement === el),
  );
  await manager.keyboard.press("Enter");
  await modal
    .getByLabel("Reason", { exact: true })
    .fill("Browser suspension regression");
  await modal
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await row.getByText("Suspended", { exact: true }).waitFor();
  assert.equal(
    await member.evaluate(
      async () => (await fetch("/api/backend/ops/workspace?compact=1")).status,
    ),
    401,
  );
  await row.getByRole("button", { name: "Reactivate", exact: true }).click();
  const reactivate = manager.getByRole("dialog", {
    name: "Reactivate membership",
  });
  await reactivate
    .getByLabel("Reason", { exact: true })
    .fill("Browser reactivation regression");
  await reactivate
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await row.getByText("Active", { exact: true }).waitFor();
  await signIn(email, password);
  await manager.setViewportSize({ width: 390, height: 844 });
  await panel.scrollIntoViewIfNeeded();
  await picture(manager, "08-membership-mobile.png");
  console.log(
    `PASS: ${engine} manager invitation, fragment clearing, password validation, activation, member privacy, suspension and reactivation.`,
  );
} finally {
  await browser.close();
  if (!memberId)
    memberId = (await db.query('SELECT id FROM "User" WHERE email=$1', [email]))
      .rows[0]?.id;
  if (memberId) {
    const hashes = (
      await db.query(
        'SELECT "tokenHash" FROM "TravelInvitation" WHERE "memberId"=$1',
        [memberId],
      )
    ).rows;
    await db.query('DELETE FROM "OpsCounter" WHERE key=ANY($1::text[])', [
      hashes.flatMap((row) => rateKeys.map((key) => `${key}:${row.tokenHash}`)),
    ]);
    await db.query(
      'DELETE FROM "MembershipAudit" WHERE "entityId"=$1 OR "actorId"=$1',
      [memberId],
    );
    await db.query('DELETE FROM "TravelInvitation" WHERE "memberId"=$1', [
      memberId,
    ]);
    await db.query('DELETE FROM "TravelProfile" WHERE "userId"=$1', [memberId]);
    await db.query('DELETE FROM "User" WHERE id=$1', [memberId]);
  }
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
