import { Prisma } from '@prisma/client'
export async function debtAging(tx:Prisma.TransactionClient,organizationId:string,customerId:string,asOf:Date) {
 const groups=await tx.$queryRaw<{saleId:string|null;balance:Prisma.Decimal;dueAt:Date|null;origins:bigint;legacyUnallocated:boolean}[]>`
  SELECT "saleId",sum(amount) AS balance,max("dueAt") FILTER(WHERE "sourceType"='sale' AND amount>0) AS "dueAt",
   count(*) FILTER(WHERE "sourceType"='sale' AND amount>0) AS origins,
   bool_or("saleId" IS NULL AND "sourceType"='legacy_payment' AND amount<0) AS "legacyUnallocated"
  FROM "DebtEntry" WHERE "organizationId"=${organizationId} AND "customerId"=${customerId} GROUP BY "saleId"`
 const zero=()=>new Prisma.Decimal(0)
 const total=groups.reduce((sum,group)=>sum.add(group.balance),zero())
 const debtTotal=Prisma.Decimal.max(total,0),creditBalance=Prisma.Decimal.max(total.negated(),0)
 let overdue=zero(),upcoming=zero(),noDueDate=zero(),unallocated=zero()
 const requiresReconciliation=groups.some(group=>group.balance.lt(0)||group.legacyUnallocated)
 if(requiresReconciliation)unallocated=debtTotal
 else for(const group of groups){
  if(group.balance.lte(0))continue
  // General opening/correction settlements have no proven per-document links.
  if(!group.saleId||group.origins!==BigInt(1)){unallocated=unallocated.add(group.balance);continue}
  if(!group.dueAt)noDueDate=noDueDate.add(group.balance)
  else if(group.dueAt<asOf)overdue=overdue.add(group.balance)
  else upcoming=upcoming.add(group.balance)
 }
 return {asOf,overdue,upcoming,noDueDate,unallocated,debtTotal,creditBalance,requiresReconciliation}
}
