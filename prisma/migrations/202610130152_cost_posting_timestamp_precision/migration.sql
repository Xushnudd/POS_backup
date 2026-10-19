BEGIN;
CREATE OR REPLACE FUNCTION receipt_cost_application_sources_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p jsonb; e jsonb; total numeric; seen text[]; source_store text; source_product text;
BEGIN
 IF NEW."createdAt" IS DISTINCT FROM CURRENT_TIMESTAMP::timestamp(3) THEN RAISE EXCEPTION 'Cost posting date must be current transaction date' USING ERRCODE='23514'; END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(NEW.snapshot->'products') LOOP
  IF NOT EXISTS(SELECT 1 FROM "InventoryValuationEvent" v JOIN "ReceiptCostPlan" plan ON plan.id=NEW."planId" WHERE v."movementId"=p->>'receiptEventId' AND v."organizationId"=NEW."organizationId" AND v."productId"=p->>'productId' AND v."sourceType"='stock_document' AND v."sourceId"=plan."stockDocumentId" AND v."quantityDelta">0) THEN RAISE EXCEPTION 'Cost receipt event source invalid' USING ERRCODE='23514'; END IF;
  FOR source_store IN SELECT unnest(ARRAY['cogsEntries','issueCosts','transferCosts','storeCorrections']) LOOP
   IF jsonb_typeof(p->source_store) IS DISTINCT FROM 'array' OR jsonb_array_length(p->source_store)>10000 THEN RAISE EXCEPTION 'Bounded cost sources required' USING ERRCODE='23514';END IF;
  END LOOP;
  total:=0; seen:=ARRAY[]::text[];
  FOR e IN SELECT value FROM jsonb_array_elements(p->'cogsEntries') LOOP
   IF e->>'itemId' IS NULL OR e->>'itemId'=ANY(seen) OR (e->>'amount' ~ '^-?(0|[1-9][0-9]{0,39})(\.[0-9]{1,12})?$') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Exact unique COGS entries required' USING ERRCODE='23514';END IF;
   seen:=array_append(seen,e->>'itemId');source_store:=NULL;source_product:=NULL;
   IF e->>'sourceType'='sale' THEN
    SELECT s."storeId",i."productId" INTO source_store,source_product FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" WHERE i.id=e->>'itemId' AND s.id=e->>'sourceId' AND s."organizationId"=NEW."organizationId" AND s.status IN ('completed','partially_returned','returned');
   ELSIF e->>'sourceType' IN ('return','nonstock_return') THEN
    SELECT s."storeId",i."productId" INTO source_store,source_product FROM "SaleReturnItem" i JOIN "SaleReturn" r ON r.id=i."saleReturnId" JOIN "Sale" s ON s.id=r."saleId" WHERE i.id=e->>'itemId' AND r.id=e->>'sourceId' AND s."organizationId"=NEW."organizationId" AND r.status='completed' AND ((e->>'sourceType'='return' AND i.disposition='sellable') OR (e->>'sourceType'='nonstock_return' AND i.disposition<>'sellable'));
   END IF;
   IF source_store IS DISTINCT FROM e->>'storeId' OR source_product IS DISTINCT FROM p->>'productId' OR source_store IS NULL THEN RAISE EXCEPTION 'COGS original source invalid' USING ERRCODE='23514';END IF;
   total:=total+(e->>'amount')::numeric;
  END LOOP;
  IF total IS DISTINCT FROM (p->>'cogsCorrection')::numeric THEN RAISE EXCEPTION 'COGS source totals mismatch' USING ERRCODE='23514';END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(p->'issueCosts') LOOP
   IF (e->>'unitCost' ~ '^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$') IS DISTINCT FROM true OR NOT EXISTS(SELECT 1 FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" WHERE i.id=e->>'itemId' AND i."productId"=p->>'productId' AND s."organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'Effective sale cost source invalid' USING ERRCODE='23514';END IF;
  END LOOP;
  FOR e IN SELECT value FROM jsonb_array_elements(p->'transferCosts') LOOP
   IF (e->>'unitCost' ~ '^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$') IS DISTINCT FROM true OR NOT EXISTS(SELECT 1 FROM "StockTransferItem" i JOIN "StockTransfer" t ON t.id=i."stockTransferId" WHERE i.id=e->>'itemId' AND i."productId"=p->>'productId' AND t."organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'Effective transfer cost source invalid' USING ERRCODE='23514';END IF;
  END LOOP;
  IF (p->>'transitCorrection' ~ '^-?(0|[1-9][0-9]{0,39})(\.[0-9]{1,12})?$') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Exact transit correction required' USING ERRCODE='23514';END IF;
  total:=(p->>'transitCorrection')::numeric;seen:=ARRAY[]::text[];
  FOR e IN SELECT value FROM jsonb_array_elements(p->'storeCorrections') LOOP
   IF e->>'storeId' IS NULL OR e->>'storeId'=ANY(seen) OR (e->>'amount' ~ '^-?(0|[1-9][0-9]{0,39})(\.[0-9]{1,12})?$') IS DISTINCT FROM true OR (e->>'quantity' ~ '^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$') IS DISTINCT FROM true OR NOT EXISTS(SELECT 1 FROM "Store" WHERE id=e->>'storeId' AND "organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'Exact unique stock correction source required' USING ERRCODE='23514';END IF;
   seen:=array_append(seen,e->>'storeId');total:=total+(e->>'amount')::numeric;
  END LOOP;
  IF total IS DISTINCT FROM (p->>'inventoryCorrection')::numeric THEN RAISE EXCEPTION 'Stock correction source totals mismatch' USING ERRCODE='23514';END IF;
 END LOOP;
 RETURN NEW;
END $$;
COMMIT;
