-- One online index per migration; no implicit multi-statement transaction.
CREATE INDEX CONCURRENTLY "SaleReturnItem_saleItemId_idx" ON "SaleReturnItem" ("saleItemId");
