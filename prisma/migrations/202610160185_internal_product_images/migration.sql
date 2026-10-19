BEGIN;
-- Do not rewrite or erase historical external URLs. Reject new assignments;
-- unrelated updates of a legacy card can continue until its image is replaced.
CREATE FUNCTION pos_product_image_boundary() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW."imageUrl" IS NOT DISTINCT FROM OLD."imageUrl" THEN RETURN NEW;END IF;
 IF NEW."imageUrl" IS NOT NULL AND NEW."imageUrl" !~* '^/api/files/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
  RAISE EXCEPTION 'INTERNAL_PRODUCT_IMAGE_REQUIRED' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER product_image_boundary BEFORE INSERT OR UPDATE OF "imageUrl" ON "Product" FOR EACH ROW EXECUTE FUNCTION pos_product_image_boundary();
COMMIT;
