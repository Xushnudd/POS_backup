import {verifySession} from '@/server/auth/session'
import {prisma} from '@/lib/prisma'
import {tenantExportToFile} from '@/server/jobs/tenant-export-file'

async function main(){
 if(process.argv.length!==2)throw Error('EXPORT_ENV_ONLY')
 const token=process.env.TENANT_EXPORT_OWNER_SESSION??''
 const ctx=await verifySession(token,{touch:false})
 if(!ctx)throw Error('EXPORT_OWNER_SESSION_REQUIRED')
 const metadata=await tenantExportToFile(ctx,process.env.TENANT_EXPORT_FILE??'',process.env.TENANT_EXPORT_REASON??'')
 console.log(JSON.stringify({status:'prepared',size:metadata.size,sha256:metadata.sha256,rowCount:metadata.rowCount,deliveryConfirmed:false}))
}
void main().catch(()=>{console.error('Owner export failed; no credentials or private file contents logged');process.exitCode=1}).finally(()=>prisma.$disconnect())
