/** Resume only the deterministic synthetic volume fixture, with all DB guards on. */
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {prisma} from '@/lib/prisma';
const connection=new URL(process.env.DATABASE_URL??'');
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test'||connection.username!=='pos_test')throw Error('Isolated volume database required');
async function main(){
 const id=process.env.POS_PROFILE_TEST_ORG;if(!id||!/^[0-9a-f-]{36}$/.test(id))throw Error('Explicit synthetic fixture ID required');
 const org=await prisma.organization.findUniqueOrThrow({where:{id}});
 assert.match(org.name,/^Synthetic volume [0-9a-f-]{36}$/);const tag=org.name.slice('Synthetic volume '.length);
 const owner=await prisma.organizationUser.findFirstOrThrow({where:{organizationId:id,role:'owner'},include:{user:true}});
 assert.equal(owner.user.phone,tag);assert.equal(owner.user.passwordHash,'not-a-login');
 const stores=await prisma.store.findMany({where:{organizationId:id}});assert.equal(stores.length,1);const store=stores[0];
 const registers=await prisma.register.findMany({where:{storeId:store.id,isActive:true},include:{shifts:{where:{status:'open'}}}});
 assert.equal(registers.length,20);for(let till=0;till<20;till++)assert.equal(registers.filter(register=>register.code==='V'+till).length,1);
 assert.equal(await prisma.product.count({where:{organizationId:id}}),50000);
 assert.equal(await prisma.inventoryBalance.count({where:{storeId:store.id}}),50000);
 assert.equal(await prisma.sale.count({where:{organizationId:id,status:'completed'}}),0);
 assert.equal(await prisma.payment.count({where:{organizationId:id}}),0);
 const before=await prisma.saleItem.count({where:{sale:{organizationId:id}}});
 const lanes=[] as {registerId:string;shiftId:string;till:number}[];
 for(let till=0;till<20;till++){
  const register=registers.find(row=>row.code==='V'+till)!;assert.equal(register.shifts.length,1);assert.equal(register.shifts[0].organizationUserId,owner.id);
  lanes.push({registerId:register.id,shiftId:register.shifts[0].id,till});
  // Existing parents are preserved; only missing deterministic draft IDs enter.
  await prisma.$executeRaw`INSERT INTO "Sale"(id,"organizationId","storeId","registerId","shiftId","cashierId","receiptNo",status,subtotal,"totalAmount") SELECT md5(${tag}||':sale:'||(${till}*1000+i))::uuid::text,${id},${store.id},${register.id},${register.shifts[0].id},${owner.userId},'SYN-'||i,'draft',5000,5000 FROM generate_series(0,999) i WHERE NOT EXISTS(SELECT 1 FROM "Sale" old WHERE old.id=md5(${tag}||':sale:'||(${till}*1000+i))::uuid::text) ON CONFLICT(id) DO NOTHING`;
 }
 assert.equal(await prisma.sale.count({where:{organizationId:id,status:'draft',receiptNo:{startsWith:'SYN-'}}}),20000);
 const jobs=lanes.flatMap(lane=>Array.from({length:200},(_,index)=>({...lane,batch:index*5})));
 let next=0,finished=0;
 // Four independent ranges; IDs and parent/product mapping match core-profile.
 await Promise.all(Array.from({length:4},async()=>{
  for(;;){const index=next++;if(index>=jobs.length)return;const {till,batch}=jobs[index];
   await prisma.$executeRaw`INSERT INTO "SaleItem"(id,"saleId","productId","productName",sku,unit,quantity,"unitPrice","unitCost","lineTotal") SELECT md5(${tag}||':line:'||(${till}*50000+s*50+p))::uuid::text,md5(${tag}||':sale:'||(${till}*1000+s))::uuid::text,md5(${tag}||':product:'||((s*50+p)%50000))::uuid::text,'Synthetic product','V','dona',1,100,40,100 FROM generate_series(${batch},${batch+4}) s CROSS JOIN generate_series(0,49) p WHERE NOT EXISTS(SELECT 1 FROM "SaleItem" old WHERE old.id=md5(${tag}||':line:'||(${till}*50000+s*50+p))::uuid::text) ON CONFLICT(id) DO NOTHING`;
   finished++;if(finished%400===0)console.info('volume-resume: '+finished+'/'+jobs.length+' disjoint batches validated');
  }
 }));
 const dataset={products:await prisma.product.count({where:{organizationId:id}}),saleItems:await prisma.saleItem.count({where:{sale:{organizationId:id}}}),activeRegisters:20,historyStatus:'synthetic drafts; real measured checkout uses normal service'};
 assert.equal(dataset.saleItems,1000000);
 await writeFile('/tmp/pos-volume-dataset.json',JSON.stringify({version:1,createdAt:new Date().toISOString(),organizationId:id,dataset,kind:'isolated synthetic volume; not production history',resume:{beforeSaleItems:before,afterSaleItems:dataset.saleItems,workers:4,guardsDisabled:false}},null,2));
 console.info(JSON.stringify({dataset,resume:{beforeSaleItems:before,afterSaleItems:dataset.saleItems,workers:4,guardsDisabled:false}}));
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Synthetic fixture resume failed');process.exitCode=1}).finally(()=>prisma.$disconnect());
