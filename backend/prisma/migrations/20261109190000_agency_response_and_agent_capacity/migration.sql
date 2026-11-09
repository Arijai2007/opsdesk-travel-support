ALTER TABLE "TravelAgency"
  ADD COLUMN "responseTargetHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "responsePolicyVersion" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "TravelAgency_responseTargetHours_check" CHECK ("responseTargetHours" BETWEEN 1 AND 168);

ALTER TABLE "TravelProfile"
  ADD COLUMN "maxActiveCases" INTEGER,
  ADD CONSTRAINT "TravelProfile_maxActiveCases_check" CHECK ("maxActiveCases" BETWEEN 1 AND 500);

ALTER TABLE "TravelTicket" ADD COLUMN "responseStartedAt" TIMESTAMP(3);
