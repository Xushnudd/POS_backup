BEGIN;
ALTER TABLE "Product" ADD COLUMN "batchTracking" boolean NOT NULL DEFAULT false,
 ADD COLUMN "expiryAlertDays" integer NOT NULL DEFAULT 30 CHECK ("expiryAlertDays" BETWEEN 0 AND 3650);
ALTER TABLE "StockDocumentItem" ADD COLUMN "batchInput" jsonb;
CREATE TABLE "InventoryBatch" (
 id text PRIMARY KEY, "organizationId" text NOT NULL, "productId" text NOT NULL,
 code text NOT NULL CHECK(length(code) BETWEEN 1 AND 100), "receivedOn" text NOT NULL, "expiresOn" text NOT NULL,
 "originItemId" text NOT NULL UNIQUE REFERENCES "StockDocumentItem"(id) ON DELETE NO ACTION,
 "createdBy" text NOT NULL REFERENCES "User"(id), "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("productId","organizationId") REFERENCES "Product"(id,"organizationId") ON DELETE CASCADE,
 UNIQUE("productId",code), CHECK("receivedOn" <= "expiresOn"),
 CHECK("receivedOn" ~ '^\d{4}-\d{2}-\d{2}$' AND "expiresOn" ~ '^\d{4}-\d{2}-\d{2}$')
);
CREATE INDEX "InventoryBatch_organizationId_expiresOn_id_idx" ON "InventoryBatch"("organizationId","expiresOn",id);
CREATE TABLE "InventoryBatchEntry" (
 id text PRIMARY KEY, "organizationId" text NOT NULL, "batchId" text NOT NULL REFERENCES "InventoryBatch"(id) ON DELETE CASCADE,
 "storeId" text NOT NULL REFERENCES "Store"(id) ON DELETE CASCADE,
 "movementId" text NOT NULL REFERENCES "InventoryMovement"(id) ON DELETE CASCADE,
 "quantityDelta" numeric(20,6) NOT NULL CHECK("quantityDelta"<>0),
 "sourceEntryId" text REFERENCES "InventoryBatchEntry"(id) ON DELETE NO ACTION,
 "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("movementId","batchId")
);
CREATE INDEX "InventoryBatchEntry_organizationId_storeId_batchId_idx" ON "InventoryBatchEntry"("organizationId","storeId","batchId");
CREATE FUNCTION batch_policy_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW."batchTracking" THEN
  RAISE EXCEPTION 'Enable batch tracking through reviewed empty-stock policy' USING ERRCODE='23514';
 ELSIF TG_OP='UPDATE' AND NEW."batchTracking" IS DISTINCT FROM OLD."batchTracking" THEN
  IF NOT NEW."batchTracking" OR EXISTS(SELECT 1 FROM "InventoryMovement" WHERE "productId"=NEW.id)
   OR EXISTS(SELECT 1 FROM "InventoryBalance" WHERE "productId"=NEW.id AND quantity<>0)
   OR EXISTS(SELECT 1 FROM "StockTransferItem" WHERE "productId"=NEW.id)
   OR EXISTS(SELECT 1 FROM "SaleItem" WHERE "productId"=NEW.id)
  THEN RAISE EXCEPTION 'Batch tracking requires unused product' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER batch_policy_guard BEFORE INSERT OR UPDATE ON "Product" FOR EACH ROW EXECUTE FUNCTION batch_policy_guard();
CREATE FUNCTION batch_definition_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item "StockDocumentItem"; document "StockDocument";
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Batch metadata is immutable' USING ERRCODE='23514';END IF;
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") AND EXISTS(SELECT 1 FROM "Product" WHERE id=OLD."productId") THEN RAISE EXCEPTION 'Batch history is immutable' USING ERRCODE='23514';END IF;
  RETURN OLD;
 END IF;
 SELECT * INTO item FROM "StockDocumentItem" WHERE id=NEW."originItemId";
 SELECT * INTO document FROM "StockDocument" WHERE id=item."stockDocumentId";
 IF item.id IS NULL OR item."productId"<>NEW."productId" OR document."organizationId"<>NEW."organizationId"
  OR item.quantity<=0 OR document."documentType" NOT IN ('purchase','opening','adjustment','return_in')
  OR NOT EXISTS(SELECT 1 FROM "Product" WHERE id=NEW."productId" AND "batchTracking")
  OR item."batchInput"->>'code' IS DISTINCT FROM NEW.code
  OR item."batchInput"->>'receivedOn' IS DISTINCT FROM NEW."receivedOn"
  OR item."batchInput"->>'expiresOn' IS DISTINCT FROM NEW."expiresOn"
  OR to_char(NEW."receivedOn"::date,'YYYY-MM-DD')<>NEW."receivedOn"
  OR to_char(NEW."expiresOn"::date,'YYYY-MM-DD')<>NEW."expiresOn"
 THEN RAISE EXCEPTION 'Batch origin does not match original receipt' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER batch_definition_guard BEFORE INSERT OR UPDATE OR DELETE ON "InventoryBatch" FOR EACH ROW EXECUTE FUNCTION batch_definition_guard();
CREATE FUNCTION batch_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE movement "InventoryMovement"; batch "InventoryBatch"; source "InventoryBatchEntry";
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Batch journal is immutable' USING ERRCODE='23514';END IF;
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") AND EXISTS(SELECT 1 FROM "InventoryMovement" WHERE id=OLD."movementId") THEN RAISE EXCEPTION 'Batch journal is immutable' USING ERRCODE='23514';END IF;
  RETURN OLD;
 END IF;
 SELECT * INTO movement FROM "InventoryMovement" WHERE id=NEW."movementId";
 SELECT * INTO batch FROM "InventoryBatch" WHERE id=NEW."batchId";
 IF movement.id IS NULL OR batch.id IS NULL OR movement."productId"<>batch."productId"
  OR movement."organizationId"<>NEW."organizationId" OR batch."organizationId"<>NEW."organizationId"
  OR movement."storeId"<>NEW."storeId" OR sign(movement."quantityDelta")<>sign(NEW."quantityDelta")
 THEN RAISE EXCEPTION 'Batch movement scope mismatch' USING ERRCODE='23514';END IF;
 IF NEW."sourceEntryId" IS NOT NULL THEN
  SELECT * INTO source FROM "InventoryBatchEntry" WHERE id=NEW."sourceEntryId";
  IF source."batchId"<>NEW."batchId" OR source."organizationId"<>NEW."organizationId" OR source."quantityDelta">=0 OR NEW."quantityDelta"<=0
   THEN RAISE EXCEPTION 'Batch restore source invalid' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER batch_entry_guard BEFORE INSERT OR UPDATE OR DELETE ON "InventoryBatchEntry" FOR EACH ROW EXECUTE FUNCTION batch_entry_guard();
CREATE FUNCTION batch_conservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE product_id text;
BEGIN
 IF TG_TABLE_NAME='InventoryBatchEntry' THEN SELECT "productId" INTO product_id FROM "InventoryBatch" WHERE id=COALESCE(NEW."batchId",OLD."batchId");
 ELSE product_id:=COALESCE(NEW."productId",OLD."productId");END IF;
 IF NOT EXISTS(SELECT 1 FROM "Product" WHERE id=product_id AND "batchTracking") THEN RETURN NULL;END IF;
 IF EXISTS(SELECT 1 FROM "InventoryMovement" m WHERE m."productId"=product_id AND m."quantityDelta"<>(SELECT COALESCE(sum(e."quantityDelta"),0) FROM "InventoryBatchEntry" e WHERE e."movementId"=m.id))
 OR EXISTS(SELECT 1 FROM "InventoryBalance" b WHERE b."productId"=product_id AND b.quantity<>(SELECT COALESCE(sum(e."quantityDelta"),0) FROM "InventoryBatchEntry" e JOIN "InventoryBatch" x ON x.id=e."batchId" WHERE x."productId"=product_id AND e."storeId"=b."storeId"))
 OR EXISTS(SELECT 1 FROM "InventoryBatchEntry" e JOIN "InventoryBatch" x ON x.id=e."batchId" WHERE x."productId"=product_id GROUP BY e."batchId",e."storeId" HAVING sum(e."quantityDelta")<0)
 OR EXISTS(SELECT 1 FROM "InventoryBatchEntry" e JOIN "InventoryBatch" x ON x.id=e."batchId" WHERE x."productId"=product_id AND NOT EXISTS(SELECT 1 FROM "InventoryBalance" b WHERE b."productId"=product_id AND b."storeId"=e."storeId"))
 OR EXISTS(SELECT 1 FROM "InventoryBatchEntry" source JOIN "InventoryBatchEntry" restored ON restored."sourceEntryId"=source.id JOIN "InventoryBatch" x ON x.id=source."batchId" WHERE x."productId"=product_id GROUP BY source.id,source."quantityDelta" HAVING sum(restored."quantityDelta")>-source."quantityDelta")
 THEN RAISE EXCEPTION 'Batch journal does not conserve physical stock or source quantity' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER batch_conservation_entry AFTER INSERT OR UPDATE OR DELETE ON "InventoryBatchEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION batch_conservation_guard();
CREATE CONSTRAINT TRIGGER batch_conservation_movement AFTER INSERT OR UPDATE OR DELETE ON "InventoryMovement" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION batch_conservation_guard();
CREATE CONSTRAINT TRIGGER batch_conservation_balance AFTER INSERT OR UPDATE OR DELETE ON "InventoryBalance" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION batch_conservation_guard();
COMMIT;
