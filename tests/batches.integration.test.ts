import {returnSale} from '@/server/returns/service'
import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {createDraft,completeSale} from '@/server/sales/service'
import {enableBatchTracking,queryBatches,createBatchExpiryAlerts,reconcileBatchCount,readBatchCount} from '@/server/inventory/batches'
import {sendTransfer,receiveTransfer,returnTransfer,confirmStockDocument,reverseStockDocument} from '@/server/inventory/documents'
import {registerSupplierInvoice} from '@/server/purchases/suppliers'
import {creditSupplierInvoice} from '@/server/purchases/credits'
import {inventoryBusinessDate} from '@/server/inventory/batch-selection'
import {startCount} from '@/server/inventory/counts'
import {queryInventoryBatches} from '@/server/exports/queries/inventory-batches'
import {NextRequest} from 'next/server'
import {tenantExport} from '@/server/jobs/tenant-export'
const connection=new URL(process.env.DATABASE_URL??'')
if(connection.hostname!=='127.0.0.1'||connection.port!=='55439'||connection.pathname!=='/pos_test'||connection.username!=='pos_test')throw Error('Isolated test DB only')
const orgs:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
async function fixture(){
 const org=await prisma.organization.create({data:{name:'Valuation order',phone:randomUUID()}});orgs.push(org.id)
 const user=await prisma.user.create({data:{fullName:'Valuation owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id)
 const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}})
 const store=await prisma.store.create({data:{organizationId:org.id,name:'Main'}}),other=await prisma.store.create({data:{organizationId:org.id,name:'Other'}})
 const product=await prisma.product.create({data:{organizationId:org.id,name:'Valuation product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:'10',costPrice:'3'}})
 const session=await prisma.session.create({data:{userId:user.id,organizationId:org.id,tokenHash:randomUUID(),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}})
 const context:TokenPayload={userId:user.id,organizationId:org.id,organizationUserId:member.id,role:'owner',storeIds:[store.id,other.id],sessionId:session.id}
 return {org,user,product,store,other,context}
}
test('real receipt journals conserve batch stock, sale uses FEFO and expired units cannot be sold',async()=>{
 const f=await fixture()
 await enableBatchTracking(f.context,{operationId:randomUUID(),productId:f.product.id,expiryAlertDays:30,reason:'Fresh food traceability'})
 const today=inventoryBusinessDate(new Date(),'Asia/Tashkent'),day=(n:number)=>{const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
 const receive=async(code:string,qty:string,expiry:string)=>{const doc=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,documentType:'purchase',documentNo:randomUUID(),createdBy:f.user.id,note:'Original batch receipt',items:{create:{productId:f.product.id,quantity:qty,unitCost:'3',batchInput:{code,receivedOn:day(-30),expiresOn:expiry}}}}});return confirmStockDocument(f.context,doc.id)}
 await receive('Expired','5',day(-1));await receive('Early','2',day(1));await receive('Later','3',day(90))
 const register=await prisma.register.create({data:{storeId:f.store.id,name:'Batch register',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:f.context.organizationUserId,openingCash:0}})
 const sell=async(qty:string)=>{const draft=await createDraft(f.context,{organizationId:f.org.id,storeId:f.store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:f.product.id,quantity:qty,discountAmount:0}]},randomUUID());return completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:String(draft.totalAmount)}]},draft.id)}
 const sale=await sell('3'),entries=await prisma.inventoryBatchEntry.findMany({where:{movement:{sourceType:'sale',sourceId:sale.id}},include:{batch:true}})
 assert.deepEqual(entries.map(row=>[row.batch.code,row.quantityDelta.toFixed()]).sort(),[['Early','-2'],['Later','-1']])
 const alerts=await createBatchExpiryAlerts(f.org.id);assert.equal(alerts.created,1);assert.equal((await createBatchExpiryAlerts(f.org.id)).created,0)
 const report=await queryBatches(f.context,{storeId:f.store.id,state:'expired'});assert.equal(report.total,1);assert.equal(report.rows[0].quantity,'5.000000')
 await assert.rejects(sell('3'),{code:'INSUFFICIENT_VALID_BATCH_STOCK'})
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toFixed(),'7')
 assert.equal(await prisma.payment.count({where:{sale:{organizationId:f.org.id}}}),1)
 const exported=JSON.parse((await tenantExport(f.org.id,prisma,{readOnly:true})).data.toString())
 assert.equal(exported.datasets.InventoryBatch.length,3)
 assert.equal(exported.datasets.InventoryBatchEntry.length,5)
 assert.equal(exported.datasets.InventoryBatchEntry.filter((row:{quantityDelta:string})=>row.quantityDelta.startsWith('-')).length,2)
 await assert.rejects(prisma.inventoryBatchEntry.update({where:{id:entries[0].id},data:{quantityDelta:'-1'}}))
 await assert.rejects(prisma.inventoryBalance.update({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}},data:{quantity:'8'}}))
})

test('tracked multi-batch transfer receive/loss/replay preserves original source and branch stock',async()=>{
 const f=await fixture();await enableBatchTracking(f.context,{operationId:randomUUID(),productId:f.product.id,expiryAlertDays:30,reason:'Transfer traceability'})
 const today=inventoryBusinessDate(new Date(),'Asia/Tashkent'),day=(n:number)=>{const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
 for(const [code,qty,days] of [['A','2',10],['B','3',90]] as const){const doc=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,documentType:'purchase',documentNo:randomUUID(),createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:qty,unitCost:3,batchInput:{code,receivedOn:day(-1),expiresOn:day(days)}}}}});await confirmStockDocument(f.context,doc.id)}
 const transfer=await prisma.stockTransfer.create({data:{organizationId:f.org.id,fromStoreId:f.store.id,toStoreId:f.other.id,createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:'4',unitCost:3}}},include:{items:true}})
 await sendTransfer(f.context,transfer.id)
 const original=await prisma.inventoryBatchEntry.findMany({where:{movement:{sourceType:'transfer_out',sourceId:transfer.id}},include:{batch:true}}),a=original.find(row=>row.batch.code==='A')!,b=original.find(row=>row.batch.code==='B')!
 const input={operationId:randomUUID(),reason:'Actual received and damaged batches',items:[{itemId:transfer.items[0].id,quantity:'3',damagedQuantity:'1',receivedBatches:[{entryId:a.id,quantity:'1'},{entryId:b.id,quantity:'2'}],damagedBatches:[{entryId:a.id,quantity:'1'}]}]}
 await receiveTransfer(f.context,transfer.id,input);await receiveTransfer(f.context,transfer.id,input)
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toFixed(),'1')
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.other.id,productId:f.product.id}}})).quantity.toFixed(),'3')
 assert.equal(await prisma.inventoryBatchDisposition.count({where:{organizationId:f.org.id}}),1)
 assert.equal((await prisma.stockTransfer.findUniqueOrThrow({where:{id:transfer.id}})).status,'closed')
 await assert.rejects(returnTransfer(f.context,transfer.id,{operationId:randomUUID(),reason:'No transit remainder',items:[{itemId:transfer.items[0].id,quantity:'1'}]}),{code:'INVALID_STATUS'})
 const next=await prisma.stockTransfer.create({data:{organizationId:f.org.id,fromStoreId:f.store.id,toStoreId:f.other.id,createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:'1',unitCost:3}}},include:{items:true}})
 await sendTransfer(f.context,next.id)
 await receiveTransfer(f.context,next.id,{operationId:randomUUID(),reason:'Full original lot receive',items:[{itemId:next.items[0].id,quantity:'1'}]})
 assert.equal((await prisma.stockTransfer.findUniqueOrThrow({where:{id:next.id}})).status,'received')
 const archive=JSON.parse((await tenantExport(f.org.id,prisma,{readOnly:true})).data.toString())
 assert.equal(archive.datasets.InventoryBatchDisposition.length,1)
})

test('partial original batch return, damaged return and exact per-batch count are atomic and idempotent',async()=>{
 const f=await fixture();await enableBatchTracking(f.context,{operationId:randomUUID(),productId:f.product.id,expiryAlertDays:30,reason:'Return and count traceability'})
 for(const [code,qty] of [['A','2'],['B','3']]){const doc=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,documentType:'purchase',documentNo:randomUUID(),createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:qty,unitCost:3,batchInput:{code,receivedOn:'2026-01-01',expiresOn:code==='A'?'2090-01-01':'2091-01-01'}}}}});await confirmStockDocument(f.context,doc.id)}
 const register=await prisma.register.create({data:{storeId:f.store.id,name:'Return register',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:f.context.organizationUserId,openingCash:0}})
 const draft=await createDraft(f.context,{organizationId:f.org.id,storeId:f.store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:f.product.id,quantity:'3',discountAmount:0}]},randomUUID())
 await completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:String(draft.totalAmount)}]},draft.id)
 const original=await prisma.inventoryBatchEntry.findMany({where:{movement:{sourceType:'sale',sourceId:draft.id}},include:{batch:true}}),a=original.find(row=>row.batch.code==='A')!,b=original.find(row=>row.batch.code==='B')!
 const base={operationId:randomUUID(),shiftId:shift.id,reason:'Returned original batch',items:[{saleItemId:draft.items[0].id,quantity:'1',disposition:'sellable' as const}]}
 await assert.rejects(returnSale(f.context,draft.id,base),{code:'BATCH_SELECTION_REQUIRED'})
 assert.equal(await prisma.saleReturn.count({where:{saleId:draft.id}}),0)
 const valid={...base,items:[{...base.items[0],batchSelection:[{entryId:b.id,quantity:'1'}]}]};await returnSale(f.context,draft.id,valid);await returnSale(f.context,draft.id,valid)
 await returnSale(f.context,draft.id,{...base,operationId:randomUUID(),items:[{...base.items[0],disposition:'damaged',batchSelection:[{entryId:a.id,quantity:'1'}]}]})
 const snapshot=await readBatchCount(f.context,f.store.id,f.product.id)
 const count={operationId:randomUUID(),storeId:f.store.id,expectedHash:snapshot.expectedHash,reason:'Actual per-batch physical count',counts:snapshot.rows.map(row=>({batchId:row.id,quantity:row.code==='A'?'1':'2'}))}
 const first=await reconcileBatchCount(f.context,f.product.id,count),again=await reconcileBatchCount(f.context,f.product.id,count);assert.deepEqual(first,again);assert.equal(first.documents.length,2)
 const after=await readBatchCount(f.context,f.store.id,f.product.id);assert.deepEqual(after.rows.map(row=>[row.code,row.quantity]).sort(),[['A','1.000000'],['B','2.000000']])
 await assert.rejects(reconcileBatchCount(f.context,f.product.id,{...count,operationId:randomUUID()}),{code:'BATCH_COUNT_CHANGED'})
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toFixed(),'3')
 assert.equal(await prisma.auditLog.count({where:{organizationId:f.org.id,action:'batch_count_reconciled'}}),1)
})

test('expiry predicates precede paging, full CSV and branch isolation; competing sales conserve final batch',async()=>{
 const f=await fixture();await enableBatchTracking(f.context,{operationId:randomUUID(),productId:f.product.id,expiryAlertDays:30,reason:'Expiry report acceptance'})
 const today=inventoryBusinessDate(new Date(),'Asia/Tashkent'),day=(offset:number)=>{const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)}
 const start=performance.now()
 for(let n=0;n<53;n++){
  const doc=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,documentType:'purchase',documentNo:randomUUID(),createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:1,unitCost:3,batchInput:{code:n===0?'=unsafe':'EXPIRED-'+n,receivedOn:day(-30),expiresOn:day(-1)}}}}})
  await confirmStockDocument(f.context,doc.id)
 }
 const doc=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,documentType:'purchase',documentNo:randomUUID(),createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:1,unitCost:3,batchInput:{code:'LAST-VALID',receivedOn:day(-1),expiresOn:day(10)}}}}})
 await confirmStockDocument(f.context,doc.id)
 const first=await queryBatches(f.context,{storeId:f.store.id,state:'expired'}),second=await queryBatches(f.context,{storeId:f.store.id,state:'expired',page:2})
 assert.equal(first.total,53);assert.equal(first.rows.length,50);assert.equal(second.rows.length,3)
 assert.equal(new Set([...first.rows,...second.rows].map(row=>row.id)).size,53)
 const due=await queryBatches(f.context,{storeId:f.store.id,state:'due_soon'});assert.equal(due.total,1);assert.equal(due.rows[0].code,'LAST-VALID')
 const response=await queryInventoryBatches(f.context,new NextRequest('https://localhost/api/inventory/batches?'+new URLSearchParams({storeId:f.store.id,state:'expired',page:'2',format:'csv'})))
 const body=await response.json();assert.equal(body.data.content.trim().split('\r\n').length,54);assert.match(body.data.content,/'=unsafe/);assert.doesNotMatch(body.data.content,/LAST-VALID/)
 const other=await fixture();await assert.rejects(queryBatches(other.context,{storeId:f.store.id}),{code:'STORE_NOT_FOUND'})
 await prisma.organizationUser.update({where:{id:f.context.organizationUserId},data:{role:'admin'}})
 await prisma.userStore.create({data:{organizationUserId:f.context.organizationUserId,storeId:f.other.id}})
 const scoped={...f.context,role:'admin' as const,storeIds:[f.other.id]};await assert.rejects(queryBatches(scoped,{storeId:f.store.id}),{code:'STORE_NOT_FOUND'})
 await prisma.organizationUser.update({where:{id:f.context.organizationUserId},data:{role:'owner'}})
 await assert.rejects(startCount(f.context,{operationId:randomUUID(),organizationId:f.org.id,storeId:f.store.id,scope:'partial',blind:true,productIds:[f.product.id]}),{code:'BATCH_COUNT_REQUIRED'})
 assert.equal(await prisma.stockFreeze.count({where:{storeId:f.store.id}}),0)
 const register=await prisma.register.create({data:{storeId:f.store.id,name:'Concurrent batch',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:register.id,organizationUserId:f.context.organizationUserId,openingCash:0}})
 const drafts=await Promise.all([1,2].map(()=>createDraft(f.context,{organizationId:f.org.id,storeId:f.store.id,registerId:register.id,shiftId:shift.id,discountAmount:0,items:[{productId:f.product.id,quantity:1,discountAmount:0}]},randomUUID())))
 const results=await Promise.allSettled(drafts.map(draft=>completeSale(f.context,draft.id,{payments:[{paymentType:'cash',amount:'10'}]},draft.id)))
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1)
 assert.equal(await prisma.payment.count({where:{sale:{organizationId:f.org.id}}}),1)
 assert.equal((await queryBatches(f.context,{storeId:f.store.id,state:'due_soon'})).total,0)
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toFixed(),'53')
 console.info(JSON.stringify({event:'batch_acceptance_profile',receipts:54,expiredRows:53,elapsedMs:Math.round(performance.now()-start)}))
})

test('supplier goods return targets original expired lot and receipt reversal restores no invented batch',async()=>{
 const f=await fixture();await enableBatchTracking(f.context,{operationId:randomUUID(),productId:f.product.id,expiryAlertDays:30,reason:'Supplier original lot'})
 const today=inventoryBusinessDate(new Date(),'Asia/Tashkent'),day=(n:number)=>{const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
 const supplier=await prisma.supplier.create({data:{organizationId:f.org.id,name:'Batch supplier'}})
 const doc=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,supplierId:supplier.id,documentType:'purchase',documentNo:randomUUID(),createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:4,unitCost:3,batchInput:{code:'SUPPLIER-EXPIRED',receivedOn:day(-30),expiresOn:day(-1)}}}},include:{items:true}})
 await confirmStockDocument(f.context,doc.id)
 const invoice=await registerSupplierInvoice(f.context,{operationId:randomUUID(),supplierId:supplier.id,stockDocumentId:doc.id,referenceNo:'BATCH-INVOICE',reason:'Actual supplier purchase',expectedAmount:'12'})
 const input={operationId:randomUUID(),kind:'goods_return' as const,reason:'Original expired supplier lot',items:[{stockDocumentItemId:doc.items[0].id,quantity:'1'}],expectedAmount:'3',expectedInvoiceNet:'12'}
 const credit=await creditSupplierInvoice(f.context,invoice.id,input);await creditSupplierInvoice(f.context,invoice.id,input)
 assert.ok('id' in credit)
 assert.equal(await prisma.inventoryMovement.count({where:{sourceType:'supplier_return',sourceId:credit.id}}),1)
 assert.equal((await queryBatches(f.context,{storeId:f.store.id,state:'expired'})).rows[0].quantity,'3.000000')
 const opening=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,documentType:'purchase',documentNo:randomUUID(),createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:2,unitCost:3,batchInput:{code:'OPENING-VALID',receivedOn:today,expiresOn:day(10)}}}}})
 await confirmStockDocument(f.context,opening.id)
 const reversal=await reverseStockDocument(f.context,opening.id,{operationId:randomUUID(),reason:'Reverse actual opening lot'})
 assert.equal(await prisma.inventoryBatchEntry.count({where:{movement:{sourceType:'stock_reversal',sourceId:reversal.id}}}),1)
 assert.equal((await queryBatches(f.context,{storeId:f.store.id})).total,1)
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:f.store.id,productId:f.product.id}}})).quantity.toFixed(),'3')
})

test('Batch list global expiry/code order and bounded pages retain FEFO source journals and filtered export',async()=>{
 const f=await fixture();await enableBatchTracking(f.context,{operationId:randomUUID(),productId:f.product.id,expiryAlertDays:30,reason:'Actual unused SKU list traceability'});
 const today=inventoryBusinessDate(new Date(),'Asia/Tashkent'),day=(n:number)=>{const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 for(let i=0;i<43;i++){
  const doc=await prisma.stockDocument.create({data:{organizationId:f.org.id,storeId:f.store.id,documentType:'purchase',documentNo:randomUUID(),createdBy:f.user.id,items:{create:{productId:f.product.id,quantity:'1',unitCost:'3',batchInput:{code:'LIST-'+String(i).padStart(3,'0'),receivedOn:today,expiresOn:day(60+i)}}}}});await confirmStockDocument(f.context,doc.id);
 }
 const codes:string[]=[];
 for(let page=1;page<=3;page++){const result=await queryBatches(f.context,{storeId:f.store.id,page,limit:20,sort:'expiry_desc',search:'LIST-'});assert.equal(result.total,43);assert.equal(result.limit,20);codes.push(...result.rows.map(row=>row.code));}
 assert.deepEqual(codes,Array.from({length:43},(_,i)=>'LIST-'+String(42-i).padStart(3,'0')));
 assert.equal((await queryBatches(f.context,{storeId:f.store.id,search:'NO-SUCH-BATCH'})).total,0);
 assert.equal((await queryBatches(f.context,{storeId:f.store.id})).limit,50);
 const exported=await queryInventoryBatches(f.context,new NextRequest('http://localhost:3000/api/inventory/batches?'+new URLSearchParams({storeId:f.store.id,search:'LIST-',sort:'expiry_desc',format:'csv',page:'3'})));
 const text=(await exported.json()).data.content as string;assert.equal(text.split('\r\n').filter(Boolean).length,44);assert.ok(text.indexOf('LIST-042')<text.indexOf('LIST-000'));
 assert.equal(await prisma.inventoryBatchEntry.count({where:{organizationId:f.org.id}}),43);
 await assert.rejects(queryBatches(f.context,{storeId:f.store.id,limit:201}));
 await assert.rejects(queryBatches(f.context,{storeId:f.store.id,sort:'costPrice' as 'code'}));
});
