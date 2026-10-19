-- Preserve the unit of physically zoned and not-yet-released reserved stock.
CREATE FUNCTION stock_unit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='Product' THEN
  IF NEW.unit IS DISTINCT FROM OLD.unit AND (EXISTS(SELECT 1 FROM "LocationBalance" WHERE "productId"=OLD.id AND quantity>0) OR EXISTS(SELECT 1 FROM "ReservationItem" WHERE "productId"=OLD.id AND "remainingQuantity">0)) THEN RAISE EXCEPTION 'Release reserved/zoned stock before changing unit';END IF;
 ELSE
  IF (NEW.code,NEW.precision) IS DISTINCT FROM (OLD.code,OLD.precision) AND EXISTS(SELECT 1 FROM "Product" p WHERE p."organizationId"=OLD."organizationId" AND p.unit=OLD.code AND (EXISTS(SELECT 1 FROM "LocationBalance" WHERE "productId"=p.id AND quantity>0) OR EXISTS(SELECT 1 FROM "ReservationItem" WHERE "productId"=p.id AND "remainingQuantity">0))) THEN RAISE EXCEPTION 'Reserved/zoned unit precision immutable';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER product_stock_unit_guard BEFORE UPDATE ON "Product" FOR EACH ROW EXECUTE FUNCTION stock_unit_guard();
CREATE TRIGGER unit_stock_precision_guard BEFORE UPDATE ON "Unit" FOR EACH ROW EXECUTE FUNCTION stock_unit_guard();
