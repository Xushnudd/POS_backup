-- One online index per migration; no implicit multi-statement transaction.
CREATE INDEX CONCURRENTLY "SaleReturnItem_productId_idx" ON "SaleReturnItem" ("productId");
