ALTER TABLE "Supplier" ADD COLUMN "bankName" TEXT, ADD COLUMN "bankAccount" TEXT, ADD COLUMN "paymentTerms" TEXT;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_commercial_fields_length"
CHECK (("bankName" IS NULL OR length("bankName")<=200)
 AND ("bankAccount" IS NULL OR length("bankAccount")<=128)
 AND ("paymentTerms" IS NULL OR length("paymentTerms")<=2000));
