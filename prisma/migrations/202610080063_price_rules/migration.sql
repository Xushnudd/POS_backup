ALTER TABLE "Customer" ADD COLUMN     "groupId" TEXT;

ALTER TABLE "SaleItem" ADD COLUMN     "priceRuleId" TEXT,
ADD COLUMN     "priceSnapshot" JSONB;

CREATE TABLE "CustomerGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storeId" TEXT,
    "customerId" TEXT,
    "groupId" TEXT,
    "minimumQuantity" DECIMAL(20,6) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerGroup_organizationId_name_key" ON "CustomerGroup"("organizationId", "name");

CREATE INDEX "PriceRule_organizationId_productId_startsAt_idx" ON "PriceRule"("organizationId", "productId", "startsAt");
-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CustomerGroup"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_priceRuleId_fkey" FOREIGN KEY ("priceRuleId") REFERENCES "PriceRule"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerGroup" ADD CONSTRAINT "CustomerGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CustomerGroup"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "CustomerGroup" ADD CONSTRAINT "customer_group_name" CHECK (length(trim(name)) BETWEEN 2 AND 100);
CREATE UNIQUE INDEX "CustomerGroup_org_id" ON "CustomerGroup" ("organizationId",id);
ALTER TABLE "Customer" ADD CONSTRAINT "customer_group_scope" FOREIGN KEY ("organizationId","groupId") REFERENCES "CustomerGroup" ("organizationId",id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PriceRule" ADD CONSTRAINT "price_rule_kind" CHECK (
 kind IN ('retail','wholesale','group','customer') AND
 (kind='customer')=("customerId" IS NOT NULL) AND (kind='group')=("groupId" IS NOT NULL) AND
 "minimumQuantity">0 AND "unitPrice">=0 AND "unitPrice"<1000000000000 AND
 ("endsAt" IS NULL OR "endsAt">"startsAt") AND length(trim(reason)) BETWEEN 3 AND 2000);
ALTER TABLE "PriceRule" ADD CONSTRAINT "price_rule_product_scope" FOREIGN KEY ("organizationId","productId") REFERENCES "Product" ("organizationId",id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PriceRule" ADD CONSTRAINT "price_rule_store_scope" FOREIGN KEY ("organizationId","storeId") REFERENCES "Store" ("organizationId",id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PriceRule" ADD CONSTRAINT "price_rule_customer_scope" FOREIGN KEY ("organizationId","customerId") REFERENCES "Customer" ("organizationId",id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PriceRule" ADD CONSTRAINT "price_rule_group_scope" FOREIGN KEY ("organizationId","groupId") REFERENCES "CustomerGroup" ("organizationId",id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PriceRule" ADD CONSTRAINT "price_rule_actor" FOREIGN KEY ("createdBy") REFERENCES "User" (id);
CREATE FUNCTION price_rule_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
  RAISE EXCEPTION 'Price rule journal cannot be deleted';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('price-rule:'||NEW."organizationId"||':'||NEW."productId",0));
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'archivedAt') IS DISTINCT FROM (to_jsonb(OLD)-'archivedAt') OR OLD."archivedAt" IS NOT NULL OR NEW."archivedAt" IS NULL OR NEW."archivedAt"<OLD."createdAt" THEN RAISE EXCEPTION 'Price rule snapshot is immutable';END IF;
  RETURN NEW;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM "OrganizationUser" m JOIN "User" u ON u.id=m."userId" WHERE m."organizationId"=NEW."organizationId" AND m."userId"=NEW."createdBy" AND m."isActive" AND u."isActive" AND m.role IN ('owner','admin')) THEN RAISE EXCEPTION 'Price rule manager required';END IF;
 IF NEW."archivedAt" IS NOT NULL THEN RAISE EXCEPTION 'New price rule cannot be archived';END IF;
 IF EXISTS(SELECT 1 FROM "PriceRule" r WHERE r."organizationId"=NEW."organizationId" AND r."productId"=NEW."productId" AND r.kind=NEW.kind AND r."storeId" IS NOT DISTINCT FROM NEW."storeId" AND r."customerId" IS NOT DISTINCT FROM NEW."customerId" AND r."groupId" IS NOT DISTINCT FROM NEW."groupId" AND r."minimumQuantity"=NEW."minimumQuantity" AND r."archivedAt" IS NULL AND tsrange(r."startsAt",r."endsAt",'[)') && tsrange(NEW."startsAt",NEW."endsAt",'[)')) THEN RAISE EXCEPTION 'Conflicting price intervals';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER price_rule_guard BEFORE INSERT OR UPDATE OR DELETE ON "PriceRule" FOR EACH ROW EXECUTE FUNCTION price_rule_guard();
CREATE FUNCTION sale_item_price_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s "Sale"; r "PriceRule";
BEGIN
 SELECT * INTO s FROM "Sale" WHERE id=NEW."saleId";
 IF TG_OP='UPDATE' AND s.status<>'draft' AND (NEW."priceRuleId" IS DISTINCT FROM OLD."priceRuleId" OR NEW."priceSnapshot" IS DISTINCT FROM OLD."priceSnapshot") THEN RAISE EXCEPTION 'Posted price snapshot is immutable';END IF;
 IF NEW."priceRuleId" IS NOT NULL THEN
  SELECT * INTO r FROM "PriceRule" WHERE id=NEW."priceRuleId";
  IF r."organizationId"<>s."organizationId" OR r."productId"<>NEW."productId" OR r."unitPrice"<>NEW."unitPrice" OR NEW.quantity<r."minimumQuantity" OR (r."storeId" IS NOT NULL AND r."storeId"<>s."storeId") OR (r."customerId" IS NOT NULL AND r."customerId" IS DISTINCT FROM s."customerId") THEN RAISE EXCEPTION 'Invalid sale price rule snapshot';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sale_item_price_guard BEFORE INSERT OR UPDATE ON "SaleItem" FOR EACH ROW EXECUTE FUNCTION sale_item_price_guard();
