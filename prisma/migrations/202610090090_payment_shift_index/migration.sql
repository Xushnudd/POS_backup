-- One concurrent statement per migration; no implicit multi-statement transaction.
CREATE INDEX CONCURRENTLY "Payment_shiftId_paymentType_status_idx" ON "Payment"("shiftId","paymentType",status);
