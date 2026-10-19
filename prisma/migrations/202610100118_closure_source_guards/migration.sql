BEGIN;
ALTER TABLE "OrganizationClosure" ADD CONSTRAINT closure_cancellation_reason_required CHECK ("cancelledAt" IS NULL OR "cancellationReason" IS NOT NULL);
CREATE OR REPLACE FUNCTION organization_closure_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE org TEXT;actor TEXT;days INTEGER; BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'CLOSURE_HISTORY_IMMUTABLE';END IF;RETURN OLD;
 END IF;
 org=NEW."organizationId";
 PERFORM id FROM "Organization" WHERE id=org FOR UPDATE;
 IF TG_OP='INSERT' THEN
  actor=NEW."requestedBy";
  IF NEW."cancelledAt" IS NOT NULL THEN RAISE EXCEPTION 'CLOSURE_HISTORY_IMMUTABLE';END IF;
  IF NOT EXISTS(SELECT 1 FROM "JobExport" e JOIN "BackgroundJob" j ON j.id=e."jobId" AND j."organizationId"=e."organizationId" WHERE e."jobId"=NEW."exportJobId" AND e."organizationId"=org AND j.type='tenant_export' AND j.state='succeeded' AND e.data IS NOT NULL AND e."expiresAt">(clock_timestamp() AT TIME ZONE 'UTC') AND e.sha256=NEW."exportSha256") OR NOT EXISTS(SELECT 1 FROM "AuditLog" WHERE "organizationId"=org AND "actorId"=actor AND "entityType"='BackgroundJob' AND "entityId"=NEW."exportJobId" AND action='export_downloaded') THEN RAISE EXCEPTION 'CLOSURE_EXPORT_REQUIRED';END IF;
  SELECT "closureCancellationDays" INTO days FROM "RetentionPolicyVersion" WHERE id=NEW."policyVersionId";
  IF NEW."cancellationDays" IS DISTINCT FROM days THEN RAISE EXCEPTION 'CLOSURE_POLICY_INVALID';END IF;
  IF EXISTS(SELECT 1 FROM "Shift" sh JOIN "Register" r ON r.id=sh."registerId" JOIN "Store" st ON st.id=r."storeId" WHERE st."organizationId"=org AND sh.status='open')
  OR EXISTS(SELECT 1 FROM "Sale" WHERE "organizationId"=org AND status='draft')
  OR EXISTS(SELECT 1 FROM "ProviderIntent" WHERE "organizationId"=org AND state NOT IN ('confirmed','compensated','failed'))
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
COMMIT;
