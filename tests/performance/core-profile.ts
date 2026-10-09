/** Isolated synthetic volume profile. Never run against a business database. */
import {writeFile} from 'node:fs/promises'
import {performance} from 'node:perf_hooks'
import {randomUUID,randomBytes} from 'node:crypto'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {sessionHash,verifySession} from '@/server/auth/session'
import {createDraft,completeSale} from '@/server/sales/service'
import {GET as products} from '@/app/api/products/route'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test'||connection.username!=='pos_test')throw new Error('Isolated volume database required')
let keepFixture=false;
const tag=randomUUID(),orgId=randomUUID(),userId=randomUUID(),memberId=randomUUID(),storeId=randomUUID()
const registers=Array.from({length:20},()=>randomUUID()),shifts=Array.from({length:20},()=>randomUUID())
const percentile=(values:number[],fraction:number)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*fraction)-1]
async function main(){
 const started=performance.now();console.info('volume: begin isolated fixture');
 await prisma.organization.create({data:{id:orgId,name:'Synthetic volume '+tag,phone:tag}})
 await prisma.user.create({data:{id:userId,fullName:'Synthetic owner',phone:tag,passwordHash:'not-a-login'}})
 await prisma.organizationUser.create({data:{id:memberId,organizationId:orgId,userId,role:'owner'}})
 await prisma.store.create({data:{id:storeId,organizationId:orgId,name:'Synthetic branch'}})
 await prisma.register.createMany({data:registers.map((id,i)=>({id,storeId,name:'Synthetic till '+i,code:'V'+i}))})
 await prisma.shift.createMany({data:shifts.map((id,i)=>({id,registerId:registers[i],organizationUserId:memberId,openingCash:0}))})
 const sessions:{token:string;ctx:TokenPayload}[]=[];
 for(let till=0;till<20;till++){const token=randomBytes(32).toString('base64url');await prisma.session.create({data:{userId,organizationId:orgId,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+7200000),idleExpiresAt:new Date(Date.now()+7200000)}});sessions.push({token,ctx:(await verifySession(token))!})}
 console.info('volume: 20 active tills created');
 // Reproducible indexes and distribution, unique isolated identity per invocation.
 for(let start=0;start<50000;start+=100){await prisma.$executeRaw`INSERT INTO "Product"(id,"organizationId",name,sku,barcode,unit,"salePrice","costPrice","updatedAt") SELECT md5(${tag}||':product:'||i)::uuid::text,${orgId},'Synthetic product '||lpad(i::text,5,'0'),'V-'||lpad(i::text,5,'0'),'V-'||lpad(i::text,5,'0'),'dona',100,40,NOW() FROM generate_series(${start},${start+99}) i`}
 console.info('volume: 50000 products created');
 for(let start=0;start<50000;start+=100){await prisma.$executeRaw`INSERT INTO "InventoryBalance"("storeId","productId",quantity,"updatedAt") SELECT ${storeId},id,1000,NOW() FROM "Product" WHERE "organizationId"=${orgId} AND sku>=${'V-'+String(start).padStart(5,'0')} AND sku<=${'V-'+String(start+99).padStart(5,'0')}`}
 console.info('volume: inventory balances created');
 // Draft synthetic receipts provide 1m relational rows without fabricating paid
 // production history or bypassing immutable financial/stock journal guards.
 for(let till=0;till<20;till++){
  await prisma.$executeRaw`INSERT INTO "Sale"(id,"organizationId","storeId","registerId","shiftId","cashierId","receiptNo",status,subtotal,"totalAmount") SELECT md5(${tag}||':sale:'||(${till}*1000+i))::uuid::text,${orgId},${storeId},${registers[till]},${shifts[till]},${userId},'SYN-'||i,'draft',5000,5000 FROM generate_series(0,999) i`
  for(let batch=0;batch<1000;batch+=5){await prisma.$executeRaw`INSERT INTO "SaleItem"(id,"saleId","productId","productName",sku,unit,quantity,"unitPrice","unitCost","lineTotal") SELECT md5(${tag}||':line:'||(${till}*50000+s*50+p))::uuid::text,md5(${tag}||':sale:'||(${till}*1000+s))::uuid::text,md5(${tag}||':product:'||((s*50+p)%50000))::uuid::text,'Synthetic product','V','dona',1,100,40,100 FROM generate_series(${batch},${batch+4}) s CROSS JOIN generate_series(0,49) p`}
 }
 console.info('volume: 1000000 draft receipt lines created');
 const dataset={products:await prisma.product.count({where:{organizationId:orgId}}),saleItems:await prisma.saleItem.count({where:{sale:{organizationId:orgId}}}),activeRegisters:await prisma.register.count({where:{storeId,isActive:true}}),historyStatus:'synthetic drafts; real measured checkout uses normal service'}
 assert.equal(dataset.products,50000);assert.equal(dataset.saleItems,1000000);assert.equal(dataset.activeRegisters,20)
 await writeFile('/tmp/pos-volume-dataset.json',JSON.stringify({version:1,createdAt:new Date().toISOString(),organizationId:orgId,dataset,kind:'isolated synthetic volume; not production history'},null,2));if(process.argv.includes('--seed-only')){keepFixture=true;console.info(JSON.stringify(dataset));return}
 await prisma.$executeRaw`ANALYZE "Product"`;await prisma.$executeRaw`ANALYZE "SaleItem"`;await prisma.$executeRaw`ANALYZE "Sale"`;
 const searchMs:number[]=[],checkoutMs:number[]=[],errors:string[]=[];
 await Promise.all(registers.map(async(registerId,till)=>{const {token,ctx}=sessions[till];
  for(let round=0;round<5;round++){
   const term='Synthetic product '+String(till*100+round).padStart(5,'0'),begin=performance.now();
   const response=await products(new NextRequest('http://localhost:3000/api/products?organizationId='+orgId+'&search='+encodeURIComponent(term)+'&limit=20',{headers:{cookie:'pos_session='+token}}),undefined);searchMs.push(performance.now()-begin);if(response.status!==200)errors.push('search:'+response.status);await response.arrayBuffer();
   const productId=await prisma.product.findFirstOrThrow({where:{organizationId:orgId,name:term},select:{id:true}});
   const draft=await createDraft(ctx,{organizationId:orgId,storeId,registerId,shiftId:shifts[till],discountAmount:0,items:[{productId:productId.id,quantity:1,discountAmount:0}]},randomUUID());const checkoutStart=performance.now();try{await completeSale(ctx,draft.id,{payments:[{paymentType:'cash',amount:'100'}]},randomUUID());checkoutMs.push(performance.now()-checkoutStart)}catch(error){errors.push(error instanceof Error?error.message:'checkout failed')}
  }
 }));
 const actual=await prisma.sale.count({where:{organizationId:orgId,status:'completed'}}),payments=await prisma.payment.count({where:{organizationId:orgId}});assert.equal(actual,checkoutMs.length);assert.equal(payments,actual);
 const report={version:1,createdAt:new Date().toISOString(),node:process.version,dataset,concurrency:20,actorRole:'owner',checkoutItemsPerSale:1,search:{samples:searchMs.length,p95Ms:percentile(searchMs,.95),targetMs:500},checkout:{samples:checkoutMs.length,p95Ms:percentile(checkoutMs,.95),targetMs:2000},providerTime:'No vendor API called; internal cash only',errors,totalMs:performance.now()-started};await writeFile('/tmp/pos-volume-profile.json',JSON.stringify(report,null,2));console.info(JSON.stringify(report));assert.equal(errors.length,0);assert.ok(report.search.p95Ms<=500,'Search p95 target failed');assert.ok(report.checkout.p95Ms<=2000,'Checkout p95 target failed');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Profile failed');process.exitCode=1}).finally(async()=>{if(keepFixture){await prisma.$disconnect();return}for(;;){const rows=await prisma.inventoryBalance.findMany({where:{storeId},select:{productId:true},take:100});if(!rows.length)break;await prisma.inventoryBalance.deleteMany({where:{storeId,productId:{in:rows.map(row=>row.productId)}}})}await prisma.organization.deleteMany({where:{id:orgId}});await prisma.user.deleteMany({where:{id:userId}});await prisma.$disconnect()}).catch(()=>{console.error('Synthetic profile cleanup failed; inspect isolated fixture only');process.exitCode=1})
