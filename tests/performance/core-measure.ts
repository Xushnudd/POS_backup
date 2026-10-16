import {writeFile} from 'node:fs/promises'
import {performance} from 'node:perf_hooks'
import {cpus,totalmem,platform,release} from 'node:os'
import {randomBytes,randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import {sessionHash,verifySession} from '@/server/auth/session'
import {createDraft,completeSale} from '@/server/sales/service'
import {GET as products} from '@/app/api/products/route'
import {attemptCounts,originalKeyAttempt} from './retry'
const connection=new URL(process.env.DATABASE_URL??'');if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test'||connection.username!=='pos_test')throw new Error('Isolated profile DB required')
async function main(){
 const id=process.env.POS_PROFILE_TEST_ORG;if(!id||!/^[0-9a-f-]{36}$/.test(id))throw new Error('Explicit isolated synthetic profile ID required');
 const org=await prisma.organization.findUniqueOrThrow({where:{id}});if(!/^Synthetic volume [0-9a-f-]{36}$/.test(org.name))throw new Error('Synthetic fixture only');
 const owner=await prisma.organizationUser.findFirstOrThrow({where:{organizationId:id,role:'owner'},include:{user:true}});if(owner.user.phone!==org.name.slice('Synthetic volume '.length)||owner.user.passwordHash!=='not-a-login')throw new Error('Synthetic owner required');
 const store=await prisma.store.findFirstOrThrow({where:{organizationId:id}}),registers=await prisma.register.findMany({where:{storeId:store.id,isActive:true},include:{shifts:{where:{status:'open'},take:1}},orderBy:{code:'asc'}});
 const dataset={products:await prisma.product.count({where:{organizationId:id}}),syntheticDraftItems:await prisma.saleItem.count({where:{sale:{organizationId:id,status:'draft',receiptNo:{startsWith:'SYN-'}}}}),activeRegisters:registers.length};assert.equal(dataset.products,50000);assert.equal(dataset.syntheticDraftItems,1000000);assert.equal(dataset.activeRegisters,20);
 const postgres=await prisma.$queryRaw<{version:string}[]>`SELECT version()`;
 const databaseMigrations=await prisma.$queryRaw<{migrationName:string;checksum:string}[]>`SELECT migration_name AS "migrationName",checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
 await prisma.$executeRaw`ANALYZE "Product"`;await prisma.$executeRaw`ANALYZE "SaleItem"`;await prisma.$executeRaw`ANALYZE "Sale"`;
 const before=await prisma.sale.count({where:{organizationId:id,status:'completed'}}),beforePayments=await prisma.payment.count({where:{organizationId:id}});const searchMs:number[]=[],checkoutMs:number[]=[],errors:string[]=[];
 let searchAttempted=0,searchFailed=0,draftAttempted=0,draftSucceeded=0,checkoutAttempted=0,checkoutFailed=0;const searchStatus:Record<string,number>={};
 const physical={draft:attemptCounts(),checkout:attemptCounts()}
 const sessions=[] as {token:string;ctx:NonNullable<Awaited<ReturnType<typeof verifySession>>>}[];
 for(const register of registers){void register;const token=randomBytes(32).toString('base64url');await prisma.session.create({data:{userId:owner.userId,organizationId:id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});sessions.push({token,ctx:(await verifySession(token))!})}
 const result=await Promise.allSettled(registers.map(async(register,till)=>{const {token,ctx}=sessions[till];
  for(let round=0;round<5;round++){
   searchAttempted++;const name='Synthetic product '+String(till*100+round).padStart(5,'0'),begin=performance.now();const response=await products(new NextRequest('http://localhost:3000/api/products?organizationId='+id+'&search='+encodeURIComponent(name)+'&limit=20',{headers:{cookie:'pos_session='+token}}),undefined);await response.arrayBuffer();searchMs.push(performance.now()-begin);searchStatus[String(response.status)]=(searchStatus[String(response.status)]??0)+1;if(response.status!==200){searchFailed++;}if(response.status!==200)throw new Error('Search failed '+response.status);
   draftAttempted++;const product=await prisma.product.findFirstOrThrow({where:{organizationId:id,name},select:{id:true}})
   const payload={organizationId:id,storeId:store.id,registerId:register.id,shiftId:register.shifts[0].id,discountAmount:0,items:[{productId:product.id,quantity:1,discountAmount:0}]}
   const draft=await originalKeyAttempt(randomUUID(),key=>createDraft(ctx,payload,key),physical.draft).catch(error=>{throw new Error('draft: '+(error instanceof Error?error.message:'failed'))})
   draftSucceeded++;checkoutAttempted++;const checkoutStart=performance.now()
   await originalKeyAttempt(randomUUID(),key=>completeSale(ctx,draft.id,{payments:[{paymentType:'cash',amount:'100'}]},key),physical.checkout).catch(error=>{checkoutFailed++;throw new Error('checkout: '+(error instanceof Error?error.message:'failed'))})
   checkoutMs.push(performance.now()-checkoutStart);
  }
 }));for(const row of result)if(row.status==='rejected')errors.push(row.reason instanceof Error?row.reason.message:'Profile operation failed');
 const after=await prisma.sale.count({where:{organizationId:id,status:'completed'}}),payments=await prisma.payment.count({where:{organizationId:id}});assert.equal(after-before,checkoutMs.length);assert.equal(payments-beforePayments,checkoutMs.length);
 const p95=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1]??null;
 const denominator=searchAttempted+checkoutAttempted,failed=searchFailed+checkoutFailed;
 const rawDenominator=searchAttempted+physical.draft.calls+physical.checkout.calls
 const rawFailures=searchFailed+physical.draft.failed+physical.checkout.failed
 const report={version:3,at:new Date().toISOString(),node:process.version,fixtureOrganizationId:id,environment:{platform:platform(),kernel:release(),cpu:cpus()[0]?.model??'unknown',logicalCpus:cpus().length,totalMemoryBytes:totalmem(),postgres:postgres[0].version},databaseMigrations,dataset,concurrency:20,actorRole:'owner',checkoutItemsPerSale:1,search:{samples:searchMs.length,attempted:searchAttempted,failed:searchFailed,byStatus:searchStatus,p95Ms:p95(searchMs),targetMs:500},checkout:{samples:checkoutMs.length,attempted:checkoutAttempted,failed:checkoutFailed,p95Ms:p95(checkoutMs),targetMs:2000},draft:{attempted:draftAttempted,succeeded:draftSucceeded,excludedFromCheckoutLatency:true},physicalAttempts:physical,retryPolicy:{maxAttempts:8,deadlineMs:10000,code:'CONCURRENT_CONFLICT',originalKey:true,checkoutLatencyIncludesBackoff:true},rawErrorRate:{failed:rawFailures,denominator:rawDenominator,rate:rawDenominator?rawFailures/rawDenominator:null,scope:'Every search and physical draft/checkout service invocation; controlled conflicts included'},errorRate:{failed,denominator,rate:denominator?failed/denominator:null,scope:'Product route-handler response plus completeSale invocation; draft setup failures reported separately; not HTTP end-to-end'},economicInvariants:{newCompletedSales:after-before,newPayments:payments-beforePayments},errors,providerTime:'No vendor calls; internal cash only',limits:'Synthetic draft volume; service-level API harness, no public network latency; not real pilot or production SLA'};await writeFile('/tmp/pos-volume-measure.json',JSON.stringify(report,null,2));console.info(JSON.stringify(report));assert.equal(errors.length,0);assert.equal(checkoutMs.length,100);assert.ok(report.search.p95Ms!==null&&report.search.p95Ms<=500);assert.ok(report.checkout.p95Ms!==null&&report.checkout.p95Ms<=2000);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Profile failed');process.exitCode=1}).finally(()=>prisma.$disconnect())
