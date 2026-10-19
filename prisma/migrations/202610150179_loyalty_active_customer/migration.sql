BEGIN;
-- A quote may be cancelled after customer archival, but it may not be newly
-- prepared or posted for an inactive/merged customer. Share-lock the actual
-- customer so archival/merge cannot race checkout.
CREATE FUNCTION pos_loyalty_benefit_customer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE customer "Customer";selection "LoyaltyBenefitSelection";
BEGIN
 IF TG_TABLE_NAME='Sale' THEN
  IF NEW.status<>'completed' OR OLD.status=NEW.status THEN RETURN NEW;END IF;
  SELECT * INTO selection FROM "LoyaltyBenefitSelection" WHERE "saleId"=NEW.id AND state='prepared';
  IF selection.id IS NULL THEN RETURN NEW;END IF;
 ELSE selection:=NEW;END IF;
 SELECT * INTO customer FROM "Customer" WHERE id=selection."customerId" FOR SHARE;
 IF customer.id IS NULL OR customer."organizationId"<>selection."organizationId" OR NOT customer."isActive" OR customer."mergedIntoId" IS NOT NULL THEN
  RAISE EXCEPTION 'LOYALTY_SALE_CHANGED' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER loyalty_benefit_customer_guard BEFORE INSERT ON "LoyaltyBenefitSelection" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_benefit_customer_guard();
CREATE TRIGGER loyalty_benefit_customer_guard BEFORE UPDATE OF status ON "Sale" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_benefit_customer_guard();
COMMIT;
