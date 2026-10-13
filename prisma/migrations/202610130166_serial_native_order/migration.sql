BEGIN;
-- This feature has not shipped. Never invent an order for existing unit journals.
DO $$ BEGIN IF EXISTS(SELECT 1 FROM "SerialEvent") OR EXISTS(SELECT 1 FROM "WarrantyService") THEN RAISE EXCEPTION 'SERIAL_NATIVE_ORDER_REQUIRES_EMPTY_PRE_RELEASE_JOURNAL'; END IF; END $$;
ALTER TABLE "SerialEvent" ADD COLUMN ordinal integer NOT NULL DEFAULT 0 CHECK(ordinal>0);
ALTER TABLE "WarrantyService" ADD COLUMN ordinal integer NOT NULL DEFAULT 0 CHECK(ordinal>0);
CREATE UNIQUE INDEX "SerialEvent_serialId_ordinal_key" ON "SerialEvent"("serialId",ordinal);
CREATE UNIQUE INDEX "WarrantyService_warrantyId_ordinal_key" ON "WarrantyService"("warrantyId",ordinal);
CREATE OR REPLACE FUNCTION pos_serial_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u "SerialNumber"; m "InventoryMovement"; target text; transfer "StockTransfer"; original_receipt text; p "Product"; d "ReturnDispositionEntry"; t "TransferDispositionEntry"; si "SaleItem";
BEGIN
 SELECT * INTO u FROM "SerialNumber" WHERE id=NEW."serialId" FOR UPDATE;
 SELECT * INTO p FROM "Product" WHERE id=u."productId";
 IF u.id IS NULL OR NOT p."serialTracking" OR u."organizationId"<>NEW."organizationId" OR u."productId"<>NEW."productId" OR NEW."createdAt"<>CURRENT_TIMESTAMP::timestamp(3) OR NOT EXISTS(SELECT 1 FROM "Store" WHERE id=NEW."storeId" AND "organizationId"=NEW."organizationId") OR NOT EXISTS(SELECT 1 FROM "OrganizationUser" ou JOIN "User" a ON a.id=ou."userId" WHERE ou."organizationId"=NEW."organizationId" AND ou."userId"=NEW."actorId" AND ou."isActive" AND a."isActive") THEN RAISE EXCEPTION 'SERIAL_SOURCE_INVALID'; END IF;
 IF NEW."movementId" IS NOT NULL THEN
  SELECT * INTO m FROM "InventoryMovement" WHERE id=NEW."movementId";
  IF m.id IS NULL OR m."organizationId"<>NEW."organizationId" OR m."productId"<>NEW."productId" OR m."storeId"<>NEW."storeId" OR m."sourceId"<>NEW."sourceId" OR m."createdBy"<>NEW."actorId" OR (SELECT xmin::text::bigint FROM "InventoryMovement" WHERE id=m.id)<>txid_current()%4294967296 THEN RAISE EXCEPTION 'SERIAL_MOVEMENT_INVALID'; END IF;
  CASE NEW.kind
   WHEN 'receipt' THEN
    IF m."sourceType"<>'stock_document' OR m."quantityDelta"<=0 OR u.version<>0 OR NOT EXISTS(SELECT 1 FROM "StockDocumentItem" i WHERE i."stockDocumentId"=m."sourceId" AND i."productId"=u."productId" AND i."serialInput" @> to_jsonb(ARRAY[u.code])) THEN RAISE EXCEPTION 'SERIAL_RECEIPT_INVALID'; END IF; target:='available';
   WHEN 'sale' THEN
    SELECT * INTO si FROM "SaleItem" WHERE id=NEW."saleItemId";
    IF m."sourceType"<>'sale' OR m."quantityDelta">=0 OR u.state<>'available' OR u."storeId"<>m."storeId" OR si."saleId"<>m."sourceId" OR si."productId"<>u."productId" OR si.id IS NULL THEN RAISE EXCEPTION 'SERIAL_SALE_INVALID'; END IF;target:='sold';
   WHEN 'return' THEN
    IF m."sourceType"<>'return' OR m."quantityDelta"<=0 OR u.state<>'sold' OR u."lastSaleItemId" IS DISTINCT FROM NEW."saleItemId" OR NOT EXISTS(SELECT 1 FROM "SaleReturn" r JOIN "SaleReturnItem" i ON i."saleReturnId"=r.id WHERE r.id=m."sourceId" AND i."saleItemId"=NEW."saleItemId" AND i.disposition='sellable') THEN RAISE EXCEPTION 'SERIAL_RETURN_INVALID'; END IF;target:='available';
   WHEN 'transfer_out' THEN IF m."sourceType"<>'transfer_out' OR m."quantityDelta">=0 OR u.state<>'available' OR u."storeId"<>m."storeId" THEN RAISE EXCEPTION 'SERIAL_TRANSFER_INVALID'; END IF;target:='transit';
   WHEN 'transfer_in','transfer_return' THEN SELECT * INTO transfer FROM "StockTransfer" WHERE id=u."lastTransferId"; IF transfer.id IS NULL OR transfer."organizationId"<>NEW."organizationId" OR (NEW.kind='transfer_in' AND transfer."toStoreId"<>NEW."storeId") OR (NEW.kind='transfer_return' AND transfer."fromStoreId"<>NEW."storeId") THEN RAISE EXCEPTION 'SERIAL_TRANSFER_ORIGIN_INVALID'; END IF; IF m."sourceType"<>NEW.kind OR m."quantityDelta"<=0 OR u.state<>'transit' THEN RAISE EXCEPTION 'SERIAL_TRANSFER_INVALID'; END IF;target:='available';
   WHEN 'restore' THEN SELECT "reversalOfId" INTO original_receipt FROM "StockDocument" WHERE id=m."sourceId"; IF m."sourceType"<>'stock_reversal' OR m."quantityDelta"<=0 OR u.state<>'retired' OR u."storeId"<>m."storeId" OR NOT EXISTS(SELECT 1 FROM "SerialEvent" e JOIN "InventoryMovement" x ON x.id=e."movementId" WHERE e."serialId"=u.id AND e.kind='retired' AND e."sourceId"=original_receipt AND x."sourceType"='stock_document' AND x."quantityDelta"<0) THEN RAISE EXCEPTION 'SERIAL_RESTORE_ORIGIN_INVALID'; END IF;target:='available';
   WHEN 'retired' THEN IF m."quantityDelta">=0 OR m."sourceType" NOT IN ('stock_document','stock_reversal','supplier_return') OR u.state<>'available' OR u."storeId"<>m."storeId" THEN RAISE EXCEPTION 'SERIAL_RETIRE_INVALID'; END IF;IF m."sourceType"='stock_reversal' THEN SELECT "reversalOfId" INTO original_receipt FROM "StockDocument" WHERE id=m."sourceId"; ELSIF m."sourceType"='supplier_return' THEN SELECT i."stockDocumentId" INTO original_receipt FROM "SupplierCredit" c JOIN "SupplierInvoice" i ON i.id=c."invoiceId" WHERE c.id=m."sourceId"; END IF; IF m."sourceType" IN ('stock_reversal','supplier_return') AND NOT EXISTS(SELECT 1 FROM "SerialEvent" WHERE "serialId"=u.id AND kind='receipt' AND "sourceId"=original_receipt) THEN RAISE EXCEPTION 'SERIAL_RECEIPT_ORIGIN_INVALID'; END IF; target:='retired';
   ELSE RAISE EXCEPTION 'SERIAL_KIND_INVALID'; END CASE;
 ELSE
  IF num_nonnulls(NEW."returnDispositionId",NEW."transferDispositionId")<>1 OR NEW.kind NOT IN ('damaged','retired') THEN RAISE EXCEPTION 'SERIAL_DISPOSITION_INVALID'; END IF;
  IF NEW."returnDispositionId" IS NOT NULL THEN
   SELECT * INTO d FROM "ReturnDispositionEntry" WHERE id=NEW."returnDispositionId";
   IF d.id IS NULL OR d."organizationId"<>NEW."organizationId" OR d."productId"<>u."productId" OR d."storeId"<>NEW."storeId" OR u.state<>'sold' OR u."lastSaleItemId" IS DISTINCT FROM NEW."saleItemId" OR NOT EXISTS(SELECT 1 FROM "SaleReturnItem" WHERE id=d."returnItemId" AND "saleItemId"=NEW."saleItemId" AND "saleReturnId"=NEW."sourceId") OR (SELECT xmin::text::bigint FROM "ReturnDispositionEntry" WHERE id=d.id)<>txid_current()%4294967296 THEN RAISE EXCEPTION 'SERIAL_DISPOSITION_INVALID'; END IF;
  ELSE
   SELECT * INTO t FROM "TransferDispositionEntry" WHERE id=NEW."transferDispositionId";
   IF t.id IS NULL OR t."organizationId"<>NEW."organizationId" OR t."productId"<>u."productId" OR t."storeId"<>NEW."storeId" OR u.state<>'transit' OR NOT EXISTS(SELECT 1 FROM "StockTransferItem" i JOIN "StockTransfer" x ON x.id=i."stockTransferId" WHERE i.id=t."itemId" AND x.id=u."lastTransferId" AND x."toStoreId"=NEW."storeId") OR t."operationId"<>NEW."sourceId" OR (SELECT xmin::text::bigint FROM "TransferDispositionEntry" WHERE id=t.id)<>txid_current()%4294967296 THEN RAISE EXCEPTION 'SERIAL_DISPOSITION_INVALID'; END IF;
  END IF;
  IF NEW."returnDispositionId" IS NOT NULL AND NEW.kind<>(CASE WHEN d.disposition='damaged' THEN 'damaged' ELSE 'retired' END) OR NEW."transferDispositionId" IS NOT NULL AND NEW.kind<>(CASE WHEN t.disposition='damaged' THEN 'damaged' ELSE 'retired' END) THEN RAISE EXCEPTION 'SERIAL_DISPOSITION_KIND_INVALID'; END IF;target:=NEW.kind;
 END IF;
 NEW.ordinal:=u.version+1;
 UPDATE "SerialNumber" SET state=target,"storeId"=NEW."storeId","lastTransferId"=CASE WHEN NEW.kind='transfer_out' THEN NEW."sourceId" WHEN u.state='transit' THEN NULL ELSE u."lastTransferId" END,"lastSaleItemId"=CASE WHEN NEW.kind='sale' THEN NEW."saleItemId" ELSE "lastSaleItemId" END,version=version+1 WHERE id=u.id;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION pos_warranty_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE e "SerialEvent";p "Product";w "Warranty";u "SerialNumber";last_state text;BEGIN
 IF TG_TABLE_NAME='Warranty' THEN
 SELECT * INTO e FROM "SerialEvent" WHERE id=NEW."saleEventId";SELECT * INTO p FROM "Product" WHERE id=NEW."productId";
 IF e.id IS NULL OR e.kind<>'sale' OR e."organizationId"<>NEW."organizationId" OR e."productId"<>NEW."productId" OR e."serialId"<>NEW."serialId" OR e."saleItemId"<>NEW."saleItemId" OR e."storeId"<>NEW."storeId" OR NEW."startedAt"<>CURRENT_TIMESTAMP::timestamp(3) OR NEW."endsAt"<>NEW."startedAt"+make_interval(days=>p."warrantyDays") OR NEW.terms<>p."warrantyTerms" THEN RAISE EXCEPTION 'WARRANTY_SNAPSHOT_INVALID'; END IF;
 ELSE
 SELECT * INTO w FROM "Warranty" WHERE id=NEW."warrantyId" FOR UPDATE;SELECT * INTO u FROM "SerialNumber" WHERE id=w."serialId";
 SELECT status INTO last_state FROM "WarrantyService" WHERE "warrantyId"=w.id ORDER BY ordinal DESC LIMIT 1;
 IF w.id IS NULL OR w."organizationId"<>NEW."organizationId" OR w."productId"<>NEW."productId" OR u.state<>'sold' OR u."lastSaleItemId"<>w."saleItemId" OR NEW.status NOT IN ('opened','in_progress','resolved','rejected') OR length(NEW.note) NOT BETWEEN 3 AND 2000 OR NOT EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "organizationId"=NEW."organizationId" AND "userId"=NEW."actorId" AND "isActive" AND role IN ('owner','admin')) OR (last_state IS NULL AND NEW.status<>'opened') OR (last_state IN ('resolved','rejected') AND NEW.status<>'opened') OR (last_state IN ('opened','in_progress') AND NEW.status='opened') THEN RAISE EXCEPTION 'WARRANTY_SERVICE_INVALID'; END IF;
 NEW.ordinal:=(SELECT COALESCE(max(ordinal),0)+1 FROM "WarrantyService" WHERE "warrantyId"=w.id);
 END IF;RETURN NEW;
END $$;
COMMIT;
