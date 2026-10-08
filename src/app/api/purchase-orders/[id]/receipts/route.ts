import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {prisma} from '@/lib/prisma'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError,tenantScope} from '@/server/auth/policy'
import {financeManager} from '@/server/finance/accounts'
import {paging,pagination} from '@/server/catalog/queries'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');financeManager(ctx);const {id}=await params,{page,limit,skip}=paging(request.nextUrl.searchParams);const result=await prisma.$transaction(async tx=>{if(!await tx.purchaseOrder.findFirst({where:{id,AND:tenantScope('PurchaseOrder',ctx)}}))throw new AccessError(404,'NOT_FOUND');const where={orderId:id},total=await tx.purchaseReceipt.count({where});const data=await tx.purchaseReceipt.findMany({where,include:{stockDocument:{select:{id:true,documentNo:true,confirmedAt:true,supplierInvoice:{select:{id:true,amount:true,dueAt:true}},items:true}},lines:true},orderBy:[{createdAt:'desc'},{id:'asc'}],take:limit,skip});return {success:true,data,pagination:pagination(page,limit,total)};},{isolationLevel:'RepeatableRead'});return NextResponse.json(result);});
