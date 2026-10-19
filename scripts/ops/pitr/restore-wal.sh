#!/bin/sh
set -eu
umask 077
wal_name=${1:?WAL name required}
destination=${2:?Restore destination required}
archive=${3:?Private archive directory required}
case "$wal_name" in ''|*[!a-zA-Z0-9.]*) exit 1;; esac
[ "${#wal_name}" -le 64 ]
[ "$wal_name" != . ]
[ "$wal_name" != .. ]
[ -d "$archive" ]
[ ! -L "$archive" ]
[ "$(stat -c %a "$archive")" = 700 ]
[ "$(stat -c %u "$archive")" = "$(id -u)" ]
[ -f "$archive/$wal_name" ]
[ ! -L "$archive/$wal_name" ]
[ ! -L "$destination" ]
cp "$archive/$wal_name" "$destination"
chmod 600 "$destination"
