#!/usr/bin/env bash
set -euo pipefail
# Only dedicated temporary databases on the isolated development-test container.
fixture_db="pos_migration_test_$(date +%s)"
fresh_db="pos_fresh_test_$(date +%s)"
cleanup() {
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
DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$fixture_db" ./node_modules/.bin/prisma migrate deploy
fixture_result=$(docker exec pos-plan-test-db psql -U pos_test -d "$fixture_db" -At -v ON_ERROR_STOP=1 -c 'SELECT (SELECT sum("receiptDiscount")::text FROM "SaleItem") || '"'"':'"'"' || (SELECT sum(amount)::text FROM "DebtEntry") || '"'"':'"'"' || (SELECT count(*)::text FROM "ProductBarcode") || '"'"':'"'"' || (SELECT count(*)::text FROM "Unit")')
[[ "$fixture_result" == '0.01:2.99:1:8' ]]
printf 'PASS: fresh migrations and legacy receipt allocation/debt/barcode/unit backfills\n'
