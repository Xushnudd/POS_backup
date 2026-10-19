BEGIN;
ALTER TABLE "Sale" ADD COLUMN "sellerId" TEXT REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE, ADD COLUMN "serviceType" TEXT;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_service_type_check" CHECK("serviceType" IS NULL OR length(trim("serviceType")) BETWEEN 1 AND 100);
CREATE FUNCTION guard_sale_seller_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."sellerId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "organizationId"=NEW."organizationId" AND "userId"=NEW."sellerId") THEN
  RAISE EXCEPTION 'Sale seller tenant mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Sale_seller_scope" BEFORE INSERT OR UPDATE OF "sellerId","organizationId" ON "Sale" FOR EACH ROW EXECUTE FUNCTION guard_sale_seller_scope();
COMMIT;
