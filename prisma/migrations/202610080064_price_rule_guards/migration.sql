-- Preserve deliberate whole-organization cascades while keeping snapshots
-- linked and protected during ordinary product/customer/rule deletions.
ALTER TABLE "SaleItem" ALTER CONSTRAINT "SaleItem_priceRuleId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Customer" ALTER CONSTRAINT "Customer_groupId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PriceRule" ALTER CONSTRAINT "PriceRule_productId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PriceRule" ALTER CONSTRAINT "PriceRule_customerId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PriceRule" ALTER CONSTRAINT "PriceRule_groupId_fkey" DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION price_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s "Sale";r "PriceRule";g TEXT;
BEGIN
 SELECT * INTO s FROM "Sale" WHERE id=NEW."saleId";
 IF NEW."priceSnapshot" IS NOT NULL AND (
  NEW."priceSnapshot"->>'version' IS DISTINCT FROM 'price-precedence-v1' OR
  NEW."priceSnapshot"->>'unitPrice' IS DISTINCT FROM to_char(NEW."unitPrice",'FM999999999999990.00') OR
  NEW."priceSnapshot"->>'ruleId' IS DISTINCT FROM NEW."priceRuleId" OR
  NEW."priceSnapshot"->>'storeId' IS DISTINCT FROM s."storeId" OR
  NEW."priceSnapshot"->>'customerId' IS DISTINCT FROM s."customerId") THEN RAISE EXCEPTION 'Invalid canonical price snapshot';END IF;
 IF NEW."priceRuleId" IS NOT NULL AND NEW."priceSnapshot" IS NULL THEN RAISE EXCEPTION 'Price rule requires snapshot';END IF;
 IF TG_OP='INSERT' AND NEW."priceRuleId" IS NOT NULL THEN
  SELECT * INTO r FROM "PriceRule" WHERE id=NEW."priceRuleId";
  IF r.kind='group' THEN
   SELECT "groupId" INTO g FROM "Customer" WHERE id=s."customerId" AND "organizationId"=s."organizationId";
   IF g IS DISTINCT FROM r."groupId" THEN RAISE EXCEPTION 'Price group does not match customer';END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER price_snapshot_guard BEFORE INSERT OR UPDATE ON "SaleItem" FOR EACH ROW EXECUTE FUNCTION price_snapshot_guard();
