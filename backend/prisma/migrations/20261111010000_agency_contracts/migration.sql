CREATE TABLE "TravelContract" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "agencyId" TEXT NOT NULL REFERENCES "TravelAgency"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "slaCalendar" JSONB,
  "responseTargetHours" INTEGER NOT NULL CHECK ("responseTargetHours" BETWEEN 1 AND 168),
  "responsePolicyVersion" INTEGER NOT NULL DEFAULT 1,
  UNIQUE ("id", "agencyId")
);
CREATE INDEX "TravelContract_agencyId_active_name_id_idx" ON "TravelContract"("agencyId", "active", "name", "id");
ALTER TABLE "TravelTicket" ADD COLUMN "contractId" TEXT;
ALTER TABLE "TravelTicket" ADD CONSTRAINT "TravelTicket_contractId_agencyId_fkey" FOREIGN KEY ("contractId", "agencyId") REFERENCES "TravelContract"("id", "agencyId") ON DELETE RESTRICT ON UPDATE RESTRICT;
