-- Counting physically missing, unposted offline goods would subtract them twice.
CREATE FUNCTION offline_count_freeze_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('stock:'||NEW."storeId"||':'||NEW."productId",0));
 IF EXISTS(SELECT 1 FROM "ReservationItem" i JOIN "StockReservation" r ON r.id=i."reservationId" WHERE i."storeId"=NEW."storeId" AND i."productId"=NEW."productId" AND r.kind='cash_ticket' AND r.status='active' AND i."remainingQuantity">0) THEN RAISE EXCEPTION 'Reconcile uncertain offline goods before physical count';END IF;RETURN NEW;
END $$;
CREATE TRIGGER offline_count_freeze_guard BEFORE INSERT ON "StockFreeze" FOR EACH ROW EXECUTE FUNCTION offline_count_freeze_guard();
CREATE FUNCTION reservation_count_freeze_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('stock:'||NEW."storeId"||':'||NEW."productId",0));
 IF EXISTS(SELECT 1 FROM "StockFreeze" WHERE "storeId"=NEW."storeId" AND "productId"=NEW."productId") THEN RAISE EXCEPTION 'Stock count frozen';END IF;RETURN NEW;
END $$;
CREATE TRIGGER reservation_count_freeze_guard BEFORE INSERT ON "ReservationItem" FOR EACH ROW EXECUTE FUNCTION reservation_count_freeze_guard();
