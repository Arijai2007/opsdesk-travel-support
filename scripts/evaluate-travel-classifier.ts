import { readFileSync } from 'node:fs';
import { CATEGORIES, classify } from '../backend/src/travel/travel.rules';

const fixture =
  process.argv[2] === '--holdout'
    ? './travel-classifier-holdout.json'
    : './travel-classifier-cases.json';
const input: unknown = JSON.parse(
  readFileSync(new URL(fixture, import.meta.url), 'utf8'),
);
if (!Array.isArray(input) || input.length === 0)
  throw new Error('Expected a non-empty evaluation fixture.');

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
    typeof item[0] !== 'string' ||
    typeof item[1] !== 'string' ||
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
