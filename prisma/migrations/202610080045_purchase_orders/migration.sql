CREATE TABLE "PurchaseOrder" (
 id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "storeId" TEXT NOT NULL REFERENCES "Store"(id), "supplierId" TEXT NOT NULL REFERENCES "Supplier"(id),
 "referenceNo" TEXT NOT NULL CHECK(length(btrim("referenceNo")) BETWEEN 1 AND 200),
 reason TEXT NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 2000), "createdBy" TEXT NOT NULL REFERENCES "User"(id),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("organizationId","referenceNo")
);
CREATE INDEX "PurchaseOrder_organizationId_storeId_supplierId_createdAt_idx" ON "PurchaseOrder"("organizationId","storeId","supplierId","createdAt");
CREATE TABLE "PurchaseOrderItem" (
 id TEXT PRIMARY KEY, "orderId" TEXT NOT NULL REFERENCES "PurchaseOrder"(id) ON DELETE CASCADE,
 "productId" TEXT NOT NULL REFERENCES "Product"(id), "productName" TEXT NOT NULL, unit TEXT NOT NULL,
 quantity NUMERIC(20,6) NOT NULL CHECK(quantity>0), "unitCost" NUMERIC(20,6) NOT NULL CHECK("unitCost">=0), UNIQUE("orderId","productId")
);
CREATE TABLE "PurchaseReceipt" (
 id TEXT PRIMARY KEY, "orderId" TEXT NOT NULL REFERENCES "PurchaseOrder"(id) ON DELETE CASCADE,
 "stockDocumentId" TEXT NOT NULL UNIQUE REFERENCES "StockDocument"(id), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PurchaseReceipt_orderId_createdAt_idx" ON "PurchaseReceipt"("orderId","createdAt");
CREATE TABLE "PurchaseReceiptLine" (
 id TEXT PRIMARY KEY, "receiptId" TEXT NOT NULL REFERENCES "PurchaseReceipt"(id) ON DELETE CASCADE,
 "orderItemId" TEXT NOT NULL REFERENCES "PurchaseOrderItem"(id), "stockDocumentItemId" TEXT NOT NULL UNIQUE REFERENCES "StockDocumentItem"(id),
 UNIQUE("receiptId","orderItemId")
);
CREATE INDEX "PurchaseReceiptLine_orderItemId_idx" ON "PurchaseReceiptLine"("orderItemId");
CREATE FUNCTION purchase_order_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE org TEXT; o RECORD; s RECORD; item RECORD; receipt RECORD; used NUMERIC;
BEGIN
 IF TG_TABLE_NAME='PurchaseOrder' THEN org:=COALESCE(NEW."organizationId",OLD."organizationId");
 ELSIF TG_TABLE_NAME IN ('PurchaseOrderItem','PurchaseReceipt') THEN SELECT "organizationId" INTO org FROM "PurchaseOrder" WHERE id=COALESCE(NEW."orderId",OLD."orderId");
 ELSE SELECT o2."organizationId" INTO org FROM "PurchaseReceipt" r JOIN "PurchaseOrder" o2 ON o2.id=r."orderId" WHERE r.id=COALESCE(NEW."receiptId",OLD."receiptId"); END IF;
 IF TG_OP<>'INSERT' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=org) THEN RAISE EXCEPTION 'purchase chain immutable' USING ERRCODE='23514'; END IF; RETURN OLD; END IF;
 IF TG_TABLE_NAME='PurchaseOrder' THEN
  IF NOT EXISTS(SELECT 1 FROM "Store" WHERE id=NEW."storeId" AND "organizationId"=org AND "isActive") OR NOT EXISTS(SELECT 1 FROM "Supplier" WHERE id=NEW."supplierId" AND "organizationId"=org AND "isActive") OR NOT EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "organizationId"=org AND "userId"=NEW."createdBy" AND "isActive" AND role IN ('owner','admin')) THEN RAISE EXCEPTION 'purchase order scope' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='PurchaseOrderItem' THEN
  IF NOT EXISTS(SELECT 1 FROM "Product" WHERE id=NEW."productId" AND "organizationId"=org AND "isActive") OR EXISTS(SELECT 1 FROM "PurchaseReceipt" WHERE "orderId"=NEW."orderId") THEN RAISE EXCEPTION 'order item scope or already received' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='PurchaseReceipt' THEN
  SELECT * INTO o FROM "PurchaseOrder" WHERE id=NEW."orderId" FOR UPDATE;
  SELECT * INTO s FROM "StockDocument" WHERE id=NEW."stockDocumentId";
  IF s.id IS NULL OR s."organizationId"<>o."organizationId" OR s."storeId"<>o."storeId" OR s."supplierId" IS DISTINCT FROM o."supplierId" OR s.status<>'confirmed' OR s."documentType"<>'purchase' OR NOT EXISTS(SELECT 1 FROM "SupplierInvoice" WHERE "stockDocumentId"=s.id) THEN RAISE EXCEPTION 'receipt needs confirmed stock and invoice' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT * INTO receipt FROM "PurchaseReceipt" WHERE id=NEW."receiptId";
  SELECT * INTO item FROM "PurchaseOrderItem" WHERE id=NEW."orderItemId" FOR UPDATE;
  SELECT * INTO s FROM "StockDocumentItem" WHERE id=NEW."stockDocumentItemId";
  SELECT COALESCE(sum(si.quantity),0) INTO used FROM "PurchaseReceiptLine" l JOIN "StockDocumentItem" si ON si.id=l."stockDocumentItemId" WHERE l."orderItemId"=item.id;
  IF item.id IS NULL OR receipt."orderId"<>item."orderId" OR s.id IS NULL OR s."stockDocumentId"<>receipt."stockDocumentId" OR s."productId"<>item."productId" OR s."unitCost"<>item."unitCost" OR s.quantity<=0 OR used+s.quantity>item.quantity THEN RAISE EXCEPTION 'receipt line original bound' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER purchase_order_scope BEFORE INSERT OR UPDATE OR DELETE ON "PurchaseOrder" FOR EACH ROW EXECUTE FUNCTION purchase_order_guard();
CREATE TRIGGER purchase_order_item_scope BEFORE INSERT OR UPDATE OR DELETE ON "PurchaseOrderItem" FOR EACH ROW EXECUTE FUNCTION purchase_order_guard();
CREATE TRIGGER purchase_receipt_scope BEFORE INSERT OR UPDATE OR DELETE ON "PurchaseReceipt" FOR EACH ROW EXECUTE FUNCTION purchase_order_guard();
CREATE TRIGGER purchase_receipt_line_scope BEFORE INSERT OR UPDATE OR DELETE ON "PurchaseReceiptLine" FOR EACH ROW EXECUTE FUNCTION purchase_order_guard();
