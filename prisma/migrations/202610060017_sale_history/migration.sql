BEGIN;
-- Posted receipt snapshots survive direct writes and cascades from stores,
-- registers, shifts and products. Whole-organization deletion remains possible.
CREATE FUNCTION guard_posted_sale() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE fully_returned BOOLEAN;
BEGIN
 IF OLD.status IN ('completed','partially_returned','returned')
    AND EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN
  IF TG_OP='DELETE' THEN
   RAISE EXCEPTION 'Posted sale is immutable' USING ERRCODE='23514';
  END IF;
  IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN
   RAISE EXCEPTION 'Posted sale snapshot is immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
   IF OLD.status='returned' OR NEW.status NOT IN ('partially_returned','returned')
      OR NOT EXISTS(SELECT 1 FROM "SaleReturn" WHERE "saleId"=OLD.id) THEN
    RAISE EXCEPTION 'Posted sale requires a linked return' USING ERRCODE='23514';
   END IF;
   SELECT NOT EXISTS(
    SELECT 1 FROM "SaleItem" i WHERE i."saleId"=OLD.id
     AND i.quantity <> COALESCE((SELECT SUM(r.quantity) FROM "SaleReturnItem" r WHERE r."saleItemId"=i.id),0)
   ) INTO fully_returned;
   IF fully_returned <> (NEW.status='returned') THEN
    RAISE EXCEPTION 'Return status does not match original quantities' USING ERRCODE='23514';
   END IF;
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Sale_posted_immutable" BEFORE UPDATE OR DELETE ON "Sale"
 FOR EACH ROW EXECUTE FUNCTION guard_posted_sale();

CREATE FUNCTION guard_posted_sale_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' AND EXISTS(
  SELECT 1 FROM "Sale" s JOIN "Organization" o ON o.id=s."organizationId"
   WHERE s.id=OLD."saleId" AND s.status IN ('completed','partially_returned','returned')
 ) THEN
  RAISE EXCEPTION 'Posted sale items are immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP <> 'DELETE' AND EXISTS(
  SELECT 1 FROM "Sale" s JOIN "Organization" o ON o.id=s."organizationId"
   WHERE s.id=NEW."saleId" AND s.status IN ('completed','partially_returned','returned')
 ) THEN
  RAISE EXCEPTION 'Posted sale items are immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "SaleItem_posted_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "SaleItem"
 FOR EACH ROW EXECUTE FUNCTION guard_posted_sale_item();
COMMIT;
