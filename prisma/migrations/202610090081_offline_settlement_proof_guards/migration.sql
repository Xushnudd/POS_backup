-- PostgreSQL CHECK accepts NULL: require every owner-evidence key explicitly.
ALTER TABLE "OfflineCashLease" ADD CONSTRAINT offline_settlement_required_keys CHECK(
 "settlementProof" IS NULL OR COALESCE(
 jsonb_typeof("settlementProof")='object' AND
 "settlementProof" ?& ARRAY['approvedBy','leaseId','cashOperationId','originalUserId','originalSessionId','quotedSnapshotHash','goodsDeliveredAndNetCashReceived','reason','evidenceReference','observedSaleAt','cashTendered','serverRecordedAt','resolution','accountingTime','priceAndTax','quotedTotal','operationId'] AND
 "settlementProof"->>'originalSessionId'="sessionId" AND
 "settlementProof"->>'quotedTotal'=payload->>'totalAmount' AND
 "settlementProof"->>'resolution'='owner_verified_original_goods_cash_recorded' AND
 "settlementProof"->>'accountingTime'='server_posting_time' AND
 "settlementProof"->>'priceAndTax'='original_server_quote_honored' AND
 ("settlementProof"->>'observedSaleAt')::timestamptz >= ("createdAt" AT TIME ZONE 'UTC') AND
 ("settlementProof"->>'observedSaleAt')::timestamptz < ("expiresAt" AT TIME ZONE 'UTC') AND
 ("settlementProof"->>'observedSaleAt')::timestamptz <= ("settledAt" AT TIME ZONE 'UTC'),FALSE));
