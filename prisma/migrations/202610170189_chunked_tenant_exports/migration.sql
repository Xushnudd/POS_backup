BEGIN;
ALTER TABLE "JobExport" ADD COLUMN "chunkCount" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "chunkAttempt" TEXT;
ALTER TABLE "JobExport" DROP CONSTRAINT "JobExport_size_check",
 DROP CONSTRAINT "JobExport_rowCount_check";
ALTER TABLE "JobExport" ADD CONSTRAINT "JobExport_storage_check" CHECK (
 ("chunkCount"=0 AND "chunkAttempt" IS NULL AND size BETWEEN 1 AND 16777216 AND "rowCount" BETWEEN 0 AND 100000)
 OR ("chunkCount" BETWEEN 1 AND 4096 AND "chunkAttempt" IS NOT NULL AND data IS NULL AND size BETWEEN 1 AND 1073741824 AND "rowCount" BETWEEN 0 AND 10000000));
CREATE TABLE "JobExportChunk" (
 "jobId" TEXT NOT NULL, "organizationId" TEXT NOT NULL, attempt TEXT NOT NULL,
 ordinal INTEGER NOT NULL CHECK(ordinal BETWEEN 0 AND 4095),
 data BYTEA NOT NULL, size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 262144),
 sha256 TEXT NOT NULL CHECK(sha256=encode(sha256(data),'hex')),
 PRIMARY KEY("jobId",attempt,ordinal),
 FOREIGN KEY("jobId","organizationId") REFERENCES "BackgroundJob"(id,"organizationId") ON DELETE CASCADE ON UPDATE NO ACTION,
 CHECK(octet_length(data)=size));
CREATE INDEX "JobExportChunk_organizationId_idx" ON "JobExportChunk"("organizationId");
CREATE FUNCTION job_export_chunk_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE j "BackgroundJob"; BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Export chunks immutable';END IF;
 IF TG_OP='INSERT' THEN
  SELECT * INTO j FROM "BackgroundJob" WHERE id=NEW."jobId" AND "organizationId"=NEW."organizationId" FOR SHARE;
  IF j.id IS NULL OR j.type<>'tenant_export' OR j.state<>'running' OR j."leaseToken" IS DISTINCT FROM NEW.attempt OR j."leaseUntil"<=clock_timestamp() OR j."expiresAt"<=clock_timestamp() OR EXISTS(SELECT 1 FROM "JobExport" WHERE "jobId"=j.id) THEN RAISE EXCEPTION 'JOB_LEASE_LOST';END IF;
  RETURN NEW;
 END IF;
 -- Root cascade is allowed only after the owning organization is gone.
 IF NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
 SELECT * INTO j FROM "BackgroundJob" WHERE id=OLD."jobId" FOR SHARE;
 IF EXISTS(SELECT 1 FROM "JobExport" WHERE "jobId"=OLD."jobId" AND "chunkAttempt"=OLD.attempt AND "expiresAt">clock_timestamp())
 OR (j.state='running' AND j."leaseToken"=OLD.attempt AND j."leaseUntil">clock_timestamp() AND j."expiresAt">clock_timestamp() AND NOT EXISTS(SELECT 1 FROM "JobExport" WHERE "jobId"=OLD."jobId")) THEN RAISE EXCEPTION 'Export chunks retained';END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER job_export_chunk_guard BEFORE INSERT OR UPDATE OR DELETE ON "JobExportChunk" FOR EACH ROW EXECUTE FUNCTION job_export_chunk_guard();
CREATE OR REPLACE FUNCTION job_export_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE chunks BIGINT;bytes BIGINT;last_ordinal INTEGER; BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM id FROM "BackgroundJob" WHERE id=NEW."jobId" AND "organizationId"=NEW."organizationId" AND type IN ('catalog_export','tenant_export','report_export') AND state='running' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Export requires scoped running export job';END IF;
  IF NEW."chunkCount">0 THEN
   IF NOT EXISTS(SELECT 1 FROM "BackgroundJob" WHERE id=NEW."jobId" AND type='tenant_export' AND "leaseToken"=NEW."chunkAttempt" AND "leaseUntil">clock_timestamp() AND "expiresAt">clock_timestamp()) THEN RAISE EXCEPTION 'JOB_LEASE_LOST';END IF;
   SELECT count(*),sum(size),max(ordinal) INTO chunks,bytes,last_ordinal FROM "JobExportChunk" WHERE "jobId"=NEW."jobId" AND attempt=NEW."chunkAttempt";
   IF chunks<>NEW."chunkCount" OR bytes<>NEW.size OR last_ordinal<>NEW."chunkCount"-1 THEN RAISE EXCEPTION 'EXPORT_CORRUPTED';END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "BackgroundJob" j JOIN "Organization" o ON o.id=j."organizationId" WHERE j.id=OLD."jobId") THEN RAISE EXCEPTION 'Export history immutable';END IF;RETURN OLD;END IF;
 IF (to_jsonb(NEW)-'data') IS DISTINCT FROM (to_jsonb(OLD)-'data') OR NOT(OLD."expiresAt"<=clock_timestamp() AND NEW.data IS NULL) THEN RAISE EXCEPTION 'Export immutable until expiry erasure';END IF;RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION organization_closure_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE org TEXT;actor TEXT;days INTEGER; BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'CLOSURE_HISTORY_IMMUTABLE';END IF;RETURN OLD;
 END IF;
 org=NEW."organizationId";
 PERFORM id FROM "Organization" WHERE id=org FOR UPDATE;
 IF TG_OP='INSERT' THEN
  actor=NEW."requestedBy";
  IF NEW."cancelledAt" IS NOT NULL THEN RAISE EXCEPTION 'CLOSURE_HISTORY_IMMUTABLE';END IF;
  IF NOT EXISTS(SELECT 1 FROM "JobExport" e JOIN "BackgroundJob" j ON j.id=e."jobId" AND j."organizationId"=e."organizationId" WHERE e."jobId"=NEW."exportJobId" AND e."organizationId"=org AND j.type='tenant_export' AND j.state='succeeded' AND (e.data IS NOT NULL OR e."chunkCount">0) AND e."expiresAt">(clock_timestamp() AT TIME ZONE 'UTC') AND e.sha256=NEW."exportSha256") OR NOT EXISTS(SELECT 1 FROM "AuditLog" WHERE "organizationId"=org AND "actorId"=actor AND "entityType"='BackgroundJob' AND "entityId"=NEW."exportJobId" AND action='export_downloaded') THEN RAISE EXCEPTION 'CLOSURE_EXPORT_REQUIRED';END IF;
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
