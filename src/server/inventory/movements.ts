import {validateUnitQuantity} from '../catalog/service'
import { Prisma } from '@prisma/client'
import type { TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
import { decimal, DecimalInput } from '../sales/calculations'
export async function moveStock(tx: Prisma.TransactionClient, context: TokenPayload, input: {storeId:string;productId:string;delta:DecimalInput;unitCost:DecimalInput;sourceType:string;sourceId:string;allowNegative?:boolean}) {
  const delta=decimal(input.delta)
  const product=await tx.product.findFirst({where:{id:input.productId,organizationId:context.organizationId}})
  const store=await tx.store.findFirst({where:{id:input.storeId,organizationId:context.organizationId}})
  if (!product || !store || (context.role!=='owner' && !context.storeIds.includes(store.id))) throw new AccessError(404,'NOT_FOUND')
  await validateUnitQuantity(tx,context.organizationId,product.unit,delta)
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
