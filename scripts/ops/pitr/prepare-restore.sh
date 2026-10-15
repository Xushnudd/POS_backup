#!/bin/sh
# Never prepares a live/nonempty target or promotes a recovered cluster.
set -eu
umask 077
base=${1:?Verified base backup required}
archive=${2:?Private archive directory required}
target=${3:?Explicit empty PostgreSQL data directory required}
timestamp=${4:?UTC recovery timestamp required}
helper=${5:?Absolute restore-wal.sh path required}
for path in "$base" "$archive" "$target" "$helper"; do
  case "$path" in /*) ;; *) exit 1;; esac
  case "$path" in *[!a-zA-Z0-9_./-]*|*/../*|*/..) exit 1;; esac
  ancestor=$path
  while [ "$ancestor" != / ]; do
    [ ! -L "$ancestor" ]
    ancestor=$(dirname "$ancestor")
  done
done
# Whitelist before embedding into PostgreSQL config. PostgreSQL then validates
# the calendar value itself before accepting recovery configuration.
printf '%s' "$timestamp" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?\+00$'
[ -f "$base/pitr-backup.json" ]
[ ! -L "$base/pitr-backup.json" ]
[ -d "$archive" ]
[ "$(stat -c %a "$archive")" = 700 ]
[ "$(stat -c %u "$archive")" = "$(id -u)" ]
[ -f "$helper" ]
[ ! -L "$helper" ]
mkdir -p "$target"
[ -z "$(find "$target" -mindepth 1 -maxdepth 1 -print -quit)" ]
pg_verifybackup --ignore=pitr-backup.json "$base"
cp -a "$base/." "$target/"
rm -f "$target/postmaster.pid" "$target/standby.signal"
chmod 700 "$target"
cat >> "$target/postgresql.auto.conf" <<EOF
restore_command = '/bin/sh $helper "%f" "%p" $archive'
recovery_target_time = '$timestamp'
recovery_target_inclusive = true
recovery_target_timeline = 'current'
recovery_target_action = 'pause'
hot_standby = on
archive_mode = off
default_transaction_read_only = on
listen_addresses = ''
EOF
: > "$target/recovery.signal"
sync -f "$target"
printf 'Prepared isolated read-only recovery target; operator review and auth/provider/offline reconciliation required before promotion.\n'
