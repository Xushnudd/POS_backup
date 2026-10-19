CREATE TABLE "SecurityEvent" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 type TEXT NOT NULL CHECK(type IN ('session_created','session_revoked','login_succeeded','login_failed','password_changed','cashier_pin_changed','member_updated','ownership_transferred')),
 suspicious BOOLEAN NOT NULL DEFAULT FALSE,"sourceSessionId" TEXT,"sourceAuditLogId" TEXT UNIQUE,"clientHash" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"expiresAt" TIMESTAMP(3) NOT NULL,
 CHECK("expiresAt"="createdAt"+INTERVAL '90 days'),CHECK("clientHash" IS NULL OR "clientHash" ~ '^[0-9a-f]{64}$'),
 CHECK(NOT suspicious OR type IN ('login_succeeded','login_failed')),
 CHECK("clientHash" IS NULL OR type='login_succeeded')
);
CREATE INDEX "SecurityEvent_userId_createdAt_id_idx" ON "SecurityEvent"("userId","createdAt" DESC,id);
CREATE INDEX "SecurityEvent_expiresAt_idx" ON "SecurityEvent"("expiresAt");
CREATE TABLE "SecurityNoticeOutbox" (
 id TEXT PRIMARY KEY,"eventId" TEXT NOT NULL UNIQUE REFERENCES "SecurityEvent"(id) ON DELETE CASCADE,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','delivered','dead','skipped')),
 "dedupeKey" TEXT NOT NULL UNIQUE,attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"lastError" TEXT CHECK("lastError" IS NULL OR "lastError" IN ('DELIVERY_FAILED','RECIPIENT_INACTIVE','EVENT_EXPIRED')),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"deliveredAt" TIMESTAMP(3),
 CHECK((state='delivered')=("deliveredAt" IS NOT NULL))
);
CREATE INDEX "SecurityNoticeOutbox_state_nextRunAt_idx" ON "SecurityNoticeOutbox"(state,"nextRunAt");
CREATE TABLE "SecurityNotice" (
 id TEXT PRIMARY KEY,"eventId" TEXT NOT NULL UNIQUE REFERENCES "SecurityEvent"(id) ON DELETE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"readAt" TIMESTAMP(3)
);
CREATE FUNCTION security_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD."expiresAt">clock_timestamp() AND EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") AND EXISTS(SELECT 1 FROM "User" WHERE id=OLD."userId") THEN RAISE EXCEPTION 'Security history immutable until expiry';END IF;RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Security history immutable';END IF;
 IF NEW."createdAt">clock_timestamp()+INTERVAL '1 second' THEN RAISE EXCEPTION 'Future security event invalid';END IF;
 IF NEW."sourceSessionId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Session" WHERE id=NEW."sourceSessionId" AND "userId"=NEW."userId" AND "organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'Security session scope invalid';END IF;
 IF NEW."sourceAuditLogId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "AuditLog" WHERE id=NEW."sourceAuditLogId" AND "organizationId"=NEW."organizationId" AND "actorId"=NEW."userId") THEN RAISE EXCEPTION 'Security audit scope invalid';END IF;
 IF NOT EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "userId"=NEW."userId" AND "organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'Security user scope invalid';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER security_event_guard BEFORE INSERT OR UPDATE OR DELETE ON "SecurityEvent" FOR EACH ROW EXECUTE FUNCTION security_event_guard();
-- Snapshots deliberately have no Session FK: session identities held by financial/offline evidence remain untouched.
CREATE FUNCTION security_session_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE event_type TEXT; BEGIN
 IF TG_OP='INSERT' THEN event_type:='session_created';
 ELSIF OLD."revokedAt" IS NULL AND NEW."revokedAt" IS NOT NULL THEN event_type:='session_revoked';
 ELSE RETURN NEW;END IF;
 -- A raw administrative fixture may precede its membership. Operational createSession always has one.
 IF EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "userId"=NEW."userId" AND "organizationId"=NEW."organizationId") THEN
 INSERT INTO "SecurityEvent" (id,"organizationId","userId",type,"sourceSessionId","expiresAt") VALUES(gen_random_uuid()::text,NEW."organizationId",NEW."userId",event_type,NEW.id,CURRENT_TIMESTAMP+INTERVAL '90 days');END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER security_session_event AFTER INSERT OR UPDATE OF "revokedAt" ON "Session" FOR EACH ROW EXECUTE FUNCTION security_session_event();
CREATE FUNCTION security_audit_event() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE event_type TEXT; BEGIN
 event_type:=CASE NEW.action WHEN 'password_changed' THEN 'password_changed' WHEN 'pin_changed' THEN 'cashier_pin_changed' WHEN 'pin_disabled' THEN 'cashier_pin_changed' WHEN 'membership_updated' THEN 'member_updated' WHEN 'membership_archived' THEN 'member_updated' WHEN 'membership_restored' THEN 'member_updated' WHEN 'ownership_transferred' THEN 'ownership_transferred' END;
 IF event_type IS NOT NULL AND NEW."actorId" IS NOT NULL AND EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "userId"=NEW."actorId" AND "organizationId"=NEW."organizationId") THEN
 INSERT INTO "SecurityEvent" (id,"organizationId","userId",type,"sourceAuditLogId","expiresAt") VALUES(gen_random_uuid()::text,NEW."organizationId",NEW."actorId",event_type,NEW.id,CURRENT_TIMESTAMP+INTERVAL '90 days');END IF;RETURN NEW;
END $$;
CREATE TRIGGER security_audit_event AFTER INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION security_audit_event();
CREATE FUNCTION security_event_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.suspicious THEN INSERT INTO "SecurityNoticeOutbox" (id,"eventId","dedupeKey") VALUES(gen_random_uuid()::text,NEW.id,NEW."userId"||':'||NEW.type||':'||floor(extract(epoch from NEW."createdAt")/900)::text) ON CONFLICT("dedupeKey") DO NOTHING;END IF;RETURN NEW;
END $$;
CREATE TRIGGER security_event_outbox AFTER INSERT ON "SecurityEvent" FOR EACH ROW EXECUTE FUNCTION security_event_outbox();
CREATE FUNCTION security_notice_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "SecurityEvent" WHERE id=OLD."eventId") THEN RAISE EXCEPTION 'Security notice source immutable';END IF;RETURN OLD;END IF;
 IF TG_OP='INSERT' THEN IF NOT EXISTS(SELECT 1 FROM "SecurityEvent" WHERE id=NEW."eventId" AND suspicious AND "expiresAt">clock_timestamp()) THEN RAISE EXCEPTION 'Security notice requires live suspicious source';END IF;
 ELSIF NEW.id<>OLD.id OR NEW."eventId"<>OLD."eventId" OR NEW."createdAt"<>OLD."createdAt" OR (OLD."readAt" IS NOT NULL AND NEW."readAt" IS DISTINCT FROM OLD."readAt") OR NEW."readAt" IS NULL THEN RAISE EXCEPTION 'Security notice immutable except first read';END IF;RETURN NEW;
END $$;
CREATE TRIGGER security_notice_guard BEFORE INSERT OR UPDATE OR DELETE ON "SecurityNotice" FOR EACH ROW EXECUTE FUNCTION security_notice_guard();
CREATE FUNCTION security_outbox_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "SecurityEvent" WHERE id=OLD."eventId") THEN RAISE EXCEPTION 'Security outbox source immutable';END IF;RETURN OLD;END IF;
 IF TG_OP='INSERT' THEN IF NOT EXISTS(SELECT 1 FROM "SecurityEvent" WHERE id=NEW."eventId" AND suspicious) THEN RAISE EXCEPTION 'Security outbox requires suspicious source';END IF;
 ELSIF NEW.id<>OLD.id OR NEW."eventId"<>OLD."eventId" OR NEW."dedupeKey"<>OLD."dedupeKey" OR NEW."createdAt"<>OLD."createdAt" OR NEW.attempts<OLD.attempts OR (OLD.state<>'pending' AND NEW IS DISTINCT FROM OLD) THEN RAISE EXCEPTION 'Security outbox source/terminal immutable';END IF;RETURN NEW;
END $$;
CREATE TRIGGER security_outbox_guard BEFORE INSERT OR UPDATE OR DELETE ON "SecurityNoticeOutbox" FOR EACH ROW EXECUTE FUNCTION security_outbox_guard();
