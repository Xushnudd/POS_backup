'use strict'
const {randomUUID}=require('node:crypto'),assert=require('node:assert/strict')
const url=new URL(process.env.DATABASE_URL??'')
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.username!=='pos_test'||!/^\/pos_valuation_\d+_\d+_(clone|restore)$/.test(url.pathname))throw Error('Throwaway local loyalty database required')
const {prisma}=require('@/lib/prisma'),{publishLoyaltyPolicy}=require('@/server/loyalty/policy'),{readPointWallet}=require('@/server/loyalty/wallet'),{preparePointRedemption}=require('@/server/loyalty/redemption'),{createDraft,completeSale}=require('@/server/sales/service'),{returnSale}=require('@/server/returns/service')
async function main(){
 if(process.argv.includes('--verify')){
  const org=await prisma.organization.findFirstOrThrow({where:{name:'Synthetic loyalty restore source'}}),member=await prisma.organizationUser.findFirstOrThrow({where:{organizationId:org.id,role:'owner'}}),session=await prisma.session.findFirstOrThrow({where:{organizationId:org.id,userId:member.userId}}),customer=await prisma.customer.findFirstOrThrow({where:{organizationId:org.id}}),lot=await prisma.loyaltyPointLot.findFirstOrThrow({where:{organizationId:org.id}})
  const ctx={organizationId:org.id,userId:member.userId,organizationUserId:member.id,sessionId:session.id,role:'owner',storeIds:[]}
  assert.equal(lot.initialPoints.toString(),'7');assert.equal((await readPointWallet(ctx,customer.id)).availablePoints,'6')
  const entries=await prisma.loyaltyPointEntry.findMany({where:{lotId:lot.id}});assert.equal(entries.filter(entry=>entry.kind==='redeem').length,1);assert.equal(entries.filter(entry=>entry.kind==='return_earn').length,2);assert.equal(entries.filter(entry=>entry.kind==='return_redeem').length,1);assert.equal(await prisma.loyaltyRedemption.count({where:{organizationId:org.id,state:'posted'}}),1);assert.equal((await prisma.loyaltyRecoveryTransfer.findFirstOrThrow({where:{organizationId:org.id}})).points.toString(),'1')
  await assert.rejects(prisma.loyaltyPointLot.update({where:{id:lot.id},data:{initialPoints:BigInt(99)}}))
  process.stdout.write('PASS: restored actual policy, original earned lot and proportional refund retain one wallet and native guards\n');return
 }
 const org=await prisma.organization.create({data:{name:'Synthetic loyalty restore source',phone:randomUUID()}}),user=await prisma.user.create({data:{fullName:'Synthetic loyalty owner',phone:randomUUID(),passwordHash:'not-a-login'}}),member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}}),store=await prisma.store.create({data:{organizationId:org.id,name:'Synthetic loyalty branch'}}),session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:randomUUID(),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 const ctx={organizationId:org.id,userId:user.id,organizationUserId:member.id,sessionId:session.id,role:'owner',storeIds:[]}
 const configuration={points:{enabled:true,earnMoneyPerPoint:'40',redeemMoneyPerPoint:'1',maxRedeemPercent:'10',minEligibleNet:'0',expiryDays:30,earnOnDiscountedSales:false,earnOnCreditSales:false},cards:{enabled:false,discountPercent:'0',validityDays:null},promos:{enabled:false,allowStackingWithCard:false,allowStackingWithPoints:false},gifts:{enabled:false,minIssueAmount:'1000',maxIssueAmount:'1000000',validityDays:null,allowUnusedCashRefund:false}}
 const policy=await publishLoyaltyPolicy(ctx,{operationId:randomUUID(),expectedRevision:0,configuration,reason:'Actual isolated source-linked bonus policy'})
 const product=await prisma.product.create({data:{organizationId:org.id,name:'Loyalty restore SKU',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:100,costPrice:50}}),customer=await prisma.customer.create({data:{organizationId:org.id,fullName:'Loyalty restore customer',phone:randomUUID()}}),register=await prisma.register.create({data:{storeId:store.id,name:'Loyalty restore till',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}})
 await prisma.inventoryBalance.create({data:{storeId:store.id,productId:product.id,quantity:10}})
 const draft=await createDraft(ctx,{organizationId:org.id,storeId:store.id,registerId:register.id,shiftId:shift.id,customerId:customer.id,discountAmount:0,items:[{productId:product.id,quantity:3,discountAmount:0}]},randomUUID()),sale=await completeSale(ctx,draft.id,{payments:[{paymentType:'cash',amount:'300'}]},randomUUID())
 await returnSale(ctx,sale.id,{operationId:randomUUID(),shiftId:shift.id,reason:'Actual original loyalty return',items:[{saleItemId:sale.items[0].id,quantity:1,disposition:'sellable'}]})
 assert.equal((await readPointWallet(ctx,customer.id)).availablePoints,'4')
 const draftInput={organizationId:org.id,storeId:store.id,registerId:register.id,shiftId:shift.id,customerId:customer.id,discountAmount:0,items:[{productId:product.id,quantity:3,discountAmount:0}]}
 const spending=await createDraft(ctx,draftInput,randomUUID())
 await preparePointRedemption(ctx,spending.id,{operationId:randomUUID(),policyVersionId:policy.id,points:'4',customerConsent:true,reason:'Actual original restore point redemption'})
 const spent=await completeSale(ctx,spending.id,{payments:[{paymentType:'cash',amount:'296'}]},randomUUID())
 await returnSale(ctx,spent.id,{operationId:randomUUID(),shiftId:shift.id,reason:'Actual original point restoration',items:[{saleItemId:spent.items[0].id,quantity:1,disposition:'sellable'}]})
 await returnSale(ctx,sale.id,{operationId:randomUUID(),shiftId:shift.id,reason:'Actual spent earning clawback',items:[{saleItemId:sale.items[0].id,quantity:1,disposition:'sellable'}]})
 const future=await createDraft(ctx,draftInput,randomUUID());await completeSale(ctx,future.id,{payments:[{paymentType:'cash',amount:'300'}]},randomUUID())
 assert.equal((await readPointWallet(ctx,customer.id)).availablePoints,'6')
 process.stdout.write('PASS: real source-linked bonus earned and proportionally reversed in isolated clone\n')
}
main().catch(error=>{process.stderr.write('Loyalty restore fixture failed: '+(error.code??error.name??'ERROR')+'\n');process.exitCode=1}).finally(()=>prisma.$disconnect())
