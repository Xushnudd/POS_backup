BEGIN;
ALTER TABLE "Organization" ADD COLUMN "closureRevision" INTEGER NOT NULL DEFAULT 0 CHECK ("closureRevision">=0);
CREATE TABLE "OrganizationClosure" (
 id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
 "policyVersionId" TEXT NOT NULL REFERENCES "RetentionPolicyVersion"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 "requestedBy" TEXT NOT NULL,"requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "cancellationDays" INTEGER NOT NULL CHECK ("cancellationDays" BETWEEN 1 AND 365), "cancellationEndsAt" TIMESTAMP(3) NOT NULL,
 "exportJobId" TEXT NOT NULL,"exportSha256" TEXT NOT NULL CHECK ("exportSha256" ~ '^[0-9a-f]{64}$'),reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 2000),
 "cancelledAt" TIMESTAMP(3),"cancelledBy" TEXT,"cancellationReason" TEXT,
 CHECK ("cancellationEndsAt"="requestedAt"+make_interval(days=>"cancellationDays")),
 CHECK (("cancelledAt" IS NULL AND "cancelledBy" IS NULL AND "cancellationReason" IS NULL) OR
 ("cancelledAt" IS NOT NULL AND "cancelledBy" IS NOT NULL AND length(btrim("cancellationReason")) BETWEEN 3 AND 2000 AND "cancelledAt">="requestedAt" AND "cancelledAt"<"cancellationEndsAt"))
);
CREATE INDEX "OrganizationClosure_organizationId_requestedAt_id_idx" ON "OrganizationClosure"("organizationId","requestedAt",id);
CREATE UNIQUE INDEX "OrganizationClosure_active_unique" ON "OrganizationClosure"("organizationId") WHERE "cancelledAt" IS NULL;
CREATE OR REPLACE FUNCTION assert_business_writable(org TEXT) RETURNS void LANGUAGE plpgsql AS $$ DECLARE ends TIMESTAMP;grace INTEGER; BEGIN
 PERFORM id FROM "Organization" WHERE id=org FOR SHARE;
 PERFORM id FROM "OrganizationClosure" WHERE "organizationId"=org AND "cancelledAt" IS NULL FOR SHARE;
 IF FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ORGANIZATION_CLOSING';END IF;
 SELECT GREATEST(s."trialEndsAt",COALESCE(s."paidThrough",s."trialEndsAt")),v."graceDays" INTO ends,grace FROM "OrganizationSubscription" s JOIN "BillingPlanVersion" v ON v.id=s."planVersionId" WHERE s."organizationId"=org FOR SHARE OF s;
 IF FOUND AND (clock_timestamp() AT TIME ZONE 'UTC')>=ends+make_interval(days=>grace) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SUBSCRIPTION_EXPIRED';END IF;
END $$;
CREATE OR REPLACE FUNCTION subscription_business_write_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE old_org TEXT;new_org TEXT; BEGIN
 IF TG_TABLE_NAME='Organization' AND TG_OP='UPDATE' THEN
  IF NEW."closureRevision" IS DISTINCT FROM OLD."closureRevision" THEN
   IF pg_trigger_depth()>1 AND NEW."closureRevision"=OLD."closureRevision"+1 AND (to_jsonb(OLD)-'closureRevision')=(to_jsonb(NEW)-'closureRevision') THEN RETURN NEW;END IF;
   RAISE EXCEPTION 'CLOSURE_REVISION_IMMUTABLE';
  END IF;
 END IF;
 -- Only expiry of already elapsed manual reservations is housekeeping, never cash-ticket reconciliation.
 IF TG_TABLE_NAME='StockReservation' THEN
 IF TG_OP='UPDATE' AND OLD.kind='manual' AND OLD.status='active' AND NEW.status='expired' AND OLD."expiresAt"<=(clock_timestamp() AT TIME ZONE 'UTC') AND (to_jsonb(OLD)-'status')=(to_jsonb(NEW)-'status') THEN RETURN NEW;END IF;
 END IF;
 IF TG_TABLE_NAME='ReservationItem' THEN
 IF TG_OP='UPDATE' AND NEW."remainingQuantity"=0 AND (to_jsonb(OLD)-'remainingQuantity')=(to_jsonb(NEW)-'remainingQuantity') AND EXISTS(SELECT 1 FROM "StockReservation" r WHERE r.id=OLD."reservationId" AND r.kind='manual' AND r.status='active' AND r."expiresAt"<=(clock_timestamp() AT TIME ZONE 'UTC')) THEN RETURN NEW;END IF;
 END IF;
 IF TG_TABLE_NAME='ReservationEntry' THEN
 IF TG_OP='INSERT' AND NEW.kind='expire' AND NEW."actorId" IS NULL AND EXISTS(SELECT 1 FROM "ReservationItem" i JOIN "StockReservation" r ON r.id=i."reservationId" WHERE i.id=NEW."itemId" AND i."organizationId"=NEW."organizationId" AND i."storeId"=NEW."storeId" AND i."remainingQuantity"=NEW.quantity AND r.kind='manual' AND r.status='active' AND r."expiresAt"<=(clock_timestamp() AT TIME ZONE 'UTC') AND NEW."operationKey"=r.id||':expired') THEN RETURN NEW;END IF;
 END IF;
 IF TG_OP<>'INSERT' THEN old_org=business_row_organization(TG_TABLE_NAME,to_jsonb(OLD));END IF;
 IF TG_OP<>'DELETE' THEN new_org=business_row_organization(TG_TABLE_NAME,to_jsonb(NEW));END IF;
 -- Parent organization deletion is not implemented by the app; cascade cleanup has no live tenant.
 IF old_org IS NOT NULL AND EXISTS(SELECT 1 FROM "Organization" WHERE id=old_org) THEN PERFORM assert_business_writable(old_org);END IF;
 IF new_org IS NOT NULL AND new_org IS DISTINCT FROM old_org AND EXISTS(SELECT 1 FROM "Organization" WHERE id=new_org) THEN PERFORM assert_business_writable(new_org);END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $$;
CREATE OR REPLACE FUNCTION subscription_operation_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 -- A cancelled unposted draft reserves only actor/hash identity, never economics.
 IF NEW.type='sale.create' AND NEW.state='cancelled' AND NEW."actorId" IS NOT NULL AND NEW.result='{"cancelled":true}'::jsonb THEN RETURN NEW;END IF;
 IF NEW.type NOT IN ('retention.closure.request','retention.closure.cancel','billing.plan.publish','billing.plan.assign','billing.invoice.create','billing.invoice.cancel','billing.payment.confirm','billing.subscription.cancel','billing.cost.record','billing.cost.cancel','retention.policy.publish','job.enqueue','job.retry','support.grant','support.revoke','support.ticket.create','support.ticket.command','support.policy.publish','security_notice_read','security_notice_retry') THEN PERFORM assert_business_writable(NEW."organizationId");END IF; RETURN NEW;END $$;

CREATE FUNCTION organization_closure_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE org TEXT;actor TEXT;days INTEGER; BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'CLOSURE_HISTORY_IMMUTABLE';END IF;RETURN OLD;
 END IF;
 org=NEW."organizationId";
 PERFORM id FROM "Organization" WHERE id=org FOR UPDATE;
 IF TG_OP='INSERT' THEN
  actor=NEW."requestedBy";
  IF NEW."cancelledAt" IS NOT NULL THEN RAISE EXCEPTION 'CLOSURE_HISTORY_IMMUTABLE';END IF;
  SELECT "closureCancellationDays" INTO days FROM "RetentionPolicyVersion" WHERE id=NEW."policyVersionId";
  IF NEW."cancellationDays" IS DISTINCT FROM days THEN RAISE EXCEPTION 'CLOSURE_POLICY_INVALID';END IF;
  IF EXISTS(SELECT 1 FROM "Shift" sh JOIN "Register" r ON r.id=sh."registerId" JOIN "Store" st ON st.id=r."storeId" WHERE st."organizationId"=org AND sh.status='open')
  OR EXISTS(SELECT 1 FROM "Sale" WHERE "organizationId"=org AND status='draft')
  OR EXISTS(SELECT 1 FROM "ProviderIntent" WHERE "organizationId"=org AND state NOT IN ('confirmed','cancelled','failed'))
  OR EXISTS(SELECT 1 FROM "OfflineCashLease" WHERE "organizationId"=org AND state='issued') THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='CLOSURE_ACTIVE_WORK';END IF;
 ELSE
  actor=NEW."cancelledBy";
  IF OLD."cancelledAt" IS NOT NULL OR NEW."cancelledAt" IS NULL OR
    (to_jsonb(OLD)-ARRAY['cancelledAt','cancelledBy','cancellationReason']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['cancelledAt','cancelledBy','cancellationReason']) THEN RAISE EXCEPTION 'CLOSURE_HISTORY_IMMUTABLE';END IF;
  IF (clock_timestamp() AT TIME ZONE 'UTC')>=OLD."cancellationEndsAt" THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='CLOSURE_CANCELLATION_EXPIRED';END IF;
 END IF;
 PERFORM m.id FROM "OrganizationUser" m JOIN "User" u ON u.id=m."userId" WHERE m."organizationId"=org AND m."userId"=actor AND m.role='owner' AND m."isActive" AND u."isActive" FOR SHARE OF m,u;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOSURE_OWNER_REQUIRED';END IF;
 -- An actual tuple change fences stale SERIALIZABLE snapshots waiting on the
 -- tenant lock, including the absence of a closure before its first insertion.
 UPDATE "Organization" SET "closureRevision"="closureRevision"+1 WHERE id=org;
 RETURN NEW;
END $$;
CREATE TRIGGER organization_closure BEFORE INSERT OR UPDATE OR DELETE ON "OrganizationClosure" FOR EACH ROW EXECUTE FUNCTION organization_closure_guard();
COMMIT;
