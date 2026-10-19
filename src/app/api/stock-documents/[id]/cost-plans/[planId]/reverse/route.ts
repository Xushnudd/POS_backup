import {NextRequest,NextResponse} from 'next/server'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {withApi} from '@/server/api'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {applyReceiptCost,applyCostSchema} from '@/server/purchases/cost-applications'
import {costRouteSource} from '@/server/purchases/cost-application-routes'
const schema=applyCostSchema.extend({reverseApplicationId:applyCostSchema.shape.operationId}).strict()
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string;planId:string}>})=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED')
 const {id,planId}=await params;await costRouteSource(ctx,id,planId)
 await consumeLimit('receipt-cost-application-write',ctx.organizationId+':'+ctx.userId,30,60000)
 const {reverseApplicationId,...input}=schema.parse(await request.json())
 return NextResponse.json({success:true,data:await applyReceiptCost(ctx,planId,input,reverseApplicationId)},{headers:{'Cache-Control':'private, no-store'}})
})
