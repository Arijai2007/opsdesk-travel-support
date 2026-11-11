import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { chromium, firefox } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { createReviewServer } from "./review-classifier.mjs";
import { readLabelledDataset } from "./classifier-evaluation.mjs";

const categories = [
  "REFUND",
  "CANCELLATION",
  "BOOKING_CHANGE",
  "CHECK_IN",
  "BAGGAGE",
  "OTHER",
];
async function start() {
  const server = createReviewServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
async function stop(server) {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
const contents = async (download) =>
  JSON.parse(readFileSync(await download.path(), "utf8"));

test("review server only serves its fixed read-only assets", async () => {
  const { server, url } = await start();
  try {
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(
      page.headers.get("content-security-policy"),
      /connect-src 'self'/,
    );
    assert.equal(page.headers.get("cache-control"), "no-store");
    const starter = await (await fetch(url + "/starter.json")).json();
    assert.equal(starter.examples.length, 18);
    assert(starter.examples.every((row) => !row.label && !row.rationale));
    assert.equal((await fetch(url + "/backend/.env")).status, 404);
    assert.equal((await fetch(url + "/travel.rules.ts")).status, 404);
    assert.equal(
      (await fetch(url + "/", { method: "POST", body: "private text" })).status,
      405,
    );
  } finally {
    await stop(server);
  }
});

test("blind review preserves drafts, rejects malformed imports and exports a validated dataset", async () => {
  const { server, url } = await start();
  const engine = process.env.OPSDESK_BROWSER_ENGINE || "chromium";
  assert(["chromium", "firefox"].includes(engine));
  let browser;
  try {
    browser = await (engine === "firefox" ? firefox : chromium).launch();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 960 },
    });
    const page = await context.newPage();
    const requests = [];
    page.on("request", (request) =>
      requests.push({ url: request.url(), method: request.method() }),
    );
    await page.goto(url);
    await page.getByText("0 of 18 complete", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Download reviewed dataset", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page.getByLabel("Primary category", { exact: true }).inputValue(),
      "",
    );
    assert.deepEqual(
      await page
        .getByLabel("Primary category", { exact: true })
        .locator("option")
        .evaluateAll((rows) => rows.slice(1).map((row) => row.value)),
      categories,
    );
    let axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(axe.violations, []);

    // Only artificial test data is labelled here. The real blind pack remains blank.
    const input = {
      version: 1,
      name: "Synthetic form test only",
      source: "automated UI test; not independent evidence",
      labelledBy: "",
      labelledAt: "",
      reviewNotes: "",
      examples: categories.map((label, i) => ({
        id: `form-test-${i}`,
        text: `Synthetic form request ${i}`,
        label: "",
        rationale: "",
      })),
    };
    input.examples[0].text =
      '<img src="https://invalid.example/private" onerror="alert(1)">';
    const upload = (data) =>
      page.getByLabel("Import JSON draft or dataset").setInputFiles({
        name: "review.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(data)),
      });
    await upload(input);
    await page.getByText("0 of 6 complete", { exact: true }).waitFor();
    assert.equal(await page.locator("#complaint img").count(), 0);
    assert.equal(
      await page.locator("#complaint").textContent(),
      input.examples[0].text,
    );

    await page
      .getByLabel("Primary category", { exact: true })
      .selectOption(categories[0]);
    await page
      .getByLabel("Why this label?", { exact: true })
      .fill("Synthetic test rationale zero.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    assert.equal(
      await page
        .locator("#example-heading")
        .evaluate((node) => node === document.activeElement),
      true,
    );
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    assert.equal(
      await page.getByLabel("Primary category", { exact: true }).inputValue(),
      categories[0],
    );
    assert.equal(
      await page.getByLabel("Why this label?", { exact: true }).inputValue(),
      "Synthetic test rationale zero.",
    );

    const draftDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download draft", exact: true })
      .click();
    const draft = await contents(await draftDownload);
    assert.equal(draft.examples[0].label, categories[0]);
    assert.equal(draft.examples[1].label, "");
    assert.equal(draft.labelledBy, "");
    await upload({ ...input, examples: [] });
    await page
      .getByRole("status")
      .filter({ hasText: "Import failed" })
      .waitFor();
    assert.equal(
      await page.getByLabel("Primary category", { exact: true }).inputValue(),
      categories[0],
    );

    for (let i = 1; i < categories.length; i++) {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page
        .getByLabel("Primary category", { exact: true })
        .selectOption(categories[i]);
      await page
        .getByLabel("Why this label?", { exact: true })
        .fill(`Synthetic test rationale ${i}.`);
    }
    await page
      .getByLabel("Reviewer identifier", { exact: true })
      .fill("automated-test-not-a-human-review");
    await page
      .getByLabel("Review notes", { exact: true })
      .fill(
        "Synthetic browser test only. No independent acceptance is claimed.",
      );
    assert.equal(
      await page
        .getByRole("button", { name: "Download reviewed dataset", exact: true })
        .isDisabled(),
      true,
    );
    await page
      .getByLabel(
        "I assigned these labels without viewing classifier predictions.",
        { exact: true },
      )
      .check();
    await page
      .getByLabel("Primary category", { exact: true })
      .selectOption("BAGGAGE");
    assert.equal(
      await page
        .getByRole("button", {
          name: "Download reviewed dataset",
          exact: true,
        })
        .isDisabled(),
      true,
    );
    assert.match(
      await page.locator("#export-reason").textContent(),
      /no examples for OTHER/,
    );
    await page
      .getByLabel("Primary category", { exact: true })
      .selectOption("OTHER");
    assert.equal(
      await page
        .getByRole("button", { name: "Download reviewed dataset", exact: true })
        .isEnabled(),
      true,
    );
    const reviewedDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download reviewed dataset", exact: true })
      .click();
    const reviewed = await contents(await reviewedDownload);
    readLabelledDataset(reviewed, categories);
    assert.equal(reviewed.examples.length, 6);
    assert.match(reviewed.reviewNotes, /Reviewer attestation:/);
    assert.equal(reviewed.source, input.source);

    await upload(draft);
    await page.getByText("1 of 6 complete", { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel("Why this label?", { exact: true }).inputValue(),
      "Synthetic test rationale zero.",
    );
    await page
      .getByLabel("Why this label?", { exact: true })
      .fill("Unsaved change.");
    const replacementDismissed = page
      .waitForEvent("dialog")
      .then((dialog) => dialog.dismiss());
    await upload(input);
    await replacementDismissed;
    await page.waitForFunction(
      () => document.querySelector("#import").value === "",
    );
    assert.equal(
      await page.getByLabel("Why this label?", { exact: true }).inputValue(),
      "Unsaved change.",
    );
    await page.setViewportSize({ width: 375, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(axe.violations, []);
    assert(
      requests.every(
        (request) =>
          request.method === "GET" && new URL(request.url).origin === url,
      ),
      "Imports and exports must not submit text or contact external hosts",
    );
  } finally {
    if (browser) await browser.close();
    await stop(server);
  }
});
