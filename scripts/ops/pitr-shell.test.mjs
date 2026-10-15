import {test} from 'node:test'
import assert from 'node:assert/strict'
import {chmodSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, readdirSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {spawnSync} from 'node:child_process'

const scripts = resolve(import.meta.dirname, 'pitr')
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'pos-pitr-shell-'))
  t.after(() => rmSync(root, {force: true, recursive: true}))
  const archive = join(root, 'archive')
  mkdirSync(archive, {mode: 0o700})
  const source = join(root, 'source')
  writeFileSync(source, Buffer.from([0, 255, 24, 0, 17]), {mode: 0o600})
  return {root, archive, source}
}
const invoke = (script, args) => spawnSync('sh', [join(scripts, script), ...args], {encoding: 'utf8', timeout: 5000})
test('native WAL archiver publishes original bytes and accepts exact retry while rejecting conflicting bytes', t => {
  const {archive, source} = fixture(t)
  const args = [source, '000000010000000000000001', archive]
  assert.equal(invoke('archive-wal.sh', args).status, 0)
  assert.equal(invoke('archive-wal.sh', args).status, 0)
  const archived = readFileSync(join(archive, args[1]))
  writeFileSync(source, 'different')
  assert.notEqual(invoke('archive-wal.sh', args).status, 0)
  assert.deepEqual(readFileSync(join(archive, args[1])), archived)
  assert.deepEqual(readdirSync(archive), [args[1]])
})
test('native WAL archive rejects unsafe paths, permissions and source/destination symlinks', t => {
  const {root, archive, source} = fixture(t)
  for (const name of ['../escape', '.', '..', 'a/b', 'bad name', 'A'.repeat(65)]) assert.notEqual(invoke('archive-wal.sh', [source, name, archive]).status, 0)
  chmodSync(archive, 0o755)
  assert.notEqual(invoke('archive-wal.sh', [source, 'NORMAL', archive]).status, 0)
  chmodSync(archive, 0o700)
  const sourceLink = join(root, 'source-link')
  symlinkSync(source, sourceLink)
  assert.notEqual(invoke('archive-wal.sh', [sourceLink, 'NORMAL', archive]).status, 0)
  symlinkSync(source, join(archive, 'NORMAL'))
  assert.notEqual(invoke('archive-wal.sh', [source, 'NORMAL', archive]).status, 0)
  assert.deepEqual(readFileSync(source), Buffer.from([0, 255, 24, 0, 17]))
})
test('restore command requires existing regular archive and rejects destination symlink without touching its target', t => {
  const {root, archive, source} = fixture(t)
  assert.equal(invoke('archive-wal.sh', [source, 'WAL', archive]).status, 0)
  const target = join(root, 'restored')
  assert.equal(invoke('restore-wal.sh', ['WAL', target, archive]).status, 0)
  assert.deepEqual(readFileSync(target), readFileSync(source))
  assert.notEqual(invoke('restore-wal.sh', ['MISSING', target, archive]).status, 0)
  const link = join(root, 'target-link')
  symlinkSync(source, link)
  assert.notEqual(invoke('restore-wal.sh', ['WAL', link, archive]).status, 0)
  assert.deepEqual(readFileSync(source), Buffer.from([0, 255, 24, 0, 17]))
})
test('recovery preparation refuses injected timestamp and symlink ancestor before target creation', t => {
  const {root, archive} = fixture(t)
  const target = join(root, 'target')
  const args = [root, archive, target, "2026-01-01'; archive_mode=on", join(scripts, 'restore-wal.sh')]
  assert.notEqual(invoke('prepare-restore.sh', args).status, 0)
  assert.ok(!readdirSync(root).includes('target'))
  const link = join(root, 'parent-link')
  symlinkSync(root, link)
  args[2] = join(link, 'target')
  args[3] = '2026-01-01 00:00:00.000000+00'
  assert.notEqual(invoke('prepare-restore.sh', args).status, 0)
  assert.ok(!readdirSync(root).includes('target'))
})
