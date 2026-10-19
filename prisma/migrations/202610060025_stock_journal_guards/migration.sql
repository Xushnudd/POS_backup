-- Existing legacy rows remain visible; future postings must have usable sources.
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_posting_check"
 CHECK ("quantityDelta"<>0 AND "unitCost">=0 AND length(trim("sourceType"))>0 AND length(trim("sourceId"))>0) NOT VALID;
CREATE FUNCTION stock_journal_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Stock journal is immutable; post a reversal document';
END $$;
CREATE TRIGGER stock_journal_immutable BEFORE UPDATE OR DELETE ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION stock_journal_immutable();
