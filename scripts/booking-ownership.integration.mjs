import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import { Client } from "pg";
import { prepareBookingReconciliation } from "./reconcile-booking-export.mjs";
import { verifyBookingOwnership } from "./verify-booking-ownership.mjs";
import { applyBookingExport } from "./apply-booking-export.mjs";

const env = dotenv.parse(
  readFileSync(new URL("../backend/.env", import.meta.url)),
);
const databaseUrl =
  process.env.OPSDESK_BOOKING_TEST_DATABASE_URL ?? env.DATABASE_URL;
const url = new URL(databaseUrl);
assert.equal(env.OPSDESK_DEMO, "true", "Use the isolated synthetic database.");
assert.equal(url.hostname, "127.0.0.1");
const client = new Client({ connectionString: databaseUrl });
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
    databaseUrl,
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

const writeFixture = new Client({ connectionString: databaseUrl });
const temporaryId = randomUUID();
const temporaryTicket = randomUUID();
const reference = temporaryId.toUpperCase();
const accepted = structuredClone(snapshot);
accepted.source = `synthetic-${temporaryId}`;
accepted.bookings[0].reference = reference;
const trusted = { ...mappings, source: accepted.source };
const incoming = structuredClone(accepted);
incoming.bookings[0].updatedAt = "2026-11-11T00:00:00Z";
incoming.bookings[0].timezone =
  booking.timezone === "UTC" ? "Europe/Paris" : "UTC";
const apply = (batch, previous) =>
  applyBookingExport(
    prepareBookingReconciliation(batch, trusted, previous),
    databaseUrl,
  );
try {
  await writeFixture.connect();
  await writeFixture.query(
    `INSERT INTO "TravelBooking"
       (id, reference, "agencyId", "customerId", "supplierId", destination, region,
        service, "checkInAt", "departureAt", "cancellationCutoffAt", timezone)
     SELECT $1, $2, "agencyId", "customerId", "supplierId", destination, region, service,
       "checkInAt", "departureAt", "cancellationCutoffAt", timezone
     FROM "TravelBooking" WHERE id = 'booking-0'`,
    [temporaryId, reference],
  );
  const state = async () =>
    (
      await writeFixture.query(
        'SELECT b.timezone, v."providerStatus", v."providerUpdatedAt" FROM "TravelBooking" b LEFT JOIN "TravelBookingImport" v ON v."bookingId" = b.id WHERE b.id = $1',
        [temporaryId],
      )
    ).rows[0];
  const mixed = structuredClone(incoming);
  mixed.bookings.push({
    ...mixed.bookings[0],
    id: "unapproved-create",
    reference: "UNAPPROVED-CREATE",
  });
  assert.equal((await apply(mixed, accepted)).applied, 0);
  assert.equal((await state()).providerUpdatedAt, null);
  const simultaneous = await Promise.all([
    apply(incoming, accepted),
    apply(incoming, accepted),
  ]);
  assert.deepEqual(simultaneous.map(({ applied }) => applied).sort(), [0, 1]);
  assert.equal((await state()).timezone, incoming.bookings[0].timezone);
  assert.equal((await state()).providerStatus, "ACTIVE");
  assert.equal(
    (await apply(incoming, accepted)).decisions[0].action,
    "UNCHANGED",
  );
  const stale = await apply(accepted, accepted);
  assert.equal(stale.decisions[0].action, "STALE");

  const cancelled = structuredClone(incoming);
  cancelled.bookings[0].status = "CANCELLED";
  cancelled.bookings[0].updatedAt = "2026-11-12T00:00:00Z";
  await writeFixture.query(
    `INSERT INTO "TravelTicket" (id, reference, title, description, "agencyId", "customerId",
       "bookingId", category, region, deadline, "updatedAt")
     SELECT $1, $1, 'Synthetic booking apply test', 'Temporary active case for import safety.',
       "agencyId", "customerId", id, 'OTHER', region, "checkInAt", now() AT TIME ZONE 'UTC'
     FROM "TravelBooking" WHERE id = $2`,
    [temporaryTicket, temporaryId],
  );
  const blocked = await apply(cancelled, incoming);
  assert.equal(blocked.applied, 0);
  assert.match(blocked.decisions[0].reason, /Active cases require review/);
  assert.equal((await state()).providerStatus, "ACTIVE");
  await writeFixture.query('DELETE FROM "TravelTicket" WHERE id = $1', [
    temporaryTicket,
  ]);
  assert.equal((await apply(cancelled, incoming)).applied, 1);
  assert.equal((await state()).providerStatus, "CANCELLED");
  assert.equal(
    (await apply(cancelled, incoming)).decisions[0].action,
    "UNCHANGED",
  );
  console.log(
    "PASS: transactional update, stale and replay handling, batch rollback and guarded cancellation.",
  );
} finally {
  try {
    await writeFixture.query('DELETE FROM "TravelTicket" WHERE id = $1', [
      temporaryTicket,
    ]);
    await writeFixture.query('DELETE FROM "TravelBooking" WHERE id = $1', [
      temporaryId,
    ]);
  } finally {
    await writeFixture.end();
  }
}
