import {z} from 'zod'
import {Prisma} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {platformAdmin} from '../billing/service'
import {requireBoundStepUp} from '../auth/critical-actions'
import {payloadHash, audit} from '../operations'
import {subscriptionPhase} from '../billing/phase'
import {authenticationDeliveryStatus} from '../auth/delivery'
export const platformOverviewSchema = z.object({operationId:z.string().uuid(),page:z.number().int().min(1).max(10000).default(1),search:z.string().trim().max(100).default('')}).strict()
export async function platformOverview(context:TokenPayload,input:z.input<typeof platformOverviewSchema>) {
 const parsed=platformOverviewSchema.parse(input)
 return prisma.$transaction(async tx=>{
  // Lock the independent platform grant for the complete authorized read.
  await tx.$queryRaw`SELECT "userId" FROM "PlatformOperator" WHERE "userId"=${context.userId} FOR SHARE`
  await platformAdmin(tx,context)
  await requireBoundStepUp(tx,context,'platform.overview',parsed.operationId,payloadHash(parsed))
  const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`
  const where=parsed.search?{name:{contains:parsed.search,mode:Prisma.QueryMode.insensitive}}:{}
  const total=await tx.organization.count({where})
  const rows=await tx.organization.findMany({where,take:20,skip:(parsed.page-1)*20,orderBy:[{name:'asc'},{id:'asc'}],select:{id:true,name:true,createdAt:true}})
  const organizations=[]
  for(const row of rows){
   const subscription=await tx.organizationSubscription.findUnique({where:{organizationId:row.id},include:{planVersion:true}})
   const closure=await tx.organizationClosure.findFirst({where:{organizationId:row.id,cancelledAt:null},select:{id:true}})
   const phase=subscription?subscriptionPhase(now,{...subscription,graceDays:subscription.planVersion.graceDays}):{state:'legacy_unmanaged',newSalesAllowed:true,businessWritesAllowed:true}
   organizations.push({...row,state:phase.state,closurePending:!!closure,businessWritesAllowed:phase.businessWritesAllowed&&!closure,plan:subscription?{code:subscription.planVersion.code,name:subscription.planVersion.name,version:subscription.planVersion.version}:null,openIncidents:await tx.incident.count({where:{organizationId:row.id,state:'open'}})})
  }
  const plans=await tx.billingPlan.findMany({orderBy:{code:'asc'},select:{code:true,isActive:true,currentVersion:{select:{name:true,version:true,monthlyPrice:true,currency:true,branchLimit:true,registerLimit:true,staffLimit:true}}}})
  const incidents=await tx.incident.findMany({where:{state:'open'},take:20,orderBy:[{lastSeenAt:'desc'},{id:'asc'}],select:{id:true,organizationId:true,kind:true,severity:true,state:true,detectedAt:true,lastSeenAt:true}})
  // Do not return incident evidence, contacts, financial records, provider
  // payloads, diagnostics, database URLs or authentication material.
  await audit(tx,context,'PlatformOverview',parsed.operationId,'platform_overview_viewed',{page:parsed.page,organizationCount:organizations.length})
  return {organizations,total,page:parsed.page,pageSize:20,plans,incidents,now,health:{database:'reachable',scope:'request_database_check'},integrations:{vendorAdapters:'not_implemented',paymentProviderDecision:'Click',realPaymentAvailable:false,fiscalAvailable:false,hardwareAvailable:false,authenticationDelivery:authenticationDeliveryStatus()}}
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:15000})
}
