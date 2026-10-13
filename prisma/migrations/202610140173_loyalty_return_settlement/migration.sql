BEGIN;
-- Restore and clawback are separate deferred effects. Settle only after both,
-- so an existing credit clears recovery debt once, before that credit expires.
DO $$ DECLARE source text;needle text:='PERFORM pos_loyalty_settle_recovery(sale.id,NEW.id);';BEGIN
 source:=pg_get_functiondef('pos_loyalty_restore_redeemed()'::regprocedure);
 IF strpos(source,needle)=0 THEN RAISE EXCEPTION 'Unreviewed loyalty restore source';END IF;
 source:=replace(source,needle,'');EXECUTE source;
END $$;
CREATE FUNCTION pos_loyalty_settle_return() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='completed' AND (EXISTS(SELECT 1 FROM "LoyaltyPointLot" WHERE "saleId"=NEW."saleId") OR EXISTS(SELECT 1 FROM "LoyaltyRedemption" WHERE "saleId"=NEW."saleId" AND state='posted')) THEN
  PERFORM pos_loyalty_settle_recovery(NEW."saleId",NEW.id);
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER zz_loyalty_settle_return AFTER INSERT ON "SaleReturn" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_loyalty_settle_return();
COMMIT;
