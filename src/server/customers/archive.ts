import {unusedAdvance} from './advances'
import {Prisma} from '@prisma/client'
import { AccessError } from '../auth/policy'
export async function assertCustomerCanArchive(tx:Pick<Prisma.TransactionClient,'$queryRaw'>,organizationId:string,id:string){
 await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${id} AND "organizationId"=${organizationId} FOR UPDATE`
 const [balance]=await tx.$queryRaw<{amount:Prisma.Decimal}[]>`SELECT COALESCE(sum(amount),0) AS amount FROM "DebtEntry" WHERE "organizationId"=${organizationId} AND "customerId"=${id}`
 if((await unusedAdvance(tx,organizationId,id)).gt(0))throw new AccessError(409,'CUSTOMER_HAS_BALANCE','Mijozning ishlatilmagan avansi bor')
 if(!balance.amount.isZero())throw new AccessError(409,'CUSTOMER_HAS_BALANCE','Mijozning qarz/avans qoldig‘i bor; avval uni hal qiling')
}
