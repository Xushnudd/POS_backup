import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { cancelDraftIntent, cancelIntentSchema } from '@/server/sales/cancel-intent'
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 await consumeLimit('operation.cancel',context.userId,30,3600000)
 return NextResponse.json({success:true,data:await cancelDraftIntent(context,cancelIntentSchema.parse(await request.json()))})
}, { validateBodyReferences: false })
// Cancellation reserves only the original actor/hash; removed catalog references
// must not prevent stopping a delayed request. The service validates tenant/actor.
