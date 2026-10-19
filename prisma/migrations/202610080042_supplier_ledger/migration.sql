CREATE TABLE "SupplierInvoice"(id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,"storeId" TEXT NOT NULL REFERENCES "Store"(id),"supplierId" TEXT NOT NULL REFERENCES "Supplier"(id),"stockDocumentId" TEXT NOT NULL UNIQUE REFERENCES "StockDocument"(id),amount NUMERIC(14,2) NOT NULL CHECK(amount>0),"referenceNo" TEXT NOT NULL CHECK(length(btrim("referenceNo")) BETWEEN 1 AND 200),reason TEXT NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 2000),"dueAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE("organizationId","supplierId","referenceNo"));
CREATE INDEX "SupplierInvoice_organizationId_storeId_supplierId_createdAt_idx" ON "SupplierInvoice"("organizationId","storeId","supplierId","createdAt");
CREATE TABLE "SupplierPayment"(id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,"storeId" TEXT NOT NULL REFERENCES "Store"(id),"supplierId" TEXT NOT NULL REFERENCES "Supplier"(id),"financialDocumentId" TEXT NOT NULL UNIQUE REFERENCES "FinancialDocument"(id),"referenceNo" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE("organizationId","referenceNo"));
CREATE INDEX "SupplierPayment_organizationId_storeId_supplierId_createdAt_idx" ON "SupplierPayment"("organizationId","storeId","supplierId","createdAt");
CREATE TABLE "SupplierAllocation"(id TEXT PRIMARY KEY,"invoiceId" TEXT NOT NULL REFERENCES "SupplierInvoice"(id) ON DELETE CASCADE,"paymentId" TEXT NOT NULL REFERENCES "SupplierPayment"(id) ON DELETE CASCADE,amount NUMERIC(14,2) NOT NULL CHECK(amount>0),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "SupplierAllocation_invoiceId_idx" ON "SupplierAllocation"("invoiceId");
CREATE INDEX "SupplierAllocation_paymentId_idx" ON "SupplierAllocation"("paymentId");
CREATE FUNCTION supplier_ledger_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE invoice RECORD; payment RECORD; org TEXT; BEGIN
 IF TG_TABLE_NAME='SupplierAllocation' THEN
 SELECT * INTO invoice FROM "SupplierInvoice" WHERE id=COALESCE(NEW."invoiceId",OLD."invoiceId") FOR UPDATE;
 SELECT p.*,d.amount AS paid FROM "SupplierPayment" p JOIN "FinancialDocument" d ON d.id=p."financialDocumentId" WHERE p.id=COALESCE(NEW."paymentId",OLD."paymentId") FOR UPDATE OF p;
 org=invoice."organizationId";
 ELSE org=COALESCE(NEW."organizationId",OLD."organizationId"); END IF;
 IF TG_OP<>'INSERT' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=org) THEN RAISE EXCEPTION 'Supplier ledger is immutable'; END IF;IF TG_OP='DELETE' THEN RETURN OLD; END IF; END IF;
 IF TG_TABLE_NAME='SupplierInvoice' THEN
 IF NOT EXISTS(SELECT 1 FROM "StockDocument" d JOIN "Supplier" s ON s.id=d."supplierId" WHERE d.id=NEW."stockDocumentId" AND d."organizationId"=NEW."organizationId" AND d."storeId"=NEW."storeId" AND d."supplierId"=NEW."supplierId" AND s."organizationId"=NEW."organizationId" AND d."documentType"='purchase' AND d.status='confirmed' AND NOT EXISTS(SELECT 1 FROM "StockDocument" r WHERE r."reversalOfId"=d.id) AND NEW.amount=(SELECT sum(round(i.quantity*i."unitCost",2)) FROM "StockDocumentItem" i WHERE i."stockDocumentId"=d.id)) THEN RAISE EXCEPTION 'Supplier invoice scope or amount mismatch'; END IF;
 ELSIF TG_TABLE_NAME='SupplierPayment' THEN
 IF NOT EXISTS(SELECT 1 FROM "FinancialDocument" d JOIN "Supplier" s ON s.id=NEW."supplierId" WHERE d.id=NEW."financialDocumentId" AND d."organizationId"=NEW."organizationId" AND d."storeId"=NEW."storeId" AND d.kind='supplier_payment' AND s."organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'Supplier payment scope mismatch'; END IF;
 ELSE
 IF invoice.id IS NULL OR payment.id IS NULL OR (invoice."organizationId",invoice."storeId",invoice."supplierId") IS DISTINCT FROM (payment."organizationId",payment."storeId",payment."supplierId") OR NEW.amount+COALESCE((SELECT sum(amount) FROM "SupplierAllocation" WHERE "invoiceId"=invoice.id),0)>invoice.amount OR NEW.amount+COALESCE((SELECT sum(amount) FROM "SupplierAllocation" WHERE "paymentId"=payment.id),0)>payment.paid THEN RAISE EXCEPTION 'Supplier allocation exceeds invoice/payment or crosses scope'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER supplier_invoice_guard BEFORE INSERT OR UPDATE OR DELETE ON "SupplierInvoice" FOR EACH ROW EXECUTE FUNCTION supplier_ledger_guard();
CREATE TRIGGER supplier_payment_guard BEFORE INSERT OR UPDATE OR DELETE ON "SupplierPayment" FOR EACH ROW EXECUTE FUNCTION supplier_ledger_guard();
CREATE TRIGGER supplier_allocation_guard BEFORE INSERT OR UPDATE OR DELETE ON "SupplierAllocation" FOR EACH ROW EXECUTE FUNCTION supplier_ledger_guard();
CREATE FUNCTION supplier_invoice_stock_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."reversalOfId" IS NOT NULL AND EXISTS(SELECT 1 FROM "SupplierInvoice" WHERE "stockDocumentId"=NEW."reversalOfId") THEN RAISE EXCEPTION 'Tracked purchase needs a linked supplier return'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER supplier_invoice_stock_guard BEFORE INSERT ON "StockDocument" FOR EACH ROW EXECUTE FUNCTION supplier_invoice_stock_guard();
