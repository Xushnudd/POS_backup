-- PostgreSQL does not automatically index foreign keys. Receipt journal guards
-- must read one sale's payment range instead of predicate-locking all payments.
-- Keep this migration outside BEGIN: live tables retain writes during indexing.
CREATE INDEX CONCURRENTLY "Payment_saleId_idx" ON "Payment"("saleId");
