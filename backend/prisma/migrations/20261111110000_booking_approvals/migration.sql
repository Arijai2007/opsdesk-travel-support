CREATE TABLE "TravelBookingRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "submitterId" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "bookingId" TEXT,
  "kind" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewerId" TEXT,
  "decisionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3)
);
CREATE INDEX "TravelBookingRequest_agencyId_createdAt_id_idx" ON "TravelBookingRequest"("agencyId", "createdAt", "id");
CREATE INDEX "TravelBookingRequest_status_createdAt_id_idx" ON "TravelBookingRequest"("status", "createdAt", "id");
