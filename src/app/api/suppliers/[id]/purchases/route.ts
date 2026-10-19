import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { documentFilters } from '@/server/inventory/list-filters'
import { paging,pagination } from '@/server/catalog/queries'
import { consumeLimit } from '@/server/auth/rate-limit'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params,q=new URL(request.url).searchParams,db=scopedPrisma(context)
 if(q.has('supplierId')&&q.get('supplierId')!==id)throw new AccessError(400,'SUPPLIER_FILTER_CONFLICT')
 const organization=await db.organization.findUniqueOrThrow({where:{id:context.organizationId},select:{timezone:true}})
 const {page,limit,skip}=paging(q)
 const where={organizationId:context.organizationId,...documentFilters(q,organization.timezone),supplierId:id}
 await consumeLimit('supplier.history',context.organizationId+':'+context.userId,60,60000)
 const result=await db.$transaction(async tx=>{
  const total=await tx.stockDocument.count({where})
  const rows=await tx.stockDocument.findMany({where,include:{store:{select:{id:true,name:true}},reversal:{select:{id:true,documentNo:true}},items:{include:{product:{select:{name:true,unit:true}}},orderBy:{id:'asc'}}},orderBy:[{createdAt:'desc'},{id:'asc'}],skip,take:limit})
  return {success:true,data:rows,pagination:pagination(page,limit,total)}
 },{isolationLevel:'RepeatableRead'})
 return NextResponse.json(result)
})
