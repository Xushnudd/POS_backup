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
  documentType: z.enum(['purchase', 'adjustment', 'transfer_out', 'transfer_in', 'return_in']),
  documentNo: z.string().trim().min(1),
  note: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().finite().refine(v => v !== 0),
    unitCost: z.number().nonnegative(),
    note: z.string().optional(),
  })).min(1),
}).refine(doc => doc.documentType === "adjustment" || doc.items.every(item => item.quantity > 0), "Kirim miqdori musbat bo‘lishi kerak")

const updateStockDocumentSchema = z.object({
  supplierId: z.string().uuid().optional(),
  note: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    unitCost: z.number().positive(),
    note: z.string().optional(),
  })).optional(),
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
    const storeId = searchParams.get('storeId')
    const documentType = searchParams.get('documentType')
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

    const where: Prisma.StockDocumentWhereInput = {
      organizationId,
    }

    if (storeId) where.storeId = storeId
    if (documentType) where.documentType = documentType
    if (status) where.status = status

    const [documents, total] = await Promise.all([
      db.stockDocument.findMany({
        where,
        include: {
          store: true,
          supplier: true,
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
      db.stockDocument.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: documents,
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
    const validatedData = createStockDocumentSchema.parse(body)
    const { items, ...documentData } = validatedData

    const document = await db.$transaction(async tx => {
      const result = await tx.stockDocument.create({
      data: {
        ...documentData,
        createdBy: payload.userId,
        items: {
          create: items,
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
