import type { scopedPrisma } from '../auth/scoped-prisma'
import { AccessError } from '../auth/policy'
export async function assertCustomerCanArchive(tx:Pick<ReturnType<typeof scopedPrisma>,'$queryRaw'|'debtEntry'>,organizationId:string,id:string){
 await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${id} AND "organizationId"=${organizationId} FOR UPDATE`
 const balance=await tx.debtEntry.aggregate({where:{organizationId,customerId:id},_sum:{amount:true}})
 if(balance._sum.amount&&!balance._sum.amount.isZero())throw new AccessError(409,'CUSTOMER_HAS_BALANCE','Mijozning qarz/avans qoldig‘i bor; avval uni hal qiling')
}
