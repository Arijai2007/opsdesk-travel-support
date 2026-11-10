ALTER TABLE "TravelSupplier" ADD COLUMN "slaCalendar" JSONB, ADD COLUMN "responseTargetHours" INTEGER NOT NULL DEFAULT 4, ADD COLUMN "responsePolicyVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TravelConversation" ADD COLUMN "slaSnapshot" JSONB;
