-- Keep original-bound NO ACTION history while permitting whole-organization cascade.
ALTER TABLE "PurchaseOrder" ALTER CONSTRAINT "PurchaseOrder_storeId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PurchaseOrder" ALTER CONSTRAINT "PurchaseOrder_supplierId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PurchaseOrder" ALTER CONSTRAINT "PurchaseOrder_createdBy_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PurchaseOrderItem" ALTER CONSTRAINT "PurchaseOrderItem_productId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PurchaseReceipt" ALTER CONSTRAINT "PurchaseReceipt_stockDocumentId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PurchaseReceiptLine" ALTER CONSTRAINT "PurchaseReceiptLine_orderItemId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PurchaseReceiptLine" ALTER CONSTRAINT "PurchaseReceiptLine_stockDocumentItemId_fkey" DEFERRABLE INITIALLY DEFERRED;
