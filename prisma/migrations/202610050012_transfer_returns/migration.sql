BEGIN;
ALTER TABLE "StockTransferItem" ADD COLUMN "returnedQuantity" DECIMAL(20,6) NOT NULL DEFAULT 0;
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transit_quantities" CHECK ("receivedQuantity">=0 AND "returnedQuantity">=0 AND "receivedQuantity"+"returnedQuantity"<=quantity);
COMMIT;
