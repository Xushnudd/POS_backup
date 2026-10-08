-- Current application writes manual/cash journals only. Future trusted provider
-- postings must explicitly declare provenance; recorded is not a provider state.
ALTER TABLE "Payment" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_source_type_check" CHECK ("sourceType" IN ('manual','provider'));
