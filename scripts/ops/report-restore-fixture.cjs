'use strict'
const {randomUUID}=require('node:crypto'),assert=require('node:assert/strict')
const url=new URL(process.env.DATABASE_URL??'')
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.username!=='pos_test'||!/^\/pos_valuation_\d+_\d+_(clone|restore)$/.test(url.pathname))throw Error('Throwaway local report database required')
const {prisma}=require('@/lib/prisma'),{latestReportOccurrence}=require('@/server/reports/schedule-contract'),{enqueueDueReports,claimReportRun,executeReportRun}=require('@/server/reports/schedule-worker'),{scheduledArtifact}=require('@/server/reports/schedule-artifact')
async function main(){
 if(process.argv.includes('--verify')){
  const org=await prisma.organization.findFirstOrThrow({where:{name:'Synthetic report restore source'}}),member=await prisma.organizationUser.findFirstOrThrow({where:{organizationId:org.id,role:'owner'}}),session=await prisma.session.findFirstOrThrow({where:{organizationId:org.id,userId:member.userId}}),schedule=await prisma.reportSchedule.findFirstOrThrow({where:{organizationId:org.id}}),run=await prisma.reportScheduleRun.findFirstOrThrow({where:{scheduleId:schedule.id}})
  const ctx={organizationId:org.id,userId:member.userId,organizationUserId:member.id,sessionId:session.id,role:'owner',storeIds:[]}
  assert.equal(run.state,'succeeded');assert.equal(run.attempts,1);assert.equal(run.result.branches[0].metrics.saleCount,'0');assert.equal(run.result.branches[0].metrics.averageSale,null)
  assert.equal(JSON.parse((await scheduledArtifact(ctx,run.id,'json')).data.toString()).organizationId,org.id)
  await enqueueDueReports();assert.equal(await prisma.reportScheduleRun.count({where:{scheduleId:schedule.id}}),1)
  await assert.rejects(prisma.reportScheduleRun.update({where:{id:run.id},data:{result:{fabricated:true}}}))
  process.stdout.write('PASS: restored report definition, original result and duplicate/native guards unchanged\n');return
 }
 const org=await prisma.organization.create({data:{name:'Synthetic report restore source',phone:randomUUID()}}),user=await prisma.user.create({data:{fullName:'Report restore owner',phone:randomUUID(),passwordHash:'not-a-login'}}),member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 await prisma.store.create({data:{organizationId:org.id,name:'Report restore branch'}})
 await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:randomUUID(),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 const configuration={cadence:{frequency:'daily',hour:0,minute:0},retentionHours:24,missedRunPolicy:'latest_only',report:{storeIds:[],rangeDays:1,period:'complete_days',window:'rolling_days',metrics:['saleCount','averageSale']}}
 // Synthetic restored overdue occurrence, not a production clock override.
 const schedule=await prisma.$transaction(async tx=>{
  const values={name:'Report restore policy',enabled:true,revision:1,configuration,grantMembershipId:member.id,timezone:'Asia/Tashkent',currency:'UZS'}
  const row=await tx.reportSchedule.create({data:{organizationId:org.id,...values,nextRunAt:latestReportOccurrence(new Date(),'Asia/Tashkent',configuration.cadence)}})
  await tx.auditLog.create({data:{organizationId:org.id,actorId:user.id,entityType:'ReportSchedule',entityId:row.id,action:'report_schedule_configured',afterData:values}});return row
 })
 await enqueueDueReports();const run=await claimReportRun();assert.equal(run.scheduleId,schedule.id);assert.equal((await executeReportRun(run)).succeeded,true)
 process.stdout.write('PASS: actual scheduled report and private KPI artifact created in isolated clone\n')
}
main().catch(error=>{process.stderr.write('Report restore fixture failed: '+(error.code??error.name??'ERROR')+'\n');process.exitCode=1}).finally(()=>prisma.$disconnect())
