-- One online index per migration; no implicit multi-statement transaction.
CREATE INDEX CONCURRENTLY "SaleItem_productId_idx" ON "SaleItem" ("productId");
