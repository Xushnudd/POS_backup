const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { validateVercelEnvironment } = require('./environment.cjs');
const settings = {
  DATABASE_URL: 'postgresql://fixture:private-test-only@fixture-pooler.example.neon.tech/fixture?sslmode=require&channel_binding=require',
  APP_ORIGIN: 'https://fixture.vercel.app',
};

test('Vercel accepts the hosted TLS URL unchanged and requires the project Node version', () => {
  const before = JSON.stringify(settings);
  assert.doesNotThrow(() => validateVercelEnvironment(settings, '24.18.0'));
  assert.equal(JSON.stringify(settings), before);
  for (const version of ['20.0.0', '22.0.0', '25.0.0']) assert.throws(() => validateVercelEnvironment(settings, version), /Node.js 24/);
  assert.throws(() => validateVercelEnvironment({ ...settings, NODE_ENV: 'development' }), /NODE_ENV/);
});

test('Local database addresses and missing or malformed configuration fail before deployment', () => {
  for (const host of ['db', 'localhost', '127.0.0.1', '[::1]', '0.0.0.0', 'workstation.local', 'db.localhost', 'localhost.']) {
    assert.throws(() => validateVercelEnvironment({ ...settings, DATABASE_URL: `postgresql://fixture:fixture@${host}/fixture` }), /local Docker/);
  }
  for (const database of ['', 'not-a-url', 'https://database.example.invalid/fixture', 'postgresql://database.example.invalid']) {
    assert.throws(() => validateVercelEnvironment({ ...settings, DATABASE_URL: database }), /DATABASE_URL/);
  }
  assert.throws(() => validateVercelEnvironment({ ...settings, DATABASE_URL: settings.DATABASE_URL.replace('sslmode=require', 'sslmode=disable') }), /TLS/);
});

test('The configured origin is exact: local origins, paths and credential-bearing values fail closed', () => {
  for (const origin of ['', 'https://localhost', 'https://127.0.0.1', 'http://fixture.vercel.app', 'https://fixture.vercel.app/',
    'https://fixture.vercel.app/path', 'https://fixture.vercel.app?query=1', 'https://fixture.vercel.app#hash', 'https://user:secret@fixture.vercel.app']) {
    assert.throws(() => validateVercelEnvironment({ ...settings, APP_ORIGIN: origin }), /APP_ORIGIN/);
  }
});

test('Actual build entrypoint rejects local settings without exposing credentials or starting a build', () => {
  const secret = 'do-not-print-this-test-password';
  const result = spawnSync(process.execPath, ['scripts/vercel/build.cjs'], {
    encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production', APP_ORIGIN: settings.APP_ORIGIN,
      DATABASE_URL: `postgresql://fixture:${secret}@db/fixture` },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /local Docker/);
  assert.equal(result.stderr.includes(secret), false);
  assert.equal(result.stdout, '');
});

test('Read-only database diagnostic never exposes the connection string on failure', () => {
  const secret = 'do-not-print-this-diagnostic-password';
  const result = spawnSync(process.execPath, ['scripts/vercel/check-database.cjs'], {
    encoding: 'utf8', env: { ...process.env, DATABASE_URL: `invalid://fixture:${secret}@fixture.example.invalid/fixture` },
  });
  assert.equal(result.status, 1);
  const output = result.stdout + result.stderr;
  assert.equal(output.includes(secret), false);
  assert.equal(output.includes('invalid://'), false);
  const diagnostic = output.split('\n').filter(Boolean).map(line => JSON.parse(line)).find(row => row.event === 'vercel_database_check');
  assert.equal(diagnostic.ready, false);
  assert.equal(typeof diagnostic.code, 'string');
});
