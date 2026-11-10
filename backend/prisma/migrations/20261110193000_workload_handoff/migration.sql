ALTER TABLE "TravelTicket" ADD COLUMN "autoHandoff" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "TravelTicket_autoHandoff_status_id_idx" ON "TravelTicket"("autoHandoff", "status", "id");
