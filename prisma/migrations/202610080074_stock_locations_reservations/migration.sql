CREATE TABLE "StockLocation" (id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"storeId" TEXT NOT NULL,name TEXT NOT NULL,"isActive" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "stock_location_name" CHECK(length(trim(name)) BETWEEN 2 AND 100),
 FOREIGN KEY("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE,
 FOREIGN KEY("organizationId","storeId") REFERENCES "Store"("organizationId",id) DEFERRABLE INITIALLY DEFERRED);
CREATE UNIQUE INDEX "StockLocation_storeId_name_key" ON "StockLocation"("storeId",name);
CREATE INDEX "StockLocation_organizationId_storeId_idx" ON "StockLocation"("organizationId","storeId");
CREATE UNIQUE INDEX "StockLocation_scope" ON "StockLocation"("organizationId","storeId",id);
CREATE TABLE "LocationBalance" (id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"storeId" TEXT NOT NULL,"productId" TEXT NOT NULL,"locationId" TEXT NOT NULL,quantity DECIMAL(20,6) NOT NULL DEFAULT 0 CHECK(quantity>=0),
 FOREIGN KEY("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE,
 FOREIGN KEY("organizationId","storeId","locationId") REFERENCES "StockLocation"("organizationId","storeId",id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("organizationId","productId") REFERENCES "Product"("organizationId",id) DEFERRABLE INITIALLY DEFERRED);
CREATE UNIQUE INDEX "LocationBalance_locationId_productId_key" ON "LocationBalance"("locationId","productId");
CREATE INDEX "LocationBalance_storeId_productId_idx" ON "LocationBalance"("storeId","productId");
CREATE TABLE "LocationEntry" (id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"storeId" TEXT NOT NULL,"productId" TEXT NOT NULL,"locationId" TEXT NOT NULL,"quantityDelta" DECIMAL(20,6) NOT NULL CHECK("quantityDelta"<>0),"sourceType" TEXT NOT NULL,"sourceId" TEXT NOT NULL,unit TEXT NOT NULL,reason TEXT NOT NULL,"actorId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE,
 FOREIGN KEY("organizationId","storeId","locationId") REFERENCES "StockLocation"("organizationId","storeId",id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("organizationId","productId") REFERENCES "Product"("organizationId",id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("actorId") REFERENCES "User"(id),CHECK(length(trim(reason)) BETWEEN 3 AND 2000 AND length("sourceId") BETWEEN 1 AND 200));
CREATE INDEX "LocationEntry_locationId_productId_createdAt_idx" ON "LocationEntry"("locationId","productId","createdAt");
CREATE INDEX "LocationEntry_organizationId_storeId_productId_idx" ON "LocationEntry"("organizationId","storeId","productId");
CREATE TRIGGER location_entry_immutable BEFORE UPDATE OR DELETE ON "LocationEntry" FOR EACH ROW EXECUTE FUNCTION stock_journal_immutable();
CREATE TABLE "StockReservation" (id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"storeId" TEXT NOT NULL,"registerId" TEXT,"userId" TEXT NOT NULL,"sessionId" TEXT NOT NULL,"deviceId" TEXT,kind TEXT NOT NULL DEFAULT 'manual',status TEXT NOT NULL DEFAULT 'active',"expiresAt" TIMESTAMP(3) NOT NULL,reason TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE,
 FOREIGN KEY("organizationId","storeId") REFERENCES "Store"("organizationId",id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("userId") REFERENCES "User"(id),FOREIGN KEY("sessionId") REFERENCES "Session"(id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("registerId") REFERENCES "Register"(id) DEFERRABLE INITIALLY DEFERRED,
 CHECK(kind IN ('manual','cash_ticket') AND status IN ('active','consumed','released','expired') AND "expiresAt">"createdAt" AND "expiresAt"<="createdAt"+interval '24 hours' AND length(trim(reason)) BETWEEN 3 AND 2000));
CREATE INDEX "StockReservation_organizationId_storeId_status_expiresAt_idx" ON "StockReservation"("organizationId","storeId",status,"expiresAt");
CREATE UNIQUE INDEX "StockReservation_scope" ON "StockReservation"("organizationId","storeId",id);
CREATE TABLE "ReservationItem" (id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"storeId" TEXT NOT NULL,"reservationId" TEXT NOT NULL,"productId" TEXT NOT NULL,"locationId" TEXT,quantity DECIMAL(20,6) NOT NULL,"remainingQuantity" DECIMAL(20,6) NOT NULL,unit TEXT NOT NULL,
 FOREIGN KEY("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE,
 FOREIGN KEY("organizationId","storeId","reservationId") REFERENCES "StockReservation"("organizationId","storeId",id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("organizationId","productId") REFERENCES "Product"("organizationId",id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("organizationId","storeId","locationId") REFERENCES "StockLocation"("organizationId","storeId",id) DEFERRABLE INITIALLY DEFERRED,
 CHECK(quantity>0 AND "remainingQuantity">=0 AND "remainingQuantity"<=quantity));
CREATE UNIQUE INDEX "ReservationItem_reservationId_productId_key" ON "ReservationItem"("reservationId","productId");
CREATE INDEX "ReservationItem_storeId_productId_idx" ON "ReservationItem"("storeId","productId");
CREATE TABLE "ReservationEntry" (id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"storeId" TEXT NOT NULL,"itemId" TEXT NOT NULL,quantity DECIMAL(20,6) NOT NULL CHECK(quantity>0),kind TEXT NOT NULL,"operationKey" TEXT NOT NULL,"saleId" TEXT,"actorId" TEXT,reason TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE,
 FOREIGN KEY("itemId") REFERENCES "ReservationItem"(id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("saleId") REFERENCES "Sale"(id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("actorId") REFERENCES "User"(id),
 CHECK(kind IN ('consume','release','expire') AND (kind='consume')=("saleId" IS NOT NULL) AND (kind='expire')=("actorId" IS NULL) AND length(trim(reason)) BETWEEN 3 AND 2000));
CREATE UNIQUE INDEX "ReservationEntry_itemId_operationKey_key" ON "ReservationEntry"("itemId","operationKey");
CREATE INDEX "ReservationEntry_organizationId_storeId_createdAt_idx" ON "ReservationEntry"("organizationId","storeId","createdAt");
CREATE TRIGGER reservation_entry_immutable BEFORE UPDATE OR DELETE ON "ReservationEntry" FOR EACH ROW EXECUTE FUNCTION stock_journal_immutable();

-- Every writer (including SQL maintenance) serializes on the existing stock key.
CREATE FUNCTION reservation_stock_lock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s TEXT; p TEXT;
BEGIN
 IF TG_OP='DELETE' THEN s:=OLD."storeId";p:=OLD."productId";ELSE s:=NEW."storeId";p:=NEW."productId";END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('stock:'||s||':'||p,0));
 IF TG_OP='UPDATE' AND (NEW."storeId",NEW."productId") IS DISTINCT FROM (OLD."storeId",OLD."productId") THEN RAISE EXCEPTION 'Stock identity immutable';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
CREATE TRIGGER reservation_stock_lock BEFORE INSERT OR UPDATE OR DELETE ON "InventoryBalance" FOR EACH ROW EXECUTE FUNCTION reservation_stock_lock();
CREATE TRIGGER location_stock_lock BEFORE INSERT OR UPDATE OR DELETE ON "LocationBalance" FOR EACH ROW EXECUTE FUNCTION reservation_stock_lock();
CREATE TRIGGER reservation_item_stock_lock BEFORE INSERT OR UPDATE OR DELETE ON "ReservationItem" FOR EACH ROW EXECUTE FUNCTION reservation_stock_lock();

CREATE FUNCTION reservation_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'Reservation/location history cannot be deleted';END IF;RETURN OLD;
 END IF;
 IF TG_TABLE_NAME='StockReservation' THEN
  IF TG_OP='UPDATE' THEN
   IF (NEW.id,NEW."organizationId",NEW."storeId",NEW."registerId",NEW."userId",NEW."sessionId",NEW."deviceId",NEW.kind,NEW."expiresAt",NEW.reason,NEW."createdAt") IS DISTINCT FROM (OLD.id,OLD."organizationId",OLD."storeId",OLD."registerId",OLD."userId",OLD."sessionId",OLD."deviceId",OLD.kind,OLD."expiresAt",OLD.reason,OLD."createdAt") OR (OLD.status<>NEW.status AND NOT(OLD.status='active' AND NEW.status IN ('consumed','released','expired'))) THEN RAISE EXCEPTION 'Reservation authorization immutable';END IF;
  ELSE
   IF NEW.status<>'active' OR NOT EXISTS(SELECT 1 FROM "Session" s WHERE s.id=NEW."sessionId" AND s."userId"=NEW."userId" AND s."organizationId"=NEW."organizationId" AND s."revokedAt" IS NULL AND s."expiresAt">CURRENT_TIMESTAMP AND s."idleExpiresAt">CURRENT_TIMESTAMP) THEN RAISE EXCEPTION 'Reservation requires live source session';END IF;
   IF NEW."registerId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Register" r JOIN "Store" st ON st.id=r."storeId" WHERE r.id=NEW."registerId" AND r."storeId"=NEW."storeId" AND st."organizationId"=NEW."organizationId" AND r."isActive" AND st."isActive") THEN RAISE EXCEPTION 'Reservation register scope invalid';END IF;
  END IF;
 ELSIF TG_TABLE_NAME='ReservationItem' THEN
  IF TG_OP='UPDATE' AND ((NEW.id,NEW."organizationId",NEW."storeId",NEW."reservationId",NEW."productId",NEW."locationId",NEW.quantity,NEW.unit) IS DISTINCT FROM (OLD.id,OLD."organizationId",OLD."storeId",OLD."reservationId",OLD."productId",OLD."locationId",OLD.quantity,OLD.unit) OR NEW."remainingQuantity">OLD."remainingQuantity") THEN RAISE EXCEPTION 'Reservation item snapshot immutable';END IF;
  IF TG_OP='INSERT' AND (NEW.quantity<>NEW."remainingQuantity" OR NOT EXISTS(SELECT 1 FROM "Product" p JOIN "Unit" u ON u."organizationId"=p."organizationId" AND u.code=p.unit WHERE p.id=NEW."productId" AND p."organizationId"=NEW."organizationId" AND p.unit=NEW.unit AND p."isActive" AND u."isActive" AND NEW.quantity=round(NEW.quantity,u.precision))) THEN RAISE EXCEPTION 'Reservation quantity/unit invalid';END IF;
 ELSIF TG_TABLE_NAME='StockLocation' THEN
  IF TG_OP='UPDATE' AND (NEW.id,NEW."organizationId",NEW."storeId",NEW."createdAt") IS DISTINCT FROM (OLD.id,OLD."organizationId",OLD."storeId",OLD."createdAt") THEN RAISE EXCEPTION 'Location scope immutable';END IF;
  IF NOT NEW."isActive" AND EXISTS(SELECT 1 FROM "LocationBalance" WHERE "locationId"=NEW.id AND quantity>0) THEN RAISE EXCEPTION 'Nonempty location cannot be archived';END IF;
 ELSIF TG_TABLE_NAME='LocationBalance' THEN
  IF TG_OP='UPDATE' AND (NEW.id,NEW."organizationId",NEW."storeId",NEW."productId",NEW."locationId") IS DISTINCT FROM (OLD.id,OLD."organizationId",OLD."storeId",OLD."productId",OLD."locationId") THEN RAISE EXCEPTION 'Location balance scope immutable';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reservation_snapshot_guard BEFORE INSERT OR UPDATE OR DELETE ON "StockReservation" FOR EACH ROW EXECUTE FUNCTION reservation_snapshot_guard();
CREATE TRIGGER reservation_item_snapshot_guard BEFORE INSERT OR UPDATE OR DELETE ON "ReservationItem" FOR EACH ROW EXECUTE FUNCTION reservation_snapshot_guard();
CREATE TRIGGER location_snapshot_guard BEFORE UPDATE OR DELETE ON "StockLocation" FOR EACH ROW EXECUTE FUNCTION reservation_snapshot_guard();
CREATE TRIGGER location_balance_snapshot_guard BEFORE UPDATE OR DELETE ON "LocationBalance" FOR EACH ROW EXECUTE FUNCTION reservation_snapshot_guard();

CREATE FUNCTION reservation_conservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s TEXT;p TEXT;o TEXT;physical NUMERIC;zoned NUMERIC;held NUMERIC;unassignedheld NUMERIC;
BEGIN
 IF TG_OP='DELETE' THEN s:=OLD."storeId";p:=OLD."productId";ELSE s:=NEW."storeId";p:=NEW."productId";END IF;
 SELECT "organizationId" INTO o FROM "Store" WHERE id=s;
 IF o IS NULL OR NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=o) THEN RETURN NULL;END IF;
 SELECT COALESCE(quantity,0) INTO physical FROM "InventoryBalance" WHERE "storeId"=s AND "productId"=p;physical:=GREATEST(COALESCE(physical,0),0);
 SELECT COALESCE(sum(quantity),0) INTO zoned FROM "LocationBalance" WHERE "storeId"=s AND "productId"=p;
 SELECT COALESCE(sum(i."remainingQuantity"),0),COALESCE(sum(i."remainingQuantity") FILTER(WHERE i."locationId" IS NULL),0) INTO held,unassignedheld FROM "ReservationItem" i JOIN "StockReservation" r ON r.id=i."reservationId" WHERE i."storeId"=s AND i."productId"=p AND r.status='active' AND r."expiresAt">CURRENT_TIMESTAMP;
 IF zoned>physical OR held>physical OR unassignedheld>physical-zoned THEN RAISE EXCEPTION 'Stock location/reservation conservation violated';END IF;
 IF EXISTS(SELECT 1 FROM "ReservationItem" i JOIN "StockReservation" r ON r.id=i."reservationId" LEFT JOIN "LocationBalance" b ON b."locationId"=i."locationId" AND b."productId"=i."productId" WHERE i."storeId"=s AND i."productId"=p AND i."locationId" IS NOT NULL AND r.status='active' AND r."expiresAt">CURRENT_TIMESTAMP GROUP BY i."locationId",b.quantity HAVING sum(i."remainingQuantity")>COALESCE(b.quantity,0)) THEN RAISE EXCEPTION 'Location reserved stock unavailable';END IF;
 IF EXISTS(SELECT 1 FROM "LocationBalance" b WHERE b."storeId"=s AND b."productId"=p AND b.quantity<>(SELECT COALESCE(sum(e."quantityDelta"),0) FROM "LocationEntry" e WHERE e."locationId"=b."locationId" AND e."productId"=p)) OR EXISTS(SELECT 1 FROM "LocationEntry" e WHERE e."storeId"=s AND e."productId"=p AND NOT EXISTS(SELECT 1 FROM "LocationBalance" b WHERE b."locationId"=e."locationId" AND b."productId"=p)) THEN RAISE EXCEPTION 'Location journal does not equal balance';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER reservation_stock_conservation AFTER INSERT OR UPDATE OR DELETE ON "InventoryBalance" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reservation_conservation_guard();
CREATE CONSTRAINT TRIGGER location_balance_conservation AFTER INSERT OR UPDATE OR DELETE ON "LocationBalance" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reservation_conservation_guard();
CREATE CONSTRAINT TRIGGER location_entry_conservation AFTER INSERT ON "LocationEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reservation_conservation_guard();
CREATE CONSTRAINT TRIGGER reservation_item_conservation AFTER INSERT OR UPDATE OR DELETE ON "ReservationItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reservation_conservation_guard();

CREATE FUNCTION reservation_journal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rid TEXT;r RECORD;i RECORD;e RECORD;
BEGIN
 IF TG_TABLE_NAME='StockReservation' THEN rid:=NEW.id;
 ELSIF TG_TABLE_NAME='ReservationItem' THEN rid:=NEW."reservationId";
 ELSE SELECT "reservationId" INTO rid FROM "ReservationItem" WHERE id=NEW."itemId";END IF;
 SELECT * INTO r FROM "StockReservation" WHERE id=rid;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=r."organizationId") THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM "ReservationItem" WHERE "reservationId"=rid) THEN RAISE EXCEPTION 'Empty reservation';END IF;
 FOR i IN SELECT * FROM "ReservationItem" WHERE "reservationId"=rid LOOP
  IF i."remainingQuantity"<>i.quantity-(SELECT COALESCE(sum(quantity),0) FROM "ReservationEntry" WHERE "itemId"=i.id) THEN RAISE EXCEPTION 'Reservation journal/counter mismatch';END IF;
  IF r.status<>'active' AND i."remainingQuantity"<>0 THEN RAISE EXCEPTION 'Closed reservation has remaining stock';END IF;
  FOR e IN SELECT * FROM "ReservationEntry" WHERE "itemId"=i.id LOOP
   IF (e."organizationId",e."storeId") IS DISTINCT FROM (i."organizationId",i."storeId") THEN RAISE EXCEPTION 'Reservation entry scope invalid';END IF;
   IF e.kind='expire' AND r."expiresAt">CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'Reservation not expired';END IF;
   IF e.kind='consume' AND NOT EXISTS(SELECT 1 FROM "Sale" s JOIN "SaleItem" si ON si."saleId"=s.id WHERE s.id=e."saleId" AND s."organizationId"=r."organizationId" AND s."storeId"=r."storeId" AND s.status IN ('completed','partially_returned','returned') AND si."productId"=i."productId" AND si.quantity>=(SELECT sum(x.quantity) FROM "ReservationEntry" x JOIN "ReservationItem" y ON y.id=x."itemId" WHERE x."saleId"=s.id AND y."productId"=i."productId" AND x.kind='consume')) THEN RAISE EXCEPTION 'Reservation consumption requires matching posted sale';END IF;
  END LOOP;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER reservation_header_journal AFTER INSERT OR UPDATE ON "StockReservation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reservation_journal_guard();
CREATE CONSTRAINT TRIGGER reservation_item_journal AFTER INSERT OR UPDATE ON "ReservationItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reservation_journal_guard();
CREATE CONSTRAINT TRIGGER reservation_entry_journal AFTER INSERT ON "ReservationEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reservation_journal_guard();
CREATE FUNCTION location_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('stock:'||NEW."storeId"||':'||NEW."productId",0));
 IF NOT EXISTS(SELECT 1 FROM "Product" p JOIN "Unit" u ON u."organizationId"=p."organizationId" AND u.code=p.unit WHERE p.id=NEW."productId" AND p."organizationId"=NEW."organizationId" AND p.unit=NEW.unit AND NEW."quantityDelta"=round(NEW."quantityDelta",u.precision)) THEN RAISE EXCEPTION 'Location entry unit/precision invalid';END IF;
 IF NEW."quantityDelta">0 AND NOT EXISTS(SELECT 1 FROM "StockLocation" WHERE id=NEW."locationId" AND "isActive") THEN RAISE EXCEPTION 'Location inactive';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER location_entry_guard BEFORE INSERT ON "LocationEntry" FOR EACH ROW EXECUTE FUNCTION location_entry_guard();
CREATE FUNCTION reservation_entry_precision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "ReservationItem" i JOIN "Unit" u ON u."organizationId"=i."organizationId" AND u.code=i.unit WHERE i.id=NEW."itemId" AND NEW.quantity=round(NEW.quantity,u.precision)) THEN RAISE EXCEPTION 'Reservation entry precision invalid';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reservation_entry_precision_guard BEFORE INSERT ON "ReservationEntry" FOR EACH ROW EXECUTE FUNCTION reservation_entry_precision_guard();
