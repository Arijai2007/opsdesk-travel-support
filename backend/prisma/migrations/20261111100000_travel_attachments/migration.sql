CREATE TABLE "TravelAttachment" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "bytes" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TravelAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TravelAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TravelMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TravelAttachment_messageId_createdAt_idx" ON "TravelAttachment"("messageId", "createdAt");
CREATE INDEX "TravelAttachment_expiresAt_idx" ON "TravelAttachment"("expiresAt");
