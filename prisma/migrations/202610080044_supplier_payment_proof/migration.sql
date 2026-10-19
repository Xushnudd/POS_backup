CREATE FUNCTION supplier_payment_proof() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."referenceNo" IS NOT NULL AND length(btrim(NEW."referenceNo")) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Invalid supplier payment proof'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "AccountEntry" e JOIN "FinancialAccount" a ON a.id=e."accountId" WHERE e."documentId"=NEW."financialDocumentId" AND (a.kind='cash' OR NEW."referenceNo" IS NOT NULL)) THEN RAISE EXCEPTION 'Supplier payment requires cash journal or manual bank proof'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER supplier_payment_proof BEFORE INSERT ON "SupplierPayment" FOR EACH ROW EXECUTE FUNCTION supplier_payment_proof();
CREATE OR REPLACE FUNCTION supplier_invoice_stock_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."reversalOfId" IS NOT NULL THEN
 PERFORM id FROM "StockDocument" WHERE id=NEW."reversalOfId" FOR UPDATE;
 IF EXISTS(SELECT 1 FROM "SupplierInvoice" WHERE "stockDocumentId"=NEW."reversalOfId") THEN RAISE EXCEPTION 'Tracked purchase needs a linked supplier return'; END IF;
 END IF; RETURN NEW;
END $$;
