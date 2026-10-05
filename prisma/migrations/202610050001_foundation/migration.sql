-- Preflight intentionally fails rather than destroying incompatible old data.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "Product" GROUP BY "organizationId", sku HAVING count(*) > 1)
 OR EXISTS (SELECT 1 FROM "Product" GROUP BY "organizationId", barcode HAVING count(*) > 1)
 THEN RAISE EXCEPTION 'Resolve tenant SKU/barcode duplicates before migration'; END IF;
 IF EXISTS (SELECT 1 FROM "Shift" WHERE status = 'open' GROUP BY "registerId" HAVING count(*) > 1)
 THEN RAISE EXCEPTION 'Resolve duplicate active shifts before migration'; END IF;
END $$;
CREATE UNIQUE INDEX "Product_organizationId_sku_key" ON "Product"("organizationId", sku);
CREATE UNIQUE INDEX "Product_organizationId_barcode_key" ON "Product"("organizationId", barcode);
DROP INDEX IF EXISTS "Product_sku_key";
DROP INDEX IF EXISTS "Product_barcode_key";
CREATE UNIQUE INDEX "Shift_one_open_per_register" ON "Shift"("registerId") WHERE status = 'open';
CREATE TABLE "Session" (
 id TEXT PRIMARY KEY,
 "tokenHash" TEXT NOT NULL UNIQUE,
 "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "idleExpiresAt" TIMESTAMP(3) NOT NULL,
 "revokedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
