import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { readBookingExport } from "./booking-export.mjs";

const fixture = () =>
  JSON.parse(
    readFileSync(new URL("./fixtures/booking-export-v1.json", import.meta.url)),
  );

test("keeps equal references separate across agencies and normalizes UTC times", () => {
  const { bookings } = readBookingExport(fixture());
  assert.equal(bookings[0].reference, bookings[1].reference);
  assert.notEqual(bookings[0].agencyId, bookings[1].agencyId);
  assert.equal(bookings[0].checkInAt, "2026-11-15T12:00:00.000Z");
  assert.equal(bookings[1].departureAt, null);
  assert.equal(bookings[1].status, "CANCELLED");
});

test("rejects a reused external booking ID and an agency-local reference collision", () => {
  const input = fixture();
  input.bookings[1].id = input.bookings[0].id;
  assert.throws(
    () => readBookingExport(input),
    /duplicate external booking ID/,
  );
  input.bookings[1].id = "unique-id";
  input.bookings[1].agencyId = input.bookings[0].agencyId;
  input.bookings[1].reference = " demo-10 ";
  assert.throws(() => readBookingExport(input), /duplicate booking reference/);
});

test("requires external ownership IDs and rejects an unknown record state", () => {
  const input = fixture();
  delete input.bookings[0].customerId;
  assert.throws(() => readBookingExport(input), /customerId: expected/);
  input.bookings[0].customerId = "customer";
  input.bookings[0].status = "UNKNOWN";
  assert.throws(() => readBookingExport(input), /status: expected/);
});

test("rejects ambiguous local timestamps, impossible dates and unknown timezones", () => {
  const input = fixture();
  const row = input.bookings[0];
  row.checkInAt = "2026-11-01T01:30:00";
  assert.throws(
    () => readBookingExport(input),
    /expected an ISO UTC timestamp/,
  );
  row.checkInAt = "2026-02-30T12:00:00Z";
  assert.throws(() => readBookingExport(input), /invalid calendar timestamp/);
  row.checkInAt = "2026-11-15T12:00:00Z";
  row.timezone = "Europe/Unknown";
  assert.throws(() => readBookingExport(input), /unknown timezone/);
});

test("keeps distinct UTC instants during a repeated local hour", () => {
  const input = fixture();
  const row = input.bookings[0];
  row.timezone = "America/New_York";
  row.checkInAt = "2026-11-01T05:30:00Z";
  row.departureAt = "2026-11-01T06:30:00Z";
  row.cancellationCutoffAt = null;
  const { bookings } = readBookingExport(input);
  assert.equal(
    Date.parse(bookings[0].departureAt) - Date.parse(bookings[0].checkInAt),
    3600000,
  );
});

test("rejects inconsistent schedules without putting source values in errors", () => {
  const input = fixture();
  input.bookings[0].departureAt = "2026-11-15T08:00:00Z";
  assert.throws(
    () => readBookingExport(input),
    /^Error: Booking row 1, departureAt: cannot precede check-in$/,
  );
  input.bookings[0].departureAt = null;
  input.bookings[0].cancellationCutoffAt = "2026-11-16T08:00:00Z";
  assert.throws(() => readBookingExport(input), /cannot follow check-in/);
});
