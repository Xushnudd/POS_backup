import {queryTransfers} from '@/server/exports/queries/transfers'

import {assertLiveContext} from '@/server/operations'


import {quantitySchema} from '@/server/sales/service'
import {nonnegativeQuantitySchema} from '@/server/catalog/service'

import {AccessError} from '@/server/auth/policy'
import {scopedPrisma} from '@/server/auth/scoped-prisma'
import {withApi} from '@/server/api'
import {NextRequest,NextResponse} from 'next/server'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {z} from 'zod'

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

async function handleGET(request:NextRequest) {
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return queryTransfers(context,request)
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
