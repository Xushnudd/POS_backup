import {NextRequest,NextResponse} from 'next/server'
import {Prisma} from '@prisma/client'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError,tenantScope} from '@/server/auth/policy'
import {paging} from '@/server/catalog/queries'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {assertLiveContext} from '@/server/operations'
import {replenishmentQuery} from '@/server/monitoring/service'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const params=request.nextUrl.searchParams,{page,limit,skip}=paging(params),query=replenishmentQuery(context)
 const storeId=params.has('storeId')?z.string().uuid().parse(params.get('storeId')):null
 const selectedStore=storeId?Prisma.sql`WHERE r."storeId"=${storeId}`:Prisma.empty
 const result=await prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  if(storeId&&!await tx.store.findFirst({where:{id:storeId,AND:tenantScope('Store',context)}}))throw new AccessError(404,'NOT_FOUND')
  const rows=await tx.$queryRaw<Record<string,unknown>[]>(Prisma.sql`SELECT * FROM (${query}) r ${selectedStore} ORDER BY "storeId","productId" LIMIT ${limit} OFFSET ${skip}`)
  const count=await tx.$queryRaw<{total:bigint}[]>(Prisma.sql`SELECT COUNT(*) AS total FROM (${query}) r ${selectedStore}`)
  return {rows,total:Number(count[0].total)}
 },{isolationLevel:'RepeatableRead'})
 return NextResponse.json({success:true,data:result.rows,pagination:{page,limit,total:result.total,totalPages:Math.ceil(result.total/limit)}})
})
