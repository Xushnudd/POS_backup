import {cursorExport,EXPORT_PAGE_SIZE} from '../cursor'
import {assertLiveContext} from "@/server/operations"
import {createHash} from "node:crypto"
import {CATALOG_TTL_MS} from "@/lib/catalog-cache"
import {activeStatus} from "@/server/catalog/status"
import {csv,numeric,EXPORT_CAP} from "@/server/exports/csv"
import {consumeLimit} from "@/server/auth/rate-limit"
import {Prisma} from "@prisma/client"
import {AccessError} from "@/server/auth/policy"
import {scopedPrisma} from "@/server/auth/scoped-prisma"
import {NextResponse} from "next/server"
import {z} from "zod"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function queryProducts(payload:TokenPayload,request:NextRequest) {
  try {
    const db = scopedPrisma(payload)

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    const search = searchParams.get('search')
    const categoryId = searchParams.get('categoryId')
    const barcode = searchParams.get('barcode')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAM', message: 'Organization ID talab qilinadi' } },
        { status: 400 }
      )
    }

    if(searchParams.get('format')==='csv'&&barcode)throw new AccessError(400,'INVALID_FILTER')
    if(searchParams.has('identifier')){
      if(barcode||searchParams.has('format'))throw new AccessError(400,'INVALID_FILTER');
      const identifier=z.string().trim().min(2).max(200).parse(searchParams.get('identifier'));
      // Exact SKU first, then an unambiguous case-insensitive SKU/name. Never
      // take the first item of an old or truncated contains-search result.
      const include={category:true,unitConversions:{where:{isActive:true},orderBy:{tradeUnit:'asc'}}} as const;
      let product=await db.product.findFirst({where:{organizationId,isActive:true,sku:identifier},include});
      if(!product){
        const folded=(field:'sku'|'name')=>db.$queryRaw<{id:string}[]>(Prisma.sql`SELECT id FROM "Product" WHERE "organizationId"=${payload.organizationId} AND "isActive"=TRUE AND lower(${field==='sku'?Prisma.sql`sku`:Prisma.sql`name`})=lower(${identifier}) ORDER BY id LIMIT 2`);
        let matches=await folded('sku');
        if(!matches.length)matches=await folded('name');
        if(matches.length>1)throw new AccessError(409,'AMBIGUOUS_PRODUCT','Bir nechta mahsulot mos keldi. Ro‘yxatdan aniq mahsulotni tanlang.');
        product=matches[0]?await db.product.findFirst({where:{id:matches[0].id,organizationId,isActive:true},include}):null;
      }
      if(!product)throw new AccessError(404,'NOT_FOUND','Mahsulot topilmadi');
      const units=await db.unit.findMany({where:{organizationId:payload.organizationId,code:{in:[product.unit,...product.unitConversions.map(row=>row.tradeUnit)]}}});
      return NextResponse.json({success:true,data:{...product,unitPrecision:units.find(unit=>unit.code===product.unit)?.precision??6,unitConversions:product.unitConversions.map(row=>({...row,tradePrecision:units.find(unit=>unit.code===row.tradeUnit)?.precision??6}))}});
    }
    // Search by barcode
    if (barcode) {
      const product = await db.product.findFirst({
        where: {
          organizationId,
          OR:[{barcode},{barcodes:{some:{value:barcode}}}],
          isActive: true,
        },
        include: {
          category: true,
          unitConversions:{where:{isActive:true},orderBy:{tradeUnit:'asc'}},
        },
      })

      if (!product) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Mahsulot topilmadi' } },
          { status: 404 }
        )
      }

      const units=await db.unit.findMany({where:{organizationId:payload.organizationId,code:{in:[product.unit,...product.unitConversions.map(row=>row.tradeUnit)]}}});
      return NextResponse.json({
        success: true,
        data: {...product,unitPrecision:units.find(unit=>unit.code===product.unit)?.precision??6,unitConversions:product.unitConversions.map(row=>({...row,tradePrecision:units.find(unit=>unit.code===row.tradeUnit)?.precision??6}))},
      })
    }

    // Build where clause
    const where: Prisma.ProductWhereInput = {
      organizationId,
      ...activeStatus(searchParams, payload),
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        {barcodes:{some:{value:{contains:search,mode:'insensitive'}}}},
      ]
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if(searchParams.get('format')==='csv'){
      if(payload.role==='cashier')throw new AccessError(403,'FORBIDDEN')
      await consumeLimit('catalog.export',payload.organizationId+':'+payload.userId,10,60000)
      const data=await db.$transaction(async tx=>{
      await assertLiveContext(tx,payload)
        const total=await tx.product.count({where})
        if(total>EXPORT_CAP)throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 qatordan oshdi; filtrni toraytiring')
        const rows=await cursorExport(cursor=>tx.product.findMany({where,orderBy:[{name:'asc'},{id:'asc'}],select:{id:true,name:true,sku:true,barcode:true,unit:true,salePrice:true,costPrice:true,minStock:true,category:{select:{name:true}},barcodes:{select:{value:true},orderBy:{value:'asc'}}},take:EXPORT_PAGE_SIZE,...(cursor?{cursor:{id:cursor},skip:1}:{})}))
        return {filename:'products-'+payload.organizationId+'.csv',content:csv([['ID','Mahsulot','SKU','Asosiy barkod','Qo‘shimcha barkodlar','Birlik','Kategoriya','Sotuv narxi',...(payload.role==='owner'?['Tannarx']:[]),'Minimal qoldiq'],...rows.map(row=>[row.id,row.name,row.sku,row.barcode,row.barcodes.map(code=>code.value).join(' | '),row.unit,row.category?.name,numeric(row.salePrice),...(payload.role==='owner'?[numeric(row.costPrice,6)]:[]),numeric(row.minStock,6)])])}
      },{isolationLevel:'RepeatableRead'})
      return NextResponse.json({success:true,data})
    }

    const [products, total] = await db.$transaction(async tx=>{
      await assertLiveContext(tx,payload)
      const rows=await tx.product.findMany({where,include:{category:true,unitConversions:{where:{isActive:true},orderBy:{tradeUnit:'asc'}}},orderBy:[{name:'asc'},{id:'asc'}],skip,take:limit})
      return [rows,await tx.product.count({where})] as const
    },{isolationLevel:'RepeatableRead'})

    const units=await db.unit.findMany({where:{code:{in:[...new Set(products.flatMap(product=>[product.unit,...product.unitConversions.map(row=>row.tradeUnit)]))]}}})
    const catalogData=products.map(product=>({...product,unitConversions:product.unitConversions.map(row=>({...row,tradePrecision:units.find(unit=>unit.code===row.tradeUnit)?.precision??6})),unitPrecision:units.find(unit=>unit.code===product.unit)?.precision??6}));
    const issuedAt=new Date();
    return NextResponse.json({
      success: true,
      data: catalogData,
      catalogLease:{version:createHash('sha256').update(JSON.stringify({organizationId:payload.organizationId,role:payload.role,search,categoryId,page,limit,products:catalogData.map(p=>({id:p.id,updatedAt:p.updatedAt,price:p.salePrice,unit:p.unit,precision:p.unitPrecision,conversions:p.unitConversions.map(row=>({unit:row.tradeUnit,ratio:row.ratio,precision:row.tradePrecision})),active:p.isActive}))})).digest('hex'),issuedAt:issuedAt.toISOString(),expiresAt:new Date(issuedAt.getTime()+CATALOG_TTL_MS).toISOString()},
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })

  } catch (error) {
    if (error instanceof Prisma.PrismaClientUnknownRequestError) throw error
    if (error instanceof z.ZodError) throw error
    if (error instanceof AccessError) throw error
    if (error instanceof Prisma.PrismaClientKnownRequestError) throw error
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}
