import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'
import { z } from 'zod'

const creditPaymentSchema = z.object({
  organizationId: z.string().uuid(),
  storeId: z.string().uuid(),
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  referenceNo: z.string().optional(),
  note: z.string().optional(),
})

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
    const validatedData = creditPaymentSchema.parse(body)

    // Check customer's current debt
    const creditSales = await prisma.payment.aggregate({
      where: {
        customerId: validatedData.customerId,
        paymentType: 'credit',
        direction: 'in',
      },
      _sum: {
        amount: true,
      },
    })

    const creditPayments = await prisma.payment.aggregate({
      where: {
        customerId: validatedData.customerId,
        paymentType: 'credit',
        direction: 'out',
      },
      _sum: {
        amount: true,
      },
    })

    const currentDebt = (creditSales._sum.amount || 0) - (creditPayments._sum.amount || 0)

    if (validatedData.amount > currentDebt) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_AMOUNT', message: 'To\'lov summasi joriy qarzdan ko\'p bo\'lishi mumkin emas' } },
        { status: 400 }
      )
    }

    const payment = await prisma.payment.create({
      data: {
        organizationId: validatedData.organizationId,
        storeId: validatedData.storeId,
        customerId: validatedData.customerId,
        paymentType: 'credit',
        direction: 'out',
        amount: validatedData.amount,
        referenceNo: validatedData.referenceNo,
        note: validatedData.note,
        receivedBy: payload.userId,
      },
      include: {
        customer: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: payment,
      message: 'Nasiya undirildi',
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.errors } },
        { status: 400 }
      )
    }

    console.error('Credit payment error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}