-- Approved policy: negative stock cannot be enabled. Preserve historical balances.
BEGIN;
INSERT INTO "AuditLog" (id,"organizationId","entityType","entityId",action,"beforeData","afterData","createdAt")
SELECT gen_random_uuid()::text,id,'Organization',id,'negative_stock_policy_disabled',
       '{"allowNegativeStock":true}'::jsonb,
       '{"allowNegativeStock":false,"decision":"ADR-083"}'::jsonb,CURRENT_TIMESTAMP
FROM "Organization" WHERE "allowNegativeStock";
UPDATE "Organization" SET "allowNegativeStock"=false WHERE "allowNegativeStock";
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_negative_stock_disabled" CHECK (NOT "allowNegativeStock");

CREATE FUNCTION negative_inventory_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.quantity < 0 THEN
    IF TG_OP='INSERT' THEN
      RAISE EXCEPTION 'Negative stock is disabled' USING ERRCODE='23514';
    ELSIF NEW.quantity < OLD.quantity OR OLD.quantity >= 0
       OR NEW."storeId" IS DISTINCT FROM OLD."storeId"
       OR NEW."productId" IS DISTINCT FROM OLD."productId" THEN
      RAISE EXCEPTION 'Negative stock is disabled' USING ERRCODE='23514';
    END IF;
  END IF;
  -- Legacy negatives may only stay unchanged or increase towards zero.
  RETURN NEW;
END $$;
CREATE TRIGGER "InventoryBalance_negative_disabled" BEFORE INSERT OR UPDATE ON "InventoryBalance"
FOR EACH ROW EXECUTE FUNCTION negative_inventory_guard();
COMMIT;
