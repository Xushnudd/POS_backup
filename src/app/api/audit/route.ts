import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context || context.role==='cashier') throw new AccessError(403,'FORBIDDEN')
 const q=new URL(request.url).searchParams,limit=Number(q.get('limit')??50),page=Number(q.get('page')??1)
 const where={organizationId:context.organizationId,...(q.get('entityId')&&{entityId:q.get('entityId')!})}
 const [data,total]=await prisma.$transaction([prisma.auditLog.findMany({where,take:limit,skip:(page-1)*limit,orderBy:[{createdAt:'desc'},{id:'asc'}]}),prisma.auditLog.count({where})])
 return NextResponse.json({success:true,data,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}})
})
