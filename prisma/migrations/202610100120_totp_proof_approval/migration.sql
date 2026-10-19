-- Approval must still have a live factor and password session at DB wall time.
-- Keep the already-applied 119 source immutable; harden with an additive guard.
CREATE FUNCTION totp_live_approval_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."approvedOperationAt" IS NOT NULL AND OLD."approvedOperationAt" IS NULL THEN
  IF NOT EXISTS(SELECT 1 FROM "TotpFactor" f JOIN "Session" s ON s.id=NEW."sessionId"
   JOIN "User" u ON u.id=NEW."userId"
   WHERE f.id=NEW."factorId" AND f."userId"=NEW."userId" AND f."confirmedAt" IS NOT NULL AND f."revokedAt" IS NULL
    AND u."isActive" AND s."userId"=NEW."userId" AND s."authenticationMethod"='password' AND s."revokedAt" IS NULL
    AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp()) THEN RAISE EXCEPTION 'TOTP proof authorization expired';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER totp_live_approval_guard BEFORE UPDATE ON "TotpProof" FOR EACH ROW EXECUTE FUNCTION totp_live_approval_guard();
