import {createHash} from 'node:crypto'
import {PrismaClient} from '@prisma/client'
import {constants,openSync,writeFileSync,fsyncSync,closeSync,lstatSync,realpathSync,unlinkSync} from 'node:fs'
import {dirname,isAbsolute} from 'node:path'
import {z} from 'zod'
import {planTenantRecovery} from '@/server/jobs/tenant-recovery'
import {MAX_EXPORT_BYTES} from '@/server/jobs/catalog-export'
function connection(name:'SOURCE'|'TARGET'){
 const raw=process.env[`TENANT_RECOVERY_${name}_URL`]??''
 let parsed:URL
 try{parsed=new URL(raw)}catch{throw new Error('RECOVERY_CONNECTION_INVALID')}
 if(!['postgres:','postgresql:'].includes(parsed.protocol)||!parsed.hostname||!parsed.username||!parsed.pathname.slice(1)||decodeURIComponent(parsed.pathname.slice(1))!==process.env[`TENANT_RECOVERY_${name}_CONFIRM_DATABASE`])throw new Error('RECOVERY_DATABASE_CONFIRMATION_REQUIRED')
 return {raw,identity:parsed.hostname.toLowerCase()+':'+(parsed.port||'5432')+'/'+decodeURIComponent(parsed.pathname.slice(1))}
}
async function main(){
 if(process.argv.length!==2)throw new Error('RECOVERY_PLAN_ONLY')
 const source=connection('SOURCE'),target=connection('TARGET')
 if(source.identity===target.identity)throw new Error('RECOVERY_DISTINCT_DATABASES_REQUIRED')
 const input=z.object({organizationId:z.string().uuid(),reviewer:z.string().trim().min(3).max(200).regex(/^[^\r\n\0]+$/),caseReference:z.string().trim().min(10).max(500).regex(/^[^\r\n\0]+$/)}).parse({organizationId:process.env.TENANT_RECOVERY_ORGANIZATION_ID,reviewer:process.env.TENANT_RECOVERY_REVIEWER,caseReference:process.env.TENANT_RECOVERY_CASE_REFERENCE})
 const output=process.env.TENANT_RECOVERY_PLAN_FILE??''
 if(!isAbsolute(output))throw new Error('RECOVERY_PRIVATE_OUTPUT_REQUIRED')
 const parent=dirname(output),stat=lstatSync(parent),owner=process.getuid?.()
 if(!stat.isDirectory()||stat.isSymbolicLink()||owner===undefined||stat.uid!==owner||(stat.mode&0o077)!==0||realpathSync(parent)!==parent)throw new Error('RECOVERY_PRIVATE_OUTPUT_REQUIRED')
 const recovered=new PrismaClient({datasources:{db:{url:source.raw}}}),current=new PrismaClient({datasources:{db:{url:target.raw}}})
 let created=false,fd:number|undefined
 try{
  const plan=await planTenantRecovery(input.organizationId,recovered,current,{reviewer:input.reviewer,caseReference:input.caseReference})
  const encoded=JSON.stringify(plan,null,2)+'\n'
  if(Buffer.byteLength(encoded)>MAX_EXPORT_BYTES)throw new Error('RECOVERY_PLAN_TOO_LARGE')
  fd=openSync(output,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);created=true
  writeFileSync(fd,encoded);fsyncSync(fd);closeSync(fd);fd=undefined
  const parentDescriptor=openSync(parent,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW)
  try{fsyncSync(parentDescriptor)}finally{closeSync(parentDescriptor)}
  console.log(JSON.stringify({status:'planned',applyEnabled:false,planSHA256:createHash('sha256').update(encoded).digest('hex'),models:plan.differences.length,differingModels:plan.differences.filter(row=>row.missing.length||row.changed.length||row.currentOnly.length).length}))
 }catch(error){if(fd!==undefined)closeSync(fd);if(created)unlinkSync(output);throw error}
 finally{await Promise.allSettled([recovered.$disconnect(),current.$disconnect()])}
}
void main().catch(error=>{const code=error instanceof Error&&/^RECOVERY_[A-Z_]+$/.test(error.message)?error.message:'RECOVERY_PLAN_FAILED';console.error(JSON.stringify({status:'rejected',code}));process.exitCode=1})
