import { transferFilters } from '@/server/inventory/list-filters'
import {assertLiveContext} from '@/server/operations'
import { csv, numeric } from '@/server/exports/csv'
import { paging, exporting, exportCap, pagination } from '@/server/catalog/queries'
import { quantitySchema } from '@/server/sales/service'
import { nonnegativeQuantitySchema } from '@/server/catalog/service'
import { Prisma } from '@prisma/client'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'

const createTransferSchema = z.object({
  organizationId: z.string().uuid(),
  fromStoreId: z.string().uuid(),
  toStoreId: z.string().uuid(),
  note: z.string().max(2000).optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: quantitySchema,
    unitCost: nonnegativeQuantitySchema,
  })).min(1).max(500),
})

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
    const where:Prisma.StockTransferWhereInput={organizationId,...transferFilters(searchParams,organization.timezone)}
    const {page,limit,skip}=paging(searchParams)
    const isExport=await exporting(searchParams,payload,'transfer.export')
    const result=await db.$transaction(async tx=>{
      await assertLiveContext(tx,payload)
      const total=await tx.stockTransfer.count({where})
      if(isExport){exportCap(total);const lines=await tx.stockTransferItem.count({where:{stockTransfer:where}}),empty=await tx.stockTransfer.count({where:{...where,items:{none:{}}}});exportCap(lines+empty)}
      const rows=await tx.stockTransfer.findMany({where,include:{fromStore:true,toStore:true,items:{include:{product:true,dispositions:true},orderBy:{id:'asc'}}},orderBy:[{createdAt:'desc'},{id:'asc'}],...(!isExport?{skip,take:limit}:{})})
      if(isExport)return {success:true,data:{filename:'transfers-'+payload.organizationId+'.csv',content:csv([['ID','Yaratilgan (UTC)','Jo‘natilgan (UTC)','Qabul yopilgan (UTC)','Jo‘natuvchi','Qabul qiluvchi','Holat','Mahsulot (joriy)','Birlik (joriy)','Rejalangan miqdor','Qabul miqdori','Manbaga qaytarilgan','Ajratilmagan miqdor','Birlik tannarxi','Izoh','Brak','Tasdiqlangan kamomad'],...rows.flatMap(row=>{
        const prefix=[row.id,row.createdAt.toISOString(),row.sentAt?.toISOString(),row.receivedAt?.toISOString(),row.fromStore.name,row.toStore.name,row.status]
        return row.items.length?row.items.map(item=>[...prefix,item.product.name,item.product.unit,numeric(item.quantity,6),numeric(item.receivedQuantity,6),numeric(item.returnedQuantity,6),numeric(item.quantity.sub(item.receivedQuantity).sub(item.returnedQuantity).sub(item.damagedQuantity).sub(item.shortageQuantity),6),numeric(item.unitCost,6),row.note,numeric(item.damagedQuantity,6),numeric(item.shortageQuantity,6)]):[[...prefix,'','','','','','','',row.note,'','']]
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
    const db = scopedPrisma(payload)

    const body = await request.json()
    const validatedData = createTransferSchema.parse(body)

    if (validatedData.fromStoreId === validatedData.toStoreId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STORES', message: 'Yuboruvchi va qabul qiluvchi do\'konlar bir xil bo\'lishi mumkin emas' } },
        { status: 400 }
      )
    }

    const transfer = await db.$transaction(async tx => {
      await assertLiveContext(tx,payload)
      const result = await tx.stockTransfer.create({
      data: {
        organizationId: validatedData.organizationId,
        fromStoreId: validatedData.fromStoreId,
        toStoreId: validatedData.toStoreId,
        note: validatedData.note,
        createdBy: payload.userId,
        items: { create: validatedData.items },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"StockTransfer",entityId:result.id,action:"create"}})
      return result
    })

    return NextResponse.json({
      success: true,
      data: transfer,
      message: 'Transfer muvaffaqiyatli yaratildi',
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
