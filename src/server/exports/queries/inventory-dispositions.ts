import {cursorExport,EXPORT_PAGE_SIZE} from '../cursor'
import {NextResponse} from "next/server"
import {prisma} from "@/lib/prisma"
import {AccessError} from "@/server/auth/policy"
import {paging,exporting,exportCap,pagination} from "@/server/catalog/queries"
import {csv,numeric} from "@/server/exports/csv"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function queryInventoryDispositions(ctx:TokenPayload,request:NextRequest) {
 if(ctx.role==='cashier')throw new AccessError(403,'FORBIDDEN');
 const q=request.nextUrl.searchParams,{page,limit,skip}=paging(q),disposition=q.get('disposition');
 if(disposition&&!['damaged','write_off'].includes(disposition))throw new AccessError(400,'INVALID_FILTER');
 const where={organizationId:ctx.organizationId,...(ctx.role!=='owner'?{storeId:{in:ctx.storeIds}}:{}),...(q.get('storeId')?{storeId:q.get('storeId')!}:{}),...(disposition?{disposition}:{})};
 const isExport=await exporting(q,ctx,'disposition.export');
 const result=await prisma.$transaction(async tx=>{
  const total=await tx.returnDispositionEntry.count({where});if(isExport)exportCap(total);
  const rows=isExport?await cursorExport(cursor=>tx.returnDispositionEntry.findMany({where,include:{location:{select:{id:true,name:true}}},orderBy:[{createdAt:'desc'},{id:'asc'}],...(!isExport?{skip,take:limit}:{}),take:EXPORT_PAGE_SIZE,...(cursor?{cursor:{id:cursor},skip:1}:{})})):await tx.returnDispositionEntry.findMany({where,include:{location:{select:{id:true,name:true}}},orderBy:[{createdAt:'desc'},{id:'asc'}],...(!isExport?{skip,take:limit}:{})});
  // Only pairs on this page: bounded response; each balance includes all their matching entries.
  const summary=!isExport&&rows.length?await tx.returnDispositionEntry.groupBy({by:['storeId','productId','disposition','locationId'],where:{AND:[where,{OR:rows.map(row=>({storeId:row.storeId,productId:row.productId}))}]},_sum:{quantity:true}}):[];
  if(isExport)return {success:true,data:{filename:'return-dispositions.csv',content:csv([['Filial ID','Original return item','Mahsulot','SKU','Yo‘nalish','Joy','Miqdor','Birlik','Original tannarx','Actor ID','UTC'],...rows.map(row=>[row.storeId,row.returnItemId,row.productName,row.sku,row.disposition,row.location?.name,numeric(row.quantity,6),row.unit,numeric(row.unitCost,6),row.actorId,row.createdAt.toISOString()])])}};
  return {success:true,data:rows,summary,summaryScope:'pageProducts',pagination:pagination(page,limit,total)};
 },{isolationLevel:'RepeatableRead'});return NextResponse.json(result);
}
