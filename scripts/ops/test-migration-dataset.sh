#!/usr/bin/env bash
set -euo pipefail
umask 077
# This drill never accepts a target URL, container or database supplied by the caller.
# It creates only its own UUID-named databases in the existing isolated test container.
dataset_suffix=$(node -e 'process.stdout.write(require("node:crypto").randomUUID().replaceAll("-",""))')
dataset_source="pos_dataset_source_$dataset_suffix"
dataset_target="pos_dataset_target_$dataset_suffix"
dataset_fresh="pos_dataset_fresh_$dataset_suffix"
dataset_rollback="pos_dataset_rollback_$dataset_suffix"
dataset_bad="pos_dataset_bad_$dataset_suffix"
dataset_private=$(mktemp -d /tmp/pos-migration-dataset.XXXXXX)
cleanup(){
 for dataset_db in "$dataset_source" "$dataset_target" "$dataset_fresh" "$dataset_rollback" "$dataset_bad"; do
  docker exec pos-plan-test-db dropdb -U pos_test --if-exists "$dataset_db" >/dev/null
 done
 rm -rf "$dataset_private"
}
trap cleanup EXIT
for dataset_db in "$dataset_source" "$dataset_target" "$dataset_fresh" "$dataset_rollback" "$dataset_bad"; do
 docker exec pos-plan-test-db createdb -U pos_test "$dataset_db"
done
export MIGRATION_SOURCE_QUIESCED=true POS_MIGRATION_PG_MODE=isolated_docker
export DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$dataset_source"
docker exec -i pos-plan-test-db psql -X -q -U pos_test -d "$dataset_source" -v ON_ERROR_STOP=1 < prisma/migrations/20260907100516_init/migration.sql
./node_modules/.bin/prisma migrate resolve --applied 20260907100516_init
docker exec -i pos-plan-test-db psql -X -q -U pos_test -d "$dataset_source" -v ON_ERROR_STOP=1 < scripts/ops/migration-legacy-fixture.sql
node scripts/ops/migration-dataset.mjs capture "$dataset_private/original.json"
docker exec pos-plan-test-db pg_dump -U pos_test -d "$dataset_source" --format=custom --no-owner --no-acl > "$dataset_private/original.dump"
for dataset_db in "$dataset_target" "$dataset_rollback" "$dataset_bad"; do
 docker exec -i pos-plan-test-db pg_restore -U pos_test -d "$dataset_db" --exit-on-error --no-owner --no-acl < "$dataset_private/original.dump"
done
export DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$dataset_target"
node scripts/ops/migration-dataset.mjs verify "$dataset_private/original.json" "$dataset_private/cloned.json"
./node_modules/.bin/prisma migrate deploy
node scripts/ops/migration-dataset.mjs verify "$dataset_private/original.json" "$dataset_private/migrated.json"
node scripts/ops/migration-dataset.mjs capture "$dataset_private/expanded.json"
./node_modules/.bin/prisma migrate deploy
node scripts/ops/migration-dataset.mjs verify "$dataset_private/expanded.json" "$dataset_private/repeated.json"
# Source was never migrated or backfilled; check it again independently.
export DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$dataset_source"
node scripts/ops/migration-dataset.mjs verify "$dataset_private/original.json" "$dataset_private/source-unchanged.json"
# Restoring the pre-upgrade backup is an offline rehearsal, not an in-place down migration.
export DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$dataset_rollback"
node scripts/ops/migration-dataset.mjs verify "$dataset_private/original.json" "$dataset_private/rollback.json"
rollback_version=$(docker exec pos-plan-test-db psql -X -At -U pos_test -d "$dataset_rollback" -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')
[[ "$rollback_version" == '1' ]]
# Original-column change with exactly the same row count must be detected.
docker exec pos-plan-test-db psql -X -q -U pos_test -d "$dataset_bad" -v ON_ERROR_STOP=1 -c "UPDATE \"Product\" SET name='Changed fixture name' WHERE id='dataset-product'" >/dev/null
export DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$dataset_bad"
if node scripts/ops/migration-dataset.mjs verify "$dataset_private/original.json" "$dataset_private/changed.json" > "$dataset_private/reject.log" 2>&1; then
 echo 'FAIL: changed data accepted';exit 1
fi
[[ "$(tail -n 1 "$dataset_private/reject.log")" == 'DATASET_CHANGED' ]]
# Ledger discrepancy is rejected, with no automatic repair.
docker exec pos-plan-test-db psql -X -q -U pos_test -d "$dataset_bad" -v ON_ERROR_STOP=1 -c 'UPDATE "InventoryBalance" SET quantity=999 WHERE "productId"='"'"'dataset-product'"'"'' >/dev/null
if node scripts/ops/migration-dataset.mjs capture "$dataset_private/invalid.json" > "$dataset_private/reject-ledger.log" 2>&1; then
 echo 'FAIL: unreconciled stock accepted';exit 1
fi
[[ ! -e "$dataset_private/invalid.json" ]]
# Simulate an invalid old installation that had lost its global indexes.
# Foundation preflight must stop before schema replacement or data rewriting.
docker exec -i pos-plan-test-db psql -X -q -U pos_test -d "$dataset_bad" -v ON_ERROR_STOP=1 <<'SQL'
DROP INDEX "Product_sku_key";
DROP INDEX "Product_barcode_key";
INSERT INTO "Product" (id,"organizationId",name,sku,barcode,unit,"salePrice","costPrice","updatedAt") VALUES ('invalid-duplicate','dataset-org','Invalid duplicate','SKU-DATASET','UNIQUE-INVALID','dona',1,0,NOW());
SQL
if docker exec -i pos-plan-test-db psql -X -q -1 -U pos_test -d "$dataset_bad" -v ON_ERROR_STOP=1 < prisma/migrations/202610050001_foundation/migration.sql > "$dataset_private/duplicate-preflight.log" 2>&1; then
 echo 'FAIL: duplicate legacy SKU accepted';exit 1
fi
rg -q 'Resolve tenant SKU/barcode duplicates before migration' "$dataset_private/duplicate-preflight.log"
preflight_preserved=$(docker exec pos-plan-test-db psql -X -At -U pos_test -d "$dataset_bad" -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM \"Product\" WHERE sku='SKU-DATASET'")
[[ "$preflight_preserved" == '2' ]]
new_index=$(docker exec pos-plan-test-db psql -X -At -U pos_test -d "$dataset_bad" -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname='Product_organizationId_sku_key'")
[[ "$new_index" == '0' ]]
# Fresh installation on its own empty database.
export DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$dataset_fresh"
./node_modules/.bin/prisma migrate deploy
expected_migrations=$(find prisma/migrations -name migration.sql -type f | wc -l)
for dataset_db in "$dataset_target" "$dataset_fresh"; do
 applied_migrations=$(docker exec pos-plan-test-db psql -X -At -U pos_test -d "$dataset_db" -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')
 [[ "$applied_migrations" == "$expected_migrations" ]]
 # Contract-phase rehearsal on disposable clones only. NOT VALID constraints
 # must prove the old rows valid before the operator can approve validation.
 docker exec -i pos-plan-test-db psql -X -q -U pos_test -d "$dataset_db" -v ON_ERROR_STOP=1 <<'SQL'
SELECT format('ALTER TABLE %I.%I VALIDATE CONSTRAINT %I',n.nspname,r.relname,c.conname)
FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace JOIN pg_class r ON r.oid=c.conrelid
WHERE n.nspname='public' AND NOT c.convalidated ORDER BY r.relname,c.conname
\gexec
SQL
 invalid_constraints=$(docker exec pos-plan-test-db psql -X -At -U pos_test -d "$dataset_db" -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND NOT c.convalidated")
 [[ "$invalid_constraints" == '0' ]]
 docker exec -i pos-plan-test-db psql -X -q -U pos_test -d "$dataset_db" -v ON_ERROR_STOP=1 < scripts/ops/tenant-catalog-acceptance.sql
done
node --input-type=module - "$dataset_private" "$expected_migrations" <<'JS'
import {readFileSync} from 'node:fs'
const dir=process.argv[2],read=name=>JSON.parse(readFileSync(dir+'/'+name+'.json','utf8'))
const result={status:'passed',environment:'isolated synthetic legacy dataset; actual pg_dump/pg_restore clone; no production or staging deployment',migrations:Number(process.argv[3]),legacy:read('migrated').comparison,ledger:read('migrated').ledger,ledgerPreserved:read('migrated').ledgerPreserved,repeatExpanded:read('repeated').comparison,clonePreserved:read('cloned').comparison.preserved,sourceUnchanged:read('source-unchanged').comparison.preserved,rollbackRestored:read('rollback').comparison.preserved,sameCountChangeRejected:!read('changed').comparison.preserved,ledgerMismatchRejected:true,freshInstall:true,validatedConstraints:true,tenantCatalogAcceptance:true,duplicateLegacyPreflightRejected:true,privateBackupsRemovedOnExit:true}
console.info(JSON.stringify(result))
JS
