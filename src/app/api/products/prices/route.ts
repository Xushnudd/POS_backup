import {queryProductsPrices} from '@/server/exports/queries/products-prices'
import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'

import {changePrices,priceBatchSchema} from '@/server/catalog/prices'


import {consumeLimit} from '@/server/auth/rate-limit'
export const POST=withApi(async(request:NextRequest)=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');
 await consumeLimit('prices.change',ctx.organizationId+':'+ctx.userId,30,60000);
 return NextResponse.json({success:true,data:await changePrices(ctx,priceBatchSchema.parse(await request.json()))});
});
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return queryProductsPrices(context,request)
})
