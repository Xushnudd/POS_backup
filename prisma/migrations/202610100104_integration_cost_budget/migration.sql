CREATE TABLE "IntegrationCost" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('fiscal','sms','printer_agent','payment','hosting','backup','other')),
 source TEXT NOT NULL CHECK(length(source) BETWEEN 3 AND 200),currency TEXT NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 "periodStart" TIMESTAMP(3) NOT NULL,"periodEnd" TIMESTAMP(3) NOT NULL CHECK("periodEnd">"periodStart"),
 "usageQuantity" NUMERIC(20,6) NOT NULL CHECK("usageQuantity">0),"unitPrice" NUMERIC(20,6) NOT NULL CHECK("unitPrice">=0),
 amount NUMERIC(14,2) NOT NULL CHECK(amount>=0),estimated BOOLEAN NOT NULL,
 basis TEXT NOT NULL CHECK(length(basis) BETWEEN 2 AND 80),reason TEXT NOT NULL CHECK(length(reason) BETWEEN 3 AND 2000),
 "createdBy" TEXT NOT NULL REFERENCES "User"(id),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "cancelledAt" TIMESTAMP(3),"cancelledBy" TEXT REFERENCES "User"(id),"cancellationReason" TEXT,
 CHECK(amount=ROUND("usageQuantity"*"unitPrice",2)),
 CHECK(("cancelledAt" IS NULL AND "cancelledBy" IS NULL AND "cancellationReason" IS NULL) OR
 ("cancelledAt" IS NOT NULL AND "cancelledBy" IS NOT NULL AND "cancellationReason" IS NOT NULL AND length("cancellationReason") BETWEEN 3 AND 2000))
);
CREATE UNIQUE INDEX integration_active_source ON "IntegrationCost"("organizationId",kind,source,currency) WHERE "cancelledAt" IS NULL;
CREATE INDEX "IntegrationCost_organizationId_periodStart_id_idx" ON "IntegrationCost"("organizationId","periodStart",id);
CREATE FUNCTION integration_cost_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'Integration cost history immutable';END IF;RETURN OLD;END IF;
 IF TG_OP='INSERT' THEN
 IF NEW."cancelledAt" IS NOT NULL OR NOT EXISTS(SELECT 1 FROM "PlatformOperator" WHERE "userId"=NEW."createdBy" AND role='platform_admin' AND "isActive") THEN RAISE EXCEPTION 'Cost requires platform admin';END IF;
 ELSE
 IF (NEW.id,NEW."organizationId",NEW.kind,NEW.source,NEW.currency,NEW."periodStart",NEW."periodEnd",NEW."usageQuantity",NEW."unitPrice",NEW.amount,NEW.estimated,NEW.basis,NEW.reason,NEW."createdBy",NEW."createdAt") IS DISTINCT FROM
 (OLD.id,OLD."organizationId",OLD.kind,OLD.source,OLD.currency,OLD."periodStart",OLD."periodEnd",OLD."usageQuantity",OLD."unitPrice",OLD.amount,OLD.estimated,OLD.basis,OLD.reason,OLD."createdBy",OLD."createdAt") OR
 OLD."cancelledAt" IS NOT NULL OR NEW."cancelledAt" IS NULL OR NOT EXISTS(SELECT 1 FROM "PlatformOperator" WHERE "userId"=NEW."cancelledBy" AND role='platform_admin' AND "isActive") THEN RAISE EXCEPTION 'Cost transition immutable';END IF;
 END IF;RETURN NEW;END $$;
CREATE TRIGGER integration_cost_guard BEFORE INSERT OR UPDATE OR DELETE ON "IntegrationCost" FOR EACH ROW EXECUTE FUNCTION integration_cost_guard();
