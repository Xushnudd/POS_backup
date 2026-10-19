import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import {sessionHash} from '@/server/auth/session';
import type {TokenPayload} from '@/lib/auth';
import {createDraft,completeSale} from '@/server/sales/service';
import {returnSale} from '@/server/returns/service';
import {plannedReport,type PlannedReportInput} from '@/server/reports/planned-report';
const url=new URL(process.env.DATABASE_URL??'');
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test'||url.username!=='pos_test')throw Error('Isolated pos_test only');
const orgs:string[]=[],users:string[]=[];
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();});
async function fixture(legacy=false){
  const org=legacy?await prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe('ALTER TABLE "Organization" DISABLE TRIGGER billing_enroll_new_org');
    const row=await tx.organization.create({data:{name:'Synthetic legacy planned report fixture',phone:randomUUID()}});
    await tx.$executeRawUnsafe('ALTER TABLE "Organization" ENABLE TRIGGER billing_enroll_new_org');return row;
  }):await prisma.organization.create({data:{name:'Planned report fixture',phone:randomUUID()}});orgs.push(org.id);
  const user=await prisma.user.create({data:{fullName:'Planned report owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id);
  const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}});
  const session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(randomBytes(32).toString('base64url')),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});
  const ctx:TokenPayload={organizationId:org.id,organizationUserId:member.id,userId:user.id,role:'owner',storeIds:[],sessionId:session.id};
  const product=await prisma.product.create({data:{organizationId:org.id,name:'Measured report SKU',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:50}});
  const sale=async(name:string,quantity:number)=>{
    const store=await prisma.store.create({data:{organizationId:org.id,name}}),register=await prisma.register.create({data:{storeId:store.id,name:'Report till',code:randomUUID()}});
    const shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}});
    await prisma.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:10}});
    const draft=await createDraft(ctx,{organizationId:org.id,storeId:store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:product.id,quantity,discountAmount:0}]},randomUUID());
    const completed=await completeSale(ctx,draft.id,{payments:[{paymentType:'cash',amount:String(quantity*100)}]},randomUUID());
    return{store,shift,completed};
  };
  return{org,product,ctx,sale};
}
const input:PlannedReportInput={storeIds:[],rangeDays:1,period:'through_now',window:'rolling_days',metrics:['saleCount','grossRevenue','refundAmount','netSales','cogs','grossProfit','grossMarginPercent','operatingProfit','averageSale']};
test('Planned branch KPI reuses real cash sale/refund accounting and explicitly reports unavailable forecast history',async()=>{
  const f=await fixture(),a=await f.sale('A',2),b=await f.sale('B',3);
  await returnSale(f.ctx,a.completed.id,{operationId:randomUUID(),shiftId:a.shift.id,reason:'Original cash report refund',items:[{saleItemId:a.completed.items[0].id,quantity:1,disposition:'sellable'}]});
  const report=await prisma.$transaction(tx=>plannedReport(tx,f.ctx,{...input,forecast:{productIds:[f.product.id],config:{method:'moving_average',windowDays:7,seasonalWeeks:4,historyDays:56,backtestDays:14,horizonDays:7}}},new Date()),{isolationLevel:'RepeatableRead',timeout:15000});
  const branchA=report.branches.find(row=>row.storeId===a.store.id)!,branchB=report.branches.find(row=>row.storeId===b.store.id)!;
  assert.equal(report.timezone,'Asia/Tashkent');assert.equal(report.currency,'UZS');assert.equal(report.period,'through_now');
  assert.deepEqual(branchA.metrics,{saleCount:'1',grossRevenue:'200.00',refundAmount:'100.00',netSales:'100.00',cogs:'50.00',grossProfit:'50.00',grossMarginPercent:'50.000000',operatingProfit:'50.00',averageSale:'100.00'});
  assert.equal(branchB.metrics.netSales,'300.00');assert.equal(branchB.metrics.cogs,'150.00');assert.equal(branchB.metrics.grossProfit,'150.00');
  assert.equal(report.forecasts.length,2);assert.ok(report.forecasts.every(row=>row.result.status==='insufficient_history'&&row.result.forecast.length===0));
  const closed=await prisma.$transaction(tx=>plannedReport(tx,f.ctx,{...input,period:'complete_days'},new Date()),{isolationLevel:'RepeatableRead'});
  assert.ok(closed.branches.every(row=>row.metrics.saleCount==='0'&&row.metrics.grossMarginPercent===null));
});
test('Planned report never accepts another tenant branch/product or a lesser role scope',async()=>{
  const f=await fixture(),foreign=await fixture(),branch=await foreign.sale('Foreign branch',1);
  await assert.rejects(prisma.$transaction(tx=>plannedReport(tx,f.ctx,{...input,storeIds:[branch.store.id]},new Date())),{code:'STORE_NOT_FOUND'});
  await assert.rejects(prisma.$transaction(tx=>plannedReport(tx,f.ctx,{...input,forecast:{productIds:[foreign.product.id],config:{method:'moving_average',windowDays:7,seasonalWeeks:4,historyDays:56,backtestDays:14,horizonDays:7}}},new Date())),{code:'PRODUCT_NOT_FOUND'});
  await assert.rejects(prisma.$transaction(tx=>plannedReport(tx,{...f.ctx,role:'admin'},input,new Date())),{code:'OWNER_REQUIRED'});
  await assert.rejects(prisma.$transaction(tx=>plannedReport(tx,f.ctx,input,new Date(Date.now()+60000))),{code:'INVALID_REPORT_CUTOFF'});
});
test('A delayed through-now occurrence retains its original cutoff and never includes later sales',async()=>{
  const f=await fixture(),cutoff=new Date();await new Promise(resolve=>setTimeout(resolve,10));
  const later=await f.sale('Created after original occurrence',1);
  const report=await prisma.$transaction(tx=>plannedReport(tx,f.ctx,input,cutoff),{isolationLevel:'RepeatableRead'});
  assert.equal(report.asOf,cutoff.toISOString());assert.equal(report.scheduledFor,cutoff.toISOString());
  const branch=report.branches.find(row=>row.storeId===later.store.id)!;
  assert.equal(branch.metrics.saleCount,'0');assert.equal(branch.metrics.netSales,'0.00');assert.equal(branch.metrics.averageSale,null);
});
test('Branch and demand bounds reject a partial report; an explicitly bounded selection remains complete',async()=>{
  const f=await fixture(true),branches:{id:string}[]=[];
  for(let i=0;i<21;i++)branches.push(await prisma.store.create({data:{organizationId:f.org.id,name:'Bounded branch '+i}}));
  await assert.rejects(prisma.$transaction(tx=>plannedReport(tx,f.ctx,input,new Date()),{timeout:15000}),{code:'REPORT_BRANCH_LIMIT'});
  const selected=branches.slice(0,20).map(branch=>branch.id);
  const complete=await prisma.$transaction(tx=>plannedReport(tx,f.ctx,{...input,storeIds:selected},new Date()),{timeout:30000,isolationLevel:'RepeatableRead'});
  assert.equal(complete.branches.length,20);assert.deepEqual(new Set(complete.branches.map(row=>row.storeId)),new Set(selected));
  const products=[f.product];for(let i=0;i<9;i++)products.push(await prisma.product.create({data:{organizationId:f.org.id,name:'Bounded forecast SKU '+i,sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:5}}));
  const forecast={productIds:products.map(product=>product.id),config:{method:'moving_average' as const,windowDays:7,seasonalWeeks:4,historyDays:56,backtestDays:14,horizonDays:7}};
  await assert.rejects(prisma.$transaction(tx=>plannedReport(tx,f.ctx,{...input,storeIds:branches.slice(0,11).map(branch=>branch.id),forecast},new Date()),{timeout:30000}),{code:'REPORT_DEMAND_LIMIT'});
  const allowed=await prisma.$transaction(tx=>plannedReport(tx,f.ctx,{...input,storeIds:branches.slice(0,10).map(branch=>branch.id),forecast},new Date()),{timeout:30000});
  assert.equal(allowed.forecasts.length,100);assert.ok(allowed.forecasts.every(item=>item.result.status==='insufficient_history'));
});
