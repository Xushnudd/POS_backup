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
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAM', message: 'Organization ID talab qilinadi' } },
        { status: 400 }
      )
    }

    const startDate = new Date(date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)

    const where: any = {
      organizationId,
      status: 'completed',
      completedAt: {
        gte: startDate,
        lte: endDate,
      },
    }

    if (storeId) where.storeId = storeId

    // Get today's sales
    const sales = await prisma.sale.findMany({
      where,
      include: {
        payments: true,
      },
    })

    const totalSales = sales.length
    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0)
    const averageCheck = totalSales > 0 ? totalRevenue / totalSales : 0

    // Payment breakdown
    const cashPayments = sales
      .flatMap(sale => sale.payments)
      .filter(p => p.paymentType === 'cash')
      .reduce((sum, p) => sum + Number(p.amount), 0)
    
    const cardPayments = sales
      .flatMap(sale => sale.payments)
      .filter(p => p.paymentType === 'card')
      .reduce((sum, p) => sum + Number(p.amount), 0)

    // Open shifts
    const openShifts = await prisma.shift.count({
      where: {
        status: 'open',
        ...(storeId && { register: { storeId } }),
      },
    })

    // Low stock items
    const lowStockItems = await prisma.inventoryBalance.findMany({
      where: {
        ...(storeId && { storeId }),
        product: {
          minStock: {
            gt: 0,
          },
        },
      },
      include: {
        product: true,
      },
    })

    const lowStockCount = lowStockItems.filter(
      balance => Number(balance.quantity) < Number(balance.product.minStock)
    ).length

    // Top products today
    const productSales = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          ...where,
        },
      },
      _sum: {
        quantity: true,
        lineTotal: true,
      },
      orderBy: {
        _sum: {
          lineTotal: 'desc',
        },
      },
      take: 5,
    })

    const topProducts = await Promise.all(
      productSales.map(async (ps) => {
        const product = await prisma.product.findUnique({
          where: { id: ps.productId },
          select: {
            id: true,
            name: true,
            sku: true,
          },
        })
        return {
          ...product,
          quantity: ps._sum.quantity,
          revenue: ps._sum.lineTotal,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        date,
        totalSales,
        totalRevenue,
        averageCheck,
        cashPayments,
        cardPayments,
        openShifts,
        lowStockCount,
        topProducts,
      },
    })

  } catch (error) {
    console.error('Get dashboard error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}