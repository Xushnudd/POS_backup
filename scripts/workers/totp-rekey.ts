// Operator CLI: credentials only from inherited environment, never CLI arguments/logs.
import {randomUUID} from 'node:crypto'
import {prisma} from '@/lib/prisma'
import {totpKeyConfiguration} from '@/server/auth/totp-keys'
import {deploymentState} from '@/server/deployment/state'
import {rotationSchema,rotateTotpEnvelope} from '@/server/auth/totp-key-rotation'
async function main(){
 const mode=process.argv[2]??'--check'
 if(!['--check','--apply'].includes(mode)||process.argv.length>3)throw new Error('INVALID_ARGUMENT')
 const connection=new URL(process.env.DATABASE_URL??'')
 if(connection.protocol!=='postgresql:'||decodeURIComponent(connection.pathname.slice(1))!==process.env.POS_TOTP_ROTATION_CONFIRM_DATABASE)throw new Error('DATABASE_CONFIRMATION_REQUIRED')
 if(mode==='--apply'){const state=await deploymentState();if(!process.env.POS_DEPLOYMENT_STATE_FILE||!state.configurationValid||!state.maintenance)throw new Error('EXPLICIT_VALID_MAINTENANCE_REQUIRED')}
 if(!totpKeyConfiguration())throw new Error('TOTP_UNAVAILABLE')
 const input=rotationSchema.parse({actorId:process.env.POS_TOTP_ROTATION_OPERATOR_ID,batchId:process.env.POS_TOTP_ROTATION_BATCH_ID??randomUUID(),reason:process.env.POS_TOTP_ROTATION_REASON})
 if(!await prisma.platformOperator.findFirst({where:{userId:input.actorId,role:'platform_admin',isActive:true,user:{isActive:true}}}))throw new Error('PLATFORM_ADMIN_REQUIRED')
 const counts={scanned:0,current:0,pending:0,rotated:0,absent:0,failed:0}
 let cursor:string|undefined
 for(;;){
  const rows=await prisma.totpFactor.findMany({where:{revokedAt:null,sealedSecret:{not:null},...(cursor?{id:{gt:cursor}}:{})},orderBy:{id:'asc'},take:100,select:{id:true}})
  if(!rows.length)break
  for(const row of rows){
   counts.scanned++
   try{const result=await rotateTotpEnvelope(input,row.id,mode==='--apply');counts[result.state]++}
   catch{counts.failed++;process.exitCode=1}
  }
  cursor=rows[rows.length-1].id
 }
 console.log(JSON.stringify({mode,...counts,retiredKeysMayBeRemoved:mode==='--check'&&counts.failed===0&&counts.pending===0}))
 // Apply finishes with a mandatory independent full check before any key retirement.
 if(mode==='--apply')console.log('Run --check against every environment/replica before removing previous keys; no configuration changed.')
}
void main().catch(()=>{console.error('TOTP key rotation failed; no credential material logged.');process.exitCode=1}).finally(()=>prisma.$disconnect())
