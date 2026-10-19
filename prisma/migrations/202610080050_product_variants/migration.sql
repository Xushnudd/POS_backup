CREATE TABLE "ProductVariant" (
 "productId" TEXT PRIMARY KEY REFERENCES "Product"(id) ON DELETE CASCADE,
 "rootProductId" TEXT NOT NULL REFERENCES "Product"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
 options JSONB NOT NULL CHECK (jsonb_typeof(options)='object'),
 "combinationKey" TEXT GENERATED ALWAYS AS (options::text) STORED,
 UNIQUE ("rootProductId","combinationKey")
);
INSERT INTO "ProductVariant"("productId","rootProductId",options) SELECT id,id,'{}'::jsonb FROM "Product";
CREATE FUNCTION variant_default() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO "ProductVariant"("productId","rootProductId",options) VALUES(NEW.id,NEW.id,'{}'); RETURN NEW;
END $$;
CREATE TRIGGER product_default_variant AFTER INSERT ON "Product" FOR EACH ROW EXECUTE FUNCTION variant_default();
CREATE FUNCTION variant_scope() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE p "Product"; r "Product"; n INTEGER; BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "Product" WHERE id=OLD."productId") THEN RAISE EXCEPTION 'variant identity cannot be removed' USING ERRCODE='23514'; END IF; RETURN OLD;
 END IF;
 SELECT * INTO p FROM "Product" WHERE id=NEW."productId";
 SELECT * INTO r FROM "Product" WHERE id=NEW."rootProductId" FOR UPDATE;
 IF p.id IS NULL OR r.id IS NULL OR p."organizationId"<>r."organizationId" OR p.unit<>r.unit THEN RAISE EXCEPTION 'variant scope or unit mismatch' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (OLD."productId"<>NEW."productId" OR OLD."rootProductId"<>OLD."productId" OR OLD.options<>'{}'::jsonb OR EXISTS(SELECT 1 FROM "ProductVariant" WHERE "rootProductId"=OLD."productId" AND "productId"<>OLD."productId")) THEN RAISE EXCEPTION 'variant identity immutable' USING ERRCODE='23514'; END IF;
 IF NEW."rootProductId"=NEW."productId" THEN
  IF NEW.options<>'{}'::jsonb THEN RAISE EXCEPTION 'root variant must be default' USING ERRCODE='23514'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM "ProductVariant" WHERE "productId"=r.id AND "rootProductId"=r.id AND options='{}'::jsonb) THEN RAISE EXCEPTION 'variant root cannot be another child' USING ERRCODE='23514'; END IF;
  SELECT count(*) INTO n FROM jsonb_each(NEW.options);
  IF n<1 OR n>8 OR EXISTS(SELECT 1 FROM jsonb_each(NEW.options) e WHERE length(e.key)<1 OR length(e.key)>40 OR e.key<>lower(btrim(e.key)) OR jsonb_typeof(e.value)<>'string' OR length(e.value#>>'{}')<1 OR length(e.value#>>'{}')>80 OR e.value#>>'{}'<>lower(btrim(e.value#>>'{}'))) THEN RAISE EXCEPTION 'invalid variant options' USING ERRCODE='23514'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER variant_identity_guard BEFORE INSERT OR UPDATE OR DELETE ON "ProductVariant" FOR EACH ROW EXECUTE FUNCTION variant_scope();
CREATE FUNCTION variant_unit_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.unit<>OLD.unit AND EXISTS(SELECT 1 FROM "ProductVariant" v JOIN "Product" p ON p.id=CASE WHEN v."productId"=NEW.id THEN v."rootProductId" ELSE v."productId" END WHERE (v."productId"=NEW.id AND v."rootProductId"<>NEW.id OR v."rootProductId"=NEW.id AND v."productId"<>NEW.id) AND p.unit<>NEW.unit) THEN RAISE EXCEPTION 'variant family unit immutable' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER product_variant_unit BEFORE UPDATE OF unit ON "Product" FOR EACH ROW EXECUTE FUNCTION variant_unit_guard();
