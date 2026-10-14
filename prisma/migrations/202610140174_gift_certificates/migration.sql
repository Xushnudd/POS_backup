BEGIN;
CREATE TABLE "GiftCertificate" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "advanceId" TEXT NOT NULL UNIQUE REFERENCES "CustomerAdvance"(id) DEFERRABLE INITIALLY DEFERRED,
 "policyVersionId" TEXT NOT NULL REFERENCES "LoyaltyPolicyVersion"(id) DEFERRABLE INITIALLY DEFERRED,
 code TEXT NOT NULL,"createdBy" TEXT NOT NULL REFERENCES "User"(id),reason TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "GiftCertificate_code" CHECK(code~'^[A-Z0-9][A-Z0-9_-]{2,63}$'),
 CONSTRAINT "GiftCertificate_reason" CHECK(length(btrim(reason)) BETWEEN 3 AND 2000),
 CONSTRAINT "GiftCertificate_organizationId_code_key" UNIQUE("organizationId",code)
);
CREATE INDEX "GiftCertificate_organizationId_createdAt_id_idx" ON "GiftCertificate"("organizationId","createdAt",id);
CREATE FUNCTION pos_gift_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "CustomerAdvance";p "LoyaltyPolicyVersion";cfg jsonb;days integer;
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'GIFT_IMMUTABLE' USING ERRCODE='23514';END IF;
 PERFORM assert_business_writable(NEW."organizationId");
 PERFORM pg_advisory_xact_lock(hashtextextended('loyalty-policy:'||NEW."organizationId",0));
 SELECT * INTO a FROM "CustomerAdvance" WHERE id=NEW."advanceId" AND "organizationId"=NEW."organizationId" FOR UPDATE;
 SELECT * INTO p FROM "LoyaltyPolicyVersion" WHERE "organizationId"=NEW."organizationId" ORDER BY revision DESC LIMIT 1;
 cfg:=p.configuration->'gifts';
 IF a.id IS NULL OR p.id IS DISTINCT FROM NEW."policyVersionId" OR cfg->'enabled' IS DISTINCT FROM 'true'::jsonb OR
  a.amount<(cfg->>'minIssueAmount')::numeric OR a.amount>(cfg->>'maxIssueAmount')::numeric OR
  NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=NEW."organizationId" AND "currencyCode"='UZS') OR
  NOT EXISTS(SELECT 1 FROM "CustomerAdvance" WHERE id=a.id AND xmin::text::bigint=txid_current()%4294967296) OR
  EXISTS(SELECT 1 FROM "CustomerAdvanceAllocation" WHERE "advanceId"=a.id) OR
  EXISTS(SELECT 1 FROM "CustomerAdvanceRefund" WHERE "advanceId"=a.id) OR
  NOT EXISTS(SELECT 1 FROM "OrganizationUser" m JOIN "User" u ON u.id=m."userId" WHERE m."organizationId"=NEW."organizationId" AND m."userId"=NEW."createdBy" AND m.role='owner' AND m."customRoleId" IS NULL AND m."isActive" AND u."isActive") THEN
  RAISE EXCEPTION 'GIFT_ISSUE_INVALID' USING ERRCODE='23514';END IF;
 days:=(cfg->>'validityDays')::integer;
 NEW."createdAt":=a."createdAt";
 IF NEW."expiresAt" IS DISTINCT FROM (CASE WHEN days IS NULL THEN NULL ELSE a."createdAt"+make_interval(days=>days) END) THEN
  RAISE EXCEPTION 'GIFT_VALIDITY_INVALID' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER gift_guard BEFORE INSERT OR UPDATE OR DELETE ON "GiftCertificate" FOR EACH ROW EXECUTE FUNCTION pos_gift_guard();
CREATE FUNCTION pos_gift_proof() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "AuditLog" a WHERE a."organizationId"=NEW."organizationId" AND a."actorId"=NEW."createdBy" AND a."entityType"='GiftCertificate' AND a."entityId"=NEW.id AND a.action='gift_issued' AND a.xmin::text::bigint=txid_current()%4294967296 AND a."afterData"->>'advanceId'=NEW."advanceId" AND a."afterData"->>'policyVersionId'=NEW."policyVersionId" AND a."afterData"->>'code'=NEW.code AND a."afterData"->>'reason'=NEW.reason) THEN RAISE EXCEPTION 'GIFT_PROOF_REQUIRED' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER gift_proof AFTER INSERT ON "GiftCertificate" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_gift_proof();
CREATE FUNCTION pos_gift_advance_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE gift "GiftCertificate";original jsonb;current_config jsonb;
BEGIN
 SELECT * INTO gift FROM "GiftCertificate" WHERE "advanceId"=NEW."advanceId" FOR SHARE;
 IF gift.id IS NULL THEN RETURN NEW;END IF;
 SELECT configuration->'gifts' INTO original FROM "LoyaltyPolicyVersion" WHERE id=gift."policyVersionId";
 IF TG_TABLE_NAME='CustomerAdvanceRefund' THEN
  IF original->'allowUnusedCashRefund' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'GIFT_CASH_REFUND_DENIED' USING ERRCODE='23514';END IF;
 ELSE
  PERFORM pg_advisory_xact_lock(hashtextextended('loyalty-policy:'||gift."organizationId",0));
  SELECT configuration->'gifts' INTO current_config FROM "LoyaltyPolicyVersion" WHERE "organizationId"=gift."organizationId" ORDER BY revision DESC LIMIT 1;
  IF current_config->'enabled' IS DISTINCT FROM 'true'::jsonb OR (gift."expiresAt" IS NOT NULL AND gift."expiresAt"<=clock_timestamp()) THEN RAISE EXCEPTION 'GIFT_UNAVAILABLE' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER gift_allocation_guard BEFORE INSERT ON "CustomerAdvanceAllocation" FOR EACH ROW EXECUTE FUNCTION pos_gift_advance_guard();
CREATE TRIGGER gift_refund_guard BEFORE INSERT ON "CustomerAdvanceRefund" FOR EACH ROW EXECUTE FUNCTION pos_gift_advance_guard();
-- Deferred source validation also covers the existing ordinary advance endpoint.
CREATE FUNCTION pos_gift_sale_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE gift "GiftCertificate";
BEGIN
 SELECT * INTO gift FROM "GiftCertificate" WHERE "advanceId"=NEW."advanceId";
 IF gift.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "DebtEntry" e JOIN "Sale" s ON s.id=e."saleId" JOIN "CustomerAdvance" a ON a.id=gift."advanceId" WHERE e.id=NEW."debtEntryId" AND e."debtOriginId" IS NULL AND s."organizationId"=gift."organizationId" AND s."customerId"=a."customerId" AND s.status IN ('completed','partially_returned')) THEN RAISE EXCEPTION 'GIFT_SALE_REQUIRED' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER gift_sale_source AFTER INSERT ON "CustomerAdvanceAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_gift_sale_source();
DO $$ DECLARE source text;needle text:='WHEN ''Organization'' THEN';BEGIN
 source:=pg_get_functiondef('business_row_organization(text,jsonb)'::regprocedure);
 IF strpos(source,needle)=0 OR strpos(source,'''GiftCertificate''')>0 THEN RAISE EXCEPTION 'Unreviewed subscription scope';END IF;
 source:=replace(source,needle,'WHEN ''GiftCertificate'' THEN RETURN value->>''organizationId''; '||needle);EXECUTE source;
END $$;
CREATE TRIGGER subscription_read_only BEFORE INSERT OR UPDATE OR DELETE ON "GiftCertificate" FOR EACH ROW EXECUTE FUNCTION subscription_business_write_guard();
COMMIT;
