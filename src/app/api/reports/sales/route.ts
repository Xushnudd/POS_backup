import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'

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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAM', message: 'Organization ID talab qilinadi' } },
        { status: 400 }
      )
    }

    const where: any = {
      organizationId,
      status: 'completed',
    }

    if (storeId) where.storeId = storeId
    if (startDate && endDate) {
      where.completedAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          customer: true,
          register: true,
          cashier: {
            select: {
              id: true,
              fullName: true,
            },
          },
          payments: true,
        },
        orderBy: {
          completedAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ])

    // Calculate totals
    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0)
    const totalDiscount = sales.reduce((sum, sale) => sum + Number(sale.discountAmount), 0)
    const totalItems = sales.reduce((sum, sale) => sum + sale.items.length, 0)

    return NextResponse.json({
      success: true,
      data: sales,
      summary: {
        totalRevenue,
        totalDiscount,
        totalItems,
        averageSale: sales.length > 0 ? totalRevenue / sales.length : 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })

  } catch (error) {
    console.error('Get sales report error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}