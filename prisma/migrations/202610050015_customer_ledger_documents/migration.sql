BEGIN;
-- DropForeignKey
ALTER TABLE "DebtEntry" DROP CONSTRAINT "DebtEntry_customerId_fkey";

-- AlterTable
ALTER TABLE "DebtEntry" ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "DebtEntry" ADD CONSTRAINT "DebtEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;


UPDATE "DebtEntry" SET "effectiveAt"="createdAt";
ALTER TABLE "DebtEntry" ADD CONSTRAINT "DebtEntry_actor" FOREIGN KEY("actorId") REFERENCES "User"(id);
ALTER TABLE "DebtEntry" ADD CONSTRAINT "DebtEntry_document_sign" CHECK (("sourceType" NOT IN ('opening_debt','write_off','write_off_reversal','debt_adjustment')) OR ("sourceType"='opening_debt' AND amount>0) OR ("sourceType"='write_off' AND amount<0) OR ("sourceType"='write_off_reversal' AND amount>0) OR ("sourceType"='debt_adjustment' AND amount<>0));
CREATE INDEX "DebtEntry_statement" ON "DebtEntry"("organizationId","customerId","effectiveAt",id);
CREATE FUNCTION guard_customer_ledger_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN
  RAISE EXCEPTION 'Customer ledger is append-only' USING ERRCODE='23514';
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER "DebtEntry_history" BEFORE UPDATE OR DELETE ON "DebtEntry" FOR EACH ROW EXECUTE FUNCTION guard_customer_ledger_history();

COMMIT;
