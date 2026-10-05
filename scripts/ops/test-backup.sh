#!/usr/bin/env bash
set -euo pipefail
backup_smoke_dir=$(mktemp -d /tmp/pos-backup-smoke.XXXXXX)
restore_db="pos_restore_test_$(date +%s)"
cleanup() {
 docker exec pos-plan-test-db dropdb -U pos_test --if-exists "$restore_db" >/dev/null
 rm -rf "$backup_smoke_dir"
}
trap cleanup EXIT
mkdir -m 700 "$backup_smoke_dir/keys" "$backup_smoke_dir/bin"
export GNUPGHOME="$backup_smoke_dir/keys"
gpg --batch --passphrase '' --quick-generate-key 'POS isolated backup test' rsa2048 encr 1d >/dev/null 2>&1
BACKUP_RECIPIENT=$(gpg --batch --with-colons --list-keys 2>/dev/null | awk -F: '$1=="fpr"{print $10;exit}')
export BACKUP_RECIPIENT
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
scripts/ops/backup.sh
backup_file=$(find "$BACKUP_DIRECTORY" -name '*.gpg' -print -quit)
docker exec pos-plan-test-db createdb -U pos_test "$restore_db"
export RESTORE_DATABASE_URL="postgresql://pos_test:local-test-only@127.0.0.1:55439/$restore_db"
export RESTORE_CONFIRM_DATABASE="$restore_db"
scripts/ops/restore.sh "$backup_file"
restored_migrations=$(docker exec pos-plan-test-db psql -U pos_test -d "$restore_db" -Atc 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')
source_migrations=$(docker exec pos-plan-test-db psql -U pos_test -d pos_test -Atc 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')
[[ "$restored_migrations" == "$source_migrations" ]]
if scripts/ops/restore.sh "$backup_file"; then
 printf 'ERROR: overwrite guard failed\n' >&2
 exit 1
fi
printf 'PASS: encrypted backup, transactional restore, migration records match source, existing-table guard\n'
