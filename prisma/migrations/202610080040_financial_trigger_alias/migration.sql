-- Separate trigger record shapes: a document has no documentId field.
CREATE OR REPLACE FUNCTION finance_balanced() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE d RECORD; n INT; net NUMERIC; positive NUMERIC; negative NUMERIC; BEGIN
 IF TG_TABLE_NAME='FinancialDocument' THEN
 SELECT * INTO d FROM "FinancialDocument" WHERE id=NEW.id;
 ELSE
 SELECT * INTO d FROM "FinancialDocument" WHERE id=NEW."documentId";
 END IF;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT count(*),COALESCE(sum(amount),0),COALESCE(sum(amount) FILTER(WHERE amount>0),0),COALESCE(-sum(amount) FILTER(WHERE amount<0),0) INTO n,net,positive,negative FROM "AccountEntry" WHERE "documentId"=d.id;
 IF d.kind IN ('transfer','transfer_reversal') THEN IF n<>2 OR net<>0 OR positive<>d.amount OR negative<>d.amount THEN RAISE EXCEPTION 'Unbalanced transfer'; END IF;
 ELSE IF n<>1 OR abs(net)<>d.amount OR (d.kind IN ('expense','supplier_payment','customer_refund') AND net>=0) OR (d.kind IN ('opening','expense_reversal','supplier_refund','customer_advance') AND net<=0) THEN RAISE EXCEPTION 'Invalid financial posting'; END IF; END IF;
 IF d."reversalOfId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "FinancialDocument" original WHERE original.id=d."reversalOfId" AND original."organizationId"=d."organizationId" AND original."storeId"=d."storeId" AND original.amount=d.amount AND d.kind=original.kind||'_reversal' AND original."categoryId" IS NOT DISTINCT FROM d."categoryId") THEN RAISE EXCEPTION 'Invalid original reversal'; END IF;
 IF d."reversalOfId" IS NOT NULL AND EXISTS(SELECT 1 FROM "AccountEntry" original_entry LEFT JOIN "AccountEntry" posted ON posted."documentId"=d.id AND posted."accountId"=original_entry."accountId" WHERE original_entry."documentId"=d."reversalOfId" AND (posted.id IS NULL OR posted.amount<>-original_entry.amount)) THEN RAISE EXCEPTION 'Reversal postings mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM "FinancialAccount" a WHERE a.kind<>'cash' AND a.id IN(SELECT "accountId" FROM "AccountEntry" WHERE "documentId"=d.id) AND (SELECT COALESCE(sum(amount),0) FROM "AccountEntry" WHERE "accountId"=a.id)<0) THEN RAISE EXCEPTION 'Insufficient account funds'; END IF;
 RETURN NULL; END $$;
