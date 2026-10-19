ALTER TABLE "OfflineCashLease" ADD CONSTRAINT offline_cash_signed_sale_id CHECK(payload->>'saleId' IS NOT NULL AND payload->>'saleId'="saleId") NOT VALID;
