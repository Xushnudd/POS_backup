import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken,verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { costReport,recordCost } from '@/server/billing/costs'
async function actor(request:NextRequest){const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');await consumeLimit('billing.cost',context.userId,20,60000);return context}
export const POST=withApi(async(request:NextRequest)=>NextResponse.json({success:true,data:await recordCost(await actor(request),await request.json())}))
export const GET=withApi(async(request:NextRequest)=>{
 const params=request.nextUrl.searchParams,format=params.get('format')
 if(format&&format!=='csv')throw new AccessError(400,'INVALID_FORMAT')
 return NextResponse.json({success:true,data:await costReport(await actor(request),{targetOrganizationId:params.get('targetOrganizationId')??'',from:params.get('from')??'',to:params.get('to')??'',page:params.get('page')??1},format==='csv')})
})
