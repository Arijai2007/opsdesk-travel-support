import { readFile, stat } from "node:fs/promises";
import { readBookingExport } from "./booking-export.mjs";

try {
  if (process.argv.length !== 3)
    throw new Error("Usage: npm run ops:check-booking-export -- <export.json>");
  const file = process.argv[2];
  const info = await stat(file).catch(() => null);
  if (!info?.isFile() || info.size > 10 * 1024 * 1024)
    throw new Error("Expected a readable export file of at most 10 MiB.");
  const content = await readFile(file, "utf8").catch(() => {
    throw new Error("Could not read the export file.");
  });
  let json;
  try {
    json = JSON.parse(content);
  } catch {
    throw new Error("Invalid JSON export.");
  }
  const { bookings } = readBookingExport(json);
  const cancelled = bookings.filter(
    ({ status }) => status === "CANCELLED",
  ).length;
  console.log(
    `Validated ${bookings.length} booking records: ${bookings.length - cancelled} active, ${cancelled} cancelled. No records were written.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
