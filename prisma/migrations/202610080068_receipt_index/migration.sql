-- One online index per migration; no implicit multi-statement transaction.
CREATE INDEX CONCURRENTLY "SaleItem_priceRuleId_idx" ON "SaleItem" ("priceRuleId");
