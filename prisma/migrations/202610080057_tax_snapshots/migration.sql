CREATE TABLE "TaxProfile" (id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,name TEXT NOT NULL,"isActive" BOOLEAN NOT NULL DEFAULT TRUE,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,UNIQUE("organizationId",name),UNIQUE(id,"organizationId"),CHECK(length(name) BETWEEN 2 AND 200));
CREATE TABLE "TaxProfileVersion" (id TEXT PRIMARY KEY,"profileId" TEXT NOT NULL,"organizationId" TEXT NOT NULL,mode TEXT NOT NULL,rate DECIMAL(5,2) NOT NULL,"exemptionReason" TEXT,"effectiveAt" TIMESTAMP(3) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"createdBy" TEXT NOT NULL REFERENCES "User"(id),FOREIGN KEY("profileId","organizationId") REFERENCES "TaxProfile"(id,"organizationId") ON DELETE CASCADE,UNIQUE("profileId","effectiveAt"),CHECK(mode IN ('included','excluded','exempt') AND rate BETWEEN 0 AND 100 AND (mode<>'exempt' OR (rate=0 AND "exemptionReason" IS NOT NULL AND length("exemptionReason") BETWEEN 3 AND 2000))));
CREATE INDEX "TaxProfileVersion_organizationId_effectiveAt_idx" ON "TaxProfileVersion"("organizationId","effectiveAt");
ALTER TABLE "Product" ADD COLUMN "taxProfileId" TEXT;
ALTER TABLE "Product" ADD CONSTRAINT "Product_tax_profile_scope" FOREIGN KEY("taxProfileId","organizationId") REFERENCES "TaxProfile"(id,"organizationId") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Sale" ADD COLUMN "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,ADD COLUMN "netAmount" DECIMAL(14,2);
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_amounts_check";
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_amounts_check" CHECK(subtotal>=0 AND "discountAmount">=0 AND "discountAmount"<=subtotal AND "taxAmount">=0 AND "totalAmount">=subtotal-"discountAmount" AND (("netAmount" IS NULL AND "taxAmount"=0 AND "totalAmount"=subtotal-"discountAmount") OR ("netAmount">=0 AND "totalAmount"="netAmount"+"taxAmount")));
ALTER TABLE "SaleItem" ADD COLUMN "taxVersionId" TEXT REFERENCES "TaxProfileVersion"(id) ON DELETE NO ACTION,ADD COLUMN "taxMode" TEXT NOT NULL DEFAULT 'unconfigured',ADD COLUMN "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,ADD COLUMN "taxBase" DECIMAL(14,2),ADD COLUMN "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,ADD COLUMN "payableAmount" DECIMAL(14,2),ADD COLUMN "roundingVersion" TEXT NOT NULL DEFAULT 'legacy-unspecified';
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_tax_arithmetic" CHECK (("roundingVersion"='legacy-unspecified' AND "taxVersionId" IS NULL AND "taxMode"='unconfigured' AND "taxRate"=0 AND "taxAmount"=0 AND "taxBase" IS NULL AND "payableAmount" IS NULL) OR ("roundingVersion"='money-half-up-2-v1' AND "taxMode" IN ('unconfigured','included','excluded','exempt') AND "taxRate" BETWEEN 0 AND 100 AND "taxBase" IS NOT NULL AND "payableAmount" IS NOT NULL AND "taxBase">=0 AND "taxAmount">=0 AND "payableAmount"="taxBase"+"taxAmount" AND "taxBase"=CASE WHEN "taxMode"='included' THEN round(("lineTotal"-"receiptDiscount")/(1+"taxRate"/100),2) ELSE "lineTotal"-"receiptDiscount" END AND "taxAmount"=CASE WHEN "taxMode"='included' THEN "lineTotal"-"receiptDiscount"-"taxBase" WHEN "taxMode"='excluded' THEN round("taxBase"*"taxRate"/100,2) ELSE 0 END AND ("taxMode"<>'unconfigured' OR ("taxVersionId" IS NULL AND "taxRate"=0)) AND ("taxMode" NOT IN ('included','excluded','exempt') OR "taxVersionId" IS NOT NULL)));
ALTER TABLE "SaleReturnItem" ADD COLUMN "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,ADD COLUMN "taxBase" DECIMAL(14,2),ADD COLUMN "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_tax_amounts" CHECK("taxAmount">=0 AND "discountAmount">=0 AND (("taxBase" IS NULL AND "taxAmount"=0) OR ("taxBase">=0 AND "lineTotal"="taxBase"+"taxAmount")));
CREATE FUNCTION guard_tax_profile_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN
  IF TG_TABLE_NAME='TaxProfileVersion' OR TG_OP='DELETE' THEN RAISE EXCEPTION 'Tax history is immutable' USING ERRCODE='23514'; END IF;
  IF (NEW.id,NEW."organizationId",NEW."createdAt") IS DISTINCT FROM (OLD.id,OLD."organizationId",OLD."createdAt") THEN RAISE EXCEPTION 'Tax profile identity is immutable' USING ERRCODE='23514'; END IF;
 END IF;
 IF TG_TABLE_NAME='TaxProfileVersion' THEN IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM "OrganizationUser" m JOIN "User" u ON u.id=m."userId" WHERE m."organizationId"=NEW."organizationId" AND m."userId"=NEW."createdBy" AND m.role='owner' AND m."isActive" AND u."isActive") THEN RAISE EXCEPTION 'Tax policy requires active owner' USING ERRCODE='23514'; END IF;END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END $$;
CREATE TRIGGER "TaxProfile_history" BEFORE INSERT OR UPDATE OR DELETE ON "TaxProfile" FOR EACH ROW EXECUTE FUNCTION guard_tax_profile_history();
CREATE TRIGGER "TaxProfileVersion_history" BEFORE INSERT OR UPDATE OR DELETE ON "TaxProfileVersion" FOR EACH ROW EXECUTE FUNCTION guard_tax_profile_history();
CREATE FUNCTION guard_sale_tax_reference() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."taxVersionId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "TaxProfileVersion" v JOIN "Sale" s ON s.id=NEW."saleId" WHERE v.id=NEW."taxVersionId" AND v."organizationId"=s."organizationId" AND v.rate=NEW."taxRate" AND v.mode=NEW."taxMode") THEN RAISE EXCEPTION 'Tax snapshot reference mismatch' USING ERRCODE='23514'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER "SaleItem_tax_reference" BEFORE INSERT OR UPDATE ON "SaleItem" FOR EACH ROW EXECUTE FUNCTION guard_sale_tax_reference();
CREATE FUNCTION check_sale_tax_totals() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE sale_id TEXT;s "Sale"%ROWTYPE;BEGIN
 IF TG_TABLE_NAME='Sale' THEN sale_id=COALESCE(NEW.id,OLD.id);ELSE sale_id=COALESCE(NEW."saleId",OLD."saleId");END IF;
 SELECT * INTO s FROM "Sale" WHERE id=sale_id;
 IF s."netAmount" IS NOT NULL AND s.status IN ('completed','partially_returned','returned') AND (NOT EXISTS(SELECT 1 FROM "SaleItem" WHERE "saleId"=sale_id) OR EXISTS(SELECT 1 FROM "SaleItem" WHERE "saleId"=sale_id AND "roundingVersion"<>'money-half-up-2-v1') OR (s.subtotal,s."discountAmount",s."taxAmount",s."netAmount",s."totalAmount") IS DISTINCT FROM (SELECT ROW(sum("lineTotal"),sum("receiptDiscount"),sum("taxAmount"),sum("taxBase"),sum("payableAmount")) FROM "SaleItem" WHERE "saleId"=sale_id)) THEN RAISE EXCEPTION 'Sale tax totals mismatch' USING ERRCODE='23514';END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "Sale_tax_totals" AFTER INSERT OR UPDATE ON "Sale" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_sale_tax_totals();
CREATE CONSTRAINT TRIGGER "SaleItem_tax_totals" AFTER INSERT OR UPDATE OR DELETE ON "SaleItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_sale_tax_totals();
CREATE FUNCTION check_return_tax_totals() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE item_id TEXT;i "SaleItem"%ROWTYPE;q NUMERIC;t NUMERIC;d NUMERIC;BEGIN
 item_id=COALESCE(NEW."saleItemId",OLD."saleItemId");SELECT * INTO i FROM "SaleItem" WHERE id=item_id;
 IF i."taxBase" IS NOT NULL THEN SELECT COALESCE(sum(quantity),0),COALESCE(sum("taxAmount"),0),COALESCE(sum("discountAmount"),0) INTO q,t,d FROM "SaleReturnItem" WHERE "saleItemId"=item_id;
  IF t>i."taxAmount" OR d>i."discountAmount"+i."receiptDiscount" OR (q=i.quantity AND (t<>i."taxAmount" OR d<>i."discountAmount"+i."receiptDiscount")) THEN RAISE EXCEPTION 'Return tax/discount remainder mismatch' USING ERRCODE='23514';END IF;
 END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "SaleReturnItem_tax_totals" AFTER INSERT ON "SaleReturnItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_return_tax_totals();
