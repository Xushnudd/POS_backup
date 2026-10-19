-- One online index per migration; no implicit multi-statement transaction.
CREATE INDEX CONCURRENTLY "Sale_customerId_completedAt_idx" ON "Sale" ("customerId","completedAt");
