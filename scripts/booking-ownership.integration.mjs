import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import { Client } from "pg";
import { prepareBookingReconciliation } from "./reconcile-booking-export.mjs";
import { verifyBookingOwnership } from "./verify-booking-ownership.mjs";

const env = dotenv.parse(
  readFileSync(new URL("../backend/.env", import.meta.url)),
);
const url = new URL(env.DATABASE_URL);
assert.equal(env.OPSDESK_DEMO, "true", "Use the isolated synthetic database.");
assert.equal(url.hostname, "127.0.0.1");
const client = new Client({ connectionString: env.DATABASE_URL });
let booking;
try {
  await client.connect();
  ({
    rows: [booking],
  } = await client.query(
    `SELECT reference, "agencyId", "customerId", "supplierId", timezone,
            "checkInAt" AT TIME ZONE 'UTC' AS "checkInAt",
            "departureAt" AT TIME ZONE 'UTC' AS "departureAt",
            "cancellationCutoffAt" AT TIME ZONE 'UTC' AS "cancellationCutoffAt"
     FROM "TravelBooking" WHERE id = 'booking-0'`,
  ));
} finally {
  await client.end();
}
assert(booking, "Expected the seeded booking.");
const source = "synthetic-ownership-check";
const snapshot = {
  version: 1,
  source,
  bookings: [
    {
      id: "external-booking",
      agencyId: "external-agency",
      customerId: "external-customer",
      supplierId: "external-supplier",
      reference: booking.reference,
      timezone: booking.timezone,
      status: "ACTIVE",
      updatedAt: "2026-11-10T00:00:00Z",
      checkInAt: booking.checkInAt.toISOString(),
      departureAt: booking.departureAt?.toISOString() ?? null,
      cancellationCutoffAt: booking.cancellationCutoffAt?.toISOString() ?? null,
    },
  ],
};
const mappings = {
  version: 1,
  source,
  agencies: [{ externalId: "external-agency", localId: booking.agencyId }],
  customers: [
    {
      agencyId: "external-agency",
      externalId: "external-customer",
      localId: booking.customerId,
    },
  ],
  suppliers: [{ externalId: "external-supplier", localId: booking.supplierId }],
};
const verify = (incoming, trusted, previous) =>
  verifyBookingOwnership(
    prepareBookingReconciliation(incoming, trusted, previous),
    env.DATABASE_URL,
  );
const [unchanged] = await verify(snapshot, mappings, snapshot);
assert.equal(unchanged.action, "UNCHANGED");
const [collision] = await verify(snapshot, mappings, {
  ...snapshot,
  bookings: [],
});
assert.match(collision.reason, /already uses this agency reference/);
const wrongOwner = structuredClone(mappings);
wrongOwner.customers[0].localId = "customer-1";
const [ownership] = await verify(snapshot, wrongOwner, snapshot);
assert.match(ownership.reason, /ownership or supplier could not be verified/);
const changed = structuredClone(snapshot);
changed.bookings[0].timezone =
  booking.timezone === "UTC" ? "Europe/Paris" : "UTC";
const [drift] = await verify(changed, mappings, changed);
assert.match(drift.reason, /Local schedule differs/);
console.log(
  "PASS: PostgreSQL verifies ownership, detects reference collisions and rejects local schedule drift.",
);
