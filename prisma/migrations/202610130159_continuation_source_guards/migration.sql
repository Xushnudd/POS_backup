BEGIN;
CREATE FUNCTION receipt_cost_continuation_sources_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry jsonb; seen text[]:=ARRAY[]::text[]; source_store text; source_product text; event "InventoryValuationEvent"; price numeric;
BEGIN
 SELECT "costPrice" INTO price FROM "Product" WHERE id=NEW."productId" AND "organizationId"=NEW."organizationId";
 IF NEW.snapshot->>'version' IS DISTINCT FROM '1' OR (NEW.snapshot->>'financialAverageCost' ~ '^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$') IS DISTINCT FROM true OR (NEW.snapshot->>'currentAverageCost' ~ '^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$') IS DISTINCT FROM true OR (NEW.snapshot->>'lastSequence')::bigint IS DISTINCT FROM NEW."lastSequence" OR (NEW.snapshot->>'financialAverageCost')::numeric IS DISTINCT FROM price THEN RAISE EXCEPTION 'Continuation exact current valuation required' USING ERRCODE='23514';END IF;
 IF NEW.snapshot->>'costChangeEventId' IS NOT NULL THEN
  SELECT * INTO event FROM "InventoryValuationEvent" WHERE id=NEW.snapshot->>'costChangeEventId';
  IF event.id IS NULL OR event.kind<>'cost_change' OR event."transactionId"<>NEW."transactionId" OR event."productId"<>NEW."productId" OR event."organizationId"<>NEW."organizationId" OR event.sequence<>NEW."lastSequence" OR event."beforeUnitCost"<>(NEW.snapshot->>'currentAverageCost')::numeric OR event."afterUnitCost"<>price OR event.sequence<>(NEW.snapshot->>'beforeSequence')::bigint+1 THEN RAISE EXCEPTION 'Continuation native repricing source invalid' USING ERRCODE='23514';END IF;
 END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(NEW."cogsEntries") LOOP
  source_store:=NULL;source_product:=NULL;
  IF entry->>'itemId' IS NULL OR entry->>'itemId'=ANY(seen) THEN RAISE EXCEPTION 'Unique continuation COGS source required' USING ERRCODE='23514';END IF;
  seen:=array_append(seen,entry->>'itemId');
  IF entry->>'sourceType'='sale' THEN
   SELECT s."storeId",i."productId" INTO source_store,source_product FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" WHERE i.id=entry->>'itemId' AND s.id=entry->>'sourceId' AND s."organizationId"=NEW."organizationId" AND s.status IN ('completed','partially_returned','returned');
  ELSIF entry->>'sourceType' IN ('return','nonstock_return') THEN
   SELECT s."storeId",i."productId" INTO source_store,source_product FROM "SaleReturnItem" i JOIN "SaleReturn" r ON r.id=i."saleReturnId" JOIN "Sale" s ON s.id=r."saleId" WHERE i.id=entry->>'itemId' AND r.id=entry->>'sourceId' AND s."organizationId"=NEW."organizationId" AND r.status='completed' AND ((entry->>'sourceType'='return' AND i.disposition='sellable') OR (entry->>'sourceType'='nonstock_return' AND i.disposition<>'sellable'));
  END IF;
  IF source_product IS DISTINCT FROM NEW."productId" OR source_store IS NULL OR source_store IS DISTINCT FROM entry->>'storeId' THEN RAISE EXCEPTION 'Continuation COGS original document invalid' USING ERRCODE='23514';END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER receipt_cost_continuation_sources_guard BEFORE INSERT ON "ReceiptCostContinuation" FOR EACH ROW EXECUTE FUNCTION receipt_cost_continuation_sources_guard();
COMMIT;
