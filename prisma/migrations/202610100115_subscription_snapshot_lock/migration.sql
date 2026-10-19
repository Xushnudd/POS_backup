BEGIN;
-- Lock the actual subscription tuple: stale Serializable snapshots must retry.
CREATE OR REPLACE FUNCTION assert_business_writable(org TEXT) RETURNS void LANGUAGE plpgsql AS $$ DECLARE ends TIMESTAMP;grace INTEGER; BEGIN
 -- Shared tenant lock orders enrollment/renewal and protects legacy admission.
 PERFORM id FROM "Organization" WHERE id=org FOR SHARE;
 SELECT GREATEST(s."trialEndsAt",COALESCE(s."paidThrough",s."trialEndsAt")),v."graceDays" INTO ends,grace FROM "OrganizationSubscription" s JOIN "BillingPlanVersion" v ON v.id=s."planVersionId" WHERE s."organizationId"=org FOR SHARE OF s;
 IF FOUND AND (clock_timestamp() AT TIME ZONE 'UTC')>=ends+make_interval(days=>grace) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SUBSCRIPTION_EXPIRED';END IF;
END $$;
CREATE OR REPLACE FUNCTION billing_capacity_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE org TEXT;p RECORD;consumed BIGINT;limit_value INTEGER; BEGIN
 IF TG_TABLE_NAME='Store' THEN org=NEW."organizationId";
 ELSIF TG_TABLE_NAME='Register' THEN SELECT "organizationId" INTO org FROM "Store" WHERE id=NEW."storeId";
 ELSIF TG_TABLE_NAME='OrganizationUser' THEN org=NEW."organizationId";
 ELSE org=NEW."organizationId";END IF;
 -- Sale has no creation quota. Shared entitlement locks avoid tenant lock upgrades
 -- between independent tills; stock/shift/register fencing remains unchanged.
 IF TG_TABLE_NAME='Sale' THEN PERFORM assert_business_writable(org);RETURN NEW;END IF;
 -- Serializes quota-bearing object creation and plan assignments for a single tenant.
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
COMMIT;
