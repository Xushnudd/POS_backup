-- Run only against the confirmed, offline restore target. Commit the gate first:
-- a failed credential sweep must leave the restored database inaccessible.
BEGIN;
LOCK TABLE "AuthRestoreCheckpoint" IN EXCLUSIVE MODE;
INSERT INTO "AuthRestoreCheckpoint" (id)
 SELECT gen_random_uuid()::text WHERE NOT EXISTS(SELECT 1 FROM "AuthRestoreCheckpoint" WHERE "reviewedAt" IS NULL);
COMMIT;
BEGIN;
UPDATE "Session" SET "revokedAt"=clock_timestamp() WHERE "revokedAt" IS NULL;
UPDATE "TotpFactor" SET "revokedAt"=clock_timestamp(),"sealedSecret"=NULL WHERE "revokedAt" IS NULL;
UPDATE "AuthChallenge" SET "failedAt"=clock_timestamp(),"sealedSecret"=NULL,"deliveryLease"=NULL,"deliveryLeaseUntil"=NULL
 WHERE "usedAt" IS NULL AND "failedAt" IS NULL;
UPDATE "Invitation" SET "revokedAt"=clock_timestamp() WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
