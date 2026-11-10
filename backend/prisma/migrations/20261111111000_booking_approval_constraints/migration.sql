ALTER TABLE "TravelBookingRequest"
  ADD CONSTRAINT "TravelBookingRequest_kind_check" CHECK ("kind" IN ('CREATE', 'CANCEL')),
  ADD CONSTRAINT "TravelBookingRequest_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
  ADD CONSTRAINT "TravelBookingRequest_review_check" CHECK (
    ("status" = 'PENDING' AND "reviewerId" IS NULL AND "reviewedAt" IS NULL)
    OR ("status" <> 'PENDING' AND "reviewerId" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "decisionReason" IS NOT NULL)
  ),
  ADD CONSTRAINT "TravelBookingRequest_booking_check" CHECK (("kind" <> 'CANCEL' AND "status" <> 'APPROVED') OR "bookingId" IS NOT NULL);
