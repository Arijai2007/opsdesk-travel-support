const identity = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const utcInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function readBookingExport(input) {
  if (
    !input ||
    typeof input !== "object" ||
    input.version !== 1 ||
    typeof input.source !== "string" ||
    !identity.test(input.source) ||
    !Array.isArray(input.bookings)
  ) {
    throw new Error(
      "Expected a version 1 booking export with a source and booking array.",
    );
  }

  const ids = new Set();
  const references = new Set();
  const bookings = input.bookings.map((row, index) => {
    const fail = (field, message) => {
      throw new Error(`Booking row ${index + 1}, ${field}: ${message}`);
    };
    if (!row || typeof row !== "object" || Array.isArray(row))
      fail("record", "expected an object");
    const key = (field) => {
      if (typeof row[field] !== "string" || !identity.test(row[field]))
        fail(field, "expected a stable external ID");
      return row[field];
    };
    const timestamp = (field, required) => {
      const value = row[field];
      if (value == null && !required) return null;
      if (typeof value !== "string" || !utcInstant.test(value))
        fail(field, "expected an ISO UTC timestamp ending in Z");
      const date = new Date(value);
      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString() !==
          (value.includes(".") ? value : value.replace("Z", ".000Z"))
      )
        fail(field, "invalid calendar timestamp");
      return date.toISOString();
    };

    const id = key("id");
    const agencyId = key("agencyId");
    const customerId = key("customerId");
    const supplierId = key("supplierId");
    const reference =
      typeof row.reference === "string"
        ? row.reference.trim().toUpperCase()
        : "";
    if (
      !reference ||
      reference.length > 60 ||
      /[\x00-\x1f\x7f]/.test(reference)
    )
      fail(
        "reference",
        "expected a non-empty booking reference up to 60 characters",
      );
    if (ids.has(id)) fail("id", "duplicate external booking ID");
    const agencyReference = JSON.stringify([agencyId, reference]);
    if (references.has(agencyReference))
      fail("reference", "duplicate booking reference within this agency");
    ids.add(id);
    references.add(agencyReference);

    if (!["ACTIVE", "CANCELLED"].includes(row.status))
      fail("status", "expected ACTIVE or CANCELLED");
    if (
      typeof row.timezone !== "string" ||
      !/^(?:UTC|[A-Za-z_]+\/[A-Za-z0-9_+/-]+)$/.test(row.timezone)
    )
      fail("timezone", "expected an IANA timezone or UTC");
    try {
      new Intl.DateTimeFormat("en", { timeZone: row.timezone });
    } catch {
      fail("timezone", "unknown timezone");
    }
    const updatedAt = timestamp("updatedAt", true);
    const checkInAt = timestamp("checkInAt", true);
    const departureAt = timestamp("departureAt", false);
    const cancellationCutoffAt = timestamp("cancellationCutoffAt", false);
    if (departureAt && departureAt < checkInAt)
      fail("departureAt", "cannot precede check-in");
    if (cancellationCutoffAt && cancellationCutoffAt > checkInAt)
      fail("cancellationCutoffAt", "cannot follow check-in");

    return {
      id,
      agencyId,
      customerId,
      supplierId,
      reference,
      status: row.status,
      timezone: row.timezone,
      updatedAt,
      checkInAt,
      departureAt,
      cancellationCutoffAt,
    };
  });
  return { source: input.source, bookings };
}
