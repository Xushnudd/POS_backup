import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'
import { z } from 'zod'

const createSaleSchema = z.object({
  organizationId: z.string().uuid(),
  storeId: z.string().uuid(),
  registerId: z.string().uuid(),
  shiftId: z.string().uuid(),
  cashierId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    productName: z.string(),
    sku: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    discountAmount: z.number().default(0),
    unitCost: z.number().positive(),
  })),
  discountAmount: z.number().default(0),
  note: z.string().optional(),
})

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

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    const storeId = searchParams.get('storeId')
    const shiftId = searchParams.get('shiftId')
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

    const where: any = {
      organizationId,
    }

    if (storeId) where.storeId = storeId
    if (shiftId) where.shiftId = shiftId
    if (status) where.status = status

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          customer: true,
          items: true,
          payments: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: sales,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })

  } catch (error) {
    console.error('Get sales error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
    const validatedData = createSaleSchema.parse(body)

    // Check if shift is open
    const shift = await prisma.shift.findUnique({
      where: { id: validatedData.shiftId },
    })

    if (!shift || shift.status !== 'open') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_SHIFT', message: 'Sena ochiq emas' } },
        { status: 400 }
      )
    }

    // Generate receipt number
    const receiptCount = await prisma.sale.count({
      where: {
        registerId: validatedData.registerId,
      },
    })
    const receiptNo = `RCP${String(receiptCount + 1).padStart(6, '0')}`

    // Calculate totals
    const subtotal = validatedData.items.reduce(
      (sum, item) => sum + (item.quantity * item.unitPrice - item.discountAmount),
      0
    )
    const totalAmount = subtotal - validatedData.discountAmount

    // Create sale with items in transaction
    const sale = await prisma.$transaction(async (tx) => {
      const createdSale = await tx.sale.create({
        data: {
          organizationId: validatedData.organizationId,
          storeId: validatedData.storeId,
          registerId: validatedData.registerId,
          shiftId: validatedData.shiftId,
          cashierId: validatedData.cashierId,
          customerId: validatedData.customerId,
          receiptNo,
          status: 'draft',
          subtotal,
          discountAmount: validatedData.discountAmount,
          totalAmount,
          note: validatedData.note,
        },
      })

      // Create sale items
      await tx.saleItem.createMany({
        data: validatedData.items.map(item => ({
          saleId: createdSale.id,
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

      return createdSale
    })

    return NextResponse.json({
      success: true,
      data: sale,
      message: 'Savdo muvaffaqiyatli yaratildi',
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.errors } },
        { status: 400 }
      )
    }

    console.error('Create sale error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}