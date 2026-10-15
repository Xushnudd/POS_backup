// Every model is explicitly classified. Shared identities/configuration require separate authorization.
export const TENANT_DIRECT_MODELS = [
  "ConsentEvent",
  "LoyaltyCard",
  "LoyaltyPromotion",
  "LoyaltyBenefitSelection",
  "GiftCertificate",
  "GiftCheckout",
  "LoyaltyPolicyVersion",
  "LoyaltyPointLot",
  "LoyaltyPointEntry",
  "LoyaltyRedemption",
  "LoyaltyRecoveryTransfer",
  "ReportSchedule",
  "ReportScheduleRun",
  "OrganizationUser",
  "CustomRole",
  "Store",
  "ReceiptCostPlan",
  "ReceiptCostApplication",
  "ReceiptCostContinuation",
  "Category",
  "Product",
  "Customer",
  "Supplier",
  "StockDocument",
  "InventoryMovement",
  "SerialNumber",
  "SerialEvent",
  "Warranty",
  "WarrantyService",
  "InventoryBatch",
  "InventoryBatchEntry",
  "InventoryBatchDisposition",
  "InventoryValuationSequence",
  "InventoryValuationEvent",
  "StockTransfer",
  "TransferDispositionEntry",
  "SupportGrant",
  "ShiftCorrection",
  "Sale",
  "Payment",
  "DiscountPolicy",
  "AuditLog",
  "Session",
  "Operation",
  "ProviderIntent",
  "DebtEntry",
  "Invitation",
  "Unit",
  "ProductBarcode",
  "StockCount",
  "OwnershipTransfer",
  "Incident",
  "SyncReview",
  "StockThreshold",
  "ProductPriceHistory",
  "DamageLocation",
  "ReturnDispositionEntry",
  "FinancialAccount",
  "ExpenseCategory",
  "FinancialDocument",
  "AccountEntry",
  "SupplierInvoice",
  "SupplierPayment",
  "PurchaseOrder",
  "ProductVariant",
  "FileAsset",
  "Brand",
  "TaxProfile",
  "TaxProfileVersion",
  "CustomerGroup",
  "PriceRule",
  "StockLocation",
  "LocationBalance",
  "LocationEntry",
  "StockReservation",
  "ReservationItem",
  "ReservationEntry",
  "OfflineCashPolicy",
  "OfflineCashLease",
  "OnboardingCheckpoint",
  "SaleExchange",
  "JobExport",
  "BackgroundJob",
  "JobAuthorization",
  "SecurityEvent",
  "ProductUnitConversion",
  "CustomerAdvance",
  "OrganizationSubscription",
  "BillingInvoice",
  "BillingPayment",
  "IntegrationCost",
  "SupportTicket",
  "SupportTicketEvent",
  "OrganizationClosure"
] as const
export const TENANT_PARENT_MODELS:Readonly<Record<string,readonly [string,string]>> = {
  "UserStore": [
    "OrganizationUser",
    "organizationUserId"
  ],
  "Register": [
    "Store",
    "storeId"
  ],
  "StockDocumentItem": [
    "StockDocument",
    "stockDocumentId"
  ],
  "InventoryBalance": [
    "Store",
    "storeId"
  ],
  "StockTransferItem": [
    "StockTransfer",
    "stockTransferId"
  ],
  "Shift": [
    "Register",
    "registerId"
  ],
  "CashMovement": [
    "Shift",
    "shiftId"
  ],
  "SaleItem": [
    "Sale",
    "saleId"
  ],
  "SaleReturn": [
    "Sale",
    "saleId"
  ],
  "SaleReturnItem": [
    "SaleReturn",
    "saleReturnId"
  ],
  "StockCountLine": [
    "StockCount",
    "countId"
  ],
  "StockCountReading": [
    "StockCountLine",
    "lineId"
  ],
  "StockFreeze": [
    "Store",
    "storeId"
  ],
  "SupplierAllocation": [
    "SupplierInvoice",
    "invoiceId"
  ],
  "PurchaseOrderItem": [
    "PurchaseOrder",
    "orderId"
  ],
  "PurchaseReceipt": [
    "PurchaseOrder",
    "orderId"
  ],
  "PurchaseReceiptLine": [
    "PurchaseReceipt",
    "receiptId"
  ],
  "SupplierCredit": [
    "SupplierInvoice",
    "invoiceId"
  ],
  "SupplierCreditItem": [
    "SupplierCredit",
    "creditId"
  ],
  "SupplierAllocationRelease": [
    "SupplierAllocation",
    "allocationId"
  ],
  "CustomerAdvanceAllocation": [
    "CustomerAdvance",
    "advanceId"
  ],
  "CustomerAdvanceRefund": [
    "CustomerAdvance",
    "advanceId"
  ],
  "ProviderOutbox": [
    "ProviderIntent",
    "intentId"
  ],
  "ProviderEvent": [
    "ProviderIntent",
    "intentId"
  ],
  "JobEvent": [
    "BackgroundJob",
    "jobId"
  ],
  "SecurityNoticeOutbox": [
    "SecurityEvent",
    "eventId"
  ],
  "SecurityNotice": [
    "SecurityEvent",
    "eventId"
  ]
}
export const SHARED_MODELS = [
  "User",
  "PlatformOperator",
  "RateLimit",
  "BillingPlanVersion",
  "BillingPlan",
  "AuthChallenge",
  "VerifiedContact",
  "SupportPolicyVersion",
  "RetentionPolicyVersion",
  "RetentionPolicy",
  "TotpFactor",
  "TotpProof",
  "TotpRecoveryCode",
  "TotpKeyRotation",
  "AuthRestoreCheckpoint"
] as const
export const TENANT_PARENT_SCOPES:Readonly<Record<string,readonly [string,string]>> = {
  "UserStore": [
    "OrganizationUser",
    "organizationUser"
  ],
  "Register": [
    "Store",
    "store"
  ],
  "StockDocumentItem": [
    "StockDocument",
    "stockDocument"
  ],
  "InventoryBalance": [
    "Store",
    "store"
  ],
  "StockTransferItem": [
    "StockTransfer",
    "stockTransfer"
  ],
  "Shift": [
    "Register",
    "register"
  ],
  "CashMovement": [
    "Shift",
    "shift"
  ],
  "SaleItem": [
    "Sale",
    "sale"
  ],
  "SaleReturn": [
    "Sale",
    "sale"
  ],
  "SaleReturnItem": [
    "SaleReturn",
    "saleReturn"
  ],
  "StockCountLine": [
    "StockCount",
    "count"
  ],
  "StockCountReading": [
    "StockCountLine",
    "line"
  ],
  "StockFreeze": [
    "Store",
    "store"
  ],
  "SupplierAllocation": [
    "SupplierInvoice",
    "invoice"
  ],
  "PurchaseOrderItem": [
    "PurchaseOrder",
    "order"
  ],
  "PurchaseReceipt": [
    "PurchaseOrder",
    "order"
  ],
  "PurchaseReceiptLine": [
    "PurchaseReceipt",
    "receipt"
  ],
  "SupplierCredit": [
    "SupplierInvoice",
    "invoice"
  ],
  "SupplierCreditItem": [
    "SupplierCredit",
    "credit"
  ],
  "SupplierAllocationRelease": [
    "SupplierAllocation",
    "allocation"
  ],
  "CustomerAdvanceAllocation": [
    "CustomerAdvance",
    "advance"
  ],
  "CustomerAdvanceRefund": [
    "CustomerAdvance",
    "advance"
  ],
  "ProviderOutbox": [
    "ProviderIntent",
    "intent"
  ],
  "ProviderEvent": [
    "ProviderIntent",
    "intent"
  ],
  "JobEvent": [
    "BackgroundJob",
    "job"
  ],
  "SecurityNoticeOutbox": [
    "SecurityEvent",
    "event"
  ],
  "SecurityNotice": [
    "SecurityEvent",
    "event"
  ]
}
