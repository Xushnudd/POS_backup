import { Prisma } from '@prisma/client'
const Exact=Prisma.Decimal.clone({precision:50,rounding:Prisma.Decimal.ROUND_HALF_UP})
export const reportDecimal=(value:Prisma.Decimal|number|string)=>new Exact(value.toString())
