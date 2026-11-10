import { readFile, stat } from "node:fs/promises";
import { readBookingExport } from "./booking-export.mjs";
import { prepareBookingReconciliation } from "./reconcile-booking-export.mjs";
import { verifyBookingOwnership } from "./verify-booking-ownership.mjs";
import { applyBookingExport } from "./apply-booking-export.mjs";

async function readJson(file) {
  const info = await stat(file).catch(() => null);
  if (!info?.isFile() || info.size > 10 * 1024 * 1024)
    throw new Error("Expected a readable export file of at most 10 MiB.");
  const content = await readFile(file, "utf8").catch(() => {
    throw new Error("Could not read the export file.");
  });
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Invalid JSON export.");
  }
}

try {
  const args = process.argv.slice(2);
  const verifyDatabase = args[0] === "--verify-db";
  const applyDatabase = args[0] === "--apply-db";
  const [file, mappingFile, snapshotFile, ...extra] =
    verifyDatabase || applyDatabase ? args.slice(1) : args;
  if (
    !file ||
    Boolean(mappingFile) !== Boolean(snapshotFile) ||
    extra.length ||
    ((verifyDatabase || applyDatabase) && !mappingFile)
  )
    throw new Error(
      "Usage: npm run ops:check-booking-export -- [--verify-db|--apply-db] <export.json> [<trusted-mappings.json> <accepted-snapshot.json>]",
    );
  const json = await readJson(file);
  if (mappingFile) {
    const mappings = await readJson(mappingFile);
    const snapshot = await readJson(snapshotFile);
    const reconciliation = prepareBookingReconciliation(
      json,
      mappings,
      snapshot,
    );
    const applied = applyDatabase
      ? await applyBookingExport(
          reconciliation,
          process.env.OPSDESK_BOOKING_APPLY_DATABASE_URL,
        )
      : null;
    const plan =
      applied?.decisions ??
      (verifyDatabase
        ? await verifyBookingOwnership(
            reconciliation,
            process.env.OPSDESK_BOOKING_VERIFY_DATABASE_URL,
          )
        : reconciliation.plan);
    for (const { row, action, reason } of plan)
      console.log(`Booking row ${row}: ${action} (${reason})`);
    console.log(
      applied
        ? `Applied ${applied.applied} of ${plan.length} booking records.`
        : `Planned ${plan.length} booking records. No records were written.`,
    );
    if (plan.some(({ action }) => action === "REVIEW")) process.exitCode = 2;
  } else {
    const { bookings } = readBookingExport(json);
    const cancelled = bookings.filter(
      ({ status }) => status === "CANCELLED",
    ).length;
    console.log(
      `Validated ${bookings.length} booking records: ${bookings.length - cancelled} active, ${cancelled} cancelled. No records were written.`,
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
