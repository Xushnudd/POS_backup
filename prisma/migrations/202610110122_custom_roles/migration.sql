BEGIN;
CREATE TABLE "CustomRole" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 80 AND name!~'[[:cntrl:]]'),
 "baseRole" TEXT NOT NULL CHECK("baseRole" IN ('admin','cashier')),
 permissions TEXT[] NOT NULL CHECK(cardinality(permissions)<=256 AND array_position(permissions,NULL) IS NULL),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),"isActive" BOOLEAN NOT NULL DEFAULT TRUE,
 "createdBy" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 UNIQUE(id,"organizationId"),UNIQUE("organizationId",name)
);
CREATE INDEX "CustomRole_organizationId_isActive_idx" ON "CustomRole"("organizationId","isActive");
ALTER TABLE "OrganizationUser" ADD COLUMN "customRoleId" TEXT;
ALTER TABLE "OrganizationUser" ADD CONSTRAINT custom_role_tenant_fk FOREIGN KEY("customRoleId","organizationId") REFERENCES "CustomRole"(id,"organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX "OrganizationUser_customRoleId_idx" ON "OrganizationUser"("customRoleId");
CREATE FUNCTION custom_role_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'Custom role history cannot be deleted';END IF;
  RETURN OLD;
 END IF;
 IF cardinality(NEW.permissions)<>(SELECT count(DISTINCT value) FROM unnest(NEW.permissions) value) OR EXISTS(SELECT 1 FROM unnest(NEW.permissions) value WHERE length(value)>200 OR value!~'^(GET|POST|PUT|PATCH|DELETE) /api/') THEN RAISE EXCEPTION 'Invalid custom role permissions';END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.revision<>1 OR NOT NEW."isActive" OR NOT EXISTS(SELECT 1 FROM "OrganizationUser" m JOIN "User" u ON u.id=m."userId" WHERE m."organizationId"=NEW."organizationId" AND m."userId"=NEW."createdBy" AND m.role='owner' AND m."isActive" AND u."isActive") THEN RAISE EXCEPTION 'Invalid custom role author';END IF;
 ELSE
  IF (NEW.id,NEW."organizationId",NEW."baseRole",NEW."createdBy",NEW."createdAt") IS DISTINCT FROM (OLD.id,OLD."organizationId",OLD."baseRole",OLD."createdBy",OLD."createdAt") OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Immutable custom role identity or revision';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER custom_role_source_guard BEFORE INSERT OR UPDATE OR DELETE ON "CustomRole" FOR EACH ROW EXECUTE FUNCTION custom_role_source_guard();
CREATE FUNCTION custom_role_membership_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."customRoleId" IS NOT NULL AND (TG_OP='INSERT' OR NEW."customRoleId" IS DISTINCT FROM OLD."customRoleId" OR NEW.role IS DISTINCT FROM OLD.role OR (NEW."isActive" AND NOT OLD."isActive")) AND NOT EXISTS(SELECT 1 FROM "CustomRole" r WHERE r.id=NEW."customRoleId" AND r."organizationId"=NEW."organizationId" AND r."baseRole"=NEW.role AND r."isActive") THEN RAISE EXCEPTION 'Invalid custom role membership';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER custom_role_membership_guard BEFORE INSERT OR UPDATE ON "OrganizationUser" FOR EACH ROW EXECUTE FUNCTION custom_role_membership_guard();
CREATE FUNCTION custom_role_revoke_sessions() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (NEW.permissions,NEW."isActive") IS DISTINCT FROM (OLD.permissions,OLD."isActive") THEN
  UPDATE "Session" s SET "revokedAt"=clock_timestamp() AT TIME ZONE 'UTC' FROM "OrganizationUser" m WHERE m."customRoleId"=NEW.id AND m."organizationId"=NEW."organizationId" AND s."userId"=m."userId" AND s."organizationId"=m."organizationId" AND s."revokedAt" IS NULL;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER custom_role_revoke_sessions AFTER UPDATE ON "CustomRole" FOR EACH ROW EXECUTE FUNCTION custom_role_revoke_sessions();
CREATE OR REPLACE FUNCTION business_row_organization(table_name TEXT,value JSONB) RETURNS TEXT LANGUAGE plpgsql STABLE AS $$ DECLARE org TEXT; BEGIN CASE table_name
 WHEN 'Organization' THEN RETURN value->>'id';
 WHEN 'CustomRole' THEN RETURN value->>'organizationId';
 WHEN 'OrganizationUser' THEN RETURN value->>'organizationId';
 WHEN 'Store' THEN RETURN value->>'organizationId';
 WHEN 'UserStore' THEN SELECT p0."organizationId" INTO org FROM "OrganizationUser" p0 WHERE p0."id"=value->>'organizationUserId'; RETURN org;
 WHEN 'ReceiptCostPlan' THEN RETURN value->>'organizationId';
 WHEN 'Register' THEN SELECT p0."organizationId" INTO org FROM "Store" p0 WHERE p0."id"=value->>'storeId'; RETURN org;
 WHEN 'Category' THEN RETURN value->>'organizationId';
 WHEN 'Product' THEN RETURN value->>'organizationId';
 WHEN 'Customer' THEN RETURN value->>'organizationId';
 WHEN 'Supplier' THEN RETURN value->>'organizationId';
 WHEN 'StockDocument' THEN RETURN value->>'organizationId';
 WHEN 'StockDocumentItem' THEN SELECT p0."organizationId" INTO org FROM "StockDocument" p0 WHERE p0."id"=value->>'stockDocumentId'; RETURN org;
 WHEN 'InventoryMovement' THEN RETURN value->>'organizationId';
 WHEN 'InventoryBalance' THEN SELECT p0."organizationId" INTO org FROM "Store" p0 WHERE p0."id"=value->>'storeId'; RETURN org;
 WHEN 'StockTransfer' THEN RETURN value->>'organizationId';
 WHEN 'StockTransferItem' THEN SELECT p0."organizationId" INTO org FROM "StockTransfer" p0 WHERE p0."id"=value->>'stockTransferId'; RETURN org;
 WHEN 'TransferDispositionEntry' THEN RETURN value->>'organizationId';
 WHEN 'Shift' THEN SELECT p1."organizationId" INTO org FROM "Register" p0 JOIN "Store" p1 ON p0."storeId"=p1."id" WHERE p0."id"=value->>'registerId'; RETURN org;
 WHEN 'CashMovement' THEN SELECT p2."organizationId" INTO org FROM "Shift" p0 JOIN "Register" p1 ON p0."registerId"=p1."id" JOIN "Store" p2 ON p1."storeId"=p2."id" WHERE p0."id"=value->>'shiftId'; RETURN org;
 WHEN 'ShiftCorrection' THEN RETURN value->>'organizationId';
 WHEN 'Sale' THEN RETURN value->>'organizationId';
 WHEN 'SaleItem' THEN SELECT p0."organizationId" INTO org FROM "Sale" p0 WHERE p0."id"=value->>'saleId'; RETURN org;
 WHEN 'Payment' THEN RETURN value->>'organizationId';
 WHEN 'SaleReturn' THEN SELECT p0."organizationId" INTO org FROM "Sale" p0 WHERE p0."id"=value->>'saleId'; RETURN org;
 WHEN 'SaleReturnItem' THEN SELECT p1."organizationId" INTO org FROM "SaleReturn" p0 JOIN "Sale" p1 ON p0."saleId"=p1."id" WHERE p0."id"=value->>'saleReturnId'; RETURN org;
 WHEN 'DiscountPolicy' THEN RETURN value->>'organizationId';
 WHEN 'DebtEntry' THEN RETURN value->>'organizationId';
 WHEN 'Unit' THEN RETURN value->>'organizationId';
 WHEN 'ProductBarcode' THEN RETURN value->>'organizationId';
 WHEN 'StockCount' THEN RETURN value->>'organizationId';
 WHEN 'StockCountLine' THEN SELECT p0."organizationId" INTO org FROM "StockCount" p0 WHERE p0."id"=value->>'countId'; RETURN org;
 WHEN 'StockCountReading' THEN SELECT p1."organizationId" INTO org FROM "StockCountLine" p0 JOIN "StockCount" p1 ON p0."countId"=p1."id" WHERE p0."id"=value->>'lineId'; RETURN org;
 WHEN 'StockFreeze' THEN SELECT p0."organizationId" INTO org FROM "Store" p0 WHERE p0."id"=value->>'storeId'; RETURN org;
 WHEN 'OwnershipTransfer' THEN RETURN value->>'organizationId';
 WHEN 'SyncReview' THEN RETURN value->>'organizationId';
 WHEN 'StockThreshold' THEN RETURN value->>'organizationId';
 WHEN 'ProductPriceHistory' THEN RETURN value->>'organizationId';
 WHEN 'DamageLocation' THEN RETURN value->>'organizationId';
 WHEN 'ReturnDispositionEntry' THEN RETURN value->>'organizationId';
 WHEN 'FinancialAccount' THEN RETURN value->>'organizationId';
 WHEN 'ExpenseCategory' THEN RETURN value->>'organizationId';
 WHEN 'FinancialDocument' THEN RETURN value->>'organizationId';
 WHEN 'AccountEntry' THEN RETURN value->>'organizationId';
 WHEN 'SupplierInvoice' THEN RETURN value->>'organizationId';
 WHEN 'SupplierPayment' THEN RETURN value->>'organizationId';
 WHEN 'SupplierAllocation' THEN SELECT p0."organizationId" INTO org FROM "SupplierInvoice" p0 WHERE p0."id"=value->>'invoiceId'; RETURN org;
 WHEN 'PurchaseOrder' THEN RETURN value->>'organizationId';
 WHEN 'PurchaseOrderItem' THEN SELECT p0."organizationId" INTO org FROM "PurchaseOrder" p0 WHERE p0."id"=value->>'orderId'; RETURN org;
 WHEN 'PurchaseReceipt' THEN SELECT p0."organizationId" INTO org FROM "PurchaseOrder" p0 WHERE p0."id"=value->>'orderId'; RETURN org;
 WHEN 'PurchaseReceiptLine' THEN SELECT p1."organizationId" INTO org FROM "PurchaseReceipt" p0 JOIN "PurchaseOrder" p1 ON p0."orderId"=p1."id" WHERE p0."id"=value->>'receiptId'; RETURN org;
 WHEN 'SupplierCredit' THEN SELECT p0."organizationId" INTO org FROM "SupplierInvoice" p0 WHERE p0."id"=value->>'invoiceId'; RETURN org;
 WHEN 'SupplierCreditItem' THEN SELECT p1."organizationId" INTO org FROM "SupplierCredit" p0 JOIN "SupplierInvoice" p1 ON p0."invoiceId"=p1."id" WHERE p0."id"=value->>'creditId'; RETURN org;
 WHEN 'SupplierAllocationRelease' THEN SELECT p1."organizationId" INTO org FROM "SupplierAllocation" p0 JOIN "SupplierInvoice" p1 ON p0."invoiceId"=p1."id" WHERE p0."id"=value->>'allocationId'; RETURN org;
 WHEN 'ProductVariant' THEN RETURN value->>'organizationId';
 WHEN 'FileAsset' THEN RETURN value->>'organizationId';
 WHEN 'Brand' THEN RETURN value->>'organizationId';
 WHEN 'TaxProfile' THEN RETURN value->>'organizationId';
 WHEN 'TaxProfileVersion' THEN RETURN value->>'organizationId';
 WHEN 'CustomerGroup' THEN RETURN value->>'organizationId';
 WHEN 'PriceRule' THEN RETURN value->>'organizationId';
 WHEN 'StockLocation' THEN RETURN value->>'organizationId';
 WHEN 'LocationBalance' THEN RETURN value->>'organizationId';
 WHEN 'LocationEntry' THEN RETURN value->>'organizationId';
 WHEN 'StockReservation' THEN RETURN value->>'organizationId';
 WHEN 'ReservationItem' THEN RETURN value->>'organizationId';
 WHEN 'ReservationEntry' THEN RETURN value->>'organizationId';
 WHEN 'OfflineCashPolicy' THEN RETURN value->>'organizationId';
 WHEN 'OfflineCashLease' THEN RETURN value->>'organizationId';
 WHEN 'OnboardingCheckpoint' THEN RETURN value->>'organizationId';
 WHEN 'SaleExchange' THEN RETURN value->>'organizationId';
 WHEN 'ProductUnitConversion' THEN RETURN value->>'organizationId';
 WHEN 'CustomerAdvance' THEN RETURN value->>'organizationId';
 WHEN 'CustomerAdvanceAllocation' THEN SELECT p0."organizationId" INTO org FROM "CustomerAdvance" p0 WHERE p0."id"=value->>'advanceId'; RETURN org;
 WHEN 'CustomerAdvanceRefund' THEN SELECT p0."organizationId" INTO org FROM "CustomerAdvance" p0 WHERE p0."id"=value->>'advanceId'; RETURN org;
 ELSE RAISE EXCEPTION 'Unreviewed business write scope';END CASE;END $$;
CREATE TRIGGER subscription_read_only BEFORE INSERT OR UPDATE OR DELETE ON "CustomRole" FOR EACH ROW EXECUTE FUNCTION subscription_business_write_guard();
COMMIT;
