BEGIN;
CREATE FUNCTION return_effective_cost_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original_cost numeric; applied_cost numeric; application_id text; tenant_id text;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW."unitCostSnapshot" IS DISTINCT FROM OLD."unitCostSnapshot" OR NEW."costApplicationId" IS DISTINCT FROM OLD."costApplicationId" THEN RAISE EXCEPTION 'Return cost source is immutable' USING ERRCODE='23514';END IF;
  RETURN NEW;
 END IF;
 SELECT i."unitCost",s."organizationId" INTO original_cost,tenant_id FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" WHERE i.id=NEW."saleItemId" AND i."productId"=NEW."productId";
 IF tenant_id IS NULL THEN RAISE EXCEPTION 'Return original cost source missing' USING ERRCODE='23514';END IF;
 SELECT a.id,(issue->>'unitCost')::numeric INTO application_id,applied_cost FROM "ReceiptCostApplication" a CROSS JOIN LATERAL jsonb_array_elements(a.snapshot->'products') product CROSS JOIN LATERAL jsonb_array_elements(product->'issueCosts') issue WHERE a."organizationId"=tenant_id AND product->>'productId'=NEW."productId" AND issue->>'itemId'=NEW."saleItemId" ORDER BY a.ordinal DESC LIMIT 1;
 IF application_id IS NOT NULL THEN
  IF NEW."costApplicationId" IS DISTINCT FROM application_id OR NEW."unitCostSnapshot" IS DISTINCT FROM applied_cost THEN RAISE EXCEPTION 'Return must use latest effective original issue cost' USING ERRCODE='23514';END IF;
 ELSIF NEW."costApplicationId" IS NOT NULL OR (NEW."unitCostSnapshot" IS NOT NULL AND NEW."unitCostSnapshot" IS DISTINCT FROM original_cost) THEN RAISE EXCEPTION 'Return cost differs from original issue' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER return_effective_cost_guard BEFORE INSERT OR UPDATE ON "SaleReturnItem" FOR EACH ROW EXECUTE FUNCTION return_effective_cost_guard();
COMMIT;
