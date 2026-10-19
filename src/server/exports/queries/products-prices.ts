import {cursorExport,EXPORT_PAGE_SIZE} from '../cursor'
import {NextResponse} from "next/server"
import {AccessError} from "@/server/auth/policy"
import {prisma} from "@/lib/prisma"
import {exporting,exportCap,pagination} from "@/server/catalog/queries"
import {csv,numeric} from "@/server/exports/csv"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
import {Prisma} from '@prisma/client'
import {journalListSorts,parseListQuery} from '@/lib/list-query'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function queryProductsPrices(ctx:TokenPayload,request:NextRequest) {
 
 if(ctx.role==='cashier')throw new AccessError(403,'FORBIDDEN');
 const q=request.nextUrl.searchParams,field=q.get('field')??'salePrice';if(!['salePrice','costPrice'].includes(field))throw new AccessError(400,'INVALID_FILTER');
 if(field==='costPrice'&&ctx.role!=='owner')throw new AccessError(403,'COST_CHANGE_FORBIDDEN');
 let list;try{list=parseListQuery(q,journalListSorts,'newest')}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER')}
 const {page,limit,skip,search,sort}=list,isExport=await exporting(q,ctx,'prices.export');
 const where:Prisma.ProductPriceHistoryWhereInput={organizationId:ctx.organizationId,field,...(q.get('productId')?{productId:q.get('productId')!}:{}),...(search?{OR:[{productName:{contains:search,mode:'insensitive'}},{sku:{contains:search,mode:'insensitive'}},{source:{contains:search,mode:'insensitive'}}]}:{})};
 const orderBy:Prisma.ProductPriceHistoryOrderByWithRelationInput[]=[{createdAt:sort==='oldest'?'asc':'desc'},{id:'asc'}];
 const data=await prisma.$transaction(async tx=>{
  const total=await tx.productPriceHistory.count({where});if(isExport)exportCap(total);
  const rows=isExport?await cursorExport(cursor=>tx.productPriceHistory.findMany({where,orderBy,take:EXPORT_PAGE_SIZE,...(cursor?{cursor:{id:cursor},skip:1}:{})})):await tx.productPriceHistory.findMany({where,orderBy,skip,take:limit});
  if(isExport)return {success:true,data:{filename:'price-history.csv',content:csv([['Mahsulot','SKU','Maydon','Avval','Keyin','Manba','Actor ID','UTC'],...rows.map(row=>[row.productName,row.sku,row.field,row.oldValue===null?'':numeric(row.oldValue,6),numeric(row.newValue,6),row.source,row.actorId,row.createdAt.toISOString()])])}};
  return {success:true,data:rows,pagination:pagination(page,limit,total)};
 },{isolationLevel:'RepeatableRead'});return NextResponse.json(data);
}
