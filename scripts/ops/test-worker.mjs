import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const testDatabase='postgresql://pos_test:local-test-only@127.0.0.1:55439/pos_test';
const db=new PrismaClient({datasources:{db:{url:testDatabase}}});
let organizationId;
async function main(){
 const image='pos-app:twenty-test';
 const inspection=spawnSync('docker',['image','inspect',image,'--format','{{.Config.User}}'],{encoding:'utf8'});
 assert.equal(inspection.status,0);assert.ok(inspection.stdout.trim()&&!['root','0'].includes(inspection.stdout.trim()));
 const org=await db.organization.create({data:{name:'Isolated packaged worker acceptance',phone:randomUUID()}});organizationId=org.id;
 const store=await db.store.create({data:{organizationId,name:'Fixture branch'}});
 const product=await db.product.create({data:{organizationId,name:'Fixture discrepancy',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'1.01',costPrice:'0.40'}});
 await db.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:'2'}});
 for(let run=0;run<2;run++){
  const worker=spawnSync('docker',['run','--rm','--network','host','-e',`DATABASE_URL=${testDatabase}`,'-e','APP_ORIGIN=https://worker-test.example.invalid',image,'node','--require','./scripts/worker-resolver.cjs','.worker-build/scripts/workers/reconcile.js','--once'],{encoding:'utf8',timeout:60000});
  assert.equal(worker.status,0,worker.stderr);assert.match(worker.stdout,/reconcile_complete/);
 }
 const incidents=await db.incident.findMany({where:{organizationId}});assert.equal(incidents.length,1);assert.equal(incidents[0].kind,'inventory');assert.deepEqual([incidents[0].evidence.expected,incidents[0].evidence.actual,incidents[0].evidence.difference],['0','2.000000','2.000000']);
 assert.equal(await db.auditLog.count({where:{organizationId,actorId:null,action:'system_reconciliation_scanned'}}),2);
 assert.equal((await db.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:product.id}}})).quantity.toString(),'2');
 assert.equal(await db.inventoryMovement.count({where:{organizationId}}),0);assert.equal(await db.payment.count({where:{organizationId}}),0);
 console.log('PASS: non-root packaged worker, two scans, one durable incident, exact evidence0/2/2, system audit2, no stock/payment repair');
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(organizationId)await db.organization.delete({where:{id:organizationId}});await db.$disconnect();});
