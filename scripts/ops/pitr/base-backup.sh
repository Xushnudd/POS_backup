#!/bin/sh
# Run as PostgreSQL OS account. Authentication uses normal libpq env/.pgpass.
set -eu
umask 077
repository=${1:?Private PITR repository required}
case "$repository" in /*) ;; *) exit 1;; esac
[ -d "$repository" ]
[ ! -L "$repository" ]
[ "$(stat -c %a "$repository")" = 700 ]
[ "$(stat -c %u "$repository")" = "$(id -u)" ]
mkdir -p "$repository/base"
chmod 700 "$repository/base"
started=$(date -u +%s)
pending=$(mktemp -d "$repository/base/.pending.XXXXXXXX")
trap 'rm -rf "$pending"' EXIT HUP INT TERM
pg_basebackup --pgdata="$pending" --format=plain --wal-method=stream --checkpoint=fast --manifest-checksums=SHA256
pg_verifybackup "$pending"
completed=$(date -u +%s)
printf '{"format":1,"startedEpoch":%s,"completedEpoch":%s,"verified":true}\n' "$started" "$completed" > "$pending/pitr-backup.json"
chmod 600 "$pending/pitr-backup.json"
sync -f "$pending"
name=$(date -u +%Y%m%dT%H%M%SZ)-${pending##*.}
mv "$pending" "$repository/base/$name"
trap - EXIT HUP INT TERM
printf '%s\n' "$name"
