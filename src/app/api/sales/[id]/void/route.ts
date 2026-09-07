import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'

export async function POST(
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
    })

    if (!sale) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Savdo topilmadi' } },
        { status: 404 }
      )
    }

    if (sale.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Faqat draft statusidagi savdoni bekor qilish mumkin' } },
        { status: 400 }
      )
    }

    const voidedSale = await prisma.sale.update({
      where: { id: params.id },
      data: {
        status: 'voided',
        voidedAt: new Date(),
        voidedBy: payload.userId,
      },
    })

    return NextResponse.json({
      success: true,
      data: voidedSale,
      message: 'Savdo muvaffaqiyatli bekor qilindi',
    })

  } catch (error) {
    console.error('Void sale error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}