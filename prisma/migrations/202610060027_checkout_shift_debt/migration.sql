BEGIN;
ALTER TABLE "Register" ADD COLUMN "receiptSequence" NUMERIC(20,0) NOT NULL DEFAULT 0 CHECK ("receiptSequence">=0);
-- A separate namespace avoids confusing previous UUID receipts with counters.
UPDATE "Register" r SET "receiptSequence"=COALESCE((SELECT max(substring(s."receiptNo" FROM 5)::numeric) FROM "Sale" s WHERE s."registerId"=r.id AND s."receiptNo" ~ '^POS-[0-9]{1,20}$'),0);
ALTER TABLE "Sale" ADD COLUMN "fiscalReceiptNo" TEXT;
-- This is a nullable reference boundary only; no fiscal request, protocol or backfill.
ALTER TABLE "Shift" ADD COLUMN "pendingClose" JSONB, ADD COLUMN "countedBy" TEXT,
 ADD COLUMN "approvedBy" TEXT, ADD COLUMN "closeReason" TEXT, ADD COLUMN "handoverFromId" TEXT;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_handoverFromId_fkey" FOREIGN KEY ("handoverFromId") REFERENCES "Shift"(id) ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
CREATE UNIQUE INDEX "Shift_handoverFromId_key" ON "Shift"("handoverFromId");
ALTER TABLE "DebtEntry" ADD COLUMN "debtOriginId" TEXT;
CREATE INDEX "DebtEntry_debtOriginId_idx" ON "DebtEntry"("debtOriginId");
ALTER TABLE "DebtEntry" ADD CONSTRAINT "DebtEntry_debtOriginId_fkey" FOREIGN KEY ("debtOriginId") REFERENCES "DebtEntry"(id) ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION guard_debt_origin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."debtOriginId" IS NOT NULL AND (NEW.amount>=0 OR NEW."saleId" IS NOT NULL OR NOT EXISTS(
  SELECT 1 FROM "DebtEntry" o WHERE o.id=NEW."debtOriginId" AND o."organizationId"=NEW."organizationId"
   AND o."customerId"=NEW."customerId" AND o.amount>0 AND o."saleId" IS NULL AND o."debtOriginId" IS NULL
 )) THEN RAISE EXCEPTION 'Invalid debt origin' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "DebtEntry_origin_scope" BEFORE INSERT OR UPDATE ON "DebtEntry" FOR EACH ROW EXECUTE FUNCTION guard_debt_origin();
COMMIT;
