BEGIN;
-- Old signed offline cash v1 receipts contain no reward-policy snapshot.
-- Replaying them must preserve their original contract, including an allowed
-- read-only owner reconciliation, without inferring a new reward promise.
DO $$ DECLARE source text;needle text:='IF NEW.status<>''completed'' OR OLD.status=''completed'' OR NEW."customerId" IS NULL THEN RETURN NEW;END IF;';BEGIN
 source:=pg_get_functiondef('pos_loyalty_earn_from_sale()'::regprocedure);
 IF strpos(source,needle)=0 THEN RAISE EXCEPTION 'Unreviewed loyalty source function';END IF;
 source:=replace(source,needle,'IF NEW.status<>''completed'' OR OLD.status=''completed'' OR NEW."customerId" IS NULL OR EXISTS(SELECT 1 FROM "OfflineCashLease" WHERE "saleId"=NEW.id AND state=''consumed'') OR NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=NEW."organizationId" AND "currencyCode"=''UZS'') THEN RETURN NEW;END IF;');
 EXECUTE source;
END $$;
DO $$ DECLARE source text;needle text:='SELECT * INTO sale FROM "Sale" WHERE id=NEW."saleId";';BEGIN
 source:=pg_get_functiondef('pos_loyalty_lot_guard()'::regprocedure);
 IF strpos(source,needle)=0 THEN RAISE EXCEPTION 'Unreviewed loyalty grant function';END IF;
 source:=replace(source,needle,needle||' IF EXISTS(SELECT 1 FROM "OfflineCashLease" WHERE "saleId"=NEW."saleId" AND state=''consumed'') OR NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=NEW."organizationId" AND "currencyCode"=''UZS'') THEN RAISE EXCEPTION ''LOYALTY_SOURCE_UNSUPPORTED'' USING ERRCODE=''23514'';END IF;');
 EXECUTE source;
END $$;
CREATE FUNCTION pos_loyalty_policy_currency_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=NEW."organizationId" AND "currencyCode"='UZS') THEN RAISE EXCEPTION 'LOYALTY_CURRENCY_UNSUPPORTED' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER loyalty_policy_currency BEFORE INSERT ON "LoyaltyPolicyVersion" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_policy_currency_guard();
COMMIT;
