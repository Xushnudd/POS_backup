ALTER TABLE "OrganizationUser" ADD COLUMN "pinHash" TEXT;
ALTER TABLE "OrganizationUser" ADD CONSTRAINT "OrganizationUser_pin_hash" CHECK("pinHash" IS NULL OR "pinHash" ~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$');
ALTER TABLE "Session" ADD COLUMN "authenticationMethod" TEXT NOT NULL DEFAULT 'password';
ALTER TABLE "Session" ADD COLUMN "pinStoreId" TEXT;
ALTER TABLE "Session" ADD CONSTRAINT "Session_authentication_method" CHECK (("authenticationMethod"='password' AND "pinStoreId" IS NULL) OR ("authenticationMethod"='pin' AND "pinStoreId" IS NOT NULL));
ALTER TABLE "Session" ADD CONSTRAINT "Session_pin_store_fk" FOREIGN KEY ("pinStoreId") REFERENCES "Store"(id) ON DELETE CASCADE;
CREATE FUNCTION guard_pin_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='INSERT' AND NEW."authenticationMethod"='pin' AND NOT EXISTS(SELECT 1 FROM "Store" s WHERE s.id=NEW."pinStoreId" AND s."organizationId"=NEW."organizationId" AND s."isActive") THEN RAISE EXCEPTION 'PIN branch scope mismatch' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND ((NEW."authenticationMethod",NEW."pinStoreId",NEW."userId") IS DISTINCT FROM (OLD."authenticationMethod",OLD."pinStoreId",OLD."userId") OR (OLD."authenticationMethod"='pin' AND NEW."organizationId" IS DISTINCT FROM OLD."organizationId")) THEN RAISE EXCEPTION 'Session identity is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Session_pin_scope" BEFORE INSERT OR UPDATE ON "Session" FOR EACH ROW EXECUTE FUNCTION guard_pin_session();
