import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError, tenantScope } from '@/server/auth/policy'
import { startCount, startCountSchema } from '@/server/inventory/counts'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const query=new URL(request.url).searchParams,page=Number(query.get('page')??1),limit=Number(query.get('limit')??50)
 const filter=query.get('filter')??'active'
 if(!['active','all'].includes(filter))throw new AccessError(400,'INVALID_FILTER')
 const where={AND:tenantScope('StockCount',context),...(filter==='active'?{status:{in:['counting','review']}}:{})}
 const total=await prisma.stockCount.count({where})
 const data=await prisma.stockCount.findMany({where,orderBy:{createdAt:'desc'},skip:(page-1)*limit,take:limit,select:{id:true,storeId:true,scope:true,status:true,blind:true,createdAt:true,store:{select:{name:true}}}})
 return NextResponse.json({success:true,data,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}})
})
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return NextResponse.json({success:true,data:await startCount(context,startCountSchema.parse(await request.json()))})
})
