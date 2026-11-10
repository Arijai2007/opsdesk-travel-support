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
  if ((first.providerStatus ?? "ACTIVE") !== prior.status)
    return "Local cancellation status differs from the accepted snapshot";
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

export function localBookingClient(connectionString, variableName) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(`Set ${variableName} to a local PostgreSQL database.`);
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
  return new Client({ connectionString, connectionTimeoutMillis: 5000 });
}

export async function readBookingOwnership(client, candidates) {
  const { rows } = await client.query(
    `SELECT i."rowNumber" AS "row", a.id IS NOT NULL AS "knownAgency", p."userId" IS NOT NULL AS "ownedCustomer",
              s.id IS NOT NULL AS "knownSupplier", b.id AS "bookingId",
              b."customerId" AS "bookingCustomerId", b."supplierId" AS "bookingSupplierId",
              v."providerSource", v."providerBookingId", v."providerStatus", v."providerPayloadHash",
              v."providerUpdatedAt" AT TIME ZONE 'UTC' AS "providerUpdatedAt",
              EXISTS (SELECT 1 FROM "TravelTicket" t WHERE t."bookingId" = b.id
                      AND t.status NOT IN ('RESOLVED', 'CLOSED')) AS "hasActiveCases",
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
       ) b ON true
       LEFT JOIN "TravelBookingImport" v ON v."bookingId" = b.id`,
    [
      JSON.stringify(
        candidates.map(
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
  );
  const byRow = new Map();
  for (const match of rows) {
    if (!byRow.has(match.row)) byRow.set(match.row, []);
    byRow.get(match.row).push(match);
  }
  return byRow;
}

export async function verifyBookingOwnership(
  { plan, candidates },
  connectionString,
) {
  const client = localBookingClient(
    connectionString,
    "OPSDESK_BOOKING_VERIFY_DATABASE_URL",
  );
  const reviewable = candidates.filter(
    ({ row }) => plan[row - 1].action !== "REVIEW",
  );
  if (!reviewable.length) return plan;
  let byRow;
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '10s'");
    byRow = await readBookingOwnership(client, reviewable);
    await client.query("COMMIT");
  } catch {
    throw new Error(
      "Could not verify booking ownership against the local database.",
    );
  } finally {
    await client.end().catch(() => {});
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
