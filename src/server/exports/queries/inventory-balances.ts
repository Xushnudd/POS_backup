import {parseListQuery,inventoryListSorts} from '@/lib/list-query'
import {csv,numeric,productValue,shortage} from "@/server/exports/csv"
import {exporting,exportCap,pagination} from "@/server/catalog/queries"
import {NextResponse} from "next/server"
import {Prisma} from "@prisma/client"
import {scopedPrisma} from "@/server/auth/scoped-prisma"
import {AccessError} from "@/server/auth/policy"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function queryInventoryBalances(context:TokenPayload,request:NextRequest) {
 const q=new URL(request.url).searchParams
 let query;try{query=parseListQuery(q,inventoryListSorts,'newest',50)}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER')}
 const {page,limit,skip,sort,search}=query
 const order=sort==='oldest'?Prisma.sql`b."updatedAt" ASC`:sort==='name_asc'?Prisma.sql`p.name ASC`:sort==='name_desc'?Prisma.sql`p.name DESC`:sort==='quantity_asc'?Prisma.sql`b.quantity ASC`:sort==='quantity_desc'?Prisma.sql`b.quantity DESC`:Prisma.sql`b."updatedAt" DESC`
 const store=q.get('storeId'),category=q.get('categoryId'),low=q.get('lowStock')==='true'
 if(q.has('lowStock')&&!['true','false'].includes(q.get('lowStock')!))throw new AccessError(400,'INVALID_FILTER')
 const inactiveDays=q.has('inactiveDays')?Number(q.get('inactiveDays')):null
 if(inactiveDays!==null&&(!Number.isSafeInteger(inactiveDays)||inactiveDays<1||inactiveDays>3650))throw new AccessError(400,'INVALID_FILTER')
 const observedAt=new Date(),inactiveSince=inactiveDays===null?null:new Date(observedAt.getTime()-inactiveDays*86400000)
 // A recent completed sale is activity even when later returned. Drafts are not.
 // Unknown legacy completion timestamps cannot establish inactivity.
 const inactivity=inactiveSince?Prisma.sql`AND b.quantity>0 AND NOT EXISTS (
  SELECT 1 FROM "SaleItem" si JOIN "Sale" sale ON sale.id=si."saleId"
  WHERE si."productId"=b."productId" AND sale."storeId"=b."storeId" AND sale."organizationId"=${context.organizationId}
   AND sale.status IN ('completed','partially_returned','returned') AND si.quantity>0
   AND (sale."completedAt" IS NULL OR sale."completedAt">=${inactiveSince})
 )`:Prisma.empty
 const meta={observedAt:observedAt.toISOString(),inactiveDays,inactiveSince:inactiveSince?.toISOString()??null,definition:inactiveDays===null?'current_stock_snapshot':'positive_current_stock_without_completed_sale_in_rolling_days'}
 const isExport=await exporting(q,context,'inventory-balance.export')
 const scope=context.role==='owner'?Prisma.empty:context.storeIds.length?Prisma.sql`AND b."storeId" IN (${Prisma.join(context.storeIds)})`:Prisma.sql`AND FALSE`
 const filter=Prisma.sql`FROM "InventoryBalance" b JOIN "Store" s ON s.id=b."storeId" JOIN "Product" p ON p.id=b."productId"
 WHERE s."organizationId"=${context.organizationId} AND p."organizationId"=${context.organizationId} ${scope} ${inactivity}
 ${store?Prisma.sql`AND b."storeId"=${store}`:Prisma.empty} ${category?Prisma.sql`AND p."categoryId"=${category}`:Prisma.empty}
 ${search?Prisma.sql`AND (p.name ILIKE ${'%'+search+'%'} OR p.sku ILIKE ${'%'+search+'%'} OR p.barcode ILIKE ${'%'+search+'%'})`:Prisma.empty}
 ${low?Prisma.sql`AND p."minStock">0 AND b.quantity<p."minStock"`:Prisma.empty}`
 const db=scopedPrisma(context)
 const result=await db.$transaction(async tx=>{
  const count=await tx.$queryRaw<{count:bigint}[]>(Prisma.sql`SELECT count(*) ${filter}`)
  const total=Number(count[0].count);if(isExport)exportCap(total)
  const keys=await tx.$queryRaw<{storeId:string;productId:string}[]>(Prisma.sql`SELECT b."storeId",b."productId" ${filter} ORDER BY ${order},b."storeId",b."productId" ${!isExport?Prisma.sql`LIMIT ${limit} OFFSET ${skip}`:Prisma.empty}`)
  const rows=[]
  for(let offset=0;offset<keys.length;offset+=500)rows.push(...await tx.inventoryBalance.findMany({where:{OR:keys.slice(offset,offset+500)},include:{product:{include:{category:true}},store:true}}))
  const byKey=new Map(rows.map(row=>[row.storeId+':'+row.productId,row]))
  const balances=keys.map(key=>byKey.get(key.storeId+':'+key.productId)!)
  if(isExport)return {success:true,meta,data:{filename:'stock-balances-'+context.organizationId+'.csv',content:csv([...(inactiveDays===null?[]:[['Savdosiz kunlar',String(inactiveDays)],['Oyna boshi UTC',meta.inactiveSince],['Kuzatilgan UTC',meta.observedAt],['Mezon','Musbat joriy qoldiq; shu filialda yakunlangan savdo yo‘q. Omborda turish yoshi emas.']]),['Filial ID','Filial','Mahsulot ID','Mahsulot','SKU','Barkod','Kategoriya','Birlik','Faol','Qoldiq','Minimal qoldiq','Minimalgacha yetishmaydi','Joriy birlik tannarxi','Joriy qoldiq qiymati','Yangilangan (UTC)'],...balances.map(row=>[row.storeId,row.store.name,row.productId,row.product.name,row.product.sku,row.product.barcode,row.product.category?.name,row.product.unit,row.product.isActive?'ha':'yo‘q',numeric(row.quantity,6),numeric(row.product.minStock,6),numeric(shortage(row.quantity,row.product.minStock),6),numeric(row.product.costPrice,6),numeric(productValue(row.quantity,row.product.costPrice)),row.updatedAt.toISOString()])])}}
  return {success:true,meta,data:balances,pagination:pagination(page,limit,total)}
 },{isolationLevel:'RepeatableRead',timeout:15000})
 return NextResponse.json(result)
}
