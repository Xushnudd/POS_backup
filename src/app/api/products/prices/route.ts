import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {prisma} from '@/lib/prisma'
import {changePrices,priceBatchSchema} from '@/server/catalog/prices'
import {paging,exporting,exportCap,pagination} from '@/server/catalog/queries'
import {csv,numeric} from '@/server/exports/csv'
import {consumeLimit} from '@/server/auth/rate-limit'
export const POST=withApi(async(request:NextRequest)=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');
 await consumeLimit('prices.change',ctx.organizationId+':'+ctx.userId,30,60000);
 return NextResponse.json({success:true,data:await changePrices(ctx,priceBatchSchema.parse(await request.json()))});
});
export const GET=withApi(async(request:NextRequest)=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');
 if(ctx.role==='cashier')throw new AccessError(403,'FORBIDDEN');
 const q=request.nextUrl.searchParams,field=q.get('field')??'salePrice';if(!['salePrice','costPrice'].includes(field))throw new AccessError(400,'INVALID_FILTER');
 if(field==='costPrice'&&ctx.role!=='owner')throw new AccessError(403,'COST_CHANGE_FORBIDDEN');
 const {page,limit,skip}=paging(q),isExport=await exporting(q,ctx,'prices.export');
 const where={organizationId:ctx.organizationId,field,...(q.get('productId')?{productId:q.get('productId')!}:{})};
 const data=await prisma.$transaction(async tx=>{
  const total=await tx.productPriceHistory.count({where});if(isExport)exportCap(total);
  const rows=await tx.productPriceHistory.findMany({where,orderBy:[{createdAt:'desc'},{id:'asc'}],...(!isExport?{skip,take:limit}:{})});
  if(isExport)return {success:true,data:{filename:'price-history.csv',content:csv([['Mahsulot','SKU','Maydon','Avval','Keyin','Manba','Actor ID','UTC'],...rows.map(row=>[row.productName,row.sku,row.field,row.oldValue===null?'':numeric(row.oldValue,6),numeric(row.newValue,6),row.source,row.actorId,row.createdAt.toISOString()])])}};
  return {success:true,data:rows,pagination:pagination(page,limit,total)};
 },{isolationLevel:'RepeatableRead'});return NextResponse.json(data);
});
