import { Prisma } from '@prisma/client'
import { AccessError } from '../auth/policy'
import type { DecimalInput } from '../sales/calculations'
const Exact=Prisma.Decimal.clone({precision:50,rounding:Prisma.Decimal.ROUND_HALF_UP})
export function weightedAverage(oldQuantity:DecimalInput,oldCost:DecimalInput,quantity:DecimalInput,cost:DecimalInput) {
 const old=new Exact(oldQuantity.toString()),added=new Exact(quantity.toString()),before=new Exact(oldCost.toString()),received=new Exact(cost.toString())
 if(!old.isFinite()||!added.isFinite()||!before.isFinite()||!received.isFinite()||old.lt(0)||added.lte(0)||before.lt(0)||received.lt(0))throw new AccessError(409,'COST_RECONCILIATION_REQUIRED')
 return new Prisma.Decimal(old.mul(before).add(added.mul(received)).div(old.add(added)).toFixed(6))
}
