#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${RESTORE_DATABASE_URL:?Confirmed restored target required}"
: "${RESTORE_CONFIRM_DATABASE:?Explicit database name required}"
: "${AUTH_RESTORE_REVIEWER:?Operator name required}"
: "${AUTH_RESTORE_REVIEW_EVIDENCE:?Nonsecret review evidence reference required}"
if [[ "${AUTH_RESTORE_CREDENTIALS_RECONCILED:-}" != yes || "${AUTH_RESTORE_ACCESS_RECONCILED:-}" != yes ]]; then
 printf 'Manual password/PIN and user/role/platform access reconciliation attestations required\n' >&2
 exit 1
fi
review_workdir=$(mktemp -d)
trap 'rm -rf "$review_workdir"' EXIT
POS_DATABASE_CONNECTION="$RESTORE_DATABASE_URL" node "$(dirname "$0")/pg-env.cjs" > "$review_workdir/connection"
mapfile -d '' -t review_connection < "$review_workdir/connection"
export "${review_connection[@]}"
if [[ "$PGDATABASE" != "$RESTORE_CONFIRM_DATABASE" ]]; then
 printf 'Target database confirmation mismatch\n' >&2; exit 1
fi
psql -X -v ON_ERROR_STOP=1 -v reviewer="$AUTH_RESTORE_REVIEWER" -v evidence="$AUTH_RESTORE_REVIEW_EVIDENCE" <<'SQL'
BEGIN;
LOCK TABLE "AuthRestoreCheckpoint" IN EXCLUSIVE MODE;
DO $$ BEGIN
 IF (SELECT count(*) FROM "AuthRestoreCheckpoint" WHERE "reviewedAt" IS NULL)<>1 THEN
  RAISE EXCEPTION 'Exactly one pending restore checkpoint required';
 END IF;
END $$;
UPDATE "AuthRestoreCheckpoint" SET "reviewedAt"=clock_timestamp(),reviewer=:'reviewer',"reviewEvidence"=:'evidence' WHERE "reviewedAt" IS NULL;
COMMIT;
SQL
printf 'Authentication quarantine review recorded; old tokens/factors remain revoked. Fresh login and authenticator enrollment required.\n'
