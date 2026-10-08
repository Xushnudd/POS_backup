CREATE TABLE "ProductPriceHistory" (
 id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "productId" TEXT NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,
 field TEXT NOT NULL CHECK(field IN ('salePrice','costPrice')), "oldValue" NUMERIC(20,6), "newValue" NUMERIC(20,6) NOT NULL CHECK("newValue">=0),
 "productName" TEXT NOT NULL, sku TEXT NOT NULL, "actorId" TEXT, source TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ProductPriceHistory_organizationId_productId_createdAt_id_idx" ON "ProductPriceHistory"("organizationId","productId","createdAt",id);
-- A current baseline, never an invented historical change or date.
INSERT INTO "ProductPriceHistory" SELECT gen_random_uuid()::text,p."organizationId",p.id,v.field,NULL,v.value,p.name,p.sku,NULL,'migration_baseline',CURRENT_TIMESTAMP FROM "Product" p CROSS JOIN LATERAL (VALUES ('salePrice',p."salePrice"),('costPrice',p."costPrice")) v(field,value);
CREATE FUNCTION record_product_price() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_actor TEXT:=NULLIF(current_setting('pos.price_actor',true),''); v_source TEXT:=COALESCE(NULLIF(current_setting('pos.price_source',true),''),'database');
BEGIN
 IF TG_OP='INSERT' OR NEW."salePrice" IS DISTINCT FROM OLD."salePrice" THEN
 INSERT INTO "ProductPriceHistory" VALUES(gen_random_uuid()::text,NEW."organizationId",NEW.id,'salePrice',CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD."salePrice" END,NEW."salePrice",NEW.name,NEW.sku,v_actor,v_source,CURRENT_TIMESTAMP);
 END IF;
 IF TG_OP='INSERT' OR NEW."costPrice" IS DISTINCT FROM OLD."costPrice" THEN
 INSERT INTO "ProductPriceHistory" VALUES(gen_random_uuid()::text,NEW."organizationId",NEW.id,'costPrice',CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD."costPrice" END,NEW."costPrice",NEW.name,NEW.sku,v_actor,v_source,CURRENT_TIMESTAMP);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER product_price_history AFTER INSERT OR UPDATE OF "salePrice","costPrice" ON "Product" FOR EACH ROW EXECUTE FUNCTION record_product_price();
CREATE FUNCTION price_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Price history is immutable'; END $$;
CREATE TRIGGER price_history_immutable BEFORE UPDATE OR DELETE ON "ProductPriceHistory" FOR EACH ROW EXECUTE FUNCTION price_history_immutable();
