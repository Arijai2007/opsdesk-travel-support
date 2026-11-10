# Booking export preflight

Run the validator with the [synthetic version 1 sample](../scripts/fixtures/booking-export-v1.json):

```sh
npm run ops:check-booking-export -- scripts/fixtures/booking-export-v1.json
node --test scripts/booking-export.test.mjs
```

The command reads one JSON file up to 10 MiB, validates the entire batch, and prints active and cancelled counts. Errors identify a row and field without echoing export values. It opens no database connection and writes no booking records. Convert a provider export to this format before running it.

Each batch has a `version` of 1, a stable `source` identifier, and a `bookings` array. Each booking has external `id`, `agencyId`, `customerId`, and `supplierId` identifiers, a booking `reference`, and `ACTIVE` or `CANCELLED` status. External booking IDs must be unique within the batch. References are trimmed and uppercased for comparison within each agency. Agencies can use the same reference independently.

Use ISO UTC instants ending in `Z` for `updatedAt` and `checkInAt`, and provide an IANA display timezone. Optional `departureAt` and `cancellationCutoffAt` are UTC instants or null. A local time during a daylight saving transition cannot identify an instant. Keep the provider’s UTC value and use the timezone for display.

For a read-only reconciliation plan, pass the incoming export, a trusted identity mapping file, and the last accepted snapshot. This example compares the synthetic export with itself:

```sh
npm run ops:check-booking-export -- scripts/fixtures/booking-export-v1.json scripts/fixtures/booking-export-mappings-v1.json scripts/fixtures/booking-export-v1.json
```

The mapping file must use version 1 and the same source as both snapshots. Operators supply approved external-to-local IDs for agencies, customers and suppliers. Customer IDs are looked up within their external agency. The planner does not infer identity from names or references, and does not check that the declared local IDs exist in a live database.

The planner emits `CREATE`, `UPDATE`, `CANCEL`, `UNCHANGED`, `STALE` or `REVIEW` per incoming row. Cancellation requires a newer explicit cancellation of an accepted booking. Missing rows are ignored. Ownership changes, reference collisions, unknown cancellations, reactivations and conflicting records with identical timestamps require review. An invalid input exits with code 1. A valid plan that contains a review row exits with code 2. The command only prints row numbers and decisions.

To also verify against a local OpsDesk database, set `OPSDESK_BOOKING_VERIFY_DATABASE_URL` in the shell and add `--verify-db` before the input files. Use a read-only database role. This mode opens a read-only transaction and checks that mapped agencies and suppliers exist, that the customer profile belongs to the mapped agency, and that the local reference, ownership and accepted schedule agree. Reference collisions and local drift require review. A previously cancelled snapshot also requires review because the current booking schema cannot verify stored cancellation status.

`node scripts/booking-ownership.integration.mjs` checks this behavior against the isolated seeded PostgreSQL database. CI runs it after startup.

A future importer must repeat ownership and stale-update checks inside its write transaction, persist a provider version and cancellation state, and decide how a schedule change or cancellation affects existing cases. Import and live provider selection remain in [issue #5](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/5).
