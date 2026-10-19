'use strict'
// Synthetic acceptance only: throwaway valuation migration databases.
const {randomUUID}=require('node:crypto')
const url=new URL(process.env.DATABASE_URL??'')
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.username!=='pos_test'||!/^\/pos_valuation_\d+_\d+_(clone|restore)$/.test(url.pathname))throw Error('Throwaway local valuation database required')
const {prisma}=require('@/lib/prisma')
const {createPurchaseOrder,receivePurchaseOrder}=require('@/server/purchases/orders')
const {createAccount,createExpenseCategory,postExpense}=require('@/server/finance/accounts')
const {prepareReceiptCost}=require('@/server/purchases/receipt-cost-plans')
const {previewCostApplication,applyReceiptCost}=require('@/server/purchases/cost-applications')
const {changePrices}=require('@/server/catalog/prices')
const {readProductValuationFacts}=require('@/server/inventory/valuation-facts')
const assert=require('node:assert/strict')
async function main(){
 if(process.argv.includes('--verify')){
  const org=await prisma.organization.findFirstOrThrow({where:{name:'Synthetic cost restore source'}}),member=await prisma.organizationUser.findFirstOrThrow({where:{organizationId:org.id,role:'owner'}}),session=await prisma.session.findFirstOrThrow({where:{organizationId:org.id,userId:member.userId}}),store=await prisma.store.findFirstOrThrow({where:{organizationId:org.id}}),product=await prisma.product.findFirstOrThrow({where:{organizationId:org.id}})
  const ctx={organizationId:org.id,userId:member.userId,organizationUserId:member.id,sessionId:session.id,role:'owner',storeIds:[store.id]}
  const facts=await prisma.$transaction(tx=>readProductValuationFacts(tx,ctx,product.id))
  assert.equal(facts.replay.averageCost,'1.000000');assert.equal(facts.financialReplay.averageCost,'1.000000')
  assert.equal(await prisma.receiptCostApplication.count({where:{organizationId:org.id}}),1)
  assert.equal(await prisma.receiptCostContinuation.count({where:{organizationId:org.id}}),1)
  assert.equal((await prisma.receiptCostContinuation.findFirstOrThrow({where:{organizationId:org.id}})).varianceCorrection.toFixed(),'12')
  process.stdout.write('PASS: restored real application and continuation sources replay, immutable values retained\n');return
 }
 const org=await prisma.organization.create({data:{name:'Synthetic cost restore source',phone:randomUUID()}}),user=await prisma.user.create({data:{fullName:'Synthetic cost owner',phone:randomUUID(),passwordHash:'not-a-login'}}),member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}}),store=await prisma.store.create({data:{organizationId:org.id,name:'Synthetic cost branch'}}),session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:randomUUID(),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}}),product=await prisma.product.create({data:{organizationId:org.id,name:'Synthetic cost SKU',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:2}})
 const ctx={organizationId:org.id,userId:user.id,organizationUserId:member.id,sessionId:session.id,role:'owner',storeIds:[store.id]},supplier=await prisma.supplier.create({data:{organizationId:org.id,name:'Synthetic actual source supplier'}})
 const order=await createPurchaseOrder(ctx,{operationId:randomUUID(),storeId:store.id,supplierId:supplier.id,referenceNo:randomUUID(),reason:'Native cost restore order',items:[{productId:product.id,quantity:'3',unitCost:'2'}]})
 const receipt=await receivePurchaseOrder(ctx,order.id,{operationId:randomUUID(),referenceNo:randomUUID(),reason:'Native cost restore receipt',items:[{orderItemId:order.items[0].id,quantity:'3'}]})
 const account=await createAccount(ctx,{operationId:randomUUID(),storeId:store.id,name:'Synthetic bank ledger',kind:'bank',openingBalance:'100',reason:'Synthetic actual funding'}),category=await createExpenseCategory(ctx,{operationId:randomUUID(),name:'Synthetic freight',treatment:'capitalised'}),expense=await postExpense(ctx,{operationId:randomUUID(),accountId:account.id,expenseCategoryId:category.id,amount:'12',reason:'Synthetic paid freight source'})
 const plan=await prepareReceiptCost(ctx,receipt.stockDocument.id,{operationId:randomUUID(),expenseDocumentId:expense.id,amount:'12',method:'value',reason:'Synthetic actual receipt allocation'}),preview=await previewCostApplication(ctx,plan.id)
 await applyReceiptCost(ctx,plan.id,{operationId:randomUUID(),expectedHash:preview.expectedHash,reason:'Native application to restore'})
 const input={operationId:randomUUID(),field:'costPrice',reason:'Native manual variance to restore',preview:true,items:[{productId:product.id,expected:'6',value:'1'}]},confirmation=await changePrices(ctx,input)
 await changePrices(ctx,{...input,preview:false,confirmationHash:confirmation.confirmationHash})
 process.stdout.write('PASS: actual source-backed application and subsequent variance posted in isolated clone\n')
}
main().catch(error=>{process.stderr.write('Cost restore fixture failed: '+(error.code??error.name??'ERROR')+'\n');process.exitCode=1}).finally(()=>prisma.$disconnect())
