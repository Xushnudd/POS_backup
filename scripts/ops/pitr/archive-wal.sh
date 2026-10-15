#!/bin/sh
# Invoked by PostgreSQL as its OS account. Repository must belong to this cluster.
set -eu
umask 077
source_file=${1:?WAL source required}
wal_name=${2:?WAL name required}
archive=${3:?Private archive directory required}
case "$wal_name" in ''|*[!a-zA-Z0-9.]*) exit 1;; esac
[ "${#wal_name}" -le 64 ]
[ "$wal_name" != . ]
[ "$wal_name" != .. ]
[ -d "$archive" ]
[ ! -L "$archive" ]
[ "$(stat -c %a "$archive")" = 700 ]
[ "$(stat -c %u "$archive")" = "$(id -u)" ]
[ -f "$source_file" ]
[ ! -L "$source_file" ]
destination=$archive/$wal_name
# A PostgreSQL retry may encounter an already archived identical segment.
# Different bytes must never replace it, even when two commands race.
if [ -e "$destination" ] || [ -L "$destination" ]; then
  [ -f "$destination" ]
  [ ! -L "$destination" ]
  cmp -s "$source_file" "$destination"
  [ "$(stat -c %a "$destination")" = 600 ]
  [ "$(stat -c %u "$destination")" = "$(id -u)" ]
  # A preceding attempt may have died after link() but before syncing its
  # directory. Retry success must also mean the published entry is durable.
  sync "$destination"
  sync -f "$archive"
  exit 0
fi
temporary=$(mktemp "$archive/.incoming.XXXXXXXX")
trap 'rm -f "$temporary"' EXIT HUP INT TERM
cp "$source_file" "$temporary"
chmod 600 "$temporary"
sync "$temporary"
if ! ln "$temporary" "$destination" 2>/dev/null; then
  [ -f "$destination" ]
  [ ! -L "$destination" ]
  cmp -s "$temporary" "$destination"
fi
sync -f "$archive"
