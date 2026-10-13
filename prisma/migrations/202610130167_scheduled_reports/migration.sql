BEGIN;
-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "configuration" JSONB NOT NULL,
    "grantMembershipId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "nextRunAt" TIMESTAMP(3),
    "blockedCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportScheduleRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "definition" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "result" JSONB,
    "size" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportScheduleRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportSchedule_enabled_nextRunAt_idx" ON "ReportSchedule"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "ReportSchedule_organizationId_createdAt_idx" ON "ReportSchedule"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSchedule_id_organizationId_key" ON "ReportSchedule"("id", "organizationId");

-- CreateIndex
CREATE INDEX "ReportScheduleRun_organizationId_createdAt_idx" ON "ReportScheduleRun"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportScheduleRun_state_nextAttemptAt_idx" ON "ReportScheduleRun"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ReportScheduleRun_expiresAt_idx" ON "ReportScheduleRun"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportScheduleRun_scheduleId_revision_scheduledFor_key" ON "ReportScheduleRun"("scheduleId", "revision", "scheduledFor");

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_grantMembershipId_fkey" FOREIGN KEY ("grantMembershipId") REFERENCES "OrganizationUser"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReportScheduleRun" ADD CONSTRAINT "ReportScheduleRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportScheduleRun" ADD CONSTRAINT "ReportScheduleRun_scheduleId_organizationId_fkey" FOREIGN KEY ("scheduleId", "organizationId") REFERENCES "ReportSchedule"("id", "organizationId") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "ReportSchedule" ADD CONSTRAINT report_schedule_values CHECK (length(name) BETWEEN 2 AND 200 AND revision>0 AND timezone='Asia/Tashkent' AND currency='UZS' AND enabled=("nextRunAt" IS NOT NULL));
ALTER TABLE "ReportScheduleRun" ADD CONSTRAINT report_run_values CHECK (state IN ('queued','running','succeeded','dead','cancelled') AND attempts BETWEEN 0 AND 3 AND size BETWEEN 0 AND 4194304 AND revision>0 AND "expiresAt">"createdAt" AND ((state='running' AND "leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL) OR (state<>'running' AND "leaseToken" IS NULL AND "leaseUntil" IS NULL)) AND ((state IN ('succeeded','dead','cancelled'))=("finishedAt" IS NOT NULL)) AND (state='succeeded' OR (result IS NULL AND size=0)));
CREATE FUNCTION report_schedule_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m "OrganizationUser"; o "Organization"; policy_change BOOLEAN; stopping BOOLEAN;
BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'REPORT_SCHEDULE_HISTORY_IMMUTABLE';END IF;RETURN OLD;END IF;
 SELECT * INTO m FROM "OrganizationUser" WHERE id=NEW."grantMembershipId";
 SELECT * INTO o FROM "Organization" WHERE id=NEW."organizationId";
 IF m.id IS NULL OR m."organizationId"<>NEW."organizationId" OR o.id IS NULL THEN RAISE EXCEPTION 'REPORT_GRANT_TENANT_INVALID';END IF;
 IF jsonb_typeof(NEW.configuration)<>'object' OR (NEW.configuration-ARRAY['cadence','report','retentionHours','missedRunPolicy'])<>'{}'::jsonb OR NOT(NEW.configuration ?& ARRAY['cadence','report','retentionHours','missedRunPolicy']) OR jsonb_typeof(NEW.configuration->'cadence')<>'object' OR jsonb_typeof(NEW.configuration->'report')<>'object' OR NEW.configuration->>'missedRunPolicy' NOT IN ('latest_only','catch_up') OR (NEW.configuration->>'retentionHours')::integer NOT BETWEEN 1 AND 720 THEN RAISE EXCEPTION 'REPORT_CONFIGURATION_INVALID';END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.revision<>1 OR NEW."blockedCode" IS NOT NULL THEN RAISE EXCEPTION 'REPORT_INITIAL_REVISION_INVALID';END IF;
  NEW."createdAt":=CURRENT_TIMESTAMP::timestamp(3);policy_change:=true;stopping:=false;
 ELSE
  IF NEW.id<>OLD.id OR NEW."organizationId"<>OLD."organizationId" OR NEW."createdAt"<>OLD."createdAt" THEN RAISE EXCEPTION 'REPORT_SCHEDULE_IDENTITY_IMMUTABLE';END IF;
  policy_change:=(to_jsonb(NEW)-ARRAY['nextRunAt','blockedCode','updatedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['nextRunAt','blockedCode','updatedAt']);
  stopping:=OLD.enabled AND NOT NEW.enabled AND (to_jsonb(NEW)-ARRAY['enabled','revision','nextRunAt','blockedCode','updatedAt'])=(to_jsonb(OLD)-ARRAY['enabled','revision','nextRunAt','blockedCode','updatedAt']);
  IF policy_change AND NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'REPORT_REVISION_INVALID';END IF;
  IF NOT policy_change AND NEW."nextRunAt" IS DISTINCT FROM OLD."nextRunAt" AND (NOT OLD.enabled OR NEW."nextRunAt"<=OLD."nextRunAt" OR NOT EXISTS(SELECT 1 FROM "ReportScheduleRun" WHERE "scheduleId"=OLD.id AND revision=OLD.revision AND "scheduledFor"=OLD."nextRunAt")) THEN RAISE EXCEPTION 'REPORT_ADVANCE_WITHOUT_OCCURRENCE';END IF;
 END IF;
 IF policy_change AND NOT stopping THEN
  PERFORM assert_business_writable(NEW."organizationId");
  IF NOT m."isActive" OR m.role<>'owner' OR m."customRoleId" IS NOT NULL OR NOT EXISTS(SELECT 1 FROM "User" WHERE id=m."userId" AND "isActive") OR NEW.timezone<>o.timezone OR NEW.currency<>o."currencyCode" THEN RAISE EXCEPTION 'REPORT_OWNER_GRANT_REQUIRED';END IF;
 END IF;
 NEW."updatedAt":=CURRENT_TIMESTAMP::timestamp(3);RETURN NEW;
END $$;
CREATE TRIGGER report_schedule_guard BEFORE INSERT OR UPDATE OR DELETE ON "ReportSchedule" FOR EACH ROW EXECUTE FUNCTION report_schedule_guard();
CREATE FUNCTION report_schedule_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE stopping BOOLEAN;
BEGIN
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['nextRunAt','blockedCode','updatedAt'])=(to_jsonb(OLD)-ARRAY['nextRunAt','blockedCode','updatedAt']) THEN RETURN NULL;END IF;
 stopping:=TG_OP='UPDATE' AND OLD.enabled AND NOT NEW.enabled AND (to_jsonb(NEW)-ARRAY['enabled','revision','nextRunAt','blockedCode','updatedAt'])=(to_jsonb(OLD)-ARRAY['enabled','revision','nextRunAt','blockedCode','updatedAt']);
 IF NOT EXISTS(SELECT 1 FROM "AuditLog" a JOIN "OrganizationUser" m ON m."organizationId"=a."organizationId" AND m."userId"=a."actorId" JOIN "User" u ON u.id=m."userId" WHERE a."organizationId"=NEW."organizationId" AND a."entityType"='ReportSchedule' AND a."entityId"=NEW.id AND a.action=(CASE WHEN stopping THEN 'report_schedule_stopped' ELSE 'report_schedule_configured' END) AND m.role='owner' AND m."isActive" AND u."isActive" AND m."customRoleId" IS NULL AND (stopping OR m.id=NEW."grantMembershipId") AND a.xmin::text::bigint=txid_current()%4294967296 AND a."afterData"->>'revision'=NEW.revision::text AND (a."afterData"->>'enabled')::boolean=NEW.enabled AND a."afterData"->>'name'=NEW.name AND a."afterData"->'configuration'=NEW.configuration AND a."afterData"->>'grantMembershipId'=NEW."grantMembershipId" AND a."afterData"->>'timezone'=NEW.timezone AND a."afterData"->>'currency'=NEW.currency) THEN RAISE EXCEPTION 'REPORT_OWNER_PROOF_REQUIRED';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER report_schedule_proof AFTER INSERT OR UPDATE ON "ReportSchedule" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION report_schedule_proof();
CREATE FUNCTION report_run_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s "ReportSchedule"; snapshot JSONB; valid BOOLEAN;
BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'REPORT_RUN_HISTORY_IMMUTABLE';END IF;RETURN OLD;END IF;
 IF TG_OP='INSERT' THEN
  SELECT * INTO s FROM "ReportSchedule" WHERE id=NEW."scheduleId";
  snapshot:=jsonb_build_object('name',s.name,'configuration',s.configuration,'grantMembershipId',s."grantMembershipId",'timezone',s.timezone,'currency',s.currency);
  IF s.id IS NULL OR s."organizationId"<>NEW."organizationId" OR NOT s.enabled OR NEW.revision<>s.revision OR NEW."scheduledFor"<>s."nextRunAt" OR NEW."scheduledFor">clock_timestamp() AT TIME ZONE 'UTC' OR NEW.definition<>snapshot OR NEW.state<>'queued' OR NEW.attempts<>0 OR NEW.result IS NOT NULL OR NEW.size<>0 OR NEW."finishedAt" IS NOT NULL OR NEW."leaseToken" IS NOT NULL OR NEW."leaseUntil" IS NOT NULL THEN RAISE EXCEPTION 'REPORT_OCCURRENCE_INVALID';END IF;
  NEW."createdAt":=CURRENT_TIMESTAMP::timestamp(3);NEW."expiresAt":=NEW."createdAt"+make_interval(hours=>(s.configuration->>'retentionHours')::integer);RETURN NEW;
 END IF;
 IF (to_jsonb(NEW)-ARRAY['state','attempts','leaseToken','leaseUntil','nextAttemptAt','lastError','result','size','finishedAt'])<>(to_jsonb(OLD)-ARRAY['state','attempts','leaseToken','leaseUntil','nextAttemptAt','lastError','result','size','finishedAt']) THEN RAISE EXCEPTION 'REPORT_RUN_IDENTITY_IMMUTABLE';END IF;
 IF OLD.state IN ('succeeded','dead','cancelled') THEN
  IF to_jsonb(NEW)=to_jsonb(OLD) THEN RETURN NEW;END IF;
  IF OLD.state='succeeded' AND OLD.result IS NOT NULL AND NEW.result IS NULL AND clock_timestamp() AT TIME ZONE 'UTC'>=OLD."expiresAt" AND (to_jsonb(NEW)-'result')=(to_jsonb(OLD)-'result') THEN RETURN NEW;END IF;
  RAISE EXCEPTION 'REPORT_RESULT_IMMUTABLE';
 END IF;
 IF OLD.state='queued' AND NEW.state='running' THEN
  IF NEW.attempts<>OLD.attempts+1 OR NEW.attempts>3 OR NEW."leaseToken" IS NULL OR NEW."leaseUntil"<=clock_timestamp() AT TIME ZONE 'UTC' OR OLD."nextAttemptAt">clock_timestamp() AT TIME ZONE 'UTC' OR OLD."expiresAt"<=clock_timestamp() AT TIME ZONE 'UTC' THEN RAISE EXCEPTION 'REPORT_CLAIM_INVALID';END IF;
 ELSIF OLD.state='running' AND NEW.state='running' THEN
  IF NEW.attempts<>OLD.attempts OR NEW."leaseToken"<>OLD."leaseToken" OR OLD."leaseUntil"<=clock_timestamp() AT TIME ZONE 'UTC' OR NEW."leaseUntil"<OLD."leaseUntil" OR (to_jsonb(NEW)-'leaseUntil')<>(to_jsonb(OLD)-'leaseUntil') THEN RAISE EXCEPTION 'REPORT_HEARTBEAT_INVALID';END IF;
 ELSIF NEW.state='succeeded' THEN
  IF OLD.state<>'running' OR OLD."leaseUntil"<=clock_timestamp() AT TIME ZONE 'UTC' OR OLD."expiresAt"<=clock_timestamp() AT TIME ZONE 'UTC' OR NEW.attempts<>OLD.attempts OR jsonb_typeof(NEW.result) IS DISTINCT FROM 'object' OR NEW.result->>'organizationId' IS DISTINCT FROM NEW."organizationId" OR NEW.result->>'version' IS DISTINCT FROM '1' OR (NEW.result->>'scheduledFor')::timestamptz AT TIME ZONE 'UTC'<>NEW."scheduledFor" OR NEW."finishedAt" IS NULL THEN RAISE EXCEPTION 'REPORT_FINISH_INVALID';END IF;
  SELECT TRUE INTO valid FROM "ReportSchedule" p JOIN "OrganizationUser" m ON m.id=p."grantMembershipId" JOIN "User" u ON u.id=m."userId" JOIN "Organization" o ON o.id=p."organizationId" WHERE p.id=NEW."scheduleId" AND p."organizationId"=NEW."organizationId" AND p.enabled AND p.revision=NEW.revision AND p.configuration=NEW.definition->'configuration' AND p."grantMembershipId"=NEW.definition->>'grantMembershipId' AND p.timezone=NEW.definition->>'timezone' AND p.currency=NEW.definition->>'currency' AND m."organizationId"=p."organizationId" AND m.role='owner' AND m."isActive" AND m."customRoleId" IS NULL AND u."isActive" AND o.timezone=p.timezone AND o."currencyCode"=p.currency AND auth_restore_ready() FOR SHARE OF p,m,u,o;
  IF valid IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'REPORT_AUTHORIZATION_CHANGED';END IF;
  NEW.size:=octet_length(NEW.result::text);
 ELSIF NEW.state IN ('queued','dead','cancelled') THEN
  IF NEW.attempts<>OLD.attempts OR NEW."leaseToken" IS NOT NULL OR NEW."leaseUntil" IS NOT NULL OR NEW.result IS NOT NULL OR NEW.size<>0 OR (NEW.state='queued' AND (OLD.state<>'running' OR NEW.attempts>=3 OR NEW."nextAttemptAt"<clock_timestamp() AT TIME ZONE 'UTC')) THEN RAISE EXCEPTION 'REPORT_RETRY_INVALID';END IF;
 ELSE RAISE EXCEPTION 'REPORT_TRANSITION_INVALID';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER report_run_guard BEFORE INSERT OR UPDATE OR DELETE ON "ReportScheduleRun" FOR EACH ROW EXECUTE FUNCTION report_run_guard();
-- Preserve the current operation admission function and add only the privacy
-- stop exception. Enabling/changing report policies stays writable-only.
DO $$ DECLARE definition TEXT;BEGIN
 definition:=pg_get_functiondef('subscription_operation_guard()'::regprocedure);
 IF position('''report.schedule.stop''' IN definition)=0 THEN
  IF position('''job.enqueue'',''job.retry''' IN definition)=0 THEN RAISE EXCEPTION 'REPORT_OPERATION_GUARD_UNREVIEWED';END IF;
  definition:=replace(definition,'''job.enqueue'',''job.retry''','''job.enqueue'',''job.retry'',''report.schedule.stop''');EXECUTE definition;
 END IF;
END $$;
COMMIT;
