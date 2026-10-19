CREATE TABLE "OnboardingCheckpoint" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "storeId" TEXT NOT NULL REFERENCES "Store"(id),step TEXT NOT NULL,
 proof JSONB NOT NULL,"confirmedBy" TEXT NOT NULL REFERENCES "User"(id),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(step IN ('organization','register','catalog','opening','staff','sale')),
 CHECK(jsonb_typeof(proof)='object')
);
CREATE UNIQUE INDEX "OnboardingCheckpoint_organizationId_storeId_step_key" ON "OnboardingCheckpoint"("organizationId","storeId",step);
CREATE FUNCTION onboarding_checkpoint_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'Onboarding history immutable';END IF;RETURN OLD;END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Onboarding history immutable';END IF;
 IF NOT EXISTS(SELECT 1 FROM "Store" WHERE id=NEW."storeId" AND "organizationId"=NEW."organizationId" AND "isActive") OR NOT EXISTS(SELECT 1 FROM "OrganizationUser" m JOIN "User" u ON u.id=m."userId" WHERE m."organizationId"=NEW."organizationId" AND m."userId"=NEW."confirmedBy" AND m.role='owner' AND m."isActive" AND u."isActive") THEN RAISE EXCEPTION 'Onboarding scope/owner required';END IF;RETURN NEW;
END $$;
CREATE TRIGGER onboarding_checkpoint_guard BEFORE INSERT OR UPDATE OR DELETE ON "OnboardingCheckpoint" FOR EACH ROW EXECUTE FUNCTION onboarding_checkpoint_guard();
