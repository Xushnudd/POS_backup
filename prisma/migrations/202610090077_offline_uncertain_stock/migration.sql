CREATE OR REPLACE FUNCTION reservation_conservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s TEXT;p TEXT;o TEXT;physical NUMERIC;zoned NUMERIC;held NUMERIC;unassignedheld NUMERIC;
BEGIN
 IF TG_OP='DELETE' THEN s:=OLD."storeId";p:=OLD."productId";ELSE s:=NEW."storeId";p:=NEW."productId";END IF;
 SELECT "organizationId" INTO o FROM "Store" WHERE id=s;
 IF o IS NULL OR NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=o) THEN RETURN NULL;END IF;
 SELECT COALESCE(quantity,0) INTO physical FROM "InventoryBalance" WHERE "storeId"=s AND "productId"=p;physical:=GREATEST(COALESCE(physical,0),0);
 SELECT COALESCE(sum(quantity),0) INTO zoned FROM "LocationBalance" WHERE "storeId"=s AND "productId"=p;
 SELECT COALESCE(sum(i."remainingQuantity"),0),COALESCE(sum(i."remainingQuantity") FILTER(WHERE i."locationId" IS NULL),0) INTO held,unassignedheld FROM "ReservationItem" i JOIN "StockReservation" r ON r.id=i."reservationId" WHERE i."storeId"=s AND i."productId"=p AND r.status='active' AND (r."expiresAt">CURRENT_TIMESTAMP OR r.kind='cash_ticket');
 IF zoned>physical OR held>physical OR unassignedheld>physical-zoned THEN RAISE EXCEPTION 'Stock location/reservation conservation violated';END IF;
 IF EXISTS(SELECT 1 FROM "ReservationItem" i JOIN "StockReservation" r ON r.id=i."reservationId" LEFT JOIN "LocationBalance" b ON b."locationId"=i."locationId" AND b."productId"=i."productId" WHERE i."storeId"=s AND i."productId"=p AND i."locationId" IS NOT NULL AND r.status='active' AND (r."expiresAt">CURRENT_TIMESTAMP OR r.kind='cash_ticket') GROUP BY i."locationId",b.quantity HAVING sum(i."remainingQuantity")>COALESCE(b.quantity,0)) THEN RAISE EXCEPTION 'Location reserved stock unavailable';END IF;
 IF EXISTS(SELECT 1 FROM "LocationBalance" b WHERE b."storeId"=s AND b."productId"=p AND b.quantity<>(SELECT COALESCE(sum(e."quantityDelta"),0) FROM "LocationEntry" e WHERE e."locationId"=b."locationId" AND e."productId"=p)) OR EXISTS(SELECT 1 FROM "LocationEntry" e WHERE e."storeId"=s AND e."productId"=p AND NOT EXISTS(SELECT 1 FROM "LocationBalance" b WHERE b."locationId"=e."locationId" AND b."productId"=p)) THEN RAISE EXCEPTION 'Location journal does not equal balance';END IF;
 RETURN NULL;
END $$;

-- Unknown offline goods/cash cannot become sellable merely because a clock expired.
CREATE FUNCTION offline_cash_expiry_stock_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.kind='cash_ticket' AND NEW.status='expired' AND EXISTS(SELECT 1 FROM "Organization" WHERE id=NEW."organizationId") AND NOT EXISTS(SELECT 1 FROM "OfflineCashLease" WHERE id=NEW.id AND state='cancelled') THEN RAISE EXCEPTION 'Physical reconciliation required before freeing offline stock';END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER offline_cash_expiry_stock_guard AFTER UPDATE ON "StockReservation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION offline_cash_expiry_stock_guard();
