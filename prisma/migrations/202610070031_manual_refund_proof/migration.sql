-- A manual refund journal is not a provider confirmation. Preserve the actual
-- settlement channel and prevent posting one bank document twice with new keys.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_manual_refund_proof_check"
CHECK (NOT (direction='out' AND "paymentType" IN ('card','transfer') AND note LIKE 'return:%')
 OR (status='recorded' AND "referenceNo" IS NOT NULL AND length(btrim("referenceNo")) BETWEEN 3 AND 200));
CREATE UNIQUE INDEX "Payment_manual_refund_reference_unique"
ON "Payment" ("organizationId","paymentType","referenceNo")
WHERE direction='out' AND "paymentType" IN ('card','transfer') AND note LIKE 'return:%';
