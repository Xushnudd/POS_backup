-- Single statement: PostgreSQL multi-statement scripts form an implicit transaction.
CREATE INDEX CONCURRENTLY "SaleItem_saleId_productId_idx" ON "SaleItem" ("saleId","productId");
