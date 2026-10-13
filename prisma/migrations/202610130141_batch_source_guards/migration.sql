BEGIN;
CREATE TABLE "InventoryBatchDisposition" (
 id text PRIMARY KEY,"organizationId" text NOT NULL,
 "sourceEntryId" text NOT NULL REFERENCES "InventoryBatchEntry"(id) ON DELETE CASCADE,
 "transferDispositionId" text REFERENCES "TransferDispositionEntry"(id) ON DELETE CASCADE,
 "returnDispositionId" text REFERENCES "ReturnDispositionEntry"(id) ON DELETE CASCADE,
 quantity numeric(20,6) NOT NULL CHECK(quantity>0),"createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(("transferDispositionId" IS NULL)<>("returnDispositionId" IS NULL)),
 UNIQUE("sourceEntryId","transferDispositionId"),UNIQUE("sourceEntryId","returnDispositionId")
);
CREATE INDEX "InventoryBatchDisposition_organizationId_id_idx" ON "InventoryBatchDisposition"("organizationId",id);
CREATE OR REPLACE FUNCTION batch_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE movement "InventoryMovement"; batch "InventoryBatch"; source "InventoryBatchEntry"; source_movement "InventoryMovement";
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Batch journal is immutable' USING ERRCODE='23514';END IF;
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") AND EXISTS(SELECT 1 FROM "InventoryMovement" WHERE id=OLD."movementId") THEN RAISE EXCEPTION 'Batch journal is immutable' USING ERRCODE='23514';END IF;
  RETURN OLD;
 END IF;
 SELECT * INTO movement FROM "InventoryMovement" WHERE id=NEW."movementId";
 SELECT * INTO batch FROM "InventoryBatch" WHERE id=NEW."batchId";
 IF movement.id IS NULL OR batch.id IS NULL OR movement."productId"<>batch."productId"
  OR movement."organizationId"<>NEW."organizationId" OR batch."organizationId"<>NEW."organizationId"
  OR movement."storeId"<>NEW."storeId" OR sign(movement."quantityDelta")<>sign(NEW."quantityDelta")
 THEN RAISE EXCEPTION 'Batch movement scope mismatch' USING ERRCODE='23514';END IF;
 IF movement."sourceType" IN ('sale','transfer_out') AND (batch."receivedOn">to_char(CURRENT_TIMESTAMP AT TIME ZONE (SELECT timezone FROM "Organization" WHERE id=NEW."organizationId"),'YYYY-MM-DD') OR batch."expiresOn"<to_char(CURRENT_TIMESTAMP AT TIME ZONE (SELECT timezone FROM "Organization" WHERE id=NEW."organizationId"),'YYYY-MM-DD')) THEN
  RAISE EXCEPTION 'Expired or future batch cannot be issued' USING ERRCODE='23514';END IF;
 IF NEW."sourceEntryId" IS NOT NULL THEN
  SELECT * INTO source FROM "InventoryBatchEntry" WHERE id=NEW."sourceEntryId";
  IF source."batchId"<>NEW."batchId" OR source."organizationId"<>NEW."organizationId" OR source."quantityDelta">=0 OR NEW."quantityDelta"<=0
   THEN RAISE EXCEPTION 'Batch restore source invalid' USING ERRCODE='23514'; END IF;
  SELECT * INTO source_movement FROM "InventoryMovement" WHERE id=source."movementId";
  IF movement."sourceType"='return' AND NOT EXISTS(SELECT 1 FROM "SaleReturn" r WHERE r.id=movement."sourceId" AND r."saleId"=source_movement."sourceId" AND source_movement."sourceType"='sale') THEN RAISE EXCEPTION 'Batch return original sale mismatch' USING ERRCODE='23514';END IF;
  IF movement."sourceType" IN ('transfer_in','transfer_return') AND NOT EXISTS(SELECT 1 FROM "StockTransfer" t WHERE t.id=source_movement."sourceId" AND source_movement."sourceType"='transfer_out' AND t."fromStoreId"=source."storeId" AND ((movement."sourceType"='transfer_in' AND t."toStoreId"=NEW."storeId") OR (movement."sourceType"='transfer_return' AND t."fromStoreId"=NEW."storeId"))) THEN RAISE EXCEPTION 'Batch transfer original branch mismatch' USING ERRCODE='23514';END IF;
 ELSE
  IF NEW."quantityDelta">0 AND movement."sourceType"<>'stock_document' THEN RAISE EXCEPTION 'Batch restoration needs original source' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION batch_disposition_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source "InventoryBatchEntry"; movement "InventoryMovement";
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Batch disposition immutable' USING ERRCODE='23514';END IF;
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") AND EXISTS(SELECT 1 FROM "InventoryBatchEntry" WHERE id=OLD."sourceEntryId") THEN RAISE EXCEPTION 'Batch disposition immutable' USING ERRCODE='23514'; END IF; RETURN OLD;
 END IF;
 SELECT * INTO source FROM "InventoryBatchEntry" WHERE id=NEW."sourceEntryId";
 SELECT * INTO movement FROM "InventoryMovement" WHERE id=source."movementId";
 IF source.id IS NULL OR source."quantityDelta">=0 OR source."organizationId"<>NEW."organizationId" THEN RAISE EXCEPTION 'Batch disposition source mismatch' USING ERRCODE='23514'; END IF;
 IF NEW."transferDispositionId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "TransferDispositionEntry" d JOIN "StockTransferItem" i ON i.id=d."itemId" WHERE d.id=NEW."transferDispositionId" AND d."organizationId"=NEW."organizationId" AND d."productId"=movement."productId" AND i."stockTransferId"=movement."sourceId" AND movement."sourceType"='transfer_out') THEN RAISE EXCEPTION 'Transfer batch disposition mismatch' USING ERRCODE='23514';END IF;
 IF NEW."returnDispositionId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "ReturnDispositionEntry" d JOIN "SaleReturnItem" i ON i.id=d."returnItemId" JOIN "SaleReturn" r ON r.id=i."saleReturnId" WHERE d.id=NEW."returnDispositionId" AND d."organizationId"=NEW."organizationId" AND d."productId"=movement."productId" AND r."saleId"=movement."sourceId" AND movement."sourceType"='sale') THEN RAISE EXCEPTION 'Return batch disposition mismatch' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER batch_disposition_guard BEFORE INSERT OR UPDATE OR DELETE ON "InventoryBatchDisposition" FOR EACH ROW EXECUTE FUNCTION batch_disposition_guard();
CREATE OR REPLACE FUNCTION batch_conservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE product_id text;
BEGIN
 IF TG_TABLE_NAME='InventoryBatchDisposition' THEN SELECT b."productId" INTO product_id FROM "InventoryBatchEntry" e JOIN "InventoryBatch" b ON b.id=e."batchId" WHERE e.id=COALESCE(NEW."sourceEntryId",OLD."sourceEntryId");
 ELSIF TG_TABLE_NAME='InventoryBatchEntry' THEN SELECT "productId" INTO product_id FROM "InventoryBatch" WHERE id=COALESCE(NEW."batchId",OLD."batchId");
 ELSE product_id:=COALESCE(NEW."productId",OLD."productId");END IF;
 IF NOT EXISTS(SELECT 1 FROM "Product" WHERE id=product_id AND "batchTracking") THEN RETURN NULL;END IF;
 IF EXISTS(SELECT 1 FROM "InventoryMovement" m WHERE m."productId"=product_id AND m."quantityDelta"<>(SELECT COALESCE(sum(e."quantityDelta"),0) FROM "InventoryBatchEntry" e WHERE e."movementId"=m.id))
 OR EXISTS(SELECT 1 FROM "InventoryBalance" b WHERE b."productId"=product_id AND b.quantity<>(SELECT COALESCE(sum(e."quantityDelta"),0) FROM "InventoryBatchEntry" e JOIN "InventoryBatch" x ON x.id=e."batchId" WHERE x."productId"=product_id AND e."storeId"=b."storeId"))
 OR EXISTS(SELECT 1 FROM "InventoryBatchEntry" e JOIN "InventoryBatch" x ON x.id=e."batchId" WHERE x."productId"=product_id GROUP BY e."batchId",e."storeId" HAVING sum(e."quantityDelta")<0)
 OR EXISTS(SELECT 1 FROM "InventoryBatchEntry" e JOIN "InventoryBatch" x ON x.id=e."batchId" WHERE x."productId"=product_id AND NOT EXISTS(SELECT 1 FROM "InventoryBalance" b WHERE b."productId"=product_id AND b."storeId"=e."storeId"))
 OR EXISTS(SELECT 1 FROM "InventoryBatchEntry" source JOIN "InventoryBatch" b ON b.id=source."batchId" WHERE b."productId"=product_id AND source."quantityDelta"<0 AND ((SELECT COALESCE(sum(r."quantityDelta"),0) FROM "InventoryBatchEntry" r WHERE r."sourceEntryId"=source.id)+(SELECT COALESCE(sum(d.quantity),0) FROM "InventoryBatchDisposition" d WHERE d."sourceEntryId"=source.id))>-source."quantityDelta")
 OR EXISTS(SELECT 1 FROM "TransferDispositionEntry" d WHERE d."productId"=product_id AND d.quantity<>(SELECT COALESCE(sum(x.quantity),0) FROM "InventoryBatchDisposition" x WHERE x."transferDispositionId"=d.id))
 OR EXISTS(SELECT 1 FROM "ReturnDispositionEntry" d WHERE d."productId"=product_id AND d.quantity<>(SELECT COALESCE(sum(x.quantity),0) FROM "InventoryBatchDisposition" x WHERE x."returnDispositionId"=d.id))
 THEN RAISE EXCEPTION 'Batch journal does not conserve physical stock or source quantity' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER batch_conservation_disposition AFTER INSERT OR UPDATE OR DELETE ON "InventoryBatchDisposition" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION batch_conservation_guard();
CREATE CONSTRAINT TRIGGER batch_conservation_transfer_disposition AFTER INSERT OR UPDATE OR DELETE ON "TransferDispositionEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION batch_conservation_guard();
CREATE CONSTRAINT TRIGGER batch_conservation_return_disposition AFTER INSERT OR UPDATE OR DELETE ON "ReturnDispositionEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION batch_conservation_guard();
CREATE FUNCTION batch_stock_policy_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM "Product" WHERE id=COALESCE(NEW."productId",OLD."productId") FOR SHARE;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER batch_stock_policy_lock BEFORE INSERT OR UPDATE OR DELETE ON "InventoryBalance" FOR EACH ROW EXECUTE FUNCTION batch_stock_policy_lock();
COMMIT;
