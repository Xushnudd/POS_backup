BEGIN;
CREATE FUNCTION guard_correction_cash() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "ShiftCorrection" c JOIN "Organization" o ON o.id=c."organizationId" WHERE c."cashMovementId"=OLD.id) THEN
  RAISE EXCEPTION 'Correction cash is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "CashMovement_correction_immutable" BEFORE UPDATE OR DELETE ON "CashMovement" FOR EACH ROW EXECUTE FUNCTION guard_correction_cash();
CREATE FUNCTION check_correction_cash_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "CashMovement" m WHERE m.id=NEW.id AND m."movementType" IN ('correction_in','correction_out')) AND NOT EXISTS(
  SELECT 1 FROM "ShiftCorrection" c WHERE c."cashMovementId"=NEW.id
 ) THEN RAISE EXCEPTION 'Correction cash requires its document' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "CashMovement_correction_document" AFTER INSERT OR UPDATE ON "CashMovement" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_correction_cash_link();
COMMIT;
