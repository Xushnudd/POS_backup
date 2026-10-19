-- SQL CHECK treats UNKNOWN as passing; require a non-null cancellation reason.
ALTER TABLE "ReceiptCostPlan" ADD CONSTRAINT "ReceiptCostPlan_cancel_reason_check"
 CHECK(status<>'cancelled' OR ("cancellationReason" IS NOT NULL AND length(btrim("cancellationReason")) BETWEEN 3 AND 2000));
