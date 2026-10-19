-- Use native composite FKs without duplicate lookups; protect only referenced keys.
BEGIN;
CREATE OR REPLACE FUNCTION pos_tenant_root(model_name text, row_data jsonb) RETURNS text
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
 EXECUTE format('SELECT to_jsonb(p) FROM public.%I p WHERE id=$1 FOR KEY SHARE',parent_model) INTO parent_row USING row_data->>parent_key;
 IF parent_row IS NULL THEN RETURN NULL; END IF;
 RETURN public.pos_tenant_root(parent_model,parent_row);
END $$;
CREATE OR REPLACE FUNCTION pos_check_tenant_edges(model_name text,row_data jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE tenant text; related text; edge record; target_row jsonb; predicates text;
BEGIN
 tenant:=public.pos_tenant_root(model_name,row_data);
 IF tenant IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Missing tenant root'; END IF;
 FOR edge IN SELECT c.conkey,c.confkey,c.confrelid,r.relname AS target FROM pg_constraint c JOIN pg_class r ON r.oid=c.confrelid WHERE c.contype='f' AND c.conrelid=format('public.%I',model_name)::regclass LOOP
  -- Global identities/configuration have independent authorization policies.
  IF public.pos_tenant_expression(edge.target,'t')='NULL::text' THEN CONTINUE; END IF;
  -- Native organization FK already proves this root reference.
  IF edge.target='Organization' AND array_length(edge.conkey,1)=1 AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=format('public.%I',model_name)::regclass AND a.attnum=edge.conkey[1] AND a.attname='organizationId') THEN CONTINUE; END IF;
  -- A native composite FK that contains exactly this edge plus the matching
  -- organizationId pair is stronger than a second trigger lookup. Do not skip
  -- child roots or unrelated keys merely because both rows have an org column.
  IF EXISTS(
   SELECT 1 FROM pg_constraint c2
   JOIN pg_attribute sa ON sa.attrelid=c2.conrelid AND sa.attname='organizationId'
   JOIN pg_attribute ta ON ta.attrelid=c2.confrelid AND ta.attname='organizationId'
   WHERE c2.contype='f' AND c2.conrelid=format('public.%I',model_name)::regclass AND c2.confrelid=edge.confrelid
    AND EXISTS(SELECT 1 FROM unnest(c2.conkey,c2.confkey) p(s,t) WHERE p.s=sa.attnum AND p.t=ta.attnum)
    AND NOT EXISTS(SELECT 1 FROM unnest(edge.conkey,edge.confkey) e(s,t) WHERE NOT EXISTS(SELECT 1 FROM unnest(c2.conkey,c2.confkey) p(s,t) WHERE p.s=e.s AND p.t=e.t))
  ) THEN CONTINUE; END IF;
  SELECT string_agg(format('p.%I::text = ($1->>%L)',ta.attname,sa.attname),' AND ' ORDER BY k.n) INTO predicates
  FROM unnest(edge.conkey,edge.confkey) WITH ORDINALITY k(s,t,n)
  JOIN pg_attribute sa ON sa.attrelid=format('public.%I',model_name)::regclass AND sa.attnum=k.s
  JOIN pg_attribute ta ON ta.attrelid=edge.confrelid AND ta.attnum=k.t;
  EXECUTE format('SELECT to_jsonb(p) FROM public.%I p WHERE %s FOR KEY SHARE',edge.target,predicates) INTO target_row USING row_data;
  -- NULL optional references / pending deferred references are handled by the FK.
  IF target_row IS NOT NULL THEN
   related:=public.pos_tenant_root(edge.target,target_row);
   IF related IS NOT NULL AND related<>tenant THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Cross-tenant relationship rejected'; END IF;
  END IF;
 END LOOP;
END $$;
COMMIT;
