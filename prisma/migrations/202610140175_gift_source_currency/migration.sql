BEGIN;
CREATE FUNCTION pos_gift_source_currency_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='Organization' THEN
  IF NEW."currencyCode" IS DISTINCT FROM OLD."currencyCode" AND EXISTS(SELECT 1 FROM "GiftCertificate" WHERE "organizationId"=OLD.id) THEN RAISE EXCEPTION 'LOYALTY_CURRENCY_UNSUPPORTED' USING ERRCODE='23514';END IF;
 ELSE
  -- A certificate is issued with its real cash source in this transaction.
  -- Do not backdate/forward-date the issuance or relabel an old cash receipt.
  IF NOT EXISTS(SELECT 1 FROM "CustomerAdvance" a JOIN "FinancialDocument" d ON d.id=a."documentId" WHERE a.id=NEW."advanceId" AND a."organizationId"=NEW."organizationId" AND a."createdAt"=transaction_timestamp()::timestamp(3) AND d."createdAt"=a."createdAt" AND d."actorId"=NEW."createdBy") THEN RAISE EXCEPTION 'GIFT_ISSUE_INVALID' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER gift_source_currency_guard BEFORE INSERT ON "GiftCertificate" FOR EACH ROW EXECUTE FUNCTION pos_gift_source_currency_guard();
CREATE TRIGGER gift_currency_guard BEFORE UPDATE OF "currencyCode" ON "Organization" FOR EACH ROW EXECUTE FUNCTION pos_gift_source_currency_guard();
COMMIT;
