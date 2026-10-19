BEGIN;
CREATE TABLE "RateLimit" (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
-- Composite relation keys enforce tenant ownership even outside application code.
ALTER TABLE "Store" ADD CONSTRAINT "Store_org_id_unique" UNIQUE("organizationId",id);
ALTER TABLE "Product" ADD CONSTRAINT "Product_org_id_unique" UNIQUE("organizationId",id);
ALTER TABLE "Category" ADD CONSTRAINT "Category_org_id_unique" UNIQUE("organizationId",id);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_org_id_unique" UNIQUE("organizationId",id);
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_org_id_unique" UNIQUE("organizationId",id);
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenant_category_fk" FOREIGN KEY("organizationId","categoryId") REFERENCES "Category"("organizationId",id);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenant_store_fk" FOREIGN KEY("organizationId","storeId") REFERENCES "Store"("organizationId",id);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenant_customer_fk" FOREIGN KEY("organizationId","customerId") REFERENCES "Customer"("organizationId",id);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenant_store_fk" FOREIGN KEY("organizationId","storeId") REFERENCES "Store"("organizationId",id);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenant_customer_fk" FOREIGN KEY("organizationId","customerId") REFERENCES "Customer"("organizationId",id);
ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_tenant_store_fk" FOREIGN KEY("organizationId","storeId") REFERENCES "Store"("organizationId",id);
ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_tenant_supplier_fk" FOREIGN KEY("organizationId","supplierId") REFERENCES "Supplier"("organizationId",id);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenant_store_fk" FOREIGN KEY("organizationId","storeId") REFERENCES "Store"("organizationId",id);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenant_product_fk" FOREIGN KEY("organizationId","productId") REFERENCES "Product"("organizationId",id);
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_tenant_from_fk" FOREIGN KEY("organizationId","fromStoreId") REFERENCES "Store"("organizationId",id);
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_tenant_to_fk" FOREIGN KEY("organizationId","toStoreId") REFERENCES "Store"("organizationId",id);
ALTER TABLE "DebtEntry" ADD CONSTRAINT "DebtEntry_tenant_customer_fk" FOREIGN KEY("organizationId","customerId") REFERENCES "Customer"("organizationId",id);
-- Parent/child items do not carry tenantId; a trigger verifies their full chain.
CREATE FUNCTION check_pos_relation_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tenant TEXT; related TEXT; parent_store TEXT;
BEGIN
 IF TG_TABLE_NAME='SaleItem' THEN
  SELECT "organizationId" INTO tenant FROM "Sale" WHERE id=NEW."saleId";
  SELECT "organizationId" INTO related FROM "Product" WHERE id=NEW."productId";
 ELSIF TG_TABLE_NAME='StockDocumentItem' THEN
  SELECT "organizationId" INTO tenant FROM "StockDocument" WHERE id=NEW."stockDocumentId";
  SELECT "organizationId" INTO related FROM "Product" WHERE id=NEW."productId";
 ELSIF TG_TABLE_NAME='StockTransferItem' THEN
  SELECT "organizationId" INTO tenant FROM "StockTransfer" WHERE id=NEW."stockTransferId";
  SELECT "organizationId" INTO related FROM "Product" WHERE id=NEW."productId";
 ELSIF TG_TABLE_NAME='InventoryBalance' THEN
  SELECT "organizationId" INTO tenant FROM "Store" WHERE id=NEW."storeId";
  SELECT "organizationId" INTO related FROM "Product" WHERE id=NEW."productId";
 ELSIF TG_TABLE_NAME='UserStore' THEN
  SELECT "organizationId" INTO tenant FROM "OrganizationUser" WHERE id=NEW."organizationUserId";
  SELECT "organizationId" INTO related FROM "Store" WHERE id=NEW."storeId";
 ELSIF TG_TABLE_NAME='Shift' THEN
  SELECT "organizationId" INTO tenant FROM "OrganizationUser" WHERE id=NEW."organizationUserId";
  SELECT s."organizationId" INTO related FROM "Register" r JOIN "Store" s ON s.id=r."storeId" WHERE r.id=NEW."registerId";
 ELSIF TG_TABLE_NAME='Sale' THEN
  tenant=NEW."organizationId";
  SELECT s."organizationId",r."storeId" INTO related,parent_store FROM "Register" r JOIN "Store" s ON s.id=r."storeId" WHERE r.id=NEW."registerId";
  IF parent_store IS DISTINCT FROM NEW."storeId" THEN RAISE EXCEPTION 'sale register/store mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM "Shift" sh JOIN "OrganizationUser" ou ON ou.id=sh."organizationUserId" WHERE sh.id=NEW."shiftId" AND sh."registerId"=NEW."registerId" AND ou."organizationId"=tenant) THEN RAISE EXCEPTION 'sale shift mismatch'; END IF;
 ELSIF TG_TABLE_NAME='Payment' THEN
  tenant=NEW."organizationId"; related=tenant;
  IF NEW."saleId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Sale" s WHERE s.id=NEW."saleId" AND s."organizationId"=tenant AND s."storeId"=NEW."storeId") THEN RAISE EXCEPTION 'payment sale mismatch'; END IF;
  IF NEW."shiftId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Shift" sh JOIN "Register" r ON r.id=sh."registerId" JOIN "Store" st ON st.id=r."storeId" WHERE sh.id=NEW."shiftId" AND st."organizationId"=tenant AND st.id=NEW."storeId") THEN RAISE EXCEPTION 'payment shift mismatch'; END IF;
 END IF;
 IF tenant IS NULL OR related IS NULL OR tenant<>related THEN RAISE EXCEPTION 'cross-tenant relation rejected'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "SaleItem_scope" BEFORE INSERT OR UPDATE ON "SaleItem" FOR EACH ROW EXECUTE FUNCTION check_pos_relation_scope();
CREATE TRIGGER "StockDocumentItem_scope" BEFORE INSERT OR UPDATE ON "StockDocumentItem" FOR EACH ROW EXECUTE FUNCTION check_pos_relation_scope();
CREATE TRIGGER "StockTransferItem_scope" BEFORE INSERT OR UPDATE ON "StockTransferItem" FOR EACH ROW EXECUTE FUNCTION check_pos_relation_scope();
CREATE TRIGGER "InventoryBalance_scope" BEFORE INSERT OR UPDATE ON "InventoryBalance" FOR EACH ROW EXECUTE FUNCTION check_pos_relation_scope();
CREATE TRIGGER "UserStore_scope" BEFORE INSERT OR UPDATE ON "UserStore" FOR EACH ROW EXECUTE FUNCTION check_pos_relation_scope();
CREATE TRIGGER "Shift_scope" BEFORE INSERT OR UPDATE ON "Shift" FOR EACH ROW EXECUTE FUNCTION check_pos_relation_scope();
CREATE TRIGGER "Sale_scope" BEFORE INSERT OR UPDATE ON "Sale" FOR EACH ROW EXECUTE FUNCTION check_pos_relation_scope();
CREATE TRIGGER "Payment_scope" BEFORE INSERT OR UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION check_pos_relation_scope();
COMMIT;
