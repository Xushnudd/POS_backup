ALTER TABLE "BillingPlanVersion" ADD CONSTRAINT billing_positive_trial CHECK("trialDays">0);
CREATE FUNCTION billing_tenant_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE old_org TEXT;new_org TEXT; BEGIN
 IF TG_TABLE_NAME='Register' THEN
 SELECT "organizationId" INTO old_org FROM "Store" WHERE id=OLD."storeId";
 SELECT "organizationId" INTO new_org FROM "Store" WHERE id=NEW."storeId";
 IF old_org IS DISTINCT FROM new_org THEN RAISE EXCEPTION 'Register tenant identity immutable';END IF;
 ELSE
 IF NEW."organizationId"<>OLD."organizationId" THEN RAISE EXCEPTION 'Billing resource tenant identity immutable';END IF;
 END IF;RETURN NEW;END $$;
CREATE TRIGGER billing_tenant_identity_guard BEFORE UPDATE ON "Store" FOR EACH ROW EXECUTE FUNCTION billing_tenant_identity_guard();
CREATE TRIGGER billing_tenant_identity_guard BEFORE UPDATE ON "Register" FOR EACH ROW EXECUTE FUNCTION billing_tenant_identity_guard();
CREATE TRIGGER billing_tenant_identity_guard BEFORE UPDATE ON "OrganizationUser" FOR EACH ROW EXECUTE FUNCTION billing_tenant_identity_guard();
