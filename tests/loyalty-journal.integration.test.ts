import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import type {TokenPayload} from '@/lib/auth';
import {publishLoyaltyPolicy} from '@/server/loyalty/policy';
import type {LoyaltyPolicy} from '@/server/loyalty/calculations';
import {createDraft,completeSale} from '@/server/sales/service';
import {returnSale} from '@/server/returns/service';
import {readPointWallet} from '@/server/loyalty/wallet';
import {mergeCustomer} from '@/server/customers/identity';
import {configureOfflineCash,issueCashTicket,commitOfflineCash} from '@/server/offline/cash';
const url=new URL(process.env.DATABASE_URL??'');
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test'||url.username!=='pos_test')throw Error('Isolated pos_test only');
const orgs:string[]=[],users:string[]=[];
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();});
const configuration:LoyaltyPolicy={points:{enabled:true,earnMoneyPerPoint:'40',redeemMoneyPerPoint:'1',maxRedeemPercent:'10',minEligibleNet:'0',expiryDays:30,earnOnDiscountedSales:true,earnOnCreditSales:false},cards:{enabled:false,discountPercent:'0',validityDays:null},promos:{enabled:false,allowStackingWithCard:false,allowStackingWithPoints:false},gifts:{enabled:false,minIssueAmount:'1000',maxIssueAmount:'1000000',validityDays:null,allowUnusedCashRefund:false}};
async function fixture(enabled=true){
 const org=await prisma.organization.create({data:{name:'Loyalty journal fixture',phone:randomUUID()}});orgs.push(org.id);
 const user=await prisma.user.create({data:{fullName:'Loyalty journal owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id);
 const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}});
 const session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:randomUUID(),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});
 const ctx:TokenPayload={organizationId:org.id,organizationUserId:member.id,userId:user.id,role:'owner',storeIds:[],sessionId:session.id};
 const store=await prisma.store.create({data:{organizationId:org.id,name:'Actual rewards branch'}}),register=await prisma.register.create({data:{storeId:store.id,name:'Rewards till',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}});
 const customer=await prisma.customer.create({data:{organizationId:org.id,fullName:'Actual rewards customer',phone:randomUUID(),creditLimit:1000}}),product=await prisma.product.create({data:{organizationId:org.id,name:'Reward SKU',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:50}});
 await prisma.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:10}});
 const policy=await publishLoyaltyPolicy(ctx,{operationId:randomUUID(),expectedRevision:0,configuration:{...configuration,points:{...configuration.points,enabled}},reason:'Synthetic explicit reward rule choice'});
 const draft=await createDraft(ctx,{organizationId:org.id,storeId:store.id,registerId:register.id,shiftId:shift.id,customerId:customer.id,discountAmount:0,items:[{productId:product.id,quantity:3,discountAmount:0}]},randomUUID());
 return {org,ctx,customer,product,shift,store,draft,policy};
}
test('Real sale grants one immutable original lot; split returns reverse the same original policy without extra points',async()=>{
 const f=await fixture(),key=randomUUID(),payment={payments:[{paymentType:'cash' as const,amount:'300'}]};
 const [a,b]=await Promise.all([completeSale(f.ctx,f.draft.id,payment,key),completeSale(f.ctx,f.draft.id,payment,key)]);assert.equal(a.id,b.id);
 const lot=await prisma.loyaltyPointLot.findUniqueOrThrow({where:{saleId:a.id}});assert.equal(lot.initialPoints.toString(),'7');assert.equal(lot.policyVersionId,f.policy.id);assert.equal(lot.customerId,f.customer.id);
 assert.equal(lot.expiresAt!.getTime()-lot.createdAt.getTime(),30*86400000);assert.equal(await prisma.loyaltyPointLot.count({where:{saleId:a.id}}),1);
 assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'7');
 await publishLoyaltyPolicy(f.ctx,{operationId:randomUUID(),expectedRevision:1,configuration:{...configuration,points:{...configuration.points,enabled:false,earnMoneyPerPoint:'999'}},reason:'Original grant must retain previous rule'});
 const deltas=['-3','-2','-2'];
 for(let i=0;i<3;i++){
  const input={operationId:randomUUID(),shiftId:f.shift.id,reason:'Actual proportional reward return',items:[{saleItemId:a.items[0].id,quantity:1,disposition:'sellable' as const}]};
  const ret=await returnSale(f.ctx,a.id,input);assert.equal((await returnSale(f.ctx,a.id,input)).id,ret.id);
  const entry=await prisma.loyaltyPointEntry.findFirstOrThrow({where:{lotId:lot.id,returnId:ret.id}});assert.equal(entry.points.toString(),deltas[i]);
 }
 const total=await prisma.loyaltyPointEntry.aggregate({where:{lotId:lot.id},_sum:{points:true}});assert.equal((lot.initialPoints+total._sum.points!).toString(),'0');
 assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'0');
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'10');
 await assert.rejects(prisma.loyaltyPointLot.update({where:{id:lot.id},data:{initialPoints:BigInt(99)}}));
 await assert.rejects(prisma.loyaltyPointEntry.create({data:{organizationId:f.org.id,lotId:lot.id,kind:'return_earn',points:BigInt(-1),returnId:(await prisma.saleReturn.findFirstOrThrow({where:{saleId:a.id}})).id}}));
});
test('Disabled and configured credit exclusions leave financial sales unchanged without inventing reward grants',async()=>{
 const disabled=await fixture(false);await completeSale(disabled.ctx,disabled.draft.id,{payments:[{paymentType:'cash',amount:'300'}]},randomUUID());assert.equal(await prisma.loyaltyPointLot.count({where:{saleId:disabled.draft.id}}),0);
 const credit=await fixture();await completeSale(credit.ctx,credit.draft.id,{payments:[{paymentType:'credit',amount:'300'}]},randomUUID());assert.equal(await prisma.loyaltyPointLot.count({where:{saleId:credit.draft.id}}),0);assert.equal((await prisma.debtEntry.aggregate({where:{saleId:credit.draft.id},_sum:{amount:true}}))._sum.amount?.toString(),'300');
});
test('A deferred reward audit failure rolls back the financial refund, stock and original operation together',async()=>{
 const f=await fixture(),sale=await completeSale(f.ctx,f.draft.id,{payments:[{paymentType:'cash',amount:'300'}]},randomUUID()),name='loyalty_fault_'+randomUUID().replaceAll('-','');
 await prisma.$executeRawUnsafe(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${f.org.id}' AND NEW.action='loyalty_points_revoked' THEN RAISE EXCEPTION 'test-only loyalty audit fault';END IF;RETURN NEW;END $$`);
 await prisma.$executeRawUnsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${name}()`);
 const input={operationId:randomUUID(),shiftId:f.shift.id,reason:'Original refund with deferred reward fault',items:[{saleItemId:sale.items[0].id,quantity:1,disposition:'sellable' as const}]};
 try{await assert.rejects(returnSale(f.ctx,sale.id,input));}finally{await prisma.$executeRawUnsafe(`DROP TRIGGER ${name} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${name}()`);}
 assert.equal(await prisma.saleReturn.count({where:{saleId:sale.id}}),0);assert.equal(await prisma.loyaltyPointEntry.count({where:{organizationId:f.org.id}}),0);assert.equal(await prisma.operation.count({where:{organizationId:f.org.id,key:input.operationId}}),0);
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'7');
 await returnSale(f.ctx,sale.id,input);assert.equal(await prisma.saleReturn.count({where:{saleId:sale.id}}),1);assert.equal(await prisma.loyaltyPointEntry.count({where:{organizationId:f.org.id}}),1);
});
test('A settled customer alias retains one wallet and original receipt lots before and after a return',async()=>{
 const f=await fixture(),sale=await completeSale(f.ctx,f.draft.id,{payments:[{paymentType:'cash',amount:'300'}]},randomUUID());
 const target=await prisma.customer.create({data:{organizationId:f.org.id,fullName:'Canonical rewards customer',phone:randomUUID()}});
 await mergeCustomer(f.ctx,{operationId:randomUUID(),sourceCustomerId:f.customer.id,targetCustomerId:target.id,reason:'Settled alias retains source reward history'});
 assert.equal((await readPointWallet(f.ctx,target.id)).availablePoints,'7');const alias=await readPointWallet(f.ctx,f.customer.id);assert.equal(alias.customerId,target.id);assert.equal(alias.availablePoints,'7');
 const lot=await prisma.loyaltyPointLot.findUniqueOrThrow({where:{saleId:sale.id}});assert.equal(lot.customerId,f.customer.id);
 await returnSale(f.ctx,sale.id,{operationId:randomUUID(),shiftId:f.shift.id,reason:'Original return after settled alias merge',items:[{saleItemId:sale.items[0].id,quantity:1,disposition:'sellable'}]});
 assert.equal((await readPointWallet(f.ctx,target.id)).availablePoints,'4');assert.equal((await readPointWallet(f.ctx,f.customer.id)).availablePoints,'4');
 const other=await fixture(false);await assert.rejects(readPointWallet(other.ctx,target.id),{code:'CUSTOMER_NOT_FOUND'});
});
test('An earn audit failure rolls back original completion, cash, stock and grant without damaging the draft',async()=>{
 const f=await fixture(),name='loyalty_earn_fault_'+randomUUID().replaceAll('-',''),key=randomUUID();
 await prisma.$executeRawUnsafe(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${f.org.id}' AND NEW.action='loyalty_points_earned' THEN RAISE EXCEPTION 'test-only earning audit fault';END IF;RETURN NEW;END $$`);
 await prisma.$executeRawUnsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${name}()`);
 try{await assert.rejects(completeSale(f.ctx,f.draft.id,{payments:[{paymentType:'cash',amount:'300'}]},key));}finally{await prisma.$executeRawUnsafe(`DROP TRIGGER ${name} ON "AuditLog"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${name}()`);}
 assert.equal((await prisma.sale.findUniqueOrThrow({where:{id:f.draft.id}})).status,'draft');assert.equal(await prisma.payment.count({where:{saleId:f.draft.id}}),0);assert.equal(await prisma.loyaltyPointLot.count({where:{saleId:f.draft.id}}),0);
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'10');
 await completeSale(f.ctx,f.draft.id,{payments:[{paymentType:'cash',amount:'300'}]},key);assert.equal(await prisma.loyaltyPointLot.count({where:{saleId:f.draft.id}}),1);
});
test('An original signed offline cash v1 sale remains exact and does not infer a reward rule absent from its snapshot',async()=>{
 const f=await fixture();await configureOfflineCash(f.ctx,{operationId:randomUUID(),storeId:f.store.id,enabled:true,maxAmount:'1000',ttlSeconds:300,reason:'Actual isolated signed cash contract'});
 const deviceId=randomUUID(),ticket=await issueCashTicket(f.ctx,{operationId:randomUUID(),saleId:f.draft.id,deviceId});
 const input={operationId:ticket.payload.cashOperationId,leaseId:ticket.payload.id,deviceId,cashTendered:'300'};
 const sale=await commitOfflineCash(f.ctx,input);assert.equal((await commitOfflineCash(f.ctx,input)).id,sale.id);assert.equal(sale.totalAmount.toString(),'300');
 assert.equal(await prisma.payment.count({where:{saleId:sale.id}}),1);assert.equal(await prisma.loyaltyPointLot.count({where:{saleId:sale.id}}),0);
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toString(),'7');
});
test('UZS rules are not converted or applied when the organization currency changes',async()=>{
 const f=await fixture();await prisma.organization.update({where:{id:f.org.id},data:{currencyCode:'USD'}});
 await assert.rejects(publishLoyaltyPolicy(f.ctx,{operationId:randomUUID(),expectedRevision:1,configuration,reason:'Unsupported currency is not a conversion'}),{code:'LOYALTY_CURRENCY_UNSUPPORTED'});
 const sale=await completeSale(f.ctx,f.draft.id,{payments:[{paymentType:'cash',amount:'300'}]},randomUUID());assert.equal(sale.totalAmount.toString(),'300');assert.equal(await prisma.loyaltyPointLot.count({where:{saleId:sale.id}}),0);
});
