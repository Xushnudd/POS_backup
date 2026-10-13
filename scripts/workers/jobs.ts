import {createBatchExpiryAlerts} from '../../src/server/inventory/batches'
import {processAuthenticationDeliveries} from '../../src/server/auth/challenges'
import {deploymentState} from '../../src/server/deployment/state'
import {processProviderOutbox} from '../../src/server/integrations/outbox'
import {deliverSecurityNotices,pruneSecurityHistory} from '../../src/server/security/service'
import {pruneJobExports} from '../../src/server/jobs/catalog-export'
import {prisma} from '../../src/lib/prisma'
import {claimJob,executeJob,recoverJobs} from '../../src/server/jobs/service'
import {validateProductionEnvironment} from '../../src/server/config'
import {logEvent} from '../../src/server/observability/context'
import {enqueueDueReports,recoverReportRuns,pruneReportSnapshots,claimReportRun,executeReportRun} from '../../src/server/reports/schedule-worker'
let lastBatchScan=0;let stopping=false;process.on('SIGTERM',()=>{stopping=true});process.on('SIGINT',()=>{stopping=true})
async function main(){
 validateProductionEnvironment(process.env);const once=process.argv.includes('--once');let processed=0;
 while(!stopping){
  if((await deploymentState()).maintenance){if(once)break;await new Promise(resolve=>setTimeout(resolve,1000));continue}
  if(Date.now()-lastBatchScan>=300000){await createBatchExpiryAlerts();lastBatchScan=Date.now()}
  const provider=await processProviderOutbox();if(provider.processed)logEvent('provider_outbox_processed',{code:'PROVIDER_CORE_PROCESSED'});if(stopping)break;
  const authentication=await processAuthenticationDeliveries();if(authentication.processed)logEvent('authentication_delivery_processed',{count:authentication.delivered,code:authentication.failed?'DELIVERY_FAILED':'DELIVERED'});if(stopping)break;
  const notices=await deliverSecurityNotices(100,()=>stopping);if(notices.processed)logEvent('security_outbox_processed',{count:notices.delivered,code:notices.failed?'DELIVERY_FAILED':'DELIVERED'});if(once&&notices.failed)process.exitCode=1;if(stopping)break;
  await pruneSecurityHistory();await pruneJobExports();await pruneReportSnapshots();if(stopping)break;
  await recoverJobs();await recoverReportRuns();await enqueueDueReports();if(stopping)break;
  // One task from each queue per cycle prevents a busy report queue from
  // starving catalog/export work (and vice versa). Finish an active lease
  // before disconnecting on SIGTERM; no new claim is made after stopping.
  const job=await claimJob();
  if(job){const result=await executeJob(job);logEvent(result.succeeded?'job_completed':'job_failed',{organizationId:job.organizationId,operationId:job.id,code:result.succeeded?'JOB_SUCCEEDED':'JOB_FAILED'});if(once&&!result.succeeded)process.exitCode=1;if(once&&++processed>=100)break}
  if(stopping)break;
  const report=await claimReportRun();
  if(report){const result=await executeReportRun(report);logEvent(result.succeeded?'report_completed':'report_failed',{organizationId:report.organizationId,operationId:report.id,code:result.succeeded?'REPORT_SUCCEEDED':'REPORT_FAILED'});if(once&&!result.succeeded)process.exitCode=1;if(once&&++processed>=100)break}
  if(!job&&!report){if(once){if(notices.processed>=100&&++processed<100)continue;break}await new Promise(resolve=>setTimeout(resolve,1000))}
 }
}
main().catch(()=>{logEvent('job_worker_failed',{code:'WORKER_FAILED'});process.exitCode=1}).finally(()=>prisma.$disconnect())
