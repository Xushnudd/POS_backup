CREATE TABLE "CustomerAdvance" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "customerId" TEXT NOT NULL REFERENCES "Customer"(id) ON DELETE NO ACTION,
 "documentId" TEXT NOT NULL UNIQUE REFERENCES "FinancialDocument"(id) ON DELETE NO ACTION,
 amount NUMERIC(14,2) NOT NULL CHECK(amount>0),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CustomerAdvance_customer_idx" ON "CustomerAdvance"("organizationId","customerId","createdAt",id);
CREATE TABLE "CustomerAdvanceAllocation" (
 id TEXT PRIMARY KEY,"advanceId" TEXT NOT NULL REFERENCES "CustomerAdvance"(id) ON DELETE CASCADE,
 "debtEntryId" TEXT NOT NULL UNIQUE REFERENCES "DebtEntry"(id) DEFERRABLE INITIALLY DEFERRED,
 amount NUMERIC(14,2) NOT NULL CHECK(amount>0),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CustomerAdvanceAllocation_advance_idx" ON "CustomerAdvanceAllocation"("advanceId");
CREATE TABLE "CustomerAdvanceRefund" (
 id TEXT PRIMARY KEY,"advanceId" TEXT NOT NULL REFERENCES "CustomerAdvance"(id) ON DELETE CASCADE,
 "documentId" TEXT NOT NULL UNIQUE REFERENCES "FinancialDocument"(id),
 amount NUMERIC(14,2) NOT NULL CHECK(amount>0),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CustomerAdvanceRefund_advance_idx" ON "CustomerAdvanceRefund"("advanceId");
CREATE VIEW "CustomerAdvanceBalance" AS SELECT a.*, a.amount-
 COALESCE((SELECT sum(x.amount) FROM "CustomerAdvanceAllocation" x WHERE x."advanceId"=a.id),0)-
 COALESCE((SELECT sum(x.amount) FROM "CustomerAdvanceRefund" x WHERE x."advanceId"=a.id),0) AS available FROM "CustomerAdvance" a;
CREATE FUNCTION customer_advance_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a RECORD; d RECORD; e RECORD; org TEXT;
BEGIN
 IF TG_TABLE_NAME='CustomerAdvance' THEN org:=COALESCE(NEW."organizationId",OLD."organizationId");
 ELSE SELECT * INTO a FROM "CustomerAdvance" WHERE id=COALESCE(NEW."advanceId",OLD."advanceId") FOR UPDATE;org:=a."organizationId"; END IF;
 IF TG_OP<>'INSERT' THEN
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=org) THEN RAISE EXCEPTION 'customer advance journal immutable' USING ERRCODE='23514';END IF;RETURN OLD;
 END IF;
 IF TG_TABLE_NAME='CustomerAdvance' THEN
  IF NOT EXISTS(SELECT 1 FROM "Customer" c JOIN "FinancialDocument" d ON d.id=NEW."documentId" WHERE c.id=NEW."customerId" AND c."organizationId"=NEW."organizationId" AND c."isActive" AND c."mergedIntoId" IS NULL AND d."organizationId"=NEW."organizationId" AND d.kind='customer_advance' AND d.amount=NEW.amount) THEN RAISE EXCEPTION 'advance scope mismatch' USING ERRCODE='23514';END IF;
 ELSE
  IF a.id IS NULL OR NEW.amount>(SELECT available FROM "CustomerAdvanceBalance" WHERE id=a.id) THEN RAISE EXCEPTION 'advance balance exceeded' USING ERRCODE='23514';END IF;
  IF TG_TABLE_NAME='CustomerAdvanceRefund' THEN
   IF NOT EXISTS(SELECT 1 FROM "FinancialDocument" d WHERE d.id=NEW."documentId" AND d."organizationId"=org AND d.kind='customer_refund' AND d.amount=NEW.amount) THEN RAISE EXCEPTION 'advance refund original mismatch' USING ERRCODE='23514';END IF;
  END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER advance_guard BEFORE INSERT OR UPDATE OR DELETE ON "CustomerAdvance" FOR EACH ROW EXECUTE FUNCTION customer_advance_guard();
CREATE TRIGGER advance_allocation_guard BEFORE INSERT OR UPDATE OR DELETE ON "CustomerAdvanceAllocation" FOR EACH ROW EXECUTE FUNCTION customer_advance_guard();
CREATE TRIGGER advance_refund_guard BEFORE INSERT OR UPDATE OR DELETE ON "CustomerAdvanceRefund" FOR EACH ROW EXECUTE FUNCTION customer_advance_guard();
CREATE FUNCTION customer_advance_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a RECORD; e RECORD; doc TEXT; expected NUMERIC;
BEGIN
 IF TG_TABLE_NAME='CustomerAdvance' THEN SELECT * INTO a FROM "CustomerAdvance" WHERE id=NEW.id;doc:=NEW."documentId";expected:=NEW.amount;
 ELSIF TG_TABLE_NAME='CustomerAdvanceRefund' THEN SELECT * INTO a FROM "CustomerAdvance" WHERE id=NEW."advanceId";doc:=NEW."documentId";expected:=-NEW.amount;
 ELSE
  SELECT * INTO a FROM "CustomerAdvance" WHERE id=NEW."advanceId";SELECT * INTO e FROM "DebtEntry" WHERE id=NEW."debtEntryId";
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=a."organizationId") AND (e.id IS NULL OR (e."organizationId",e."customerId",e."sourceType",e."sourceId",e.amount) IS DISTINCT FROM (a."organizationId",a."customerId",'advance_allocation'::text,NEW.id,-NEW.amount) OR (e."saleId" IS NULL AND e."debtOriginId" IS NULL) OR (e."saleId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Sale" s WHERE s.id=e."saleId" AND s."organizationId"=a."organizationId" AND s."customerId"=a."customerId" AND s.status IN ('completed','partially_returned'))) OR (SELECT COALESCE(sum(amount),0) FROM "DebtEntry" WHERE "organizationId"=a."organizationId" AND "customerId"=a."customerId" AND (CASE WHEN e."saleId" IS NOT NULL THEN "saleId"=e."saleId" ELSE id=e."debtOriginId" OR "debtOriginId"=e."debtOriginId" END))<0) THEN RAISE EXCEPTION 'advance allocation debt mismatch' USING ERRCODE='23514';END IF;
  RETURN NULL;
 END IF;
 IF EXISTS(SELECT 1 FROM "Organization" WHERE id=a."organizationId") AND NOT EXISTS(SELECT 1 FROM "AccountEntry" e JOIN "FinancialAccount" ac ON ac.id=e."accountId" WHERE e."documentId"=doc AND e.amount=expected AND e."organizationId"=a."organizationId" AND ac.kind='cash' AND e."cashMovementId" IS NOT NULL) THEN RAISE EXCEPTION 'advance requires real cash journal' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER advance_complete AFTER INSERT ON "CustomerAdvance" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION customer_advance_complete();
CREATE CONSTRAINT TRIGGER advance_allocation_complete AFTER INSERT ON "CustomerAdvanceAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION customer_advance_complete();
CREATE CONSTRAINT TRIGGER advance_refund_complete AFTER INSERT ON "CustomerAdvanceRefund" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION customer_advance_complete();
CREATE FUNCTION customer_advance_debt_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP<>'INSERT' AND OLD."sourceType"='advance_allocation' AND EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'advance debt immutable' USING ERRCODE='23514';END IF;
 IF TG_OP<>'DELETE' AND NEW."sourceType"='advance_allocation' AND NOT EXISTS(SELECT 1 FROM "CustomerAdvanceAllocation" x JOIN "CustomerAdvance" a ON a.id=x."advanceId" WHERE x.id=NEW."sourceId" AND x."debtEntryId"=NEW.id AND a."organizationId"=NEW."organizationId" AND a."customerId"=NEW."customerId" AND NEW.amount=-x.amount) THEN RAISE EXCEPTION 'unlinked advance debt' USING ERRCODE='23514';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
CREATE TRIGGER advance_debt_guard BEFORE INSERT OR UPDATE OR DELETE ON "DebtEntry" FOR EACH ROW EXECUTE FUNCTION customer_advance_debt_guard();
CREATE FUNCTION customer_advance_archive_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (NOT NEW."isActive" OR NEW."mergedIntoId" IS NOT NULL OR NEW."organizationId"<>OLD."organizationId") AND EXISTS(SELECT 1 FROM "CustomerAdvanceBalance" WHERE "customerId"=OLD.id AND available>0) THEN RAISE EXCEPTION 'customer has unused advance' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE TRIGGER advance_customer_archive_guard BEFORE UPDATE ON "Customer" FOR EACH ROW EXECUTE FUNCTION customer_advance_archive_guard();
