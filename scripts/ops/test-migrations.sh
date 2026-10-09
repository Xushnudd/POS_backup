#!/usr/bin/env bash
set -euo pipefail
# Only dedicated temporary databases on the isolated development-test container.
fixture_db="pos_migration_test_$(date +%s)"
fresh_db="pos_fresh_test_$(date +%s)"
price_fixture=$(mktemp -d /tmp/pos-price-migrations.XXXXXX)
cp prisma/schema.prisma "$price_fixture/schema.prisma"
mkdir "$price_fixture/migrations"
for migration in prisma/migrations/*; do
 case "$migration" in *202610070036_return_dispositions|*202610080037_price_location_scope|*202610080038_financial_accounts|*202610080039_financial_trigger_record|*202610080040_financial_trigger_alias|*202610080041_financial_cash_mirror|*202610080042_supplier_ledger|*202610080043_supplier_trigger_record|*202610080044_supplier_payment_proof|*202610080045_purchase_orders|*202610080046_purchase_receipt_complete|*202610080047_purchase_cascade_constraints|*202610080048_zero_value_receipts|*202610080049_supplier_credits|*202610080050_product_variants|*202610080051_variant_tenant_fks|*202610080052_protected_files|*202610080053_catalog_metadata|*202610080054_file_image_links|*202610080055_category_graph_lock|*202610080056_cashier_pin|*202610080057_tax_snapshots|*202610080058_return_tax_allocation|*202610080059_discount_authorization|*202610080060_transfer_dispositions|*202610080061_transfer_snapshot_guards|*202610080062_support_grants|*202610080063_price_rules|*202610080064_price_rule_guards|*202610080065_customer_identity|*202610080066_receipt_join_indexes|*202610080067_receipt_index|*202610080068_receipt_index|*202610080069_receipt_index|*202610080070_receipt_index|*202610080071_receipt_index|*202610080072_receipt_index|*202610080073_receipt_index|*202610080074_stock_locations_reservations|*202610080075_reservation_unit_guards) ;; *) cp -a "$migration" "$price_fixture/migrations/" ;; esac
done
cleanup() {
 rm -rf "$price_fixture"
 docker exec pos-plan-test-db dropdb -U pos_test --if-exists "$fixture_db" >/dev/null
 docker exec pos-plan-test-db dropdb -U pos_test --if-exists "$fresh_db" >/dev/null
}
trap cleanup EXIT
docker exec pos-plan-test-db createdb -U pos_test "$fresh_db"
DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$fresh_db" ./node_modules/.bin/prisma migrate deploy
# Recreate the legacy schema and seed a discounted credit receipt before backfills.
docker exec pos-plan-test-db createdb -U pos_test "$fixture_db"
docker exec -i pos-plan-test-db psql -U pos_test -d "$fixture_db" -v ON_ERROR_STOP=1 < prisma/migrations/20260907100516_init/migration.sql
DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$fixture_db" ./node_modules/.bin/prisma migrate resolve --applied 20260907100516_init
docker exec -i pos-plan-test-db psql -U pos_test -d "$fixture_db" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO "Organization" (id,name,phone) VALUES ('legacy-org','Legacy fixture','test');
INSERT INTO "User" (id,"fullName",phone,"passwordHash") VALUES ('legacy-user','Fixture owner','test','not-a-login');
INSERT INTO "OrganizationUser" (id,"organizationId","userId",role) VALUES ('legacy-member','legacy-org','legacy-user','owner');
INSERT INTO "Store" (id,"organizationId",name,"updatedAt") VALUES ('legacy-store','legacy-org','Store',NOW());
INSERT INTO "Register" (id,"storeId",name,code) VALUES ('legacy-register','legacy-store','Till','1');
INSERT INTO "Shift" (id,"registerId","organizationUserId","openingCash") VALUES ('legacy-shift','legacy-register','legacy-member',0);
INSERT INTO "Product" (id,"organizationId",name,sku,barcode,unit,"salePrice","costPrice","updatedAt") VALUES ('legacy-product','legacy-org','Fixture','FIX','FIX','dona',1,0.5,NOW());
INSERT INTO "Customer" (id,"organizationId","fullName",phone,"creditLimit","updatedAt") VALUES ('legacy-customer','legacy-org','Customer','test',10,NOW());
INSERT INTO "Customer" (id,"organizationId","fullName",phone,"creditLimit","updatedAt") VALUES ('legacy-duplicate-a','legacy-org','Duplicate A','901234567',0,NOW()),('legacy-duplicate-b','legacy-org','Duplicate B','+998 (90) 123-45-67',0,NOW());
INSERT INTO "Sale" (id,"organizationId","storeId","registerId","shiftId","cashierId","customerId","receiptNo",status,subtotal,"discountAmount","totalAmount","completedAt") VALUES ('legacy-sale','legacy-org','legacy-store','legacy-register','legacy-shift','legacy-user','legacy-customer','FIXTURE','completed',3,0.01,2.99,NOW());
INSERT INTO "SaleItem" (id,"saleId","productId","productName",sku,quantity,"unitPrice","lineTotal","unitCost") VALUES ('legacy-line-a','legacy-sale','legacy-product','Fixture','FIX',1,1,1,0.5),('legacy-line-b','legacy-sale','legacy-product','Fixture','FIX',1,1,1,0.5),('legacy-line-c','legacy-sale','legacy-product','Fixture','FIX',1,1,1,0.5);
INSERT INTO "Payment" (id,"organizationId","storeId","shiftId","saleId","customerId","paymentType",direction,amount,"receivedBy") VALUES ('legacy-payment','legacy-org','legacy-store','legacy-shift','legacy-sale','legacy-customer','credit','in',2.99,'legacy-user');
SQL
DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$fixture_db" ./node_modules/.bin/prisma migrate deploy --schema "$price_fixture/schema.prisma"
# Seed pre-location choices after legacy conversion, then prove exact backfill.
docker exec -i pos-plan-test-db psql -U pos_test -d "$fixture_db" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
INSERT INTO "SaleReturn" (id,"saleId","returnReceiptNo","refundAmount","processedBy","returnedAt") VALUES ('legacy-return','legacy-sale','RET-FIX',1.98,'legacy-user','2026-01-15 12:00:00');
INSERT INTO "SaleReturnItem" (id,"saleReturnId","saleItemId","productId",quantity,"unitPrice","lineTotal",disposition) VALUES ('legacy-damaged','legacy-return','legacy-line-a','legacy-product',1,1,0.99,'damaged'),('legacy-disposed','legacy-return','legacy-line-b','legacy-product',1,1,0.99,'write_off');
COMMIT;
SQL
DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$fixture_db" ./node_modules/.bin/prisma migrate deploy
price_result=$(docker exec pos-plan-test-db psql -U pos_test -d "$fixture_db" -At -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM "ProductPriceHistory" WHERE "organizationId"='"'"'legacy-org'"'"' AND source='"'"'migration_baseline'"'"' AND "oldValue" IS NULL')
[[ "$price_result" == '2' ]]
disposition_result=$(docker exec pos-plan-test-db psql -U pos_test -d "$fixture_db" -At -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM "ReturnDispositionEntry" WHERE "organizationId"='"'"'legacy-org'"'"' AND "unitCost"=0.5 AND "productName"='"'"'Fixture'"'"' AND "createdAt"='"'"'2026-01-15 12:00:00'"'"' AND ((disposition='"'"'damaged'"'"' AND "locationId" IS NOT NULL) OR (disposition='"'"'write_off'"'"' AND "locationId" IS NULL))')
[[ "$disposition_result" == '2' ]]

fixture_result=$(docker exec pos-plan-test-db psql -U pos_test -d "$fixture_db" -At -v ON_ERROR_STOP=1 -c 'SELECT (SELECT sum("receiptDiscount")::text FROM "SaleItem") || '"'"':'"'"' || (SELECT sum(amount)::text FROM "DebtEntry") || '"'"':'"'"' || (SELECT count(*)::text FROM "ProductBarcode") || '"'"':'"'"' || (SELECT count(*)::text FROM "Unit")')
[[ "$fixture_result" == '0.01:2.99:1:8' ]]
variant_result=$(docker exec pos-plan-test-db psql -U pos_test -d "$fixture_db" -At -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM "ProductVariant" WHERE "productId"='"'"'legacy-product'"'"' AND "rootProductId"="productId" AND options='"'"'{}'"'"'::jsonb')
[[ "$variant_result" == '1' ]]
identity_result=$(docker exec pos-plan-test-db psql -U pos_test -d "$fixture_db" -At -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM "Customer" WHERE id IN ('"'"'legacy-duplicate-a'"'"','"'"'legacy-duplicate-b'"'"') AND "isActive" AND "canonicalPhone" IS NULL AND "mergedIntoId" IS NULL')
[[ "$identity_result" == '2' ]]
printf 'PASS: fresh migrations and legacy receipt allocation/debt/barcode/unit/price/disposition backfills\n'
