import {cursorExport,EXPORT_PAGE_SIZE} from '../cursor'
import {csv,EXPORT_CAP} from "@/server/exports/csv"
import {NextResponse} from "next/server"
import {prisma} from "@/lib/prisma"
import {AccessError} from "@/server/auth/policy"
import {dateRange} from "@/server/reports/dates"
import {consumeLimit} from "@/server/auth/rate-limit"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
import {parseListQuery,journalListSorts} from '@/lib/list-query'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function queryAudit(context:TokenPayload,request:NextRequest) {
 if (context.role!=='owner') throw new AccessError(403,'FORBIDDEN')
 const q=new URL(request.url).searchParams
 let query;try{query=parseListQuery(q,journalListSorts,'newest',50)}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER')}
 const {limit,page,skip,sort,search}=query,orderBy=[{createdAt:sort==='oldest'?'asc' as const:'desc' as const},{id:'asc' as const}]
 const summary=q.get('view')==='summary'
 if(q.has('view')&&!summary)throw new AccessError(400,'INVALID_VIEW')
  if((page-1)*limit>2147483647)throw new AccessError(400,'INVALID_PAGINATION')
  for(const field of ['entityType','action'])if((q.get(field)?.length??0)>100)throw new AccessError(400,'INVALID_FILTER')
  // Version/configuration resources also use non-UUID identifiers. Exact,
  // bounded matching remains parameterized and organization-scoped.
  const entityId=q.get('entityId')
  if(entityId!==null&&(!entityId.trim()||entityId.length>200||/[\u0000-\u001f\u007f]/.test(entityId)))throw new AccessError(400,'INVALID_ID')
  if(q.has('actorId')&&!/^[0-9a-f-]{36}$/i.test(q.get('actorId')??''))throw new AccessError(400,'INVALID_ID')
  const organization=await prisma.organization.findUniqueOrThrow({where:{id:context.organizationId},select:{timezone:true}})
  const range=dateRange(q.get('from'),q.get('to'),organization.timezone)
  const where={organizationId:context.organizationId,...(search?{OR:[{entityType:{contains:search,mode:'insensitive' as const}},{action:{contains:search,mode:'insensitive' as const}},{entityId:{contains:search}}]}:{}),...(q.get('entityId')&&{entityId:q.get('entityId')!}),...(q.get('entityType')&&{entityType:q.get('entityType')!}),...(q.get('action')&&{action:q.get('action')!}),...(q.get('actorId')&&{actorId:q.get('actorId')!}),...(Object.keys(range).length&&{createdAt:range})}
  await consumeLimit('audit.summary',context.organizationId+':'+context.userId,60,60000)
  if(q.get('format')==='csv'){
   await consumeLimit('audit.export',context.organizationId+':'+context.userId,10,60000)
   const data=await prisma.$transaction(async tx=>{
    const total=await tx.auditLog.count({where})
    if(total>EXPORT_CAP)throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 qatordan oshdi; filtrni toraytiring')
    const rows=await cursorExport(cursor=>tx.auditLog.findMany({where,orderBy,select:{id:true,createdAt:true,actorId:true,actor:{select:{fullName:true}},entityType:true,entityId:true,action:true},take:EXPORT_PAGE_SIZE,...(cursor?{cursor:{id:cursor},skip:1}:{})}))
    return {filename:'audit-'+context.organizationId+'.csv',content:csv([['ID','Vaqt (UTC)','Xodim ID','Xodim','Resurs turi','Resurs ID','Amal'],...rows.map(row=>[row.id,row.createdAt.toISOString(),row.actorId,row.actor?.fullName,row.entityType,row.entityId,row.action])])}
   },{isolationLevel:'RepeatableRead'})
   return NextResponse.json({success:true,data})
  }
  const result=await prisma.$transaction(async tx=>{
   const total=await tx.auditLog.count({where})
   const data=await tx.auditLog.findMany({where,take:limit,skip,orderBy,select:{id:true,actorId:true,entityType:true,entityId:true,action:true,createdAt:true,actor:{select:{fullName:true}},...(!summary&&{organizationId:true,beforeData:true,afterData:true})}})
   return {success:true,data,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}
  },{isolationLevel:'RepeatableRead'})
  return NextResponse.json(result)
}
