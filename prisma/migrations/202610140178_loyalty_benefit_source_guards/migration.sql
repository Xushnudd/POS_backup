BEGIN;
CREATE OR REPLACE FUNCTION pos_loyalty_benefit_sale_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE selection record;sale_id text;
BEGIN
 -- Evaluate the correct record shape in separate statements: PostgreSQL plans
 -- every CASE branch, including a field absent from the other trigger table.
 IF TG_TABLE_NAME='Sale' THEN sale_id:=NEW.id;ELSE sale_id:=COALESCE(NEW."saleId",OLD."saleId");END IF;
 FOR selection IN SELECT id FROM "LoyaltyBenefitSelection" WHERE "saleId"=sale_id AND state IN ('prepared','posted') LOOP PERFORM pos_loyalty_benefit_snapshot(selection.id);END LOOP;
 RETURN NULL;
END $$;
-- Strengthen source approval: issued registry data must match its same-tx audit.
CREATE OR REPLACE FUNCTION pos_loyalty_registry_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected text;
BEGIN
 expected:=CASE WHEN TG_OP='INSERT' THEN 'issued' ELSE 'revoked' END;
 IF NOT EXISTS(SELECT 1 FROM "AuditLog" a WHERE a."organizationId"=NEW."organizationId" AND a."entityType"=TG_TABLE_NAME AND a."entityId"=NEW.id AND a.action='loyalty_registry_'||expected AND a.xmin::text::bigint=txid_current()%4294967296 AND pos_loyalty_owner(a."organizationId",a."actorId") AND (TG_OP<>'INSERT' OR (a."actorId"=NEW."createdBy" AND a."afterData"->>'code'=NEW.code AND a."afterData"->>'policyVersionId'=NEW."policyVersionId" AND (a."afterData"->'configuration') IS NOT DISTINCT FROM (to_jsonb(NEW)->'configuration') AND (a."afterData"->>'customerId') IS NOT DISTINCT FROM (to_jsonb(NEW)->>'customerId')))) THEN RAISE EXCEPTION 'LOYALTY_REGISTRY_PROOF_REQUIRED' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION pos_loyalty_benefit_cancel_actor() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale "Sale";
BEGIN
 IF NEW.state<>'cancelled' OR OLD.state<>'prepared' THEN RETURN NULL;END IF;
 SELECT * INTO sale FROM "Sale" WHERE id=NEW."saleId";
 IF sale.status='voided' THEN RETURN NULL;END IF;
 IF NOT auth_restore_ready() OR NOT EXISTS(SELECT 1 FROM "AuditLog" a JOIN "Session" s ON s.id=a."afterData"->>'sessionId' AND s."userId"=a."actorId" AND s."organizationId"=a."organizationId" JOIN "User" u ON u.id=a."actorId" JOIN "OrganizationUser" m ON m."userId"=u.id AND m."organizationId"=a."organizationId" WHERE a."organizationId"=NEW."organizationId" AND a."entityType"='LoyaltyBenefitSelection' AND a."entityId"=NEW.id AND a.action='loyalty_benefit_cancelled' AND a.xmin::text::bigint=txid_current()%4294967296 AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp() AND u."isActive" AND m."isActive" AND (m.role='owner' OR EXISTS(SELECT 1 FROM "UserStore" WHERE "organizationUserId"=m.id AND "storeId"=sale."storeId")) AND (m.role<>'cashier' OR sale."cashierId"=u.id)) THEN RAISE EXCEPTION 'LOYALTY_ACTOR_CHANGED' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER loyalty_benefit_cancel_actor AFTER UPDATE ON "LoyaltyBenefitSelection" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_loyalty_benefit_cancel_actor();
COMMIT;
