-- Cash entries are immutable mirrors, so the linked cash journal must not drift.
CREATE FUNCTION financial_cash_mirror_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM "AccountEntry" e JOIN "Organization" o ON o.id=e."organizationId" WHERE e."cashMovementId"=OLD.id) THEN
 RAISE EXCEPTION 'Posted account cash movement is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER financial_cash_mirror_immutable BEFORE UPDATE OR DELETE ON "CashMovement" FOR EACH ROW EXECUTE FUNCTION financial_cash_mirror_immutable();
