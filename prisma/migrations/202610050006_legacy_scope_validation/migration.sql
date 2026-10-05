BEGIN;
-- Triggers protect new writes; validate legacy chains explicitly before release.
DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" JOIN "Product" p ON p.id=i."productId" WHERE s."organizationId"<>p."organizationId"
  UNION ALL SELECT 1 FROM "StockDocumentItem" i JOIN "StockDocument" s ON s.id=i."stockDocumentId" JOIN "Product" p ON p.id=i."productId" WHERE s."organizationId"<>p."organizationId"
  UNION ALL SELECT 1 FROM "StockTransferItem" i JOIN "StockTransfer" s ON s.id=i."stockTransferId" JOIN "Product" p ON p.id=i."productId" WHERE s."organizationId"<>p."organizationId"
  UNION ALL SELECT 1 FROM "InventoryBalance" i JOIN "Store" s ON s.id=i."storeId" JOIN "Product" p ON p.id=i."productId" WHERE s."organizationId"<>p."organizationId"
  UNION ALL SELECT 1 FROM "UserStore" i JOIN "OrganizationUser" u ON u.id=i."organizationUserId" JOIN "Store" s ON s.id=i."storeId" WHERE u."organizationId"<>s."organizationId"
  UNION ALL SELECT 1 FROM "Shift" sh JOIN "OrganizationUser" u ON u.id=sh."organizationUserId" JOIN "Register" r ON r.id=sh."registerId" JOIN "Store" s ON s.id=r."storeId" WHERE u."organizationId"<>s."organizationId"
  UNION ALL SELECT 1 FROM "Sale" s JOIN "Shift" sh ON sh.id=s."shiftId" JOIN "Register" r ON r.id=s."registerId" JOIN "Store" st ON st.id=r."storeId" WHERE s."storeId"<>r."storeId" OR s."registerId"<>sh."registerId" OR s."organizationId"<>st."organizationId"
  UNION ALL SELECT 1 FROM "Payment" p JOIN "Sale" s ON s.id=p."saleId" WHERE p."organizationId"<>s."organizationId" OR p."storeId"<>s."storeId"
  UNION ALL SELECT 1 FROM "Payment" p JOIN "Shift" sh ON sh.id=p."shiftId" JOIN "Register" r ON r.id=sh."registerId" JOIN "Store" s ON s.id=r."storeId" WHERE p."organizationId"<>s."organizationId" OR p."storeId"<>s.id
  UNION ALL SELECT 1 FROM "SaleReturnItem" i JOIN "SaleReturn" ret ON ret.id=i."saleReturnId" JOIN "SaleItem" original ON original.id=i."saleItemId" WHERE original."saleId"<>ret."saleId" OR original."productId"<>i."productId"
  UNION ALL SELECT 1 FROM "DebtEntry" d JOIN "Sale" s ON s.id=d."saleId" WHERE d."organizationId"<>s."organizationId" OR d."customerId" IS DISTINCT FROM s."customerId"
 ) THEN RAISE EXCEPTION 'Legacy POS relationship mismatch; reconcile in an isolated clone before migration'; END IF;
END $$;
CREATE FUNCTION check_pos_financial_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='SaleReturnItem' THEN
  IF NOT EXISTS(SELECT 1 FROM "SaleReturn" ret JOIN "SaleItem" original ON original."saleId"=ret."saleId" WHERE ret.id=NEW."saleReturnId" AND original.id=NEW."saleItemId" AND original."productId"=NEW."productId") THEN RAISE EXCEPTION 'return original-item mismatch'; END IF;
 ELSIF TG_TABLE_NAME='DebtEntry' AND NEW."saleId" IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM "Sale" s WHERE s.id=NEW."saleId" AND s."organizationId"=NEW."organizationId" AND s."customerId"=NEW."customerId") THEN RAISE EXCEPTION 'debt original-sale mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "SaleReturnItem_scope" BEFORE INSERT OR UPDATE ON "SaleReturnItem" FOR EACH ROW EXECUTE FUNCTION check_pos_financial_scope();
CREATE TRIGGER "DebtEntry_sale_scope" BEFORE INSERT OR UPDATE ON "DebtEntry" FOR EACH ROW EXECUTE FUNCTION check_pos_financial_scope();
ALTER TABLE "Product" ADD CONSTRAINT "Product_nonnegative_money" CHECK ("salePrice">=0 AND "costPrice">=0 AND "minStock">=0);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_nonnegative_limit" CHECK ("creditLimit">=0);
ALTER TABLE "StockDocumentItem" ADD CONSTRAINT "StockDocumentItem_amounts" CHECK (quantity<>0 AND "unitCost">=0);
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_distinct_stores" CHECK ("fromStoreId"<>"toStoreId");
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_amounts" CHECK (quantity>0 AND "unitCost">=0);
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_nonnegative_amount" CHECK ("refundAmount">=0);
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_amounts" CHECK (quantity>0 AND "unitPrice">=0 AND "lineTotal">=0);
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_nonnegative_count" CHECK ("openingCash">=0 AND ("countedCash" IS NULL OR "countedCash">=0));
COMMIT;
