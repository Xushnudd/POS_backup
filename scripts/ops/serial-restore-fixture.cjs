'use strict'
const {randomUUID}=require('node:crypto'),assert=require('node:assert/strict')
const url=new URL(process.env.DATABASE_URL??'')
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.username!=='pos_test'||!/^\/pos_valuation_\d+_\d+_(clone|restore)$/.test(url.pathname))throw Error('Throwaway local valuation database required')
const {prisma}=require('@/lib/prisma'),{enableSerialTracking,recordWarrantyService,readSerialHistory}=require('@/server/inventory/serials'),{createPurchaseOrder,receivePurchaseOrder}=require('@/server/purchases/orders'),{createDraft,completeSale}=require('@/server/sales/service')
async function main(){
 if(process.argv.includes('--verify')){
  const org=await prisma.organization.findFirstOrThrow({where:{name:'Synthetic serial restore source'}}),member=await prisma.organizationUser.findFirstOrThrow({where:{organizationId:org.id,role:'owner'}}),session=await prisma.session.findFirstOrThrow({where:{organizationId:org.id,userId:member.userId}}),store=await prisma.store.findFirstOrThrow({where:{organizationId:org.id}}),unit=await prisma.serialNumber.findFirstOrThrow({where:{organizationId:org.id,code:'RESTORE-SERIAL-ONE'}})
  const ctx={organizationId:org.id,userId:member.userId,organizationUserId:member.id,sessionId:session.id,role:'owner',storeIds:[store.id]},history=await readSerialHistory(ctx,unit.id,1)
  assert.equal(unit.state,'sold');assert.equal(history.eventTotal,2);assert.equal(history.warrantyTotal,1);assert.equal(history.serviceTotal,1);assert.equal(history.warranties[0].terms,'Original restore warranty');assert.equal(history.services[0].note,'Source-linked restore service')
  assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:store.id,productId:unit.productId}}})).quantity.toFixed(),'1')
  assert.equal((await prisma.payment.aggregate({where:{organizationId:org.id},_sum:{amount:true}}))._sum.amount.toFixed(),'10')
  process.stdout.write('PASS: restored actual serial, sale warranty and service preserve original unit, cash and stock\n');return
 }
 const org=await prisma.organization.create({data:{name:'Synthetic serial restore source',phone:randomUUID()}}),user=await prisma.user.create({data:{fullName:'Synthetic serial owner',phone:randomUUID(),passwordHash:'not-a-login'}}),member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}}),store=await prisma.store.create({data:{organizationId:org.id,name:'Synthetic serial branch'}}),session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:randomUUID(),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}}),product=await prisma.product.create({data:{organizationId:org.id,name:'Synthetic serial SKU',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:2}})
 const ctx={organizationId:org.id,userId:user.id,organizationUserId:member.id,sessionId:session.id,role:'owner',storeIds:[store.id]}
 await enableSerialTracking(ctx,{operationId:randomUUID(),productId:product.id,warrantyDays:365,warrantyTerms:'Original restore warranty',reason:'Actual unused serial policy'})
 const supplier=await prisma.supplier.create({data:{organizationId:org.id,name:'Serial restore source supplier'}}),order=await createPurchaseOrder(ctx,{operationId:randomUUID(),storeId:store.id,supplierId:supplier.id,referenceNo:randomUUID(),reason:'Actual serial restore order',items:[{productId:product.id,quantity:'2',unitCost:'2'}]})
 await receivePurchaseOrder(ctx,order.id,{operationId:randomUUID(),referenceNo:randomUUID(),reason:'Actual serial restore receipt',items:[{orderItemId:order.items[0].id,quantity:'2',serialInput:['RESTORE-SERIAL-ONE','RESTORE-SERIAL-TWO']}]})
 const serial=await prisma.serialNumber.findFirstOrThrow({where:{productId:product.id,code:'RESTORE-SERIAL-ONE'}}),register=await prisma.register.create({data:{storeId:store.id,name:'Serial restore register',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:member.id,openingCash:0}}),draft=await createDraft(ctx,{organizationId:org.id,storeId:store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:product.id,quantity:'1',discountAmount:0}]},randomUUID())
 await completeSale(ctx,draft.id,{payments:[{paymentType:'cash',amount:'10'}],serialSelections:[{productId:product.id,ids:[serial.id]}]},randomUUID())
 const warranty=await prisma.warranty.findFirstOrThrow({where:{serialId:serial.id}})
 await recordWarrantyService(ctx,{operationId:randomUUID(),warrantyId:warranty.id,status:'opened',note:'Source-linked restore service'})
 process.stdout.write('PASS: actual serial receipt, sale, warranty and service posted in isolated clone\n')
}
main().catch(error=>{process.stderr.write('Serial restore fixture failed: '+(error.code??error.name??'ERROR')+'\n');process.exitCode=1}).finally(()=>prisma.$disconnect())
