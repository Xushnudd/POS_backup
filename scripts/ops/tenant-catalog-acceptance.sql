-- Runs only inside disposable migration rehearsal databases; rolls back every fixture.
BEGIN;
INSERT INTO "Organization"(id,name,phone) VALUES ('scope-a','Scope A','fixture-a'),('scope-b','Scope B','fixture-b');
INSERT INTO "Store"(id,"organizationId",name,"updatedAt") VALUES ('scope-store-a','scope-a','A',NOW()),('scope-store-b','scope-b','B',NOW());
INSERT INTO "Product"(id,"organizationId",name,sku,barcode,unit,"salePrice","costPrice","updatedAt") VALUES ('scope-product-a','scope-a','A','SHARED-SKU','SHARED-BAR','dona',1,0.123456,NOW()),('scope-product-b','scope-b','B','SHARED-SKU','SHARED-BAR','dona',1,0.123456,NOW());
DO $$ BEGIN
 BEGIN
  INSERT INTO "Product"(id,"organizationId",name,sku,barcode,unit,"salePrice","costPrice","updatedAt") VALUES ('duplicate-sku','scope-a','Dup','SHARED-SKU','UNIQUE-BAR','dona',1,0,NOW());
  RAISE EXCEPTION 'Duplicate SKU accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  INSERT INTO "Product"(id,"organizationId",name,sku,barcode,unit,"salePrice","costPrice","updatedAt") VALUES ('duplicate-bar','scope-a','Dup','UNIQUE-SKU','SHARED-BAR','dona',1,0,NOW());
  RAISE EXCEPTION 'Duplicate primary barcode accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 INSERT INTO "ProductBarcode"(id,"organizationId","productId",value,"isPrimary") VALUES ('scope-alias-a','scope-a','scope-product-a','SHARED-ALIAS',false),('scope-alias-b','scope-b','scope-product-b','SHARED-ALIAS',false);
 BEGIN
  INSERT INTO "ProductBarcode"(id,"organizationId","productId",value,"isPrimary") VALUES ('dup-alias','scope-a','scope-product-a','SHARED-ALIAS',false);
  RAISE EXCEPTION 'Duplicate alias accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  INSERT INTO "Product"(id,"organizationId",name,sku,barcode,unit,"salePrice","costPrice","updatedAt") VALUES ('primary-alias-collision','scope-a','Dup','UNIQUE-SKU','SHARED-ALIAS','dona',1,0,NOW());
  RAISE EXCEPTION 'Primary/alias collision accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  INSERT INTO "InventoryBalance"("storeId","productId",quantity,"updatedAt") VALUES ('scope-store-a','scope-product-b',1,NOW());
  SET CONSTRAINTS ALL IMMEDIATE;
  RAISE EXCEPTION 'Cross-tenant balance accepted';
 EXCEPTION WHEN check_violation OR raise_exception THEN
  IF SQLERRM='Cross-tenant balance accepted' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE "Product" SET "organizationId"='scope-b',sku='MOVED',barcode='MOVED' WHERE id='scope-product-a';
  SET CONSTRAINTS ALL IMMEDIATE;
  RAISE EXCEPTION 'Tenant reassignment accepted';
 EXCEPTION WHEN check_violation OR raise_exception THEN
  IF SQLERRM='Tenant reassignment accepted' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM "Product" WHERE "organizationId" IS NULL) OR EXISTS(SELECT 1 FROM "Unit" WHERE "organizationId" IS NULL) THEN RAISE EXCEPTION 'Tenant backfill incomplete'; END IF;
 IF EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname IN ('Product_sku_key','Product_barcode_key')) THEN RAISE EXCEPTION 'Old global unique index retained'; END IF;
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
