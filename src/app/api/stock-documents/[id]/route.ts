import { signedQuantitySchema, nonnegativeQuantitySchema } from '@/server/catalog/service'
import { assertLiveContext, audit } from '@/server/operations'
import { prisma } from '@/lib/prisma'
import { AccessError, tenantScope } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'

const updateStockDocumentSchema = z.object({
  supplierId: z.string().uuid().optional(),
  note: z.string().max(2000).optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: signedQuantitySchema,
    unitCost: nonnegativeQuantitySchema,
    note: z.string().max(2000).optional(),
  })).min(1).max(500).optional(),
})

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const document = await db.stockDocument.findUnique({
      where: { id },
      include: {
        store: true,
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!document) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Hujjat topilmadi' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: document,
    })

  } catch (error) {
    if (error instanceof AccessError) throw error
    throw error
  }
}

async function handlePUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const validatedData = updateStockDocumentSchema.parse(body)

    const document = await db.stockDocument.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Hujjat topilmadi' } },
        { status: 404 }
      )
    }

    if (document.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Faqat draft statusidagi hujjatni tahrirlash mumkin' } },
        { status: 400 }
      )
    }

    const updatedDocument = await prisma.$transaction(async (tx) => {
      await assertLiveContext(tx,payload)
      await tx.$queryRaw`SELECT id FROM "StockDocument" WHERE id=${id} FOR UPDATE`
      const locked=await tx.stockDocument.findFirstOrThrow({where:{id,AND:tenantScope("StockDocument",payload)}})
      if (locked.status!=='draft') throw new AccessError(409,'INVALID_STATUS')
      if (validatedData.items && locked.documentType!=='adjustment' && validatedData.items.some(item=>Number(item.quantity)<=0)) throw new AccessError(400,'INVALID_QUANTITY')
      await audit(tx,payload,'StockDocument',id,'draft_updated',validatedData)
      // Delete existing items if new items provided
      if (validatedData.items) {
        await tx.stockDocumentItem.deleteMany({
          where: { stockDocumentId: id },
        })

        // Create new items
        await tx.stockDocumentItem.createMany({
          data: validatedData.items.map(item => ({
            stockDocumentId: id,
            ...item,
          })),
        })
      }

      return await tx.stockDocument.update({
        where: { id },
        data: {
          ...(validatedData.supplierId !== undefined && { supplierId: validatedData.supplierId }),
          ...(validatedData.note !== undefined && { note: validatedData.note }),
        },
      })
    })

    return NextResponse.json({
      success: true,
      data: updatedDocument,
      message: 'Hujjat muvaffaqiyatli yangilandi',
    })

  } catch (error) {
    if (error instanceof AccessError) throw error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.issues } },
        { status: 400 }
      )
    }

    throw error
  }
}
export const GET = withApi(handleGET)

export const PUT = withApi(handlePUT)
