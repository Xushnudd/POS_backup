import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hostHealth } from './host-health.mjs'
test('Host disk probe alerts on exact byte/percent thresholds and hides paths or filesystem errors', async () => {
 const filesystem=async()=>({blocks:1000n,bsize:4096n,bavail:50n})
 assert.equal((await hostHealth('/fake-test',{filesystem,minimumFreeBytes:0n})).code,'HOST_DISK_READY')
 assert.equal((await hostHealth('/fake-test',{filesystem,minimumFreeBytes:204801n})).code,'HOST_DISK_LOW')
 assert.equal((await hostHealth('/fake-test',{filesystem,minimumFreeBytes:0n,minimumFreePercent:6n})).code,'HOST_DISK_LOW')
 const failed=await hostHealth('/private-path',{filesystem:async()=>{throw new Error('secret-data')},minimumFreeBytes:0n})
 assert.deepEqual(failed,{healthy:false,code:'HOST_DISK_UNAVAILABLE'})
 await assert.rejects(hostHealth('relative-path'))
 assert.equal((await hostHealth('/fake-test',{filesystem:async()=>({blocks:0n,bsize:0n,bavail:0n})})).healthy,false)
})
