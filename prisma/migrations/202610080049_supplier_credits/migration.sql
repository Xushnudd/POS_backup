CREATE TABLE "SupplierCredit"(id TEXT PRIMARY KEY,"invoiceId" TEXT NOT NULL REFERENCES "SupplierInvoice"(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('goods_return','price_correction')),amount NUMERIC(14,2) NOT NULL CHECK(amount>=0),reason TEXT NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 2000),"createdBy" TEXT NOT NULL REFERENCES "User"(id) DEFERRABLE INITIALLY DEFERRED,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "SupplierCredit_invoiceId_createdAt_idx" ON "SupplierCredit"("invoiceId","createdAt");
CREATE TABLE "SupplierCreditItem"(id TEXT PRIMARY KEY,"creditId" TEXT NOT NULL REFERENCES "SupplierCredit"(id) ON DELETE CASCADE,"stockDocumentItemId" TEXT NOT NULL REFERENCES "StockDocumentItem"(id) DEFERRABLE INITIALLY DEFERRED,quantity NUMERIC(20,6) NOT NULL CHECK(quantity>=0),amount NUMERIC(14,2) NOT NULL CHECK(amount>=0),UNIQUE("creditId","stockDocumentItemId"));
CREATE INDEX "SupplierCreditItem_stockDocumentItemId_idx" ON "SupplierCreditItem"("stockDocumentItemId");
CREATE TABLE "SupplierAllocationRelease"(id TEXT PRIMARY KEY,"allocationId" TEXT NOT NULL REFERENCES "SupplierAllocation"(id) ON DELETE CASCADE,"creditId" TEXT NOT NULL REFERENCES "SupplierCredit"(id) ON DELETE CASCADE,amount NUMERIC(14,2) NOT NULL CHECK(amount>0),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE("creditId","allocationId"));
CREATE INDEX "SupplierAllocationRelease_allocationId_idx" ON "SupplierAllocationRelease"("allocationId");
CREATE VIEW "SupplierAllocationBalance" AS SELECT a.id,a."invoiceId",a."paymentId",a."createdAt",a.amount-COALESCE((SELECT sum(r.amount) FROM "SupplierAllocationRelease" r WHERE r."allocationId"=a.id),0) AS amount FROM "SupplierAllocation" a;
CREATE VIEW "SupplierInvoiceBalance" AS SELECT i.*,i.amount-COALESCE((SELECT sum(c.amount) FROM "SupplierCredit" c WHERE c."invoiceId"=i.id),0) AS "netAmount",COALESCE((SELECT sum(c.amount) FROM "SupplierCredit" c WHERE c."invoiceId"=i.id),0) AS "creditAmount" FROM "SupplierInvoice" i;
CREATE FUNCTION supplier_credit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE org TEXT; c RECORD; inv RECORD; original RECORD; a RECORD; used_amount NUMERIC; used_qty NUMERIC;
BEGIN
 IF TG_TABLE_NAME='SupplierCredit' THEN SELECT * INTO inv FROM "SupplierInvoice" WHERE id=COALESCE(NEW."invoiceId",OLD."invoiceId") FOR UPDATE;org:=inv."organizationId";
 ELSE SELECT * INTO c FROM "SupplierCredit" WHERE id=COALESCE(NEW."creditId",OLD."creditId");SELECT * INTO inv FROM "SupplierInvoice" WHERE id=c."invoiceId" FOR UPDATE;org:=inv."organizationId"; END IF;
 IF TG_OP<>'INSERT' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=org) THEN RAISE EXCEPTION 'supplier credit immutable' USING ERRCODE='23514';END IF;RETURN OLD;END IF;
 IF TG_TABLE_NAME='SupplierCredit' THEN
  IF inv.id IS NULL OR NEW.amount+COALESCE((SELECT sum(amount) FROM "SupplierCredit" WHERE "invoiceId"=inv.id),0)>inv.amount OR NOT EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "organizationId"=org AND "userId"=NEW."createdBy" AND "isActive" AND role IN ('owner','admin')) THEN RAISE EXCEPTION 'supplier credit original invoice bound' USING ERRCODE='23514';END IF;
 ELSIF TG_TABLE_NAME='SupplierCreditItem' THEN
  SELECT * INTO original FROM "StockDocumentItem" WHERE id=NEW."stockDocumentItemId" FOR UPDATE;
  SELECT COALESCE(sum(amount),0),COALESCE(sum(quantity),0) INTO used_amount,used_qty FROM "SupplierCreditItem" WHERE "stockDocumentItemId"=original.id;
  IF original.id IS NULL OR original."stockDocumentId"<>inv."stockDocumentId" OR used_amount+NEW.amount>round(original.quantity*original."unitCost",2) OR used_qty+NEW.quantity>original.quantity OR (c.kind='goods_return' AND NEW.quantity<=0) OR (c.kind='price_correction' AND (NEW.quantity<>0 OR NEW.amount<=0 OR used_qty>=original.quantity)) THEN RAISE EXCEPTION 'supplier credit original line bound' USING ERRCODE='23514';END IF;
 ELSE
  SELECT * INTO a FROM "SupplierAllocation" WHERE id=NEW."allocationId" FOR UPDATE;
  IF a.id IS NULL OR a."invoiceId"<>inv.id OR NEW.amount+COALESCE((SELECT sum(amount) FROM "SupplierAllocationRelease" WHERE "allocationId"=a.id),0)>a.amount OR NEW.amount+COALESCE((SELECT sum(amount) FROM "SupplierAllocationRelease" WHERE "creditId"=c.id),0)>c.amount THEN RAISE EXCEPTION 'supplier release original allocation bound' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER supplier_credit_immutable BEFORE INSERT OR UPDATE OR DELETE ON "SupplierCredit" FOR EACH ROW EXECUTE FUNCTION supplier_credit_guard();
CREATE TRIGGER supplier_credit_item_immutable BEFORE INSERT OR UPDATE OR DELETE ON "SupplierCreditItem" FOR EACH ROW EXECUTE FUNCTION supplier_credit_guard();
CREATE TRIGGER supplier_release_immutable BEFORE INSERT OR UPDATE OR DELETE ON "SupplierAllocationRelease" FOR EACH ROW EXECUTE FUNCTION supplier_credit_guard();
CREATE FUNCTION supplier_credit_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c RECORD; i RECORD;
BEGIN
 SELECT * INTO c FROM "SupplierCredit" WHERE id=NEW.id;SELECT * INTO i FROM "SupplierInvoiceBalance" WHERE id=c."invoiceId";
 IF EXISTS(SELECT 1 FROM "Organization" WHERE id=i."organizationId") THEN
  IF NOT EXISTS(SELECT 1 FROM "SupplierCreditItem" WHERE "creditId"=c.id) OR c.amount<>(SELECT sum(amount) FROM "SupplierCreditItem" WHERE "creditId"=c.id) OR (SELECT COALESCE(sum(amount),0) FROM "SupplierAllocationBalance" WHERE "invoiceId"=i.id)>i."netAmount" THEN RAISE EXCEPTION 'supplier credit not reconciled' USING ERRCODE='23514';END IF;
  IF c.kind='goods_return' AND EXISTS(SELECT 1 FROM "SupplierCreditItem" ci JOIN "StockDocumentItem" si ON si.id=ci."stockDocumentItemId" WHERE ci."creditId"=c.id AND NOT EXISTS(SELECT 1 FROM "InventoryMovement" m WHERE m."sourceType"='supplier_return' AND m."sourceId"=c.id AND m."productId"=si."productId" AND m."storeId"=i."storeId" AND m."organizationId"=i."organizationId" AND m."quantityDelta"=-ci.quantity AND m."unitCost"=si."unitCost")) THEN RAISE EXCEPTION 'supplier return needs exact stock movement' USING ERRCODE='23514';END IF;
 END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER supplier_credit_reconciled AFTER INSERT ON "SupplierCredit" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION supplier_credit_complete();
CREATE OR REPLACE FUNCTION supplier_ledger_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE invoice RECORD; payment RECORD; org TEXT; BEGIN
 IF TG_TABLE_NAME='SupplierAllocation' THEN
 SELECT * INTO invoice FROM "SupplierInvoice" WHERE id=COALESCE(NEW."invoiceId",OLD."invoiceId") FOR UPDATE;
 SELECT p.*,d.amount AS paid INTO payment FROM "SupplierPayment" p JOIN "FinancialDocument" d ON d.id=p."financialDocumentId" WHERE p.id=COALESCE(NEW."paymentId",OLD."paymentId") FOR UPDATE OF p;
 org=invoice."organizationId";
 ELSE org=COALESCE(NEW."organizationId",OLD."organizationId"); END IF;
 IF TG_OP<>'INSERT' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=org) THEN RAISE EXCEPTION 'Supplier ledger is immutable'; END IF;IF TG_OP='DELETE' THEN RETURN OLD; END IF; END IF;
 IF TG_TABLE_NAME='SupplierInvoice' THEN
 PERFORM id FROM "StockDocument" WHERE id=NEW."stockDocumentId" FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM "StockDocument" d JOIN "Supplier" s ON s.id=d."supplierId" WHERE d.id=NEW."stockDocumentId" AND d."organizationId"=NEW."organizationId" AND d."storeId"=NEW."storeId" AND d."supplierId"=NEW."supplierId" AND s."organizationId"=NEW."organizationId" AND d."documentType"='purchase' AND d.status='confirmed' AND NOT EXISTS(SELECT 1 FROM "StockDocument" r WHERE r."reversalOfId"=d.id) AND NEW.amount=(SELECT sum(round(i.quantity*i."unitCost",2)) FROM "StockDocumentItem" i WHERE i."stockDocumentId"=d.id)) THEN RAISE EXCEPTION 'Supplier invoice scope or amount mismatch'; END IF;
 ELSIF TG_TABLE_NAME='SupplierPayment' THEN
 IF NOT EXISTS(SELECT 1 FROM "FinancialDocument" d JOIN "Supplier" s ON s.id=NEW."supplierId" WHERE d.id=NEW."financialDocumentId" AND d."organizationId"=NEW."organizationId" AND d."storeId"=NEW."storeId" AND d.kind='supplier_payment' AND s."organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'Supplier payment scope mismatch'; END IF;
 ELSE
 IF invoice.id IS NULL OR payment.id IS NULL OR (invoice."organizationId",invoice."storeId",invoice."supplierId") IS DISTINCT FROM (payment."organizationId",payment."storeId",payment."supplierId") OR NEW.amount+COALESCE((SELECT sum(amount) FROM "SupplierAllocationBalance" WHERE "invoiceId"=invoice.id),0)>(invoice.amount-COALESCE((SELECT sum(amount) FROM "SupplierCredit" WHERE "invoiceId"=invoice.id),0)) OR NEW.amount+COALESCE((SELECT sum(amount) FROM "SupplierAllocationBalance" WHERE "paymentId"=payment.id),0)>payment.paid THEN RAISE EXCEPTION 'Supplier allocation exceeds invoice/payment or crosses scope'; END IF;
 END IF; RETURN NEW;
END $$;
