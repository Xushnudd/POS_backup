import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {prisma} from '@/lib/prisma'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError,tenantScope} from '@/server/auth/policy'
import {financeManager} from '@/server/finance/accounts'
import {createPurchaseOrder,orderSchema} from '@/server/purchases/orders'
import {paging,pagination} from '@/server/catalog/queries'
export const POST=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await createPurchaseOrder(ctx,orderSchema.parse(await request.json()))});});
export const GET=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');financeManager(ctx);const {page,limit,skip}=paging(request.nextUrl.searchParams),supplierId=request.nextUrl.searchParams.get('supplierId');const where={AND:tenantScope('PurchaseOrder',ctx),...(supplierId?{supplierId}:{})};const result=await prisma.$transaction(async tx=>{const total=await tx.purchaseOrder.count({where});const data=await tx.purchaseOrder.findMany({where,include:{store:{select:{id:true,name:true}},supplier:{select:{id:true,name:true}}},orderBy:[{createdAt:'desc'},{id:'asc'}],take:limit,skip});return {success:true,data,pagination:pagination(page,limit,total)};},{isolationLevel:'RepeatableRead'});return NextResponse.json(result);});
