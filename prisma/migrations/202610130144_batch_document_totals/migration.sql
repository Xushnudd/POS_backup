BEGIN;
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
 OR (transfer.status IN ('sent','closed') AND item.quantity<>(SELECT COALESCE(-sum(m."quantityDelta"),0) FROM "InventoryMovement" m WHERE m."sourceType"='transfer_out' AND m."sourceId"=transfer.id AND m."productId"=product_id))))

 OR EXISTS(SELECT 1 FROM "SaleItem" i JOIN "Sale" sale ON sale.id=i."saleId" WHERE i."productId"=product_id AND sale.status IN ('completed','partially_returned','returned') AND i.quantity<>(SELECT COALESCE(-sum(m."quantityDelta"),0) FROM "InventoryMovement" m WHERE m."productId"=product_id AND m."sourceType"='sale' AND m."sourceId"=sale.id))
 OR EXISTS(SELECT 1 FROM "SaleReturnItem" i JOIN "SaleReturn" r ON r.id=i."saleReturnId" WHERE i."productId"=product_id AND i.disposition='sellable' AND i.quantity<>(SELECT COALESCE(sum(m."quantityDelta"),0) FROM "InventoryMovement" m WHERE m."productId"=product_id AND m."sourceType"='return' AND m."sourceId"=r.id))
 OR EXISTS(SELECT 1 FROM "StockDocumentItem" i JOIN "StockDocument" d ON d.id=i."stockDocumentId" WHERE i."productId"=product_id AND d.status='confirmed' AND i.quantity<>(SELECT COALESCE(sum(m."quantityDelta"),0) FROM "InventoryMovement" m WHERE m."productId"=product_id AND m."sourceType" IN ('stock_document','stock_reversal') AND m."sourceId"=d.id))
 OR EXISTS(SELECT 1 FROM "InventoryMovement" m WHERE m."productId"=product_id AND m."sourceType" NOT IN ('stock_document','stock_reversal','sale','return','supplier_return','transfer_out','transfer_in','transfer_return'))

 THEN RAISE EXCEPTION 'Batch journal does not conserve physical stock or source quantity' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER batch_conservation_sale_item AFTER INSERT OR UPDATE OR DELETE ON "SaleItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION batch_conservation_guard();
CREATE CONSTRAINT TRIGGER batch_conservation_return_item AFTER INSERT OR UPDATE OR DELETE ON "SaleReturnItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION batch_conservation_guard();
CREATE CONSTRAINT TRIGGER batch_conservation_document_item AFTER INSERT OR UPDATE OR DELETE ON "StockDocumentItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION batch_conservation_guard();
CREATE FUNCTION batch_document_status_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='StockDocument' AND NEW.status='confirmed' AND EXISTS(SELECT 1 FROM "StockDocumentItem" i JOIN "Product" p ON p.id=i."productId" WHERE i."stockDocumentId"=NEW.id AND p."batchTracking" AND i.quantity<>(SELECT COALESCE(sum(m."quantityDelta"),0) FROM "InventoryMovement" m WHERE m."productId"=i."productId" AND m."sourceId"=NEW.id AND m."sourceType" IN ('stock_document','stock_reversal'))) THEN RAISE EXCEPTION 'Confirmed batch document needs original stock journal' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='Sale' AND NEW.status IN ('completed','partially_returned','returned') AND EXISTS(SELECT 1 FROM "SaleItem" i JOIN "Product" p ON p.id=i."productId" WHERE i."saleId"=NEW.id AND p."batchTracking" AND i.quantity<>(SELECT COALESCE(-sum(m."quantityDelta"),0) FROM "InventoryMovement" m WHERE m."productId"=i."productId" AND m."sourceId"=NEW.id AND m."sourceType"='sale')) THEN RAISE EXCEPTION 'Completed batch sale needs original stock journal' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER batch_stock_document_status AFTER INSERT OR UPDATE ON "StockDocument" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION batch_document_status_guard();
CREATE CONSTRAINT TRIGGER batch_sale_status AFTER INSERT OR UPDATE ON "Sale" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION batch_document_status_guard();
CREATE INDEX "InventoryBatchEntry_batch_store_id_idx" ON "InventoryBatchEntry"("batchId","storeId",id);
CREATE INDEX "InventoryBatchEntry_sourceEntryId_idx" ON "InventoryBatchEntry"("sourceEntryId");
CREATE INDEX "InventoryMovement_batch_source_idx" ON "InventoryMovement"("productId","sourceType","sourceId");
COMMIT;
