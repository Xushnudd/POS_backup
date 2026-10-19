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
 IF NEW."quantityDelta"<0 AND movement."sourceType"='stock_document' AND NOT EXISTS(SELECT 1 FROM "StockDocumentItem" i WHERE i."stockDocumentId"=movement."sourceId" AND i."productId"=movement."productId" AND i."batchInput"->>'code'=batch.code) THEN RAISE EXCEPTION 'Batch adjustment original code mismatch' USING ERRCODE='23514';END IF;
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
 IF movement."sourceType"='supplier_return' AND NOT EXISTS(SELECT 1 FROM "SupplierCredit" c JOIN "SupplierInvoice" invoice ON invoice.id=c."invoiceId" JOIN "SupplierCreditItem" item ON item."creditId"=c.id JOIN "StockDocumentItem" original ON original.id=item."stockDocumentItemId" WHERE c.id=movement."sourceId" AND c.kind='goods_return' AND invoice."organizationId"=NEW."organizationId" AND original."productId"=batch."productId" AND original."stockDocumentId"=invoice."stockDocumentId" AND original."batchInput"->>'code'=batch.code) THEN RAISE EXCEPTION 'Batch supplier return requires original receipt batch' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;


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
 OR EXISTS(SELECT 1 FROM "InventoryMovement" m WHERE m."productId"=product_id AND m."sourceType" IN ('stock_document','stock_reversal') AND NOT EXISTS(SELECT 1 FROM "StockDocument" d WHERE d.id=m."sourceId" AND d."organizationId"=m."organizationId" AND d.status='confirmed'))
 OR EXISTS(SELECT 1 FROM "InventoryMovement" m WHERE m."productId"=product_id AND m."sourceType"='sale' AND NOT EXISTS(SELECT 1 FROM "Sale" sale WHERE sale.id=m."sourceId" AND sale."organizationId"=m."organizationId" AND sale.status IN ('completed','partially_returned','returned')))
 OR EXISTS(SELECT 1 FROM "StockTransferItem" item JOIN "StockTransfer" transfer ON transfer.id=item."stockTransferId" WHERE item."productId"=product_id AND (
 item."receivedQuantity"<>(SELECT COALESCE(sum(restored."quantityDelta"),0) FROM "InventoryBatchEntry" source JOIN "InventoryMovement" original ON original.id=source."movementId" JOIN "InventoryBatchEntry" restored ON restored."sourceEntryId"=source.id JOIN "InventoryMovement" received ON received.id=restored."movementId" WHERE original."sourceType"='transfer_out' AND original."sourceId"=transfer.id AND original."productId"=product_id AND received."sourceType"='transfer_in')
 OR item."returnedQuantity"<>(SELECT COALESCE(sum(restored."quantityDelta"),0) FROM "InventoryBatchEntry" source JOIN "InventoryMovement" original ON original.id=source."movementId" JOIN "InventoryBatchEntry" restored ON restored."sourceEntryId"=source.id JOIN "InventoryMovement" received ON received.id=restored."movementId" WHERE original."sourceType"='transfer_out' AND original."sourceId"=transfer.id AND original."productId"=product_id AND received."sourceType"='transfer_return')
 OR (transfer.status IN ('sent','closed','received') AND item.quantity<>(SELECT COALESCE(-sum(m."quantityDelta"),0) FROM "InventoryMovement" m WHERE m."sourceType"='transfer_out' AND m."sourceId"=transfer.id AND m."productId"=product_id))))

 OR EXISTS(SELECT 1 FROM "SaleItem" i JOIN "Sale" sale ON sale.id=i."saleId" WHERE i."productId"=product_id AND sale.status IN ('completed','partially_returned','returned') AND i.quantity<>(SELECT COALESCE(-sum(m."quantityDelta"),0) FROM "InventoryMovement" m WHERE m."productId"=product_id AND m."sourceType"='sale' AND m."sourceId"=sale.id))
 OR EXISTS(SELECT 1 FROM "SaleReturnItem" i JOIN "SaleReturn" r ON r.id=i."saleReturnId" WHERE i."productId"=product_id AND i.disposition='sellable' AND i.quantity<>(SELECT COALESCE(sum(m."quantityDelta"),0) FROM "InventoryMovement" m WHERE m."productId"=product_id AND m."sourceType"='return' AND m."sourceId"=r.id))
 OR EXISTS(SELECT 1 FROM "StockDocumentItem" i JOIN "StockDocument" d ON d.id=i."stockDocumentId" WHERE i."productId"=product_id AND d.status='confirmed' AND i.quantity<>(SELECT COALESCE(sum(m."quantityDelta"),0) FROM "InventoryMovement" m WHERE m."productId"=product_id AND m."sourceType" IN ('stock_document','stock_reversal') AND m."sourceId"=d.id))
 OR EXISTS(SELECT 1 FROM "InventoryMovement" m WHERE m."productId"=product_id AND m."sourceType" NOT IN ('stock_document','stock_reversal','sale','return','supplier_return','transfer_out','transfer_in','transfer_return'))

 OR EXISTS(SELECT 1 FROM "InventoryMovement" m WHERE m."productId"=product_id AND m."sourceType"='supplier_return' AND NOT EXISTS(SELECT 1 FROM "SupplierCredit" c JOIN "SupplierInvoice" invoice ON invoice.id=c."invoiceId" WHERE c.id=m."sourceId" AND c.kind='goods_return' AND invoice."organizationId"=m."organizationId" AND -m."quantityDelta"=(SELECT COALESCE(sum(ci.quantity),0) FROM "SupplierCreditItem" ci JOIN "StockDocumentItem" original ON original.id=ci."stockDocumentItemId" WHERE ci."creditId"=c.id AND original."productId"=product_id)))
 THEN RAISE EXCEPTION 'Batch journal does not conserve physical stock or source quantity' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;

COMMIT;
