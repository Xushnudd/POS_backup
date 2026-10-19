import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import type {TokenPayload} from '@/lib/auth';
import type {LoyaltyPolicy} from '@/server/loyalty/calculations';
import {publishLoyaltyPolicy} from '@/server/loyalty/policy';
import {preparePointRedemption,cancelPointRedemption} from '@/server/loyalty/redemption';
import {readPointWallet} from '@/server/loyalty/wallet';
import {createDraft,completeSale} from '@/server/sales/service';
import {returnSale} from '@/server/returns/service';
import {sessionHash,verifySession} from '@/server/auth/session';
import {NextRequest} from 'next/server';
import {POST as pointsAPI,GET as pointsGET} from '@/app/api/sales/[id]/points/route';
import {GET as walletAPI} from '@/app/api/customers/[id]/points/route';
const url=new URL(process.env.DATABASE_URL??'');
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test'||url.username!=='pos_test')throw Error('Isolated pos_test only');
const orgs:string[]=[],users:string[]=[];
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();});
const configuration:LoyaltyPolicy={points:{enabled:true,earnMoneyPerPoint:'40',redeemMoneyPerPoint:'1',maxRedeemPercent:'10',minEligibleNet:'0',expiryDays:30,earnOnDiscountedSales:true,earnOnCreditSales:false},cards:{enabled:false,discountPercent:'0',validityDays:null},promos:{enabled:false,allowStackingWithCard:false,allowStackingWithPoints:false},gifts:{enabled:false,minIssueAmount:'1000',maxIssueAmount:'1000000',validityDays:null,allowUnusedCashRefund:false}};
async function fixture(config=configuration){
 const org=await prisma.organization.create({data:{name:'Point spend fixture',phone:randomUUID()}});orgs.push(org.id);const user=await prisma.user.create({data:{fullName:'Point spend owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id);
 const token=randomBytes(32).toString('base64url'),member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}}),session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});
 const ctx:TokenPayload={organizationId:org.id,organizationUserId:member.id,userId:user.id,role:'owner',storeIds:[],sessionId:session.id};
 const store=await prisma.store.create({data:{organizationId:org.id,name:'Point spend branch'}}),register=await prisma.register.create({data:{storeId:store.id,name:'Point till',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}}),customer=await prisma.customer.create({data:{organizationId:org.id,fullName:'Point spend customer',phone:randomUUID()}}),product=await prisma.product.create({data:{organizationId:org.id,name:'Point eligible goods',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:50}});
 await prisma.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:30}});
 const policy=await publishLoyaltyPolicy(ctx,{operationId:randomUUID(),expectedRevision:0,configuration:config,reason:'Explicit test reward and redemption policy'});
 const draft=()=>createDraft(ctx,{organizationId:org.id,storeId:store.id,registerId:register.id,shiftId:shift.id,customerId:customer.id,discountAmount:0,items:[{productId:product.id,quantity:3,discountAmount:0}]},randomUUID());
 const earn=await draft(),earned=await completeSale(ctx,earn.id,{payments:[{paymentType:'cash',amount:'300'}]},randomUUID());
 return {org,ctx,user,member,store,shift,customer,product,policy,draft,earned,token};
}
test('Points reduce only the reviewed receipt, debit once at checkout and split refunds restore original lots without renewing expiry',async()=>{
 const f=await fixture(),sale=await f.draft(),input={operationId:randomUUID(),policyVersionId:f.policy.id,points:'7',customerConsent:true as const,reason:'Customer approved original seven-point discount'};
 const prepared=await preparePointRedemption(f.ctx,sale.id,input);assert.equal(prepared.sale.totalAmount.toString(),'293');assert.equal((await preparePointRedemption(f.ctx,sale.id,input)).redemption.id,prepared.redemption.id);
 assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'7');
 const key=randomUUID(),completed=await completeSale(f.ctx,sale.id,{payments:[{paymentType:'cash',amount:'293'}]},key);assert.equal((await completeSale(f.ctx,sale.id,{payments:[{paymentType:'cash',amount:'293'}]},key)).id,completed.id);
 const quote=await prisma.loyaltyRedemption.findUniqueOrThrow({where:{id:prepared.redemption.id}});assert.equal(quote.state,'posted');assert.equal(await prisma.loyaltyPointEntry.count({where:{redemptionId:quote.id,kind:'redeem'}}),1);
 const sourceLot=await prisma.loyaltyPointLot.findUniqueOrThrow({where:{saleId:f.earned.id}}),expiry=sourceLot.expiresAt!.toISOString();assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'7');
 // Existing cash refund contract rounds each nonfinal share and closes the
 // original remainder on the last return. Reward rounding does not alter it.
 const amounts=['97.67','97.67','97.66'];for(let i=0;i<3;i++){
  const ret=await returnSale(f.ctx,sale.id,{operationId:randomUUID(),shiftId:f.shift.id,reason:'Partial return restores original reward allocation',items:[{saleItemId:completed.items[0].id,quantity:1,disposition:'sellable'}]});assert.equal(String(ret.refundAmount),amounts[i]);
 }
 const restored=await prisma.loyaltyPointEntry.aggregate({where:{redemptionId:quote.id,kind:'return_redeem'},_sum:{points:true}});assert.equal(restored._sum.points?.toString(),'7');
 assert.equal((await prisma.loyaltyPointLot.findUniqueOrThrow({where:{id:sourceLot.id}})).expiresAt?.toISOString(),expiry);assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'7');
});
test('Two prepared receipts cannot spend one wallet concurrently; the losing receipt/payment/stock remains unposted',async()=>{
 // Disable earning on these discounted sales, so a winner cannot supply new
 // points to the losing receipt. Configure it before preparing both receipts.
 const config={...configuration,points:{...configuration.points,earnOnDiscountedSales:false}};
 const g=await fixture(config),x=await g.draft();
 const secondRegister=await prisma.register.create({data:{storeId:g.store.id,name:'Independent second point till',code:randomUUID()}}),secondShift=await prisma.shift.create({data:{registerId:secondRegister.id,organizationUserId:g.member.id,openingCash:0}});
 const secondProduct=await prisma.product.create({data:{organizationId:g.org.id,name:'Independent stock source for wallet race',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:50}});await prisma.inventoryBalance.create({data:{storeId:g.store.id,productId:secondProduct.id,quantity:30}});
 const y=await createDraft(g.ctx,{organizationId:g.org.id,storeId:g.store.id,registerId:secondRegister.id,shiftId:secondShift.id,customerId:g.customer.id,discountAmount:0,items:[{productId:secondProduct.id,quantity:3,discountAmount:0}]},randomUUID());
 for(const sale of [x,y])await preparePointRedemption(g.ctx,sale.id,{operationId:randomUUID(),policyVersionId:g.policy.id,points:'7',customerConsent:true,reason:'Concurrent same-wallet fixed-budget checkout'});
 const results=await Promise.allSettled([x,y].map(sale=>completeSale(g.ctx,sale.id,{payments:[{paymentType:'cash',amount:'293'}]},randomUUID())));
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected').length,1);
 assert.equal((await readPointWallet(g.ctx,g.customer.id)).availablePoints,'0');assert.equal(await prisma.payment.count({where:{saleId:{in:[x.id,y.id]}}}),1);assert.equal(await prisma.sale.count({where:{id:{in:[x.id,y.id]},status:'draft'}}),1);
});
test('Cancelled point review restores original money, protects cart/customer snapshot and changed policy cannot publish a debit',async()=>{
 const f=await fixture(),sale=await f.draft(),prepared=await preparePointRedemption(f.ctx,sale.id,{operationId:randomUUID(),policyVersionId:f.policy.id,points:'7',customerConsent:true,reason:'Original reversible point review'});
 await assert.rejects(prisma.sale.update({where:{id:sale.id},data:{discountAmount:'0'}}));
 const cancel={operationId:randomUUID(),reason:'Customer cancelled unposted point choice'};const cancelled=await cancelPointRedemption(f.ctx,sale.id,cancel);assert.equal(cancelled.sale.totalAmount.toString(),'300');assert.equal((await cancelPointRedemption(f.ctx,sale.id,cancel)).redemption.id,prepared.redemption.id);assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'7');
 const again=await preparePointRedemption(f.ctx,sale.id,{operationId:randomUUID(),policyVersionId:f.policy.id,points:'7',customerConsent:true,reason:'New original point choice after cancellation'});assert.notEqual(again.redemption.id,prepared.redemption.id);
 await publishLoyaltyPolicy(f.ctx,{operationId:randomUUID(),expectedRevision:1,configuration:{...configuration,points:{...configuration.points,enabled:false}},reason:'Owner revoked future point redemption'});
 await assert.rejects(completeSale(f.ctx,sale.id,{payments:[{paymentType:'cash',amount:'293'}]},randomUUID()));assert.equal(await prisma.loyaltyPointEntry.count({where:{redemptionId:again.redemption.id}}),0);assert.equal((await prisma.sale.findUniqueOrThrow({where:{id:sale.id}})).status,'draft');
});
test('Refunded spent earnings become recovery debt; later grants clear it once through paired original transfers',async()=>{
 const f=await fixture({...configuration,points:{...configuration.points,earnOnDiscountedSales:false}}),sale=await f.draft();
 await preparePointRedemption(f.ctx,sale.id,{operationId:randomUUID(),policyVersionId:f.policy.id,points:'7',customerConsent:true,reason:'Customer spends original earned reward'});
 await completeSale(f.ctx,sale.id,{payments:[{paymentType:'cash',amount:'293'}]},randomUUID());assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'0');
 await returnSale(f.ctx,f.earned.id,{operationId:randomUUID(),shiftId:f.shift.id,reason:'Return goods after their earned points were spent',items:[{saleItemId:f.earned.items[0].id,quantity:1,disposition:'sellable'}]});
 const debt=await readPointWallet(f.ctx,f.customer.id);assert.equal(debt.availablePoints,'0');assert.equal(debt.recoveryDebtPoints,'3');
 const fresh=await f.draft();await completeSale(f.ctx,fresh.id,{payments:[{paymentType:'cash',amount:'300'}]},randomUUID());
 const settled=await readPointWallet(f.ctx,f.customer.id);assert.equal(settled.availablePoints,'4');assert.equal(settled.recoveryDebtPoints,'0');
 const transfer=await prisma.loyaltyRecoveryTransfer.findFirstOrThrow({where:{saleId:fresh.id}});assert.equal(transfer.points.toString(),'3');
 const entries=await prisma.loyaltyPointEntry.findMany({where:{transferId:transfer.id}});assert.equal(entries.length,2);assert.equal(entries.reduce((total,row)=>total+row.points,BigInt(0)).toString(),'0');
 assert.equal(entries.find(row=>row.kind==='recovery_out')?.points.toString(),'-3');assert.equal(entries.find(row=>row.kind==='recovery_in')?.points.toString(),'3');
 await assert.rejects(prisma.loyaltyRecoveryTransfer.update({where:{id:transfer.id},data:{points:BigInt(9)}}));
 const next=await f.draft();await completeSale(f.ctx,next.id,{payments:[{paymentType:'cash',amount:'300'}]},randomUUID());assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'11');assert.equal(await prisma.loyaltyRecoveryTransfer.count({where:{organizationId:f.org.id}}),1);
});
test('A configured full point discount and zero cash refund conserve original allocations and physical stock',async()=>{
 const f=await fixture({...configuration,points:{...configuration.points,earnMoneyPerPoint:'1',maxRedeemPercent:'100'}}),sale=await f.draft();
 const prepared=await preparePointRedemption(f.ctx,sale.id,{operationId:randomUUID(),policyVersionId:f.policy.id,points:'300',customerConsent:true,reason:'Explicit full point discount under owner policy'});assert.equal(String(prepared.sale.totalAmount),'0');
 const completed=await completeSale(f.ctx,sale.id,{payments:[]},randomUUID());assert.equal(await prisma.payment.count({where:{saleId:sale.id}}),0);assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'0');
 const ret=await returnSale(f.ctx,sale.id,{operationId:randomUUID(),shiftId:f.shift.id,reason:'Return fully discounted goods to original reward lots',items:[{saleItemId:completed.items[0].id,quantity:3,disposition:'sellable'}]});assert.equal(String(ret.refundAmount),'0');
 assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'300');assert.equal(await prisma.payment.count({where:{saleId:sale.id}}),0);assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'27');
});
test('Native expiry boundary excludes real source lots without a production clock override or forged expiry update',async()=>{
 const f=await fixture(),lot=await prisma.loyaltyPointLot.findUniqueOrThrow({where:{saleId:f.earned.id}}),before=new Date(lot.expiresAt!.getTime()-1);
 const [active]=await prisma.$queryRaw<{points:string}[]>`SELECT pos_loyalty_available(${f.customer.id},${f.org.id},CAST(${before} AS timestamp))::text AS points`;
 const [expired]=await prisma.$queryRaw<{points:string}[]>`SELECT pos_loyalty_available(${f.customer.id},${f.org.id},CAST(${lot.expiresAt!} AS timestamp))::text AS points`;
 assert.equal(active.points,'7');assert.equal(expired.points,'0');
 await assert.rejects(prisma.loyaltyPointLot.update({where:{id:lot.id},data:{expiresAt:new Date(Date.now()-1)}}));
 assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'7');
});
test('HTTP point interfaces remain tenant scoped, reject missing consent and use exact public strings',async()=>{
 const f=await fixture(),foreign=await fixture(),sale=await f.draft();
 const request=(token:string,path:string,body?:unknown)=>new NextRequest('http://localhost:3000'+path,{method:body?'POST':'GET',headers:{cookie:'pos_session='+token,origin:'http://localhost:3000','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const input={operationId:randomUUID(),policyVersionId:f.policy.id,points:'7',customerConsent:true,reason:'Actual authenticated point selection'};
 const denied=await pointsAPI(request(foreign.token,'/api/sales/'+sale.id+'/points',input),{params:Promise.resolve({id:sale.id})});assert.equal(denied.status,404);
 const noConsent={...input,operationId:randomUUID(),customerConsent:false};assert.equal((await pointsAPI(request(f.token,'/api/sales/'+sale.id+'/points',noConsent),{params:Promise.resolve({id:sale.id})})).status,400);
 const accepted=await pointsAPI(request(f.token,'/api/sales/'+sale.id+'/points',input),{params:Promise.resolve({id:sale.id})});assert.equal(accepted.status,200);const data=(await accepted.json()).data;assert.equal(data.redemption.points,'7');assert.equal(data.redemption.discountAmount,'7.00');assert.equal(data.sale.totalAmount,'293');
 const get=await pointsGET(request(f.token,'/api/sales/'+sale.id+'/points'),{params:Promise.resolve({id:sale.id})});const visible=(await get.json()).data;assert.equal(visible.points,'7');assert.equal('sessionId'in visible,false);
 assert.equal((await walletAPI(request(foreign.token,'/api/customers/'+f.customer.id+'/points'),{params:Promise.resolve({id:f.customer.id})})).status,404);
});
test('Late redemption audit failure rolls back checkout and preserves one original quote for a safe retry',async()=>{
 const f=await fixture(),sale=await f.draft(),prepared=await preparePointRedemption(f.ctx,sale.id,{operationId:randomUUID(),policyVersionId:f.policy.id,points:'7',customerConsent:true,reason:'Original point selection before injected fault'}),name='point_spend_fault_'+randomUUID().replaceAll('-',''),key=randomUUID();
 await prisma.$executeRawUnsafe(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${f.org.id}' AND NEW.action='loyalty_points_redeemed' THEN RAISE EXCEPTION 'test-only point publication audit fault';END IF;RETURN NEW;END $$`);
 await prisma.$executeRawUnsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${name}()`);
 try{await assert.rejects(completeSale(f.ctx,sale.id,{payments:[{paymentType:'cash',amount:'293'}]},key));}finally{await prisma.$executeRawUnsafe(`DROP TRIGGER ${name} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${name}()`);}
 assert.equal((await prisma.loyaltyRedemption.findUniqueOrThrow({where:{id:prepared.redemption.id}})).state,'prepared');assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'7');assert.equal(await prisma.payment.count({where:{saleId:sale.id}}),0);assert.equal((await prisma.sale.findUniqueOrThrow({where:{id:sale.id}})).status,'draft');
 await completeSale(f.ctx,sale.id,{payments:[{paymentType:'cash',amount:'293'}]},key);assert.equal(await prisma.auditLog.count({where:{entityId:prepared.redemption.id,action:'loyalty_points_redeemed'}}),1);
});
test('Actual cashier membership can use only its own scoped receipt and remains subject to configured discount permission',async()=>{
 const f=await fixture(),replacementOwner=await prisma.user.create({data:{fullName:'Actual continuing point owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(replacementOwner.id);await prisma.organizationUser.create({data:{organizationId:f.org.id,userId:replacementOwner.id,role:'owner'}});
 await prisma.organizationUser.update({where:{id:f.member.id},data:{role:'cashier',userStores:{create:{storeId:f.store.id}}}});const cashier=(await verifySession(f.token))!;assert.equal(cashier.role,'cashier');
 const sale=await createDraft(cashier,{organizationId:f.org.id,storeId:f.store.id,registerId:f.shift.registerId,shiftId:f.shift.id,customerId:f.customer.id,discountAmount:0,items:[{productId:f.product.id,quantity:3,discountAmount:0}]},randomUUID());
 const input={operationId:randomUUID(),policyVersionId:f.policy.id,points:'7',customerConsent:true as const,reason:'Actual cashier and customer reviewed point use'};
 await assert.rejects(preparePointRedemption(cashier,sale.id,input),{code:'DISCOUNT_LIMIT'});assert.equal(await prisma.loyaltyRedemption.count({where:{saleId:sale.id}}),0);assert.equal((await prisma.sale.findUniqueOrThrow({where:{id:sale.id}})).totalAmount.toString(),'300');
 await prisma.discountPolicy.create({data:{organizationId:f.org.id,cashierMaxPercent:'10',adminMaxPercent:'100',requireReasonFromPercent:'10'}});
 const prepared=await preparePointRedemption(cashier,sale.id,{...input,operationId:randomUUID()});assert.equal(String(prepared.sale.totalAmount),'293');
 await completeSale(cashier,sale.id,{payments:[{paymentType:'cash',amount:'293'}]},randomUUID());assert.equal((await prisma.loyaltyRedemption.findUniqueOrThrow({where:{id:prepared.redemption.id}})).state,'posted');
 const other=await prisma.user.create({data:{fullName:'Other scoped point cashier',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(other.id);await prisma.organizationUser.create({data:{organizationId:f.org.id,userId:other.id,role:'cashier',userStores:{create:{storeId:f.store.id}}}});const token=randomBytes(32).toString('base64url');await prisma.session.create({data:{organizationId:f.org.id,userId:other.id,tokenHash:sessionHash(token),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});
 const denied=await pointsGET(new NextRequest('http://localhost:3000/api/sales/'+sale.id+'/points',{headers:{cookie:'pos_session='+token}}),{params:Promise.resolve({id:sale.id})});assert.equal(denied.status,404);
});
test('Refund clawback consumes an already available credit atomically instead of reserving it until expiry and charging debt again',async()=>{
 const f=await fixture({...configuration,points:{...configuration.points,earnOnDiscountedSales:false}}),second=await f.draft();await completeSale(f.ctx,second.id,{payments:[{paymentType:'cash',amount:'300'}]},randomUUID());
 const spending=await f.draft();await preparePointRedemption(f.ctx,spending.id,{operationId:randomUUID(),policyVersionId:f.policy.id,points:'7',customerConsent:true,reason:'Original FIFO spend before refund with remaining credit'});await completeSale(f.ctx,spending.id,{payments:[{paymentType:'cash',amount:'293'}]},randomUUID());assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'7');
 const ret=await returnSale(f.ctx,f.earned.id,{operationId:randomUUID(),shiftId:f.shift.id,reason:'Full original grant refund with a second active credit',items:[{saleItemId:f.earned.items[0].id,quantity:3,disposition:'sellable'}]});
 const transfer=await prisma.loyaltyRecoveryTransfer.findFirstOrThrow({where:{returnId:ret.id}});assert.equal(transfer.points.toString(),'7');assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'0');assert.equal((await readPointWallet(f.ctx,f.customer.id)).recoveryDebtPoints,'0');
 const [negative]=await prisma.$queryRaw<{count:bigint}[]>`SELECT count(*)::bigint AS count FROM "LoyaltyPointBalance" WHERE "organizationId"=${f.org.id} AND balance<0`;assert.equal(negative.count,BigInt(0));
 const future=await f.draft();await completeSale(f.ctx,future.id,{payments:[{paymentType:'cash',amount:'300'}]},randomUUID());assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'7');assert.equal(await prisma.loyaltyRecoveryTransfer.count({where:{organizationId:f.org.id}}),1);
});
