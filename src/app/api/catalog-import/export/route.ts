import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {prisma} from '@/lib/prisma'
import {assertLiveContext} from '@/server/operations'
import {consumeLimit} from '@/server/auth/rate-limit'
import {xlsxTable} from '@/server/exports/xlsx'
import {csv} from '@/server/exports/csv'
import {z} from 'zod'
export const GET=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED');await consumeLimit('catalog.export',ctx.organizationId+':'+ctx.userId,10,60000);const q=request.nextUrl.searchParams,format=z.enum(['csv','xlsx']).parse(q.get('format')??'csv'),search=q.get('search')??'';if(search.length>200)throw new AccessError(400,'INVALID_FILTER');const rows=await prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx);const where={organizationId:ctx.organizationId,isActive:true,...(q.get('categoryId')?{categoryId:q.get('categoryId')!}:{}),...(search?{OR:['name','sku','barcode'].map(field=>({[field]:{contains:search,mode:'insensitive' as const}}))}:{})};if(await tx.product.count({where})>10000)throw new AccessError(413,'EXPORT_TOO_LARGE');return tx.product.findMany({where,orderBy:[{name:'asc'},{id:'asc'}],include:{category:{select:{name:true}},barcodes:{select:{value:true},orderBy:{value:'asc'}}}})},{isolationLevel:'RepeatableRead'});
 const table=[['ID','Mahsulot','SKU','Asosiy barkod','Qo‘shimcha barkodlar','Birlik','Kategoriya','Sotuv narxi','Tannarx','Minimal qoldiq'],...rows.map(p=>[p.id,p.name,p.sku,p.barcode,p.barcodes.filter(b=>b.value!==p.barcode).map(b=>b.value).join(' | '),p.unit,p.category?.name??'',p.salePrice.toFixed(2),p.costPrice.toFixed(6),p.minStock.toString()])];return NextResponse.json({success:true,data:{filename:'products-'+ctx.organizationId+'.'+format,content:format==='csv'?csv(table):await xlsxTable(table),encoding:format==='csv'?'utf8':'base64'}})
})
