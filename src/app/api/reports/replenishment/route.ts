import {NextRequest,NextResponse} from 'next/server'
import {Prisma} from '@prisma/client'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError,tenantScope} from '@/server/auth/policy'
import {parseListQuery,replenishmentListSorts} from '@/lib/list-query'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {assertLiveContext} from '@/server/operations'
import {replenishmentQuery} from '@/server/monitoring/service'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const params=request.nextUrl.searchParams,query=replenishmentQuery(context)
 let parsed;try{parsed=parseListQuery(params,replenishmentListSorts,'store')}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER')}
 const {page,limit,skip,sort,search}=parsed
 const order=sort==='name_asc'?Prisma.sql`r."productName" ASC`:sort==='name_desc'?Prisma.sql`r."productName" DESC`:sort==='quantity_asc'?Prisma.sql`r.quantity ASC`:sort==='quantity_desc'?Prisma.sql`r.quantity DESC`:sort==='suggested_desc'?Prisma.sql`r."suggestedQuantity" DESC`:Prisma.sql`r."storeId" ASC`
 const storeId=params.has('storeId')?z.string().uuid().parse(params.get('storeId')):null
 const filter=Prisma.sql`WHERE TRUE ${storeId?Prisma.sql`AND r."storeId"=${storeId}`:Prisma.empty} ${search?Prisma.sql`AND (r."productName" ILIKE ${'%'+search+'%'} OR r."storeName" ILIKE ${'%'+search+'%'})`:Prisma.empty}`
 const result=await prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  if(storeId&&!await tx.store.findFirst({where:{id:storeId,AND:tenantScope('Store',context)}}))throw new AccessError(404,'NOT_FOUND')
  const rows=await tx.$queryRaw<Record<string,unknown>[]>(Prisma.sql`SELECT * FROM (${query}) r ${filter} ORDER BY ${order},r."storeId",r."productId" LIMIT ${limit} OFFSET ${skip}`)
  const count=await tx.$queryRaw<{total:bigint}[]>(Prisma.sql`SELECT COUNT(*) AS total FROM (${query}) r ${filter}`)
  return {rows,total:Number(count[0].total)}
 },{isolationLevel:'RepeatableRead'})
 return NextResponse.json({success:true,data:result.rows,pagination:{page,limit,total:result.total,totalPages:Math.ceil(result.total/limit)}})
})
