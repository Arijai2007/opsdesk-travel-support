ALTER TABLE "TravelBooking"
  ADD COLUMN "departureAt" TIMESTAMP(3),
  ADD COLUMN "cancellationCutoffAt" TIMESTAMP(3);

ALTER TABLE "TravelTicket" ADD COLUMN "responseDeadline" TIMESTAMP(3);

ALTER TABLE "TravelProfile"
  ADD COLUMN "specialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
