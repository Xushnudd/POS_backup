CREATE OR REPLACE FUNCTION check_return_tax_totals() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE item_id TEXT;i "SaleItem"%ROWTYPE;q NUMERIC;t NUMERIC;d NUMERIC;gross NUMERIC;expected_tax NUMERIC;expected_discount NUMERIC;BEGIN
 item_id=COALESCE(NEW."saleItemId",OLD."saleItemId");SELECT * INTO i FROM "SaleItem" WHERE id=item_id;
 IF i."taxBase" IS NOT NULL THEN
  SELECT COALESCE(sum(quantity),0),COALESCE(sum("taxAmount"),0),COALESCE(sum("discountAmount"),0),COALESCE(sum("lineTotal"),0) INTO q,t,d,gross FROM "SaleReturnItem" WHERE "saleItemId"=item_id;
  expected_tax=CASE WHEN i."payableAmount"=0 THEN 0 ELSE round(i."taxAmount"*gross/i."payableAmount",2) END;
  expected_discount=round((i."discountAmount"+i."receiptDiscount")*q/i.quantity,2);
  IF q>i.quantity OR gross>i."payableAmount" OR t<>expected_tax OR d<>expected_discount OR EXISTS(SELECT 1 FROM "SaleReturnItem" WHERE "saleItemId"=item_id AND "taxBase" IS NULL) THEN RAISE EXCEPTION 'Return cumulative tax/discount mismatch' USING ERRCODE='23514';END IF;
 END IF;RETURN NULL;
END $$;
