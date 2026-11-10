CREATE TABLE "TravelMailJob" (
  "id" TEXT PRIMARY KEY,
  "messageId" TEXT NOT NULL UNIQUE REFERENCES "TravelMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "recipient" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" TIMESTAMP(3),
  "leaseToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "TravelMailJob_status_nextAttemptAt_idx" ON "TravelMailJob"("status", "nextAttemptAt");

CREATE TABLE "TravelMailAttempt" (
  "id" TEXT PRIMARY KEY,
  "jobId" TEXT NOT NULL REFERENCES "TravelMailJob"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "outcome" TEXT NOT NULL,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "TravelMailAttempt_jobId_createdAt_idx" ON "TravelMailAttempt"("jobId", "createdAt");
