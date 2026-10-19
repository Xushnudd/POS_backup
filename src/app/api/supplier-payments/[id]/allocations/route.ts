import {Prisma} from '@prisma/client'
import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {prisma} from '@/lib/prisma'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError,tenantScope} from '@/server/auth/policy'
import {financeManager} from '@/server/finance/accounts'
import {paging,pagination} from '@/server/catalog/queries'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');financeManager(ctx);const {id}=await params,{page,limit,skip}=paging(request.nextUrl.searchParams);const result=await prisma.$transaction(async tx=>{if(!await tx.supplierPayment.findFirst({where:{id,AND:tenantScope('SupplierPayment',ctx)}}))throw new AccessError(404,'NOT_FOUND');const where={paymentId:id};const [total,data]=await Promise.all([tx.supplierAllocation.count({where}),tx.supplierAllocation.findMany({where,include:{invoice:{select:{id:true,referenceNo:true}}},orderBy:[{createdAt:'asc'},{id:'asc'}],take:limit,skip})]);const balances=data.length?await tx.$queryRaw<{id:string;amount:Prisma.Decimal}[]>(Prisma.sql`SELECT id,amount FROM "SupplierAllocationBalance" WHERE id IN (${Prisma.join(data.map(r=>r.id))})`):[],byId=new Map(balances.map(r=>[r.id,r.amount]));return {success:true,data:data.map(r=>({...r,effectiveAmount:byId.get(r.id)??'0',releasedAmount:r.amount.sub(byId.get(r.id)??0)})),pagination:pagination(page,limit,total)};},{isolationLevel:'RepeatableRead'});return NextResponse.json(result);});
