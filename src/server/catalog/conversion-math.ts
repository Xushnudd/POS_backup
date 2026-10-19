import {Prisma} from '@prisma/client'
import {AccessError} from '../auth/policy'
const Exact=Prisma.Decimal.clone({precision:50,rounding:Prisma.Decimal.ROUND_HALF_UP})
export type ConversionSnapshot={baseUnit:string;tradeUnit:string;ratio:string;tradeQuantity:string}
export function convertQuantity(quantity:string|number|Prisma.Decimal,ratio:string|Prisma.Decimal,precision:number){
 const q=new Exact(quantity.toString()),r=new Exact(ratio.toString()),base=q.mul(r)
 if(!q.isFinite()||q.isZero()||q.decimalPlaces()>6||!r.isFinite()||r.lte(0)||r.decimalPlaces()>6||r.gte('100000000')||!Number.isInteger(precision)||precision<0||precision>6)throw new AccessError(400,'INVALID_CONVERSION')
 if(base.abs().gte('100000000000000')||base.decimalPlaces()>precision)throw new AccessError(400,'CONVERSION_PRECISION','Konvertatsiya asosiy birlik aniqligiga mos emas; miqdor yaxlitlanmadi')
 return new Prisma.Decimal(base.toFixed())
}
export function snapshotQuantity(snapshot:ConversionSnapshot,quantity:string|number|Prisma.Decimal,unit:string|null){
 if(snapshot.baseUnit!==unit)throw new AccessError(409,'CONVERSION_SNAPSHOT_INVALID')
 return convertQuantity(quantity,snapshot.ratio,6)
}
