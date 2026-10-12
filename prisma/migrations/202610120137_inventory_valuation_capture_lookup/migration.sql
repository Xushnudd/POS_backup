-- Preserve capture semantics and immutable baselines; avoid an O(history) scan for every posting.
CREATE OR REPLACE FUNCTION inventory_valuation_record() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE product_key text; organization_key text; position bigint; baseline_quantity numeric; baseline_cost numeric;
BEGIN
 IF TG_TABLE_NAME='Product' THEN
  IF NEW."costPrice" IS NOT DISTINCT FROM OLD."costPrice" THEN RETURN NEW;END IF;
  product_key=NEW.id;organization_key=NEW."organizationId";
 ELSE
  product_key=NEW."productId";organization_key=NEW."organizationId";
 END IF;
 IF NOT EXISTS(SELECT 1 FROM "Product" p WHERE p.id=product_key AND p."organizationId"=organization_key) THEN
  RAISE EXCEPTION 'Valuation product scope mismatch' USING ERRCODE='23514';
 END IF;
 -- Initial stock/history snapshots are computed once. Existing hot SKUs use
 -- indexed state lookup rather than scanning their complete movement history.
 IF NOT EXISTS(SELECT 1 FROM "InventoryValuationSequence" WHERE "productId"=product_key) THEN
 SELECT COALESCE(sum(quantity),0) INTO baseline_quantity FROM "InventoryBalance" WHERE "productId"=product_key;
 IF TG_TABLE_NAME='InventoryMovement' THEN
  baseline_quantity=baseline_quantity-NEW."quantityDelta";
  SELECT "costPrice" INTO baseline_cost FROM "Product" WHERE id=product_key;
 ELSE baseline_cost=OLD."costPrice";END IF;
 -- In an AFTER INSERT movement trigger the current row is already visible.
 -- Discount precisely that row, never other movements from this transaction.
 INSERT INTO "InventoryValuationSequence"("productId","organizationId","legacyMovementCount","baselineQuantity","baselineUnitCost")
 SELECT product_key,organization_key,count(*)-(CASE WHEN TG_TABLE_NAME='InventoryMovement' THEN 1 ELSE 0 END),baseline_quantity,baseline_cost
 FROM "InventoryMovement" WHERE "productId"=product_key
 ON CONFLICT("productId") DO NOTHING;
 END IF;
 UPDATE "InventoryValuationSequence" SET "lastSequence"="lastSequence"+1
 WHERE "productId"=product_key AND "organizationId"=organization_key RETURNING "lastSequence" INTO position;
 IF position IS NULL THEN RAISE EXCEPTION 'Valuation sequence scope mismatch' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='Product' THEN
  INSERT INTO "InventoryValuationEvent"(id,"organizationId","productId",sequence,"transactionId",kind,"beforeUnitCost","afterUnitCost")
  VALUES(gen_random_uuid()::text,organization_key,product_key,position,txid_current(),'cost_change',OLD."costPrice",NEW."costPrice");
 ELSE
  IF NOT EXISTS(SELECT 1 FROM "Store" WHERE id=NEW."storeId" AND "organizationId"=organization_key) THEN
   RAISE EXCEPTION 'Valuation movement store scope mismatch' USING ERRCODE='23514';
  END IF;
  INSERT INTO "InventoryValuationEvent"(id,"organizationId","productId","storeId","movementId",sequence,"transactionId",kind,"quantityDelta","unitCost","actorId","sourceType","sourceId")
  VALUES(gen_random_uuid()::text,organization_key,product_key,NEW."storeId",NEW.id,position,txid_current(),'movement',NEW."quantityDelta",NEW."unitCost",NEW."createdBy",NEW."sourceType",NEW."sourceId");
 END IF;
 RETURN NEW;
END $$;

