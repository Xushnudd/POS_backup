import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError, tenantScope } from '@/server/auth/policy'
import { startCount, startCountSchema } from '@/server/inventory/counts'
import {parseListQuery,journalListSorts} from '@/lib/list-query'
import {assertLiveContext} from '@/server/operations'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');
 const params=request.nextUrl.searchParams,filter=params.get('filter')??'active',status=params.get('status');
 if(!['active','all'].includes(filter)||status&&!['counting','review','approved','cancelled'].includes(status))throw new AccessError(400,'INVALID_FILTER');
 let query;try{query=parseListQuery(params,journalListSorts,'newest',50)}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER')}
 const {page,limit,skip,sort,search}=query;
 const where={AND:[tenantScope('StockCount',context),...(filter==='active'?[{status:{in:['counting','review']}}]:[]),...(status?[{status}]:[])],...(search?{OR:[{id:{contains:search}},{store:{name:{contains:search,mode:'insensitive' as const}}}]}:{})};
 const result=await prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context);const total=await tx.stockCount.count({where});
  const data=await tx.stockCount.findMany({where,orderBy:[{createdAt:sort==='oldest'?'asc':'desc'},{id:'asc'}],skip,take:limit,select:{id:true,storeId:true,scope:true,status:true,blind:true,createdAt:true,store:{select:{name:true}}}});
  return {success:true,data,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}};
 },{isolationLevel:'RepeatableRead'});
 return NextResponse.json(result);
})
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return NextResponse.json({success:true,data:await startCount(context,startCountSchema.parse(await request.json()))})
})
