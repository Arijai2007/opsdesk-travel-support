import { readLabelledDataset } from "/validation.mjs";

const categories = [
  "REFUND",
  "CANCELLATION",
  "BOOKING_CHANGE",
  "CHECK_IN",
  "BAGGAGE",
  "OTHER",
];
const $ = (id) => document.getElementById(id);
let dataset;
let selected = 0;
let dirty = false;
const attestation =
  "Reviewer attestation: I assigned these labels without viewing classifier predictions.";

function parseDraft(input) {
  if (
    !input ||
    input.version !== 1 ||
    !Array.isArray(input.examples) ||
    !input.examples.length
  )
    throw new Error("Choose a version 1 JSON dataset with examples.");
  for (const key of [
    "name",
    "source",
    "labelledBy",
    "labelledAt",
    "reviewNotes",
  ])
    if (typeof input[key] !== "string")
      throw new Error(`Dataset requires a string ${key}.`);
  const ids = new Set();
  for (const row of input.examples) {
    if (
      !row ||
      ["id", "text", "label", "rationale"].some(
        (key) => typeof row[key] !== "string",
      ) ||
      !row.id.trim() ||
      !row.text.trim() ||
      (row.label && !categories.includes(row.label))
    )
      throw new Error(
        "Each example needs an ID, text, a blank or valid label, and a rationale field.",
      );
    if (ids.has(row.id.trim())) throw new Error("Example IDs must be unique.");
    ids.add(row.id.trim());
  }
  // Preserve only the review schema; imported text is always rendered as text.
  return {
    version: 1,
    name: input.name,
    source: input.source,
    labelledBy: input.labelledBy,
    labelledAt: input.labelledAt,
    reviewNotes: input.reviewNotes,
    examples: input.examples.map(({ id, text, label, rationale }) => ({
      id,
      text,
      label,
      rationale,
    })),
  };
}

function reviewed() {
  const result = structuredClone(dataset);
  result.labelledAt = new Date().toISOString();
  if (!result.reviewNotes.includes(attestation))
    result.reviewNotes += `\n${attestation}`;
  return readLabelledDataset(result, categories);
}

function update() {
  const complete = (row) => row.label && row.rationale.trim();
  const count = dataset.examples.filter(complete).length;
  $("completion").textContent =
    `${count} of ${dataset.examples.length} complete`;
  $("progress").max = dataset.examples.length;
  $("progress").value = count;
  [...$("example-select").options].forEach((option, i) => {
    option.textContent = `${i + 1} · ${dataset.examples[i].id}${complete(dataset.examples[i]) ? " · complete" : ""}`;
  });
  let reason;
  try {
    if (count !== dataset.examples.length)
      throw new Error(
        `${dataset.examples.length - count} examples still need a category and rationale.`,
      );
    for (const [key, title] of Object.entries({
      name: "a dataset name",
      source: "the source and usage rights",
      labelledBy: "a reviewer identifier",
    }))
      if (!dataset[key].trim()) throw new Error(`Add ${title}.`);
    // Validate the typed notes before adding the attestation text.
    if (!dataset.reviewNotes.trim())
      throw new Error(
        "Add review notes, including rubric and adjudication details.",
      );
    reviewed();
    if (!$("attestation").checked)
      throw new Error(
        "Confirm that labels were assigned without viewing predictions.",
      );
    reason =
      "Ready to export. The review timestamp will be set when you download.";
    $("export").disabled = false;
  } catch (error) {
    reason = error.message;
    $("export").disabled = true;
  }
  $("export-reason").textContent = reason;
}

function showExample(focus = false) {
  const row = dataset.examples[selected];
  $("example-select").value = String(selected);
  $("example-heading").textContent =
    `Example ${selected + 1} of ${dataset.examples.length}`;
  $("example-id").textContent = row.id;
  $("complaint").textContent = row.text;
  $("label").value = row.label;
  $("rationale").value = row.rationale;
  $("previous").disabled = selected === 0;
  $("next").disabled = selected === dataset.examples.length - 1;
  if (focus) $("example-heading").focus();
}

function load(input) {
  const parsed = parseDraft(input);
  if (
    dirty &&
    !confirm(
      "Replace the current review? Download a draft first if you want to keep your changes.",
    )
  )
    return;
  dataset = parsed;
  selected = 0;
  dirty = false;
  $("attestation").checked = false;
  for (const [id, key] of Object.entries({
    name: "name",
    source: "source",
    reviewer: "labelledBy",
    notes: "reviewNotes",
  }))
    $(id).value = dataset[key];
  $("example-select").replaceChildren(
    ...dataset.examples.map((row, i) => {
      const option = document.createElement("option");
      option.value = String(i);
      return option;
    }),
  );
  $("workspace").hidden = false;
  $("draft").disabled = false;
  $("status").textContent =
    `Loaded ${dataset.examples.length} examples. No predictions were generated.`;
  showExample();
  update();
}

async function loadStarter() {
  try {
    const response = await fetch("/starter.json");
    if (!response.ok) throw new Error("The starter could not be loaded.");
    load(await response.json());
  } catch (error) {
    $("status").textContent = error.message;
  }
}

function download(value, filename) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  dirty = false;
  $("status").textContent =
    `Downloaded ${filename}. Keep review files out of Git.`;
}

$("starter").addEventListener("click", loadStarter);
$("import").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024)
      throw new Error("Choose a JSON file no larger than 2 MiB.");
    load(JSON.parse(await file.text()));
  } catch (error) {
    $("status").textContent = `Import failed: ${error.message}`;
  }
  event.target.value = "";
});
for (const [id, key] of Object.entries({
  name: "name",
  source: "source",
  reviewer: "labelledBy",
  notes: "reviewNotes",
}))
  $(id).addEventListener("input", () => {
    dataset[key] = $(id).value;
    dirty = true;
    update();
  });
for (const [id, key] of Object.entries({
  label: "label",
  rationale: "rationale",
}))
  $(id).addEventListener("input", () => {
    dataset.examples[selected][key] = $(id).value;
    dirty = true;
    update();
  });
$("attestation").addEventListener("change", () => {
  dirty = true;
  update();
});
$("previous").addEventListener("click", () => {
  selected--;
  showExample(true);
});
$("next").addEventListener("click", () => {
  selected++;
  showExample(true);
});
$("example-select").addEventListener("change", () => {
  selected = Number($("example-select").value);
  showExample(true);
});
$("draft").addEventListener("click", () =>
  download(dataset, "classifier-review-draft.json"),
);
$("export").addEventListener("click", () => {
  try {
    if (!$("attestation").checked)
      throw new Error("Confirm independent labelling before exporting.");
    if (!dataset.reviewNotes.trim())
      throw new Error("Add review notes before exporting.");
    download(reviewed(), "classifier-reviewed.json");
  } catch (error) {
    $("status").textContent = error.message;
    update();
  }
});
addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
await loadStarter();
