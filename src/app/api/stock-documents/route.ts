import {prisma} from '@/lib/prisma'
import {assertLiveContext} from '@/server/operations'
import {resolveConversion} from '@/server/catalog/conversions'
import { documentFilters } from '@/server/inventory/list-filters'
import { csv, numeric, productValue } from '@/server/exports/csv'
import { paging, exporting, exportCap, pagination } from '@/server/catalog/queries'
import { signedQuantitySchema, nonnegativeQuantitySchema } from '@/server/catalog/service'
import { Prisma } from '@prisma/client'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'

const createStockDocumentSchema = z.object({
  organizationId: z.string().uuid(),
  storeId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  documentType: z.enum(['purchase', 'opening', 'adjustment', 'transfer_out', 'transfer_in', 'return_in']),
  documentNo: z.string().trim().min(1),
  note: z.string().trim().max(2000).optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: signedQuantitySchema,
    tradeUnit:z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/).optional(),
    unitCost: nonnegativeQuantitySchema,
    note: z.string().trim().max(2000).optional(),
  })).min(1).max(500),
}).refine(doc => doc.documentType === "adjustment" || doc.items.every(item => Number(item.quantity) > 0), "Kirim miqdori musbat bo‘lishi kerak").refine(doc=>!['opening','adjustment'].includes(doc.documentType)||(doc.note?.length??0)>=3,'Boshlang‘ich qoldiq/tuzatish sababi kamida3 belgi bo‘lishi kerak').refine(doc=>new Set(doc.items.map(item=>item.productId)).size===doc.items.length,'Takror mahsulot qatorlari mumkin emas')

async function handleGET(request: NextRequest) {
  try {
    const token = getRequestToken(request)
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' } },
        { status: 401 }
      )
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Noto\'g\'ri token' } },
        { status: 401 }
      )
    }
    const db = scopedPrisma(payload)

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAM', message: 'Organization ID talab qilinadi' } },
        { status: 400 }
      )
    }

    const organization=await db.organization.findUniqueOrThrow({where:{id:payload.organizationId},select:{timezone:true}})
    const where:Prisma.StockDocumentWhereInput={organizationId,...documentFilters(searchParams,organization.timezone)}
    const {page,limit,skip}=paging(searchParams)
    const isExport=await exporting(searchParams,payload,'stock-document.export')
    const result=await db.$transaction(async tx=>{
      const total=await tx.stockDocument.count({where})
      if(isExport){exportCap(total);const lines=await tx.stockDocumentItem.count({where:{stockDocument:where}}),empty=await tx.stockDocument.count({where:{...where,items:{none:{}}}});exportCap(lines+empty)}
      const rows=await tx.stockDocument.findMany({where,include:{store:true,supplier:true,reversal:{select:{id:true,documentNo:true}},items:{include:{product:true},orderBy:{id:'asc'}}},orderBy:[{createdAt:'desc'},{id:'asc'}],...(!isExport?{skip,take:limit}:{})})
      if(isExport)return {success:true,data:{filename:'stock-documents-'+payload.organizationId+'.csv',content:csv([['Hujjat ID','Raqam','Sana (UTC)','Tasdiqlangan (UTC)','Filial','Supplier','Turi','Holat','Asl hujjat ID','Qarshi hujjat ID','Mahsulot (joriy)','Birlik (joriy)','Miqdor','Birlik tannarxi','Qator qiymati','Izoh'],...rows.flatMap(row=>{
        const prefix=[row.id,row.documentNo,row.createdAt.toISOString(),row.confirmedAt?.toISOString(),row.store.name,row.supplier?.name,row.documentType,row.status,row.reversalOfId,row.reversal?.id]
        return row.items.length?row.items.map(item=>[...prefix,item.product.name,item.product.unit,numeric(item.quantity,6),numeric(item.unitCost,6),numeric(productValue(item.quantity,item.unitCost)),item.note??row.note]):[[...prefix,'','','','','',row.note]]
      })])}}
      return {success:true,data:rows,pagination:pagination(page,limit,total)}
    },{isolationLevel:'RepeatableRead'})
    return NextResponse.json(result)

  } catch (error) {
    if (error instanceof AccessError) throw error
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}

async function handlePOST(request: NextRequest) {
  try {
    const token = getRequestToken(request)
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' } },
        { status: 401 }
      )
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Noto\'g\'ri token' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = createStockDocumentSchema.parse(body)
    const { items, ...documentData } = validatedData

    const document = await prisma.$transaction(async tx => {
      await assertLiveContext(tx,payload)
      const prepared=[];
      for(const item of items){const product=await tx.product.findFirst({where:{id:item.productId,organizationId:payload.organizationId}});if(!product)throw new AccessError(404,'PRODUCT_NOT_FOUND');const converted=await resolveConversion(tx,payload.organizationId,product,item.quantity,item.tradeUnit);const {tradeUnit:ignored,...row}=item;void ignored;prepared.push({...row,quantity:converted.quantity,conversionSnapshot:converted.snapshot??Prisma.DbNull})}
      const result = await tx.stockDocument.create({
      data: {
        ...documentData,
        createdBy: payload.userId,
        items: {
          create: prepared,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"StockDocument",entityId:result.id,action:"create"}})
      return result
    })

    return NextResponse.json({
      success: true,
      data: document,
      message: 'Ombor hujjati muvaffaqiyatli yaratildi',
    })

  } catch (error) {
    if (error instanceof AccessError) throw error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.issues } },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}

export const GET = withApi(handleGET)

export const POST = withApi(handlePOST)
