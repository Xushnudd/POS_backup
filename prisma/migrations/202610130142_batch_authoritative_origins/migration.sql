BEGIN;
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
 IF NEW."quantityDelta">0 AND movement."sourceType"='stock_document' AND NOT EXISTS(SELECT 1 FROM "StockDocumentItem" i WHERE i."stockDocumentId"=movement."sourceId" AND i."productId"=movement."productId" AND i.quantity=movement."quantityDelta" AND i."batchInput"->>'code'=batch.code AND i."batchInput"->>'receivedOn'=batch."receivedOn" AND i."batchInput"->>'expiresOn'=batch."expiresOn") THEN RAISE EXCEPTION 'Batch receipt metadata mismatch' USING ERRCODE='23514';END IF;
 IF movement."sourceType" IN ('sale','transfer_out') AND EXISTS(SELECT 1 FROM "InventoryBatch" earlier JOIN "InventoryBatchEntry" e ON e."batchId"=earlier.id WHERE earlier."productId"=batch."productId" AND e."storeId"=NEW."storeId" AND (earlier."expiresOn",earlier."receivedOn",earlier.id)<(batch."expiresOn",batch."receivedOn",batch.id) AND earlier."receivedOn"<=to_char(CURRENT_TIMESTAMP AT TIME ZONE (SELECT timezone FROM "Organization" WHERE id=NEW."organizationId"),'YYYY-MM-DD') AND earlier."expiresOn">=to_char(CURRENT_TIMESTAMP AT TIME ZONE (SELECT timezone FROM "Organization" WHERE id=NEW."organizationId"),'YYYY-MM-DD') GROUP BY earlier.id HAVING sum(e."quantityDelta")>0) THEN RAISE EXCEPTION 'Batch issue violates FEFO' USING ERRCODE='23514';END IF;
 IF NEW."sourceEntryId" IS NOT NULL THEN
  SELECT * INTO source FROM "InventoryBatchEntry" WHERE id=NEW."sourceEntryId";
  IF source."batchId"<>NEW."batchId" OR source."organizationId"<>NEW."organizationId" OR source."quantityDelta">=0 OR NEW."quantityDelta"<=0
   THEN RAISE EXCEPTION 'Batch restore source invalid' USING ERRCODE='23514'; END IF;
  IF movement."sourceType" NOT IN ('return','transfer_in','transfer_return','stock_reversal') THEN RAISE EXCEPTION 'Unsupported batch restore source' USING ERRCODE='23514';END IF;
  SELECT * INTO source_movement FROM "InventoryMovement" WHERE id=source."movementId";
  IF movement."sourceType"='return' AND NOT EXISTS(SELECT 1 FROM "SaleReturn" r WHERE r.id=movement."sourceId" AND r."saleId"=source_movement."sourceId" AND source_movement."sourceType"='sale') THEN RAISE EXCEPTION 'Batch return original sale mismatch' USING ERRCODE='23514';END IF;
  IF movement."sourceType"='stock_reversal' AND NOT EXISTS(SELECT 1 FROM "StockDocument" d WHERE d.id=movement."sourceId" AND d."reversalOfId"=source_movement."sourceId" AND source_movement."sourceType"='stock_document') THEN RAISE EXCEPTION 'Batch reversal original document mismatch' USING ERRCODE='23514';END IF;
  IF movement."sourceType" IN ('transfer_in','transfer_return') AND NOT EXISTS(SELECT 1 FROM "StockTransfer" t WHERE t.id=source_movement."sourceId" AND source_movement."sourceType"='transfer_out' AND t."fromStoreId"=source."storeId" AND ((movement."sourceType"='transfer_in' AND t."toStoreId"=NEW."storeId") OR (movement."sourceType"='transfer_return' AND t."fromStoreId"=NEW."storeId"))) THEN RAISE EXCEPTION 'Batch transfer original branch mismatch' USING ERRCODE='23514';END IF;
 ELSE
  IF NEW."quantityDelta">0 AND movement."sourceType"<>'stock_document' THEN RAISE EXCEPTION 'Batch restoration needs original source' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $$;

COMMIT;
