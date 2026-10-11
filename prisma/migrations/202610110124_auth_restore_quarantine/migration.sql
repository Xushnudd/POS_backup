-- Operational checkpoint, excluded from tenant exports. New installations have
-- no checkpoint; every restore creates a new pending checkpoint before opening.
CREATE TABLE "AuthRestoreCheckpoint" (
 id TEXT PRIMARY KEY,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "reviewedAt" TIMESTAMP(3), "reviewer" TEXT, "reviewEvidence" TEXT,
 CHECK (("reviewedAt" IS NULL AND reviewer IS NULL AND "reviewEvidence" IS NULL) OR
 ("reviewedAt" IS NOT NULL AND "reviewedAt">="createdAt" AND length(trim(reviewer)) BETWEEN 3 AND 200 AND length(trim("reviewEvidence")) BETWEEN 10 AND 2000))
);
CREATE UNIQUE INDEX auth_restore_one_pending ON "AuthRestoreCheckpoint"((TRUE)) WHERE "reviewedAt" IS NULL;
CREATE FUNCTION auth_restore_ready() RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
 SELECT NOT EXISTS(SELECT 1 FROM "AuthRestoreCheckpoint" WHERE "reviewedAt" IS NULL)
$$;
CREATE FUNCTION auth_restore_checkpoint_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Restore checkpoint history immutable'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW."reviewedAt" IS NOT NULL OR NEW.reviewer IS NOT NULL OR NEW."reviewEvidence" IS NOT NULL THEN RAISE EXCEPTION 'Restore checkpoint starts pending'; END IF;
 ELSE
  IF OLD."reviewedAt" IS NOT NULL OR (NEW.id,NEW."createdAt") IS DISTINCT FROM (OLD.id,OLD."createdAt") OR NEW."reviewedAt" IS NULL THEN RAISE EXCEPTION 'Restore checkpoint source/terminal immutable'; END IF;
  IF EXISTS(SELECT 1 FROM "Session" WHERE "revokedAt" IS NULL) OR
     EXISTS(SELECT 1 FROM "TotpFactor" WHERE "revokedAt" IS NULL) OR
     EXISTS(SELECT 1 FROM "AuthChallenge" WHERE "usedAt" IS NULL AND "failedAt" IS NULL) OR
     EXISTS(SELECT 1 FROM "Invitation" WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL) THEN RAISE EXCEPTION 'Restored credentials must be invalidated before review'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER auth_restore_checkpoint_guard BEFORE INSERT OR UPDATE OR DELETE ON "AuthRestoreCheckpoint" FOR EACH ROW EXECUTE FUNCTION auth_restore_checkpoint_guard();
CREATE FUNCTION auth_restore_session_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."revokedAt" IS NULL AND NOT auth_restore_ready() THEN RAISE EXCEPTION 'Authentication restore review required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER auth_restore_session_guard BEFORE INSERT OR UPDATE ON "Session" FOR EACH ROW EXECUTE FUNCTION auth_restore_session_guard();
