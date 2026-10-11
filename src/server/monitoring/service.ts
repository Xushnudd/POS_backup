import {randomUUID} from 'node:crypto'
import {Prisma} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {AccessError,tenantScope} from '../auth/policy'
import {assertLiveContext,audit,runOperation} from '../operations'
import {discrepancyQuery,type ReconciliationKind,type ReconciliationScope} from '../reconciliation/service'
const kinds:ReconciliationKind[]=['inventory','sales','returns','shifts']
export function incidentScope(context:TokenPayload){
 if(context.role==='cashier')throw new AccessError(403,'FORBIDDEN')
 return {organizationId:context.organizationId,...(context.role!=='owner'?{storeId:{in:context.storeIds}}:{})}
}
// Internal worker uses explicit organization+store scope; no Session or economic posting is fabricated.
export async function scanOrganization(tx:Prisma.TransactionClient,organizationId:string,storeIds?:string[]){
 const scope:ReconciliationScope={organizationId,role:storeIds?'admin':'owner',storeIds:storeIds??[]}
 const counts:Record<string,number>={}
 for(const kind of kinds){
  const query=discrepancyQuery(scope,kind)
  const key=kind==='inventory'?Prisma.sql`d."storeId"||':'||d."productId"`:Prisma.raw(`d."${kind==='sales'?'saleId':kind==='returns'?'returnId':'shiftId'}"`)
  counts[kind]=await tx.$executeRaw(Prisma.sql`INSERT INTO "Incident" (id,"organizationId","storeId",kind,"entityKey",severity,state,evidence)
   SELECT md5(${randomUUID()}||${key}),${organizationId},d."storeId",${kind},${key},'critical','open',(SELECT jsonb_object_agg(key,CASE WHEN jsonb_typeof(value)='number' THEN to_jsonb(value::text) ELSE value END) FROM jsonb_each(to_jsonb(d))) FROM (${query}) d
   ON CONFLICT ("organizationId",kind,"entityKey") DO UPDATE SET evidence=EXCLUDED.evidence,"lastSeenAt"=NOW(),state='open',"resolvedAt"=NULL,"resolvedBy"=NULL,"resolutionReason"=NULL`)
 }
 return counts
}
export async function scan(context:TokenPayload,key:string){
 incidentScope(context)
 return runOperation(context,'monitor.scan',key,{},async tx=>{
  const counts=await scanOrganization(tx,context.organizationId,context.role==='owner'?undefined:context.storeIds)
  await audit(tx,context,'Organization',context.organizationId,'reconciliation_scanned',counts)
  return counts
 })
}
export async function resolveIncident(context:TokenPayload,id:string,input:{operationId:string;reason:string}){
 const scope=incidentScope(context)
 return runOperation(context,'incident.resolve',input.operationId,{id,...input},async tx=>{
  const incident=await tx.incident.findFirst({where:{id,...scope}})
  if(!incident)throw new AccessError(404,'NOT_FOUND')
  if(!kinds.includes(incident.kind as ReconciliationKind))throw new AccessError(409,'UNSUPPORTED_INCIDENT')
  const query=discrepancyQuery(context,incident.kind as ReconciliationKind,incident.storeId??undefined)
  const key=incident.kind==='inventory'?Prisma.sql`d."storeId"||':'||d."productId"`:Prisma.raw(`d."${incident.kind==='sales'?'saleId':incident.kind==='returns'?'returnId':'shiftId'}"`)
  const remaining=await tx.$queryRaw<{present:boolean}[]>(Prisma.sql`SELECT EXISTS(SELECT 1 FROM (${query}) d WHERE ${key}=${incident.entityKey}) AS present`)
  if(remaining[0].present)throw new AccessError(409,'DISCREPANCY_REMAINS','Farq hali bor; tasdiqlangan tuzatish hujjatini tekshiring')
  if(incident.state==='resolved')return incident
  const result=await tx.incident.update({where:{id},data:{state:'resolved',resolvedAt:new Date(),resolvedBy:context.userId,resolutionReason:input.reason}})
  await audit(tx,context,'Incident',id,'resolved',{reason:input.reason})
  return result
 })
}
export async function incidentList(context:TokenPayload,page:number,state:string,limit=20){
 const scope=incidentScope(context)
 return prisma.$transaction(async tx=>{await assertLiveContext(tx,context);const where={...scope,state};return {rows:await tx.incident.findMany({where,orderBy:[{lastSeenAt:'desc'},{id:'asc'}],skip:(page-1)*limit,take:limit}),total:await tx.incident.count({where})}}, {isolationLevel:'RepeatableRead'})
}
export async function setThreshold(context:TokenPayload,input:{storeId:string;productId:string;minimum:string|number;maximum:string|number;operationId:string}){
 incidentScope(context)
 return runOperation(context,'stock.threshold',input.operationId,input,async tx=>{
  if(!await tx.store.findFirst({where:{id:input.storeId,AND:tenantScope('Store',context)}})||!await tx.product.findFirst({where:{id:input.productId,organizationId:context.organizationId}}))throw new AccessError(404,'NOT_FOUND')
  const result=await tx.stockThreshold.upsert({where:{storeId_productId:{storeId:input.storeId,productId:input.productId}},create:{storeId:input.storeId,productId:input.productId,minimum:input.minimum,maximum:input.maximum,organizationId:context.organizationId},update:{minimum:input.minimum,maximum:input.maximum}})
  await audit(tx,context,'StockThreshold',result.id,'threshold_set',{minimum:input.minimum,maximum:input.maximum,storeId:input.storeId,productId:input.productId})
  return result
 })
}
export function replenishmentQuery(context:TokenPayload){
 incidentScope(context)
 const stores=context.role==='owner'?Prisma.empty:context.storeIds.length?Prisma.sql`AND s.id IN (${Prisma.join(context.storeIds)})`:Prisma.sql`AND FALSE`
 return Prisma.sql`SELECT s.id AS "storeId",s.name AS "storeName",p.id AS "productId",p.name AS "productName",p.unit,
  COALESCE(b.quantity,0) AS quantity,COALESCE(t.minimum,p."minStock") AS minimum,t.maximum,
  CASE WHEN t.maximum IS NOT NULL THEN GREATEST(t.maximum-COALESCE(b.quantity,0),0) ELSE GREATEST(p."minStock"-COALESCE(b.quantity,0),0) END AS "suggestedQuantity",
  (t.maximum IS NULL) AS "minimumOnly"
 FROM "Store" s CROSS JOIN "Product" p LEFT JOIN "InventoryBalance" b ON b."storeId"=s.id AND b."productId"=p.id LEFT JOIN "StockThreshold" t ON t."storeId"=s.id AND t."productId"=p.id
 WHERE s."organizationId"=${context.organizationId} AND p."organizationId"=${context.organizationId} AND s."isActive" AND p."isActive" ${stores} AND COALESCE(b.quantity,0)<=COALESCE(t.minimum,p."minStock")`
}
