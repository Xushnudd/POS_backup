BEGIN;
CREATE OR REPLACE FUNCTION pos_tenant_root(model_name text, row_data jsonb) RETURNS text
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE parent_model text; parent_key text; parent_row jsonb; tenant text;
BEGIN
 IF model_name='Organization' THEN RETURN row_data->>'id'; END IF;
 IF model_name IN ('ReceiptCostApplication','InventoryValuationSequence','InventoryValuationEvent','InventoryBatch','InventoryBatchEntry','InventoryBatchDisposition','OrganizationUser','CustomRole','Store','ReceiptCostPlan','Category','Product','Customer','Supplier','StockDocument','InventoryMovement','StockTransfer','TransferDispositionEntry','SupportGrant','ShiftCorrection','Sale','Payment','DiscountPolicy','AuditLog','Session','Operation','ProviderIntent','DebtEntry','Invitation','Unit','ProductBarcode','StockCount','OwnershipTransfer','Incident','SyncReview','StockThreshold','ProductPriceHistory','DamageLocation','ReturnDispositionEntry','FinancialAccount','ExpenseCategory','FinancialDocument','AccountEntry','SupplierInvoice','SupplierPayment','PurchaseOrder','ProductVariant','FileAsset','Brand','TaxProfile','TaxProfileVersion','CustomerGroup','PriceRule','StockLocation','LocationBalance','LocationEntry','StockReservation','ReservationItem','ReservationEntry','OfflineCashPolicy','OfflineCashLease','OnboardingCheckpoint','SaleExchange','JobExport','BackgroundJob','JobAuthorization','SecurityEvent','ProductUnitConversion','CustomerAdvance','OrganizationSubscription','BillingInvoice','BillingPayment','IntegrationCost','SupportTicket','SupportTicketEvent','OrganizationClosure') THEN RETURN row_data->>'organizationId'; END IF;
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
 IF model_name IN ('ReceiptCostApplication','InventoryValuationSequence','InventoryValuationEvent','InventoryBatch','InventoryBatchEntry','InventoryBatchDisposition','OrganizationUser','CustomRole','Store','ReceiptCostPlan','Category','Product','Customer','Supplier','StockDocument','InventoryMovement','StockTransfer','TransferDispositionEntry','SupportGrant','ShiftCorrection','Sale','Payment','DiscountPolicy','AuditLog','Session','Operation','ProviderIntent','DebtEntry','Invitation','Unit','ProductBarcode','StockCount','OwnershipTransfer','Incident','SyncReview','StockThreshold','ProductPriceHistory','DamageLocation','ReturnDispositionEntry','FinancialAccount','ExpenseCategory','FinancialDocument','AccountEntry','SupplierInvoice','SupplierPayment','PurchaseOrder','ProductVariant','FileAsset','Brand','TaxProfile','TaxProfileVersion','CustomerGroup','PriceRule','StockLocation','LocationBalance','LocationEntry','StockReservation','ReservationItem','ReservationEntry','OfflineCashPolicy','OfflineCashLease','OnboardingCheckpoint','SaleExchange','JobExport','BackgroundJob','JobAuthorization','SecurityEvent','ProductUnitConversion','CustomerAdvance','OrganizationSubscription','BillingInvoice','BillingPayment','IntegrationCost','SupportTicket','SupportTicketEvent','OrganizationClosure') THEN RETURN format('%I."organizationId"',row_alias); END IF;
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

CREATE TRIGGER tenant_owner BEFORE UPDATE ON "ReceiptCostApplication" FOR EACH ROW EXECUTE FUNCTION pos_tenant_owner_immutable();
CREATE CONSTRAINT TRIGGER tenant_edges AFTER INSERT OR UPDATE ON "ReceiptCostApplication" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_tenant_edge_trigger();
COMMIT;
