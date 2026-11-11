import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { readLabelledDataset, scoreDataset } from "./classifier-evaluation.mjs";
import { CATEGORIES, classify } from "../backend/src/travel/travel.rules";

const flags = process.argv.slice(2);
if (flags.includes("--dataset")) {
  const index = flags.indexOf("--dataset");
  const path = flags[index + 1];
  const remaining = flags.filter((_, i) => i !== index && i !== index + 1);
  if (
    !path ||
    path.startsWith("--") ||
    remaining.some((flag) => flag !== "--json") ||
    remaining.filter((flag) => flag === "--json").length > 1
  )
    throw new Error(
      "Usage: npm run ops:evaluate-classifier -- --dataset PATH [--json]",
    );
  const bytes = readFileSync(
    resolve(process.env.INIT_CWD || process.cwd(), path),
  );
  const excluded = [
    "./travel-classifier-cases.json",
    "./travel-classifier-holdout.json",
  ].flatMap((file) =>
    JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8")).map(
      (row: string[]) => row[1],
    ),
  );
  const dataset = readLabelledDataset(
    JSON.parse(bytes.toString("utf8")),
    CATEGORIES,
    excluded,
  );
  const report = {
    kind: "reviewer-labelled-evaluation",
    evaluatedAt: new Date().toISOString(),
    nodeVersion: process.version,
    dataset: Object.fromEntries(
      ["name", "source", "labelledBy", "labelledAt", "reviewNotes"].map(
        (key) => [key, dataset[key]],
      ),
    ),
    datasetSha256: createHash("sha256").update(bytes).digest("hex"),
    classifierSha256: createHash("sha256")
      .update(
        readFileSync(
          new URL("../backend/src/travel/travel.rules.ts", import.meta.url),
        ),
      )
      .digest("hex"),
    ...scoreDataset(dataset.examples, CATEGORIES, classify),
    acceptance:
      "Not determined. Provenance is reviewer-declared; human review and agreed targets are required.",
  };
  if (remaining.includes("--json"))
    console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Dataset: ${dataset.name} (${report.datasetSha256})`);
    console.log(
      `Labels declared by: ${dataset.labelledBy} at ${dataset.labelledAt}`,
    );
    console.log(
      `Accuracy: ${report.correct}/${report.total} (${(report.accuracy * 100).toFixed(1)}%)`,
    );
    console.log(`Macro F1: ${report.macroF1.toFixed(3)}`);
    console.table(report.perCategory);
    console.log("Confusion matrix: rows = expected, columns = predicted");
    console.table(report.confusion);
    console.table(report.errors);
    console.log(report.acceptance);
  }
} else {
  if (flags.some((flag) => flag !== "--holdout" && flag !== "--check"))
    throw new Error(
      "Usage: npm run ops:evaluate-classifier -- [--holdout] [--check] OR --dataset PATH [--json]",
    );
  const holdout = flags.includes("--holdout");
  const fixture = holdout
    ? "./travel-classifier-holdout.json"
    : "./travel-classifier-cases.json";
  const input: unknown = JSON.parse(
    readFileSync(new URL(fixture, import.meta.url), "utf8"),
  );
  if (!Array.isArray(input) || input.length === 0)
    throw new Error("Expected a non-empty evaluation fixture.");

  const counts = new Map(
    CATEGORIES.map((label) => [label, { total: 0, correct: 0 }]),
  );
  const seen = new Set<string>();
  const errors: { expected: string; predicted: string; example: number }[] = [];
  let correct = 0;

  for (const [index, item] of input.entries()) {
    if (
      !Array.isArray(item) ||
      item.length !== 2 ||
      typeof item[0] !== "string" ||
      typeof item[1] !== "string" ||
      !item[1].trim()
    )
      throw new Error(`Invalid fixture row ${index + 1}.`);
    const [expected, complaint] = item;
    const stats = counts.get(expected);
    if (!stats) throw new Error(`Unknown category at row ${index + 1}.`);
    const normalized = complaint.trim().toLowerCase();
    if (seen.has(normalized))
      throw new Error(`Duplicate complaint at row ${index + 1}.`);
    seen.add(normalized);
    const predicted = classify(complaint);
    stats.total++;
    if (predicted === expected) {
      stats.correct++;
      correct++;
    } else {
      errors.push({ expected, predicted, example: index + 1 });
    }
  }

  for (const [label, stats] of counts) {
    if (!stats.total) throw new Error(`Fixture has no examples for ${label}.`);
    console.log(`${label}: ${stats.correct}/${stats.total}`);
  }
  console.log(
    `Accuracy: ${correct}/${input.length} (${((correct / input.length) * 100).toFixed(1)}%)`,
  );
  for (const { example, expected, predicted } of errors)
    console.log(`Row ${example}: expected ${expected}, predicted ${predicted}`);

  if (flags.includes("--check")) {
    const expectedSize = holdout ? 18 : 30;
    const minimumCorrect = holdout ? 17 : 27;
    if (input.length !== expectedSize || correct < minimumCorrect) {
      console.error(
        `Expected at least ${minimumCorrect} correct on the fixed ${expectedSize}-case fixture.`,
      );
      process.exitCode = 1;
    }
  }
}
