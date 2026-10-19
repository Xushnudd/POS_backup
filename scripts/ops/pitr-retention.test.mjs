import {test} from 'node:test'
import assert from 'node:assert/strict'
import {chmodSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, readdirSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {retentionPlan} from './pitr/retention-plan.mjs'

const now = 1800000000
const day = 86400
const policy = {format: 1, retentionDays: 30, automaticDeletion: false}
const wal = suffix => `0000000100000000${suffix.padStart(8, '0')}`
function fixture(t, ages = [60, 31, 20, 0]) {
  const root = mkdtempSync(join(tmpdir(), 'pos-pitr-retention-'))
  t.after(() => rmSync(root, {force: true, recursive: true}))
  for (const name of ['base', 'archive']) mkdirSync(join(root, name), {mode: 0o700})
  ages.forEach((age, index) => {
    const path = join(root, 'base', `backup${index}`)
    mkdirSync(path, {mode: 0o700})
    writeFileSync(join(path, 'pitr-backup.json'), JSON.stringify({format: 1, verified: true, startedEpoch: now - age * day - 60, completedEpoch: now - age * day}), {mode: 0o600})
    writeFileSync(join(path, 'backup_label'), `START WAL LOCATION: 0/1000000 (file ${wal(String(index + 1))})\n`, {mode: 0o600})
    writeFileSync(join(root, 'archive', wal(String(index + 1))), 'synthetic-test-only', {mode: 0o600})
  })
  return root
}
test('PITR retains boundary base older than cutoff and every newer base, with all required WAL', t => {
  const root = fixture(t)
  const result = retentionPlan(root, policy, now)
  assert.deepEqual(result.retainedBaseBackups, ['backup1', 'backup2', 'backup3'])
  assert.deepEqual(result.baseRemovalCandidates, ['backup0'])
  assert.deepEqual(result.walRemovalCandidates, [wal('1')])
  assert.equal(result.requestedWindowCovered, true)
  assert.equal(result.mode, 'plan_only')
  assert.deepEqual(readdirSync(join(root, 'base')).sort(), ['backup0', 'backup1', 'backup2', 'backup3'])
  assert.equal(readdirSync(join(root, 'archive')).length, 4)
})
test('new repository reports insufficient historical coverage without dropping its only base', t => {
  const root = fixture(t, [0])
  const result = retentionPlan(root, policy, now)
  assert.equal(result.requestedWindowCovered, false)
  assert.deepEqual(result.retainedBaseBackups, ['backup0'])
  assert.deepEqual(result.walRemovalCandidates, [])
})
test('other timelines and history are retained without guessed ancestry', t => {
  const root = fixture(t)
  for (const name of ['00000002.history', '000000020000000000000001', `${wal('1')}.00000028.backup`]) writeFileSync(join(root, 'archive', name), 'synthetic', {mode: 0o600})
  assert.deepEqual(retentionPlan(root, policy, now).walRemovalCandidates, [wal('1')])
})
test('unsafe access permissions, symlinks and incomplete metadata fail closed', t => {
  const root = fixture(t)
  chmodSync(join(root, 'archive'), 0o755)
  assert.throws(() => retentionPlan(root, policy, now), /PRIVATE_DIRECTORY/)
  chmodSync(join(root, 'archive'), 0o700)
  const path = join(root, 'base', 'backup0', 'pitr-backup.json')
  writeFileSync(path, '{}')
  assert.throws(() => retentionPlan(root, policy, now), /METADATA_INVALID/)
  rmSync(path)
  symlinkSync(join(root, 'base', 'backup1', 'pitr-backup.json'), path)
  assert.throws(() => retentionPlan(root, policy, now), /PRIVATE_FILE/)
})
test('automatic deletion and malformed retention are rejected', t => {
  const root = fixture(t)
  for (const invalid of [{...policy, automaticDeletion: true}, {...policy, retentionDays: 0}, {...policy, retentionDays: 30.5}]) assert.throws(() => retentionPlan(root, invalid, now), /POLICY_INVALID/)
})
