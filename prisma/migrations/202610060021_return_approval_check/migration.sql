BEGIN;
ALTER TABLE "SaleReturn" DROP CONSTRAINT "SaleReturn_approval_check";
-- PostgreSQL CHECK accepts NULL: explicitly require every approval field.
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_approval_check" CHECK (
 ("approvedBy" IS NULL AND "approvedRole" IS NULL AND "approvedAt" IS NULL) OR
 ("approvedBy" IS NOT NULL AND "approvedBy"="processedBy" AND "approvedRole" IS NOT NULL AND "approvedRole" IN ('owner','admin') AND "approvedAt" IS NOT NULL));
COMMIT;
