ALTER TABLE "TravelMailJob"
  ADD COLUMN "transport" TEXT NOT NULL DEFAULT 'SYNTHETIC',
  ADD COLUMN "providerId" TEXT;
DROP INDEX "TravelMailJob_status_nextAttemptAt_idx";
CREATE INDEX "TravelMailJob_transport_status_nextAttemptAt_idx" ON "TravelMailJob"("transport", "status", "nextAttemptAt");

CREATE TABLE "TravelMailReceipt" (
  "id" TEXT PRIMARY KEY,
  "jobId" TEXT NOT NULL REFERENCES "TravelMailJob"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "providerId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "TravelMailReceipt_jobId_occurredAt_idx" ON "TravelMailReceipt"("jobId", "occurredAt");
