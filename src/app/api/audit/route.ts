import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { dateRange } from '@/server/reports/dates'
import { consumeLimit } from '@/server/auth/rate-limit'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context || context.role!=='owner') throw new AccessError(403,'FORBIDDEN')
 const q=new URL(request.url).searchParams,limit=Number(q.get('limit')??50),page=Number(q.get('page')??1)
 const summary=q.get('view')==='summary'
 if(q.has('view')&&!summary)throw new AccessError(400,'INVALID_VIEW')
  if((page-1)*limit>2147483647)throw new AccessError(400,'INVALID_PAGINATION')
  for(const field of ['entityType','action'])if((q.get(field)?.length??0)>100)throw new AccessError(400,'INVALID_FILTER')
  for(const field of ['entityId','actorId'])if(q.has(field)&&!/^[0-9a-f-]{36}$/i.test(q.get(field)??''))throw new AccessError(400,'INVALID_ID')
  const organization=await prisma.organization.findUniqueOrThrow({where:{id:context.organizationId},select:{timezone:true}})
  const range=dateRange(q.get('from'),q.get('to'),organization.timezone)
  const where={organizationId:context.organizationId,...(q.get('entityId')&&{entityId:q.get('entityId')!}),...(q.get('entityType')&&{entityType:q.get('entityType')!}),...(q.get('action')&&{action:q.get('action')!}),...(q.get('actorId')&&{actorId:q.get('actorId')!}),...(Object.keys(range).length&&{createdAt:range})}
  await consumeLimit('audit.summary',context.organizationId+':'+context.userId,60,60000)
  const result=await prisma.$transaction(async tx=>{
   const total=await tx.auditLog.count({where})
   const data=await tx.auditLog.findMany({where,take:limit,skip:(page-1)*limit,orderBy:[{createdAt:'desc'},{id:'asc'}],select:{id:true,actorId:true,entityType:true,entityId:true,action:true,createdAt:true,actor:{select:{fullName:true}},...(!summary&&{organizationId:true,beforeData:true,afterData:true})}})
   return {success:true,data,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}
  },{isolationLevel:'RepeatableRead'})
  return NextResponse.json(result)
})
