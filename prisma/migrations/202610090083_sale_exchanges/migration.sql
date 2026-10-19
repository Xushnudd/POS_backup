CREATE TABLE "SaleExchange" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "storeId" TEXT NOT NULL REFERENCES "Store"(id),"originalSaleId" TEXT NOT NULL REFERENCES "Sale"(id),
 "saleReturnId" TEXT NOT NULL UNIQUE REFERENCES "SaleReturn"(id),"replacementSaleId" TEXT NOT NULL UNIQUE REFERENCES "Sale"(id),
 "actorId" TEXT NOT NULL REFERENCES "User"(id),"cashDifference" NUMERIC(14,2) NOT NULL,"debtDifference" NUMERIC(14,2) NOT NULL,
 "cashTendered" NUMERIC(14,2) NOT NULL,"cashChange" NUMERIC(14,2) NOT NULL,"settlementSnapshot" JSONB NOT NULL,
 reason TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK("originalSaleId"<>"replacementSaleId"),CHECK(jsonb_typeof("settlementSnapshot")='object'),
 CHECK(length(reason) BETWEEN 3 AND 2000),CHECK("cashTendered">=0 AND "cashChange">=0),
 CHECK(("cashDifference">0 AND "cashTendered">="cashDifference" AND "cashChange"="cashTendered"-"cashDifference") OR ("cashDifference"<=0 AND "cashTendered"=0 AND "cashChange"=0))
);
CREATE INDEX "SaleExchange_organizationId_storeId_createdAt_idx" ON "SaleExchange"("organizationId","storeId","createdAt");
CREATE FUNCTION sale_exchange_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE old_sale "Sale"%ROWTYPE;new_sale "Sale"%ROWTYPE;ret "SaleReturn"%ROWTYPE; BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'Exchange history immutable';END IF;RETURN OLD;END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Exchange history immutable';END IF;
 SELECT * INTO old_sale FROM "Sale" WHERE id=NEW."originalSaleId";SELECT * INTO new_sale FROM "Sale" WHERE id=NEW."replacementSaleId";SELECT * INTO ret FROM "SaleReturn" WHERE id=NEW."saleReturnId";
 IF old_sale."organizationId"<>NEW."organizationId" OR new_sale."organizationId"<>NEW."organizationId" OR old_sale."storeId"<>NEW."storeId" OR new_sale."storeId"<>NEW."storeId" OR ret."saleId"<>old_sale.id OR new_sale.status<>'completed' OR new_sale."cashierId"<>NEW."actorId" OR ret."processedBy"<>NEW."actorId" OR NOT EXISTS(SELECT 1 FROM "OrganizationUser" m JOIN "User" u ON u.id=m."userId" WHERE m."organizationId"=NEW."organizationId" AND m."userId"=NEW."actorId" AND m.role IN ('owner','admin') AND m."isActive" AND u."isActive") THEN RAISE EXCEPTION 'Exchange source/scope/actor invalid';END IF;
 IF EXISTS(SELECT 1 FROM "Payment" WHERE "saleId"=new_sale.id AND ("paymentType" NOT IN ('cash','credit') OR "sourceType"<>'manual')) THEN RAISE EXCEPTION 'Exchange requires internal cash/credit';END IF;
 IF NEW."cashDifference"<>COALESCE((SELECT sum(amount) FROM "Payment" WHERE "saleId"=new_sale.id AND "paymentType"='cash' AND direction='in'),0)-COALESCE((SELECT sum(amount) FROM "Payment" WHERE "saleId"=old_sale.id AND "paymentType"='cash' AND direction='out' AND note='return:'||ret.id),0) THEN RAISE EXCEPTION 'Exchange cash difference invalid';END IF;
 IF NEW."debtDifference"<>COALESCE((SELECT sum(amount) FROM "DebtEntry" WHERE "saleId"=new_sale.id),0)+COALESCE((SELECT sum(amount) FROM "DebtEntry" WHERE "saleId"=old_sale.id AND "sourceId"=ret.id AND "sourceType" IN ('return','write_off_reversal')),0) THEN RAISE EXCEPTION 'Exchange debt difference invalid';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sale_exchange_guard BEFORE INSERT OR UPDATE OR DELETE ON "SaleExchange" FOR EACH ROW EXECUTE FUNCTION sale_exchange_guard();
