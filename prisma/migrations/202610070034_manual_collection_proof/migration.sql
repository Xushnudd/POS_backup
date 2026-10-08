-- Operator documents never confirm a provider result. One manual bank document
-- cannot settle customer debt twice under different operation keys.
CREATE UNIQUE INDEX "Payment_manual_collection_document_key"
 ON "Payment" ("organizationId", "paymentType", (btrim("referenceNo")))
 WHERE "sourceType"='manual' AND "direction"='in' AND "note"='debt_collection'
 AND "paymentType" IN ('card','transfer') AND "referenceNo" IS NOT NULL AND length(btrim("referenceNo"))>0;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_manual_card_collection_proof_check"
 CHECK (NOT ("sourceType"='manual' AND "direction"='in' AND "note"='debt_collection' AND "paymentType"='card')
 OR ("referenceNo" IS NOT NULL AND length(trim("referenceNo")) BETWEEN 3 AND 200));
