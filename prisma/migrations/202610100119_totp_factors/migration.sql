CREATE TABLE "TotpFactor" (
 id TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 "sessionId" TEXT NOT NULL,"passwordDigest" TEXT NOT NULL CHECK("passwordDigest" ~ '^[0-9a-f]{64}$'),
 "sealedSecret" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,"confirmedAt" TIMESTAMP(3),"revokedAt" TIMESTAMP(3),
 "lastCounter" BIGINT CHECK("lastCounter">=0),attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 CHECK("expiresAt">"createdAt" AND "expiresAt"<="createdAt"+INTERVAL '10 minutes'),
 CHECK(("revokedAt" IS NULL)=("sealedSecret" IS NOT NULL)),
 CHECK("confirmedAt" IS NULL OR "lastCounter" IS NOT NULL)
);
CREATE UNIQUE INDEX totp_live_factor ON "TotpFactor"("userId") WHERE "revokedAt" IS NULL;
CREATE INDEX "TotpFactor_userId_createdAt_idx" ON "TotpFactor"("userId","createdAt");
CREATE TABLE "TotpProof" (
 id TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 "factorId" TEXT NOT NULL REFERENCES "TotpFactor"(id) ON DELETE CASCADE,"sessionId" TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action ~ '^[a-z][a-z0-9_.]{2,80}$'),"operationKey" TEXT NOT NULL,
 "payloadHash" TEXT NOT NULL CHECK("payloadHash" ~ '^[0-9a-f]{64}$'),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"expiresAt" TIMESTAMP(3) NOT NULL,
 "approvedOperationAt" TIMESTAMP(3),
 CHECK("expiresAt">"createdAt" AND "expiresAt"<="createdAt"+INTERVAL '5 minutes')
);
CREATE INDEX "TotpProof_userId_sessionId_action_operationKey_idx" ON "TotpProof"("userId","sessionId",action,"operationKey");
CREATE FUNCTION totp_factor_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW."confirmedAt" IS NOT NULL OR NEW."revokedAt" IS NOT NULL OR NEW."lastCounter" IS NOT NULL OR NEW.attempts<>0 OR
    NOT EXISTS(SELECT 1 FROM "Session" WHERE id=NEW."sessionId" AND "userId"=NEW."userId" AND "authenticationMethod"='password' AND "revokedAt" IS NULL AND "expiresAt">clock_timestamp() AND "idleExpiresAt">clock_timestamp()) THEN RAISE EXCEPTION 'Invalid TOTP enrollment';END IF;
 ELSE
  IF (NEW.id,NEW."userId",NEW."sessionId",NEW."passwordDigest",NEW."createdAt",NEW."expiresAt") IS DISTINCT FROM
     (OLD.id,OLD."userId",OLD."sessionId",OLD."passwordDigest",OLD."createdAt",OLD."expiresAt") OR OLD."revokedAt" IS NOT NULL OR
     (NEW."sealedSecret" IS DISTINCT FROM OLD."sealedSecret" AND (NEW."revokedAt" IS NULL OR NEW."sealedSecret" IS NOT NULL)) OR
     (OLD."confirmedAt" IS NOT NULL AND NEW."confirmedAt" IS DISTINCT FROM OLD."confirmedAt") OR
     (OLD."lastCounter" IS NOT NULL AND (NEW."lastCounter" IS NULL OR NEW."lastCounter"<OLD."lastCounter")) OR
     NEW.attempts<OLD.attempts OR NEW.attempts>OLD.attempts+1 THEN RAISE EXCEPTION 'Immutable TOTP source or counter';END IF;
  IF OLD."confirmedAt" IS NULL AND NEW."confirmedAt" IS NOT NULL AND (NEW."expiresAt"<=clock_timestamp() OR NEW.attempts>=5 OR NEW."revokedAt" IS NOT NULL) THEN RAISE EXCEPTION 'TOTP enrollment expired';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER totp_factor_guard BEFORE INSERT OR UPDATE ON "TotpFactor" FOR EACH ROW EXECUTE FUNCTION totp_factor_guard();
CREATE FUNCTION totp_proof_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW."approvedOperationAt" IS NOT NULL OR NOT EXISTS(SELECT 1 FROM "TotpFactor" f JOIN "Session" s ON s.id=NEW."sessionId" WHERE f.id=NEW."factorId" AND f."userId"=NEW."userId" AND f."confirmedAt" IS NOT NULL AND f."revokedAt" IS NULL AND s."userId"=NEW."userId" AND s."authenticationMethod"='password' AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp()) THEN RAISE EXCEPTION 'Invalid TOTP proof';END IF;
 ELSE
  IF (to_jsonb(NEW)-'approvedOperationAt') IS DISTINCT FROM (to_jsonb(OLD)-'approvedOperationAt') OR OLD."approvedOperationAt" IS NOT NULL OR NEW."approvedOperationAt" IS NULL OR NEW."expiresAt"<=clock_timestamp() THEN RAISE EXCEPTION 'Immutable or expired TOTP proof';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER totp_proof_guard BEFORE INSERT OR UPDATE ON "TotpProof" FOR EACH ROW EXECUTE FUNCTION totp_proof_guard();
