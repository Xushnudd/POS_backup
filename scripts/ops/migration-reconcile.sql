BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL TIME ZONE 'UTC';
-- Fail closed before/after the drill. No automatic opening balance or history repair.
DO $$
DECLARE mismatch bigint;
BEGIN
 IF EXISTS (SELECT 1 FROM "Product" GROUP BY "organizationId",sku HAVING count(*)>1)
 OR EXISTS (SELECT 1 FROM "Product" GROUP BY "organizationId",barcode HAVING count(*)>1)
 THEN RAISE EXCEPTION 'DATASET_DUPLICATE_IDENTITY'; END IF;
 IF EXISTS(SELECT 1 FROM "InventoryBalance" b FULL JOIN
  (SELECT "storeId","productId",sum("quantityDelta") AS quantity FROM "InventoryMovement" GROUP BY "storeId","productId") m
  USING("storeId","productId") WHERE COALESCE(b.quantity,0)<>COALESCE(m.quantity,0))
 THEN RAISE EXCEPTION 'DATASET_STOCK_UNRECONCILED'; END IF;
 IF EXISTS(SELECT 1 FROM "Sale" s LEFT JOIN (SELECT "saleId",sum("lineTotal") AS subtotal FROM "SaleItem" GROUP BY "saleId") i ON i."saleId"=s.id
  WHERE s.status IN ('completed','partially_returned','returned') AND (s.subtotal<>COALESCE(i.subtotal,0) OR s."totalAmount"<>s.subtotal-s."discountAmount"))
 THEN RAISE EXCEPTION 'DATASET_SALE_UNRECONCILED'; END IF;
 IF EXISTS(SELECT 1 FROM "Sale" s LEFT JOIN (SELECT "saleId",sum(CASE WHEN direction='in' THEN amount ELSE 0 END) AS amount FROM "Payment" WHERE COALESCE(note,'')<>'debt_collection' GROUP BY "saleId") p ON p."saleId"=s.id
  WHERE s.status IN ('completed','partially_returned','returned') AND s."totalAmount"<>COALESCE(p.amount,0))
 THEN RAISE EXCEPTION 'DATASET_PAYMENT_UNRECONCILED'; END IF;
 IF EXISTS(SELECT 1 FROM "SaleReturn" r LEFT JOIN (SELECT "saleReturnId",sum("lineTotal") AS amount FROM "SaleReturnItem" GROUP BY "saleReturnId") i ON i."saleReturnId"=r.id WHERE r."refundAmount"<>COALESCE(i.amount,0))
 OR EXISTS(SELECT 1 FROM "SaleReturnItem" ri JOIN "SaleReturn" r ON r.id=ri."saleReturnId" JOIN "SaleItem" si ON si.id=ri."saleItemId" WHERE si."saleId"<>r."saleId" OR si."productId"<>ri."productId")
 THEN RAISE EXCEPTION 'DATASET_RETURN_UNRECONCILED'; END IF;
 IF EXISTS(SELECT 1 FROM "Shift" s LEFT JOIN (SELECT "shiftId",sum(CASE WHEN direction='in' THEN amount ELSE -amount END) AS amount FROM "Payment" WHERE "paymentType"='cash' GROUP BY "shiftId") p ON p."shiftId"=s.id
 LEFT JOIN (SELECT "shiftId",sum(CASE WHEN "movementType"='cash_in' THEN amount ELSE -amount END) AS amount FROM "CashMovement" GROUP BY "shiftId") c ON c."shiftId"=s.id
 WHERE s.status='closed' AND (s."expectedCash" IS NULL OR s."expectedCash"<>s."openingCash"+COALESCE(p.amount,0)+COALESCE(c.amount,0) OR s."countedCash" IS NULL OR s."cashDifference" IS DISTINCT FROM s."countedCash"-s."expectedCash"))
 THEN RAISE EXCEPTION 'DATASET_SHIFT_UNRECONCILED'; END IF;
 IF EXISTS(SELECT 1 FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" JOIN "Product" p ON p.id=i."productId" WHERE s."organizationId"<>p."organizationId")
 OR EXISTS(SELECT 1 FROM "InventoryBalance" b JOIN "Store" s ON s.id=b."storeId" JOIN "Product" p ON p.id=b."productId" WHERE s."organizationId"<>p."organizationId")
 OR EXISTS(SELECT 1 FROM "StockDocumentItem" i JOIN "StockDocument" d ON d.id=i."stockDocumentId" JOIN "Product" p ON p.id=i."productId" WHERE d."organizationId"<>p."organizationId")
 OR EXISTS(SELECT 1 FROM "StockTransferItem" i JOIN "StockTransfer" t ON t.id=i."stockTransferId" JOIN "Product" p ON p.id=i."productId" WHERE t."organizationId"<>p."organizationId")
 OR EXISTS(SELECT 1 FROM "UserStore" u JOIN "OrganizationUser" m ON m.id=u."organizationUserId" JOIN "Store" s ON s.id=u."storeId" WHERE m."organizationId"<>s."organizationId")
 OR EXISTS(SELECT 1 FROM "Shift" sh JOIN "OrganizationUser" m ON m.id=sh."organizationUserId" JOIN "Register" r ON r.id=sh."registerId" JOIN "Store" s ON s.id=r."storeId" WHERE m."organizationId"<>s."organizationId")
 OR EXISTS(SELECT 1 FROM "Sale" s JOIN "Shift" sh ON sh.id=s."shiftId" JOIN "Register" r ON r.id=s."registerId" JOIN "Store" st ON st.id=r."storeId" WHERE s."storeId"<>r."storeId" OR s."registerId"<>sh."registerId" OR s."organizationId"<>st."organizationId")
 OR EXISTS(SELECT 1 FROM "Payment" p JOIN "Sale" s ON s.id=p."saleId" WHERE p."organizationId"<>s."organizationId" OR p."storeId"<>s."storeId")
 THEN RAISE EXCEPTION 'DATASET_TENANT_UNRECONCILED'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='SaleItem' AND column_name='receiptDiscount') THEN
  EXECUTE 'SELECT count(*) FROM "Sale" s LEFT JOIN (SELECT "saleId",sum("receiptDiscount") AS amount FROM "SaleItem" GROUP BY "saleId") i ON i."saleId"=s.id WHERE s."discountAmount"<>COALESCE(i.amount,0)' INTO mismatch;
  IF mismatch<>0 THEN RAISE EXCEPTION 'DATASET_DISCOUNT_BACKFILL_UNRECONCILED'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='StockTransferItem' AND column_name='receivedQuantity') THEN
  EXECUTE 'SELECT count(*) FROM "StockTransferItem" i JOIN "StockTransfer" t ON t.id=i."stockTransferId" WHERE t.status=''received'' AND i."receivedQuantity"<>i.quantity' INTO mismatch;
  IF mismatch<>0 THEN RAISE EXCEPTION 'DATASET_TRANSFER_BACKFILL_UNRECONCILED'; END IF;
 END IF;
 IF to_regclass('public."DebtEntry"') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM "Payment" p LEFT JOIN "DebtEntry" d ON d.id=''legacy-''||p.id AND d."sourceType"=''legacy_payment'' AND d."sourceId"=p.id WHERE p."paymentType"=''credit'' AND p."customerId" IS NOT NULL AND (d.id IS NULL OR d."organizationId"<>p."organizationId" OR d."customerId"<>p."customerId" OR d.amount<>CASE WHEN p.direction=''in'' THEN p.amount ELSE -p.amount END)' INTO mismatch;
  IF mismatch<>0 THEN RAISE EXCEPTION 'DATASET_DEBT_BACKFILL_UNRECONCILED'; END IF;
 END IF;
 IF to_regclass('public."ProductBarcode"') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM "Product" p LEFT JOIN "ProductBarcode" b ON b."productId"=p.id AND b."isPrimary" WHERE b.id IS NULL OR b."organizationId"<>p."organizationId" OR b.value<>p.barcode' INTO mismatch;
  IF mismatch<>0 THEN RAISE EXCEPTION 'DATASET_BARCODE_BACKFILL_UNRECONCILED'; END IF;
 END IF;
 IF to_regclass('public."Unit"') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM "Product" p LEFT JOIN "Unit" u ON u."organizationId"=p."organizationId" AND u.code=p.unit WHERE u.id IS NULL' INTO mismatch;
  IF mismatch<>0 THEN RAISE EXCEPTION 'DATASET_UNIT_BACKFILL_UNRECONCILED'; END IF;
 END IF;
END $$;
SELECT jsonb_build_object('stockByUnit',(SELECT COALESCE(jsonb_object_agg(unit,quantity),'{}'::jsonb) FROM (SELECT p.unit,trim_scale(sum(b.quantity))::text AS quantity FROM "InventoryBalance" b JOIN "Product" p ON p.id=b."productId" GROUP BY p.unit) units),
 'saleValue',(SELECT trim_scale(COALESCE(sum("totalAmount"),0))::text FROM "Sale" WHERE status IN ('completed','partially_returned','returned')),
 'creditValue',(SELECT trim_scale(COALESCE(sum(CASE WHEN direction='in' THEN amount ELSE -amount END),0))::text FROM "Payment" WHERE "paymentType"='credit'),
 'cashNet',(SELECT trim_scale(COALESCE(sum(CASE WHEN direction='in' THEN amount ELSE -amount END),0))::text FROM "Payment" WHERE "paymentType"='cash'),
 'cashManagementNet',(SELECT trim_scale(COALESCE(sum(CASE WHEN "movementType"='cash_in' THEN amount ELSE -amount END),0))::text FROM "CashMovement"),
 'openingCash',(SELECT trim_scale(COALESCE(sum("openingCash"),0))::text FROM "Shift"),
 'closedExpectedCash',(SELECT trim_scale(COALESCE(sum("expectedCash"),0))::text FROM "Shift" WHERE status='closed'));
COMMIT;
