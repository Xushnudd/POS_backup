-- Approved initial commercial configuration. Future changes create new versions.
CREATE TABLE "BillingPlanVersion" (
 id TEXT PRIMARY KEY, code TEXT NOT NULL CHECK(code ~ '^[a-z][a-z0-9_-]{0,39}$'),
 version INTEGER NOT NULL CHECK(version>0), name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
 "monthlyPrice" NUMERIC(14,2) NOT NULL CHECK("monthlyPrice">=0), currency TEXT NOT NULL CHECK(currency='UZS'),
 "branchLimit" INTEGER NOT NULL CHECK("branchLimit" BETWEEN 1 AND 100000),
 "registerLimit" INTEGER NOT NULL CHECK("registerLimit" BETWEEN 1 AND 100000),
 "staffLimit" INTEGER NOT NULL CHECK("staffLimit" BETWEEN 1 AND 100000),
 "trialDays" INTEGER NOT NULL CHECK("trialDays" BETWEEN 0 AND 365),
 "graceDays" INTEGER NOT NULL CHECK("graceDays" BETWEEN 0 AND 365),
 "createdBy" TEXT REFERENCES "User"(id), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(code,version)
);
CREATE TABLE "BillingPlan" (
 code TEXT PRIMARY KEY, "currentVersionId" TEXT NOT NULL REFERENCES "BillingPlanVersion"(id),
 "isActive" BOOLEAN NOT NULL DEFAULT TRUE, "isTrial" BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX billing_one_trial_plan ON "BillingPlan"("isTrial") WHERE "isTrial";
INSERT INTO "BillingPlanVersion"(id,code,version,name,"monthlyPrice",currency,"branchLimit","registerLimit","staffLimit","trialDays","graceDays") VALUES
 ('initial-start-v1','start',1,'Start',99000,'UZS',1,1,3,14,7),
 ('initial-business-v1','business',1,'Business',249000,'UZS',3,5,15,14,7),
 ('initial-pro-v1','pro',1,'Pro',499000,'UZS',10,20,50,14,7);
INSERT INTO "BillingPlan"(code,"currentVersionId","isTrial") VALUES
 ('start','initial-start-v1',FALSE),('business','initial-business-v1',FALSE),('pro','initial-pro-v1',TRUE);
CREATE TABLE "OrganizationSubscription" (
 "organizationId" TEXT PRIMARY KEY REFERENCES "Organization"(id) ON DELETE CASCADE,
 "planVersionId" TEXT NOT NULL REFERENCES "BillingPlanVersion"(id),
 "trialStartedAt" TIMESTAMP(3) NOT NULL, "trialEndsAt" TIMESTAMP(3) NOT NULL,
 "paidThrough" TIMESTAMP(3), "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT FALSE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK("trialEndsAt">="trialStartedAt"), CHECK("paidThrough" IS NULL OR "paidThrough">="trialStartedAt")
);
CREATE FUNCTION billing_version_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 RAISE EXCEPTION 'Billing plan version immutable; create a new version'; END $$;
CREATE TRIGGER billing_version_immutable BEFORE UPDATE OR DELETE ON "BillingPlanVersion" FOR EACH ROW EXECUTE FUNCTION billing_version_immutable();
CREATE FUNCTION billing_plan_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM "BillingPlanVersion" WHERE id=NEW."currentVersionId" AND code=NEW.code) THEN RAISE EXCEPTION 'Billing plan identity mismatch';END IF;
 IF NEW."isTrial" AND NOT NEW."isActive" THEN RAISE EXCEPTION 'Trial plan must be active';END IF;
 RETURN NEW; END $$;
CREATE TRIGGER billing_plan_identity BEFORE INSERT OR UPDATE ON "BillingPlan" FOR EACH ROW EXECUTE FUNCTION billing_plan_identity();
CREATE FUNCTION billing_enroll_new_org() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE p RECORD; BEGIN
 SELECT v.* INTO p FROM "BillingPlan" b JOIN "BillingPlanVersion" v ON v.id=b."currentVersionId" WHERE b."isActive" AND b."isTrial";
 IF NOT FOUND THEN RAISE EXCEPTION 'Active trial plan required';END IF;
 INSERT INTO "OrganizationSubscription"("organizationId","planVersionId","trialStartedAt","trialEndsAt")
 VALUES(NEW.id,p.id,NOW(),NOW()+make_interval(days=>p."trialDays")); RETURN NEW; END $$;
CREATE TRIGGER billing_enroll_new_org AFTER INSERT ON "Organization" FOR EACH ROW EXECUTE FUNCTION billing_enroll_new_org();
CREATE FUNCTION billing_subscription_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'Trial identity cannot be deleted';END IF;RETURN OLD;END IF;
 IF NEW."organizationId"<>OLD."organizationId" OR NEW."trialStartedAt"<>OLD."trialStartedAt" OR NEW."trialEndsAt"<>OLD."trialEndsAt" OR NEW."createdAt"<>OLD."createdAt" OR
 (OLD."paidThrough" IS NOT NULL AND (NEW."paidThrough" IS NULL OR NEW."paidThrough"<OLD."paidThrough")) THEN RAISE EXCEPTION 'Subscription history cannot reset';END IF;
 RETURN NEW; END $$;
CREATE TRIGGER billing_subscription_guard BEFORE UPDATE OR DELETE ON "OrganizationSubscription" FOR EACH ROW EXECUTE FUNCTION billing_subscription_guard();
CREATE FUNCTION billing_capacity_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE org TEXT;p RECORD;consumed BIGINT;limit_value INTEGER; BEGIN
 IF TG_TABLE_NAME='Store' THEN org=NEW."organizationId";
 ELSIF TG_TABLE_NAME='Register' THEN SELECT "organizationId" INTO org FROM "Store" WHERE id=NEW."storeId";
 ELSIF TG_TABLE_NAME='OrganizationUser' THEN org=NEW."organizationId";
 ELSE org=NEW."organizationId";END IF;
 -- Serializes concurrent creation and plan assignments for a single tenant.
 PERFORM id FROM "Organization" WHERE id=org FOR UPDATE;
 SELECT s.*,v."branchLimit",v."registerLimit",v."staffLimit",v."graceDays" INTO p
 FROM "OrganizationSubscription" s JOIN "BillingPlanVersion" v ON v.id=s."planVersionId" WHERE s."organizationId"=org;
 IF NOT FOUND THEN RETURN NEW;END IF; -- Existing organizations: explicit operator migration, no silent enrollment.
 IF NOW()>=GREATEST(p."trialEndsAt",COALESCE(p."paidThrough",p."trialEndsAt"))+make_interval(days=>p."graceDays") THEN
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SUBSCRIPTION_EXPIRED';END IF;
 IF TG_TABLE_NAME='Sale' THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='Store' THEN SELECT count(*) INTO consumed FROM "Store" WHERE "organizationId"=org;limit_value=p."branchLimit";
 ELSIF TG_TABLE_NAME='Register' THEN SELECT count(*) INTO consumed FROM "Register" r JOIN "Store" s ON s.id=r."storeId" WHERE s."organizationId"=org;limit_value=p."registerLimit";
 ELSE SELECT count(*) INTO consumed FROM "OrganizationUser" WHERE "organizationId"=org;limit_value=p."staffLimit";END IF;
 IF consumed>=limit_value THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PLAN_LIMIT_REACHED';END IF;
 RETURN NEW; END $$;
CREATE TRIGGER billing_capacity_guard BEFORE INSERT ON "Store" FOR EACH ROW EXECUTE FUNCTION billing_capacity_guard();
CREATE TRIGGER billing_capacity_guard BEFORE INSERT ON "Register" FOR EACH ROW EXECUTE FUNCTION billing_capacity_guard();
CREATE TRIGGER billing_capacity_guard BEFORE INSERT ON "OrganizationUser" FOR EACH ROW EXECUTE FUNCTION billing_capacity_guard();
CREATE TRIGGER billing_capacity_guard BEFORE INSERT ON "Sale" FOR EACH ROW EXECUTE FUNCTION billing_capacity_guard();
