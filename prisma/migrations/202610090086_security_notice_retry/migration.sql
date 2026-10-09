-- Applied migration085 remains immutable. Explicit accountable retries keep the original source/attempt history.
ALTER TABLE "SecurityNoticeOutbox" DROP CONSTRAINT "SecurityNoticeOutbox_attempts_check";
ALTER TABLE "SecurityNoticeOutbox" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "SecurityNoticeOutbox" ADD CONSTRAINT security_outbox_attempt_budget CHECK(attempts BETWEEN 0 AND 30 AND "maxAttempts" BETWEEN 3 AND 30 AND "maxAttempts"%3=0 AND attempts<="maxAttempts");
CREATE OR REPLACE FUNCTION security_outbox_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "SecurityEvent" WHERE id=OLD."eventId") THEN RAISE EXCEPTION 'Security outbox source immutable';END IF;RETURN OLD;END IF;
 IF TG_OP='INSERT' THEN
  IF NOT EXISTS(SELECT 1 FROM "SecurityEvent" WHERE id=NEW."eventId" AND suspicious) OR NEW.attempts<>0 OR NEW."maxAttempts"<>3 OR NEW.state<>'pending' THEN RAISE EXCEPTION 'Security outbox requires original suspicious source';END IF;
 ELSIF NEW.id<>OLD.id OR NEW."eventId"<>OLD."eventId" OR NEW."dedupeKey"<>OLD."dedupeKey" OR NEW."createdAt"<>OLD."createdAt" OR NEW.attempts<OLD.attempts THEN RAISE EXCEPTION 'Security outbox source immutable';
 ELSIF NEW."maxAttempts"<>OLD."maxAttempts" THEN
  IF NOT(OLD.state='dead' AND OLD.attempts=OLD."maxAttempts" AND NEW.state='pending' AND NEW.attempts=OLD.attempts AND NEW."maxAttempts"=OLD."maxAttempts"+3 AND NEW."lastError" IS NULL AND NEW."deliveredAt" IS NULL) THEN RAISE EXCEPTION 'Invalid security outbox retry';END IF;
 ELSIF OLD.state<>'pending' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Security outbox terminal immutable';END IF;RETURN NEW;
END $$;
