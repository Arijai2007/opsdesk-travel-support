ALTER TABLE "TravelMailJob" ADD COLUMN "replyEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TravelInboundMail" (
  "id" TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL REFERENCES "TravelTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TravelInboundMail_ticketId_idx" ON "TravelInboundMail"("ticketId");
