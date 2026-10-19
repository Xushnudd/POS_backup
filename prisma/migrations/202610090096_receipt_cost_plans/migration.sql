CREATE TABLE "ReceiptCostPlan" (
 id TEXT PRIMARY KEY,
 "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
 "storeId" TEXT NOT NULL REFERENCES "Store"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 "stockDocumentId" TEXT NOT NULL REFERENCES "StockDocument"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 "expenseDocumentId" TEXT NOT NULL REFERENCES "FinancialDocument"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 amount NUMERIC(14,2) NOT NULL CHECK(amount>0), method TEXT NOT NULL CHECK(method IN ('value','quantity','weight')),
 status TEXT NOT NULL DEFAULT 'prepared' CHECK(status IN ('prepared','cancelled')),
 snapshot JSONB NOT NULL CHECK(jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=262144),
 reason TEXT NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 2000),
 "createdBy" TEXT NOT NULL REFERENCES "User"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "cancelledBy" TEXT REFERENCES "User"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 "cancelledAt" TIMESTAMP(3),"cancellationReason" TEXT,
 CHECK((status='prepared' AND "cancelledBy" IS NULL AND "cancelledAt" IS NULL AND "cancellationReason" IS NULL)
 OR(status='cancelled' AND "cancelledBy" IS NOT NULL AND "cancelledAt" IS NOT NULL AND length(btrim("cancellationReason")) BETWEEN 3 AND 2000))
);
CREATE UNIQUE INDEX "ReceiptCostPlan_active_expense_key" ON "ReceiptCostPlan"("expenseDocumentId") WHERE status='prepared';
CREATE INDEX "ReceiptCostPlan_organizationId_storeId_stockDocumentId_createdAt_id_idx"
 ON "ReceiptCostPlan"("organizationId","storeId","stockDocumentId","createdAt",id);
CREATE FUNCTION receipt_cost_plan_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d RECORD; row JSONB; item RECORD; total NUMERIC:=0; n INT; seen TEXT[]:=ARRAY[]::TEXT[];
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'receipt cost plan immutable' USING ERRCODE='23514';END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.status<>'prepared' OR NEW.status<>'cancelled' OR
   (to_jsonb(NEW)-ARRAY['status','cancelledBy','cancelledAt','cancellationReason']) IS DISTINCT FROM
   (to_jsonb(OLD)-ARRAY['status','cancelledBy','cancelledAt','cancellationReason']) THEN
   RAISE EXCEPTION 'receipt cost plan immutable' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "organizationId"=NEW."organizationId" AND "userId"=NEW."cancelledBy" AND "isActive" AND role IN ('owner','admin')) THEN RAISE EXCEPTION 'receipt cost canceller invalid' USING ERRCODE='23514';END IF;
  RETURN NEW;
 END IF;
 IF NEW.status<>'prepared' OR NOT EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "organizationId"=NEW."organizationId" AND "userId"=NEW."createdBy" AND "isActive" AND role IN ('owner','admin')) THEN RAISE EXCEPTION 'receipt cost creator invalid' USING ERRCODE='23514';END IF;
 SELECT f.*,c.treatment INTO d FROM "FinancialDocument" f JOIN "ExpenseCategory" c ON c.id=f."categoryId" WHERE f.id=NEW."expenseDocumentId" FOR UPDATE OF f;
 IF d.id IS NULL OR d."organizationId"<>NEW."organizationId" OR d."storeId"<>NEW."storeId" OR d.kind<>'expense' OR d.treatment<>'capitalised' OR d.amount<>NEW.amount OR EXISTS(SELECT 1 FROM "FinancialDocument" WHERE "reversalOfId"=d.id) THEN RAISE EXCEPTION 'receipt cost expense source invalid' USING ERRCODE='23514';END IF;
 IF NOT EXISTS(SELECT 1 FROM "StockDocument" WHERE id=NEW."stockDocumentId" AND "organizationId"=NEW."organizationId" AND "storeId"=NEW."storeId" AND status='confirmed' AND "documentType"='purchase' AND "reversalOfId" IS NULL)
 OR EXISTS(SELECT 1 FROM "StockDocument" WHERE "reversalOfId"=NEW."stockDocumentId") THEN RAISE EXCEPTION 'receipt cost receipt invalid' USING ERRCODE='23514';END IF;
 IF NEW.snapshot->>'stockDocumentId' IS DISTINCT FROM NEW."stockDocumentId" OR NEW.snapshot->>'storeId' IS DISTINCT FROM NEW."storeId" OR NEW.snapshot->>'method' IS DISTINCT FROM NEW.method OR (NEW.snapshot->>'amount')::numeric IS DISTINCT FROM NEW.amount OR NEW.snapshot->>'previewOnly' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'receipt cost snapshot mismatch' USING ERRCODE='23514';END IF;
 IF jsonb_typeof(NEW.snapshot->'lines') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'receipt cost lines required' USING ERRCODE='23514';END IF;
 n:=jsonb_array_length(NEW.snapshot->'lines');
 IF n<1 OR n>200 OR n<>(SELECT count(*) FROM "StockDocumentItem" WHERE "stockDocumentId"=NEW."stockDocumentId") THEN RAISE EXCEPTION 'receipt cost lines incomplete' USING ERRCODE='23514';END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(NEW.snapshot->'lines') LOOP
  SELECT si.*,oi.unit INTO item FROM "StockDocumentItem" si JOIN "PurchaseReceiptLine" l ON l."stockDocumentItemId"=si.id JOIN "PurchaseOrderItem" oi ON oi.id=l."orderItemId" WHERE si.id=row->>'id' AND si."stockDocumentId"=NEW."stockDocumentId";
  IF item.id IS NULL OR item.id=ANY(seen) OR (row->>'quantity')::numeric IS DISTINCT FROM item.quantity OR (row->>'unitCost')::numeric IS DISTINCT FROM item."unitCost" OR row->>'unit' IS DISTINCT FROM item.unit OR (row->>'allocatedAmount')::numeric<0 OR (row->>'allocatedAmount')::numeric<>round((row->>'allocatedAmount')::numeric,2)
   OR ((row->>'landedUnitCost')::numeric-item."unitCost")*item.quantity+(row->>'roundingResidual')::numeric IS DISTINCT FROM (row->>'allocatedAmount')::numeric THEN RAISE EXCEPTION 'receipt cost original line mismatch' USING ERRCODE='23514';END IF;
  seen:=array_append(seen,item.id);total:=total+(row->>'allocatedAmount')::numeric;
 END LOOP;
 IF total IS DISTINCT FROM NEW.amount THEN RAISE EXCEPTION 'receipt cost total mismatch' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receipt_cost_plan_guard BEFORE INSERT OR UPDATE OR DELETE ON "ReceiptCostPlan" FOR EACH ROW EXECUTE FUNCTION receipt_cost_plan_guard();
CREATE FUNCTION receipt_cost_expense_reversal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."reversalOfId" IS NOT NULL THEN
  PERFORM id FROM "FinancialDocument" WHERE id=NEW."reversalOfId" FOR UPDATE;
  IF EXISTS(SELECT 1 FROM "ReceiptCostPlan" WHERE "expenseDocumentId"=NEW."reversalOfId" AND status='prepared') THEN RAISE EXCEPTION 'cancel receipt cost plan before expense reversal' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receipt_cost_expense_reversal_guard BEFORE INSERT ON "FinancialDocument" FOR EACH ROW EXECUTE FUNCTION receipt_cost_expense_reversal_guard();
CREATE FUNCTION receipt_cost_stock_reversal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."reversalOfId" IS NOT NULL THEN
  PERFORM id FROM "StockDocument" WHERE id=NEW."reversalOfId" FOR UPDATE;
  IF EXISTS(SELECT 1 FROM "ReceiptCostPlan" WHERE "stockDocumentId"=NEW."reversalOfId" AND status='prepared') THEN RAISE EXCEPTION 'cancel receipt cost plan before stock reversal' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receipt_cost_stock_reversal_guard BEFORE INSERT ON "StockDocument" FOR EACH ROW EXECUTE FUNCTION receipt_cost_stock_reversal_guard();
