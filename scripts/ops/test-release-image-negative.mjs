import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {auditReleaseImage} from './check-release-image.mjs'

const execute=promisify(execFile),base=process.argv[2]
let directory,tag
try{
  if(process.argv.length!==3||typeof base!=='string'||base!==base.trim()||!/^[A-Za-z0-9][A-Za-z0-9._:/-]*@sha256:[a-f0-9]{64}$/.test(base))throw new Error('NEGATIVE_IMAGE_IMMUTABLE_BASE_REQUIRED')
  // Explicit, already available base; no credentials, host ports or databases.
  await execute('docker',['image','inspect',base],{maxBuffer:1024*1024})
  directory=await mkdtemp(join(tmpdir(),'pos-layer-canary-'));tag=`pos-release-canary:${randomUUID()}`
  await writeFile(join(directory,'Dockerfile'),'ARG BASE\nFROM $BASE\nCOPY canary /app/.env_audit_canary\nRUN rm /app/.env_audit_canary\nUSER 1001:1001\n',{mode:0o600})
  await writeFile(join(directory,'canary'),['-----BEGIN ','PRIVATE KEY-----\n','A'.repeat(64),'\n-----END ','PRIVATE KEY-----\n'].join(''),{mode:0o600})
  await execute('docker',['build','--pull=false','--network=none','--build-arg',`BASE=${base}`,'-t',tag,directory],{maxBuffer:4*1024*1024})
  const id=(await execute('docker',['image','inspect',tag,'--format','{{.Id}}'])).stdout.trim()
  const result=await auditReleaseImage(id)
  if(result.status!=='rejected'||result.forbiddenCredentialPaths<1||!result.tokenMarkerKinds.includes('private_key'))throw new Error('NEGATIVE_DELETED_LAYER_NOT_REJECTED')
  console.log(JSON.stringify({status:'passed',baseImage:base,deletedCredentialLayerRejected:true,actualCredentialUsed:false,audit:result},null,2))
}catch(error){
  const code=error instanceof Error&&/^NEGATIVE_[A-Z_]+$/.test(error.message)?error.message:'NEGATIVE_IMAGE_CHECK_FAILED'
  console.error(JSON.stringify({status:'rejected',code}));process.exitCode=1
}finally{
  if(tag)try{await execute('docker',['image','rm',tag])}catch{/* A failed build may not have created an image. */}
  if(directory)await rm(directory,{recursive:true,force:true})
}
