-- Applied094 stays immutable: remove PL/pgSQL record/SQL alias ambiguity.
CREATE OR REPLACE FUNCTION customer_advance_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a RECORD; org TEXT;
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
CREATE OR REPLACE FUNCTION customer_advance_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a RECORD; e RECORD; doc TEXT; expected NUMERIC;
BEGIN
 IF TG_TABLE_NAME='CustomerAdvance' THEN SELECT * INTO a FROM "CustomerAdvance" WHERE id=NEW.id;doc:=NEW."documentId";expected:=NEW.amount;
 ELSIF TG_TABLE_NAME='CustomerAdvanceRefund' THEN SELECT * INTO a FROM "CustomerAdvance" WHERE id=NEW."advanceId";doc:=NEW."documentId";expected:=-NEW.amount;
 ELSE
  SELECT * INTO a FROM "CustomerAdvance" WHERE id=NEW."advanceId";SELECT * INTO e FROM "DebtEntry" WHERE id=NEW."debtEntryId";
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=a."organizationId") AND (e.id IS NULL OR (e."organizationId",e."customerId",e."sourceType",e."sourceId",e.amount) IS DISTINCT FROM (a."organizationId",a."customerId",'advance_allocation'::text,NEW.id,-NEW.amount) OR (e."saleId" IS NULL AND e."debtOriginId" IS NULL) OR (e."saleId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Sale" s WHERE s.id=e."saleId" AND s."organizationId"=a."organizationId" AND s."customerId"=a."customerId" AND s.status IN ('completed','partially_returned'))) OR (SELECT COALESCE(sum(amount),0) FROM "DebtEntry" WHERE "organizationId"=a."organizationId" AND "customerId"=a."customerId" AND (CASE WHEN e."saleId" IS NOT NULL THEN "saleId"=e."saleId" ELSE id=e."debtOriginId" OR "debtOriginId"=e."debtOriginId" END))<0) THEN RAISE EXCEPTION 'advance allocation debt mismatch' USING ERRCODE='23514';END IF;
  RETURN NULL;
 END IF;
 IF EXISTS(SELECT 1 FROM "Organization" WHERE id=a."organizationId") AND NOT EXISTS(SELECT 1 FROM "AccountEntry" posting JOIN "FinancialAccount" ac ON ac.id=posting."accountId" WHERE posting."documentId"=doc AND posting.amount=expected AND posting."organizationId"=a."organizationId" AND ac.kind='cash' AND posting."cashMovementId" IS NOT NULL) THEN RAISE EXCEPTION 'advance requires real cash journal' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
