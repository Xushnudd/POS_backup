#!/usr/bin/env bash
set -euo pipefail
# Only dedicated temporary databases on the isolated development-test container.
fixture_db="pos_migration_test_$(date +%s)"
fresh_db="pos_fresh_test_$(date +%s)"
price_fixture=$(mktemp -d /tmp/pos-price-migrations.XXXXXX)
cp prisma/schema.prisma "$price_fixture/schema.prisma"
mkdir "$price_fixture/migrations"
for migration in prisma/migrations/*; do
 case "$migration" in *202610070036_return_dispositions|*202610080037_price_location_scope|*202610080038_financial_accounts|*202610080039_financial_trigger_record|*202610080040_financial_trigger_alias|*202610080041_financial_cash_mirror) ;; *) cp -a "$migration" "$price_fixture/migrations/" ;; esac
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
printf 'PASS: fresh migrations and legacy receipt allocation/debt/barcode/unit/price/disposition backfills\n'
