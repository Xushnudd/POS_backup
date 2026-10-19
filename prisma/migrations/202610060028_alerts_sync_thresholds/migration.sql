BEGIN;
ALTER TABLE "AuditLog" ADD COLUMN "requestId" TEXT;
CREATE TABLE "Incident" (id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,"storeId" TEXT REFERENCES "Store"(id) ON DELETE CASCADE,kind TEXT NOT NULL,"entityKey" TEXT NOT NULL,severity TEXT NOT NULL DEFAULT 'warning' CHECK(severity IN ('warning','critical')),state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','resolved')),evidence JSONB NOT NULL,"detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"resolvedAt" TIMESTAMP(3),"resolvedBy" TEXT REFERENCES "User"(id) ON DELETE SET NULL,"resolutionReason" TEXT);
CREATE UNIQUE INDEX "Incident_organizationId_kind_entityKey_key" ON "Incident"("organizationId",kind,"entityKey");
CREATE INDEX "Incident_organizationId_state_storeId_idx" ON "Incident"("organizationId",state,"storeId");
CREATE TABLE "SyncReview" (id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,"actorId" TEXT NOT NULL REFERENCES "User"(id),"operationId" TEXT NOT NULL,"commandType" TEXT NOT NULL,payload JSONB NOT NULL,"payloadHash" TEXT NOT NULL,code TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'conflict' CHECK(state IN ('conflict','resolved')),result JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"resolvedAt" TIMESTAMP(3),"resolvedBy" TEXT REFERENCES "User"(id) ON DELETE SET NULL,reason TEXT);
CREATE UNIQUE INDEX "SyncReview_organizationId_commandType_operationId_key" ON "SyncReview"("organizationId","commandType","operationId");
CREATE INDEX "SyncReview_organizationId_state_idx" ON "SyncReview"("organizationId",state);
CREATE TABLE "StockThreshold" (id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,"storeId" TEXT NOT NULL REFERENCES "Store"(id) ON DELETE CASCADE,"productId" TEXT NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,minimum NUMERIC(20,6) NOT NULL CHECK(minimum>=0),maximum NUMERIC(20,6) NOT NULL CHECK(maximum>=minimum));
CREATE UNIQUE INDEX "StockThreshold_storeId_productId_key" ON "StockThreshold"("storeId","productId");
CREATE INDEX "StockThreshold_organizationId_storeId_idx" ON "StockThreshold"("organizationId","storeId");
CREATE FUNCTION pos_alert_scope() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."storeId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Store" WHERE id=NEW."storeId" AND "organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'alert store tenant mismatch'; END IF;
 IF TG_TABLE_NAME='StockThreshold' THEN
 IF NOT EXISTS(SELECT 1 FROM "Product" WHERE id=NEW."productId" AND "organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'threshold product tenant mismatch'; END IF; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER "Incident_scope" BEFORE INSERT OR UPDATE ON "Incident" FOR EACH ROW EXECUTE FUNCTION pos_alert_scope();
CREATE TRIGGER "StockThreshold_scope" BEFORE INSERT OR UPDATE ON "StockThreshold" FOR EACH ROW EXECUTE FUNCTION pos_alert_scope();
CREATE FUNCTION pos_review_immutable() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."organizationId"<>OLD."organizationId" OR NEW."actorId"<>OLD."actorId" OR NEW."operationId"<>OLD."operationId" OR NEW."commandType"<>OLD."commandType" OR NEW.payload<>OLD.payload OR NEW."payloadHash"<>OLD."payloadHash" THEN RAISE EXCEPTION 'sync source immutable'; END IF;
 IF OLD.state='resolved' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'resolved sync review immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "SyncReview_immutable" BEFORE UPDATE ON "SyncReview" FOR EACH ROW EXECUTE FUNCTION pos_review_immutable();
COMMIT;
