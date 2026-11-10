import { createHash } from "node:crypto";
import {
  bookingOwnershipReview,
  localBookingClient,
  readBookingOwnership,
} from "./verify-booking-ownership.mjs";

const hash = (row) =>
  createHash("sha256").update(JSON.stringify(row)).digest("hex");

export async function applyBookingExport(
  { source, plan, candidates },
  connectionString,
) {
  const client = localBookingClient(
    connectionString,
    "OPSDESK_BOOKING_APPLY_DATABASE_URL",
  );
  if (plan.length > 500)
    throw new Error("Apply accepts at most 500 rows per batch.");
  const byRow = new Map(
    candidates.map((candidate) => [candidate.row, candidate]),
  );
  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '10s'");
    // Keep ownership and the active-case check stable until the batch commits.
    await client.query("SELECT pg_advisory_xact_lock(804204)");
    await client.query(
      'LOCK TABLE "TravelAgency", "TravelSupplier", "TravelProfile" IN SHARE MODE',
    );
    await client.query(
      'LOCK TABLE "TravelTicket", "TravelBooking", "TravelBookingImport" IN EXCLUSIVE MODE',
    );
    const demo = await client.query(
      `SELECT 1 FROM "TravelProfile" p JOIN "User" u ON u.id = p."userId"
       WHERE p.kind = 'MANAGER' AND u.email = 'manager@opsdesk.demo'`,
    );
    if (!demo.rowCount) {
      await client.query("ROLLBACK");
      throw new Error("Apply requires an isolated seeded OpsDesk database.");
    }
    const matches = await readBookingOwnership(client, candidates);
    const writes = [];
    const decisions = plan.map((item) => {
      const review = (reason) => ({ ...item, action: "REVIEW", reason });
      if (item.action === "REVIEW") return item;
      if (item.action === "CREATE")
        return review("New bookings require an approved creation flow");

      const candidate = byRow.get(item.row);
      const current = matches.get(item.row) ?? [];
      const [local] = current;
      const row = candidate.incoming;
      if (
        current.length !== 1 ||
        !local?.knownAgency ||
        !local.ownedCustomer ||
        !local.knownSupplier ||
        !local.bookingId ||
        local.bookingCustomerId !== candidate.customerId ||
        local.bookingSupplierId !== candidate.supplierId
      )
        return review("Local booking ownership could not be verified");
      if (
        local.providerSource &&
        (local.providerSource !== source || local.providerBookingId !== row.id)
      )
        return review(
          "Booking is already bound to a different provider identity",
        );
      const storedVersion = local.providerUpdatedAt?.toISOString();
      const payloadHash = hash(row);
      if (storedVersion && row.updatedAt < storedVersion)
        return {
          ...item,
          action: "STALE",
          reason: "Older than the stored provider version",
        };
      if (storedVersion === row.updatedAt) {
        if (local.providerPayloadHash !== payloadHash)
          return review("Different values with the stored provider timestamp");
        const drift = bookingOwnershipReview(
          { ...candidate, prior: row },
          current,
        );
        return drift
          ? review(drift)
          : {
              ...item,
              action: "UNCHANGED",
              reason: "Provider version already applied",
            };
      }
      if (item.action === "STALE") return item;
      const drift = bookingOwnershipReview(candidate, current);
      if (drift) return review(drift);
      if (item.action === "UNCHANGED") return item;
      if (
        storedVersion &&
        (storedVersion !== candidate.prior.updatedAt ||
          local.providerPayloadHash !== hash(candidate.prior))
      )
        return review(
          "Accepted snapshot does not match the stored provider version",
        );
      const scheduleChanged = [
        "timezone",
        "checkInAt",
        "departureAt",
        "cancellationCutoffAt",
      ].some((field) => row[field] !== candidate.prior[field]);
      if (local.hasActiveCases && (scheduleChanged || item.action === "CANCEL"))
        return review(
          "Active cases require review before a schedule change or cancellation",
        );
      writes.push({ bookingId: local.bookingId, row, payloadHash });
      return item;
    });
    if (decisions.some(({ action }) => action === "REVIEW")) {
      await client.query("ROLLBACK");
      return { decisions, applied: 0 };
    }
    for (const { bookingId, row, payloadHash } of writes) {
      await client.query(
        `UPDATE "TravelBooking" SET timezone = $2, "checkInAt" = $3::timestamptz AT TIME ZONE 'UTC',
           "departureAt" = $4::timestamptz AT TIME ZONE 'UTC',
           "cancellationCutoffAt" = $5::timestamptz AT TIME ZONE 'UTC' WHERE id = $1`,
        [
          bookingId,
          row.timezone,
          row.checkInAt,
          row.departureAt,
          row.cancellationCutoffAt,
        ],
      );
      await client.query(
        `INSERT INTO "TravelBookingImport" ("bookingId", "providerSource", "providerBookingId",
           "providerUpdatedAt", "providerStatus", "providerPayloadHash")
         VALUES ($1, $2, $3, $4::timestamptz AT TIME ZONE 'UTC', $5, $6)
         ON CONFLICT ("bookingId") DO UPDATE SET "providerUpdatedAt" = EXCLUDED."providerUpdatedAt",
           "providerStatus" = EXCLUDED."providerStatus", "providerPayloadHash" = EXCLUDED."providerPayloadHash"`,
        [bookingId, source, row.id, row.updatedAt, row.status, payloadHash],
      );
    }
    await client.query("COMMIT");
    return { decisions, applied: writes.length };
  } catch (error) {
    if (error.message === "Apply requires an isolated seeded OpsDesk database.")
      throw error;
    throw new Error(
      "Booking apply failed. Confirm stored versions before retrying.",
    );
  } finally {
    await client.end().catch(() => {});
  }
}
