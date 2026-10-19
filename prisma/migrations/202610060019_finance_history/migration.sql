BEGIN;
ALTER TABLE "SaleReturn" ADD COLUMN "approvedBy" TEXT, ADD COLUMN "approvedRole" TEXT, ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_approval_check" CHECK (
 ("approvedBy" IS NULL AND "approvedRole" IS NULL AND "approvedAt" IS NULL) OR
 ("approvedBy" IS NOT NULL AND "approvedBy"="processedBy" AND "approvedRole" IN ('owner','admin') AND "approvedAt" IS NOT NULL));
-- Legacy approvals stay unknown; no fabricated historical approver.
ALTER TABLE "CashMovement" DROP CONSTRAINT "CashMovement_amount_check";
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_amount_check" CHECK(amount>0 AND "movementType" IN ('cash_in','cash_out','bank_deposit','collection','correction_in','correction_out'));
CREATE TABLE "ShiftCorrection" (
 id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 "originalShiftId" TEXT NOT NULL REFERENCES "Shift"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 "postingShiftId" TEXT NOT NULL REFERENCES "Shift"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 "cashMovementId" TEXT NOT NULL REFERENCES "CashMovement"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 amount NUMERIC(14,2) NOT NULL CHECK(amount<>0), reason TEXT NOT NULL CHECK(length(trim(reason))>=3),
 "createdBy" TEXT NOT NULL REFERENCES "User"(id) ON UPDATE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ShiftCorrection_cashMovementId_key" ON "ShiftCorrection"("cashMovementId");
CREATE INDEX "ShiftCorrection_organizationId_originalShiftId_createdAt_idx" ON "ShiftCorrection"("organizationId","originalShiftId","createdAt");

CREATE FUNCTION guard_closed_shift() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='closed' AND EXISTS(SELECT 1 FROM "Organization" o WHERE o.id IN (
  SELECT u."organizationId" FROM "OrganizationUser" u WHERE u.id=OLD."organizationUserId"
  UNION SELECT s."organizationId" FROM "Register" r JOIN "Store" s ON s.id=r."storeId" WHERE r.id=OLD."registerId"
 )) THEN RAISE EXCEPTION 'Closed shift is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Shift_closed_immutable" BEFORE UPDATE OR DELETE ON "Shift" FOR EACH ROW EXECUTE FUNCTION guard_closed_shift();

CREATE FUNCTION guard_closed_cash_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_shift TEXT; new_shift TEXT; parent RECORD;
BEGIN
 IF TG_OP<>'INSERT' THEN old_shift=OLD."shiftId"; END IF;
 IF TG_OP<>'DELETE' THEN new_shift=NEW."shiftId"; END IF;
 FOR parent IN SELECT s.status,r."storeId" FROM "Shift" s JOIN "Register" r ON r.id=s."registerId"
  WHERE s.id IN(old_shift,new_shift) ORDER BY s.id FOR UPDATE OF s
 LOOP
  IF parent.status='closed' AND EXISTS(SELECT 1 FROM "Store" s JOIN "Organization" o ON o.id=s."organizationId" WHERE s.id=parent."storeId") THEN
   RAISE EXCEPTION 'Closed shift journal is immutable' USING ERRCODE='23514';
  END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "CashMovement_closed_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "CashMovement" FOR EACH ROW EXECUTE FUNCTION guard_closed_cash_journal();
CREATE TRIGGER "Payment_closed_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION guard_closed_cash_journal();

CREATE FUNCTION guard_shift_correction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN
  RAISE EXCEPTION 'Shift correction is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='INSERT' AND NOT EXISTS(
  SELECT 1 FROM "Shift" original JOIN "Register" a ON a.id=original."registerId" JOIN "Store" store ON store.id=a."storeId"
  JOIN "Shift" posting ON posting.id=NEW."postingShiftId" JOIN "Register" b ON b.id=posting."registerId"
  JOIN "CashMovement" m ON m.id=NEW."cashMovementId"
  JOIN "OrganizationUser" actor ON actor."organizationId"=NEW."organizationId" AND actor."userId"=NEW."createdBy"
  WHERE original.id=NEW."originalShiftId" AND original.status='closed' AND posting.status='open'
   AND a."storeId"=b."storeId" AND store."organizationId"=NEW."organizationId" AND actor.role IN ('owner','admin') AND actor."isActive"
   AND m."shiftId"=posting.id AND m."createdBy"=NEW."createdBy" AND m.amount=abs(NEW.amount)
   AND m.reason=NEW.reason AND m."movementType"=CASE WHEN NEW.amount>0 THEN 'correction_in' ELSE 'correction_out' END
 ) THEN RAISE EXCEPTION 'Invalid shift correction relation' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ShiftCorrection_immutable_scope" BEFORE INSERT OR UPDATE OR DELETE ON "ShiftCorrection" FOR EACH ROW EXECUTE FUNCTION guard_shift_correction();

CREATE FUNCTION guard_return_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "Sale" s JOIN "Organization" o ON o.id=s."organizationId" WHERE s.id=OLD."saleId") THEN
  RAISE EXCEPTION 'Return history is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "SaleReturn_immutable" BEFORE UPDATE OR DELETE ON "SaleReturn" FOR EACH ROW EXECUTE FUNCTION guard_return_history();
CREATE FUNCTION guard_return_item_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent RECORD; old_parent TEXT; new_parent TEXT;
BEGIN
 IF TG_OP<>'INSERT' THEN old_parent=OLD."saleReturnId"; END IF;
 IF TG_OP<>'DELETE' THEN new_parent=NEW."saleReturnId"; END IF;
 FOR parent IN SELECT r.id,r.xmin AS version,s."organizationId" FROM "SaleReturn" r JOIN "Sale" s ON s.id=r."saleId" WHERE r.id IN(old_parent,new_parent) ORDER BY r.id FOR UPDATE OF r
 LOOP
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=parent."organizationId") AND
   (TG_OP<>'INSERT' OR parent.version<>pg_current_xact_id()::text::xid) THEN
   RAISE EXCEPTION 'Return items are immutable' USING ERRCODE='23514';
  END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "SaleReturnItem_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "SaleReturnItem" FOR EACH ROW EXECUTE FUNCTION guard_return_item_history();
COMMIT;
