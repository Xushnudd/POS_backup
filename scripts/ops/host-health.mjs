import { statfs } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
export async function hostHealth(directory, { minimumFreeBytes = 1073741824n, minimumFreePercent = 5n, filesystem = statfs } = {}) {
  if (typeof directory !== 'string' || !directory.startsWith('/') || minimumFreeBytes < 0n || minimumFreePercent < 0n || minimumFreePercent > 100n) throw new Error('INVALID_HOST_PROBE_CONFIG')
  try {
    const stats = await filesystem(directory, { bigint: true })
    if (stats.blocks <= 0n || stats.bsize <= 0n || stats.bavail < 0n || stats.bavail > stats.blocks) throw new Error('INVALID_FILESYSTEM_STATS')
    const total = stats.blocks * stats.bsize, available = stats.bavail * stats.bsize
    const low = available < minimumFreeBytes || available * 100n < total * minimumFreePercent
    return { healthy: !low, code: low ? 'HOST_DISK_LOW' : 'HOST_DISK_READY', totalBytes: total.toString(), availableBytes: available.toString() }
  } catch { return { healthy: false, code: 'HOST_DISK_UNAVAILABLE' } }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const bytes=process.env.POS_DISK_MIN_FREE_BYTES ?? '1073741824',percent=process.env.POS_DISK_MIN_FREE_PERCENT ?? '5'
    if(!/^\d{1,20}$/.test(bytes)||!/^\d{1,3}$/.test(percent))throw new Error('INVALID_HOST_PROBE_CONFIG')
    const result=await hostHealth(process.env.POS_DATA_DIRECTORY,{minimumFreeBytes:BigInt(bytes),minimumFreePercent:BigInt(percent)})
    console.log(JSON.stringify({event:'host_health_probe',...result}))
    if(!result.healthy)process.exitCode=1
  }catch{console.error(JSON.stringify({event:'host_health_probe',code:'INVALID_HOST_PROBE_CONFIG'}));process.exitCode=2}
}
