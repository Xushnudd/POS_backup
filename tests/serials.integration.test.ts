import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {NextRequest} from 'next/server'
import {prisma} from '@/lib/prisma'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {POST as register} from '@/app/api/auth/register/route'
import {enableSerialTracking,recordWarrantyService,listSerials} from '@/server/inventory/serials'
import {createPurchaseOrder,receivePurchaseOrder} from '@/server/purchases/orders'
import {createDraft,completeSale} from '@/server/sales/service'
import {returnSale} from '@/server/returns/service'
import {sendTransfer,receiveTransfer} from '@/server/inventory/documents'
const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test')throw Error('Isolated DB only')
const orgs:string[]=[],users:string[]=[]
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect()})
async function fixture(){
 const req=new NextRequest('http://localhost:3000/api/auth/register',{method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify({phone:'serial-'+randomUUID(),password:'test-only-password',fullName:'Serial owner',organizationName:'Serial synthetic'})})
 const res=await register(req,undefined);assert.equal(res.status,200);const data=(await res.json()).data;orgs.push(data.organization.id);users.push(data.user.id)
 const cookie=res.headers.get('set-cookie')!.split(';')[0],verified=await verifyToken(getRequestToken(new NextRequest('http://localhost:3000/api/products',{headers:{cookie}}))!);assert.ok(verified);const ctx=verified!
 const store=await prisma.store.findFirstOrThrow({where:{organizationId:ctx.organizationId}}),product=await prisma.product.create({data:{organizationId:ctx.organizationId,name:'Actual serial product',sku:randomUUID(),barcode:randomUUID(),unit:'dona',salePrice:10,costPrice:2}})
 await enableSerialTracking(ctx,{operationId:randomUUID(),productId:product.id,warrantyDays:365,warrantyTerms:'Original one-year terms',reason:'Unused integer SKU serial tracking'})
 const supplier=await prisma.supplier.create({data:{organizationId:ctx.organizationId,name:'Serial source supplier'}})
 const order=await createPurchaseOrder(ctx,{operationId:randomUUID(),storeId:store.id,supplierId:supplier.id,referenceNo:randomUUID(),reason:'Actual serial purchase',items:[{productId:product.id,quantity:'2',unitCost:'2'}]})
 const input={operationId:randomUUID(),referenceNo:randomUUID(),reason:'Actual two unit receipt',items:[{orderItemId:order.items[0].id,quantity:'2',serialInput:['SER-A','SER-B']}]}
 const receipt=await receivePurchaseOrder(ctx,order.id,input)
 await receivePurchaseOrder(ctx,order.id,input)
 const serials=await prisma.serialNumber.findMany({where:{productId:product.id},orderBy:{code:'asc'}})
 const reg=await prisma.register.create({data:{storeId:store.id,name:'Serial register',code:randomUUID()}}),shift=await prisma.shift.create({data:{registerId:reg.id,organizationUserId:ctx.organizationUserId,openingCash:0}})
 async function draft(){return createDraft(ctx,{organizationId:ctx.organizationId,storeId:store.id,registerId:reg.id,shiftId:shift.id,discountAmount:0,items:[{productId:product.id,quantity:'1',discountAmount:0}]},randomUUID())}
 return {ctx,store,product,serials,shift,draft,receipt,order}
}
test('Actual serial receipt/sale/warranty/service/return/resale preserves original unit and immutable terms',async()=>{
 const a=await fixture();assert.equal(a.serials.length,2);assert.equal(await prisma.serialEvent.count({where:{productId:a.product.id}}),2)
 const draft=await a.draft(),key=randomUUID(),input={payments:[{paymentType:'cash' as const,amount:'10'}],serialSelections:[{productId:a.product.id,ids:[a.serials[0].id]}]}
 const sale=await completeSale(a.ctx,draft.id,input,key);await completeSale(a.ctx,draft.id,input,key)
 const warranty=await prisma.warranty.findFirstOrThrow({where:{serialId:a.serials[0].id}});assert.equal(warranty.saleItemId,sale.items[0].id);assert.equal(warranty.terms,'Original one-year terms');assert.equal(warranty.endsAt.getTime()-warranty.startedAt.getTime(),365*86400000)
 await enableSerialTracking(a.ctx,{operationId:randomUUID(),productId:a.product.id,warrantyDays:10,warrantyTerms:'New terms only for later sale',reason:'Future warranty policy'})
 assert.equal((await prisma.warranty.findUniqueOrThrow({where:{id:warranty.id}})).terms,'Original one-year terms')
 const open={operationId:randomUUID(),warrantyId:warranty.id,status:'opened' as const,note:'Original-unit repair request'};await recordWarrantyService(a.ctx,open);await recordWarrantyService(a.ctx,open)
 await recordWarrantyService(a.ctx,{...open,operationId:randomUUID(),status:'resolved',note:'Actual repair resolution'});assert.equal(await prisma.warrantyService.count({where:{warrantyId:warranty.id}}),2)
 const ret={operationId:randomUUID(),shiftId:a.shift.id,reason:'Original unit returned',items:[{saleItemId:sale.items[0].id,quantity:'1',disposition:'sellable' as const,serialIds:[a.serials[0].id]}]}
 await returnSale(a.ctx,sale.id,ret);await returnSale(a.ctx,sale.id,ret)
 await assert.rejects(recordWarrantyService(a.ctx,{...open,operationId:randomUUID()}),{code:'WARRANTY_ORIGINAL_SALE_REQUIRED'})
 const next=await a.draft();await completeSale(a.ctx,next.id,input,randomUUID());assert.equal(await prisma.warranty.count({where:{serialId:a.serials[0].id}}),2)
 const current=await prisma.warranty.findFirstOrThrow({where:{serialId:a.serials[0].id,saleItemId:next.items[0].id}});assert.equal(current.terms,'New terms only for later sale')
 await assert.rejects(prisma.warranty.update({where:{id:warranty.id},data:{terms:'forged'}}))
 assert.equal((await listSerials(a.ctx,{storeId:a.store.id,page:1})).total,2)
})
test('Serial selection rejects wrong original unit, double sale and fractional quantity without money or stock effects',async()=>{
 const a=await fixture(),draft=await a.draft()
 await assert.rejects(completeSale(a.ctx,draft.id,{payments:[{paymentType:'cash',amount:'10'}]},randomUUID()),{code:'SERIAL_SELECTION_REQUIRED'})
 const input={payments:[{paymentType:'cash' as const,amount:'10'}],serialSelections:[{productId:a.product.id,ids:[a.serials[0].id]}]}
 const sale=await completeSale(a.ctx,draft.id,input,randomUUID())
 await assert.rejects(returnSale(a.ctx,sale.id,{operationId:randomUUID(),shiftId:a.shift.id,reason:'Wrong original serial test',items:[{saleItemId:sale.items[0].id,quantity:'1',disposition:'sellable',serialIds:[a.serials[1].id]}]}),{code:'SERIAL_SELECTION_REQUIRED'})
 await assert.rejects(createDraft(a.ctx,{organizationId:a.ctx.organizationId,storeId:a.store.id,registerId:a.shift.registerId,shiftId:a.shift.id,discountAmount:0,items:[{productId:a.product.id,quantity:'0.5',discountAmount:0}]},randomUUID()),{code:'INVALID_UNIT_PRECISION'})
 const other=await a.draft();await assert.rejects(completeSale(a.ctx,other.id,input,randomUUID()),{code:'SERIAL_SELECTION_REQUIRED'})
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:a.store.id,productId:a.product.id}}})).quantity.toFixed(),'1');assert.equal(await prisma.warranty.count({where:{productId:a.product.id}}),1)
 await assert.rejects(prisma.serialNumber.update({where:{id:a.serials[1].id},data:{state:'sold'}}))
 await assert.rejects(prisma.inventoryBalance.update({where:{storeId_productId:{storeId:a.store.id,productId:a.product.id}},data:{quantity:2}}))
})
test('Exact transfer serial selection follows original unit across branches and partial receive is idempotent',async()=>{
 const a=await fixture(),other=await prisma.store.create({data:{organizationId:a.ctx.organizationId,name:'Serial destination'}})
 const transfer=await prisma.stockTransfer.create({data:{organizationId:a.ctx.organizationId,fromStoreId:a.store.id,toStoreId:other.id,createdBy:a.ctx.userId,items:{create:{productId:a.product.id,quantity:2,unitCost:2,serialInput:a.serials.map(s=>s.id)}}},include:{items:true}})
 await sendTransfer(a.ctx,transfer.id)
 const input={operationId:randomUUID(),items:[{itemId:transfer.items[0].id,quantity:'1',receivedSerials:[a.serials[0].id]}]};await receiveTransfer(a.ctx,transfer.id,input);await receiveTransfer(a.ctx,transfer.id,input)
 assert.equal((await prisma.serialNumber.findUniqueOrThrow({where:{id:a.serials[0].id}})).storeId,other.id)
 assert.equal((await prisma.serialNumber.findUniqueOrThrow({where:{id:a.serials[1].id}})).state,'transit')
 await receiveTransfer(a.ctx,transfer.id,{operationId:randomUUID()})
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:other.id,productId:a.product.id}}})).quantity.toFixed(),'2')
})
test('Concurrent checkouts of one serial have one winner, exact cash and one warranty',async()=>{
 const a=await fixture(),one=await a.draft(),two=await a.draft(),input={payments:[{paymentType:'cash' as const,amount:'10'}],serialSelections:[{productId:a.product.id,ids:[a.serials[0].id]}]}
 const results=await Promise.allSettled([completeSale(a.ctx,one.id,input,randomUUID()),completeSale(a.ctx,two.id,input,randomUUID())])
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(await prisma.warranty.count({where:{serialId:a.serials[0].id}}),1)
 assert.equal((await prisma.payment.aggregate({where:{organizationId:a.ctx.organizationId},_sum:{amount:true}}))._sum.amount?.toFixed(),'10')
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:a.store.id,productId:a.product.id}}})).quantity.toFixed(),'1')
})
test('Serial damaged and write-off returns retire the exact sold units, no available stock is invented',async()=>{
 const a=await fixture()
 for(const [index,disposition] of ['damaged','write_off'].entries()){
  const draft=await a.draft(),sale=await completeSale(a.ctx,draft.id,{payments:[{paymentType:'cash',amount:'10'}],serialSelections:[{productId:a.product.id,ids:[a.serials[index].id]}]},randomUUID())
  const input={operationId:randomUUID(),shiftId:a.shift.id,reason:'Actual serial disposition',items:[{saleItemId:sale.items[0].id,quantity:'1',disposition:disposition as 'damaged'|'write_off',serialIds:[a.serials[index].id]}]}
  await returnSale(a.ctx,sale.id,input);await returnSale(a.ctx,sale.id,input)
  assert.equal((await prisma.serialNumber.findUniqueOrThrow({where:{id:a.serials[index].id}})).state,index===0?'damaged':'retired')
 }
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:a.store.id,productId:a.product.id}}})).quantity.toFixed(),'0')
 assert.equal((await prisma.payment.aggregate({where:{organizationId:a.ctx.organizationId,direction:'out'},_sum:{amount:true}}))._sum.amount?.toFixed(),'20')
})
test('Late warranty journal fault rolls back sale, serial state, money and original operation; exact retry posts once',async()=>{
 const a=await fixture(),draft=await a.draft(),key=randomUUID(),input={payments:[{paymentType:'cash' as const,amount:'10'}],serialSelections:[{productId:a.product.id,ids:[a.serials[0].id]}]},trigger='serial_fault_'+randomUUID().replaceAll('-','')
 await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${a.ctx.organizationId}' THEN RAISE EXCEPTION 'test-only warranty fault'; END IF; RETURN NEW; END $$`)
 await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "Warranty" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`)
 try{
  await assert.rejects(completeSale(a.ctx,draft.id,input,key))
  assert.equal((await prisma.serialNumber.findUniqueOrThrow({where:{id:a.serials[0].id}})).state,'available')
  assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:a.store.id,productId:a.product.id}}})).quantity.toFixed(),'2')
  assert.equal(await prisma.payment.count({where:{saleId:draft.id}}),0);assert.equal(await prisma.operation.count({where:{organizationId:a.ctx.organizationId,key}}),0)
 }finally{await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "Warranty"`);await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`)}
 await completeSale(a.ctx,draft.id,input,key);await completeSale(a.ctx,draft.id,input,key)
 assert.equal(await prisma.warranty.count({where:{serialId:a.serials[0].id}}),1)
})
test('Serial loss reversal restores the original unit; supplier goods return retires only its original receipt serial',async()=>{
 const {confirmStockDocument,reverseStockDocument}=await import('@/server/inventory/documents'),{creditSupplierInvoice}=await import('@/server/purchases/credits')
 const a=await fixture(),loss=await prisma.stockDocument.create({data:{organizationId:a.ctx.organizationId,storeId:a.store.id,documentType:'adjustment',documentNo:randomUUID(),createdBy:a.ctx.userId,note:'Actual serial loss',items:{create:{productId:a.product.id,quantity:-1,unitCost:2,serialInput:[a.serials[0].id]}}}})
 await confirmStockDocument(a.ctx,loss.id);assert.equal((await prisma.serialNumber.findUniqueOrThrow({where:{id:a.serials[0].id}})).state,'retired')
 const key=randomUUID();await reverseStockDocument(a.ctx,loss.id,{operationId:key,reason:'Original actual loss reversed'});await reverseStockDocument(a.ctx,loss.id,{operationId:key,reason:'Original actual loss reversed'})
 assert.equal((await prisma.serialNumber.findUniqueOrThrow({where:{id:a.serials[0].id}})).state,'available')
 const invoice=a.receipt.invoice,original=a.receipt.stockDocument.items[0],input={operationId:randomUUID(),kind:'goods_return' as const,reason:'Actual original serial supplier return',items:[{stockDocumentItemId:original.id,quantity:'1',serialIds:[a.serials[1].id]}]}
 const quote=await creditSupplierInvoice(a.ctx,invoice.id,input,true);assert.ok('invoiceNet' in quote);const posted={...input,expectedAmount:quote.amount.toFixed(2),expectedInvoiceNet:quote.invoiceNet.toFixed(2)}
 await creditSupplierInvoice(a.ctx,invoice.id,posted);await creditSupplierInvoice(a.ctx,invoice.id,posted)
 assert.equal((await prisma.serialNumber.findUniqueOrThrow({where:{id:a.serials[1].id}})).state,'retired')
 assert.equal((await prisma.inventoryBalance.findUniqueOrThrow({where:{storeId_productId:{storeId:a.store.id,productId:a.product.id}}})).quantity.toFixed(),'1')
})
test('Native owner policy/identity guards, branch and tenant service boundaries remain fail-closed',async()=>{
 const a=await fixture(),foreign=await fixture()
 await assert.rejects(prisma.product.update({where:{id:a.product.id},data:{serialTracking:false}}))
 await assert.rejects(prisma.product.update({where:{id:a.product.id},data:{warrantyDays:999}}))
 await assert.rejects(listSerials(foreign.ctx,{storeId:a.store.id,page:1}),{code:'NOT_FOUND'})
 const draft=await a.draft(),sale=await completeSale(a.ctx,draft.id,{payments:[{paymentType:'cash',amount:'10'}],serialSelections:[{productId:a.product.id,ids:[a.serials[0].id]}]},randomUUID()),warranty=await prisma.warranty.findFirstOrThrow({where:{saleItemId:sale.items[0].id}})
 await assert.rejects(recordWarrantyService(foreign.ctx,{operationId:randomUUID(),warrantyId:warranty.id,status:'opened',note:'Foreign service rejected'}),{code:'NOT_FOUND'})
 await prisma.organizationUser.update({where:{id:a.ctx.organizationUserId},data:{role:'cashier'}})
 const cashier={...a.ctx,role:'cashier'}
 await assert.rejects(recordWarrantyService(cashier,{operationId:randomUUID(),warrantyId:warranty.id,status:'opened',note:'Cashier cannot service'}),{code:'MANAGER_REQUIRED'})
 const data=await listSerials(cashier,{storeId:a.store.id,page:1});assert.ok(data.data.every(row=>!('warranties' in row)&&!('events' in row)&&!('lastSaleItemId' in row)))
 await assert.rejects(enableSerialTracking(cashier,{operationId:randomUUID(),productId:a.product.id,warrantyDays:1,warrantyTerms:'forged',reason:'Cashier cannot policy'}),{code:'OWNER_REQUIRED'})
})
test('Atomic serialized exchange keeps return-before-resale native order and binds a new warranty without duplicating cash',async()=>{
 const {previewExchange,postExchange}=await import('@/server/returns/exchanges'),a=await fixture(),draft=await a.draft(),original=await completeSale(a.ctx,draft.id,{payments:[{paymentType:'cash',amount:'10'}],serialSelections:[{productId:a.product.id,ids:[a.serials[0].id]}]},randomUUID())
 const input={originalSaleId:original.id,shiftId:a.shift.id,reason:'Actual same-unit serialized exchange',items:[{saleItemId:original.items[0].id,quantity:'1',disposition:'sellable' as const,serialIds:[a.serials[0].id]}],replacement:{discountAmount:0,items:[{productId:a.product.id,quantity:'1',discountAmount:0}]},creditAmount:0,serialSelections:[{productId:a.product.id,ids:[a.serials[0].id]}]}
 const review=await previewExchange(a.ctx,input),posted={...input,operationId:randomUUID(),confirmationHash:review.confirmationHash,cashTendered:0}
 await postExchange(a.ctx,posted);await postExchange(a.ctx,posted)
 const events=await prisma.serialEvent.findMany({where:{serialId:a.serials[0].id},orderBy:{ordinal:'asc'}})
 assert.deepEqual(events.map(e=>e.kind),['receipt','sale','return','sale']);assert.deepEqual(events.map(e=>e.ordinal),[1,2,3,4]);assert.equal(events[2].createdAt.getTime(),events[3].createdAt.getTime())
 assert.equal(await prisma.warranty.count({where:{serialId:a.serials[0].id}}),2)
 assert.equal((await prisma.payment.aggregate({where:{organizationId:a.ctx.organizationId,direction:'in'},_sum:{amount:true}}))._sum.amount?.toFixed(),'20');assert.equal((await prisma.payment.aggregate({where:{organizationId:a.ctx.organizationId,direction:'out'},_sum:{amount:true}}))._sum.amount?.toFixed(),'10')
})

test('Actual source-linked serial list global code order, pages and defaults retain original receipt provenance',async()=>{
 const a=await fixture(),supplier=await prisma.supplier.create({data:{organizationId:a.ctx.organizationId,name:'Paged serial source supplier'}});
 const order=await createPurchaseOrder(a.ctx,{operationId:randomUUID(),storeId:a.store.id,supplierId:supplier.id,referenceNo:randomUUID(),reason:'Actual paged original serial source',items:[{productId:a.product.id,quantity:'43',unitCost:'2'}]});
 const codes=Array.from({length:43},(_,i)=>'PAGE-'+String(i).padStart(3,'0'));
 const received=await receivePurchaseOrder(a.ctx,order.id,{operationId:randomUUID(),referenceNo:randomUUID(),reason:'Actual source linked paged serial receipt',items:[{orderItemId:order.items[0].id,quantity:'43',serialInput:codes}]});
 const collected:string[]=[];
 for(let page=1;page<=3;page++){
  const result=await listSerials(a.ctx,{storeId:a.store.id,page,limit:20,sort:'code_desc',search:'PAGE-'});assert.equal(result.total,43);assert.equal(result.limit,20);collected.push(...result.data.map(row=>row.code));
 }
 assert.deepEqual(collected,codes.slice().reverse());
 assert.equal((await listSerials(a.ctx,{storeId:a.store.id,page:1})).limit,50);
 assert.equal((await listSerials(a.ctx,{storeId:a.store.id,page:1,search:'NO-SUCH-SERIAL'})).total,0);
 assert.equal(await prisma.serialEvent.count({where:{sourceId:received.stockDocument.id,kind:'receipt'}}),43);
 await assert.rejects(listSerials(a.ctx,{storeId:a.store.id,page:1,limit:201}));
 await assert.rejects(listSerials(a.ctx,{storeId:a.store.id,page:1,sort:'unitCost' as 'code_asc'}));
});
