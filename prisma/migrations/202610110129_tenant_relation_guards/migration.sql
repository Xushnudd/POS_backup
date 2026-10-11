-- Additive tenant relationship defense. No data rewrite and no RLS/session state.
BEGIN;
CREATE FUNCTION pos_tenant_root(model_name text, row_data jsonb) RETURNS text
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE parent_model text; parent_key text; parent_row jsonb; tenant text;
BEGIN
 IF model_name='Organization' THEN RETURN row_data->>'id'; END IF;
 IF model_name IN ('OrganizationUser','CustomRole','Store','ReceiptCostPlan','Category','Product','Customer','Supplier','StockDocument','InventoryMovement','StockTransfer','TransferDispositionEntry','SupportGrant','ShiftCorrection','Sale','Payment','DiscountPolicy','AuditLog','Session','Operation','ProviderIntent','DebtEntry','Invitation','Unit','ProductBarcode','StockCount','OwnershipTransfer','Incident','SyncReview','StockThreshold','ProductPriceHistory','DamageLocation','ReturnDispositionEntry','FinancialAccount','ExpenseCategory','FinancialDocument','AccountEntry','SupplierInvoice','SupplierPayment','PurchaseOrder','ProductVariant','FileAsset','Brand','TaxProfile','TaxProfileVersion','CustomerGroup','PriceRule','StockLocation','LocationBalance','LocationEntry','StockReservation','ReservationItem','ReservationEntry','OfflineCashPolicy','OfflineCashLease','OnboardingCheckpoint','SaleExchange','JobExport','BackgroundJob','JobAuthorization','SecurityEvent','ProductUnitConversion','CustomerAdvance','OrganizationSubscription','BillingInvoice','BillingPayment','IntegrationCost','SupportTicket','SupportTicketEvent','OrganizationClosure') THEN RETURN row_data->>'organizationId'; END IF;
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
 EXECUTE format('SELECT to_jsonb(p) FROM public.%I p WHERE id=$1 FOR SHARE',parent_model) INTO parent_row USING row_data->>parent_key;
 IF parent_row IS NULL THEN RETURN NULL; END IF;
 RETURN public.pos_tenant_root(parent_model,parent_row);
END $$;
CREATE FUNCTION pos_check_tenant_edges(model_name text,row_data jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE tenant text; related text; edge record; target_row jsonb; predicates text;
BEGIN
 tenant:=public.pos_tenant_root(model_name,row_data);
 IF tenant IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Missing tenant root'; END IF;
 FOR edge IN SELECT c.conkey,c.confkey,c.confrelid,r.relname AS target FROM pg_constraint c JOIN pg_class r ON r.oid=c.confrelid WHERE c.contype='f' AND c.conrelid=format('public.%I',model_name)::regclass LOOP
  SELECT string_agg(format('p.%I::text = ($1->>%L)',ta.attname,sa.attname),' AND ' ORDER BY k.n) INTO predicates
  FROM unnest(edge.conkey,edge.confkey) WITH ORDINALITY k(s,t,n)
  JOIN pg_attribute sa ON sa.attrelid=format('public.%I',model_name)::regclass AND sa.attnum=k.s
  JOIN pg_attribute ta ON ta.attrelid=edge.confrelid AND ta.attnum=k.t;
  EXECUTE format('SELECT to_jsonb(p) FROM public.%I p WHERE %s FOR SHARE',edge.target,predicates) INTO target_row USING row_data;
  -- NULL optional references / pending deferred references are handled by the FK.
  IF target_row IS NOT NULL THEN
   related:=public.pos_tenant_root(edge.target,target_row);
   IF related IS NOT NULL AND related<>tenant THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Cross-tenant relationship rejected'; END IF;
  END IF;
 END LOOP;
END $$;
CREATE FUNCTION pos_tenant_edge_trigger() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE row_data jsonb; predicates text;
BEGIN
 -- Read final state: a deferred event may belong to a row deleted later in this transaction.
 SELECT string_agg(format('p.%I::text=($1->>%L)',a.attname,a.attname),' AND ' ORDER BY k.n) INTO predicates
 FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(attnum,n)
 JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
 WHERE c.contype='p' AND c.conrelid=TG_RELID;
 IF predicates IS NULL THEN
  -- Legacy UserStore has a unique pair instead of a primary key.
  predicates:='p."organizationUserId"::text=($1->>''organizationUserId'') AND p."storeId"::text=($1->>''storeId'')';
 END IF;
 EXECUTE format('SELECT to_jsonb(p) FROM public.%I p WHERE %s',TG_TABLE_NAME,predicates) INTO row_data USING to_jsonb(NEW);
 IF row_data IS NOT NULL THEN PERFORM public.pos_check_tenant_edges(TG_TABLE_NAME,row_data); END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION pos_tenant_owner_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE old_tenant text; new_tenant text;
BEGIN
 IF TG_TABLE_NAME='Organization' THEN
  IF OLD.id IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Tenant identity is immutable'; END IF;
 ELSE
  old_tenant:=public.pos_tenant_root(TG_TABLE_NAME,to_jsonb(OLD));
  new_tenant:=public.pos_tenant_root(TG_TABLE_NAME,to_jsonb(NEW));
  IF old_tenant IS DISTINCT FROM new_tenant THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Tenant ownership is immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION pos_tenant_expression(model_name text, row_alias text) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE parent_model text; parent_key text;
BEGIN
 IF model_name='Organization' THEN RETURN format('%I.id',row_alias); END IF;
 IF model_name IN ('OrganizationUser','CustomRole','Store','ReceiptCostPlan','Category','Product','Customer','Supplier','StockDocument','InventoryMovement','StockTransfer','TransferDispositionEntry','SupportGrant','ShiftCorrection','Sale','Payment','DiscountPolicy','AuditLog','Session','Operation','ProviderIntent','DebtEntry','Invitation','Unit','ProductBarcode','StockCount','OwnershipTransfer','Incident','SyncReview','StockThreshold','ProductPriceHistory','DamageLocation','ReturnDispositionEntry','FinancialAccount','ExpenseCategory','FinancialDocument','AccountEntry','SupplierInvoice','SupplierPayment','PurchaseOrder','ProductVariant','FileAsset','Brand','TaxProfile','TaxProfileVersion','CustomerGroup','PriceRule','StockLocation','LocationBalance','LocationEntry','StockReservation','ReservationItem','ReservationEntry','OfflineCashPolicy','OfflineCashLease','OnboardingCheckpoint','SaleExchange','JobExport','BackgroundJob','JobAuthorization','SecurityEvent','ProductUnitConversion','CustomerAdvance','OrganizationSubscription','BillingInvoice','BillingPayment','IntegrationCost','SupportTicket','SupportTicketEvent','OrganizationClosure') THEN RETURN format('%I."organizationId"',row_alias); END IF;
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
-- Explicit inventory; new models require a reviewed migration, never an inferred exemption.
DO $$ DECLARE model_name text; edge record; predicates text; invalid boolean; BEGIN
 FOR model_name IN SELECT unnest(ARRAY['Organization','OrganizationUser','CustomRole','Store','ReceiptCostPlan','Category','Product','Customer','Supplier','StockDocument','InventoryMovement','StockTransfer','TransferDispositionEntry','SupportGrant','ShiftCorrection','Sale','Payment','DiscountPolicy','AuditLog','Session','Operation','ProviderIntent','DebtEntry','Invitation','Unit','ProductBarcode','StockCount','OwnershipTransfer','Incident','SyncReview','StockThreshold','ProductPriceHistory','DamageLocation','ReturnDispositionEntry','FinancialAccount','ExpenseCategory','FinancialDocument','AccountEntry','SupplierInvoice','SupplierPayment','PurchaseOrder','ProductVariant','FileAsset','Brand','TaxProfile','TaxProfileVersion','CustomerGroup','PriceRule','StockLocation','LocationBalance','LocationEntry','StockReservation','ReservationItem','ReservationEntry','OfflineCashPolicy','OfflineCashLease','OnboardingCheckpoint','SaleExchange','JobExport','BackgroundJob','JobAuthorization','SecurityEvent','ProductUnitConversion','CustomerAdvance','OrganizationSubscription','BillingInvoice','BillingPayment','IntegrationCost','SupportTicket','SupportTicketEvent','OrganizationClosure','UserStore','Register','StockDocumentItem','InventoryBalance','StockTransferItem','Shift','CashMovement','SaleItem','SaleReturn','SaleReturnItem','StockCountLine','StockCountReading','StockFreeze','SupplierAllocation','PurchaseOrderItem','PurchaseReceipt','PurchaseReceiptLine','SupplierCredit','SupplierCreditItem','SupplierAllocationRelease','CustomerAdvanceAllocation','CustomerAdvanceRefund','ProviderOutbox','ProviderEvent','JobEvent','SecurityNoticeOutbox','SecurityNotice']) LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I s WHERE %s IS NULL)',model_name,public.pos_tenant_expression(model_name,'s')) INTO invalid;
  IF invalid THEN RAISE EXCEPTION 'Missing tenant root in %',model_name; END IF;
  FOR edge IN SELECT c.conkey,c.confkey,c.confrelid,r.relname AS target FROM pg_constraint c JOIN pg_class r ON r.oid=c.confrelid WHERE c.contype='f' AND c.conrelid=format('public.%I',model_name)::regclass LOOP
   IF public.pos_tenant_expression(edge.target,'t')='NULL::text' THEN CONTINUE; END IF;
   SELECT string_agg(format('s.%I=t.%I',sa.attname,ta.attname),' AND ' ORDER BY k.n) INTO predicates
   FROM unnest(edge.conkey,edge.confkey) WITH ORDINALITY k(s,t,n)
   JOIN pg_attribute sa ON sa.attrelid=format('public.%I',model_name)::regclass AND sa.attnum=k.s
   JOIN pg_attribute ta ON ta.attrelid=edge.confrelid AND ta.attnum=k.t;
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I s JOIN public.%I t ON %s WHERE %s IS DISTINCT FROM %s)',model_name,edge.target,predicates,public.pos_tenant_expression(model_name,'s'),public.pos_tenant_expression(edge.target,'t')) INTO invalid;
   IF invalid THEN RAISE EXCEPTION 'Existing cross-tenant relationship: % to %',model_name,edge.target; END IF;
  END LOOP;
  EXECUTE format('CREATE CONSTRAINT TRIGGER tenant_edges AFTER INSERT OR UPDATE ON public.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.pos_tenant_edge_trigger()',model_name);
  EXECUTE format('CREATE TRIGGER tenant_owner BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.pos_tenant_owner_immutable()',model_name);
 END LOOP;
END $$;
COMMIT;
