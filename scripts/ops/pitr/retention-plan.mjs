import {lstatSync, readFileSync, readdirSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

function directory(path) {
  const stat = lstatSync(path)
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o700 || stat.uid !== process.getuid()) throw new Error('PITR_PRIVATE_DIRECTORY_REQUIRED')
}
function file(path) {
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid()) throw new Error('PITR_PRIVATE_FILE_REQUIRED')
}
export function retentionPlan(repository, policy, now = Math.floor(Date.now() / 1000)) {
  if (policy.format !== 1 || !Number.isSafeInteger(policy.retentionDays) || policy.retentionDays < 1 || policy.retentionDays > 3650 || policy.automaticDeletion !== false) throw new Error('PITR_RETENTION_POLICY_INVALID')
  directory(repository)
  directory(join(repository, 'base'))
  directory(join(repository, 'archive'))
  const backups = readdirSync(join(repository, 'base')).filter(name => !name.startsWith('.')).map(name => {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('PITR_BACKUP_NAME_INVALID')
    const path = join(repository, 'base', name)
    directory(path)
    file(join(path, 'pitr-backup.json'))
    file(join(path, 'backup_label'))
    const metadata = JSON.parse(readFileSync(join(path, 'pitr-backup.json'), 'utf8'))
    const label = readFileSync(join(path, 'backup_label'), 'utf8')
    const startWal = /^START WAL LOCATION: [0-9A-F]+\/[0-9A-F]+ \(file ([0-9A-F]{24})\)$/m.exec(label)?.[1]
    if (metadata.format !== 1 || metadata.verified !== true || !Number.isSafeInteger(metadata.startedEpoch) || !Number.isSafeInteger(metadata.completedEpoch) || metadata.completedEpoch < metadata.startedEpoch || metadata.completedEpoch > now || !startWal) throw new Error('PITR_BACKUP_METADATA_INVALID')
    return {name, ...metadata, startWal}
  }).sort((a, b) => a.completedEpoch - b.completedEpoch || a.name.localeCompare(b.name))
  if (!backups.length) throw new Error('PITR_VERIFIED_BASE_REQUIRED')
  const cutoff = now - policy.retentionDays * 86400
  // Keep the nearest base at/before the cutoff: dropping it could silently
  // shorten the advertised PITR window even when all newer bases are retained.
  const boundary = backups.filter(backup => backup.completedEpoch <= cutoff).at(-1)
  const retained = backups.filter(backup => backup.completedEpoch > cutoff || backup === boundary || backup === backups.at(-1))
  const oldestWal = retained.map(backup => backup.startWal).sort()[0]
  const timeline = oldestWal.slice(0, 8)
  const walRemovalCandidates = []
  for (const name of readdirSync(join(repository, 'archive'))) {
    if (name.startsWith('.incoming.')) continue
    if (!/^[a-zA-Z0-9.]{1,64}$/.test(name) || name === '.' || name === '..') throw new Error('PITR_WAL_NAME_INVALID')
    file(join(repository, 'archive', name))
    // Preserve timeline history, backup history, unknown and other-timeline WAL.
    // This deliberately errs toward retention; never infer a timeline ancestry.
    if (/^[0-9A-F]{24}$/.test(name) && name.slice(0, 8) === timeline && name < oldestWal) walRemovalCandidates.push(name)
  }
  return {
    format: 1, mode: 'plan_only', automaticDeletion: false, retentionDays: policy.retentionDays,
    requestedWindowCovered: Boolean(boundary), oldestRetainedStartWal: oldestWal,
    retainedBaseBackups: retained.map(backup => backup.name),
    baseRemovalCandidates: backups.filter(backup => !retained.includes(backup)).map(backup => backup.name),
    walRemovalCandidates: walRemovalCandidates.sort(),
    warning: 'No files deleted. Operator must verify restore, holds, timelines, off-host copies and concurrent backups before any separately authorized pruning.'
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4) throw new Error('PITR_ARGUMENTS_REQUIRED')
    const policy = JSON.parse(readFileSync(process.argv[3], 'utf8'))
    process.stdout.write(`${JSON.stringify(retentionPlan(resolve(process.argv[2]), policy), null, 2)}\n`)
  } catch {
    process.stderr.write('PITR retention plan rejected: private repository, verified metadata and no-delete policy required.\n')
    process.exitCode = 1
  }
}
