ALTER TABLE "Sale" ADD COLUMN "discountPercent" decimal(5,2),ADD COLUMN "discountReason" text,ADD COLUMN "discountApprovedBy" text,ADD COLUMN "discountApprovedRole" text,ADD COLUMN "discountApprovedAt" timestamp(3),ADD COLUMN "discountPolicySnapshot" jsonb;
ALTER TABLE "SaleItem" ADD COLUMN "discountPercent" decimal(5,2);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_discount_percent_check" CHECK ("discountPercent" IS NULL OR "discountPercent" BETWEEN 0 AND 100), ADD CONSTRAINT "Sale_discount_actor_check" CHECK (("discountApprovedBy" IS NULL AND "discountApprovedRole" IS NULL AND "discountApprovedAt" IS NULL) OR ("discountApprovedBy" IS NOT NULL AND "discountApprovedRole" IS NOT NULL AND "discountApprovedRole" IN ('owner','admin','cashier') AND "discountApprovedAt" IS NOT NULL));
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_discount_percent_check" CHECK ("discountPercent" IS NULL OR "discountPercent" BETWEEN 0 AND 100);
CREATE FUNCTION guard_discount_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."discountApprovedBy" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "OrganizationUser" m JOIN "User" u ON u.id=m."userId" WHERE m."organizationId"=NEW."organizationId" AND m."userId"=NEW."discountApprovedBy" AND m.role=NEW."discountApprovedRole" AND m."isActive" AND u."isActive") THEN RAISE EXCEPTION 'Discount authorization actor must be active same-tenant member'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Sale_discount_actor_guard" BEFORE INSERT OR UPDATE OF "discountApprovedBy","discountApprovedRole","discountApprovedAt" ON "Sale" FOR EACH ROW EXECUTE FUNCTION guard_discount_authorization();

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_discount_percent_amount_check" CHECK ("discountPercent" IS NULL OR "discountAmount"=round(subtotal*"discountPercent"/100,2));
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_discount_percent_amount_check" CHECK ("discountPercent" IS NULL OR "discountAmount"=round(round(quantity*"unitPrice",2)*"discountPercent"/100,2));
