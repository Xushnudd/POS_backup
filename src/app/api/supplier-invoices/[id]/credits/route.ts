import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {withApi} from '@/server/api'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {AccessError,tenantScope} from '@/server/auth/policy'
import {financeManager} from '@/server/finance/accounts'
import {creditSchema,creditSupplierInvoice} from '@/server/purchases/credits'
import {paging,pagination} from '@/server/catalog/queries'
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');const {preview,...body}=await request.json();return NextResponse.json({success:true,data:await creditSupplierInvoice(ctx,(await params).id,creditSchema.parse(body),z.boolean().parse(preview??false))});});
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');financeManager(ctx);const {id}=await params,{page,limit,skip}=paging(request.nextUrl.searchParams);const data=await prisma.$transaction(async tx=>{if(!await tx.supplierInvoice.findFirst({where:{id,AND:tenantScope('SupplierInvoice',ctx)}}))throw new AccessError(404,'NOT_FOUND');const where={invoiceId:id},total=await tx.supplierCredit.count({where});return {success:true,data:await tx.supplierCredit.findMany({where,include:{items:true},orderBy:[{createdAt:'desc'},{id:'asc'}],take:limit,skip}),pagination:pagination(page,limit,total)};},{isolationLevel:'RepeatableRead'});return NextResponse.json(data);});
