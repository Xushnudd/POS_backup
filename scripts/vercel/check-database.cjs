// Read-only pre-deployment check. Never log a raw database error or URL.
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({ log: [] });

async function check() {
  const expected = fs.readdirSync('prisma/migrations')
    .filter(name => fs.existsSync(`prisma/migrations/${name}/migration.sql`))
    .map(name => ({ name, checksum: createHash('sha256').update(fs.readFileSync(`prisma/migrations/${name}/migration.sql`)).digest('hex') }));
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const [state] = await tx.$queryRawUnsafe("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS history,current_setting('TimeZone') AS timezone");
    if (!state.history) return { connected: true, ready: false, applied: 0, expected: expected.length, code: 'MIGRATION_HISTORY_MISSING' };
    const applied = await tx.$queryRawUnsafe('SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations"');
    const done = applied.filter(row => row.finished && !row.rolled_back);
    const matches = expected.length > 0 && done.length === expected.length
      && expected.every(item => done.some(row => row.migration_name === item.name && row.checksum === item.checksum))
      && !applied.some(row => !row.finished && !row.rolled_back);
    if (!matches) return { connected: true, ready: false, applied: done.length, expected: expected.length, code: 'MIGRATIONS_INCOMPLETE_OR_CHANGED' };
    const [restore] = await tx.$queryRawUnsafe('SELECT auth_restore_ready() AS ready');
    const ready = restore.ready && ['UTC', 'Etc/UTC', 'GMT', 'Etc/GMT'].includes(state.timezone);
    return { connected: true, ready, applied: done.length, expected: expected.length, code: ready ? 'READY' : 'RESTORE_OR_TIMEZONE_NOT_READY' };
  }, { maxWait: 15000, timeout: 30000 });
}

check().then(result => {
  console.log(JSON.stringify({ event: 'vercel_database_check', ...result }));
  if (!result.ready) process.exitCode = 1;
}).catch(error => {
  const raw = error.code || error.errorCode;
  const code = typeof raw === 'string' && /^P\d{4}$/.test(raw) ? raw
    : /could not locate the Query Engine/.test(String(error.message)) ? 'QUERY_ENGINE_MISSING' : 'DATABASE_CHECK_FAILED';
  console.error(JSON.stringify({ event: 'vercel_database_check', ready: false, code, kind: error.constructor?.name }));
  process.exitCode = 1;
}).finally(() => db.$disconnect());
