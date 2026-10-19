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
 IF invoice.id IS NULL OR payment.id IS NULL OR (invoice."organizationId",invoice."storeId",invoice."supplierId") IS DISTINCT FROM (payment."organizationId",payment."storeId",payment."supplierId") OR NEW.amount+COALESCE((SELECT sum(amount) FROM "SupplierAllocation" WHERE "invoiceId"=invoice.id),0)>invoice.amount OR NEW.amount+COALESCE((SELECT sum(amount) FROM "SupplierAllocation" WHERE "paymentId"=payment.id),0)>payment.paid THEN RAISE EXCEPTION 'Supplier allocation exceeds invoice/payment or crosses scope'; END IF;
 END IF; RETURN NEW;
END $$;
