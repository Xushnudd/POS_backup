import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {AccessError} from '@/server/auth/policy'
import {assertLiveContext} from '@/server/operations'
import {resolvePrices} from '@/server/catalog/price-rules'
import {quantitySchema} from '@/server/sales/service'
import {decimal} from '@/server/sales/calculations'
import {validateUnitQuantity} from '@/server/catalog/service'
import {consumeLimit} from '@/server/auth/rate-limit'
const schema=z.object({storeId:z.string().uuid(),customerId:z.string().uuid().nullable().optional(),items:z.array(z.object({productId:z.string().uuid(),quantity:quantitySchema}).strict()).min(1).max(500)}).strict()
export const POST=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');const input=schema.parse(await request.json());if(new Set(input.items.map(i=>i.productId)).size!==input.items.length)throw new AccessError(400,'DUPLICATE_ITEM');await consumeLimit('price-quote',ctx.organizationId+':'+ctx.userId,120,60000);const data=await prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx);const products=await tx.product.findMany({where:{organizationId:ctx.organizationId,id:{in:input.items.map(i=>i.productId)},isActive:true}});if(products.length!==input.items.length)throw new AccessError(404,'PRODUCT_NOT_FOUND');for(const item of input.items)await validateUnitQuantity(tx,ctx.organizationId,products.find(p=>p.id===item.productId)!.unit,decimal(item.quantity));const prices=await resolvePrices(tx,ctx,input.items.map(i=>({productId:i.productId,quantity:decimal(i.quantity),basePrice:products.find(p=>p.id===i.productId)!.salePrice})),input);return input.items.map(i=>({productId:i.productId,...prices.get(i.productId)}))},{isolationLevel:'ReadCommitted'});return NextResponse.json({success:true,data})})
