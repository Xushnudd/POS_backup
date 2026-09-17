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
    const categoryId = searchParams.get('categoryId')
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
      sale: {
        organizationId,
        status: 'completed',
      },
    }

    if (storeId) where.sale.storeId = storeId
    if (categoryId) where.product.categoryId = categoryId
    if (startDate && endDate) {
      where.sale.completedAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const [productStats, total] = await Promise.all([
      prisma.saleItem.groupBy({
        by: ['productId'],
        where,
        _sum: {
          quantity: true,
          lineTotal: true,
        },
        _avg: {
          unitCost: true,
        },
        orderBy: {
          _sum: {
            lineTotal: 'desc',
          },
        },
        skip,
        take: limit,
      }),
      prisma.saleItem.groupBy({
        by: ['productId'],
        where,
      }).then(results => results.length),
    ])

    const products = await Promise.all(
      productStats.map(async (stat) => {
        const product = await prisma.product.findUnique({
          where: { id: stat.productId },
          include: {
            category: true,
          },
        })

        const revenue = Number(stat._sum.lineTotal)
        const cost = Number(stat._sum.quantity) * Number(stat._avg.unitCost)
        const profit = revenue - cost

        return {
          ...product,
          quantitySold: Number(stat._sum.quantity),
          revenue,
          cost,
          profit,
          profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })

  } catch (error) {
    console.error('Get products report error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}