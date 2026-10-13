import {Prisma} from '@prisma/client'
import {z} from 'zod'
import type {TokenPayload} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {AccessError,tenantScope} from '../auth/policy'
import {runOperation,audit,assertLiveContext} from '../operations'
export const serialIdsSchema=z.array(z.string().uuid().transform(id=>id.toLowerCase())).min(1).max(500).refine(ids=>new Set(ids).size===ids.length,'Takror serial')
export const serialCodesSchema=z.array(z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/).transform(code=>code.toUpperCase())).min(1).max(500).refine(ids=>new Set(ids).size===ids.length,'Takror serial')
export const serialPolicySchema=z.object({operationId:z.string().uuid(),productId:z.string().uuid(),warrantyDays:z.number().int().min(0).max(36500),warrantyTerms:z.string().trim().max(4000),reason:z.string().trim().min(3).max(2000)}).strict()
export async function enableSerialTracking(ctx:TokenPayload,input:z.infer<typeof serialPolicySchema>){
 if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')
 const data=serialPolicySchema.parse(input)
 return runOperation(ctx,'inventory.serial.policy',data.operationId,data,async tx=>{
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${data.productId} AND "organizationId"=${ctx.organizationId} FOR UPDATE`
  const p=await tx.product.findFirst({where:{id:data.productId,organizationId:ctx.organizationId}});if(!p)throw new AccessError(404,'NOT_FOUND')
  const unit=await tx.unit.findFirst({where:{organizationId:ctx.organizationId,code:p.unit,isActive:true}})
  if(!unit||unit.precision!==0||p.batchTracking)throw new AccessError(409,'SERIAL_INTEGER_UNIT_REQUIRED')
  if(!p.serialTracking&&(await tx.inventoryMovement.count({where:{productId:p.id}})||await tx.saleItem.count({where:{productId:p.id}})||await tx.stockTransferItem.count({where:{productId:p.id}})||await tx.inventoryBalance.count({where:{productId:p.id,quantity:{not:0}}})))throw new AccessError(409,'SERIAL_REQUIRES_UNUSED_PRODUCT')
  await tx.product.update({where:{id:p.id},data:{serialTracking:true,warrantyDays:data.warrantyDays,warrantyTerms:data.warrantyTerms}})
  await audit(tx,ctx,'Product',p.id,'serial_policy',{reason:data.reason,warrantyDays:data.warrantyDays,warrantyTerms:data.warrantyTerms})
  return {id:p.id,serialTracking:true,warrantyDays:data.warrantyDays,warrantyTerms:data.warrantyTerms}
 })
}
async function chosen(tx:Prisma.TransactionClient,ctx:TokenPayload,productId:string,quantity:Prisma.Decimal,where:Prisma.SerialNumberWhereInput,ids?:string[],requireExplicit=false){
 if(!quantity.isInteger()||quantity.gt(500)||quantity.lt(1))throw new AccessError(400,'SERIAL_INTEGER_QUANTITY_REQUIRED')
 if(ids)ids=serialIdsSchema.parse(ids)
 if(requireExplicit&&!ids)throw new AccessError(409,'SERIAL_SELECTION_REQUIRED')
 const rows=await tx.serialNumber.findMany({where:{organizationId:ctx.organizationId,productId,...where,...(ids?{id:{in:ids}}:{})},orderBy:{id:'asc'},take:501})
 // An implicit selection is safe only when the complete original set is taken.
 if(rows.length!==quantity.toNumber()||(ids&&ids.length!==rows.length))throw new AccessError(409,'SERIAL_SELECTION_REQUIRED','Original seriallarni aniq tanlang')
 return rows
}
async function serialAdmission(tx:Prisma.TransactionClient,ctx:TokenPayload,sourceId:string,amount:Prisma.Decimal){
 if(amount.add(await tx.serialEvent.count({where:{organizationId:ctx.organizationId,sourceId}})).gt(500))throw new AccessError(413,'SERIAL_OPERATION_TOO_LARGE','Bir original postingda ko‘pi bilan500serial birlik; alohida qisman qabul/qaytarishdan foydalaning')
}
export type SerialSource={ids?:string[];originalId?:string}
export async function postSerialMovement(tx:Prisma.TransactionClient,ctx:TokenPayload,m:Prisma.InventoryMovementGetPayload<object>,selection?:SerialSource){
 const p=await tx.product.findUniqueOrThrow({where:{id:m.productId}});if(!p.serialTracking)return
 const amount=m.quantityDelta.abs();await serialAdmission(tx,ctx,m.sourceId,amount);if(!amount.isInteger()||amount.gt(500))throw new AccessError(400,'SERIAL_INTEGER_QUANTITY_REQUIRED')
 let rows:Prisma.SerialNumberGetPayload<object>[],kind:string,saleItemId:string|undefined
 if(m.sourceType==='stock_document'&&m.quantityDelta.gt(0)){
  const item=await tx.stockDocumentItem.findFirstOrThrow({where:{stockDocumentId:m.sourceId,productId:m.productId}}),codes=serialCodesSchema.parse(item.serialInput)
  if(codes.length!==amount.toNumber())throw new AccessError(409,'SERIAL_COUNT_MISMATCH')
  rows=[];for(const code of codes.sort())rows.push(await tx.serialNumber.create({data:{organizationId:ctx.organizationId,productId:p.id,storeId:m.storeId,code}}));kind='receipt'
 }else if(m.sourceType==='sale'){
  const item=await tx.saleItem.findFirstOrThrow({where:{saleId:m.sourceId,productId:p.id}});saleItemId=item.id
  rows=await chosen(tx,ctx,p.id,amount,{state:'available',storeId:m.storeId},selection?.ids,true);kind='sale'
 }else if(m.sourceType==='return'){
  const ret=await tx.saleReturn.findUniqueOrThrow({where:{id:m.sourceId}}),item=await tx.saleItem.findFirstOrThrow({where:{saleId:ret.saleId,productId:p.id}});saleItemId=item.id
  rows=await chosen(tx,ctx,p.id,amount,{state:'sold',lastSaleItemId:item.id},selection?.ids,true);kind='return'
 }else if(m.sourceType==='transfer_out'){
  const item=await tx.stockTransferItem.findFirstOrThrow({where:{stockTransferId:m.sourceId,productId:p.id}})
  rows=await chosen(tx,ctx,p.id,amount,{state:'available',storeId:m.storeId},serialIdsSchema.parse(item.serialInput),true);kind='transfer_out'
 }else if(['transfer_in','transfer_return'].includes(m.sourceType)){
  const originalId=selection?.originalId;if(!originalId)throw new AccessError(409,'SERIAL_ORIGINAL_REQUIRED')
  rows=await chosen(tx,ctx,p.id,amount,{state:'transit',lastTransferId:originalId},selection?.ids);kind=m.sourceType
 }else if(m.sourceType==='stock_reversal'&&m.quantityDelta.gt(0)){
  const reversal=await tx.stockDocument.findUniqueOrThrow({where:{id:m.sourceId}})
  rows=await chosen(tx,ctx,p.id,amount,{state:'retired',storeId:m.storeId,events:{some:{kind:'retired',sourceId:reversal.reversalOfId!}}},selection?.ids);kind='restore'
 }else if(m.sourceType==='stock_reversal'){
  const reversal=await tx.stockDocument.findUniqueOrThrow({where:{id:m.sourceId}})
  rows=await chosen(tx,ctx,p.id,amount,{state:'available',storeId:m.storeId,events:{some:{kind:'receipt',sourceId:reversal.reversalOfId!}}},selection?.ids);kind='retired'
 }else if(m.sourceType==='supplier_return'){
  const credit=await tx.supplierCredit.findUniqueOrThrow({where:{id:m.sourceId},include:{invoice:true}})
  rows=await chosen(tx,ctx,p.id,amount,{state:'available',storeId:m.storeId,events:{some:{kind:'receipt',sourceId:credit.invoice.stockDocumentId!}}},selection?.ids);kind='retired'
 }else if(m.sourceType==='stock_document'&&m.quantityDelta.lt(0)){
  const item=await tx.stockDocumentItem.findFirstOrThrow({where:{stockDocumentId:m.sourceId,productId:p.id}})
  rows=await chosen(tx,ctx,p.id,amount,{state:'available',storeId:m.storeId},serialIdsSchema.parse(item.serialInput),true);kind='retired'
 }else throw new AccessError(409,'SERIAL_SOURCE_REQUIRED','Serial uchun original birlikka bog‘langan oqim talab qilinadi')
 const [eventStamp]=await tx.$queryRaw<{now:Date}[]>`SELECT CURRENT_TIMESTAMP::timestamp(3) AS now`
 for(const row of rows){
  const event=await tx.serialEvent.create({data:{organizationId:ctx.organizationId,productId:p.id,serialId:row.id,storeId:m.storeId,createdAt:eventStamp.now,kind,movementId:m.id,sourceId:m.sourceId,actorId:ctx.userId,saleItemId}})
  if(kind==='sale'){
   const [stamp]=await tx.$queryRaw<{now:Date}[]>`SELECT CURRENT_TIMESTAMP::timestamp(3) AS now`
   await tx.warranty.create({data:{organizationId:ctx.organizationId,productId:p.id,serialId:row.id,saleItemId:saleItemId!,saleEventId:event.id,storeId:m.storeId,startedAt:stamp.now,endsAt:new Date(stamp.now.getTime()+p.warrantyDays*86400000),terms:p.warrantyTerms}})
  }
 }
}
export async function validateSerialSale(tx:Prisma.TransactionClient,ctx:TokenPayload,productId:string,storeId:string,quantity:Prisma.Decimal,ids?:string[],returnedIds:string[]=[]){
 if(!(await tx.product.findUniqueOrThrow({where:{id:productId}})).serialTracking)return
 await chosen(tx,ctx,productId,quantity,{storeId,OR:[{state:'available'},{state:'sold',id:{in:returnedIds}}]},ids,true)
}
export async function validateSerialReturn(tx:Prisma.TransactionClient,ctx:TokenPayload,productId:string,saleItemId:string,quantity:Prisma.Decimal,ids?:string[]){
 if(!(await tx.product.findUniqueOrThrow({where:{id:productId}})).serialTracking)return
 await chosen(tx,ctx,productId,quantity,{state:'sold',lastSaleItemId:saleItemId},ids,true)
}
export async function postSerialDisposition(tx:Prisma.TransactionClient,ctx:TokenPayload,input:{productId:string;storeId:string;quantity:Prisma.Decimal;kind:'damaged'|'retired';sourceId:string;saleItemId?:string;returnDispositionId?:string;transferDispositionId?:string;ids?:string[];originalTransferId?:string}){
 if(!(await tx.product.findUniqueOrThrow({where:{id:input.productId}})).serialTracking)return
 await serialAdmission(tx,ctx,input.sourceId,input.quantity)
 const where:Prisma.SerialNumberWhereInput=input.saleItemId?{state:'sold',lastSaleItemId:input.saleItemId}:{state:'transit',lastTransferId:input.originalTransferId!}
 const rows=await chosen(tx,ctx,input.productId,input.quantity,where,input.ids,true)
 const [eventStamp]=await tx.$queryRaw<{now:Date}[]>`SELECT CURRENT_TIMESTAMP::timestamp(3) AS now`
 for(const row of rows)await tx.serialEvent.create({data:{organizationId:ctx.organizationId,productId:input.productId,serialId:row.id,storeId:input.storeId,createdAt:eventStamp.now,kind:input.kind,sourceId:input.sourceId,actorId:ctx.userId,saleItemId:input.saleItemId,returnDispositionId:input.returnDispositionId,transferDispositionId:input.transferDispositionId}})
}
export const serviceSchema=z.object({operationId:z.string().uuid(),warrantyId:z.string().uuid(),status:z.enum(['opened','in_progress','resolved','rejected']),note:z.string().trim().min(3).max(2000)}).strict()
export async function recordWarrantyService(ctx:TokenPayload,input:z.infer<typeof serviceSchema>){
 if(!['owner','admin'].includes(ctx.role))throw new AccessError(403,'MANAGER_REQUIRED')
 return runOperation(ctx,'inventory.serial.service',input.operationId,input,async tx=>{
  await tx.$queryRaw`SELECT id FROM "Warranty" WHERE id=${input.warrantyId} FOR UPDATE`
  const warranty=await tx.warranty.findFirst({where:{id:input.warrantyId,AND:tenantScope('Warranty',ctx)}});if(!warranty)throw new AccessError(404,'NOT_FOUND')
  const serial=await tx.serialNumber.findUniqueOrThrow({where:{id:warranty.serialId}})
  if(serial.lastSaleItemId!==warranty.saleItemId||serial.state!=='sold')throw new AccessError(409,'WARRANTY_ORIGINAL_SALE_REQUIRED')
  const last=await tx.warrantyService.findFirst({where:{warrantyId:warranty.id},orderBy:{ordinal:'desc'}})
  if(!last&&input.status!=='opened'||last&&['resolved','rejected'].includes(last.status)&&input.status!=='opened'||last&&!['resolved','rejected'].includes(last.status)&&input.status==='opened')throw new AccessError(409,'WARRANTY_SERVICE_STATE_CHANGED')
  const [stamp]=await tx.$queryRaw<{now:Date}[]>`SELECT CURRENT_TIMESTAMP::timestamp(3) AS now`
  const result=await tx.warrantyService.create({data:{organizationId:ctx.organizationId,productId:warranty.productId,createdAt:stamp.now,warrantyId:warranty.id,status:input.status,note:input.note,actorId:ctx.userId}})
  await audit(tx,ctx,'Warranty',warranty.id,'service_'+input.status,{reason:input.note,withinWarranty:stamp.now>=warranty.startedAt&&stamp.now<warranty.endsAt})
  return result
 })
}
export async function listSerials(ctx:TokenPayload,input:{storeId:string;productId?:string;search?:string;page:number;state?:string;receiptId?:string;saleItemId?:string;transferId?:string}){
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,ctx);if(!await tx.store.findFirst({where:{id:input.storeId,AND:tenantScope('Store',ctx)}}))throw new AccessError(404,'NOT_FOUND')
  if(input.receiptId&&!await tx.stockDocument.findFirst({where:{id:input.receiptId,AND:tenantScope('StockDocument',ctx)}}))throw new AccessError(404,'NOT_FOUND')
  if(input.saleItemId&&!await tx.saleItem.findFirst({where:{id:input.saleItemId,sale:tenantScope('Sale',ctx)}}))throw new AccessError(404,'NOT_FOUND')
  if(input.transferId&&!await tx.stockTransfer.findFirst({where:{id:input.transferId,AND:tenantScope('StockTransfer',ctx)}}))throw new AccessError(404,'NOT_FOUND')
  const where:Prisma.SerialNumberWhereInput={organizationId:ctx.organizationId,storeId:input.storeId,...(input.receiptId?{events:{some:{kind:'receipt',sourceId:input.receiptId}}}:{}),...(input.saleItemId?{lastSaleItemId:input.saleItemId}:{}),...(input.transferId?{lastTransferId:input.transferId}:{}),...(input.productId?{productId:input.productId}:{}),...(input.search?{code:{contains:input.search.toUpperCase()}}:{}),...(input.state?{state:input.state}:{})}
  const total=await tx.serialNumber.count({where}),data=await tx.serialNumber.findMany({where,orderBy:{code:'asc'},skip:(input.page-1)*50,take:50,include:{events:ctx.role==='cashier'?false:{where:ctx.role==='owner'?{}:{storeId:{in:ctx.storeIds}},orderBy:{ordinal:'desc'},take:20},product:{select:{id:true,name:true}},warranties:ctx.role==='cashier'?false:{where:ctx.role==='owner'?{}:{storeId:{in:ctx.storeIds}},orderBy:{startedAt:'desc'},take:1,include:{services:{orderBy:{ordinal:'desc'},take:20}}}}})
  return {data:ctx.role==='cashier'?data.map(row=>({id:row.id,code:row.code,state:row.state,productId:row.productId,storeId:row.storeId,product:row.product})):data,total,page:input.page,limit:50}
 },{isolationLevel:'RepeatableRead'})
}
export async function readSerialHistory(ctx:TokenPayload,id:string,page:number){
 if(!['owner','admin'].includes(ctx.role))throw new AccessError(403,'MANAGER_REQUIRED')
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,ctx)
  const serial=await tx.serialNumber.findFirst({where:{id,AND:tenantScope('SerialNumber',ctx)},select:{id:true,code:true}});if(!serial)throw new AccessError(404,'NOT_FOUND')
  const eventWhere={organizationId:ctx.organizationId,serialId:id,...(ctx.role==='owner'?{}:{storeId:{in:ctx.storeIds}})},serviceWhere={organizationId:ctx.organizationId,warranty:{serialId:id,...tenantScope('Warranty',ctx)}}
  const events=await tx.serialEvent.findMany({where:eventWhere,orderBy:{ordinal:'desc'},skip:(page-1)*50,take:50,select:{id:true,ordinal:true,kind:true,sourceId:true,saleItemId:true,storeId:true,createdAt:true}}),eventTotal=await tx.serialEvent.count({where:eventWhere})
  const warranties=await tx.warranty.findMany({where:eventWhere,orderBy:[{startedAt:'desc'},{id:'desc'}],skip:(page-1)*50,take:50}),warrantyTotal=await tx.warranty.count({where:eventWhere})
  const services=await tx.warrantyService.findMany({where:serviceWhere,orderBy:{ordinal:'desc'},skip:(page-1)*50,take:50,select:{id:true,ordinal:true,warrantyId:true,status:true,note:true,createdAt:true}}),serviceTotal=await tx.warrantyService.count({where:serviceWhere})
  return {serial,events,warranties,services,page,totalPages:Math.ceil(Math.max(eventTotal,warrantyTotal,serviceTotal)/50),eventTotal,warrantyTotal,serviceTotal}
 },{isolationLevel:'RepeatableRead'})
}
