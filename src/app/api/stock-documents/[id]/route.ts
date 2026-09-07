import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'
import { z } from 'zod'

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'))
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' } },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Noto\'g\'ri token' } },
        { status: 401 }
      )
    }

    const document = await prisma.stockDocument.findUnique({
      where: { id: params.id },
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
    console.error('Get stock document error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'))
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' } },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Noto\'g\'ri token' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = updateStockDocumentSchema.parse(body)

    const document = await prisma.stockDocument.findUnique({
      where: { id: params.id },
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
      // Delete existing items if new items provided
      if (validatedData.items) {
        await tx.stockDocumentItem.deleteMany({
          where: { stockDocumentId: params.id },
        })

        // Create new items
        await tx.stockDocumentItem.createMany({
          data: validatedData.items.map(item => ({
            stockDocumentId: params.id,
            ...item,
          })),
        })
      }

      return await tx.stockDocument.update({
        where: { id: params.id },
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.errors } },
        { status: 400 }
      )
    }

    console.error('Update stock document error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}