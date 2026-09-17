import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'
import { z } from 'zod'

const createPaymentSchema = z.object({
  organizationId: z.string().uuid(),
  storeId: z.string().uuid(),
  shiftId: z.string().uuid().optional(),
  saleId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  paymentType: z.enum(['cash', 'card', 'transfer', 'credit']),
  direction: z.enum(['in', 'out']),
  amount: z.number().positive(),
  referenceNo: z.string().optional(),
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
    const customerId = searchParams.get('customerId')
    const paymentType = searchParams.get('paymentType')
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

    if (customerId) where.customerId = customerId
    if (paymentType) where.paymentType = paymentType

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          customer: true,
          sale: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })

  } catch (error) {
    console.error('Get payments error:', error)
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
    const validatedData = createPaymentSchema.parse(body)

    const payment = await prisma.payment.create({
      data: {
        ...validatedData,
        receivedBy: payload.userId,
      },
      include: {
        customer: true,
        sale: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: payment,
      message: 'To\'lov muvaffaqiyatli yaratildi',
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.errors } },
        { status: 400 }
      )
    }

    console.error('Create payment error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}