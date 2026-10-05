#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${RESTORE_DATABASE_URL:?A dedicated empty restore database is required}"
: "${RESTORE_CONFIRM_DATABASE:?Explicit target database name is required}"
restore_file=${1:?Encrypted backup file is required}
command -v pg_restore >/dev/null
command -v psql >/dev/null
command -v gpg >/dev/null
restore_workdir=$(mktemp -d)
trap 'rm -rf "$restore_workdir"' EXIT
POS_DATABASE_CONNECTION="$RESTORE_DATABASE_URL" node "$(dirname "$0")/pg-env.cjs" > "$restore_workdir/connection"
mapfile -d '' -t restore_connection < "$restore_workdir/connection"
export "${restore_connection[@]}"
rm "$restore_workdir/connection"
restore_database=$PGDATABASE
if [[ "$restore_database" != "$RESTORE_CONFIRM_DATABASE" ]]; then
  printf 'Target database confirmation mismatch\n' >&2
  exit 1
fi
# Restore never cleans/replaces existing business tables.
restore_tables=$(psql -X -A -t -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")
if [[ "$restore_tables" != 0 ]]; then
  printf 'Restore requires an empty database; existing tables detected\n' >&2
  exit 1
fi
(cd "$(dirname "$restore_file")" && sha256sum -c "$(basename "$restore_file").sha256")
gpg --batch --output "$restore_workdir/database.dump" --decrypt "$restore_file"
pg_restore --dbname="$PGDATABASE" --exit-on-error --single-transaction --no-owner --no-acl "$restore_workdir/database.dump"
printf 'Restored into confirmed empty database: %s\n' "$restore_database"
