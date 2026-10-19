BEGIN;
ALTER TABLE "Product" ADD COLUMN     "serialTracking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "warrantyDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warrantyTerms" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StockDocumentItem" ADD COLUMN     "serialInput" JSONB;
ALTER TABLE "StockTransferItem" ADD COLUMN     "serialInput" JSONB;
CREATE TABLE "SerialNumber" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'available',
    "storeId" TEXT NOT NULL,
    "lastSaleItemId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SerialNumber_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SerialEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serialId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "movementId" TEXT,
    "returnDispositionId" TEXT,
    "transferDispositionId" TEXT,
    "saleItemId" TEXT,
    "sourceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SerialEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Warranty" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serialId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "saleEventId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "terms" TEXT NOT NULL,

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WarrantyService" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warrantyId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarrantyService_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SerialNumber_organizationId_storeId_productId_state_id_idx" ON "SerialNumber"("organizationId", "storeId", "productId", "state", "id");
CREATE UNIQUE INDEX "SerialNumber_organizationId_code_key" ON "SerialNumber"("organizationId", "code");
CREATE INDEX "SerialEvent_organizationId_serialId_createdAt_id_idx" ON "SerialEvent"("organizationId", "serialId", "createdAt", "id");
CREATE UNIQUE INDEX "SerialEvent_movementId_serialId_key" ON "SerialEvent"("movementId", "serialId");
CREATE UNIQUE INDEX "Warranty_saleEventId_key" ON "Warranty"("saleEventId");
CREATE INDEX "Warranty_organizationId_storeId_startedAt_id_idx" ON "Warranty"("organizationId", "storeId", "startedAt", "id");
CREATE UNIQUE INDEX "Warranty_serialId_saleItemId_key" ON "Warranty"("serialId", "saleItemId");
CREATE INDEX "WarrantyService_organizationId_warrantyId_createdAt_id_idx" ON "WarrantyService"("organizationId", "warrantyId", "createdAt", "id");
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "SerialEvent" ADD CONSTRAINT "SerialEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SerialEvent" ADD CONSTRAINT "SerialEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "SerialEvent" ADD CONSTRAINT "SerialEvent_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "SerialNumber"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "SerialNumber"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "WarrantyService" ADD CONSTRAINT "WarrantyService_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarrantyService" ADD CONSTRAINT "WarrantyService_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "WarrantyService" ADD CONSTRAINT "WarrantyService_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "Warranty"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
CREATE OR REPLACE FUNCTION pos_tenant_root(model_name text, row_data jsonb) RETURNS text
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE parent_model text; parent_key text; parent_row jsonb; tenant text;
BEGIN
 IF model_name='Organization' THEN RETURN row_data->>'id'; END IF;
 IF model_name IN ('SerialNumber','SerialEvent','Warranty','WarrantyService','ReceiptCostContinuation','ReceiptCostApplication','InventoryValuationSequence','InventoryValuationEvent','InventoryBatch','InventoryBatchEntry','InventoryBatchDisposition','OrganizationUser','CustomRole','Store','ReceiptCostPlan','Category','Product','Customer','Supplier','StockDocument','InventoryMovement','StockTransfer','TransferDispositionEntry','SupportGrant','ShiftCorrection','Sale','Payment','DiscountPolicy','AuditLog','Session','Operation','ProviderIntent','DebtEntry','Invitation','Unit','ProductBarcode','StockCount','OwnershipTransfer','Incident','SyncReview','StockThreshold','ProductPriceHistory','DamageLocation','ReturnDispositionEntry','FinancialAccount','ExpenseCategory','FinancialDocument','AccountEntry','SupplierInvoice','SupplierPayment','PurchaseOrder','ProductVariant','FileAsset','Brand','TaxProfile','TaxProfileVersion','CustomerGroup','PriceRule','StockLocation','LocationBalance','LocationEntry','StockReservation','ReservationItem','ReservationEntry','OfflineCashPolicy','OfflineCashLease','OnboardingCheckpoint','SaleExchange','JobExport','BackgroundJob','JobAuthorization','SecurityEvent','ProductUnitConversion','CustomerAdvance','OrganizationSubscription','BillingInvoice','BillingPayment','IntegrationCost','SupportTicket','SupportTicketEvent','OrganizationClosure') THEN RETURN row_data->>'organizationId'; END IF;
 IF model_name IN ('User','PlatformOperator','RateLimit','BillingPlanVersion','BillingPlan','AuthChallenge','VerifiedContact','SupportPolicyVersion','RetentionPolicyVersion','RetentionPolicy','TotpFactor','TotpProof','TotpRecoveryCode','TotpKeyRotation','AuthRestoreCheckpoint') THEN RETURN NULL; END IF;
 CASE model_name
 WHEN 'UserStore' THEN parent_model:='OrganizationUser'; parent_key:='organizationUserId';
 WHEN 'Register' THEN parent_model:='Store'; parent_key:='storeId';
 WHEN 'StockDocumentItem' THEN parent_model:='StockDocument'; parent_key:='stockDocumentId';
 WHEN 'InventoryBalance' THEN parent_model:='Store'; parent_key:='storeId';
 WHEN 'StockTransferItem' THEN parent_model:='StockTransfer'; parent_key:='stockTransferId';
 WHEN 'Shift' THEN parent_model:='Register'; parent_key:='registerId';
 WHEN 'CashMovement' THEN parent_model:='Shift'; parent_key:='shiftId';
 WHEN 'SaleItem' THEN parent_model:='Sale'; parent_key:='saleId';
 WHEN 'SaleReturn' THEN parent_model:='Sale'; parent_key:='saleId';
 WHEN 'SaleReturnItem' THEN parent_model:='SaleReturn'; parent_key:='saleReturnId';
 WHEN 'StockCountLine' THEN parent_model:='StockCount'; parent_key:='countId';
 WHEN 'StockCountReading' THEN parent_model:='StockCountLine'; parent_key:='lineId';
 WHEN 'StockFreeze' THEN parent_model:='Store'; parent_key:='storeId';
 WHEN 'SupplierAllocation' THEN parent_model:='SupplierInvoice'; parent_key:='invoiceId';
 WHEN 'PurchaseOrderItem' THEN parent_model:='PurchaseOrder'; parent_key:='orderId';
 WHEN 'PurchaseReceipt' THEN parent_model:='PurchaseOrder'; parent_key:='orderId';
 WHEN 'PurchaseReceiptLine' THEN parent_model:='PurchaseReceipt'; parent_key:='receiptId';
 WHEN 'SupplierCredit' THEN parent_model:='SupplierInvoice'; parent_key:='invoiceId';
 WHEN 'SupplierCreditItem' THEN parent_model:='SupplierCredit'; parent_key:='creditId';
 WHEN 'SupplierAllocationRelease' THEN parent_model:='SupplierAllocation'; parent_key:='allocationId';
 WHEN 'CustomerAdvanceAllocation' THEN parent_model:='CustomerAdvance'; parent_key:='advanceId';
 WHEN 'CustomerAdvanceRefund' THEN parent_model:='CustomerAdvance'; parent_key:='advanceId';
 WHEN 'ProviderOutbox' THEN parent_model:='ProviderIntent'; parent_key:='intentId';
 WHEN 'ProviderEvent' THEN parent_model:='ProviderIntent'; parent_key:='intentId';
 WHEN 'JobEvent' THEN parent_model:='BackgroundJob'; parent_key:='jobId';
 WHEN 'SecurityNoticeOutbox' THEN parent_model:='SecurityEvent'; parent_key:='eventId';
 WHEN 'SecurityNotice' THEN parent_model:='SecurityEvent'; parent_key:='eventId';
 ELSE RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Unreviewed tenant model';
 END CASE;
 EXECUTE format('SELECT to_jsonb(p) FROM public.%I p WHERE id=$1 FOR KEY SHARE',parent_model) INTO parent_row USING row_data->>parent_key;
 IF parent_row IS NULL THEN RETURN NULL; END IF;
 RETURN public.pos_tenant_root(parent_model,parent_row);
END $$;

CREATE OR REPLACE FUNCTION pos_tenant_expression(model_name text, row_alias text) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE parent_model text; parent_key text;
BEGIN
 IF model_name='Organization' THEN RETURN format('%I.id',row_alias); END IF;
 IF model_name IN ('SerialNumber','SerialEvent','Warranty','WarrantyService','ReceiptCostContinuation','ReceiptCostApplication','InventoryValuationSequence','InventoryValuationEvent','InventoryBatch','InventoryBatchEntry','InventoryBatchDisposition','OrganizationUser','CustomRole','Store','ReceiptCostPlan','Category','Product','Customer','Supplier','StockDocument','InventoryMovement','StockTransfer','TransferDispositionEntry','SupportGrant','ShiftCorrection','Sale','Payment','DiscountPolicy','AuditLog','Session','Operation','ProviderIntent','DebtEntry','Invitation','Unit','ProductBarcode','StockCount','OwnershipTransfer','Incident','SyncReview','StockThreshold','ProductPriceHistory','DamageLocation','ReturnDispositionEntry','FinancialAccount','ExpenseCategory','FinancialDocument','AccountEntry','SupplierInvoice','SupplierPayment','PurchaseOrder','ProductVariant','FileAsset','Brand','TaxProfile','TaxProfileVersion','CustomerGroup','PriceRule','StockLocation','LocationBalance','LocationEntry','StockReservation','ReservationItem','ReservationEntry','OfflineCashPolicy','OfflineCashLease','OnboardingCheckpoint','SaleExchange','JobExport','BackgroundJob','JobAuthorization','SecurityEvent','ProductUnitConversion','CustomerAdvance','OrganizationSubscription','BillingInvoice','BillingPayment','IntegrationCost','SupportTicket','SupportTicketEvent','OrganizationClosure') THEN RETURN format('%I."organizationId"',row_alias); END IF;
 IF model_name IN ('User','PlatformOperator','RateLimit','BillingPlanVersion','BillingPlan','AuthChallenge','VerifiedContact','SupportPolicyVersion','RetentionPolicyVersion','RetentionPolicy','TotpFactor','TotpProof','TotpRecoveryCode','TotpKeyRotation','AuthRestoreCheckpoint') THEN RETURN 'NULL::text'; END IF;
 CASE model_name
 WHEN 'UserStore' THEN parent_model:='OrganizationUser'; parent_key:='organizationUserId';
 WHEN 'Register' THEN parent_model:='Store'; parent_key:='storeId';
 WHEN 'StockDocumentItem' THEN parent_model:='StockDocument'; parent_key:='stockDocumentId';
 WHEN 'InventoryBalance' THEN parent_model:='Store'; parent_key:='storeId';
 WHEN 'StockTransferItem' THEN parent_model:='StockTransfer'; parent_key:='stockTransferId';
 WHEN 'Shift' THEN parent_model:='Register'; parent_key:='registerId';
 WHEN 'CashMovement' THEN parent_model:='Shift'; parent_key:='shiftId';
 WHEN 'SaleItem' THEN parent_model:='Sale'; parent_key:='saleId';
 WHEN 'SaleReturn' THEN parent_model:='Sale'; parent_key:='saleId';
 WHEN 'SaleReturnItem' THEN parent_model:='SaleReturn'; parent_key:='saleReturnId';
 WHEN 'StockCountLine' THEN parent_model:='StockCount'; parent_key:='countId';
 WHEN 'StockCountReading' THEN parent_model:='StockCountLine'; parent_key:='lineId';
 WHEN 'StockFreeze' THEN parent_model:='Store'; parent_key:='storeId';
 WHEN 'SupplierAllocation' THEN parent_model:='SupplierInvoice'; parent_key:='invoiceId';
 WHEN 'PurchaseOrderItem' THEN parent_model:='PurchaseOrder'; parent_key:='orderId';
 WHEN 'PurchaseReceipt' THEN parent_model:='PurchaseOrder'; parent_key:='orderId';
 WHEN 'PurchaseReceiptLine' THEN parent_model:='PurchaseReceipt'; parent_key:='receiptId';
 WHEN 'SupplierCredit' THEN parent_model:='SupplierInvoice'; parent_key:='invoiceId';
 WHEN 'SupplierCreditItem' THEN parent_model:='SupplierCredit'; parent_key:='creditId';
 WHEN 'SupplierAllocationRelease' THEN parent_model:='SupplierAllocation'; parent_key:='allocationId';
 WHEN 'CustomerAdvanceAllocation' THEN parent_model:='CustomerAdvance'; parent_key:='advanceId';
 WHEN 'CustomerAdvanceRefund' THEN parent_model:='CustomerAdvance'; parent_key:='advanceId';
 WHEN 'ProviderOutbox' THEN parent_model:='ProviderIntent'; parent_key:='intentId';
 WHEN 'ProviderEvent' THEN parent_model:='ProviderIntent'; parent_key:='intentId';
 WHEN 'JobEvent' THEN parent_model:='BackgroundJob'; parent_key:='jobId';
 WHEN 'SecurityNoticeOutbox' THEN parent_model:='SecurityEvent'; parent_key:='eventId';
 WHEN 'SecurityNotice' THEN parent_model:='SecurityEvent'; parent_key:='eventId';
 ELSE RAISE EXCEPTION 'Unreviewed tenant model'; END CASE;
 RETURN format('(SELECT %s FROM public.%I parent_%s WHERE parent_%s.id=%I.%I)',public.pos_tenant_expression(parent_model,'parent_'||row_alias),parent_model,row_alias,row_alias,row_alias,parent_key);
END $$;
ALTER TABLE "SerialNumber" ADD CONSTRAINT serial_store FOREIGN KEY("storeId") REFERENCES "Store"(id);
ALTER TABLE "SerialNumber" ADD CONSTRAINT serial_last_sale FOREIGN KEY("lastSaleItemId") REFERENCES "SaleItem"(id);
ALTER TABLE "SerialEvent" ADD CONSTRAINT serial_movement FOREIGN KEY("movementId") REFERENCES "InventoryMovement"(id);
ALTER TABLE "SerialEvent" ADD CONSTRAINT serial_sale_item FOREIGN KEY("saleItemId") REFERENCES "SaleItem"(id);
ALTER TABLE "SerialEvent" ADD CONSTRAINT serial_return_disposition FOREIGN KEY("returnDispositionId") REFERENCES "ReturnDispositionEntry"(id);
ALTER TABLE "SerialEvent" ADD CONSTRAINT serial_transfer_disposition FOREIGN KEY("transferDispositionId") REFERENCES "TransferDispositionEntry"(id);
ALTER TABLE "Warranty" ADD CONSTRAINT warranty_sale FOREIGN KEY("saleItemId") REFERENCES "SaleItem"(id);
ALTER TABLE "Warranty" ADD CONSTRAINT warranty_event FOREIGN KEY("saleEventId") REFERENCES "SerialEvent"(id);
ALTER TABLE "Warranty" ADD CONSTRAINT warranty_store FOREIGN KEY("storeId") REFERENCES "Store"(id);
ALTER TABLE "Product" ADD CONSTRAINT serial_policy_range CHECK("warrantyDays" BETWEEN 0 AND 36500 AND length("warrantyTerms")<=4000);
CREATE FUNCTION pos_serial_policy_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD."serialTracking" AND NOT NEW."serialTracking" THEN RAISE EXCEPTION 'SERIAL_POLICY_IMMUTABLE'; END IF;
 IF NEW."serialTracking" THEN
  IF NEW."batchTracking" OR NOT EXISTS(SELECT 1 FROM "Unit" WHERE "organizationId"=NEW."organizationId" AND code=NEW.unit AND precision=0) THEN RAISE EXCEPTION 'SERIAL_INTEGER_UNIT_REQUIRED'; END IF;
  IF NOT OLD."serialTracking" AND (EXISTS(SELECT 1 FROM "InventoryMovement" WHERE "productId"=NEW.id) OR EXISTS(SELECT 1 FROM "SaleItem" WHERE "productId"=NEW.id) OR EXISTS(SELECT 1 FROM "StockTransferItem" WHERE "productId"=NEW.id) OR EXISTS(SELECT 1 FROM "InventoryBalance" WHERE "productId"=NEW.id AND quantity<>0)) THEN RAISE EXCEPTION 'SERIAL_REQUIRES_UNUSED_PRODUCT'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER serial_policy BEFORE UPDATE ON "Product" FOR EACH ROW EXECUTE FUNCTION pos_serial_policy_guard();
CREATE FUNCTION pos_serial_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD; END IF;
 IF TG_TABLE_NAME='SerialNumber' AND TG_OP='UPDATE' AND pg_trigger_depth()>1 AND NEW.id=OLD.id AND NEW."organizationId"=OLD."organizationId" AND NEW."productId"=OLD."productId" AND NEW.code=OLD.code AND NEW."createdAt"=OLD."createdAt" AND NEW.version=OLD.version+1 THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'SERIAL_JOURNAL_IMMUTABLE';
END $$;
CREATE FUNCTION pos_serial_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u "SerialNumber"; m "InventoryMovement"; target text; p "Product"; d "ReturnDispositionEntry"; t "TransferDispositionEntry"; si "SaleItem";
BEGIN
 SELECT * INTO u FROM "SerialNumber" WHERE id=NEW."serialId" FOR UPDATE;
 SELECT * INTO p FROM "Product" WHERE id=u."productId";
 IF u.id IS NULL OR NOT p."serialTracking" OR u."organizationId"<>NEW."organizationId" OR u."productId"<>NEW."productId" OR NEW."createdAt"<>CURRENT_TIMESTAMP::timestamp(3) OR NOT EXISTS(SELECT 1 FROM "Store" WHERE id=NEW."storeId" AND "organizationId"=NEW."organizationId") OR NOT EXISTS(SELECT 1 FROM "OrganizationUser" ou JOIN "User" a ON a.id=ou."userId" WHERE ou."organizationId"=NEW."organizationId" AND ou."userId"=NEW."actorId" AND ou."isActive" AND a."isActive") THEN RAISE EXCEPTION 'SERIAL_SOURCE_INVALID'; END IF;
 IF NEW."movementId" IS NOT NULL THEN
  SELECT * INTO m FROM "InventoryMovement" WHERE id=NEW."movementId";
  IF m.id IS NULL OR m."organizationId"<>NEW."organizationId" OR m."productId"<>NEW."productId" OR m."storeId"<>NEW."storeId" OR m."sourceId"<>NEW."sourceId" OR m."createdBy"<>NEW."actorId" OR (SELECT xmin::text::bigint FROM "InventoryMovement" WHERE id=m.id)<>txid_current()%4294967296 THEN RAISE EXCEPTION 'SERIAL_MOVEMENT_INVALID'; END IF;
  CASE NEW.kind
   WHEN 'receipt' THEN
    IF m."sourceType"<>'stock_document' OR m."quantityDelta"<=0 OR u.version<>0 OR NOT EXISTS(SELECT 1 FROM "StockDocumentItem" i WHERE i."stockDocumentId"=m."sourceId" AND i."productId"=u."productId" AND i."serialInput" @> to_jsonb(ARRAY[u.code])) THEN RAISE EXCEPTION 'SERIAL_RECEIPT_INVALID'; END IF; target:='available';
   WHEN 'sale' THEN
    SELECT * INTO si FROM "SaleItem" WHERE id=NEW."saleItemId";
    IF m."sourceType"<>'sale' OR m."quantityDelta">=0 OR u.state<>'available' OR u."storeId"<>m."storeId" OR si."saleId"<>m."sourceId" OR si."productId"<>u."productId" OR si.id IS NULL THEN RAISE EXCEPTION 'SERIAL_SALE_INVALID'; END IF;target:='sold';
   WHEN 'return' THEN
    IF m."sourceType"<>'return' OR m."quantityDelta"<=0 OR u.state<>'sold' OR u."lastSaleItemId" IS DISTINCT FROM NEW."saleItemId" OR NOT EXISTS(SELECT 1 FROM "SaleReturn" r JOIN "SaleReturnItem" i ON i."saleReturnId"=r.id WHERE r.id=m."sourceId" AND i."saleItemId"=NEW."saleItemId" AND i.disposition='sellable') THEN RAISE EXCEPTION 'SERIAL_RETURN_INVALID'; END IF;target:='available';
   WHEN 'transfer_out' THEN IF m."sourceType"<>'transfer_out' OR m."quantityDelta">=0 OR u.state<>'available' OR u."storeId"<>m."storeId" THEN RAISE EXCEPTION 'SERIAL_TRANSFER_INVALID'; END IF;target:='transit';
   WHEN 'transfer_in','transfer_return' THEN IF m."sourceType"<>NEW.kind OR m."quantityDelta"<=0 OR u.state<>'transit' THEN RAISE EXCEPTION 'SERIAL_TRANSFER_INVALID'; END IF;target:='available';
   WHEN 'retired' THEN IF m."quantityDelta">=0 OR m."sourceType" NOT IN ('stock_document','stock_reversal','supplier_return') OR u.state<>'available' OR u."storeId"<>m."storeId" THEN RAISE EXCEPTION 'SERIAL_RETIRE_INVALID'; END IF;target:='retired';
   ELSE RAISE EXCEPTION 'SERIAL_KIND_INVALID'; END CASE;
 ELSE
  IF num_nonnulls(NEW."returnDispositionId",NEW."transferDispositionId")<>1 OR NEW.kind NOT IN ('damaged','retired') THEN RAISE EXCEPTION 'SERIAL_DISPOSITION_INVALID'; END IF;
  IF NEW."returnDispositionId" IS NOT NULL THEN
   SELECT * INTO d FROM "ReturnDispositionEntry" WHERE id=NEW."returnDispositionId";
   IF d.id IS NULL OR d."organizationId"<>NEW."organizationId" OR d."productId"<>u."productId" OR d."storeId"<>NEW."storeId" OR u.state<>'sold' OR u."lastSaleItemId" IS DISTINCT FROM NEW."saleItemId" OR NOT EXISTS(SELECT 1 FROM "SaleReturnItem" WHERE id=d."returnItemId" AND "saleItemId"=NEW."saleItemId" AND "saleReturnId"=NEW."sourceId") OR (SELECT xmin::text::bigint FROM "ReturnDispositionEntry" WHERE id=d.id)<>txid_current()%4294967296 THEN RAISE EXCEPTION 'SERIAL_DISPOSITION_INVALID'; END IF;
  ELSE
   SELECT * INTO t FROM "TransferDispositionEntry" WHERE id=NEW."transferDispositionId";
   IF t.id IS NULL OR t."organizationId"<>NEW."organizationId" OR t."productId"<>u."productId" OR t."storeId"<>NEW."storeId" OR u.state<>'transit' OR (SELECT xmin::text::bigint FROM "TransferDispositionEntry" WHERE id=t.id)<>txid_current()%4294967296 THEN RAISE EXCEPTION 'SERIAL_DISPOSITION_INVALID'; END IF;
  END IF;target:=NEW.kind;
 END IF;
 UPDATE "SerialNumber" SET state=target,"storeId"=NEW."storeId","lastSaleItemId"=CASE WHEN NEW.kind='sale' THEN NEW."saleItemId" ELSE "lastSaleItemId" END,version=version+1 WHERE id=u.id;
 RETURN NEW;
END $$;
CREATE TRIGGER serial_event BEFORE INSERT ON "SerialEvent" FOR EACH ROW EXECUTE FUNCTION pos_serial_event_guard();
CREATE FUNCTION pos_serial_conservation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pid text; sid text; org text; q numeric; n bigint;
BEGIN
 IF TG_TABLE_NAME='InventoryMovement' THEN pid:=NEW."productId"; sid:=NEW."storeId";org:=NEW."organizationId";
  IF (SELECT "serialTracking" FROM "Product" WHERE id=pid) AND (NEW."quantityDelta"<>trunc(NEW."quantityDelta") OR abs(NEW."quantityDelta")<>(SELECT count(*) FROM "SerialEvent" WHERE "movementId"=NEW.id)) THEN RAISE EXCEPTION 'SERIAL_MOVEMENT_CONSERVATION'; END IF;
 ELSIF TG_TABLE_NAME='InventoryBalance' THEN pid:=NEW."productId";sid:=NEW."storeId";
 ELSIF TG_TABLE_NAME='SerialNumber' THEN pid:=NEW."productId";sid:=NEW."storeId";
  IF NOT EXISTS(SELECT 1 FROM "SerialEvent" WHERE "serialId"=NEW.id AND kind='receipt') THEN RAISE EXCEPTION 'SERIAL_ORIGIN_REQUIRED'; END IF;
 ELSIF TG_TABLE_NAME='ReturnDispositionEntry' THEN
  IF (SELECT "serialTracking" FROM "Product" WHERE id=NEW."productId") AND NEW.quantity<>(SELECT count(*) FROM "SerialEvent" WHERE "returnDispositionId"=NEW.id) THEN RAISE EXCEPTION 'SERIAL_DISPOSITION_CONSERVATION'; END IF;RETURN NULL;
 ELSE
  IF (SELECT "serialTracking" FROM "Product" WHERE id=NEW."productId") AND NEW.quantity<>(SELECT count(*) FROM "SerialEvent" WHERE "transferDispositionId"=NEW.id) THEN RAISE EXCEPTION 'SERIAL_DISPOSITION_CONSERVATION'; END IF;RETURN NULL;
 END IF;
 IF (SELECT "serialTracking" FROM "Product" WHERE id=pid) THEN
  SELECT COALESCE(quantity,0) INTO q FROM "InventoryBalance" WHERE "productId"=pid AND "storeId"=sid;
  SELECT count(*) INTO n FROM "SerialNumber" WHERE "productId"=pid AND "storeId"=sid AND state='available';
  IF COALESCE(q,0)<>n THEN RAISE EXCEPTION 'SERIAL_STOCK_CONSERVATION'; END IF;
 END IF;RETURN NULL;
END $$;
CREATE FUNCTION pos_warranty_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE e "SerialEvent";p "Product";w "Warranty";u "SerialNumber";last_state text;BEGIN
 IF TG_TABLE_NAME='Warranty' THEN
 SELECT * INTO e FROM "SerialEvent" WHERE id=NEW."saleEventId";SELECT * INTO p FROM "Product" WHERE id=NEW."productId";
 IF e.id IS NULL OR e.kind<>'sale' OR e."organizationId"<>NEW."organizationId" OR e."productId"<>NEW."productId" OR e."serialId"<>NEW."serialId" OR e."saleItemId"<>NEW."saleItemId" OR e."storeId"<>NEW."storeId" OR NEW."startedAt"<>CURRENT_TIMESTAMP::timestamp(3) OR NEW."endsAt"<>NEW."startedAt"+make_interval(days=>p."warrantyDays") OR NEW.terms<>p."warrantyTerms" THEN RAISE EXCEPTION 'WARRANTY_SNAPSHOT_INVALID'; END IF;
 ELSE
 SELECT * INTO w FROM "Warranty" WHERE id=NEW."warrantyId" FOR UPDATE;SELECT * INTO u FROM "SerialNumber" WHERE id=w."serialId";
 SELECT status INTO last_state FROM "WarrantyService" WHERE "warrantyId"=w.id ORDER BY "createdAt" DESC,id DESC LIMIT 1;
 IF w.id IS NULL OR w."organizationId"<>NEW."organizationId" OR w."productId"<>NEW."productId" OR u.state<>'sold' OR u."lastSaleItemId"<>w."saleItemId" OR NEW.status NOT IN ('opened','in_progress','resolved','rejected') OR length(NEW.note) NOT BETWEEN 3 AND 2000 OR NOT EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "organizationId"=NEW."organizationId" AND "userId"=NEW."actorId" AND "isActive" AND role IN ('owner','admin')) OR (last_state IS NULL AND NEW.status<>'opened') OR (last_state IN ('resolved','rejected') AND NEW.status<>'opened') OR (last_state IN ('opened','in_progress') AND NEW.status='opened') THEN RAISE EXCEPTION 'WARRANTY_SERVICE_INVALID'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER warranty_guard BEFORE INSERT ON "Warranty" FOR EACH ROW EXECUTE FUNCTION pos_warranty_guard();
CREATE TRIGGER warranty_service_guard BEFORE INSERT ON "WarrantyService" FOR EACH ROW EXECUTE FUNCTION pos_warranty_guard();
DO $$ DECLARE tab text;BEGIN
 FOREACH tab IN ARRAY ARRAY['SerialNumber','SerialEvent','Warranty','WarrantyService'] LOOP
 EXECUTE format('CREATE TRIGGER tenant_owner BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION pos_tenant_owner_immutable()',tab);
 EXECUTE format('CREATE CONSTRAINT TRIGGER tenant_edges AFTER INSERT OR UPDATE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_tenant_edge_trigger()',tab);
 EXECUTE format('CREATE TRIGGER serial_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION pos_serial_immutable()',tab);
 EXECUTE format('CREATE TRIGGER subscription_write BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION subscription_business_write_guard()',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['InventoryMovement','InventoryBalance','SerialNumber'] LOOP
 EXECUTE format('CREATE CONSTRAINT TRIGGER serial_conservation AFTER INSERT OR UPDATE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_serial_conservation()',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['ReturnDispositionEntry','TransferDispositionEntry'] LOOP
 EXECUTE format('CREATE CONSTRAINT TRIGGER serial_conservation AFTER INSERT ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_serial_conservation()',tab);
 END LOOP;
END $$;
COMMIT;
