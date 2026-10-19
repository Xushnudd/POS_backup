CREATE UNIQUE INDEX "Product_id_organizationId_key" ON "Product"(id,"organizationId");
CREATE TABLE "ProductUnitConversion"(id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"productId" TEXT NOT NULL,"baseUnit" TEXT NOT NULL,"tradeUnit" TEXT NOT NULL,ratio NUMERIC(14,6) NOT NULL,"isActive" BOOLEAN NOT NULL DEFAULT TRUE,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT unit_conversion_ratio CHECK(ratio>0 AND ratio<100000000 AND "baseUnit"<>"tradeUnit"),FOREIGN KEY("productId","organizationId") REFERENCES "Product"(id,"organizationId") ON DELETE CASCADE,FOREIGN KEY("organizationId","baseUnit") REFERENCES "Unit"("organizationId",code) ON DELETE NO ACTION,FOREIGN KEY("organizationId","tradeUnit") REFERENCES "Unit"("organizationId",code) ON DELETE NO ACTION);
CREATE UNIQUE INDEX "ProductUnitConversion_productId_tradeUnit_key" ON "ProductUnitConversion"("productId","tradeUnit");
CREATE INDEX "ProductUnitConversion_organizationId_tradeUnit_idx" ON "ProductUnitConversion"("organizationId","tradeUnit");
ALTER TABLE "SaleItem" ADD COLUMN "conversionSnapshot" JSONB;
ALTER TABLE "StockDocumentItem" ADD COLUMN "conversionSnapshot" JSONB;
CREATE FUNCTION unit_conversion_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM "Product" p JOIN "Unit" b ON b."organizationId"=p."organizationId" AND b.code=p.unit JOIN "Unit" t ON t."organizationId"=p."organizationId" AND t.code=NEW."tradeUnit" WHERE p.id=NEW."productId" AND p."organizationId"=NEW."organizationId" AND p.unit=NEW."baseUnit" AND (NOT NEW."isActive" OR (b."isActive" AND t."isActive"))) THEN RAISE EXCEPTION 'Conversion requires own current base and trade units';END IF;RETURN NEW;
END $$;
CREATE TRIGGER unit_conversion_guard BEFORE INSERT OR UPDATE ON "ProductUnitConversion" FOR EACH ROW EXECUTE FUNCTION unit_conversion_guard();
CREATE FUNCTION conversion_product_unit_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.unit IS DISTINCT FROM OLD.unit AND EXISTS(SELECT 1 FROM "ProductUnitConversion" WHERE "productId"=OLD.id) THEN RAISE EXCEPTION 'Conversion base unit is immutable; use a new product';END IF;RETURN NEW;
END $$;
CREATE TRIGGER conversion_product_unit_guard BEFORE UPDATE ON "Product" FOR EACH ROW EXECUTE FUNCTION conversion_product_unit_guard();
CREATE FUNCTION conversion_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE s JSONB; BEGIN
 s=NEW."conversionSnapshot";IF s IS NULL THEN RETURN NEW;END IF;
 IF jsonb_typeof(s)<>'object' OR COALESCE(s->>'ratio','')!~'^\d+(\.\d{1,6})?$' OR COALESCE(s->>'tradeQuantity','')!~'^-?\d+(\.\d{1,6})?$' OR COALESCE(s->>'baseUnit','')='' OR COALESCE(s->>'tradeUnit','')='' OR (s->>'ratio')::numeric<=0 OR (s->>'ratio')::numeric>=100000000 OR NEW.quantity<>(s->>'ratio')::numeric*(s->>'tradeQuantity')::numeric THEN RAISE EXCEPTION 'Conversion snapshot quantity mismatch';END IF;RETURN NEW;
END $$;
CREATE TRIGGER sale_conversion_snapshot_guard BEFORE INSERT OR UPDATE ON "SaleItem" FOR EACH ROW EXECUTE FUNCTION conversion_snapshot_guard();
CREATE TRIGGER stock_conversion_snapshot_guard BEFORE INSERT OR UPDATE ON "StockDocumentItem" FOR EACH ROW EXECUTE FUNCTION conversion_snapshot_guard();
