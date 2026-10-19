import {execFile,spawn} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,rm} from 'node:fs/promises'
import {createWriteStream,readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {pipeline} from 'node:stream/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {findings} from '../security/scan.mjs'

const execute=promisify(execFile)
const publicVectors=JSON.parse(readFileSync(new URL('./public-crypto-test-vectors.json',import.meta.url),'utf8'))
const immutable=/^(?:sha256:[a-f0-9]{64}|[A-Za-z0-9][A-Za-z0-9._:/-]*@sha256:[a-f0-9]{64})$/
const secretName=/(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|ACCESS_KEY|DATABASE_URL)/i
export function imageConfigurationProblems(config) {
  const problems=[]
  const user=String(config.User||'').split(':')[0]
  if(!user||user==='root'||/^0+$/.test(user))problems.push('root_or_unspecified_user')
  for(const entry of config.Env||[]){const index=entry.indexOf('=');if(secretName.test(entry.slice(0,index))&&entry.slice(index+1))problems.push('baked_runtime_secret')}
  return [...new Set(problems)]
}
export function forbiddenImagePath(value) {
  const path=value.replace(/^\.\//,'').replace(/^\//,'')
  return /^app\/(?:\.local|\.aws|\.codex|\.agents)(?:\/|$)/.test(path)||/^app\/(?:.*\/)?\.env(?:$|[._])/.test(path)
}
function scanStream(stream) {
  const kinds=new Set(),privateKeys={},seenOffsets=new Set();let carry='',bytes=0,privateKeyHeaderMarkers=false
  stream.on('data',chunk=>{
    const text=carry+chunk.toString('latin1')
    for(const finding of findings(text)){
      if(finding.kind==='private_key')privateKeyHeaderMarkers=true
      else kinds.add(finding.kind)
    }
    // Crypto parsers contain literal BEGIN labels. A complete PEM block is key
    // material; the label alone is reported separately rather than called a key.
    for(const match of text.matchAll(/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----\s+[A-Za-z0-9+/=\r\n]{32,}-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g)){
      const offset=bytes-carry.length+match.index
      if(seenOffsets.has(offset))continue
      seenOffsets.add(offset)
      const hash=createHash('sha256').update(match[0].replaceAll('\r\n','\n')).digest('hex')
      privateKeys[hash]=(privateKeys[hash]||0)+1
    }
    bytes+=chunk.length
    carry=text.slice(-16384)
  })
  return ()=>({bytes,tokenMarkerKinds:[...kinds].sort(),privateKeyHeaderMarkers,privateKeys})
}
export function classifyPrivateKeys(actual,reviewed) {
  let unknown=0,publicTestVectors=0
  for(const [hash,count] of Object.entries(actual)){
    const allowed=Math.min(count,reviewed[hash]||0)
    publicTestVectors+=allowed;unknown+=count-allowed
  }
  return {unknown,publicTestVectors}
}
function success(child) {
  return new Promise((resolve,reject)=>{
    child.once('error',()=>reject(new Error('RELEASE_IMAGE_LAYER_READ_FAILED')))
    child.once('close',code=>code===0?resolve():reject(new Error('RELEASE_IMAGE_LAYER_READ_FAILED')))
  })
}
async function layerInventory(archive,layer,directory) {
  // A private seekable layer lets GNU tar recognize OCI gzip and legacy plain tar.
  // Only this archive file is written; layer paths are never extracted to disk.
  const file=join(directory,'layer.tar')
  const extract=spawn('tar',['-xOf',archive,layer],{stdio:['ignore','pipe','ignore']})
  await Promise.all([success(extract),pipeline(extract.stdout,createWriteStream(file,{mode:0o600}))])
  const paths=(await execute('tar',['-tf',file],{maxBuffer:16*1024*1024})).stdout.split('\n').filter(Boolean)
  const content=spawn('tar',['-xOf',file],{stdio:['ignore','pipe','ignore']})
  const finishScan=scanStream(content.stdout)
  await success(content)
  const reviewed={}
  if(paths.includes(publicVectors.path)){
    const binary=(await execute('tar',['-xOf',file,publicVectors.path],{encoding:'buffer',maxBuffer:8*1024*1024})).stdout
    if(createHash('sha256').update(binary).digest('hex')===publicVectors.binarySha256)for(const hash of Object.keys(publicVectors.fingerprints))reviewed[hash]=1
  }
  const {privateKeys,...scanned}=finishScan(),classification=classifyPrivateKeys(privateKeys,reviewed)
  if(classification.unknown)scanned.tokenMarkerKinds.push('private_key')
  await rm(file)
  return {...scanned,reviewedPublicTestVectors:classification.publicTestVectors,entries:paths.length,forbiddenCredentialPaths:paths.filter(forbiddenImagePath).length}
}
export async function auditReleaseImage(reference) {
  if(typeof reference!=='string'||reference!==reference.trim()||!immutable.test(reference))throw new Error('RELEASE_IMAGE_IMMUTABLE_REFERENCE_REQUIRED')
  const inspect=JSON.parse((await execute('docker',['image','inspect',reference],{maxBuffer:16*1024*1024})).stdout)[0]
  if(!inspect?.Id||!/^sha256:[a-f0-9]{64}$/.test(inspect.Id))throw new Error('RELEASE_IMAGE_INSPECT_FAILED')
  const problems=imageConfigurationProblems(inspect.Config||{})
  const history=(await execute('docker',['history','--no-trunc','--format','{{json .}}',reference],{maxBuffer:16*1024*1024})).stdout
  const historyKinds=[...new Set(findings(history).map(row=>row.kind))].sort()
  const directory=await mkdtemp(join(tmpdir(),'pos-image-audit-')),archive=join(directory,'image.tar')
  const previousMask=process.umask(0o077)
  try{
    await execute('docker',['image','save','--output',archive,reference],{maxBuffer:1024*1024})
    const manifest=JSON.parse((await execute('tar',['-xOf',archive,'manifest.json'],{maxBuffer:16*1024*1024})).stdout)
    if(manifest.length!==1||!Array.isArray(manifest[0].Layers)||!manifest[0].Layers.length)throw new Error('RELEASE_IMAGE_MANIFEST_INVALID')
    const layers=[]
    for(const layer of manifest[0].Layers){
      if(typeof layer!=='string'||!/^\w[\w./-]+$/.test(layer)||layer.split('/').includes('..'))throw new Error('RELEASE_IMAGE_LAYER_INVALID')
      layers.push(await layerInventory(archive,layer,directory))
    }
    const forbiddenCredentialPaths=layers.reduce((sum,row)=>sum+row.forbiddenCredentialPaths,0)
    const tokenMarkerKinds=[...new Set(layers.flatMap(row=>row.tokenMarkerKinds))].sort()
    return {status:problems.length||historyKinds.length||forbiddenCredentialPaths||tokenMarkerKinds.length?'rejected':'passed',imageId:inspect.Id,repoDigests:inspect.RepoDigests||[],declaredUser:inspect.Config.User,os:inspect.Os,architecture:inspect.Architecture,configurationProblems:problems,historyTokenMarkerKinds:historyKinds,layersScanned:layers.length,layerEntries:layers.reduce((sum,row)=>sum+row.entries,0),layerBytes:layers.reduce((sum,row)=>sum+row.bytes,0),forbiddenCredentialPaths,tokenMarkerKinds,layersWithHeaderLabels:layers.filter(row=>row.privateKeyHeaderMarkers).length,reviewedPublicTestVectors:layers.reduce((sum,row)=>sum+row.reviewedPublicTestVectors,0),publicVectorReview:publicVectors.source,scope:'All saved layers including deleted files: app credential-store paths, complete PEM private-key blocks, configured token markers; image configuration and history. Public GnuTLS self-test vectors require exact binary path/hash and occurrence limits; unknown/additional keys reject. Header labels used by crypto parsers are reported separately. Does not prove absence of arbitrary unknown secrets; runtime secret-store ACL and real deployment remain operator acceptance.'}
  }finally{process.umask(previousMask);await rm(directory,{recursive:true,force:true})}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{if(process.argv.length!==3)throw new Error('RELEASE_IMAGE_REFERENCE_REQUIRED');const result=await auditReleaseImage(process.argv[2]);console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='passed'?0:1}
  catch(error){const code=error instanceof Error&&/^RELEASE_[A-Z_]+$/.test(error.message)?error.message:'RELEASE_IMAGE_AUDIT_FAILED';console.error(JSON.stringify({status:'rejected',code}));process.exitCode=1}
}
