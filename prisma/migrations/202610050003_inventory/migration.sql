BEGIN;
ALTER TABLE "StockTransferItem" ADD COLUMN "receivedQuantity" DECIMAL(20,6) NOT NULL DEFAULT 0;
UPDATE "StockTransferItem" i SET "receivedQuantity"=i.quantity FROM "StockTransfer" t WHERE t.id=i."stockTransferId" AND t.status='received';
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_received_range" CHECK("receivedQuantity">=0 AND "receivedQuantity"<=quantity);
CREATE INDEX "Sale_org_completed_idx" ON "Sale"("organizationId","completedAt");
CREATE INDEX "InventoryMovement_org_store_created_idx" ON "InventoryMovement"("organizationId","storeId","occurredAt");
CREATE INDEX "Payment_org_shift_created_idx" ON "Payment"("organizationId","shiftId","createdAt");
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_amounts_check" CHECK(subtotal>=0 AND "discountAmount">=0 AND "discountAmount"<=subtotal AND "totalAmount"=subtotal-"discountAmount");
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_amounts_check" CHECK(quantity>0 AND "unitPrice">=0 AND "discountAmount">=0 AND "lineTotal">=0 AND "receiptDiscount">=0 AND "receiptDiscount"<="lineTotal");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_check" CHECK(amount>0 AND direction IN ('in','out'));
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_amount_check" CHECK(amount>0 AND "movementType" IN ('cash_in','cash_out'));

COMMIT;
