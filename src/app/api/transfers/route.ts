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
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAM', message: 'Organization ID talab qilinadi' } },
        { status: 400 }
      )
    }

    const where: Prisma.StockTransferWhereInput = {
      organizationId,
    }

    if (status) where.status = status

    const [transfers, total] = await Promise.all([
      db.stockTransfer.findMany({
        where,
        include: {
          fromStore: true,
          toStore: true,
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      db.stockTransfer.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: transfers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })

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
