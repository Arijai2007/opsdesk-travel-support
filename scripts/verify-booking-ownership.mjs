import { Client } from "pg";

export function bookingOwnershipReview(candidate, matches) {
  const first = matches[0];
  if (!first?.knownAgency || !first.ownedCustomer || !first.knownSupplier)
    return "Mapped agency, customer ownership or supplier could not be verified";
  if (matches.length > 1)
    return "More than one local booking matches the reference";
  if (!candidate.prior)
    return first.bookingId
      ? "A local booking already uses this agency reference"
      : null;
  if (
    !first.bookingId ||
    first.bookingCustomerId !== candidate.customerId ||
    first.bookingSupplierId !== candidate.supplierId
  )
    return "Accepted booking is missing or its local ownership differs";
  const prior = candidate.prior;
  if (prior.status !== "ACTIVE")
    return "Local booking cancellation status cannot be verified";
  if (
    first.timezone !== prior.timezone ||
    first.checkInAt?.toISOString() !== prior.checkInAt ||
    (first.departureAt?.toISOString() ?? null) !== prior.departureAt ||
    (first.cancellationCutoffAt?.toISOString() ?? null) !==
      prior.cancellationCutoffAt
  )
    return "Local schedule differs from the accepted snapshot";
  return null;
}

export async function verifyBookingOwnership(
  { plan, candidates },
  connectionString,
) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(
      "Set OPSDESK_BOOKING_VERIFY_DATABASE_URL to a local PostgreSQL database.",
    );
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !url.pathname.slice(1) ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Database verification requires a local PostgreSQL URL with a database name and no options.",
    );
  const reviewable = candidates.filter(
    ({ row }) => plan[row - 1].action !== "REVIEW",
  );
  if (!reviewable.length) return plan;
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
  });
  let rows;
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '10s'");
    ({ rows } = await client.query(
      `SELECT i."rowNumber" AS "row", a.id IS NOT NULL AS "knownAgency", p."userId" IS NOT NULL AS "ownedCustomer",
              s.id IS NOT NULL AS "knownSupplier", b.id AS "bookingId",
              b."customerId" AS "bookingCustomerId", b."supplierId" AS "bookingSupplierId",
              b.timezone, b."checkInAt" AT TIME ZONE 'UTC' AS "checkInAt",
              b."departureAt" AT TIME ZONE 'UTC' AS "departureAt",
              b."cancellationCutoffAt" AT TIME ZONE 'UTC' AS "cancellationCutoffAt"
       FROM jsonb_to_recordset($1::jsonb)
         AS i("rowNumber" integer, "agencyId" text, "customerId" text, "supplierId" text, reference text)
       LEFT JOIN "TravelAgency" a ON a.id = i."agencyId"
       LEFT JOIN "TravelProfile" p ON p."userId" = i."customerId"
         AND p."agencyId" = i."agencyId" AND p.kind = 'CUSTOMER'
       LEFT JOIN "TravelSupplier" s ON s.id = i."supplierId"
       LEFT JOIN LATERAL (
         SELECT * FROM "TravelBooking" b
         WHERE b."agencyId" = i."agencyId" AND upper(btrim(b.reference)) = i.reference
         LIMIT 2
       ) b ON true`,
      [
        JSON.stringify(
          reviewable.map(
            ({ row, agencyId, customerId, supplierId, reference }) => ({
              rowNumber: row,
              agencyId,
              customerId,
              supplierId,
              reference,
            }),
          ),
        ),
      ],
    ));
    await client.query("COMMIT");
  } catch {
    throw new Error(
      "Could not verify booking ownership against the local database.",
    );
  } finally {
    await client.end().catch(() => {});
  }
  const byRow = new Map();
  for (const match of rows) {
    if (!byRow.has(match.row)) byRow.set(match.row, []);
    byRow.get(match.row).push(match);
  }
  const verified = new Map(
    reviewable.map((row) => [
      row.row,
      bookingOwnershipReview(row, byRow.get(row.row) ?? []),
    ]),
  );
  return plan.map((item) => {
    const reason = verified.get(item.row);
    return reason ? { ...item, action: "REVIEW", reason } : item;
  });
}
