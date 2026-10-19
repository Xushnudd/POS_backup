import {NextRequest,NextResponse} from 'next/server'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {withApi} from '@/server/api'
import {AccessError} from '@/server/auth/policy'
import {costJournalHistory} from '@/server/purchases/cost-application-routes'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string;planId:string}>})=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED')
 const {id,planId}=await params
 return NextResponse.json({success:true,data:await costJournalHistory(ctx,id,planId,Number(request.nextUrl.searchParams.get('page')??1))},{headers:{'Cache-Control':'private, no-store'}})
})
