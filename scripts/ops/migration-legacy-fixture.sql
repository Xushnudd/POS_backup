-- Explicit synthetic pre-foundation dataset. This is not a customer/pilot backup.
BEGIN;
INSERT INTO "Organization" (id,name,phone) VALUES ('dataset-org','Migration fixture','fixture');
INSERT INTO "User" (id,"fullName",phone,"passwordHash") VALUES ('dataset-user','Fixture operator','fixture','not-a-login');
INSERT INTO "OrganizationUser" (id,"organizationId","userId",role) VALUES ('dataset-member','dataset-org','dataset-user','owner');
INSERT INTO "Store" (id,"organizationId",name,"updatedAt") VALUES ('dataset-store','dataset-org','Fixture branch','2026-01-01'),('dataset-second','dataset-org','Second branch','2026-01-01');
INSERT INTO "Register" (id,"storeId",name,code) VALUES ('dataset-register','dataset-store','Fixture till','1');
INSERT INTO "Shift" (id,"registerId","organizationUserId","openingCash",status,"expectedCash","countedCash","cashDifference","closedAt") VALUES ('dataset-shift','dataset-register','dataset-member',50,'closed',1064,1064,0,'2026-01-02');
INSERT INTO "Product" (id,"organizationId",name,sku,barcode,unit,"salePrice","costPrice","updatedAt") VALUES ('dataset-product','dataset-org','Original name','SKU-DATASET','BAR-DATASET','dona',1,0.5,'2026-01-01'),('dataset-kg','dataset-org','Fractional stock','SKU-KG','BAR-KG','kg',123.45,99.99,'2026-01-01');
INSERT INTO "Customer" (id,"organizationId","fullName",phone,"creditLimit","updatedAt") VALUES ('dataset-customer','dataset-org','Original customer','901234567',10,'2026-01-01');
INSERT INTO "Supplier" (id,"organizationId",name,"updatedAt") VALUES ('dataset-supplier','dataset-org','Original supplier','2026-01-01');
INSERT INTO "StockDocument" (id,"organizationId","storeId","supplierId","documentType","documentNo",status,"createdBy","confirmedBy","confirmedAt") VALUES ('dataset-purchase','dataset-org','dataset-store','dataset-supplier','purchase','PUR-DATASET','confirmed','dataset-user','dataset-user','2026-01-01');
INSERT INTO "StockDocumentItem" (id,"stockDocumentId","productId",quantity,"unitCost") VALUES ('dataset-purchase-line','dataset-purchase','dataset-product',1008,0.5);
INSERT INTO "Sale" (id,"organizationId","storeId","registerId","shiftId","cashierId","customerId","receiptNo",status,subtotal,"discountAmount","totalAmount","completedAt") VALUES ('dataset-credit','dataset-org','dataset-store','dataset-register','dataset-shift','dataset-user','dataset-customer','CREDIT-DATASET','partially_returned',3,0.01,2.99,'2026-01-01');
INSERT INTO "SaleItem" (id,"saleId","productId","productName",sku,quantity,"unitPrice","lineTotal","unitCost") SELECT 'dataset-credit-line-'||n,'dataset-credit','dataset-product','Original name','SKU-DATASET',1,1,1,0.5 FROM generate_series(1,3) n;
INSERT INTO "Payment" (id,"organizationId","storeId","shiftId","saleId","customerId","paymentType",direction,amount,"receivedBy") VALUES ('dataset-credit-payment','dataset-org','dataset-store','dataset-shift','dataset-credit','dataset-customer','credit','in',2.99,'dataset-user');
INSERT INTO "SaleReturn" (id,"saleId","returnReceiptNo","refundAmount","processedBy","returnedAt") VALUES ('dataset-return','dataset-credit','RETURN-DATASET',0.99,'dataset-user','2026-01-02');
INSERT INTO "SaleReturnItem" (id,"saleReturnId","saleItemId","productId",quantity,"unitPrice","lineTotal") VALUES ('dataset-return-line','dataset-return','dataset-credit-line-1','dataset-product',1,1,0.99);
INSERT INTO "Payment" (id,"organizationId","storeId","shiftId","saleId","customerId","paymentType",direction,amount,note,"receivedBy") VALUES ('dataset-credit-refund','dataset-org','dataset-store','dataset-shift','dataset-credit','dataset-customer','credit','out',0.99,'return:dataset-return','dataset-user');
INSERT INTO "Sale" (id,"organizationId","storeId","registerId","shiftId","cashierId","receiptNo",status,subtotal,"totalAmount","completedAt") SELECT 'dataset-cash-'||n,'dataset-org','dataset-store','dataset-register','dataset-shift','dataset-user','CASH-DATASET-'||n,'completed',1,1,'2026-01-01' FROM generate_series(1,1001) n;
INSERT INTO "SaleItem" (id,"saleId","productId","productName",sku,quantity,"unitPrice","lineTotal","unitCost") SELECT 'dataset-cash-line-'||n,'dataset-cash-'||n,'dataset-product','Original name','SKU-DATASET',1,1,1,0.5 FROM generate_series(1,1001) n;
INSERT INTO "Payment" (id,"organizationId","storeId","shiftId","saleId","paymentType",direction,amount,"receivedBy") SELECT 'dataset-cash-payment-'||n,'dataset-org','dataset-store','dataset-shift','dataset-cash-'||n,'cash','in',1,'dataset-user' FROM generate_series(1,1001) n;
INSERT INTO "CashMovement" (id,"shiftId","movementType",amount,reason,"createdBy") VALUES ('dataset-cash-in','dataset-shift','cash_in',20,'Fixture cash in','dataset-user'),('dataset-cash-out','dataset-shift','cash_out',7,'Fixture cash out','dataset-user');
INSERT INTO "InventoryMovement" (id,"organizationId","storeId","productId","movementType","quantityDelta","unitCost","sourceType","sourceId","createdBy") VALUES ('dataset-opening','dataset-org','dataset-store','dataset-product','purchase',1008,0.5,'stock_document','dataset-purchase','dataset-user'),('dataset-credit-movement','dataset-org','dataset-store','dataset-product','sale',-3,0.5,'sale','dataset-credit','dataset-user'),('dataset-return-movement','dataset-org','dataset-store','dataset-product','return',1,0.5,'sale_return','dataset-return','dataset-user'),('dataset-kg-opening','dataset-org','dataset-second','dataset-kg','opening',12.345,99.99,'opening','dataset-kg-opening','dataset-user');
INSERT INTO "InventoryMovement" (id,"organizationId","storeId","productId","movementType","quantityDelta","unitCost","sourceType","sourceId","createdBy") SELECT 'dataset-cash-movement-'||n,'dataset-org','dataset-store','dataset-product','sale',-1,0.5,'sale','dataset-cash-'||n,'dataset-user' FROM generate_series(1,1001) n;
INSERT INTO "InventoryBalance" ("storeId","productId",quantity,"updatedAt") VALUES ('dataset-store','dataset-product',5,'2026-01-02'),('dataset-second','dataset-kg',12.345,'2026-01-02');
INSERT INTO "UserStore" ("organizationUserId","storeId") VALUES ('dataset-member','dataset-store'),('dataset-member','dataset-second');
INSERT INTO "StockTransfer" (id,"organizationId","fromStoreId","toStoreId",status,"createdBy","sentAt","receivedAt") VALUES ('dataset-transfer','dataset-org','dataset-store','dataset-second','received','dataset-user','2026-01-02','2026-01-02');
INSERT INTO "StockTransferItem" (id,"stockTransferId","productId",quantity,"unitCost") VALUES ('dataset-transfer-line','dataset-transfer','dataset-product',2,0.5);
INSERT INTO "InventoryMovement" (id,"organizationId","storeId","productId","movementType","quantityDelta","unitCost","sourceType","sourceId","createdBy") VALUES ('dataset-transfer-out','dataset-org','dataset-store','dataset-product','transfer_out',-2,0.5,'stock_transfer','dataset-transfer','dataset-user'),('dataset-transfer-in','dataset-org','dataset-second','dataset-product','transfer_in',2,0.5,'stock_transfer','dataset-transfer','dataset-user');
UPDATE "InventoryBalance" SET quantity=3 WHERE "storeId"='dataset-store' AND "productId"='dataset-product';
INSERT INTO "InventoryBalance" ("storeId","productId",quantity,"updatedAt") VALUES ('dataset-second','dataset-product',2,'2026-01-02');
-- Keep historical event/creation dates coherent across the old dataset.
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='createdAt' LOOP
  EXECUTE format('UPDATE public.%I SET "createdAt"=%L',t.table_name,'2026-01-01');
 END LOOP;
END $$;
UPDATE "Shift" SET "openedAt"='2026-01-01';
UPDATE "Payment" SET "paidAt"='2026-01-01';
UPDATE "Payment" SET "paidAt"='2026-01-02',"createdAt"='2026-01-02' WHERE id='dataset-credit-refund';
UPDATE "SaleReturn" SET "createdAt"='2026-01-02';
UPDATE "InventoryMovement" SET "occurredAt"='2026-01-01';
UPDATE "InventoryMovement" SET "occurredAt"='2026-01-02' WHERE id IN ('dataset-return-movement','dataset-transfer-in','dataset-transfer-out');
COMMIT;
