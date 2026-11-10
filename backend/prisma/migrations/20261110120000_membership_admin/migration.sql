ALTER TABLE "TravelProfile" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE', ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TravelProfile" ADD CONSTRAINT "TravelProfile_status_check" CHECK ("status" IN ('INVITED', 'ACTIVE', 'SUSPENDED'));
ALTER TABLE "TravelProfile" ADD CONSTRAINT "TravelProfile_sessionVersion_check" CHECK ("sessionVersion" >= 0);
CREATE TABLE "TravelInvitation" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "memberId" TEXT NOT NULL REFERENCES "TravelProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE,
 "tokenHash" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "usedAt" TIMESTAMP(3),
 "revokedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "TravelInvitation_tokenHash_key" ON "TravelInvitation"("tokenHash");
CREATE INDEX "TravelInvitation_memberId_idx" ON "TravelInvitation"("memberId");
CREATE TABLE "MembershipAudit" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "actorId" TEXT NOT NULL,
 "entityId" TEXT NOT NULL,
 "action" TEXT NOT NULL,
 "reason" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MembershipAudit_createdAt_id_idx" ON "MembershipAudit"("createdAt", "id");
