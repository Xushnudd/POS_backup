-- Derived valuation order can only be captured by the original Product or
-- InventoryMovement trigger. ORM/raw top-level writes cannot fabricate history.
CREATE OR REPLACE FUNCTION inventory_valuation_sequence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
  RAISE EXCEPTION 'Valuation sequence is immutable' USING ERRCODE='23514';
 END IF;
 IF pg_trigger_depth()<2 THEN RAISE EXCEPTION 'Valuation order requires original posting capture' USING ERRCODE='23514';END IF;
 IF TG_OP='INSERT' THEN
  IF NEW."lastSequence"<>0 THEN RAISE EXCEPTION 'Valuation order must start at zero' USING ERRCODE='23514';END IF;
  RETURN NEW;
 END IF;
 IF (NEW."productId",NEW."organizationId",NEW."legacyMovementCount",NEW."initializedAt") IS DISTINCT FROM
    (OLD."productId",OLD."organizationId",OLD."legacyMovementCount",OLD."initializedAt") OR NEW."lastSequence"<>OLD."lastSequence"+1 THEN
  RAISE EXCEPTION 'Valuation sequence must advance once without changing provenance' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER inventory_valuation_sequence_insert_guard BEFORE INSERT ON "InventoryValuationSequence" FOR EACH ROW EXECUTE FUNCTION inventory_valuation_sequence_guard();
CREATE FUNCTION inventory_valuation_event_capture_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF pg_trigger_depth()<2 OR NOT EXISTS(SELECT 1 FROM "InventoryValuationSequence" s WHERE s."productId"=NEW."productId" AND s."organizationId"=NEW."organizationId" AND s."lastSequence"=NEW.sequence) THEN
  RAISE EXCEPTION 'Valuation event requires original posting capture' USING ERRCODE='23514';
 END IF;
 IF NEW.kind='movement' AND NOT EXISTS(SELECT 1 FROM "InventoryMovement" m WHERE m.id=NEW."movementId" AND
  (m."organizationId",m."productId",m."storeId",m."quantityDelta",m."unitCost",m."createdBy",m."sourceType",m."sourceId")=
  (NEW."organizationId",NEW."productId",NEW."storeId",NEW."quantityDelta",NEW."unitCost",NEW."actorId",NEW."sourceType",NEW."sourceId")) THEN
  RAISE EXCEPTION 'Valuation movement snapshot mismatch' USING ERRCODE='23514';
 END IF;
 IF NEW.kind='cost_change' AND NOT EXISTS(SELECT 1 FROM "Product" p WHERE p.id=NEW."productId" AND p."organizationId"=NEW."organizationId" AND p."costPrice"=NEW."afterUnitCost") THEN
  RAISE EXCEPTION 'Valuation cost snapshot mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER inventory_valuation_event_capture_guard BEFORE INSERT ON "InventoryValuationEvent" FOR EACH ROW EXECUTE FUNCTION inventory_valuation_event_capture_guard();
