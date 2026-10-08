import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {prisma} from '@/lib/prisma'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError,tenantScope} from '@/server/auth/policy'
import {financeManager} from '@/server/finance/accounts'
import {paging,pagination,exporting,exportCap} from '@/server/catalog/queries'
import {csv,numeric} from '@/server/exports/csv'
export const GET=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');financeManager(ctx);const q=request.nextUrl.searchParams,{page,limit,skip}=paging(q),exportAll=await exporting(q,ctx,'finance.export');const where={AND:tenantScope('FinancialDocument',ctx),...(q.get('storeId')?{storeId:q.get('storeId')!}:{})};const result=await prisma.$transaction(async tx=>{const total=await tx.financialDocument.count({where});if(exportAll)exportCap(total);const rows=await tx.financialDocument.findMany({where,include:{category:true,entries:{include:{account:{select:{id:true,name:true,kind:true}}}},reversal:{select:{id:true}}},orderBy:[{createdAt:'desc'},{id:'asc'}],...exportAll?{}:{skip,take:limit}});if(exportAll)return {success:true,data:{filename:'financial-documents.csv',content:csv([['ID','Filial','Tur','Summa','Toifa','Hisobga olish','Sabab','Original','UTC'],...rows.map(r=>[r.id,r.storeId,r.kind,numeric(r.amount),r.category?.name,r.category?.treatment,r.reason,r.reversalOfId,r.createdAt.toISOString()])])}};return {success:true,data:rows,pagination:pagination(page,limit,total)};},{isolationLevel:'RepeatableRead'});return NextResponse.json(result);});
