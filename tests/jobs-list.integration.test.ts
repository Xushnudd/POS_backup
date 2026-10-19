import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import {sessionHash,verifySession} from '@/server/auth/session';
import {enqueueJob,claimJob,executeJob,listJobs} from '@/server/jobs/service';
import {incidentList,scan} from '@/server/monitoring/service';
const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw Error('Isolated DB only');
const orgs:string[]=[],users:string[]=[];
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();});
async function fixture(){
 const org=await prisma.organization.create({data:{name:'Operational list fixture',phone:randomUUID()}});orgs.push(org.id);
 const user=await prisma.user.create({data:{fullName:'Operational list owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id);
 await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}});
 const store=await prisma.store.create({data:{organizationId:org.id,name:'Operational list branch'}}),token=randomBytes(32).toString('base64url');
 await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});
 return {org,user,store,ctx:(await verifySession(token))!};
}
test('Actual completed jobs retain globally sorted history across all pages and expose no worker lease or authorization payload',async()=>{
 const f=await fixture(),ids:string[]=[];
 for(let i=0;i<43;i++){
  const job=await enqueueJob(f.ctx,{operationId:randomUUID(),type:'reconciliation',storeId:f.store.id,reason:'Actual owner-approved operational history source'});ids.push(job.id);
  const claimed=(await claimJob())!;assert.equal(claimed.id,job.id);assert.equal((await executeJob(claimed)).succeeded,true);
 }
 const collected:string[]=[];
 for(let page=1;page<=3;page++){
  const result=await listJobs(f.ctx,page,'succeeded',{limit:20,sort:'oldest'});assert.equal(result.total,43);assert.equal(result.limit,20);assert.ok(result.rows.every(row=>!('payload' in row)&&!('leaseToken' in row)));collected.push(...result.rows.map(row=>row.id));
 }
 assert.deepEqual(collected,ids);
 assert.equal((await listJobs(f.ctx,1,undefined,{search:ids[42]})).total,1);
 assert.equal((await listJobs(f.ctx,1,undefined,{search:'NO-SUCH-JOB'})).total,0);
 await assert.rejects(listJobs(f.ctx,0));await assert.rejects(listJobs(f.ctx,1,undefined,{limit:201}));await assert.rejects(listJobs(f.ctx,1,undefined,{sort:'leaseToken' as 'oldest'}));
 const foreign=await fixture();assert.equal((await listJobs(foreign.ctx,1)).total,0);
});
test('Actual reconciliation incidents have sorted bounded history, zero state and unchanged discrepancy sources',async()=>{
 const f=await fixture();
 const products=await Promise.all(Array.from({length:43},(_,i)=>prisma.product.create({data:{organizationId:f.org.id,name:'Intentional unrecorded physical fixture '+i,sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1',costPrice:'0'}})));
 await prisma.inventoryBalance.createMany({data:products.map(product=>({storeId:f.store.id,productId:product.id,quantity:'2'}))});
 await scan(f.ctx,randomUUID());
 const collected:string[]=[];
 for(let page=1;page<=3;page++){const result=await incidentList(f.ctx,page,'open',20,{sort:'oldest'});assert.equal(result.total,43);collected.push(...result.rows.map(row=>row.id));}
 assert.equal(new Set(collected).size,43);assert.equal((await incidentList(f.ctx,1,'open',20,{search:products[42].id})).total,1);
 assert.equal((await incidentList(f.ctx,1,'resolved')).total,0);assert.equal((await incidentList(f.ctx,1,'open',20,{search:'NO-SUCH-ENTITY'})).total,0);
 await assert.rejects(incidentList(f.ctx,0,'open'));await assert.rejects(incidentList(f.ctx,1,'open',201));await assert.rejects(incidentList(f.ctx,1,'open',20,{sort:'evidence' as 'oldest'}));
 assert.equal(await prisma.inventoryMovement.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.inventoryBalance.count({where:{storeId:f.store.id,quantity:'2'}}),43);
 const foreign=await fixture();assert.equal((await incidentList(foreign.ctx,1,'open')).total,0);
});

test('Reconciliation list keeps scoped global pages, searches only public source fields and makes no stock repair',async()=>{
 const f=await fixture(),{reconcile}=await import('@/server/reconciliation/service');
 const products=await Promise.all(Array.from({length:43},(_,i)=>prisma.product.create({data:{organizationId:f.org.id,name:'Reconcile list product '+String(i).padStart(3,'0'),sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1',costPrice:'0'}})));
 await prisma.inventoryBalance.createMany({data:products.map((product,i)=>({storeId:f.store.id,productId:product.id,quantity:String(i+1)}))});
 const ids:string[]=[];
 for(let page=1;page<=3;page++){const result=await reconcile(f.ctx,'inventory',f.store.id,page,20,{sort:'expected_desc',search:'Reconcile list'});assert.equal(result.pagination.total,43);ids.push(...result.rows.map(row=>String(row.productId)));}
 assert.deepEqual(ids,products.map(product=>product.id).sort());
 assert.equal((await reconcile(f.ctx,'inventory',f.store.id,1,20,{search:'Reconcile list product 042'})).pagination.total,1);
 assert.equal((await reconcile(f.ctx,'inventory',f.store.id,1,20,{search:'NO-SUCH-SOURCE'})).pagination.total,0);
 await assert.rejects(reconcile(f.ctx,'inventory',f.store.id,1,20,{sort:'secret' as 'source'}));
 assert.equal(await prisma.inventoryMovement.count({where:{organizationId:f.org.id}}),0);
});
