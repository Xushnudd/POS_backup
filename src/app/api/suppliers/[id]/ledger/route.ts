import {Prisma} from '@prisma/client'
import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {prisma} from '@/lib/prisma'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError,tenantScope} from '@/server/auth/policy'
import {financeManager} from '@/server/finance/accounts'
import {invoiceSchema,registerSupplierInvoice,supplierBalances} from '@/server/purchases/suppliers'
import {paging,pagination} from '@/server/catalog/queries'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');financeManager(ctx);const {id}=await params,{page,limit,skip}=paging(request.nextUrl.searchParams);
 const data=await prisma.$transaction(async tx=>{if(!await tx.supplier.findFirst({where:{id,organizationId:ctx.organizationId}}))throw new AccessError(404,'NOT_FOUND');const where={supplierId:id,AND:tenantScope('SupplierInvoice',ctx)},paymentWhere={supplierId:id,AND:tenantScope('SupplierPayment',ctx)};
 const [invoiceCount,paymentCount,invoices,payments,summary]=await Promise.all([tx.supplierInvoice.count({where}),tx.supplierPayment.count({where:paymentWhere}),tx.supplierInvoice.findMany({where,include:{stockDocument:{select:{id:true,documentNo:true}}},orderBy:[{createdAt:'desc'},{id:'asc'}],take:limit,skip}),tx.supplierPayment.findMany({where:paymentWhere,include:{financialDocument:{include:{entries:{include:{account:{select:{id:true,name:true,kind:true}}}}}},_count:{select:{allocations:true}}},orderBy:[{createdAt:'desc'},{id:'asc'}],take:limit,skip}),supplierBalances(tx,ctx,id)]);
 const invoiceTotals=invoices.length?await tx.$queryRaw<{id:string;netAmount:Prisma.Decimal;creditAmount:Prisma.Decimal;allocatedAmount:Prisma.Decimal}[]>(Prisma.sql`SELECT i.id,i."netAmount",i."creditAmount",COALESCE((SELECT sum(amount) FROM "SupplierAllocationBalance" WHERE "invoiceId"=i.id),0) AS "allocatedAmount" FROM "SupplierInvoiceBalance" i WHERE id IN (${Prisma.join(invoices.map(i=>i.id))})`):[];
 const paymentTotals=payments.length?await tx.$queryRaw<{id:string;allocatedAmount:Prisma.Decimal}[]>(Prisma.sql`SELECT "paymentId" AS id,sum(amount) AS "allocatedAmount" FROM "SupplierAllocationBalance" WHERE "paymentId" IN (${Prisma.join(payments.map(p=>p.id))}) GROUP BY "paymentId"`):[];
 const invoiceSums=new Map(invoiceTotals.map(r=>[r.id,r])),paymentSums=new Map(paymentTotals.map(r=>[r.id,r.allocatedAmount]));
 return {invoices:invoices.map(i=>({...i,...invoiceSums.get(i.id)})),payments:payments.map(p=>({...p,allocatedAmount:paymentSums.get(p.id)??'0'})),summary,invoicePagination:pagination(page,limit,invoiceCount),paymentPagination:pagination(page,limit,paymentCount)};
 },{isolationLevel:'RepeatableRead'});return NextResponse.json({success:true,data});
});
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');const {id}=await params;return NextResponse.json({success:true,data:await registerSupplierInvoice(ctx,invoiceSchema.parse({...await request.json(),supplierId:id}))});});
