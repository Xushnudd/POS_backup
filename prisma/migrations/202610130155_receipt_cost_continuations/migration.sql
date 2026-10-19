BEGIN;
CREATE TABLE "ReceiptCostContinuation" (
 id text PRIMARY KEY,
 "organizationId" text NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
 "storeId" text NOT NULL REFERENCES "Store"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 "productId" text NOT NULL REFERENCES "Product"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 "planId" text NOT NULL REFERENCES "ReceiptCostPlan"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 "actorId" text NOT NULL REFERENCES "User"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 "sessionId" text NOT NULL, "transactionId" bigint NOT NULL,"lastSequence" bigint NOT NULL,
 "sourceOperationId" text REFERENCES "Operation"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 "sourceAuditId" text REFERENCES "AuditLog"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 "varianceCorrection" numeric(40,12) NOT NULL,"roundingCorrection" numeric(40,12) NOT NULL,
 "cogsEntries" jsonb NOT NULL, snapshot jsonb NOT NULL,"createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(("sourceOperationId" IS NULL)<>("sourceAuditId" IS NULL)),
 CHECK(jsonb_typeof("cogsEntries")='array' AND jsonb_array_length("cogsEntries")<=10000),
 CHECK(jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=8388608),
 UNIQUE("planId","productId","transactionId")
);
CREATE INDEX "ReceiptCostContinuation_organization_product_created_id_idx" ON "ReceiptCostContinuation"("organizationId","productId","createdAt",id);
CREATE INDEX "InventoryValuationEvent_transaction_product_idx" ON "InventoryValuationEvent"("transactionId","productId");
CREATE FUNCTION receipt_cost_continuation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_ok boolean; entry jsonb;
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Cost continuation is immutable' USING ERRCODE='23514';END IF;
 PERFORM assert_business_writable(NEW."organizationId");
 IF NEW."transactionId"<>txid_current() OR NEW."createdAt" IS DISTINCT FROM CURRENT_TIMESTAMP::timestamp(3) OR NOT EXISTS(SELECT 1 FROM "Session" s JOIN "OrganizationUser" m ON m."organizationId"=s."organizationId" AND m."userId"=s."userId" JOIN "User" u ON u.id=m."userId" WHERE s.id=NEW."sessionId" AND s."organizationId"=NEW."organizationId" AND s."userId"=NEW."actorId" AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp() AND m."isActive" AND u."isActive") THEN RAISE EXCEPTION 'Cost continuation requires current live transaction' USING ERRCODE='23514';END IF;
 IF NEW."sourceOperationId" IS NOT NULL THEN
  SELECT EXISTS(SELECT 1 FROM "Operation" o WHERE o.id=NEW."sourceOperationId" AND o."organizationId"=NEW."organizationId" AND o."actorId"=NEW."actorId" AND o.xmin::text::bigint=txid_current()%4294967296) INTO source_ok;
 ELSE
  SELECT EXISTS(SELECT 1 FROM "AuditLog" a WHERE a.id=NEW."sourceAuditId" AND a."organizationId"=NEW."organizationId" AND a."actorId"=NEW."actorId" AND a.xmin::text::bigint=txid_current()%4294967296 AND a."entityType"='Product' AND a."entityId"=NEW."productId" AND a.action='update') INTO source_ok;
 END IF;
 IF NOT source_ok OR NOT EXISTS(SELECT 1 FROM "ReceiptCostPlan" p JOIN "ReceiptCostApplication" a ON a."planId"=p.id WHERE p.id=NEW."planId" AND p."organizationId"=NEW."organizationId" AND p."storeId"=NEW."storeId" AND a.snapshot->'products' @> jsonb_build_array(jsonb_build_object('productId',NEW."productId"))) OR NOT EXISTS(SELECT 1 FROM "InventoryValuationSequence" v WHERE v."productId"=NEW."productId" AND v."organizationId"=NEW."organizationId" AND v."lastSequence"=NEW."lastSequence" AND v."legacyMovementCount"=0 AND v."baselineQuantity"=0) THEN RAISE EXCEPTION 'Cost continuation original source/boundary invalid' USING ERRCODE='23514';END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(NEW."cogsEntries") LOOP
  IF (entry->>'amount' ~ '^-?(0|[1-9][0-9]{0,27})(\.[0-9]{1,12})?$') IS DISTINCT FROM true OR NOT EXISTS(SELECT 1 FROM "Store" WHERE id=entry->>'storeId' AND "organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'Continuation COGS source invalid' USING ERRCODE='23514';END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER receipt_cost_continuation_guard BEFORE INSERT OR UPDATE OR DELETE ON "ReceiptCostContinuation" FOR EACH ROW EXECUTE FUNCTION receipt_cost_continuation_guard();
COMMIT;
