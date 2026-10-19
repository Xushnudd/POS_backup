BEGIN;
ALTER TABLE "Sale" ADD COLUMN "cashTendered" NUMERIC(14,2), ADD COLUMN "cashChange" NUMERIC(14,2);
-- Unknown historical tender stays NULL; never invent cash handed over.
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cash_tender_check" CHECK (
 ("cashTendered" IS NULL AND "cashChange" IS NULL) OR
 ("cashTendered" IS NOT NULL AND "cashChange" IS NOT NULL AND "cashTendered">=0 AND "cashChange">=0 AND "cashChange"<="cashTendered"));
COMMIT;
