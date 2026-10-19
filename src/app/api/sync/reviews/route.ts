import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {assertLiveContext} from '@/server/operations'
import {reviewScope} from '@/server/sync/reviews'
import {prisma} from '@/lib/prisma'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 // Owner handles all stores; branch managers cannot read unassigned actors' payloads.
 if(context.role==='admin')throw new AccessError(403,'OWNER_REQUIRED')
 const page=Number(request.nextUrl.searchParams.get('page')??1),where=reviewScope(context)
 const result=await prisma.$transaction(async tx=>{await assertLiveContext(tx,context);return {rows:await tx.syncReview.findMany({where,orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(page-1)*20,take:20}),total:await tx.syncReview.count({where})}},{isolationLevel:'RepeatableRead'})
 return NextResponse.json({success:true,data:result.rows,pagination:{page,limit:20,total:result.total,totalPages:Math.ceil(result.total/20)}})
})
