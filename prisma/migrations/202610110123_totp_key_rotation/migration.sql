BEGIN;
CREATE TABLE "TotpKeyRotation" (
 id TEXT PRIMARY KEY,"factorId" TEXT NOT NULL REFERENCES "TotpFactor"(id) ON DELETE CASCADE,
 "batchId" TEXT NOT NULL,"actorId" TEXT NOT NULL,reason TEXT NOT NULL CHECK(length(reason) BETWEEN 3 AND 2000),
 "oldEnvelopeHash" TEXT NOT NULL CHECK("oldEnvelopeHash" ~ '^[0-9a-f]{64}$'),
 "newEnvelopeHash" TEXT NOT NULL CHECK("newEnvelopeHash" ~ '^[0-9a-f]{64}$'),
 "targetKeyFingerprint" TEXT NOT NULL CHECK("targetKeyFingerprint" ~ '^[0-9a-f]{64}$'),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK("oldEnvelopeHash"<>"newEnvelopeHash"), UNIQUE("factorId","oldEnvelopeHash"),UNIQUE("batchId","factorId")
);
CREATE INDEX "TotpKeyRotation_batchId_idx" ON "TotpKeyRotation"("batchId");
CREATE FUNCTION totp_rotation_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "TotpFactor" WHERE id=OLD."factorId") THEN RAISE EXCEPTION 'Immutable TOTP rotation history';END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Immutable TOTP rotation history';END IF;
 IF NOT EXISTS(SELECT 1 FROM "PlatformOperator" p JOIN "User" u ON u.id=p."userId" WHERE p."userId"=NEW."actorId" AND p.role='platform_admin' AND p."isActive" AND u."isActive") OR
  NOT EXISTS(SELECT 1 FROM "TotpFactor" f WHERE f.id=NEW."factorId" AND f."revokedAt" IS NULL AND f."sealedSecret" IS NOT NULL AND encode(sha256(convert_to(f."sealedSecret",'UTF8')),'hex')=NEW."oldEnvelopeHash") THEN RAISE EXCEPTION 'Invalid TOTP rotation source';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER totp_rotation_source_guard BEFORE INSERT OR UPDATE OR DELETE ON "TotpKeyRotation" FOR EACH ROW EXECUTE FUNCTION totp_rotation_source_guard();
CREATE OR REPLACE FUNCTION totp_factor_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW."confirmedAt" IS NOT NULL OR NEW."revokedAt" IS NOT NULL OR NEW."lastCounter" IS NOT NULL OR NEW.attempts<>0 OR
    NOT EXISTS(SELECT 1 FROM "Session" WHERE id=NEW."sessionId" AND "userId"=NEW."userId" AND "authenticationMethod"='password' AND "revokedAt" IS NULL AND "expiresAt">clock_timestamp() AND "idleExpiresAt">clock_timestamp()) THEN RAISE EXCEPTION 'Invalid TOTP enrollment';END IF;
 ELSE
  IF (NEW.id,NEW."userId",NEW."sessionId",NEW."passwordDigest",NEW."createdAt",NEW."expiresAt") IS DISTINCT FROM
     (OLD.id,OLD."userId",OLD."sessionId",OLD."passwordDigest",OLD."createdAt",OLD."expiresAt") OR OLD."revokedAt" IS NOT NULL OR
     (NEW."sealedSecret" IS DISTINCT FROM OLD."sealedSecret" AND (NEW."revokedAt" IS NULL OR NEW."sealedSecret" IS NOT NULL) AND NOT (
      (to_jsonb(NEW)-'sealedSecret')=(to_jsonb(OLD)-'sealedSecret') AND EXISTS(
       SELECT 1 FROM "TotpKeyRotation" r JOIN "PlatformOperator" p ON p."userId"=r."actorId" JOIN "User" u ON u.id=p."userId"
       WHERE r."factorId"=OLD.id AND r."oldEnvelopeHash"=encode(sha256(convert_to(OLD."sealedSecret",'UTF8')),'hex')
        AND r."newEnvelopeHash"=encode(sha256(convert_to(NEW."sealedSecret",'UTF8')),'hex')
        AND p.role='platform_admin' AND p."isActive" AND u."isActive"))) OR
     (OLD."confirmedAt" IS NOT NULL AND NEW."confirmedAt" IS DISTINCT FROM OLD."confirmedAt") OR
     (OLD."lastCounter" IS NOT NULL AND (NEW."lastCounter" IS NULL OR NEW."lastCounter"<OLD."lastCounter")) OR
     NEW.attempts<OLD.attempts OR NEW.attempts>OLD.attempts+1 THEN RAISE EXCEPTION 'Immutable TOTP source or counter';END IF;
  IF OLD."confirmedAt" IS NULL AND NEW."confirmedAt" IS NOT NULL AND (NEW."expiresAt"<=clock_timestamp() OR NEW.attempts>=5 OR NEW."revokedAt" IS NOT NULL) THEN RAISE EXCEPTION 'TOTP enrollment expired';END IF;
 END IF;RETURN NEW;
END $$;
COMMIT;
