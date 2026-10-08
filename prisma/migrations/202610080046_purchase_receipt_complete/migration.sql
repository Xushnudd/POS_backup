CREATE FUNCTION purchase_receipt_complete() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE o RECORD; r RECORD;
BEGIN
 IF TG_TABLE_NAME='PurchaseOrder' THEN
  SELECT * INTO o FROM "PurchaseOrder" WHERE id=NEW.id;
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=o."organizationId") AND NOT EXISTS(SELECT 1 FROM "PurchaseOrderItem" WHERE "orderId"=o.id) THEN RAISE EXCEPTION 'order items required' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT * INTO r FROM "PurchaseReceipt" WHERE id=NEW.id;
  SELECT * INTO o FROM "PurchaseOrder" WHERE id=r."orderId";
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=o."organizationId") AND (NOT EXISTS(SELECT 1 FROM "PurchaseReceiptLine" WHERE "receiptId"=r.id) OR (SELECT count(*) FROM "PurchaseReceiptLine" WHERE "receiptId"=r.id)<>(SELECT count(*) FROM "StockDocumentItem" WHERE "stockDocumentId"=r."stockDocumentId")) THEN RAISE EXCEPTION 'all receipt stock lines need original order line' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER purchase_order_items_required AFTER INSERT ON "PurchaseOrder" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION purchase_receipt_complete();
CREATE CONSTRAINT TRIGGER purchase_receipt_lines_required AFTER INSERT ON "PurchaseReceipt" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION purchase_receipt_complete();
