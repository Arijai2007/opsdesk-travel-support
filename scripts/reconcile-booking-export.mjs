import { readBookingExport } from "./booking-export.mjs";

const key = (...values) => JSON.stringify(values);
const stableId = (value) =>
  typeof value === "string" &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);

function readMappings(rows, label, scoped = false) {
  if (!Array.isArray(rows)) throw new Error(`Expected ${label} mappings.`);
  const result = new Map();
  const local = new Set();
  for (const [index, row] of rows.entries()) {
    if (
      !stableId(row?.externalId) ||
      !stableId(row?.localId) ||
      (scoped && !stableId(row?.agencyId))
    )
      throw new Error(`Invalid ${label} mapping at row ${index + 1}.`);
    const externalKey = scoped
      ? key(row.agencyId, row.externalId)
      : key(row.externalId);
    const localKey = key(row.localId);
    if (result.has(externalKey) || local.has(localKey))
      throw new Error(`Duplicate ${label} identity at row ${index + 1}.`);
    result.set(externalKey, row.localId);
    local.add(localKey);
  }
  return result;
}

export function planBookingExport(incoming, trustedMappings, previous) {
  const next = readBookingExport(incoming);
  const accepted = readBookingExport(previous);
  if (
    trustedMappings?.version !== 1 ||
    next.source !== trustedMappings.source ||
    next.source !== accepted.source
  )
    throw new Error(
      "Incoming export, mappings and accepted snapshot must use the same source.",
    );

  const agencies = readMappings(trustedMappings.agencies, "agency");
  const customers = readMappings(trustedMappings.customers, "customer", true);
  const suppliers = readMappings(trustedMappings.suppliers, "supplier");
  const existing = new Map(accepted.bookings.map((row) => [row.id, row]));
  const references = new Map(
    accepted.bookings.map((row) => [key(row.agencyId, row.reference), row.id]),
  );

  return next.bookings.map((row, index) => {
    const decision = (action, reason) => ({ row: index + 1, action, reason });
    if (
      !agencies.has(key(row.agencyId)) ||
      !customers.has(key(row.agencyId, row.customerId)) ||
      !suppliers.has(key(row.supplierId))
    )
      return decision("REVIEW", "Unmapped agency, customer or supplier");

    const prior = existing.get(row.id);
    const referenceOwner = references.get(key(row.agencyId, row.reference));
    if (referenceOwner && referenceOwner !== row.id)
      return decision(
        "REVIEW",
        "Agency reference belongs to another accepted booking",
      );
    if (!prior)
      return row.status === "CANCELLED"
        ? decision("REVIEW", "Cancellation has no accepted booking")
        : decision("CREATE", "New active booking");

    if (
      prior.agencyId !== row.agencyId ||
      prior.customerId !== row.customerId ||
      prior.supplierId !== row.supplierId ||
      prior.reference !== row.reference
    )
      return decision("REVIEW", "Booking identity or ownership changed");
    if (row.updatedAt < prior.updatedAt)
      return decision("STALE", "Older than the accepted snapshot");
    if (row.updatedAt === prior.updatedAt)
      return JSON.stringify(row) === JSON.stringify(prior)
        ? decision("UNCHANGED", "Same accepted record")
        : decision("REVIEW", "Different values with the same update timestamp");
    if (prior.status === "CANCELLED" && row.status === "ACTIVE")
      return decision("REVIEW", "Reactivation requires review");
    if (prior.status === "ACTIVE" && row.status === "CANCELLED")
      return decision("CANCEL", "Newer explicit cancellation");
    return decision("UPDATE", "Newer record with unchanged ownership");
  });
}
