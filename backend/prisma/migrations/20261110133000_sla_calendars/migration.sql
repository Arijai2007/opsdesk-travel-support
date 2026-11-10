ALTER TABLE "TravelAgency" ADD COLUMN "slaCalendar" JSONB;
ALTER TABLE "TravelProfile" ADD COLUMN "shiftCalendar" JSONB;
ALTER TABLE "TravelTicket" ADD COLUMN "slaSnapshot" JSONB, ADD COLUMN "slaPausedAt" TIMESTAMP(3), ADD COLUMN "slaRemainingMs" DOUBLE PRECISION, ADD COLUMN "escalationOwnerId" TEXT;
