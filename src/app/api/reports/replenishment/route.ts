import {NextRequest,NextResponse} from 'next/server'
import {Prisma} from '@prisma/client'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {prisma} from '@/lib/prisma'
import {assertLiveContext} from '@/server/operations'
import {replenishmentQuery} from '@/server/monitoring/service'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const page=Number(request.nextUrl.searchParams.get('page')??1),limit=Number(request.nextUrl.searchParams.get('limit')??20),query=replenishmentQuery(context)
 const result=await prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  const rows=await tx.$queryRaw<Record<string,unknown>[]>(Prisma.sql`SELECT * FROM (${query}) r ORDER BY "storeId","productId" LIMIT ${limit} OFFSET ${(page-1)*limit}`)
  const count=await tx.$queryRaw<{total:bigint}[]>(Prisma.sql`SELECT COUNT(*) AS total FROM (${query}) r`)
  return {rows,total:Number(count[0].total)}
 },{isolationLevel:'RepeatableRead'})
 return NextResponse.json({success:true,data:result.rows,pagination:{page,limit,total:result.total,totalPages:Math.ceil(result.total/limit)}})
})
