BEGIN;
CREATE OR REPLACE FUNCTION receipt_cost_application_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE plan "ReceiptCostPlan"; original "ReceiptCostApplication"; product_row jsonb; line jsonb; component text; item "StockDocumentItem"; current_product "Product"; current_sequence "InventoryValuationSequence"; event "InventoryValuationEvent"; total numeric:=0; seen text[]:=ARRAY[]::text[]; cost_changed boolean;
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Cost application journal is immutable' USING ERRCODE='23514';END IF;
 PERFORM assert_business_writable(NEW."organizationId");
 IF NEW."transactionId"<>txid_current() OR NOT EXISTS(SELECT 1 FROM "Session" s JOIN "OrganizationUser" m ON m."userId"=s."userId" AND m."organizationId"=s."organizationId" JOIN "User" u ON u.id=m."userId" WHERE s.id=NEW."sessionId" AND s."userId"=NEW."actorId" AND s."organizationId"=NEW."organizationId" AND s."authenticationMethod"<>'pin' AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp() AND m."isActive" AND m.role='owner' AND u."isActive") THEN RAISE EXCEPTION 'Live owner session required for cost application' USING ERRCODE='23514';END IF;
 SELECT * INTO plan FROM "ReceiptCostPlan" WHERE id=NEW."planId" FOR UPDATE;
 IF plan.id IS NULL OR plan.status<>'prepared' OR plan."organizationId"<>NEW."organizationId" OR plan."storeId"<>NEW."storeId" THEN RAISE EXCEPTION 'Cost application plan source invalid' USING ERRCODE='23514';END IF;
 IF NEW."reversalOfId" IS NULL THEN
  IF NEW.amount<>plan.amount THEN RAISE EXCEPTION 'Cost application amount mismatch' USING ERRCODE='23514';END IF;
 ELSE
  SELECT * INTO original FROM "ReceiptCostApplication" WHERE id=NEW."reversalOfId";
  IF original.id IS NULL OR original."reversalOfId" IS NOT NULL OR original."planId"<>plan.id OR original."organizationId"<>NEW."organizationId" OR NEW.amount<>-original.amount THEN RAISE EXCEPTION 'Cost reversal original source invalid' USING ERRCODE='23514';END IF;
 END IF;
 IF NEW.snapshot->>'version' IS DISTINCT FROM '1' OR jsonb_typeof(NEW.snapshot->'products') IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.snapshot->'products') NOT BETWEEN 1 AND 200 OR jsonb_array_length(NEW.snapshot->'products')<>(SELECT count(*) FROM "StockDocumentItem" WHERE "stockDocumentId"=plan."stockDocumentId") THEN RAISE EXCEPTION 'Complete cost application snapshot required' USING ERRCODE='23514';END IF;
 FOR product_row IN SELECT value FROM jsonb_array_elements(NEW.snapshot->'products') LOOP
  SELECT * INTO item FROM "StockDocumentItem" WHERE id=product_row->>'stockDocumentItemId' AND "stockDocumentId"=plan."stockDocumentId";
  IF item.id IS NULL OR item."productId" IS DISTINCT FROM product_row->>'productId' OR item.id=ANY(seen) THEN RAISE EXCEPTION 'Cost application original item invalid' USING ERRCODE='23514';END IF;
  seen:=array_append(seen,item.id);
  SELECT value INTO line FROM jsonb_array_elements(plan.snapshot->'lines') WHERE value->>'id'=item.id;
  IF line IS NULL OR (product_row->>'allocatedAmount')::numeric IS DISTINCT FROM (CASE WHEN NEW."reversalOfId" IS NULL THEN 1 ELSE -1 END)*(line->>'allocatedAmount')::numeric THEN RAISE EXCEPTION 'Cost allocation differs from prepared original' USING ERRCODE='23514';END IF;
  FOR component IN SELECT unnest(ARRAY['inventoryCorrection','cogsCorrection','varianceCorrection','roundingCorrection']) LOOP
   IF (product_row->>component) IS NULL OR (product_row->>component)!~'^-?(0|[1-9][0-9]{0,39})(\.[0-9]{1,12})?$' THEN RAISE EXCEPTION 'Exact bounded cost component required' USING ERRCODE='23514';END IF;
  END LOOP;
  IF (product_row->>'inventoryCorrection')::numeric+(product_row->>'cogsCorrection')::numeric+(product_row->>'varianceCorrection')::numeric+(product_row->>'roundingCorrection')::numeric IS DISTINCT FROM (product_row->>'allocatedAmount')::numeric THEN RAISE EXCEPTION 'Cost application value does not conserve expense' USING ERRCODE='23514';END IF;
  total:=total+(product_row->>'allocatedAmount')::numeric;
  SELECT * INTO current_product FROM "Product" WHERE id=item."productId" AND "organizationId"=NEW."organizationId" FOR UPDATE;
  SELECT * INTO current_sequence FROM "InventoryValuationSequence" WHERE "productId"=item."productId";
  IF current_sequence."legacyMovementCount" IS DISTINCT FROM 0 OR current_sequence."baselineQuantity" IS DISTINCT FROM 0 OR current_sequence."baselineUnitCost" IS NULL OR current_product."costPrice" IS DISTINCT FROM (product_row->>'afterAverageCost')::numeric OR current_sequence."lastSequence" IS DISTINCT FROM (product_row->>'afterSequence')::bigint THEN RAISE EXCEPTION 'Cost application current boundary invalid' USING ERRCODE='23514';END IF;
  IF (product_row->>'lastSequence' ~ '^(0|[1-9][0-9]{0,18})$') IS DISTINCT FROM true OR (product_row->>'afterSequence' ~ '^(0|[1-9][0-9]{0,18})$') IS DISTINCT FROM true OR (product_row->>'beforeAverageCost' ~ '^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$') IS DISTINCT FROM true OR (product_row->>'afterAverageCost' ~ '^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Explicit bounded cost boundary required' USING ERRCODE='23514';END IF;
  cost_changed:=(product_row->>'beforeAverageCost')::numeric<>(product_row->>'afterAverageCost')::numeric;
  IF (product_row->>'afterSequence')::bigint<>(product_row->>'lastSequence')::bigint+(CASE WHEN cost_changed THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'Unexpected cost application event span' USING ERRCODE='23514';END IF;
  IF cost_changed THEN
   SELECT * INTO event FROM "InventoryValuationEvent" WHERE id=product_row->>'costChangeEventId';
   IF event.id IS NULL OR event.kind<>'cost_change' OR event."transactionId"<>NEW."transactionId" OR event."productId"<>item."productId" OR event."organizationId"<>NEW."organizationId" OR event.sequence<>current_sequence."lastSequence" OR event."beforeUnitCost"<>(product_row->>'beforeAverageCost')::numeric OR event."afterUnitCost"<>(product_row->>'afterAverageCost')::numeric THEN RAISE EXCEPTION 'Cost application native event mismatch' USING ERRCODE='23514';END IF;
  ELSIF product_row->>'costChangeEventId' IS NOT NULL THEN RAISE EXCEPTION 'Unchanged cost must not claim a cost event' USING ERRCODE='23514';END IF;
 END LOOP;
 IF total IS DISTINCT FROM NEW.amount THEN RAISE EXCEPTION 'Cost application aggregate mismatch' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;

COMMIT;
