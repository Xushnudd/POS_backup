-- Record future write order under one per-product row lock. No UPDATE to the
-- original immutable movement journal and no guessed order for legacy history.
CREATE TABLE "InventoryValuationSequence" (
 "productId" text PRIMARY KEY REFERENCES "Product"(id) ON DELETE CASCADE,
 "organizationId" text NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "lastSequence" bigint NOT NULL DEFAULT 0 CHECK ("lastSequence">=0),
 "legacyMovementCount" bigint NOT NULL CHECK ("legacyMovementCount">=0),
 "initializedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY("productId","organizationId") REFERENCES "Product"(id,"organizationId") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "InventoryValuationSequence_organizationId_idx" ON "InventoryValuationSequence"("organizationId");
CREATE TABLE "InventoryValuationEvent" (
 id text PRIMARY KEY,
 "organizationId" text NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "productId" text NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,
 "storeId" text REFERENCES "Store"(id) ON DELETE CASCADE,
 "movementId" text UNIQUE REFERENCES "InventoryMovement"(id) ON DELETE CASCADE,
 sequence bigint NOT NULL CHECK (sequence>0),
 "transactionId" bigint NOT NULL,
 kind text NOT NULL CHECK (kind IN ('movement','cost_change')),
 "quantityDelta" decimal(20,6), "unitCost" decimal(20,6),
 "beforeUnitCost" decimal(20,6), "afterUnitCost" decimal(20,6),
 "actorId" text REFERENCES "User"(id) ON DELETE NO ACTION,
 "sourceType" text,"sourceId" text,
 "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("productId",sequence),
 FOREIGN KEY("productId","organizationId") REFERENCES "Product"(id,"organizationId") ON DELETE CASCADE ON UPDATE NO ACTION,
 CHECK ((kind='movement' AND "movementId" IS NOT NULL AND "storeId" IS NOT NULL
   AND "quantityDelta" IS NOT NULL AND "quantityDelta"<>0 AND "unitCost" IS NOT NULL AND "unitCost">=0
   AND "actorId" IS NOT NULL AND "sourceType" IS NOT NULL AND "sourceId" IS NOT NULL
   AND "beforeUnitCost" IS NULL AND "afterUnitCost" IS NULL)
 OR (kind='cost_change' AND "movementId" IS NULL AND "storeId" IS NULL
   AND "quantityDelta" IS NULL AND "unitCost" IS NULL
   AND "beforeUnitCost" IS NOT NULL AND "afterUnitCost" IS NOT NULL
   AND "beforeUnitCost">=0 AND "afterUnitCost">=0 AND "beforeUnitCost"<>"afterUnitCost"))
);
CREATE INDEX "InventoryValuationEvent_organizationId_productId_sequence_idx" ON "InventoryValuationEvent"("organizationId","productId",sequence);
CREATE FUNCTION inventory_valuation_record() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE product_key text; organization_key text; position bigint;
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
 -- In an AFTER INSERT movement trigger the current row is already visible.
 -- Discount precisely that row, never other movements from this transaction.
 INSERT INTO "InventoryValuationSequence"("productId","organizationId","legacyMovementCount")
 SELECT product_key,organization_key,count(*)-(CASE WHEN TG_TABLE_NAME='InventoryMovement' THEN 1 ELSE 0 END)
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
CREATE TRIGGER inventory_valuation_movement AFTER INSERT ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION inventory_valuation_record();
CREATE TRIGGER inventory_valuation_cost AFTER UPDATE OF "costPrice" ON "Product" FOR EACH ROW EXECUTE FUNCTION inventory_valuation_record();
CREATE TRIGGER inventory_valuation_immutable BEFORE UPDATE OR DELETE ON "InventoryValuationEvent" FOR EACH ROW EXECUTE FUNCTION stock_journal_immutable();

CREATE FUNCTION inventory_valuation_sequence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
  RAISE EXCEPTION 'Valuation sequence is immutable' USING ERRCODE='23514';
 END IF;
 IF (NEW."productId",NEW."organizationId",NEW."legacyMovementCount",NEW."initializedAt") IS DISTINCT FROM
    (OLD."productId",OLD."organizationId",OLD."legacyMovementCount",OLD."initializedAt") OR NEW."lastSequence"<>OLD."lastSequence"+1 THEN
  RAISE EXCEPTION 'Valuation sequence must advance once without changing provenance' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER inventory_valuation_sequence_guard BEFORE UPDATE OR DELETE ON "InventoryValuationSequence" FOR EACH ROW EXECUTE FUNCTION inventory_valuation_sequence_guard();
