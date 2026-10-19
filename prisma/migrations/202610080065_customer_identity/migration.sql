ALTER TABLE "Customer" ADD COLUMN "canonicalPhone" TEXT, ADD COLUMN "mergedIntoId" TEXT;
CREATE FUNCTION customer_phone_key(value TEXT) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE digits TEXT;
BEGIN
 value:=btrim(value);
 IF value !~ '^\+?[0-9 ()\.\-]+$' THEN RETURN NULL;END IF;
 digits:=regexp_replace(value,'[^0-9]','','g');
 IF length(digits)=9 AND left(trim(value),1)<>'+' THEN digits:='998'||digits;END IF;
 IF length(digits) NOT BETWEEN 9 AND 15 THEN RETURN NULL;END IF;
 RETURN digits;
END $$;
-- Preserve all legacy identities; ambiguous duplicates remain visibly unresolved.
WITH keys AS (SELECT id, "organizationId",customer_phone_key(phone) AS key FROM "Customer" WHERE "isActive"), counts AS (SELECT "organizationId",key,count(*) AS n FROM keys WHERE key IS NOT NULL GROUP BY "organizationId",key)
UPDATE "Customer" c SET "canonicalPhone"=k.key FROM keys k JOIN counts n ON n."organizationId"=k."organizationId" AND n.key=k.key WHERE c.id=k.id AND n.n=1;
ALTER TABLE "Customer" ADD CONSTRAINT "customer_merge_scope" FOREIGN KEY ("organizationId","mergedIntoId") REFERENCES "Customer" ("organizationId",id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Customer" ADD CONSTRAINT "customer_merge_state" CHECK ("mergedIntoId" IS NULL OR ("mergedIntoId"<>id AND NOT "isActive" AND "canonicalPhone" IS NULL));
CREATE UNIQUE INDEX "customer_active_phone_key" ON "Customer" ("organizationId","canonicalPhone") WHERE "isActive" AND "mergedIntoId" IS NULL AND "canonicalPhone" IS NOT NULL;
CREATE INDEX "customer_alias_history" ON "Customer" ("organizationId","mergedIntoId");
CREATE FUNCTION customer_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE key TEXT;target "Customer";
BEGIN
 IF TG_OP='UPDATE' AND OLD."mergedIntoId" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Merged customer identity is immutable';END IF;
 IF NEW."mergedIntoId" IS NOT NULL THEN
  SELECT * INTO target FROM "Customer" WHERE id=NEW."mergedIntoId" AND "organizationId"=NEW."organizationId" FOR UPDATE;
  IF NOT FOUND OR NOT target."isActive" OR target."mergedIntoId" IS NOT NULL OR EXISTS(SELECT 1 FROM "Customer" WHERE "mergedIntoId"=NEW.id) OR (SELECT count(*) FROM "Customer" WHERE "mergedIntoId"=target.id)>=99 THEN RAISE EXCEPTION 'Invalid customer merge target';END IF;
  IF EXISTS(SELECT 1 FROM "Sale" WHERE "customerId"=NEW.id AND status='draft') OR EXISTS(SELECT 1 FROM "DebtEntry" WHERE "customerId"=NEW.id GROUP BY CASE WHEN "saleId" IS NOT NULL THEN 'sale:'||"saleId" WHEN "debtOriginId" IS NOT NULL THEN 'document:'||"debtOriginId" WHEN amount>0 THEN 'document:'||id ELSE 'general' END HAVING SUM(amount)<>0) THEN RAISE EXCEPTION 'Customer obligations must be settled before merge';END IF;
  NEW."canonicalPhone":=NULL;RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND NEW.phone=OLD.phone AND NEW."isActive"=OLD."isActive" THEN NEW."canonicalPhone":=OLD."canonicalPhone";RETURN NEW;END IF;
 key:=customer_phone_key(NEW.phone);
 IF NEW."isActive" AND key IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('customer-phone:'||NEW."organizationId"||':'||key,0));
  IF EXISTS(SELECT 1 FROM "Customer" c WHERE c.id<>NEW.id AND c."organizationId"=NEW."organizationId" AND c."isActive" AND c."mergedIntoId" IS NULL AND customer_phone_key(c.phone)=key) THEN RAISE EXCEPTION 'Duplicate normalized customer phone';END IF;
 END IF;
 NEW."canonicalPhone":=CASE WHEN NEW."isActive" THEN key ELSE NULL END;
 RETURN NEW;
END $$;
CREATE TRIGGER customer_identity_guard BEFORE INSERT OR UPDATE ON "Customer" FOR EACH ROW EXECUTE FUNCTION customer_identity_guard();
