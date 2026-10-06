#!/usr/bin/env bash
set -euo pipefail
release_started=$(date +%s)
release_root=$(pwd)
release_checkout=$(mktemp -d /tmp/pos-previous-app.XXXXXX)
trap 'rm -rf "$release_checkout"' EXIT
# Previous tracked application source, not live checkout modifications or secret files.
release_base=$(git rev-parse HEAD)
git archive "$release_base" src tsconfig.json tsconfig.test.json scripts/test-resolver.cjs | tar -x -C "$release_checkout"
ln -s "$release_root/node_modules" "$release_checkout/node_modules"
mkdir -p "$release_checkout/tests"
cp scripts/ops/rollback-acceptance.ts "$release_checkout/tests/rollback-acceptance.ts"
export DATABASE_URL=postgresql://pos_test:local-test-only@127.0.0.1:55439/pos_test
bash scripts/ops/test-migrations.sh
bash scripts/ops/test-backup.sh
release_rollback_started=$(date +%s)
(cd "$release_checkout" && node node_modules/typescript/bin/tsc -p tsconfig.test.json && node --require ./scripts/test-resolver.cjs .test-build/tests/rollback-acceptance.js)
release_finished=$(date +%s)
printf 'PASS: isolated release drill base=%s elapsed_seconds=%s app_rollback_seconds=%s fixture_RPO_loss=0\n' "$release_base" "$((release_finished-release_started))" "$((release_finished-release_rollback_started))"
