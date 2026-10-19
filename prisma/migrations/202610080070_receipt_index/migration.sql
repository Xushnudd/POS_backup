-- One online index per migration; no implicit multi-statement transaction.
CREATE INDEX CONCURRENTLY "SaleReturn_saleId_returnedAt_idx" ON "SaleReturn" ("saleId","returnedAt");
