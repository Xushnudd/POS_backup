BEGIN;
CREATE TABLE "Unit" (
 id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 code TEXT NOT NULL, name TEXT NOT NULL, precision INTEGER NOT NULL CHECK (precision BETWEEN 0 AND 6),
 "isActive" BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE("organizationId",code)
);
-- Existing unknown unit codes keep the old six-decimal behavior; no conversion is inferred.
INSERT INTO "Unit" (id,"organizationId",code,name,precision)
SELECT gen_random_uuid()::text,o.id,u.code,u.name,u.precision FROM "Organization" o CROSS JOIN (VALUES ('dona','Dona',0),('kg','Kilogramm',6),('litr','Litr',6),('metr','Metr',6)) AS u(code,name,precision);
INSERT INTO "Unit" (id,"organizationId",code,name,precision)
SELECT gen_random_uuid()::text,legacy."organizationId",legacy.unit,legacy.unit,6 FROM (SELECT DISTINCT "organizationId",unit FROM "Product") legacy
WHERE NOT EXISTS(SELECT 1 FROM "Unit" u WHERE u."organizationId"=legacy."organizationId" AND u.code=legacy.unit);
CREATE FUNCTION seed_pos_units() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "Unit" (id,"organizationId",code,name,precision)
 SELECT gen_random_uuid()::text,NEW.id,u.code,u.name,u.precision FROM (VALUES ('dona','Dona',0),('kg','Kilogramm',6),('litr','Litr',6),('metr','Metr',6)) AS u(code,name,precision);
 RETURN NEW;
END $$;
CREATE TRIGGER "Organization_seed_units" AFTER INSERT ON "Organization" FOR EACH ROW EXECUTE FUNCTION seed_pos_units();
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenant_unit_fk" FOREIGN KEY("organizationId",unit) REFERENCES "Unit"("organizationId",code);
ALTER TABLE "SaleItem" ADD COLUMN unit TEXT;
CREATE TABLE "ProductBarcode" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "productId" TEXT NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,value TEXT NOT NULL,
 "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ProductBarcode_tenant_product_fk" FOREIGN KEY("organizationId","productId") REFERENCES "Product"("organizationId",id)
);
CREATE UNIQUE INDEX "ProductBarcode_organizationId_value_key" ON "ProductBarcode"("organizationId",value);
CREATE INDEX "ProductBarcode_productId_idx" ON "ProductBarcode"("productId");
CREATE UNIQUE INDEX "ProductBarcode_one_primary" ON "ProductBarcode"("productId") WHERE "isPrimary";
INSERT INTO "ProductBarcode" (id,"organizationId","productId",value,"isPrimary") SELECT gen_random_uuid()::text,"organizationId",id,barcode,TRUE FROM "Product";
-- Keep the existing Product.barcode API as the authoritative primary barcode.
CREATE FUNCTION sync_pos_primary_barcode() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.barcode=NEW.barcode THEN RETURN NEW; END IF;
 DELETE FROM "ProductBarcode" WHERE "productId"=NEW.id AND "isPrimary";
 INSERT INTO "ProductBarcode" (id,"organizationId","productId",value,"isPrimary") VALUES (gen_random_uuid()::text,NEW."organizationId",NEW.id,NEW.barcode,TRUE)
 ON CONFLICT("organizationId",value) DO UPDATE SET "isPrimary"=TRUE WHERE "ProductBarcode"."productId"=NEW.id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23505', CONSTRAINT='ProductBarcode_organizationId_value_key', MESSAGE='barcode belongs to another product'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Product_primary_barcode" AFTER INSERT OR UPDATE OF barcode ON "Product" FOR EACH ROW EXECUTE FUNCTION sync_pos_primary_barcode();
CREATE FUNCTION protect_pos_primary_barcode() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD."isPrimary" AND EXISTS(SELECT 1 FROM "Product" p JOIN "Organization" o ON o.id=p."organizationId" WHERE p.id=OLD."productId" AND p.barcode=OLD.value) THEN RAISE EXCEPTION 'primary barcode must be changed on product'; END IF;
  RETURN OLD;
 END IF;
 IF NEW."isPrimary" AND NOT EXISTS(SELECT 1 FROM "Product" p WHERE p.id=NEW."productId" AND p.barcode=NEW.value) THEN RAISE EXCEPTION 'primary barcode mismatch'; END IF;
 IF TG_OP='UPDATE' AND OLD."isPrimary" AND (NOT NEW."isPrimary" OR NEW.value<>OLD.value OR NEW."productId"<>OLD."productId") AND EXISTS(SELECT 1 FROM "Product" p JOIN "Organization" o ON o.id=p."organizationId" WHERE p.id=OLD."productId" AND p.barcode=OLD.value) THEN RAISE EXCEPTION 'primary barcode must be changed on product'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ProductBarcode_primary_protection" BEFORE INSERT OR UPDATE OR DELETE ON "ProductBarcode" FOR EACH ROW EXECUTE FUNCTION protect_pos_primary_barcode();
-- Changing a stocked/sold base unit would reinterpret history and quantities.
CREATE FUNCTION protect_pos_product_unit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.unit<>OLD.unit AND (EXISTS(SELECT 1 FROM "SaleItem" WHERE "productId"=OLD.id) OR EXISTS(SELECT 1 FROM "InventoryMovement" WHERE "productId"=OLD.id) OR EXISTS(SELECT 1 FROM "InventoryBalance" WHERE "productId"=OLD.id AND quantity<>0)) THEN RAISE EXCEPTION 'base unit has history; create a separate product'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Product_unit_history" BEFORE UPDATE OF unit ON "Product" FOR EACH ROW EXECUTE FUNCTION protect_pos_product_unit();
COMMIT;
