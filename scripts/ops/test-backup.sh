#!/usr/bin/env bash
set -euo pipefail
backup_smoke_dir=$(mktemp -d /tmp/pos-backup-smoke.XXXXXX)
restore_db="pos_restore_test_$(date +%s)"
fixture_id=$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')
asset_hex=$(node -e 'require("sharp")({create:{width:4,height:3,channels:4,background:"red"}}).webp().toBuffer().then(buffer=>process.stdout.write(buffer.toString("hex")))')
asset_sha=$(node -e 'process.stdout.write(require("node:crypto").createHash("sha256").update(Buffer.from(process.argv[1],"hex")).digest("hex"))' "$asset_hex")
asset_size=$((${#asset_hex}/2))
cleanup() {
 docker exec -i pos-plan-test-db psql -U pos_test -d pos_test -v fixture="$fixture_id" >/dev/null <<'SQL'
DELETE FROM "Organization" WHERE id=:'fixture';
DELETE FROM "User" WHERE id=:'fixture';
SQL
 docker exec pos-plan-test-db dropdb -U pos_test --if-exists "$restore_db" >/dev/null
 rm -rf "$backup_smoke_dir"
}
trap cleanup EXIT
mkdir -m 700 "$backup_smoke_dir/keys" "$backup_smoke_dir/bin"
export GNUPGHOME="$backup_smoke_dir/keys"
gpg --batch --passphrase '' --quick-generate-key 'POS isolated backup test' rsa2048 encr 1d >/dev/null 2>&1
BACKUP_RECIPIENT=$(gpg --batch --with-colons --list-keys 2>/dev/null | awk -F: '$1=="fpr"{print $10;exit}')
export BACKUP_RECIPIENT
export POS_BACKUP_APP_VERSION=isolated-test-release
export POS_SECRET_RECOVERY_REFERENCE=isolated-test-key-store
export POS_FILE_QUOTA_BYTES=104857600
export APP_ORIGIN=https://restore-test.example.invalid
for command_name in pg_dump pg_restore psql; do
 cat > "$backup_smoke_dir/bin/$command_name" <<'SHIM'
#!/usr/bin/env bash
set -euo pipefail
exec docker exec -i -e PGHOST -e PGUSER -e PGPASSWORD -e PGDATABASE -e PGPORT=5432 pos-plan-test-db "$(basename "$0")" "$@"
SHIM
 chmod +x "$backup_smoke_dir/bin/$command_name"
done
# File paths passed to pg tools must be visible in the container. Adapt only dump/restore
# streams; production scripts themselves remain unchanged.
cat > "$backup_smoke_dir/bin/pg_dump" <<'SHIM'
#!/usr/bin/env bash
set -euo pipefail
output_file=''
args=()
for argument in "$@"; do
 case "$argument" in --file=*) output_file=${argument#--file=} ;; *) args+=("$argument");; esac
done
docker exec -i -e PGHOST -e PGUSER -e PGPASSWORD -e PGDATABASE -e PGPORT=5432 pos-plan-test-db pg_dump "${args[@]}" > "$output_file"
SHIM
cat > "$backup_smoke_dir/bin/pg_restore" <<'SHIM'
#!/usr/bin/env bash
set -euo pipefail
args=("$@")
last_index=$((${#args[@]}-1))
input_file=${args[$last_index]}
unset 'args[last_index]'
docker exec -i -e PGHOST -e PGUSER -e PGPASSWORD -e PGDATABASE -e PGPORT=5432 pos-plan-test-db pg_restore "${args[@]}" < "$input_file"
SHIM
export PATH="$backup_smoke_dir/bin:$PATH"
export DATABASE_URL=postgresql://pos_test:local-test-only@127.0.0.1:55439/pos_test
export BACKUP_DIRECTORY="$backup_smoke_dir/backups"
# Exercise recovery of an active count, immutable reading and persistent stock freeze.
docker exec -i pos-plan-test-db psql -U pos_test -d pos_test -v ON_ERROR_STOP=1 -v fixture="$fixture_id" -v asset_hex="$asset_hex" -v asset_sha="$asset_sha" -v asset_size="$asset_size" >/dev/null <<'SQL'
BEGIN;
INSERT INTO "Organization" (id,name,phone) VALUES (:'fixture','Backup count fixture',:'fixture');
INSERT INTO "User" (id,"fullName",phone,"passwordHash") VALUES (:'fixture','Fixture operator',:'fixture','not-a-login');
INSERT INTO "OrganizationUser" (id,"organizationId","userId",role) VALUES (:'fixture',:'fixture',:'fixture','owner');
INSERT INTO "Store" (id,"organizationId",name,"updatedAt") VALUES (:'fixture',:'fixture','Fixture store',NOW());
INSERT INTO "Product" (id,"organizationId",name,sku,barcode,unit,"salePrice","costPrice","updatedAt") VALUES (:'fixture',:'fixture','Fixture SKU','FIX','FIX','dona',10,5,NOW());
INSERT INTO "FileAsset" (id,"organizationId","productId","createdBy",name,mime,size,sha256,width,height,data) VALUES (:'fixture',:'fixture',:'fixture',:'fixture','restore.webp','image/webp',:asset_size,:'asset_sha',4,3,decode(:'asset_hex','hex'));
UPDATE "Product" SET "imageUrl"='/api/files/'||:'fixture' WHERE id=:'fixture';
INSERT INTO "InventoryBalance" ("storeId","productId",quantity,"updatedAt") VALUES (:'fixture',:'fixture',3,NOW());
INSERT INTO "StockCount" (id,"organizationId","storeId",scope,blind,"createdBy") VALUES (:'fixture',:'fixture',:'fixture','partial',TRUE,:'fixture');
INSERT INTO "StockCountLine" (id,"countId","productId","productName",sku,unit,"expectedQuantity","unitCost") VALUES (:'fixture',:'fixture',:'fixture','Fixture SKU','FIX','dona',3,5);
INSERT INTO "StockCountReading" (id,"lineId",round,quantity,"countedBy") VALUES (:'fixture',:'fixture',1,2,:'fixture');
INSERT INTO "StockFreeze" ("storeId","productId","countId") VALUES (:'fixture',:'fixture',:'fixture');
INSERT INTO "Customer" (id,"organizationId","fullName",phone,"creditLimit","updatedAt") VALUES (:'fixture',:'fixture','Ledger fixture',:'fixture',100,NOW());
INSERT INTO "DebtEntry" (id,"organizationId","customerId","sourceType","sourceId",amount,"actorId","effectiveAt","dueAt") VALUES (:'fixture',:'fixture',:'fixture','opening_debt',:'fixture',3.75,:'fixture','2026-01-01','2026-02-01');
-- Restore must preserve source-linked advance, allocation and unused refund too.
INSERT INTO "Register" (id,"storeId",name,code) VALUES (:'fixture',:'fixture','Restore cash register','RESTORE');
INSERT INTO "Shift" (id,"registerId","organizationUserId","openingCash") VALUES (:'fixture',:'fixture',:'fixture',0);
INSERT INTO "FinancialAccount" (id,"organizationId","storeId","registerId",name,kind) VALUES (:'fixture',:'fixture',:'fixture',:'fixture','Restore cash','cash');
INSERT INTO "FinancialDocument" (id,"organizationId","storeId",kind,amount,reason,"actorId") VALUES (:'fixture'||'-advance',:'fixture',:'fixture','customer_advance',13.25,'Restore advance receipt',:'fixture');
INSERT INTO "CashMovement" (id,"shiftId","movementType",amount,reason,"createdBy") VALUES (:'fixture'||'-advance',:'fixture','cash_in',13.25,'Restore advance receipt',:'fixture');
INSERT INTO "AccountEntry" (id,"organizationId","accountId","documentId",amount,"cashMovementId") VALUES (:'fixture'||'-advance',:'fixture',:'fixture',:'fixture'||'-advance',13.25,:'fixture'||'-advance');
INSERT INTO "CustomerAdvance" (id,"organizationId","customerId","documentId",amount) VALUES (:'fixture',:'fixture',:'fixture',:'fixture'||'-advance',13.25);
INSERT INTO "DebtEntry" (id,"organizationId","customerId","sourceType","sourceId",amount,"actorId") VALUES (:'fixture'||'-advance-debt',:'fixture',:'fixture','opening_debt',:'fixture'||'-advance-debt',1.25,:'fixture');
INSERT INTO "CustomerAdvanceAllocation" (id,"advanceId","debtEntryId",amount) VALUES (:'fixture',:'fixture',:'fixture'||'-allocated',1.25);
INSERT INTO "DebtEntry" (id,"organizationId","customerId","debtOriginId","sourceType","sourceId",amount,"actorId") VALUES (:'fixture'||'-allocated',:'fixture',:'fixture',:'fixture'||'-advance-debt','advance_allocation',:'fixture',-1.25,:'fixture');
INSERT INTO "FinancialDocument" (id,"organizationId","storeId",kind,amount,reason,"actorId") VALUES (:'fixture'||'-refund',:'fixture',:'fixture','customer_refund',2.01,'Restore unused advance refund',:'fixture');
INSERT INTO "CashMovement" (id,"shiftId","movementType",amount,reason,"createdBy") VALUES (:'fixture'||'-refund',:'fixture','cash_out',2.01,'Restore unused advance refund',:'fixture');
INSERT INTO "AccountEntry" (id,"organizationId","accountId","documentId",amount,"cashMovementId") VALUES (:'fixture'||'-refund',:'fixture',:'fixture',:'fixture'||'-refund',-2.01,:'fixture'||'-refund');
INSERT INTO "CustomerAdvanceRefund" (id,"advanceId","documentId",amount) VALUES (:'fixture',:'fixture',:'fixture'||'-refund',2.01);
INSERT INTO "Session" (id,"organizationId","userId","tokenHash","expiresAt","idleExpiresAt") VALUES (:'fixture',:'fixture',:'fixture',md5(:'fixture')||md5(:'fixture'),NOW()+INTERVAL '1 hour',NOW()+INTERVAL '1 hour');
INSERT INTO "SecurityEvent" (id,"organizationId","userId",type,suspicious,"sourceSessionId","expiresAt") VALUES (:'fixture',:'fixture',:'fixture','login_failed',TRUE,:'fixture',CURRENT_TIMESTAMP+INTERVAL '90 days');
INSERT INTO "BackgroundJob" (id,"organizationId",type,payload,state,attempts,"maxAttempts","lastError","expiresAt") VALUES (:'fixture',:'fixture','reconciliation',jsonb_build_object('storeId',:'fixture'),'dead',3,3,'WORK_FAILED',NOW()+INTERVAL '1 hour');
INSERT INTO "JobAuthorization" (id,"organizationId","jobId",generation,"userId","sessionId",reason) VALUES (:'fixture',:'fixture',:'fixture',0,:'fixture',:'fixture','Backup fixture original authorization');
INSERT INTO "JobEvent" (id,"jobId",event,attempt,generation,code) VALUES (:'fixture',:'fixture','dead',3,0,'WORK_FAILED');
COMMIT;
SQL
printf 'isolated fixture credentials; never a real secret\n' > "$backup_smoke_dir/isolated-secret"
chmod 600 "$backup_smoke_dir/isolated-secret"
export POS_SECRET_BACKUP_FILE="$backup_smoke_dir/isolated-secret"
scripts/ops/backup-secrets.sh
chmod 644 "$POS_SECRET_BACKUP_FILE"
if scripts/ops/backup-secrets.sh > "$backup_smoke_dir/unsafe-secret.log" 2>&1; then
 printf 'ERROR: unsafe secret permissions accepted\n' >&2; exit 1
fi
chmod 600 "$POS_SECRET_BACKUP_FILE"
secret_file=$(find "$BACKUP_DIRECTORY" -name 'pos-secrets-*.gpg' -print -quit)
gpg --quiet --batch --output "$backup_smoke_dir/recovered-secret" --decrypt "$secret_file"
cmp "$POS_SECRET_BACKUP_FILE" "$backup_smoke_dir/recovered-secret"
[[ $(stat -c '%a' "$secret_file") == 600 ]]
export POS_SECRET_RECOVERY_REFERENCE="$(basename "$secret_file")"
source_export_fingerprint=$(docker exec pos-plan-test-db psql -U pos_test -d pos_test -Atc 'SELECT COALESCE(md5(string_agg("jobId" || sha256 || size::text || COALESCE(md5(data),'"'"'erased'"'"'), '"'"'|'"'"' ORDER BY "jobId")),md5('"'"''"'"')) FROM "JobExport"')
scripts/ops/backup.sh
backup_file=$(find "$BACKUP_DIRECTORY" -name '*.bundle-v1.dump.gpg' -print -quit)
docker exec pos-plan-test-db createdb -U pos_test "$restore_db"
export RESTORE_DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$restore_db"
export RESTORE_CONFIRM_DATABASE="$restore_db"
restore_started=$(date +%s)
export RESTORE_CONFIGURATION_DIRECTORY="$backup_smoke_dir/recovered-config"
scripts/ops/restore.sh "$backup_file"
node -e 'const fs=require("node:fs"),assert=require("node:assert/strict");const m=JSON.parse(fs.readFileSync(process.argv[1]));assert.equal(m.appVersion,"isolated-test-release");assert.equal(m.configuration.POS_FILE_QUOTA_BYTES,"104857600");assert.equal(m.configuration.APP_ORIGIN,"https://restore-test.example.invalid");assert.match(m.secretRecoveryReference,/^pos-secrets-.*\.gpg$/);assert.ok(!("DATABASE_URL" in m.configuration));assert.ok(!("BACKUP_RECIPIENT" in m.configuration));' "$RESTORE_CONFIGURATION_DIRECTORY/recovery-manifest.json"
gpg --quiet --batch --output "$backup_smoke_dir/manifest-check.json" --decrypt "$backup_file.manifest.gpg"
printf 'different database bytes\n' > "$backup_smoke_dir/wrong-dump"
if node scripts/ops/backup-manifest.mjs verify "$backup_smoke_dir/manifest-check.json" "$backup_smoke_dir/wrong-dump" > "$backup_smoke_dir/mismatch.log" 2>&1; then
 printf 'ERROR: mismatching manifest accepted\n' >&2; exit 1
fi
restored_migrations=$(docker exec pos-plan-test-db psql -U pos_test -d "$restore_db" -Atc 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')
source_migrations=$(docker exec pos-plan-test-db psql -U pos_test -d pos_test -Atc 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')
[[ "$restored_migrations" == "$source_migrations" ]]
restored_export_fingerprint=$(docker exec pos-plan-test-db psql -U pos_test -d "$restore_db" -Atc 'SELECT COALESCE(md5(string_agg("jobId" || sha256 || size::text || COALESCE(md5(data),'"'"'erased'"'"'), '"'"'|'"'"' ORDER BY "jobId")),md5('"'"''"'"')) FROM "JobExport"')
[[ "$restored_export_fingerprint" == "$source_export_fingerprint" ]]
printf 'PASS: protected export bytes, sizes, hashes and erased-state fingerprint recovered\n'
restored_count=$(docker exec -i pos-plan-test-db psql -U pos_test -d "$restore_db" -At -v fixture="$fixture_id" <<'SQL'
SELECT c.status || ':' || l."expectedQuantity"::text || ':' || r.quantity::text || ':' || b.quantity::text FROM "StockCount" c JOIN "StockCountLine" l ON l."countId"=c.id JOIN "StockCountReading" r ON r."lineId"=l.id JOIN "StockFreeze" f ON f."countId"=c.id JOIN "InventoryBalance" b ON b."storeId"=f."storeId" AND b."productId"=f."productId" WHERE c.id=:'fixture';
SQL
)
[[ "$restored_count" == 'counting:3.000000:2.000000:3.000000' ]]
restored_debt=$(docker exec -i pos-plan-test-db psql -U pos_test -d "$restore_db" -At -v fixture="$fixture_id" <<'SQL'
SELECT amount::text || ':' || "sourceType" || ':' || to_char("effectiveAt",'YYYY-MM-DD') || ':' || to_char("dueAt",'YYYY-MM-DD') FROM "DebtEntry" WHERE id=:'fixture' AND "actorId"=:'fixture';
SQL
)
[[ "$restored_debt" == '3.75:opening_debt:2026-01-01:2026-02-01' ]]
restored_advance=$(docker exec -i pos-plan-test-db psql -U pos_test -d "$restore_db" -At -v fixture="$fixture_id" <<'SQL'
SELECT a.amount::text || ':' || a.available::text || ':' || x.amount::text || ':' || e.amount::text || ':' || r.amount::text FROM "CustomerAdvanceBalance" a JOIN "CustomerAdvanceAllocation" x ON x."advanceId"=a.id JOIN "DebtEntry" e ON e.id=x."debtEntryId" JOIN "CustomerAdvanceRefund" r ON r."advanceId"=a.id WHERE a.id=:'fixture' AND e."sourceType"='advance_allocation' AND e."sourceId"=x.id;
SQL
)
[[ "$restored_advance" == '13.25:9.99:1.25:-1.25:2.01' ]]
printf 'PASS: original advance, allocation/debt source, unused refund and exact 9.99 balance recovered\n'
node node_modules/typescript/bin/tsc -p tsconfig.test.json
DATABASE_URL="$RESTORE_DATABASE_URL" RESTORE_FIXTURE_ID="$fixture_id" node --require ./scripts/test-resolver.cjs scripts/ops/verify-restored-app.mjs
restore_elapsed=$(($(date +%s)-restore_started))
[[ "$restore_elapsed" -le 7200 ]]
printf 'PASS: isolated fixture restore RTO_seconds=%s fixture_RPO_loss=0; hosting schedule/SLA not measured\n' "$restore_elapsed"


if scripts/ops/restore.sh "$backup_file"; then
 printf 'ERROR: overwrite guard failed\n' >&2
 exit 1
fi
printf 'PASS: encrypted backup, transactional restore, migration records match source, active count/readings/freeze and customer ledger recovered, existing-table guard\n'
