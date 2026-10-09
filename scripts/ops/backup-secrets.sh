#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${POS_SECRET_BACKUP_FILE:?Explicit private secret file is required; files are never auto-discovered}"
: "${BACKUP_DIRECTORY:?Private backup directory is required}"
: "${BACKUP_RECIPIENT:?GPG public recipient fingerprint is required}"
secret_backup_name="pos-secrets-$(date -u +%Y%m%dT%H%M%SZ)-$(node -e 'process.stdout.write(require("node:crypto").randomUUID())').gpg"
secret_workdir=$(mktemp -d)
trap 'rm -rf "$secret_workdir"' EXIT
# Read from one no-follow descriptor after ownership/permission/size checks.
# Plaintext exists only in the pipe, never a backup file or log.
node - "$POS_SECRET_BACKUP_FILE" <<'NODE' | gpg --quiet --batch --yes --encrypt --recipient "$BACKUP_RECIPIENT" --output "$secret_workdir/$secret_backup_name"
const fs=require('node:fs');const fd=fs.openSync(process.argv[2],fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
try{const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.uid!==process.getuid()||(stat.mode&0o077)!==0||stat.size<1||stat.size>1048576)throw new Error('Secret source must be own private regular file, 1..1MiB');process.stdout.write(fs.readFileSync(fd));}finally{fs.closeSync(fd);}
NODE
mkdir -p "$BACKUP_DIRECTORY"
install -m 600 "$secret_workdir/$secret_backup_name" "$BACKUP_DIRECTORY/$secret_backup_name"
(cd "$BACKUP_DIRECTORY" && sha256sum "$secret_backup_name" > "$secret_backup_name.sha256")
printf 'Separate encrypted secret recovery file created: %s\n' "$secret_backup_name"
