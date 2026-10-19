CREATE TABLE "BackgroundJob" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 type TEXT NOT NULL CHECK(type IN ('reconciliation')),payload JSONB NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=4000),
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','succeeded','dead','cancelled')),
 generation INTEGER NOT NULL DEFAULT 0 CHECK(generation BETWEEN 0 AND 9),attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 30),"maxAttempts" INTEGER NOT NULL DEFAULT 3 CHECK("maxAttempts" BETWEEN 3 AND 30 AND attempts<="maxAttempts"),
 "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"leaseToken" TEXT,"leaseUntil" TIMESTAMP(3),"heartbeatAt" TIMESTAMP(3),"lastError" TEXT,result JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"expiresAt" TIMESTAMP(3) NOT NULL,
 CHECK((state='running' AND "leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL AND "heartbeatAt" IS NOT NULL) OR (state<>'running' AND "leaseToken" IS NULL AND "leaseUntil" IS NULL)),
 CHECK("lastError" IS NULL OR "lastError" IN ('WORK_FAILED','LEASE_EXPIRED','AUTHORIZATION_CHANGED','JOB_EXPIRED'))
);
CREATE INDEX "BackgroundJob_state_nextRunAt_idx" ON "BackgroundJob"(state,"nextRunAt");
CREATE INDEX "BackgroundJob_organizationId_createdAt_idx" ON "BackgroundJob"("organizationId","createdAt");
CREATE TABLE "JobAuthorization" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "jobId" TEXT NOT NULL REFERENCES "BackgroundJob"(id) ON DELETE CASCADE,generation INTEGER NOT NULL CHECK(generation BETWEEN 0 AND 9),
 "userId" TEXT NOT NULL REFERENCES "User"(id),"sessionId" TEXT NOT NULL REFERENCES "Session"(id),reason TEXT NOT NULL CHECK(length(reason) BETWEEN 3 AND 2000),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE("jobId",generation)
);
CREATE TABLE "JobEvent" (
 id TEXT PRIMARY KEY,"jobId" TEXT NOT NULL REFERENCES "BackgroundJob"(id) ON DELETE CASCADE,
 event TEXT NOT NULL CHECK(event IN ('queued','claimed','heartbeat','succeeded','retry','dead','cancelled','lease_lost','manual_retry')),
 attempt INTEGER NOT NULL CHECK(attempt BETWEEN 0 AND 30),generation INTEGER NOT NULL CHECK(generation BETWEEN 0 AND 9),code TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "JobEvent_jobId_createdAt_idx" ON "JobEvent"("jobId","createdAt");
CREATE FUNCTION job_authorization_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "BackgroundJob" j JOIN "Organization" o ON o.id=j."organizationId" WHERE j.id=OLD."jobId") THEN RAISE EXCEPTION 'Job authorization immutable';END IF;RETURN OLD;END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Job authorization immutable';END IF;
 IF NOT EXISTS(SELECT 1 FROM "BackgroundJob" j JOIN "Session" s ON s.id=NEW."sessionId" JOIN "OrganizationUser" m ON m."userId"=s."userId" AND m."organizationId"=s."organizationId" JOIN "User" u ON u.id=m."userId" WHERE j.id=NEW."jobId" AND j."organizationId"=NEW."organizationId" AND s."organizationId"=NEW."organizationId" AND s."userId"=NEW."userId" AND s."revokedAt" IS NULL AND s."expiresAt">NOW() AND s."idleExpiresAt">NOW() AND m.role='owner' AND m."isActive" AND u."isActive" AND (NEW.generation=j.generation OR (j.state='dead' AND NEW.generation=j.generation+1))) THEN RAISE EXCEPTION 'Job authorization scope/session invalid';END IF;RETURN NEW;
END $$;
CREATE TRIGGER job_authorization_guard BEFORE INSERT OR UPDATE OR DELETE ON "JobAuthorization" FOR EACH ROW EXECUTE FUNCTION job_authorization_guard();
CREATE FUNCTION background_job_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'Job history immutable';END IF;RETURN OLD;END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.id<>OLD.id OR NEW."organizationId"<>OLD."organizationId" OR NEW.type<>OLD.type OR NEW.payload<>OLD.payload OR NEW."createdAt"<>OLD."createdAt" OR NEW.attempts<OLD.attempts THEN RAISE EXCEPTION 'Job source immutable';END IF;
  IF NEW.generation=OLD.generation AND (NEW."maxAttempts"<>OLD."maxAttempts" OR NEW."expiresAt"<>OLD."expiresAt") THEN RAISE EXCEPTION 'Retry authorization required';END IF;
  IF NEW.generation<>OLD.generation AND NOT(OLD.state='dead' AND NEW.state='queued' AND NEW.generation=OLD.generation+1 AND NEW."maxAttempts"=OLD.attempts+3) THEN RAISE EXCEPTION 'Invalid job retry generation';END IF;
  IF OLD.state IN ('succeeded','cancelled') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Terminal job immutable';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER background_job_guard BEFORE UPDATE OR DELETE ON "BackgroundJob" FOR EACH ROW EXECUTE FUNCTION background_job_guard();
CREATE FUNCTION background_job_authorization_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM "BackgroundJob" WHERE id=NEW.id) AND NOT EXISTS(SELECT 1 FROM "JobAuthorization" a WHERE a."jobId"=NEW.id AND a."organizationId"=NEW."organizationId" AND a.generation=NEW.generation) THEN RAISE EXCEPTION 'Job generation requires authorization';END IF;RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER background_job_authorization_check AFTER INSERT OR UPDATE ON "BackgroundJob" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION background_job_authorization_check();
CREATE FUNCTION job_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "BackgroundJob" j JOIN "Organization" o ON o.id=j."organizationId" WHERE j.id=OLD."jobId") THEN RAISE EXCEPTION 'Job events immutable';END IF;RETURN OLD;END IF;
 RAISE EXCEPTION 'Job events immutable';
END $$;
CREATE TRIGGER job_event_guard BEFORE UPDATE OR DELETE ON "JobEvent" FOR EACH ROW EXECUTE FUNCTION job_event_guard();
