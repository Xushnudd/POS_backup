import {z} from 'zod'
import {Prisma} from '@prisma/client'
import type {TokenPayload} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {AccessError,tenantScope} from '../auth/policy'
import {audit,runOperation} from '../operations'
import {financeManager} from '../finance/accounts'
import {quantitySchema} from '../sales/service'
import {nonnegativeQuantitySchema,validateUnitQuantity} from '../catalog/service'
import {decimal} from '../sales/calculations'
import {lockSupplier,registerSupplierInvoiceTx} from './suppliers'
import {confirmStockDocumentTx} from '../inventory/documents'
export const orderSchema=z.object({operationId:z.string().uuid(),storeId:z.string().uuid(),supplierId:z.string().uuid(),referenceNo:z.string().trim().min(1).max(200),reason:z.string().trim().min(3).max(2000),items:z.array(z.object({productId:z.string().uuid(),quantity:quantitySchema,unitCost:nonnegativeQuantitySchema}).strict()).min(1).max(200)}).strict().refine(x=>new Set(x.items.map(i=>i.productId)).size===x.items.length,'Takror mahsulot mumkin emas');
export const receiptSchema=z.object({operationId:z.string().uuid(),referenceNo:z.string().trim().min(1).max(200),reason:z.string().trim().min(3).max(2000),dueAt:z.iso.datetime({offset:true}).optional(),items:z.array(z.object({orderItemId:z.string().uuid(),quantity:quantitySchema}).strict()).min(1).max(200)}).strict().refine(x=>new Set(x.items.map(i=>i.orderItemId)).size===x.items.length,'Takror buyurtma qatori mumkin emas');
export async function createPurchaseOrder(ctx:TokenPayload,input:z.infer<typeof orderSchema>){financeManager(ctx);return runOperation(ctx,'purchase.order',input.operationId,input,async tx=>{
 await lockSupplier(tx,ctx,input.supplierId);if(!await tx.store.findFirst({where:{id:input.storeId,isActive:true,AND:tenantScope('Store',ctx)}}))throw new AccessError(404,'STORE_NOT_FOUND');
 const items=[];for(const row of [...input.items].sort((a,b)=>a.productId.localeCompare(b.productId))){await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${row.productId} FOR SHARE`;const product=await tx.product.findFirst({where:{id:row.productId,organizationId:ctx.organizationId,isActive:true}});if(!product)throw new AccessError(404,'PRODUCT_NOT_FOUND');await validateUnitQuantity(tx,ctx.organizationId,product.unit,decimal(row.quantity));items.push({...row,quantity:decimal(row.quantity),unitCost:decimal(row.unitCost),productName:product.name,unit:product.unit});}
 const order=await tx.purchaseOrder.create({data:{organizationId:ctx.organizationId,storeId:input.storeId,supplierId:input.supplierId,referenceNo:input.referenceNo,reason:input.reason,createdBy:ctx.userId,items:{create:items}},include:{items:true}});await audit(tx,ctx,'PurchaseOrder',order.id,'ordered',{reason:input.reason,referenceNo:input.referenceNo});return order;
 });}
export async function receivePurchaseOrder(ctx:TokenPayload,id:string,input:z.infer<typeof receiptSchema>){financeManager(ctx);return runOperation(ctx,'purchase.receive',input.operationId,{id,...input},async tx=>{
 const initial=await tx.purchaseOrder.findFirst({where:{id,AND:tenantScope('PurchaseOrder',ctx)}});if(!initial)throw new AccessError(404,'ORDER_NOT_FOUND');await lockSupplier(tx,ctx,initial.supplierId);await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id=${id} FOR UPDATE`;
 const order=await tx.purchaseOrder.findUniqueOrThrow({where:{id},include:{items:true}});
 await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${order.storeId} FOR SHARE`;if(!await tx.store.findFirst({where:{id:order.storeId,isActive:true,AND:tenantScope('Store',ctx)}}))throw new AccessError(404,'STORE_NOT_FOUND');
 for(const original of [...order.items].filter(i=>input.items.some(r=>r.orderItemId===i.id)).sort((a,b)=>a.productId.localeCompare(b.productId))){await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${original.productId} FOR UPDATE`;const product=await tx.product.findFirst({where:{id:original.productId,organizationId:ctx.organizationId,isActive:true}});if(!product)throw new AccessError(404,'PRODUCT_NOT_FOUND');if(product.unit!==original.unit)throw new AccessError(409,'ORDER_UNIT_CHANGED','Buyurtma birligi o‘zgargan; original miqdorni boshqa birlikda qabul qilib bo‘lmaydi');}
 const totals=await tx.$queryRaw<{orderItemId:string;quantity:Prisma.Decimal}[]>`SELECT l."orderItemId",sum(si.quantity) AS quantity FROM "PurchaseReceiptLine" l JOIN "PurchaseReceipt" r ON r.id=l."receiptId" JOIN "StockDocumentItem" si ON si.id=l."stockDocumentItemId" WHERE r."orderId"=${id} GROUP BY l."orderItemId"`;const byId=new Map(totals.map(t=>[t.orderItemId,t.quantity]));
 const stockItems=[];for(const row of [...input.items].sort((a,b)=>a.orderItemId.localeCompare(b.orderItemId))){const original=order.items.find(i=>i.id===row.orderItemId);if(!original)throw new AccessError(404,'ORDER_ITEM_NOT_FOUND');const used=decimal(byId.get(original.id)??0);if(used.add(row.quantity).gt(original.quantity))throw new AccessError(409,'ORDER_QUANTITY_EXCEEDED','Buyurtma qoldig‘idan ortiq qabul mumkin emas');stockItems.push({productId:original.productId,quantity:decimal(row.quantity),unitCost:original.unitCost});}
 const stock=await tx.stockDocument.create({data:{organizationId:ctx.organizationId,storeId:order.storeId,supplierId:order.supplierId,documentType:'purchase',documentNo:input.referenceNo,note:input.reason,createdBy:ctx.userId,items:{create:stockItems}}});
 const confirmed=await confirmStockDocumentTx(tx,ctx,stock.id);
 const invoice=await registerSupplierInvoiceTx(tx,ctx,{operationId:input.operationId,supplierId:order.supplierId,stockDocumentId:stock.id,referenceNo:input.referenceNo,reason:input.reason,dueAt:input.dueAt});
 const receipt=await tx.purchaseReceipt.create({data:{orderId:id,stockDocumentId:stock.id,lines:{create:input.items.map(row=>({orderItemId:row.orderItemId,stockDocumentItemId:confirmed.items.find(i=>i.productId===order.items.find(o=>o.id===row.orderItemId)!.productId)!.id}))}},include:{lines:true}});
 await audit(tx,ctx,'PurchaseReceipt',receipt.id,'received',{orderId:id,stockDocumentId:stock.id,invoiceId:invoice.id,reason:input.reason});return {receipt,invoice,stockDocument:confirmed};
 });}
export async function purchaseOrderDetails(tx:Prisma.TransactionClient,ctx:TokenPayload,id:string){const order=await tx.purchaseOrder.findFirst({where:{id,AND:tenantScope('PurchaseOrder',ctx)},include:{supplier:{select:{id:true,name:true}},store:{select:{id:true,name:true}},items:{orderBy:{id:'asc'}}}});if(!order)throw new AccessError(404,'ORDER_NOT_FOUND');
 const totals=await tx.$queryRaw<{orderItemId:string;quantity:Prisma.Decimal}[]>`SELECT l."orderItemId",sum(si.quantity) AS quantity FROM "PurchaseReceiptLine" l JOIN "PurchaseReceipt" r ON r.id=l."receiptId" JOIN "StockDocumentItem" si ON si.id=l."stockDocumentItemId" WHERE r."orderId"=${id} GROUP BY l."orderItemId"`;
 const byId=new Map(totals.map(t=>[t.orderItemId,t.quantity]));const items=order.items.map(i=>({...i,receivedQuantity:byId.get(i.id)??decimal(0),remainingQuantity:decimal(i.quantity).sub(byId.get(i.id)??0)}));return {...order,items,status:items.every(i=>i.remainingQuantity.isZero())?'received':items.some(i=>i.receivedQuantity.gt(0))?'partial':'ordered'};
}
export async function readPurchaseOrder(ctx:TokenPayload,id:string){financeManager(ctx);return prisma.$transaction(tx=>purchaseOrderDetails(tx,ctx,id),{isolationLevel:'RepeatableRead'});}
