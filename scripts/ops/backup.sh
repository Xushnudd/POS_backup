#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIRECTORY:?BACKUP_DIRECTORY is required}"
: "${BACKUP_RECIPIENT:?GPG public-key recipient fingerprint is required}"
command -v pg_dump >/dev/null
command -v gpg >/dev/null
mkdir -p "$BACKUP_DIRECTORY"
backup_workdir=$(mktemp -d)
trap 'rm -rf "$backup_workdir"' EXIT
backup_name="pos-$(date -u +%Y%m%dT%H%M%SZ)-$(node -e 'process.stdout.write(require("node:crypto").randomUUID())').dump.gpg"
# Native libpq environment keeps secrets out of process arguments.
POS_DATABASE_CONNECTION="$DATABASE_URL" node "$(dirname "$0")/pg-env.cjs" > "$backup_workdir/connection"
mapfile -d '' -t backup_connection < "$backup_workdir/connection"
export "${backup_connection[@]}"
rm "$backup_workdir/connection"
pg_dump --format=custom --no-owner --no-acl --file="$backup_workdir/database.dump"
gpg --batch --yes --encrypt --recipient "$BACKUP_RECIPIENT" --output "$backup_workdir/$backup_name" "$backup_workdir/database.dump"
# No plaintext backup leaves the private temporary directory.
install -m 600 "$backup_workdir/$backup_name" "$BACKUP_DIRECTORY/$backup_name"
(cd "$BACKUP_DIRECTORY" && sha256sum "$backup_name" > "$backup_name.sha256")
printf 'Encrypted backup created: %s\n' "$backup_name"
