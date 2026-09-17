import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'
import { z } from 'zod'

const cashMovementSchema = z.object({
  movementType: z.enum(['cash_in', 'cash_out']),
  amount: z.number().positive(),
  reason: z.string(),
})

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
    const validatedData = cashMovementSchema.parse(body)

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
        { success: false, error: { code: 'INVALID_STATUS', message: 'Faqat ochiq senada naqd pul harakati qilish mumkin' } },
        { status: 400 }
      )
    }

    const cashMovement = await prisma.cashMovement.create({
      data: {
        shiftId: id,
        ...validatedData,
        createdBy: payload.userId,
      },
    })

    return NextResponse.json({
      success: true,
      data: cashMovement,
      message: 'Naqd pul harakati muvaffaqiyatli qayd etildi',
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.errors } },
        { status: 400 }
      )
    }

    console.error('Create cash movement error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}