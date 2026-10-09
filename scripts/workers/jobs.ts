import {deploymentState} from '../../src/server/deployment/state'
import {deliverSecurityNotices,pruneSecurityHistory} from '../../src/server/security/service'
import {pruneJobExports} from '../../src/server/jobs/catalog-export'
import {prisma} from '../../src/lib/prisma'
import {claimJob,executeJob,recoverJobs} from '../../src/server/jobs/service'
import {validateProductionEnvironment} from '../../src/server/config'
import {logEvent} from '../../src/server/observability/context'
let stopping=false;process.on('SIGTERM',()=>{stopping=true});process.on('SIGINT',()=>{stopping=true})
async function main(){validateProductionEnvironment(process.env);const once=process.argv.includes('--once');let processed=0;while(!stopping){if((await deploymentState()).maintenance){if(once)break;await new Promise(resolve=>setTimeout(resolve,1000));continue}const notices=await deliverSecurityNotices(100,()=>stopping);if(notices.processed)logEvent('security_outbox_processed',{count:notices.delivered,code:notices.failed?'DELIVERY_FAILED':'DELIVERED'});if(once&&notices.failed)process.exitCode=1;if(stopping)break;await pruneSecurityHistory();await pruneJobExports();if(stopping)break;await recoverJobs();if(stopping)break;const job=await claimJob();if(job){const result=await executeJob(job);logEvent(result.succeeded?'job_completed':'job_failed',{organizationId:job.organizationId,operationId:job.id,code:result.succeeded?'JOB_SUCCEEDED':'JOB_FAILED'});if(once&&!result.succeeded)process.exitCode=1;if(once&&++processed>=100)break}else{if(once){if(notices.processed>=100&&++processed<100)continue;break}await new Promise(resolve=>setTimeout(resolve,1000))}}}
main().catch(()=>{logEvent('job_worker_failed',{code:'WORKER_FAILED'});process.exitCode=1}).finally(()=>prisma.$disconnect())
