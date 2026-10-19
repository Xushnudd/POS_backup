import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError,tenantScope} from '@/server/auth/policy'
import {prisma} from '@/lib/prisma'
import {postExchange,exchangeSchema} from '@/server/returns/exchanges'
export const POST=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await postExchange(ctx,exchangeSchema.parse(await request.json()))})})
export const GET=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');if(!['owner','admin'].includes(ctx.role))throw new AccessError(403,'MANAGER_REQUIRED');const saleId=request.nextUrl.searchParams.get('saleId');if(!saleId)throw new AccessError(400,'SALE_ID_REQUIRED');const data=await prisma.saleExchange.findMany({where:{organizationId:ctx.organizationId,OR:[{originalSaleId:saleId},{replacementSaleId:saleId}],originalSale:tenantScope('Sale',ctx)},orderBy:[{createdAt:'desc'},{id:'desc'}],take:100});return NextResponse.json({success:true,data})})
