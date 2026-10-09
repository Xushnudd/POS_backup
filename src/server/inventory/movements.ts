import {stockPosition,writeLocation} from './reservations'
import {validateUnitQuantity} from '../catalog/service'
import { Prisma } from '@prisma/client'
import type { TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
import { decimal, DecimalInput } from '../sales/calculations'
export async function moveStock(tx: Prisma.TransactionClient, context: TokenPayload, input: {storeId:string;productId:string;delta:DecimalInput;unitCost:DecimalInput;sourceType:string;sourceId:string;allowNegative?:boolean;reservedLocationId?:string|null}) {
  const delta=decimal(input.delta)
  const product=await tx.product.findFirst({where:{id:input.productId,organizationId:context.organizationId}})
  const store=await tx.store.findFirst({where:{id:input.storeId,organizationId:context.organizationId}})
  if (!product || !store || (context.role!=='owner' && !context.storeIds.includes(store.id))) throw new AccessError(404,'NOT_FOUND')
  await validateUnitQuantity(tx,context.organizationId,product.unit,delta)
  const lock=`stock:${input.storeId}:${input.productId}`
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock},0))::text`
  if(await tx.stockFreeze.findUnique({where:{storeId_productId:{storeId:input.storeId,productId:input.productId}}})) throw new AccessError(409,'STOCK_COUNT_IN_PROGRESS',`${product.name} sanalmoqda; avval sanashni yakunlang`)
  if(delta.lt(0)){
    const position=await stockPosition(tx,context,input.storeId,input.productId),needed=delta.negated()
    if(position.reserved.gt(0)&&position.available.lt(needed))throw new AccessError(409,'INSUFFICIENT_AVAILABLE_STOCK','Qoldiqning bir qismi rezerv qilingan')
    // A consumed reservation debits its original zone; ordinary withdrawals use
    // unassigned stock first, then stable location order without touching holds.
    let remainder=needed
    if(input.reservedLocationId!==undefined){
      const available=input.reservedLocationId===null?position.unassignedAvailable:position.zones.find(z=>z.locationId===input.reservedLocationId)?.available??decimal(0)
      if(available.lt(needed))throw new AccessError(409,'INSUFFICIENT_AVAILABLE_STOCK')
      if(input.reservedLocationId)await writeLocation(tx,context,{...input,locationId:input.reservedLocationId,delta:needed.negated(),unit:product.unit,reason:'Rezerv bo‘yicha sotuv'})
      remainder=decimal(0)
    }else{
      remainder=remainder.sub(Prisma.Decimal.min(remainder,Prisma.Decimal.max(position.unassignedAvailable,0)))
      for(const zone of position.zones){if(remainder.eq(0))break;const take=Prisma.Decimal.min(remainder,zone.available);if(take.gt(0)){await writeLocation(tx,context,{...input,locationId:zone.locationId,delta:take.negated(),unit:product.unit,reason:'Stock operatsiyasi: '+input.sourceType});remainder=remainder.sub(take)}}
    }
    if(remainder.gt(0)&&!input.allowNegative)throw new AccessError(409,'INSUFFICIENT_STOCK')
  }
  if(input.sourceType==='stock_document'){
    const document=await tx.stockDocument.findUnique({where:{id:input.sourceId},select:{documentType:true}})
    if(document&&['adjustment','opening'].includes(document.documentType)){
      const uncertain=await tx.$queryRaw<{id:string}[]>`SELECT i.id FROM "ReservationItem" i JOIN "StockReservation" r ON r.id=i."reservationId" WHERE i."organizationId"=${context.organizationId} AND i."storeId"=${input.storeId} AND i."productId"=${input.productId} AND r.kind='cash_ticket' AND r.status='active' AND i."remainingQuantity">0 LIMIT 1`
      if(uncertain.length)throw new AccessError(409,'UNRESOLVED_OFFLINE_STOCK','Stockni tuzatishdan oldin offline pul/tovar natijasini hal qiling')
    }
  }
  const where={storeId_productId:{storeId:input.storeId,productId:input.productId}}
  await tx.inventoryBalance.upsert({where,create:{storeId:input.storeId,productId:input.productId,quantity:0},update:{}})
  const update=await tx.inventoryBalance.updateMany({
    where:{storeId:input.storeId,productId:input.productId,...(delta.lt(0) && !input.allowNegative && {quantity:{gte:delta.negated()}})},
    data:{quantity:{increment:delta}},
  })
  if (!update.count) throw new AccessError(409,'INSUFFICIENT_STOCK',`${product.name} uchun yetarli qoldiq yo‘q`)
  await tx.inventoryMovement.create({data:{organizationId:context.organizationId,storeId:input.storeId,productId:input.productId,
    quantityDelta:delta,unitCost:decimal(input.unitCost),sourceType:input.sourceType,sourceId:input.sourceId,movementType:input.sourceType,createdBy:context.userId}})
}
