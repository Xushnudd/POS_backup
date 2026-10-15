// Real native PostgreSQL15 WAL/PITR rehearsal. Creates only uniquely named,
// network-disabled disposable containers/volumes; never reads .env or connects
// to an existing database. Requires local Docker and an existing Node image.
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {createHash, randomBytes} from 'node:crypto'

const root = resolve(import.meta.dirname, '../..')
const suffix = `${Date.now()}-${process.pid}`
const prefix = `pos-pitr-drill-${suffix}`
const source = `${prefix}-source`
const recovered = `${prefix}-recovered`
const unreachable = `${prefix}-unreachable`
const volumes = [`${prefix}-source-data`, `${prefix}-repository`, `${prefix}-recovered-data`, `${prefix}-unreachable-data`]
const postgresImage = process.env.POS_PITR_POSTGRES_IMAGE || 'postgres:15-alpine'
const nodeImage = process.env.POS_PITR_NODE_IMAGE || 'pos-app:local'
const localDate = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date()).replaceAll('-', '')
const output = resolve(process.env.POS_PITR_EVIDENCE || `tasks/evidence/pitr-drill-${localDate}.json`)
const cleanup = []
const checks = []
function run(args, {input, allowedFailure = false, timeout = 90000} = {}) {
  const result = spawnSync('docker', args, {encoding: 'utf8', input, timeout, maxBuffer: 4 * 1024 * 1024})
  if (!allowedFailure && result.status !== 0) throw new Error(`Docker ${args[0]} failed: ${result.stderr || result.error || result.stdout}`)
  return result
}
function sql(container, query) {
  return run(['exec', '-i', '--user', 'postgres', container, 'psql', '-XAt', '-U', 'postgres', '-d', 'pitr_fixture', '-v', 'ON_ERROR_STOP=1'], {input: query}).stdout.trim()
}
async function until(predicate, message, seconds = 60) {
  const deadline = Date.now() + seconds * 1000
  while (Date.now() < deadline) {
    try { if (predicate()) return } catch { /* PostgreSQL startup/recovery may not yet accept the local socket. */ }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(message)
}
const shell = (container, code) => run(['exec', '--user', 'postgres', container, 'sh', '-eu', '-c', code])
const scriptMount = ['-v', `${root}/scripts/ops/pitr:/ops/pitr:ro,z`]
let evidence
try {
  for (const image of [postgresImage, nodeImage]) run(['image', 'inspect', image])
  for (const volume of volumes) {run(['volume', 'create', '--label', 'pos.pitr.drill=true', volume]); cleanup.push(['volume', 'rm', volume])}
  run(['run', '-d', '--name', source, '--label', 'pos.pitr.drill=true', '--network', 'none',
    '-e', `POSTGRES_PASSWORD=${randomBytes(24).toString('hex')}`, '-e', 'POSTGRES_DB=pitr_fixture',
    '-e', 'POSTGRES_INITDB_ARGS=--auth-local=peer --auth-host=reject',
    '-v', `${volumes[0]}:/var/lib/postgresql/data`, '-v', `${volumes[1]}:/repository`, ...scriptMount,
    '-v', `${root}/ops/postgresql/pitr.conf:/etc/postgresql/pitr.conf:ro,z`,
    '--entrypoint', 'sh', postgresImage, '-ec',
    'mkdir -p /repository/archive /repository/base; chmod 700 /repository /repository/archive /repository/base; chown -R postgres:postgres /repository; exec docker-entrypoint.sh postgres -c config_file=/etc/postgresql/pitr.conf -c listen_addresses='])
  cleanup.push(['rm', '-f', source])
  await until(() => run(['exec', '--user', 'postgres', source, 'pg_isready', '-U', 'postgres', '-d', 'pitr_fixture'], {allowedFailure: true}).status === 0, 'Source PostgreSQL did not become ready')
  // Wait past docker-entrypoint's temporary initialization server.
  await until(() => sql(source, 'SHOW archive_mode') === 'on', 'Archive mode not enabled')
  sql(source, `CREATE TABLE pitr_account(id integer PRIMARY KEY, balance numeric(18,2) NOT NULL);
    CREATE TABLE pitr_ledger(id text PRIMARY KEY, amount numeric(18,2) NOT NULL, committed_at timestamptz DEFAULT clock_timestamp());
    INSERT INTO pitr_account VALUES (1,100.00);
    INSERT INTO pitr_ledger(id,amount) VALUES ('baseline',100.00);`)
  const baseOutput = shell(source, '/bin/sh /ops/pitr/base-backup.sh /repository').stdout.trim()
  const base = baseOutput.split('\n').at(-1)
  assert.match(base, /^[0-9]{8}T[0-9]{6}Z-[a-zA-Z0-9]+$/)
  sql(source, `BEGIN; UPDATE pitr_account SET balance=balance+25.75 WHERE id=1; INSERT INTO pitr_ledger(id,amount) VALUES ('before_target',25.75); COMMIT;`)
  const timestamp = sql(source, `SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS.US') || '+00';`)
  await new Promise(resolve => setTimeout(resolve, 1100))
  sql(source, `BEGIN; UPDATE pitr_account SET balance=0 WHERE id=1; INSERT INTO pitr_ledger(id,amount) VALUES ('after_target',-125.75); COMMIT;`)
  assert.equal(sql(source, 'SELECT balance::text FROM pitr_account WHERE id=1'), '0.00')
  const finalWal = sql(source, 'SELECT pg_walfile_name(pg_current_wal_lsn());')
  sql(source, 'SELECT pg_switch_wal();')
  await until(() => shell(source, `[ -f /repository/archive/${finalWal} ]`).status === 0, 'Final committed WAL was not archived')
  const sourceSettings = sql(source, `SELECT current_setting('server_version') || '|' || current_setting('wal_level') || '|' || current_setting('archive_mode') || '|' || current_setting('archive_timeout') || '|' || current_setting('full_page_writes');`)
  const archiver = sql(source, 'SELECT archived_count::text || \'|\' || failed_count::text FROM pg_stat_archiver;')
  assert.equal(archiver.split('|')[1], '0')
  checks.push({check: 'native_base_backup_and_continuous_archive', passed: true, pgVerifyBackup: 'passed before publication and restore', settings: sourceSettings, archiver})

  const accessDenied = run(['exec', '--user', '65534:65534', source, 'sh', '-c', `cat /repository/archive/${finalWal}`], {allowedFailure: true})
  assert.notEqual(accessDenied.status, 0)
  const writeDenied = run(['exec', '--user', '65534:65534', source, 'sh', '-c', 'touch /repository/unauthorized-write'], {allowedFailure: true})
  assert.notEqual(writeDenied.status, 0)
  const databaseDenied = run(['exec', '--user', '65534:65534', source, 'psql', '-XAt', '-U', 'postgres', '-d', 'pitr_fixture', '-c', 'SELECT 1'], {allowedFailure: true})
  assert.notEqual(databaseDenied.status, 0)
  assert.equal(shell(source, `stat -c '%a:%u' /repository/archive/${finalWal}`).stdout.trim(), '600:70')
  shell(source, 'mkdir -m 700 /repository/probe; printf original > /repository/probe-source; /bin/sh /ops/pitr/archive-wal.sh /repository/probe-source TESTWAL /repository/probe; /bin/sh /ops/pitr/archive-wal.sh /repository/probe-source TESTWAL /repository/probe; printf changed > /repository/probe-source')
  const collision = run(['exec', '--user', 'postgres', source, 'sh', '/ops/pitr/archive-wal.sh', '/repository/probe-source', 'TESTWAL', '/repository/probe'], {allowedFailure: true})
  assert.notEqual(collision.status, 0)
  assert.equal(shell(source, 'cat /repository/probe/TESTWAL').stdout, 'original')
  checks.push({check: 'private_access_and_archive_integrity', passed: true, repositoryMode: '0700', walFileMode: '0600', unauthorizedReadDenied: true, unauthorizedWriteDenied: true, unrelatedOsUidCannotImpersonateDatabaseRole: true, identicalRetryAccepted: true, conflictingOverwriteDenied: true})

  const retention = JSON.parse(run(['run', '--rm', '--network', 'none', '--user', '70:70', '-v', `${volumes[1]}:/repository:ro`, ...scriptMount,
    '-v', `${root}/ops/postgresql/pitr-policy.json:/ops/pitr-policy.json:ro,z`, '--entrypoint', 'node', nodeImage, '/ops/pitr/retention-plan.mjs', '/repository', '/ops/pitr-policy.json']).stdout)
  assert.equal(retention.retentionDays, 30)
  assert.equal(retention.automaticDeletion, false)
  assert.deepEqual(retention.retainedBaseBackups, [base])
  assert.equal(retention.requestedWindowCovered, false)
  checks.push({check: 'configured_retention_on_real_repository', passed: true, result: retention, note: 'New drill repository has no 30-day history; the configured retention window is not an elapsed 30-day availability claim.'})

  const recoveryStarted = Date.now()
  function startRecovery(name, volume, targetTime) {
    run(['run', '-d', '--name', name, '--label', 'pos.pitr.drill=true', '--network', 'none', '-v', `${volume}:/var/lib/postgresql/data`, '-v', `${volumes[1]}:/repository:ro`, ...scriptMount,
      '--entrypoint', 'sh', postgresImage, '-ec',
      `chown postgres:postgres /var/lib/postgresql/data; chmod 700 /var/lib/postgresql/data; su-exec postgres /bin/sh /ops/pitr/prepare-restore.sh /repository/base/${base} /repository/archive /var/lib/postgresql/data "${targetTime}" /ops/pitr/restore-wal.sh; exec su-exec postgres postgres -D /var/lib/postgresql/data`])
    cleanup.push(['rm', '-f', name])
  }
  startRecovery(recovered, volumes[2], timestamp)
  await until(() => {
    const result = run(['exec', '--user', 'postgres', recovered, 'psql', '-XAt', '-U', 'postgres', '-d', 'pitr_fixture', '-c', 'SELECT pg_is_wal_replay_paused()'], {allowedFailure: true})
    return result.status === 0 && result.stdout.trim() === 't'
  }, 'Recovery did not reach and pause at target timestamp')
  assert.equal(sql(recovered, 'SELECT balance::text FROM pitr_account WHERE id=1;'), '125.75')
  assert.equal(sql(recovered, 'SELECT string_agg(id,\',\' ORDER BY id) FROM pitr_ledger;'), 'baseline,before_target')
  assert.equal(sql(recovered, `SELECT pg_last_xact_replay_timestamp() <= '${timestamp}'::timestamptz;`), 't')
  assert.equal(sql(recovered, 'SHOW transaction_read_only;'), 'on')
  assert.equal(sql(recovered, 'SELECT pg_is_in_recovery();'), 't')
  const restoredWrite = run(['exec', '--user', 'postgres', recovered, 'psql', '-XAt', '-U', 'postgres', '-d', 'pitr_fixture', '-v', 'ON_ERROR_STOP=1', '-c', 'UPDATE pitr_account SET balance=999 WHERE id=1'], {allowedFailure: true})
  assert.notEqual(restoredWrite.status, 0)
  const replayTimestamp = sql(recovered, 'SELECT pg_last_xact_replay_timestamp();')
  const recoverySeconds = Number(((Date.now() - recoveryStarted) / 1000).toFixed(3))
  checks.push({check: 'real_timestamp_restore', passed: true, targetTimestampUtc: timestamp, lastReplayedCommit: replayTimestamp, restoredBalance: '125.75', sourceAfterTargetBalance: '0.00', restoredLedgerIds: ['baseline', 'before_target'], excludedLedgerId: 'after_target', recoveryPaused: true, readOnlyWritesRejected: true, localFixtureRecoverySeconds: recoverySeconds, committedBeforeTargetRowsLost: 0})
  const recoveryLog = run(['logs', recovered]).stdout + run(['logs', recovered]).stderr
  assert.match(recoveryLog, /recovery stopping before commit of transaction/)

  const badTarget = run(['exec', '--user', 'postgres', source, 'sh', '/ops/pitr/prepare-restore.sh', `/repository/base/${base}`, '/repository/archive', '/repository/bad-target', `2026-01-01'; archive_mode=on`, '/ops/pitr/restore-wal.sh'], {allowedFailure: true})
  assert.notEqual(badTarget.status, 0)
  assert.notEqual(run(['exec', '--user', 'postgres', source, 'test', '-e', '/repository/bad-target'], {allowedFailure: true}).status, 0)
  const nonemptyTarget = run(['exec', '--user', 'postgres', source, 'sh', '/ops/pitr/prepare-restore.sh', `/repository/base/${base}`, '/repository/archive', '/repository/probe', timestamp, '/ops/pitr/restore-wal.sh'], {allowedFailure: true})
  assert.notEqual(nonemptyTarget.status, 0)
  const future = sql(source, `SELECT to_char((clock_timestamp() + interval '1 day') AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS.US') || '+00';`)
  startRecovery(unreachable, volumes[3], future)
  await until(() => run(['inspect', '--format', '{{.State.Running}}', unreachable]).stdout.trim() === 'false', 'Unreachable future recovery target did not fail closed')
  const futureLogResult = run(['logs', unreachable])
  assert.match(futureLogResult.stdout + futureLogResult.stderr, /recovery ended before configured recovery target was reached/)
  checks.push({check: 'restore_rejection_paths', passed: true, malformedTimestampRejectedBeforeMutation: true, nonemptyTargetRejected: true, unreachableFutureTimestampFailedClosed: true})
  const files = ['scripts/ops/pitr/archive-wal.sh', 'scripts/ops/pitr/restore-wal.sh', 'scripts/ops/pitr/base-backup.sh', 'scripts/ops/pitr/prepare-restore.sh', 'scripts/ops/pitr/retention-plan.mjs', 'scripts/ops/pitr-retention.test.mjs', 'scripts/ops/pitr-shell.test.mjs', 'scripts/ops/test-pitr.mjs', 'ops/postgresql/pitr-policy.json', 'ops/postgresql/pitr.conf', 'docker-compose.pitr.yml', 'docs/operations/pitr.md']
  evidence = {
    task: 'OPS-03.03', status: 'passed', executedAtUtc: new Date().toISOString(), scope: 'Disposable local PostgreSQL15 native WAL/PITR rehearsal; no source/live database, .env, external provider, deployment or production SLA involved.',
    command: 'node scripts/ops/test-pitr.mjs', sourceRevision: spawnSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).stdout.trim(),
    files: files.map(path => ({path, sha256: createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')})),
    postgresImageId: run(['image', 'inspect', '--format', '{{.Id}}', postgresImage]).stdout.trim(),
    network: 'none; no ports published', localResources: {prefix, containers: [source, recovered, unreachable], volumes}, checks,
    limits: ['Production off-host encrypted storage, scheduler, real operator/key custody and disaster RPO/RTO require separate external acceptance.', '30-day retention is configured; this newly created repository cannot prove 30 days of elapsed history.', 'Recovery stays paused/read-only. No promotion, application traffic, vendor dispatch, auth/offline reconciliation or irreversible data deletion was performed.']
  }
} finally {
  const failures = []
  for (const args of cleanup.reverse()) if (run(args, {allowedFailure: true}).status !== 0) failures.push(args.join(' '))
  if (failures.length) throw new Error(`PITR disposable cleanup failed: ${failures.join('; ')}`)
}
evidence.cleanup = 'all drill containers and volumes removed'
mkdirSync(resolve(output, '..'), {recursive: true})
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`)
process.stdout.write(`PASS: OPS-03.03 real local target-timestamp restore, access rejection, WAL integrity, retention plan and failure cases; ${checks.length} checks.\nEvidence: ${output}\n`)
