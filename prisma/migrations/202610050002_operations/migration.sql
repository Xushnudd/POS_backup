ALTER TABLE "SaleItem" ADD COLUMN "receiptDiscount" DECIMAL(14,2) NOT NULL DEFAULT 0;
-- Preserve old discounted receipts: allocation uses stable line-ID remainder order.
WITH base AS (
 SELECT i.id, i."saleId", s."discountAmount", s.subtotal,
 CASE WHEN s.subtotal > 0 THEN floor(i."lineTotal" * s."discountAmount" / s.subtotal * 100) / 100 ELSE 0 END AS allocated,
 CASE WHEN s.subtotal > 0 THEN i."lineTotal" * s."discountAmount" / s.subtotal * 100 - floor(i."lineTotal" * s."discountAmount" / s.subtotal * 100) ELSE 0 END AS remainder
 FROM "SaleItem" i JOIN "Sale" s ON s.id = i."saleId"
), ranked AS (
 SELECT *, row_number() OVER (PARTITION BY "saleId" ORDER BY remainder DESC, id) AS rank,
 round(("discountAmount" - sum(allocated) OVER (PARTITION BY "saleId"))*100) AS remaining
 FROM base
)
UPDATE "SaleItem" i SET "receiptDiscount"=r.allocated + CASE WHEN rank <= remaining THEN 0.01 ELSE 0 END FROM ranked r WHERE i.id=r.id;
ALTER TABLE "Payment" ADD COLUMN status TEXT NOT NULL DEFAULT 'recorded';
ALTER TABLE "SaleReturnItem" ADD COLUMN disposition TEXT NOT NULL DEFAULT 'sellable';
CREATE TABLE "Operation" (
 id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 type TEXT NOT NULL, key TEXT NOT NULL, "payloadHash" TEXT NOT NULL, result JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Operation_organizationId_type_key_key" ON "Operation"("organizationId",type,key);
CREATE INDEX "Operation_organizationId_createdAt_idx" ON "Operation"("organizationId","createdAt");
CREATE TABLE "DebtEntry" (
 id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "customerId" TEXT NOT NULL REFERENCES "Customer"(id) ON DELETE RESTRICT,
 "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "saleId" TEXT, amount DECIMAL(14,2) NOT NULL,
 note TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "DebtEntry_organizationId_sourceType_sourceId_key" ON "DebtEntry"("organizationId","sourceType","sourceId");
CREATE INDEX "DebtEntry_customerId_createdAt_idx" ON "DebtEntry"("customerId","createdAt");
INSERT INTO "DebtEntry" (id,"organizationId","customerId","sourceType","sourceId","saleId",amount,"createdAt")
SELECT 'legacy-'||id,"organizationId","customerId",'legacy_payment',id,"saleId",
 CASE WHEN direction='in' THEN amount ELSE -amount END,"createdAt"
FROM "Payment" WHERE "paymentType"='credit' AND "customerId" IS NOT NULL;

ALTER TABLE "Product" ALTER COLUMN "minStock" TYPE DECIMAL(20,6);
ALTER TABLE "StockDocumentItem" ALTER COLUMN "quantity" TYPE DECIMAL(20,6);
ALTER TABLE "InventoryMovement" ALTER COLUMN "quantityDelta" TYPE DECIMAL(20,6);
ALTER TABLE "InventoryBalance" ALTER COLUMN "quantity" TYPE DECIMAL(20,6);
ALTER TABLE "StockTransferItem" ALTER COLUMN "quantity" TYPE DECIMAL(20,6);
ALTER TABLE "SaleItem" ALTER COLUMN "quantity" TYPE DECIMAL(20,6);
ALTER TABLE "SaleReturnItem" ALTER COLUMN "quantity" TYPE DECIMAL(20,6);
ALTER TABLE "Product" ALTER COLUMN "costPrice" TYPE DECIMAL(20,6);
ALTER TABLE "StockDocumentItem" ALTER COLUMN "unitCost" TYPE DECIMAL(20,6);
ALTER TABLE "InventoryMovement" ALTER COLUMN "unitCost" TYPE DECIMAL(20,6);
ALTER TABLE "StockTransferItem" ALTER COLUMN "unitCost" TYPE DECIMAL(20,6);
ALTER TABLE "SaleItem" ALTER COLUMN "unitCost" TYPE DECIMAL(20,6);
