BEGIN;
CREATE TABLE "Invitation" (
 id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 phone TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','cashier')),
 "storeIds" JSONB NOT NULL CHECK (jsonb_typeof("storeIds")='array'), "tokenHash" TEXT NOT NULL UNIQUE,
 "invitedBy" TEXT NOT NULL REFERENCES "User"(id), "expiresAt" TIMESTAMP(3) NOT NULL,
 "acceptedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Invitation_organizationId_createdAt_idx" ON "Invitation"("organizationId","createdAt");
COMMIT;
