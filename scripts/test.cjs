const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const path = require('node:path');
const selected = process.argv.includes('--integration') ? 'integration' : 'unit';
if (selected === 'integration') {
  let isolated = false;
  try {
    const connection = new URL(process.env.DATABASE_URL || '');
    isolated = connection.protocol === 'postgresql:' && connection.hostname === '127.0.0.1'
      && connection.port === '55439' && connection.pathname === '/pos_test' && connection.username === 'pos_test';
  } catch { /* Reject before compilation or any DB connection, without logging secrets. */ }
  if (!isolated) {
    process.stderr.write('Integration tests require the isolated 127.0.0.1:55439/pos_test database and pos_test user\n');
    process.exit(1);
  }
}
const compile = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json'], {stdio:'inherit'});
if (compile.status !== 0) process.exit(compile.status || 1);
const files = readdirSync('.test-build/tests').filter(f => f.endsWith(`.${selected}.test.js`)).map(f => path.join('.test-build/tests', f));
if (!files.length) throw new Error('No tests found');
// Files share a disposable DB, including migration/DDL fault-injection tests.
// Explicit Promise.all concurrency scenarios inside each test remain parallel.
const run = spawnSync(process.execPath, ['--require', './scripts/test-resolver.cjs', '--test', ...(selected==='integration'?['--test-concurrency=1']:[]), ...files], {stdio:'inherit'});
process.exit(run.status || 0);
