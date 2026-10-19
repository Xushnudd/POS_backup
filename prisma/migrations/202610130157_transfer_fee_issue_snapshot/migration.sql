BEGIN;
ALTER TABLE "StockTransferItem" ADD COLUMN "issueUnitCostSnapshot" numeric(20,6) CHECK("issueUnitCostSnapshot">=0);
CREATE FUNCTION transfer_fee_issue_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t "StockTransfer"; p "Product"; amount numeric;
BEGIN
 IF TG_OP='INSERT' AND NEW."issueUnitCostSnapshot" IS NOT NULL THEN RAISE EXCEPTION 'Issued cost is assigned at send only' USING ERRCODE='23514';END IF;
 IF TG_OP='UPDATE' AND NEW."issueUnitCostSnapshot" IS DISTINCT FROM OLD."issueUnitCostSnapshot" THEN
  SELECT * INTO t FROM "StockTransfer" WHERE id=NEW."stockTransferId";
  SELECT * INTO p FROM "Product" WHERE id=NEW."productId";
  SELECT COALESCE(sum((product->>'allocatedAmount')::numeric),0) INTO amount FROM "ReceiptCostApplication" a CROSS JOIN LATERAL jsonb_array_elements(a.snapshot->'products') product WHERE a."organizationId"=t."organizationId" AND product->>'productId'=p.id;
  IF OLD."issueUnitCostSnapshot" IS NOT NULL OR t.status<>'draft' OR NEW."issueUnitCostSnapshot" IS DISTINCT FROM p."costPrice" OR amount<=0 THEN RAISE EXCEPTION 'Issued cost must freeze current active-fee cost once' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER transfer_fee_issue_snapshot_guard BEFORE INSERT OR UPDATE ON "StockTransferItem" FOR EACH ROW EXECUTE FUNCTION transfer_fee_issue_snapshot_guard();
CREATE OR REPLACE FUNCTION transfer_disposition_scope() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM "StockTransferItem" i JOIN "StockTransfer" t ON t.id=i."stockTransferId" JOIN "Product" p ON p.id=i."productId"
 WHERE i.id=NEW."itemId" AND t."organizationId"=NEW."organizationId" AND t."toStoreId"=NEW."storeId" AND i."productId"=NEW."productId" AND p."organizationId"=NEW."organizationId" AND COALESCE(i."issueUnitCostSnapshot",i."unitCost")=NEW."unitCost" AND p.unit=NEW.unit AND t.status='sent') THEN RAISE EXCEPTION 'Transfer disposition original/scope mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "OrganizationUser" m JOIN "User" u ON u.id=m."userId" WHERE m."organizationId"=NEW."organizationId" AND m."userId"=NEW."actorId" AND m."isActive" AND u."isActive" AND m.role IN ('owner','admin')) THEN RAISE EXCEPTION 'Transfer disposition manager required'; END IF;
 RETURN NEW; END $$;

COMMIT;
