#!/usr/bin/env bash
set -euo pipefail
umask 077
# Only throwaway databases in the explicitly named local test container.
valuation_stamp="$(date +%s)_$$"
valuation_old="pos_valuation_${valuation_stamp}_old"
valuation_clone="pos_valuation_${valuation_stamp}_clone"
valuation_fresh="pos_valuation_${valuation_stamp}_fresh"
valuation_restore="pos_valuation_${valuation_stamp}_restore"
valuation_workdir=$(mktemp -d /tmp/pos-valuation-migrations.XXXXXX)
valuation_created=()
cleanup(){
 for valuation_db in "${valuation_created[@]}";do docker exec pos-plan-test-db dropdb -U pos_test --if-exists "$valuation_db" >/dev/null;done
 rm -rf "$valuation_workdir"
}
trap cleanup EXIT
create_database(){
 [[ "$1" =~ ^pos_valuation_[0-9]+_[0-9]+_(old|clone|fresh|restore)$ ]]||return 1
 docker exec pos-plan-test-db createdb -U pos_test "$1"
 valuation_created+=("$1")
}
apply(){ DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$1" node node_modules/prisma/build/index.js migrate deploy "${@:2}"; }
query(){ docker exec pos-plan-test-db psql -X -U pos_test -d "$1" -At -v ON_ERROR_STOP=1 -c "$2"; }
mkdir "$valuation_workdir/migrations"
cp prisma/schema.prisma "$valuation_workdir/schema.prisma"
for valuation_migration in prisma/migrations/*;do
 [[ -d "$valuation_migration" ]]||continue
 [[ "${valuation_migration##*/}" > 202610120133_totp_action_names ]]&&continue
 cp -a "$valuation_migration" "$valuation_workdir/migrations/"
done
create_database "$valuation_old"
apply "$valuation_old" --schema "$valuation_workdir/schema.prisma"
docker exec -i pos-plan-test-db psql -X -U pos_test -d "$valuation_old" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO "Organization"(id,name,phone) VALUES('valuation-legacy-org','Synthetic valuation migration','test-only');
INSERT INTO "User"(id,"fullName",phone,"passwordHash") VALUES('valuation-legacy-user','Synthetic owner','valuation-test-only','not-a-login');
INSERT INTO "OrganizationUser"(id,"organizationId","userId",role) VALUES('valuation-legacy-member','valuation-legacy-org','valuation-legacy-user','owner');
INSERT INTO "Store"(id,"organizationId",name,"updatedAt") VALUES('valuation-legacy-store','valuation-legacy-org','Synthetic branch',NOW());
INSERT INTO "Product"(id,"organizationId",name,sku,barcode,unit,"salePrice","costPrice","updatedAt") VALUES('valuation-legacy-product','valuation-legacy-org','Synthetic product','valuation-sku','valuation-barcode','dona',10,3,NOW());
INSERT INTO "InventoryBalance"("storeId","productId",quantity,"updatedAt") VALUES('valuation-legacy-store','valuation-legacy-product',4,NOW());
INSERT INTO "InventoryMovement"(id,"organizationId","storeId","productId","movementType","quantityDelta","unitCost","sourceType","sourceId","createdBy") VALUES('valuation-legacy-movement','valuation-legacy-org','valuation-legacy-store','valuation-legacy-product','opening',4,3,'legacy_opening','valuation-synthetic-source','valuation-legacy-user');
SQL
valuation_movement_hash=$(query "$valuation_old" "SELECT md5(row_to_json(m)::text) FROM \"InventoryMovement\" m WHERE id='valuation-legacy-movement'")
docker exec pos-plan-test-db pg_dump -U pos_test -d "$valuation_old" -Fc > "$valuation_workdir/old.dump"
create_database "$valuation_clone"
docker exec -i pos-plan-test-db pg_restore -U pos_test -d "$valuation_clone" --exit-on-error --single-transaction --no-owner --no-acl < "$valuation_workdir/old.dump"
apply "$valuation_clone"
apply "$valuation_clone"
[[ "$(query "$valuation_clone" 'SELECT count(*) FROM "InventoryValuationEvent"')" == 0 ]]
[[ "$(query "$valuation_clone" 'SELECT count(*) FROM "InventoryValuationSequence"')" == 0 ]]
[[ "$(query "$valuation_clone" "SELECT md5(row_to_json(m)::text) FROM \"InventoryMovement\" m WHERE id='valuation-legacy-movement'")" == "$valuation_movement_hash" ]]
query "$valuation_clone" "UPDATE \"Product\" SET \"costPrice\"=5 WHERE id='valuation-legacy-product'" >/dev/null
[[ "$(query "$valuation_clone" 'SELECT "legacyMovementCount"::text||'"'"':'"'"'||"baselineQuantity"::text||'"'"':'"'"'||"baselineUnitCost"::text||'"'"':'"'"'||"lastSequence"::text FROM "InventoryValuationSequence"')" == '1:4.000000:3.000000:1' ]]
if query "$valuation_clone" 'UPDATE "InventoryValuationSequence" SET "lastSequence"="lastSequence"+1' > "$valuation_workdir/forged-sequence.log" 2>&1;then exit 1;fi
rg -q 'requires original posting capture' "$valuation_workdir/forged-sequence.log"
# Real native batch receipt in the upgraded isolated clone, then full dump/restore.
docker exec -i pos-plan-test-db psql -X -U pos_test -d "$valuation_clone" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
INSERT INTO "Product"(id,"organizationId",name,sku,barcode,unit,"salePrice","costPrice","updatedAt","batchTracking") VALUES('batch-restore-product','valuation-legacy-org','Synthetic batch receipt','batch-restore-sku','batch-restore-barcode','dona',10,3,NOW(),false);
UPDATE "Product" SET "batchTracking"=true WHERE id='batch-restore-product';
INSERT INTO "StockDocument"(id,"organizationId","storeId","documentType","documentNo","createdBy") VALUES('batch-restore-doc','valuation-legacy-org','valuation-legacy-store','purchase','BATCH-RESTORE','valuation-legacy-user');
INSERT INTO "StockDocumentItem"(id,"stockDocumentId","productId",quantity,"unitCost","batchInput") VALUES('batch-restore-item','batch-restore-doc','batch-restore-product',1,3,jsonb_build_object('code','RESTORE-LOT','receivedOn',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tashkent','YYYY-MM-DD'),'expiresOn',to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tashkent')+interval '30 days','YYYY-MM-DD')));
INSERT INTO "InventoryBalance"("storeId","productId",quantity,"updatedAt") VALUES('valuation-legacy-store','batch-restore-product',1,NOW());
INSERT INTO "InventoryMovement"(id,"organizationId","storeId","productId","movementType","quantityDelta","unitCost","sourceType","sourceId","createdBy") VALUES('batch-restore-movement','valuation-legacy-org','valuation-legacy-store','batch-restore-product','stock_document',1,3,'stock_document','batch-restore-doc','valuation-legacy-user');
INSERT INTO "InventoryBatch"(id,"organizationId","productId",code,"receivedOn","expiresOn","originItemId","createdBy") SELECT 'batch-restore-batch','valuation-legacy-org','batch-restore-product','RESTORE-LOT',"batchInput"->>'receivedOn',"batchInput"->>'expiresOn',id,'valuation-legacy-user' FROM "StockDocumentItem" WHERE id='batch-restore-item';
INSERT INTO "InventoryBatchEntry"(id,"organizationId","batchId","storeId","movementId","quantityDelta") VALUES('batch-restore-entry','valuation-legacy-org','batch-restore-batch','valuation-legacy-store','batch-restore-movement',1);
UPDATE "StockDocument" SET status='confirmed',"confirmedAt"=NOW(),"confirmedBy"='valuation-legacy-user' WHERE id='batch-restore-doc';
COMMIT;
SQL
DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$valuation_clone" NODE_ENV=test AUTH_CRITICAL_MFA_REQUIRED=false node --require ./scripts/test-resolver.cjs scripts/ops/valuation-cost-fixture.cjs
DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$valuation_clone" NODE_ENV=test AUTH_CRITICAL_MFA_REQUIRED=false node --require ./scripts/test-resolver.cjs scripts/ops/serial-restore-fixture.cjs
DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$valuation_clone" NODE_ENV=test AUTH_CRITICAL_MFA_REQUIRED=false node --require ./scripts/test-resolver.cjs scripts/ops/report-restore-fixture.cjs
DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$valuation_clone" NODE_ENV=test AUTH_CRITICAL_MFA_REQUIRED=false node --require ./scripts/test-resolver.cjs scripts/ops/loyalty-restore-fixture.cjs
valuation_loyalty_hash=$(query "$valuation_clone" 'SELECT md5(string_agg(payload, chr(10) ORDER BY payload)) FROM (SELECT row_to_json(a)::text AS payload FROM "LoyaltyPolicyVersion" a UNION ALL SELECT row_to_json(a)::text FROM "LoyaltyPointLot" a UNION ALL SELECT row_to_json(a)::text FROM "LoyaltyPointEntry" a UNION ALL SELECT row_to_json(a)::text FROM "LoyaltyRedemption" a UNION ALL SELECT row_to_json(a)::text FROM "LoyaltyRecoveryTransfer" a) journals')
valuation_report_hash=$(query "$valuation_clone" 'SELECT md5(string_agg(payload, chr(10) ORDER BY payload)) FROM (SELECT row_to_json(a)::text AS payload FROM "ReportSchedule" a UNION ALL SELECT row_to_json(a)::text FROM "ReportScheduleRun" a) journals')
valuation_serial_hash=$(query "$valuation_clone" 'SELECT md5(string_agg(payload, chr(10) ORDER BY payload)) FROM (SELECT row_to_json(a)::text AS payload FROM "SerialNumber" a UNION ALL SELECT row_to_json(a)::text FROM "SerialEvent" a UNION ALL SELECT row_to_json(a)::text FROM "Warranty" a UNION ALL SELECT row_to_json(a)::text FROM "WarrantyService" a) journals')
valuation_cost_hash=$(query "$valuation_clone" 'SELECT md5(string_agg(payload, chr(10) ORDER BY payload)) FROM (SELECT row_to_json(a)::text AS payload FROM "ReceiptCostApplication" a UNION ALL SELECT row_to_json(c)::text FROM "ReceiptCostContinuation" c) journals')
valuation_batch_hash=$(query "$valuation_clone" 'SELECT md5(row_to_json(b)::text||row_to_json(e)::text) FROM "InventoryBatch" b JOIN "InventoryBatchEntry" e ON e."batchId"=b.id WHERE b.id='"'"'batch-restore-batch'"'"'')
valuation_event_hash=$(query "$valuation_clone" 'SELECT md5(row_to_json(e)::text) FROM "InventoryValuationEvent" e')
docker exec pos-plan-test-db pg_dump -U pos_test -d "$valuation_clone" -Fc > "$valuation_workdir/valuation.dump"
create_database "$valuation_restore"
docker exec -i pos-plan-test-db pg_restore -U pos_test -d "$valuation_restore" --exit-on-error --single-transaction --no-owner --no-acl < "$valuation_workdir/valuation.dump"
[[ "$(query "$valuation_restore" 'SELECT md5(row_to_json(e)::text) FROM "InventoryValuationEvent" e')" == "$valuation_event_hash" ]]
[[ "$(query "$valuation_restore" "SELECT md5(row_to_json(m)::text) FROM \"InventoryMovement\" m WHERE id='valuation-legacy-movement'")" == "$valuation_movement_hash" ]]
[[ "$(query "$valuation_restore" 'SELECT md5(row_to_json(b)::text||row_to_json(e)::text) FROM "InventoryBatch" b JOIN "InventoryBatchEntry" e ON e."batchId"=b.id WHERE b.id='"'"'batch-restore-batch'"'"'')" == "$valuation_batch_hash" ]]
[[ "$(query "$valuation_restore" 'SELECT md5(string_agg(payload, chr(10) ORDER BY payload)) FROM (SELECT row_to_json(a)::text AS payload FROM "ReceiptCostApplication" a UNION ALL SELECT row_to_json(c)::text FROM "ReceiptCostContinuation" c) journals')" == "$valuation_cost_hash" ]]
DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$valuation_restore" NODE_ENV=test AUTH_CRITICAL_MFA_REQUIRED=false node --require ./scripts/test-resolver.cjs scripts/ops/valuation-cost-fixture.cjs --verify
[[ "$(query "$valuation_restore" 'SELECT md5(string_agg(payload, chr(10) ORDER BY payload)) FROM (SELECT row_to_json(a)::text AS payload FROM "SerialNumber" a UNION ALL SELECT row_to_json(a)::text FROM "SerialEvent" a UNION ALL SELECT row_to_json(a)::text FROM "Warranty" a UNION ALL SELECT row_to_json(a)::text FROM "WarrantyService" a) journals')" == "$valuation_serial_hash" ]]
DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$valuation_restore" NODE_ENV=test AUTH_CRITICAL_MFA_REQUIRED=false node --require ./scripts/test-resolver.cjs scripts/ops/serial-restore-fixture.cjs --verify
[[ "$(query "$valuation_restore" 'SELECT md5(string_agg(payload, chr(10) ORDER BY payload)) FROM (SELECT row_to_json(a)::text AS payload FROM "ReportSchedule" a UNION ALL SELECT row_to_json(a)::text FROM "ReportScheduleRun" a) journals')" == "$valuation_report_hash" ]]
DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$valuation_restore" NODE_ENV=test AUTH_CRITICAL_MFA_REQUIRED=false node --require ./scripts/test-resolver.cjs scripts/ops/report-restore-fixture.cjs --verify
[[ "$(query "$valuation_restore" 'SELECT md5(string_agg(payload, chr(10) ORDER BY payload)) FROM (SELECT row_to_json(a)::text AS payload FROM "LoyaltyPolicyVersion" a UNION ALL SELECT row_to_json(a)::text FROM "LoyaltyPointLot" a UNION ALL SELECT row_to_json(a)::text FROM "LoyaltyPointEntry" a UNION ALL SELECT row_to_json(a)::text FROM "LoyaltyRedemption" a UNION ALL SELECT row_to_json(a)::text FROM "LoyaltyRecoveryTransfer" a) journals')" == "$valuation_loyalty_hash" ]]
DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$valuation_restore" NODE_ENV=test AUTH_CRITICAL_MFA_REQUIRED=false node --require ./scripts/test-resolver.cjs scripts/ops/loyalty-restore-fixture.cjs --verify
create_database "$valuation_fresh"
apply "$valuation_fresh"
valuation_expected=$(rg --files prisma/migrations | rg '/migration.sql$' | wc -l)
[[ "$(query "$valuation_fresh" 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')" == "$valuation_expected" ]]
printf 'PASS: %s fresh migrations; synthetic133 dump upgrade/repeat; no legacy order backfill; proven legacy boundary; native forge rejection; full valuation, batch, application, continuation, serial, warranty, service and original scheduled report and loyalty source journals dump/restore unchanged\n' "$valuation_expected"
