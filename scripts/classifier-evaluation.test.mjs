import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readLabelledDataset, scoreDataset } from "./classifier-evaluation.mjs";

const labels = [
  "REFUND",
  "CANCELLATION",
  "BOOKING_CHANGE",
  "CHECK_IN",
  "BAGGAGE",
  "OTHER",
];
const texts = [
  "Refund the bus fare.",
  "Cancel the boat trip.",
  "Reschedule the ferry.",
  "Check-in has failed again.",
  "My luggage is damaged.",
  "Please send a receipt.",
];
const fixture = () => ({
  version: 1,
  name: "Synthetic evaluator test only",
  source: "unit-test",
  labelledBy: "test fixture; not independent review",
  labelledAt: "2026-11-11T00:00:00.000Z",
  reviewNotes: "Only verifies tooling. Not acceptance evidence.",
  examples: labels.map((label, i) => ({
    id: `test-${i}`,
    text: texts[i],
    label,
    rationale: "Test fixture.",
  })),
});

test("requires complete labels, rationale, provenance and all six categories", () => {
  assert.equal(readLabelledDataset(fixture(), labels).examples.length, 6);
  for (const key of [
    "name",
    "source",
    "labelledBy",
    "labelledAt",
    "reviewNotes",
  ]) {
    const input = fixture();
    input[key] = "";
    assert.throws(() => readLabelledDataset(input, labels), /requires/);
  }
  for (const [key, value] of [
    ["label", ""],
    ["label", "UNKNOWN"],
    ["rationale", " "],
    ["text", null],
  ]) {
    const input = fixture();
    input.examples[0][key] = value;
    assert.throws(() => readLabelledDataset(input, labels), /requires/);
  }
  const input = fixture();
  input.examples.pop();
  assert.throws(
    () => readLabelledDataset(input, labels),
    /no examples for OTHER/,
  );
  assert.throws(
    () => readLabelledDataset({ ...input, examples: [] }, labels),
    /non-empty/,
  );
});

test("rejects invalid calendar timestamps and unsupported versions", () => {
  for (const labelledAt of ["yesterday", "2026-02-30T00:00:00.000Z"])
    assert.throws(
      () => readLabelledDataset({ ...fixture(), labelledAt }, labels),
      /valid ISO/,
    );
  assert.throws(
    () => readLabelledDataset({ ...fixture(), version: 2 }, labels),
    /version 1/,
  );
});

test("rejects duplicate IDs and Unicode/whitespace-equivalent complaints", () => {
  const input = fixture();
  input.examples[1].id = " test-0 ";
  assert.throws(() => readLabelledDataset(input, labels), /Duplicate/);
  input.examples[1].id = "unique";
  input.examples[1].text = "  ＲＥＦＵＮＤ  the bus fare.\n";
  assert.throws(() => readLabelledDataset(input, labels), /Duplicate/);
});

test("rejects overlap with the existing synthetic development and holdout fixtures", () => {
  for (const file of [
    "./travel-classifier-cases.json",
    "./travel-classifier-holdout.json",
  ]) {
    const rows = JSON.parse(
      readFileSync(new URL(file, import.meta.url), "utf8"),
    );
    const input = fixture();
    input.examples[0].text = `  ${rows[0][1].toUpperCase()}\n`;
    assert.throws(
      () =>
        readLabelledDataset(
          input,
          labels,
          rows.map((row) => row[1]),
        ),
      /overlaps/,
    );
  }
});

test("scores a known confusion matrix and counts an unpredicted category as zero", () => {
  const rows = [
    { id: "1", label: "A", text: "A" },
    { id: "2", label: "A", text: "B" },
    { id: "3", label: "B", text: "B" },
    { id: "4", label: "C", text: "B" },
  ];
  const result = scoreDataset(rows, ["A", "B", "C"], (text) => text);
  assert.equal(result.accuracy, 0.5);
  assert.deepEqual(result.confusion, {
    A: { A: 1, B: 1, C: 0 },
    B: { A: 0, B: 1, C: 0 },
    C: { A: 0, B: 1, C: 0 },
  });
  assert.equal(result.perCategory.B.precision, 1 / 3);
  assert.equal(result.perCategory.B.recall, 1);
  assert.equal(result.perCategory.C.f1, 0);
  assert.ok(Math.abs(result.macroF1 - (2 / 3 + 0.5) / 3) < 1e-12);
  assert.deepEqual(result.errors, [
    { id: "2", expected: "A", predicted: "B" },
    { id: "4", expected: "C", predicted: "B" },
  ]);
  assert.throws(
    () => scoreDataset(rows, ["A", "B", "C"], () => "UNKNOWN"),
    /unknown category/,
  );
});

test("CLI evaluates a local file, hashes its bytes and rules, and rejects incompatible flags", () => {
  const dir = mkdtempSync(join(tmpdir(), "opsdesk-evaluation-"));
  try {
    const path = join(dir, "reviewed.json");
    const bytes = JSON.stringify(fixture());
    writeFileSync(path, bytes);
    const require = createRequire(
      new URL("../backend/package.json", import.meta.url),
    );
    const cli = fileURLToPath(
      new URL("./evaluate-travel-classifier.ts", import.meta.url),
    );
    const run = (args) =>
      spawnSync(process.execPath, [require.resolve("tsx/cli"), cli, ...args], {
        encoding: "utf8",
      });
    const output = run(["--dataset", path, "--json"]);
    assert.equal(output.status, 0, output.stderr);
    const report = JSON.parse(output.stdout);
    assert.equal(report.total, 6);
    assert.equal(report.correct, 6);
    assert.equal(
      report.datasetSha256,
      createHash("sha256").update(bytes).digest("hex"),
    );
    assert.equal(
      report.classifierSha256,
      createHash("sha256")
        .update(
          readFileSync(
            new URL("../backend/src/travel/travel.rules.ts", import.meta.url),
          ),
        )
        .digest("hex"),
    );
    assert.match(report.acceptance, /Not determined/);
    assert.ok(
      !output.stdout.includes(texts[0]),
      "Report should identify errors without copying complaint text",
    );
    assert.equal(run(["--dataset", path, "--check"]).status, 1);
    assert.equal(run(["--dataset"]).status, 1);
    const incomplete = fixture();
    incomplete.examples[0].label = "";
    writeFileSync(path, JSON.stringify(incomplete));
    const invalid = run(["--dataset", path, "--json"]);
    assert.equal(invalid.status, 1);
    assert.equal(invalid.stdout, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
