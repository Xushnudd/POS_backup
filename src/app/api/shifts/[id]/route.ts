import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'
import { z } from 'zod'

const closeShiftSchema = z.object({
  countedCash: z.number(),
  note: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        register: true,
        organizationUser: {
          include: {
            user: true,
          },
        },
        cashMovements: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        sales: {
          include: {
            items: true,
            payments: true,
          },
        },
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    if (!shift) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Sena topilmadi' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: shift,
    })

  } catch (error) {
    console.error('Get shift error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const validatedData = closeShiftSchema.parse(body)

    const shift = await prisma.shift.findUnique({
      where: { id },
    })

    if (!shift) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Sena topilmadi' } },
        { status: 404 }
      )
    }

    if (shift.status !== 'open') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Sena allaqachon yopilgan' } },
        { status: 400 }
      )
    }

    // Calculate expected cash
    const payments = await prisma.payment.findMany({
      where: {
        shiftId: id,
        paymentType: 'cash',
        direction: 'in',
      },
    })

    const cashMovements = await prisma.cashMovement.findMany({
      where: {
        shiftId: id,
      },
    })

    const cashIn = payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const cashInMovements = cashMovements
      .filter(cm => cm.movementType === 'cash_in')
      .reduce((sum, cm) => sum + Number(cm.amount), 0)
    const cashOutMovements = cashMovements
      .filter(cm => cm.movementType === 'cash_out')
      .reduce((sum, cm) => sum + Number(cm.amount), 0)

    const expectedCash = Number(shift.openingCash) + cashIn + cashInMovements - cashOutMovements
    const cashDifference = validatedData.countedCash - expectedCash

    const updatedShift = await prisma.shift.update({
      where: { id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        expectedCash,
        countedCash: validatedData.countedCash,
        cashDifference,
        note: validatedData.note,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedShift,
      message: 'Sena muvaffaqiyatli yopildi',
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.errors } },
        { status: 400 }
      )
    }

    console.error('Close shift error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}