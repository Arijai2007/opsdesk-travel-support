// Evaluation inputs are reviewer declarations, not proof of independent labelling.
export const normalizeComplaint = (text) =>
  text
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/\s+/gu, " ");

export function readLabelledDataset(input, labels, excludedTexts = []) {
  if (
    !input ||
    input.version !== 1 ||
    !Array.isArray(input.examples) ||
    !input.examples.length
  )
    throw new Error("Expected a version 1 dataset with non-empty examples.");
  for (const key of [
    "name",
    "source",
    "labelledBy",
    "labelledAt",
    "reviewNotes",
  ]) {
    if (typeof input[key] !== "string" || !input[key].trim())
      throw new Error(`Dataset requires ${key}.`);
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.labelledAt) ||
    !Number.isFinite(Date.parse(input.labelledAt)) ||
    new Date(input.labelledAt).toISOString() !== input.labelledAt
  )
    throw new Error(
      "labelledAt must be a valid ISO UTC timestamp with milliseconds.",
    );
  const ids = new Set();
  const texts = new Set();
  const excluded = new Set(excludedTexts.map(normalizeComplaint));
  for (const [index, row] of input.examples.entries()) {
    if (
      !row ||
      ["id", "text", "rationale"].some(
        (key) => typeof row[key] !== "string" || !row[key].trim(),
      )
    )
      throw new Error(
        `Row ${index + 1} requires id, text and reviewer rationale.`,
      );
    if (!labels.includes(row.label))
      throw new Error(`Row ${index + 1} requires a valid label.`);
    const id = row.id.trim();
    const text = normalizeComplaint(row.text);
    if (ids.has(id) || texts.has(text))
      throw new Error(`Duplicate ID or complaint at row ${index + 1}.`);
    if (excluded.has(text))
      throw new Error(
        `Row ${index + 1} overlaps an existing synthetic fixture.`,
      );
    ids.add(id);
    texts.add(text);
  }
  for (const label of labels) {
    if (!input.examples.some((row) => row.label === label))
      throw new Error(`Dataset has no examples for ${label}.`);
  }
  return input;
}

export function scoreDataset(examples, labels, classify) {
  const confusion = Object.fromEntries(
    labels.map((expected) => [
      expected,
      Object.fromEntries(labels.map((predicted) => [predicted, 0])),
    ]),
  );
  const errors = [];
  let correct = 0;
  for (const row of examples) {
    const predicted = classify(row.text);
    if (!labels.includes(predicted))
      throw new Error(`Classifier returned unknown category: ${predicted}`);
    confusion[row.label][predicted]++;
    if (predicted === row.label) correct++;
    else errors.push({ id: row.id, expected: row.label, predicted });
  }
  const perCategory = Object.fromEntries(
    labels.map((label) => {
      const support = labels.reduce((sum, p) => sum + confusion[label][p], 0);
      const predicted = labels.reduce((sum, e) => sum + confusion[e][label], 0);
      const truePositive = confusion[label][label];
      const precision = predicted ? truePositive / predicted : 0;
      const recall = support ? truePositive / support : 0;
      const f1 =
        precision + recall
          ? (2 * precision * recall) / (precision + recall)
          : 0;
      return [
        label,
        { support, predicted, correct: truePositive, precision, recall, f1 },
      ];
    }),
  );
  return {
    total: examples.length,
    correct,
    accuracy: correct / examples.length,
    macroF1:
      labels.reduce((sum, label) => sum + perCategory[label].f1, 0) /
      labels.length,
    perCategory,
    confusion,
    errors,
  };
}
