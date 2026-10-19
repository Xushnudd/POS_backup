import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanHistory } from './history-scan.mjs';

function repo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'pos-history-test-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } });
  try {
    git('init', '--quiet'); git('config', 'user.name', 'Synthetic test'); git('config', 'user.email', 'test@example.invalid');
    return fn(root, git);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const commit = git => { git('add', '-A'); git('-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'synthetic fixture'); };
test('deleted historical token is found without disclosing its value', () => repo((root, git) => {
  const token = ['gh', 'p_', 'A'.repeat(36)].join('');
  writeFileSync(join(root, 'source.txt'), `old credential\n${token}\n`); commit(git);
  writeFileSync(join(root, 'source.txt'), 'clean now\n'); commit(git);
  const report = scanHistory(root);
  assert.equal(report.complete, true); assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].line, 2); assert.equal(report.findings[0].kind, 'github_token');
  assert.ok(!JSON.stringify(report).includes(token));
}));
test('historical credential store is reported by path, not content', () => repo((root, git) => {
  writeFileSync(join(root, '.env.old'), 'NEVER_OUTPUT_THIS_VALUE'); commit(git);
  const report = scanHistory(root);
  assert.equal(report.scanned, 0); assert.equal(report.findings[0].kind, 'historical_credential_store');
  assert.ok(!JSON.stringify(report).includes('NEVER_OUTPUT_THIS_VALUE'));
}));
test('budget exhaustion is incomplete, never a clean scan', () => repo((root, git) => {
  writeFileSync(join(root, 'big.txt'), 'a'.repeat(1024)); commit(git);
  const report = scanHistory(root, { maxBlobBytes: 100 });
  assert.equal(report.complete, false); assert.equal(report.skipped[0].reason, 'blob_size_limit');
  assert.throws(() => scanHistory(root, { maxBlobs: 0 }));
}));
test('empty history and binary exclusions have explicit results', () => repo((root, git) => {
  assert.equal(scanHistory(root).blobs, 0);
  writeFileSync(join(root, 'binary.bin'), Buffer.from([0, 1, 2, 3])); commit(git);
  const report = scanHistory(root);
  assert.equal(report.binary, 1); assert.equal(report.scanned, 0); assert.equal(report.findings.length, 0);
}));
