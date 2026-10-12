-- Preserve earlier capture rows as unproven: do not guess their initial stock
-- or cost from the current balance. Future first capture records real snapshots.
ALTER TABLE "InventoryValuationSequence" ADD COLUMN "baselineQuantity" decimal(20,6), ADD COLUMN "baselineUnitCost" decimal(20,6);
ALTER TABLE "InventoryValuationSequence" ADD CONSTRAINT "InventoryValuationSequence_baseline_check" CHECK(("baselineQuantity" IS NULL AND "baselineUnitCost" IS NULL) OR ("baselineQuantity" IS NOT NULL AND "baselineUnitCost" IS NOT NULL AND "baselineUnitCost">=0));
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

CREATE OR REPLACE FUNCTION inventory_valuation_sequence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
  RAISE EXCEPTION 'Valuation sequence is immutable' USING ERRCODE='23514';
 END IF;
 IF pg_trigger_depth()<2 THEN RAISE EXCEPTION 'Valuation order requires original posting capture' USING ERRCODE='23514';END IF;
 IF TG_OP='INSERT' THEN
  IF NEW."lastSequence"<>0 OR NEW."baselineQuantity" IS NULL OR NEW."baselineUnitCost" IS NULL OR NEW."baselineUnitCost"<0 THEN RAISE EXCEPTION 'Valuation order must start at zero' USING ERRCODE='23514';END IF;
  RETURN NEW;
 END IF;
 IF (NEW."productId",NEW."organizationId",NEW."legacyMovementCount",NEW."initializedAt",NEW."baselineQuantity",NEW."baselineUnitCost") IS DISTINCT FROM
    (OLD."productId",OLD."organizationId",OLD."legacyMovementCount",OLD."initializedAt",OLD."baselineQuantity",OLD."baselineUnitCost") OR NEW."lastSequence"<>OLD."lastSequence"+1 THEN
  RAISE EXCEPTION 'Valuation sequence must advance once without changing provenance' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
