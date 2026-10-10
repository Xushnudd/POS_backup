BEGIN;
CREATE TABLE "RetentionPolicyVersion" (
 id TEXT PRIMARY KEY, version INTEGER NOT NULL UNIQUE CHECK(version>0),
 "expiredSubscriptionDays" INTEGER NOT NULL CHECK("expiredSubscriptionDays" BETWEEN 1 AND 3650),
 "closureCancellationDays" INTEGER NOT NULL CHECK("closureCancellationDays" BETWEEN 1 AND 365),
 "auditRetentionDays" INTEGER CHECK("auditRetentionDays" BETWEEN 1 AND 3650),
 "technicalLogRetentionDays" INTEGER CHECK("technicalLogRetentionDays" BETWEEN 1 AND 3650),
 "backupRetentionDays" INTEGER CHECK("backupRetentionDays" BETWEEN 1 AND 3650),
 "proposedFinancialRetentionYears" INTEGER NOT NULL CHECK("proposedFinancialRetentionYears" BETWEEN 5 AND 100),
 "createdBy" TEXT, reason TEXT NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 2000),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "RetentionPolicy" (
 key TEXT PRIMARY KEY CHECK(key='default'), "currentVersionId" TEXT NOT NULL
 REFERENCES "RetentionPolicyVersion"(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "RetentionPolicyVersion"(id,version,"expiredSubscriptionDays","closureCancellationDays","proposedFinancialRetentionYears",reason)
 VALUES ('retention-initial-20261010',1,90,30,5,'Mahsulot egasi tasdiqlagan dastlabki ADR-062; huquqiy toifalar alohida tasdiqlanadi');
INSERT INTO "RetentionPolicy" VALUES ('default','retention-initial-20261010');
CREATE FUNCTION retention_policy_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Retention policy history is immutable' USING ERRCODE='23514';
END $$;
CREATE TRIGGER retention_policy_version_immutable BEFORE UPDATE OR DELETE ON "RetentionPolicyVersion"
 FOR EACH ROW EXECUTE FUNCTION retention_policy_history_guard();
CREATE FUNCTION retention_policy_creator_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "PlatformOperator" p JOIN "User" u ON u.id=p."userId"
  WHERE p."userId"=NEW."createdBy" AND p.role='platform_admin' AND p."isActive" AND u."isActive") THEN
  RAISE EXCEPTION 'Retention policy requires active platform administrator' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER retention_policy_creator_guard BEFORE INSERT ON "RetentionPolicyVersion"
 FOR EACH ROW EXECUTE FUNCTION retention_policy_creator_guard();
CREATE FUNCTION retention_policy_pointer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_version INTEGER; next_version INTEGER;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retention policy cannot be removed' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.key IS DISTINCT FROM OLD.key THEN RAISE EXCEPTION 'Retention identity is immutable' USING ERRCODE='23514'; END IF;
  SELECT version INTO previous_version FROM "RetentionPolicyVersion" WHERE id=OLD."currentVersionId";
  SELECT version INTO next_version FROM "RetentionPolicyVersion" WHERE id=NEW."currentVersionId";
  IF NEW."currentVersionId"<>OLD."currentVersionId" AND next_version<>previous_version+1 THEN RAISE EXCEPTION 'Retention policy requires the next version' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER retention_policy_pointer_guard BEFORE UPDATE OR DELETE ON "RetentionPolicy"
 FOR EACH ROW EXECUTE FUNCTION retention_policy_pointer_guard();
COMMIT;
