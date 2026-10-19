CREATE TABLE "OfflineCashPolicy"(id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"storeId" TEXT NOT NULL UNIQUE,enabled BOOLEAN NOT NULL DEFAULT false,"maxAmount" NUMERIC(14,2) NOT NULL CHECK("maxAmount">0),"ttlSeconds" INTEGER NOT NULL CHECK("ttlSeconds" BETWEEN 30 AND 300),reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 2000),"updatedBy" TEXT NOT NULL REFERENCES "User"(id),"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE,
 FOREIGN KEY("organizationId","storeId") REFERENCES "Store"("organizationId",id) DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "OfflineCashPolicy_organizationId_storeId_idx" ON "OfflineCashPolicy"("organizationId","storeId");
CREATE TABLE "OfflineCashLease"(id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"storeId" TEXT NOT NULL,"registerId" TEXT NOT NULL,"shiftId" TEXT NOT NULL,"saleId" TEXT NOT NULL,"userId" TEXT NOT NULL,"sessionId" TEXT NOT NULL,"deviceId" TEXT NOT NULL,"cashOperationId" TEXT NOT NULL UNIQUE,state TEXT NOT NULL DEFAULT 'issued' CHECK(state IN ('issued','consumed','cancelled')),payload JSONB NOT NULL,"publicKey" JSONB NOT NULL,signature TEXT NOT NULL,"payloadHash" TEXT NOT NULL CHECK("payloadHash"~'^[0-9a-f]{64}$'),"expiresAt" TIMESTAMP(3) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"cancellationProof" JSONB,"cancelledBy" TEXT REFERENCES "User"(id),"cancelledAt" TIMESTAMP(3),
 FOREIGN KEY("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE,
 FOREIGN KEY(id) REFERENCES "StockReservation"(id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("organizationId","storeId") REFERENCES "Store"("organizationId",id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("registerId") REFERENCES "Register"(id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("shiftId") REFERENCES "Shift"(id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("saleId") REFERENCES "Sale"(id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("userId") REFERENCES "User"(id),FOREIGN KEY("sessionId") REFERENCES "Session"(id) DEFERRABLE INITIALLY DEFERRED,
 CHECK("expiresAt">"createdAt" AND "expiresAt"<="createdAt"+interval '5 minutes'),CHECK((state='cancelled')=("cancellationProof" IS NOT NULL AND "cancelledBy" IS NOT NULL AND "cancelledAt" IS NOT NULL)));
CREATE INDEX "OfflineCashLease_organizationId_storeId_state_idx" ON "OfflineCashLease"("organizationId","storeId",state);
CREATE INDEX "OfflineCashLease_saleId_state_idx" ON "OfflineCashLease"("saleId",state);
CREATE UNIQUE INDEX offline_cash_one_issued_sale ON "OfflineCashLease"("saleId") WHERE state='issued';
CREATE INDEX "OfflineCashLease_shiftId_state_idx" ON "OfflineCashLease"("shiftId",state);
CREATE FUNCTION offline_cash_lease_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s RECORD;r RECORD;
BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'Offline authorization history immutable';END IF;RETURN OLD;END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.id,NEW."organizationId",NEW."storeId",NEW."registerId",NEW."shiftId",NEW."saleId",NEW."userId",NEW."sessionId",NEW."deviceId",NEW."cashOperationId",NEW.payload,NEW."publicKey",NEW.signature,NEW."payloadHash",NEW."expiresAt",NEW."createdAt") IS DISTINCT FROM (OLD.id,OLD."organizationId",OLD."storeId",OLD."registerId",OLD."shiftId",OLD."saleId",OLD."userId",OLD."sessionId",OLD."deviceId",OLD."cashOperationId",OLD.payload,OLD."publicKey",OLD.signature,OLD."payloadHash",OLD."expiresAt",OLD."createdAt") OR OLD.state<>'issued' OR NEW.state NOT IN ('consumed','cancelled') THEN RAISE EXCEPTION 'Offline lease authorization immutable';END IF;
  IF NEW.state='cancelled' AND NOT EXISTS(SELECT 1 FROM "OrganizationUser" ou WHERE ou."organizationId"=NEW."organizationId" AND ou."userId"=NEW."cancelledBy" AND ou.role='owner' AND ou."isActive") THEN RAISE EXCEPTION 'Owner physical reconciliation required';END IF;
 ELSE
  SELECT * INTO s FROM "Sale" WHERE id=NEW."saleId";SELECT * INTO r FROM "StockReservation" WHERE id=NEW.id;
  IF s.id IS NULL OR r.id IS NULL OR s.status<>'draft' OR (s."organizationId",s."storeId",s."registerId",s."shiftId",s."cashierId") IS DISTINCT FROM (NEW."organizationId",NEW."storeId",NEW."registerId",NEW."shiftId",NEW."userId") OR (r."organizationId",r."storeId",r."registerId",r."userId",r."sessionId",r."deviceId",r."expiresAt",r.kind) IS DISTINCT FROM (NEW."organizationId",NEW."storeId",NEW."registerId",NEW."userId",NEW."sessionId",NEW."deviceId",NEW."expiresAt",'cash_ticket'::TEXT) THEN RAISE EXCEPTION 'Offline lease scope mismatch';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER offline_cash_lease_guard BEFORE INSERT OR UPDATE OR DELETE ON "OfflineCashLease" FOR EACH ROW EXECUTE FUNCTION offline_cash_lease_guard();
-- Terminal reservation and sale must agree with the source lease at commit.
CREATE FUNCTION offline_cash_terminal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l RECORD;
BEGIN
 SELECT * INTO l FROM "OfflineCashLease" WHERE id=NEW.id;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=l."organizationId") THEN RETURN NULL;END IF;
 IF l.state='consumed' AND (NOT EXISTS(SELECT 1 FROM "Sale" WHERE id=l."saleId" AND status IN ('completed','partially_returned','returned')) OR NOT EXISTS(SELECT 1 FROM "StockReservation" WHERE id=l.id AND status='consumed')) THEN RAISE EXCEPTION 'Offline cash terminal posting mismatch';END IF;
 IF l.state='cancelled' AND NOT EXISTS(SELECT 1 FROM "StockReservation" WHERE id=l.id AND status IN ('released','expired')) THEN RAISE EXCEPTION 'Offline cancellation must release reservation';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER offline_cash_terminal_guard AFTER INSERT OR UPDATE ON "OfflineCashLease" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION offline_cash_terminal_guard();
CREATE FUNCTION offline_cash_draft_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid TEXT;
BEGIN
 IF TG_TABLE_NAME='Sale' THEN IF TG_OP='DELETE' THEN sid:=OLD.id;ELSE sid:=NEW.id;END IF;
 ELSE IF TG_OP='DELETE' THEN sid:=OLD."saleId";ELSE sid:=NEW."saleId";END IF;END IF;
 PERFORM id FROM "Sale" WHERE id=sid FOR UPDATE;
 IF EXISTS(SELECT 1 FROM "OfflineCashLease" l JOIN "Organization" o ON o.id=l."organizationId" WHERE l."saleId"=sid AND l.state='issued') THEN RAISE EXCEPTION 'Reconcile offline ticket before changing draft';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
CREATE TRIGGER offline_cash_sale_draft_guard BEFORE UPDATE OR DELETE ON "Sale" FOR EACH ROW EXECUTE FUNCTION offline_cash_draft_guard();
CREATE TRIGGER offline_cash_item_draft_guard BEFORE INSERT OR UPDATE OR DELETE ON "SaleItem" FOR EACH ROW EXECUTE FUNCTION offline_cash_draft_guard();
CREATE FUNCTION offline_reservation_terminal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r RECORD;l RECORD;
BEGIN
 SELECT * INTO r FROM "StockReservation" WHERE id=NEW.id;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=r."organizationId") THEN RETURN NULL;END IF;
 IF r.status<>'active' AND EXISTS(SELECT 1 FROM "ReservationEntry" e JOIN "ReservationItem" i ON i.id=e."itemId" WHERE i."reservationId"=r.id AND e.kind<>CASE r.status WHEN 'consumed' THEN 'consume' WHEN 'released' THEN 'release' WHEN 'expired' THEN 'expire' END) THEN RAISE EXCEPTION 'Reservation terminal journal kind mismatch';END IF;
 IF r.kind='cash_ticket' THEN
  SELECT * INTO l FROM "OfflineCashLease" WHERE id=r.id;
  IF l.id IS NULL OR (r.status='consumed' AND l.state<>'consumed') OR (r.status='released' AND l.state<>'cancelled') THEN RAISE EXCEPTION 'Offline reservation requires matching lease';END IF;
 END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER offline_reservation_terminal_guard AFTER INSERT OR UPDATE ON "StockReservation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION offline_reservation_terminal_guard();
CREATE FUNCTION offline_cash_payload_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.payload->>'id',NEW.payload->>'cashOperationId',NEW.payload->>'organizationId',NEW.payload->>'storeId',NEW.payload->>'registerId',NEW.payload->>'shiftId',NEW.payload->>'userId',NEW.payload->>'sessionId',NEW.payload->>'deviceId') IS DISTINCT FROM (NEW.id,NEW."cashOperationId",NEW."organizationId",NEW."storeId",NEW."registerId",NEW."shiftId",NEW."userId",NEW."sessionId",NEW."deviceId") OR NEW.payload->>'version'<>'1' OR (NEW.payload->>'expiresAt')::timestamptz<>NEW."expiresAt" OR (NEW.payload->>'issuedAt')::timestamptz<>NEW."createdAt" OR (NEW.payload->>'totalAmount')::numeric<>(SELECT "totalAmount" FROM "Sale" WHERE id=NEW."saleId") THEN RAISE EXCEPTION 'Offline signed payload source mismatch';END IF;
 IF NOT EXISTS(SELECT 1 FROM "StockReservation" WHERE id=NEW.id AND status='active') THEN RAISE EXCEPTION 'Offline ticket requires active reservation';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER offline_cash_payload_guard BEFORE INSERT ON "OfflineCashLease" FOR EACH ROW EXECUTE FUNCTION offline_cash_payload_guard();
