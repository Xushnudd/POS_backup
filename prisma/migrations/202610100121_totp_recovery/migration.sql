CREATE TABLE "TotpRecoveryCode" (
 id TEXT PRIMARY KEY,"factorId" TEXT NOT NULL REFERENCES "TotpFactor"(id) ON DELETE CASCADE,
 "secretHash" TEXT NOT NULL UNIQUE CHECK("secretHash" ~ '^[0-9a-f]{64}$'),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"expiresAt" TIMESTAMP(3) NOT NULL,"usedAt" TIMESTAMP(3),
 CHECK("expiresAt">"createdAt" AND "expiresAt"<="createdAt"+INTERVAL '366 days')
);
CREATE INDEX "TotpRecoveryCode_factorId_idx" ON "TotpRecoveryCode"("factorId");
CREATE FUNCTION totp_recovery_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW."usedAt" IS NOT NULL OR NOT EXISTS(SELECT 1 FROM "TotpFactor" WHERE id=NEW."factorId" AND "confirmedAt" IS NOT NULL AND "revokedAt" IS NULL) THEN RAISE EXCEPTION 'Recovery requires active factor';END IF;
 ELSE
  IF (to_jsonb(NEW)-'usedAt') IS DISTINCT FROM (to_jsonb(OLD)-'usedAt') OR OLD."usedAt" IS NOT NULL OR NEW."usedAt" IS NULL OR NEW."expiresAt"<=clock_timestamp() OR
    NOT EXISTS(SELECT 1 FROM "TotpFactor" WHERE id=NEW."factorId" AND "confirmedAt" IS NOT NULL AND "revokedAt" IS NULL) THEN RAISE EXCEPTION 'Recovery source immutable or expired';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER totp_recovery_guard BEFORE INSERT OR UPDATE ON "TotpRecoveryCode" FOR EACH ROW EXECUTE FUNCTION totp_recovery_guard();
