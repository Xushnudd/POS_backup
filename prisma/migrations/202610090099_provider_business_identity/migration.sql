-- One unresolved/confirmed external action per business subject and capability,
-- including when a caller changes its operation key or provider name.
CREATE UNIQUE INDEX "ProviderIntent_active_business_key" ON "ProviderIntent"
 ("organizationId",capability,(request->>'businessType'),(request->>'businessId'))
 WHERE "compensatesId" IS NULL AND state<>'failed';
ALTER TABLE "ProviderIntent" ADD CONSTRAINT "ProviderIntent_request_contract_check" CHECK(
 request ? 'businessType' AND request ? 'businessId'
 AND jsonb_typeof(request->'businessType') IS NOT DISTINCT FROM 'string'
 AND jsonb_typeof(request->'businessId') IS NOT DISTINCT FROM 'string'
 AND request->>'businessType' IN ('sale','sale_return','receipt')
 AND request->>'businessId' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 AND (request-ARRAY['businessType','businessId','amount','currency'])='{}'::jsonb
 AND (request ? 'amount')=(request ? 'currency')
 AND (NOT(request ? 'amount') OR (jsonb_typeof(request->'amount') IS NOT DISTINCT FROM 'string'
   AND jsonb_typeof(request->'currency') IS NOT DISTINCT FROM 'string'
   AND request->>'amount' ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$'
   AND request->>'currency' ~ '^[A-Z]{3}$'))
 AND (capability<>'payment' OR (request ? 'amount' AND (request->>'amount')::numeric>0))
);
CREATE FUNCTION provider_business_scope_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.request->>'businessType'='sale_return' THEN
  IF NOT EXISTS(SELECT 1 FROM "SaleReturn" r JOIN "Sale" s ON s.id=r."saleId" WHERE r.id=NEW.request->>'businessId' AND s."organizationId"=NEW."organizationId" AND s."storeId"=NEW."storeId") THEN RAISE EXCEPTION 'Provider return subject scope invalid' USING ERRCODE='23514';END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM "Sale" WHERE id=NEW.request->>'businessId' AND "organizationId"=NEW."organizationId" AND "storeId"=NEW."storeId") THEN RAISE EXCEPTION 'Provider sale subject scope invalid' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER provider_business_scope_guard BEFORE INSERT ON "ProviderIntent" FOR EACH ROW EXECUTE FUNCTION provider_business_scope_guard();
