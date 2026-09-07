import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'
import { z } from 'zod'

const updateSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    productName: z.string(),
    sku: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    discountAmount: z.number().default(0),
    unitCost: z.number().positive(),
  })).optional(),
  discountAmount: z.number().optional(),
  note: z.string().optional(),
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

    const sale = await prisma.sale.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        items: true,
        payments: true,
        register: true,
        shift: true,
      },
    })

    if (!sale) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Savdo topilmadi' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: sale,
    })

  } catch (error) {
    console.error('Get sale error:', error)
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
    const validatedData = updateSaleSchema.parse(body)

    const sale = await prisma.sale.findUnique({
      where: { id: params.id },
    })

    if (!sale) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Savdo topilmadi' } },
        { status: 404 }
      )
    }

    if (sale.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Faqat draft statusidagi savdoni tahrirlash mumkin' } },
        { status: 400 }
      )
    }

    // Update sale with new data
    const updatedSale = await prisma.$transaction(async (tx) => {
      // Delete existing items
      await tx.saleItem.deleteMany({
        where: { saleId: params.id },
      })

      // Recalculate totals if items provided
      let subtotal = sale.subtotal
      let totalAmount = sale.totalAmount

      if (validatedData.items) {
        subtotal = validatedData.items.reduce(
          (sum, item) => sum + (item.quantity * item.unitPrice - item.discountAmount),
          0
        )
        totalAmount = subtotal - (validatedData.discountAmount || sale.discountAmount)

        // Create new items
        await tx.saleItem.createMany({
          data: validatedData.items.map(item => ({
            saleId: params.id,
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount,
            lineTotal: item.quantity * item.unitPrice - item.discountAmount,
            unitCost: item.unitCost,
          })),
        })
      }

      return await tx.sale.update({
        where: { id: params.id },
        data: {
          ...(validatedData.customerId !== undefined && { customerId: validatedData.customerId }),
          ...(validatedData.discountAmount !== undefined && { discountAmount: validatedData.discountAmount }),
          ...(validatedData.note !== undefined && { note: validatedData.note }),
          ...(validatedData.items && { subtotal, totalAmount }),
        },
      })
    })

    return NextResponse.json({
      success: true,
      data: updatedSale,
      message: 'Savdo muvaffaqiyatli yangilandi',
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.errors } },
        { status: 400 }
      )
    }

    console.error('Update sale error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}