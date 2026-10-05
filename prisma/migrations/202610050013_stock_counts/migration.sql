BEGIN;
-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "blind" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'counting',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "reason" TEXT,
    "adjustmentId" TEXT,

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountLine" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "expectedQuantity" DECIMAL(20,6) NOT NULL,
    "unitCost" DECIMAL(20,6) NOT NULL,

    CONSTRAINT "StockCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountReading" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "countedBy" TEXT NOT NULL,
    "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockCountReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockFreeze" (
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "countId" TEXT NOT NULL,

    CONSTRAINT "StockFreeze_pkey" PRIMARY KEY ("storeId","productId")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockCount_adjustmentId_key" ON "StockCount"("adjustmentId");

-- CreateIndex
CREATE INDEX "StockCount_organizationId_storeId_status_idx" ON "StockCount"("organizationId", "storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StockCountLine_countId_productId_key" ON "StockCountLine"("countId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockCountReading_lineId_round_key" ON "StockCountReading"("lineId", "round");

-- CreateIndex
CREATE INDEX "StockFreeze_countId_idx" ON "StockFreeze"("countId");

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "StockDocument"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_countId_fkey" FOREIGN KEY ("countId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountReading" ADD CONSTRAINT "StockCountReading_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "StockCountLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockFreeze" ADD CONSTRAINT "StockFreeze_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockFreeze" ADD CONSTRAINT "StockFreeze_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockFreeze" ADD CONSTRAINT "StockFreeze_countId_fkey" FOREIGN KEY ("countId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_status" CHECK(status IN ('counting','review','approved','cancelled'));
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_scope" CHECK(scope IN ('full','partial'));
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_tenant_store" FOREIGN KEY("organizationId","storeId") REFERENCES "Store"("organizationId",id);
ALTER TABLE "StockCountReading" ADD CONSTRAINT "StockCountReading_amount" CHECK(quantity>=0 AND round BETWEEN 1 AND 20);
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_cost" CHECK("unitCost">=0);
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_creator" FOREIGN KEY("createdBy") REFERENCES "User"(id);
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_approver" FOREIGN KEY("approvedBy") REFERENCES "User"(id);
ALTER TABLE "StockCountReading" ADD CONSTRAINT "StockCountReading_actor" FOREIGN KEY("countedBy") REFERENCES "User"(id);
CREATE FUNCTION guard_stock_count_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='StockCountLine' THEN
  IF NOT EXISTS(SELECT 1 FROM "StockCount" c JOIN "Product" p ON p."organizationId"=c."organizationId" WHERE c.id=NEW."countId" AND p.id=NEW."productId") THEN
   RAISE EXCEPTION 'Invalid count product scope' USING ERRCODE='23514';
  END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM "StockCount" c JOIN "StockCountLine" l ON l."countId"=c.id WHERE c.id=NEW."countId" AND c."storeId"=NEW."storeId" AND l."productId"=NEW."productId" AND c.status IN ('counting','review')) THEN
   RAISE EXCEPTION 'Invalid count freeze scope' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "StockCountLine_scope" BEFORE INSERT OR UPDATE ON "StockCountLine" FOR EACH ROW EXECUTE FUNCTION guard_stock_count_scope();
CREATE TRIGGER "StockFreeze_scope" BEFORE INSERT OR UPDATE ON "StockFreeze" FOR EACH ROW EXECUTE FUNCTION guard_stock_count_scope();
CREATE FUNCTION guard_stock_freeze() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "StockFreeze" f JOIN "Store" s ON s.id=f."storeId" JOIN "Organization" o ON o.id=s."organizationId" WHERE f."storeId"=COALESCE(NEW."storeId",OLD."storeId") AND f."productId"=COALESCE(NEW."productId",OLD."productId")) THEN
  RAISE EXCEPTION 'Stock is frozen for counting' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "InventoryBalance_count_freeze" BEFORE INSERT OR UPDATE OR DELETE ON "InventoryBalance" FOR EACH ROW EXECUTE FUNCTION guard_stock_freeze();
CREATE FUNCTION guard_stock_count_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tenant TEXT;
BEGIN
 IF TG_TABLE_NAME='StockCount' THEN
  tenant=OLD."organizationId";
  IF OLD.status NOT IN ('approved','cancelled') THEN
   IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='StockCountLine' THEN
  SELECT "organizationId" INTO tenant FROM "StockCount" WHERE id=OLD."countId";
 ELSE
  SELECT c."organizationId" INTO tenant FROM "StockCountLine" l JOIN "StockCount" c ON c.id=l."countId" WHERE l.id=OLD."lineId";
 END IF;
 IF EXISTS(SELECT 1 FROM "Organization" WHERE id=tenant) THEN
  RAISE EXCEPTION 'Count history is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "StockCount_history" BEFORE UPDATE OR DELETE ON "StockCount" FOR EACH ROW EXECUTE FUNCTION guard_stock_count_history();
CREATE TRIGGER "StockCountLine_history" BEFORE UPDATE OR DELETE ON "StockCountLine" FOR EACH ROW EXECUTE FUNCTION guard_stock_count_history();
CREATE TRIGGER "StockCountReading_history" BEFORE UPDATE OR DELETE ON "StockCountReading" FOR EACH ROW EXECUTE FUNCTION guard_stock_count_history();

COMMIT;
