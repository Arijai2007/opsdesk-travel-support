# Booking export preflight

Run the validator with the [synthetic version 1 sample](../scripts/fixtures/booking-export-v1.json):

```sh
npm run ops:check-booking-export -- scripts/fixtures/booking-export-v1.json
node --test scripts/booking-export.test.mjs
```

The command reads one JSON file up to 10 MiB, validates the entire batch, and prints active and cancelled counts. Errors identify a row and field without echoing export values. It opens no database connection and writes no booking records. Convert a provider export to this format before running it.

Each batch has a `version` of 1, a stable `source` identifier, and a `bookings` array. Each booking has external `id`, `agencyId`, `customerId`, and `supplierId` identifiers, a booking `reference`, and `ACTIVE` or `CANCELLED` status. External booking IDs must be unique within the batch. References are trimmed and uppercased for comparison within each agency. Agencies can use the same reference independently.

Use ISO UTC instants ending in `Z` for `updatedAt` and `checkInAt`, and provide an IANA display timezone. Optional `departureAt` and `cancellationCutoffAt` are UTC instants or null. A local time during a daylight saving transition cannot identify an instant. Keep the provider’s UTC value and use the timezone for display.

Validation establishes the shape and internal consistency of a batch. A future importer must verify provider identities against trusted agency, customer and supplier mappings, reject stale updates by comparing the stored version, define cancellation handling, and decide how changes affect existing tickets. Import and live provider selection remain in [issue #5](https://github.com/DhruvKhanna7777/opsdesk-travel-support/issues/5).
