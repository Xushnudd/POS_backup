import {expireReservations} from '../../src/server/inventory/reservations'
import {prisma} from '../../src/lib/prisma'
import {scanOrganization} from '../../src/server/monitoring/service'
import {logEvent} from '../../src/server/observability/context'
import {validateProductionEnvironment} from '../../src/server/config'
let stopping=false
process.on('SIGTERM',()=>{stopping=true});process.on('SIGINT',()=>{stopping=true})
async function batch(){
 let cursor:string|undefined,failed=0,total=0
 for(;;){
  const organizations=await prisma.organization.findMany({orderBy:{id:'asc'},take:25,...(cursor?{cursor:{id:cursor},skip:1}:{}),select:{id:true}})
  if(!organizations.length||stopping)break
  for(const org of organizations){
   if(stopping)break
   try{
    await expireReservations(org.id)
    const counts=await prisma.$transaction(async tx=>{
     const lock=await tx.$queryRaw<{locked:boolean}[]>`SELECT pg_try_advisory_xact_lock(hashtextextended(${'monitor:'+org.id},0)) AS locked`
     if(!lock[0].locked)return
     const counts=await scanOrganization(tx,org.id)
     await tx.auditLog.create({data:{organizationId:org.id,actorId:null,entityType:'Organization',entityId:org.id,action:'system_reconciliation_scanned',afterData:counts}})
     return counts
    },{isolationLevel:'RepeatableRead',timeout:30000})
    if(counts){total++;logEvent('reconcile_complete',{organizationId:org.id,count:Object.values(counts).reduce((a,b)=>a+b,0)})}
   }catch{failed++;logEvent('reconcile_failed',{organizationId:org.id,code:'RECONCILE_FAILED'})}
   cursor=org.id
  }
 }
 return {total,failed}
}
async function main(){
 validateProductionEnvironment(process.env)
 const once=process.argv.includes('--once'),interval=Number(process.env.RECONCILE_INTERVAL_MS??300000)
 if(!Number.isSafeInteger(interval)||interval<60000)throw new Error('RECONCILE_INTERVAL_MS must be at least60000')
 do{
  const result=await batch();if(once){if(result.failed)process.exitCode=1;break;}
  for(let elapsed=0;elapsed<interval&&!stopping;elapsed+=1000)await new Promise(resolve=>setTimeout(resolve,1000))
 }while(!stopping)
}
main().catch(()=>{logEvent('reconcile_worker_failed',{code:'WORKER_FAILED'});process.exitCode=1}).finally(()=>prisma.$disconnect())
