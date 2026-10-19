import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {prisma} from '@/lib/prisma'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError,tenantScope} from '@/server/auth/policy'
import {financeManager} from '@/server/finance/accounts'
import {pagination,exporting,exportCap} from '@/server/catalog/queries'
import {csv,numeric} from '@/server/exports/csv'
import {parseListQuery,financialListSorts} from '@/lib/list-query'
import {dateRange} from '@/server/reports/dates'
import {assertLiveContext} from '@/server/operations'
export const GET=withApi(async(request:NextRequest)=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');financeManager(ctx);
 const q=request.nextUrl.searchParams;
 let query;try{query=parseListQuery(q,financialListSorts,'newest')}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER')}
 const {page,limit,skip,sort,search}=query,kind=q.get('kind');
 if(kind&&(!/^[a-z][a-z_]{0,63}$/.test(kind)))throw new AccessError(400,'INVALID_FILTER');
 const exportAll=await exporting(q,ctx,'finance.export');
 const result=await prisma.$transaction(async tx=>{
  await assertLiveContext(tx,ctx);
  const org=await tx.organization.findUniqueOrThrow({where:{id:ctx.organizationId},select:{timezone:true}}),range=dateRange(q.get('from'),q.get('to'),org.timezone);
  const where={AND:tenantScope('FinancialDocument',ctx),...(q.get('storeId')?{storeId:q.get('storeId')!}:{}),...(kind?{kind}:{}),...(search?{reason:{contains:search,mode:'insensitive' as const}}:{}),...(Object.keys(range).length?{createdAt:range}:{})};
  const orderBy=sort==='amount_asc'||sort==='amount_desc'?[{amount:sort==='amount_asc'?'asc' as const:'desc' as const},{id:'asc' as const}]:[{createdAt:sort==='oldest'?'asc' as const:'desc' as const},{id:'asc' as const}];
  const total=await tx.financialDocument.count({where});if(exportAll)exportCap(total);
  const rows=await tx.financialDocument.findMany({where,include:{category:true,entries:{include:{account:{select:{id:true,name:true,kind:true}}}},reversal:{select:{id:true}}},orderBy,...(exportAll?{}:{skip,take:limit})});
  if(exportAll)return {success:true,data:{filename:'financial-documents.csv',content:csv([['ID','Filial','Tur','Summa','Toifa','Hisobga olish','Sabab','Original','UTC'],...rows.map(r=>[r.id,r.storeId,r.kind,numeric(r.amount),r.category?.name,r.category?.treatment,r.reason,r.reversalOfId,r.createdAt.toISOString()])])}};
  return {success:true,data:rows,pagination:pagination(page,limit,total)};
 },{isolationLevel:'RepeatableRead'});
 return NextResponse.json(result);
});
