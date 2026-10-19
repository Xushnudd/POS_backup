-- One online index per migration; no implicit multi-statement transaction.
CREATE INDEX CONCURRENTLY "SaleReturnItem_saleReturnId_idx" ON "SaleReturnItem" ("saleReturnId");
