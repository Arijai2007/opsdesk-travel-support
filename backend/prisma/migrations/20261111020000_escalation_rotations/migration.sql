CREATE TABLE "TravelEscalationRotation" (
  "region" TEXT NOT NULL PRIMARY KEY CHECK ("region" IN ('GLOBAL', 'ASIA', 'EUROPE', 'AMERICAS')),
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "managerIds" TEXT[] NOT NULL CHECK (cardinality("managerIds") BETWEEN 1 AND 50),
  "slotHours" INTEGER NOT NULL CHECK ("slotHours" BETWEEN 1 AND 168),
  "anchorAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE "TravelTicket" ADD COLUMN "escalationManual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TravelTicket" ADD COLUMN "escalationOverrideUntil" TIMESTAMP(3);
