-- CreateTable
CREATE TABLE "TravelAgency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "TravelAgency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelSupplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "TravelSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelProfile" (
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "agencyId" TEXT,
    "supplierId" TEXT,
    "region" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TravelProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TravelBooking" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,

    CONSTRAINT "TravelBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelTicket" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "bookingId" TEXT,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "region" TEXT NOT NULL,
    "agentId" TEXT,
    "deadline" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelConversation" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_REPLY',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "conversationId" TEXT,
    "senderId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "uniqueKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelClock" (
    "id" TEXT NOT NULL,
    "offsetMinutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TravelClock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TravelAgency_code_key" ON "TravelAgency"("code");

-- CreateIndex
CREATE INDEX "TravelBooking_customerId_idx" ON "TravelBooking"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "TravelBooking_agencyId_reference_key" ON "TravelBooking"("agencyId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "TravelTicket_reference_key" ON "TravelTicket"("reference");

-- CreateIndex
CREATE INDEX "TravelTicket_agencyId_customerId_idx" ON "TravelTicket"("agencyId", "customerId");

-- CreateIndex
CREATE INDEX "TravelTicket_status_deadline_idx" ON "TravelTicket"("status", "deadline");

-- CreateIndex
CREATE INDEX "TravelConversation_supplierId_idx" ON "TravelConversation"("supplierId");

-- CreateIndex
CREATE INDEX "TravelMessage_ticketId_createdAt_idx" ON "TravelMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TravelEvent_uniqueKey_key" ON "TravelEvent"("uniqueKey");

-- CreateIndex
CREATE INDEX "TravelEvent_ticketId_createdAt_idx" ON "TravelEvent"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "TravelProfile" ADD CONSTRAINT "TravelProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelProfile" ADD CONSTRAINT "TravelProfile_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TravelAgency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelProfile" ADD CONSTRAINT "TravelProfile_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "TravelSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelBooking" ADD CONSTRAINT "TravelBooking_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TravelAgency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelBooking" ADD CONSTRAINT "TravelBooking_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "TravelSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelTicket" ADD CONSTRAINT "TravelTicket_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TravelAgency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelTicket" ADD CONSTRAINT "TravelTicket_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "TravelBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelConversation" ADD CONSTRAINT "TravelConversation_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "TravelTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelConversation" ADD CONSTRAINT "TravelConversation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "TravelSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelMessage" ADD CONSTRAINT "TravelMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "TravelTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelMessage" ADD CONSTRAINT "TravelMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "TravelConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelEvent" ADD CONSTRAINT "TravelEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "TravelTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
