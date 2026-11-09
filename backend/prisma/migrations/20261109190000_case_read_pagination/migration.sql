CREATE INDEX "TravelTicket_bookingId_createdAt_id_idx" ON "TravelTicket"("bookingId", "createdAt", "id");
CREATE INDEX "TravelConversation_supplierId_createdAt_id_idx" ON "TravelConversation"("supplierId", "createdAt", "id");
CREATE INDEX "TravelConversation_ticketId_createdAt_id_idx" ON "TravelConversation"("ticketId", "createdAt", "id");
CREATE INDEX "TravelMessage_conversationId_createdAt_id_idx" ON "TravelMessage"("conversationId", "createdAt", "id");
