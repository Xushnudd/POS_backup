-- Each branch balance is decimal(20,6); the organization-wide initial position
-- is their SUM and must not truncate or block legitimate original postings.
-- Widen only the immutable provenance snapshot. No stock or cost is rewritten.
ALTER TABLE "InventoryValuationSequence"
  ALTER COLUMN "baselineQuantity" TYPE decimal(30,6);
