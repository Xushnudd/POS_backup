BEGIN;
ALTER TABLE "Sale" ADD COLUMN "receiptSnapshot" JSONB;
-- No fabricated backfill: pre-migration posted receipts retain NULL and the UI
-- explicitly says that original identity metadata was not captured.
CREATE FUNCTION capture_receipt_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status IN ('completed','partially_returned','returned') THEN
  IF NEW."receiptSnapshot" IS DISTINCT FROM OLD."receiptSnapshot" THEN
   RAISE EXCEPTION 'Receipt identity snapshot is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.status IN ('completed','partially_returned','returned') THEN
  SELECT jsonb_build_object(
   'version',1,'capturedAt',CURRENT_TIMESTAMP,
   'organizationName',o.name,'organizationPhone',o.phone,'tin',o.tin,
   'currencyCode',o."currencyCode",'timezone',o.timezone,'receiptFooter',o."receiptFooter",
   'storeName',s.name,'storeAddress',s.address,'storePhone',s.phone,
   'registerName',r.name,'registerCode',r.code,'cashierName',u."fullName"
  ) INTO NEW."receiptSnapshot"
  FROM "Organization" o JOIN "Store" s ON s."organizationId"=o.id
  JOIN "Register" r ON r."storeId"=s.id CROSS JOIN "User" u
  WHERE o.id=NEW."organizationId" AND s.id=NEW."storeId"
   AND r.id=NEW."registerId" AND u.id=NEW."cashierId";
  IF NEW."receiptSnapshot" IS NULL THEN
   RAISE EXCEPTION 'Receipt identity source is invalid' USING ERRCODE='23514';
  END IF;
 ELSE
  NEW."receiptSnapshot":=NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receipt_identity_snapshot BEFORE INSERT OR UPDATE ON "Sale"
 FOR EACH ROW EXECUTE FUNCTION capture_receipt_identity();
COMMIT;
