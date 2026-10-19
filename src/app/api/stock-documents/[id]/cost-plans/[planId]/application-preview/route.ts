import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {withApi} from '@/server/api'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {previewCostApplication} from '@/server/purchases/cost-applications'
import {costRouteSource} from '@/server/purchases/cost-application-routes'
const schema=z.object({reverseApplicationId:z.string().uuid().optional()}).strict()
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string;planId:string}>})=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED')
 const {id,planId}=await params;await costRouteSource(ctx,id,planId)
 await consumeLimit('receipt-cost-application-preview',ctx.organizationId+':'+ctx.userId,20,60000)
 const input=schema.parse(await request.json()),preview=await previewCostApplication(ctx,planId,input.reverseApplicationId)
 return NextResponse.json({success:true,data:{...preview,products:preview.products.map(({issueCosts,transferCosts,cogsEntries,...row})=>({...row,cogsEntryCount:cogsEntries.length,issueCount:issueCosts.length,transferCount:transferCosts.length}))}},{headers:{'Cache-Control':'private, no-store'}})
})
