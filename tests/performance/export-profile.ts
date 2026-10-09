import {Prisma,PrismaClient} from '@prisma/client'
import {randomBytes,randomUUID} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import {writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {prisma} from '@/lib/prisma'
import {catalogExport,readJobExport} from '@/server/jobs/catalog-export'
import {enqueueJob,claimJob,executeJob} from '@/server/jobs/service'
import {sessionHash,verifySession} from '@/server/auth/session'
const connection=new URL(process.env.DATABASE_URL??'');if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test'||connection.username!=='pos_test')throw Error('Isolated test database required')
const observed=new PrismaClient({log:[{level:'query',emit:'event'}]});let queries=0;observed.$on('query',()=>{queries++})
async function main(){
 const organizationId=process.env.POS_PROFILE_TEST_ORG;if(!organizationId||!/^[0-9a-f-]{36}$/.test(organizationId))throw Error('Explicit synthetic profile ID required');const org=await prisma.organization.findUniqueOrThrow({where:{id:organizationId}});if(!/^Synthetic volume [0-9a-f-]{36}$/.test(org.name))throw Error('Synthetic profile only');assert.equal(await prisma.product.count({where:{organizationId}}),50000)
 const member=await prisma.organizationUser.findFirstOrThrow({where:{organizationId,role:'owner'},include:{user:true}});if(member.user.passwordHash!=='not-a-login'||member.user.phone!==org.name.slice('Synthetic volume '.length))throw Error('Synthetic owner only')
 const product=await prisma.product.findFirstOrThrow({where:{organizationId}});const plans:unknown[]=[]
 for(const sequential of [true,false])plans.push(await prisma.$transaction(async tx=>{if(sequential){await tx.$executeRaw`SET LOCAL enable_indexscan=off`;await tx.$executeRaw`SET LOCAL enable_bitmapscan=off`}return tx.$queryRaw(Prisma.sql`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT * FROM "InventoryBalance" WHERE "productId"=${product.id}`)}))
 const start=performance.now(),memoryBefore=process.memoryUsage(),heapBefore=memoryBefore.heapUsed;queries=0;const file=await catalogExport(organizationId,{active:'all'},observed),queryCount=queries;assert.equal(file.rowCount,50000);assert.ok(queryCount<=350);assert.ok(file.size<=16*1024*1024)
 const token=randomBytes(32).toString('base64url');const session=await prisma.session.create({data:{organizationId,userId:member.userId,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 try{const ctx=(await verifySession(token))!,job=await enqueueJob(ctx,{operationId:randomUUID(),type:'catalog_export',reason:'Isolated volume export acceptance'}),claimed=await claimJob();assert.equal(claimed?.id,job.id);assert.equal((await executeJob(claimed!)).succeeded,true);const artifact=await readJobExport(ctx,job.id);assert.equal(artifact.rowCount,50000);assert.equal(artifact.sha256,file.sha256);const report={at:new Date().toISOString(),node:process.version,kind:'isolated synthetic 50000 product export; no production data',rowCount:file.rowCount,bytes:file.size,queryCount,cursorPageSize:500,elapsedMs:performance.now()-start,heapBefore,heapAfter:process.memoryUsage().heapUsed,memoryBefore,memoryAfter:process.memoryUsage(),workerArtifact:{jobId:job.id,sha256:artifact.sha256,rowCount:artifact.rowCount},inventoryPlans:{sequentialComparison:plans[0],normalIndexedPlan:plans[1]},limits:'Controlled planner comparison, not a historical before schema; owner CSV only, no PDF/XLSX/vendor SLA'};await writeFile('/tmp/pos-export-profile.json',JSON.stringify(report,null,2));console.info(JSON.stringify({rows:report.rowCount,bytes:report.bytes,queryCount,elapsedMs:report.elapsedMs}))}
 finally{await prisma.session.update({where:{id:session.id},data:{revokedAt:new Date()}})}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Export profile failed');process.exitCode=1}).finally(async()=>{await observed.$disconnect();await prisma.$disconnect()})
