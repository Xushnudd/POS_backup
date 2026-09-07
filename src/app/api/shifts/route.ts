import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'
import { z } from 'zod'

const openShiftSchema = z.object({
  registerId: z.string().uuid(),
  organizationUserId: z.string().uuid(),
  openingCash: z.number().default(0),
  note: z.string().optional(),
})

const closeShiftSchema = z.object({
  countedCash: z.number(),
  note: z.string().optional(),
})

const cashMovementSchema = z.object({
  movementType: z.enum(['cash_in', 'cash_out']),
  amount: z.number().positive(),
  reason: z.string(),
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
    const registerId = searchParams.get('registerId')
    const status = searchParams.get('status')

    const where: any = {}

    if (registerId) {
      where.registerId = registerId
    }

    if (status) {
      where.status = status
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        register: true,
        organizationUser: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        openedAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      data: shifts,
    })

  } catch (error) {
    console.error('Get shifts error:', error)
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
    const validatedData = openShiftSchema.parse(body)

    // Check if there's already an open shift for this register
    const existingOpenShift = await prisma.shift.findFirst({
      where: {
        registerId: validatedData.registerId,
        status: 'open',
      },
    })

    if (existingOpenShift) {
      return NextResponse.json(
        { success: false, error: { code: 'SHIFT_ALREADY_OPEN', message: 'Bu kassa uchun allaqachon ochiq smena mavjud' } },
        { status: 400 }
      )
    }

    const shift = await prisma.shift.create({
      data: validatedData,
      include: {
        register: true,
        organizationUser: {
          include: {
            user: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: shift,
      message: 'Sena muvaffaqiyatli ochildi',
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.errors } },
        { status: 400 }
      )
    }

    console.error('Open shift error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}