CREATE TABLE "TravelBookingImport" (
  "bookingId" TEXT NOT NULL PRIMARY KEY REFERENCES "TravelBooking"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "providerSource" TEXT NOT NULL,
  "providerBookingId" TEXT NOT NULL,
  "providerUpdatedAt" TIMESTAMP(3) NOT NULL,
  "providerStatus" TEXT NOT NULL CHECK ("providerStatus" IN ('ACTIVE', 'CANCELLED')),
  "providerPayloadHash" TEXT NOT NULL
);

CREATE UNIQUE INDEX "TravelBookingImport_providerSource_providerBookingId_key"
  ON "TravelBookingImport"("providerSource", "providerBookingId");
