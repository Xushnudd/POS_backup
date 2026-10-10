CREATE TABLE "AuthChallenge" (
 id TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 "sessionId" TEXT REFERENCES "Session"(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('verify_phone','verify_email','password_reset','step_up')),
 channel TEXT NOT NULL CHECK(channel IN ('sms','email')),
 "providerId" TEXT NOT NULL,"providerMode" TEXT NOT NULL CHECK("providerMode" IN ('real','mock')),
 "targetHash" TEXT NOT NULL CHECK("targetHash" ~ '^[0-9a-f]{64}$'),
 "secretHash" TEXT NOT NULL CHECK("secretHash" ~ '^[0-9a-f]{64}$'),
 "sealedSecret" TEXT,"deliveryAttempts" INTEGER NOT NULL DEFAULT 0 CHECK("deliveryAttempts" BETWEEN 0 AND 3),
 "deliveryLease" TEXT,"deliveryLeaseUntil" TIMESTAMP(3),"nextDeliveryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 action TEXT,"operationKey" TEXT,"payloadHash" TEXT,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"expiresAt" TIMESTAMP(3) NOT NULL,
 "deliveredAt" TIMESTAMP(3),"failedAt" TIMESTAMP(3),"usedAt" TIMESTAMP(3),"approvedOperationAt" TIMESTAMP(3),
 CHECK("expiresAt">"createdAt" AND "expiresAt"<="createdAt"+INTERVAL '15 minutes'),
 CHECK((kind='password_reset')=("sessionId" IS NULL)),
 CHECK((kind='step_up' AND action IS NOT NULL AND "operationKey" IS NOT NULL AND "payloadHash" ~ '^[0-9a-f]{64}$') OR
 (kind<>'step_up' AND action IS NULL AND "operationKey" IS NULL AND "payloadHash" IS NULL)),
 CHECK("usedAt" IS NULL OR ("deliveredAt" IS NOT NULL AND "failedAt" IS NULL)),
 CHECK("approvedOperationAt" IS NULL OR (kind='step_up' AND "usedAt" IS NOT NULL))
);
CREATE UNIQUE INDEX auth_active_challenge ON "AuthChallenge"("userId",kind,COALESCE("sessionId",'')) WHERE "usedAt" IS NULL AND "failedAt" IS NULL;
CREATE INDEX "AuthChallenge_userId_kind_createdAt_idx" ON "AuthChallenge"("userId",kind,"createdAt");
CREATE INDEX "AuthChallenge_expiresAt_idx" ON "AuthChallenge"("expiresAt");
CREATE INDEX "AuthChallenge_nextDeliveryAt_idx" ON "AuthChallenge"("nextDeliveryAt");
CREATE INDEX "AuthChallenge_secretHash_idx" ON "AuthChallenge"("secretHash");
CREATE TABLE "VerifiedContact" (
 id TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 channel TEXT NOT NULL CHECK(channel IN ('sms','email')),"targetHash" TEXT NOT NULL,
 "challengeId" TEXT NOT NULL UNIQUE REFERENCES "AuthChallenge"(id),"verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("userId",channel)
);
CREATE FUNCTION auth_challenge_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.attempts<>0 OR NEW."deliveryAttempts"<>0 OR NEW."sealedSecret" IS NULL OR NEW."deliveryLease" IS NOT NULL OR NEW."deliveryLeaseUntil" IS NOT NULL OR NEW."deliveredAt" IS NOT NULL OR NEW."failedAt" IS NOT NULL OR NEW."usedAt" IS NOT NULL OR NEW."approvedOperationAt" IS NOT NULL THEN RAISE EXCEPTION 'Challenge must start pending';END IF;
  IF NEW."sessionId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Session" WHERE id=NEW."sessionId" AND "userId"=NEW."userId") THEN RAISE EXCEPTION 'Challenge session scope invalid';END IF;
 ELSE
  IF (NEW.id,NEW."userId",NEW."sessionId",NEW.kind,NEW.channel,NEW."providerId",NEW."providerMode",NEW."targetHash",NEW."secretHash",NEW.action,NEW."operationKey",NEW."payloadHash",NEW."createdAt",NEW."expiresAt") IS DISTINCT FROM
     (OLD.id,OLD."userId",OLD."sessionId",OLD.kind,OLD.channel,OLD."providerId",OLD."providerMode",OLD."targetHash",OLD."secretHash",OLD.action,OLD."operationKey",OLD."payloadHash",OLD."createdAt",OLD."expiresAt") OR
     NEW.attempts<OLD.attempts OR NEW.attempts>OLD.attempts+1 OR OLD."failedAt" IS NOT NULL OR
     NEW."deliveryAttempts"<OLD."deliveryAttempts" OR NEW."deliveryAttempts">OLD."deliveryAttempts"+1 OR
     (NEW."sealedSecret" IS DISTINCT FROM OLD."sealedSecret" AND (NEW."sealedSecret" IS NOT NULL OR (NEW."deliveredAt" IS NULL AND NEW."failedAt" IS NULL))) OR
     (OLD."deliveredAt" IS NOT NULL AND NEW."deliveredAt" IS DISTINCT FROM OLD."deliveredAt") OR
     (OLD."usedAt" IS NOT NULL AND (NEW."usedAt" IS DISTINCT FROM OLD."usedAt" OR NEW.attempts<>OLD.attempts OR NEW."failedAt" IS NOT NULL)) OR
     (OLD."approvedOperationAt" IS NOT NULL AND NEW."approvedOperationAt" IS DISTINCT FROM OLD."approvedOperationAt") THEN RAISE EXCEPTION 'Challenge source/terminal immutable';END IF;
  IF NEW."usedAt" IS NOT NULL AND OLD."usedAt" IS NULL AND (NEW."expiresAt"<=clock_timestamp() OR NEW.attempts>=5) THEN RAISE EXCEPTION 'Challenge no longer usable';END IF;
  IF NEW."approvedOperationAt" IS NOT NULL AND OLD."approvedOperationAt" IS NULL AND NEW."expiresAt"<=clock_timestamp() THEN RAISE EXCEPTION 'Step-up expired';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER auth_challenge_guard BEFORE INSERT OR UPDATE ON "AuthChallenge" FOR EACH ROW EXECUTE FUNCTION auth_challenge_guard();
CREATE FUNCTION verified_contact_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM "AuthChallenge" WHERE id=NEW."challengeId" AND "userId"=NEW."userId" AND channel=NEW.channel AND "targetHash"=NEW."targetHash" AND "usedAt" IS NOT NULL AND "deliveredAt" IS NOT NULL AND "failedAt" IS NULL AND kind=CASE NEW.channel WHEN 'sms' THEN 'verify_phone' ELSE 'verify_email' END) THEN RAISE EXCEPTION 'Verified contact requires consumed proof';END IF;RETURN NEW;
END $$;
CREATE TRIGGER verified_contact_guard BEFORE INSERT OR UPDATE ON "VerifiedContact" FOR EACH ROW EXECUTE FUNCTION verified_contact_guard();
