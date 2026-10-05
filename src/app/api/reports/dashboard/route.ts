import { decimal } from '@/server/sales/calculations'
import { dateRange, localDate } from '@/server/reports/dates'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'

async function handleGET(request: NextRequest) {
  try {
    const token = getRequestToken(request)
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' } },
        { status: 401 }
      )
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Noto\'g\'ri token' } },
        { status: 401 }
      )
    }
    const db = scopedPrisma(payload)

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    const storeId = searchParams.get('storeId')
    const organization=await db.organization.findUniqueOrThrow({where:{id:payload.organizationId}})
    const date = searchParams.get('date') || localDate(new Date(),organization.timezone)

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAM', message: 'Organization ID talab qilinadi' } },
        { status: 400 }
      )
    }

    const range=dateRange(date,date,organization.timezone)

    const where: any = {
      organizationId,
      status: { in: ['completed','partially_returned','returned'] },
      completedAt: range,
    }

    if (storeId) where.storeId = storeId

    // Get today's sales
    const sales = await db.sale.findMany({
      where,
      include: {
        payments: true,
      },
    })

    const totalSales = sales.length
    const returns=await db.saleReturn.aggregate({where:{returnedAt:range,sale:{organizationId,...(storeId&&{storeId})}},_sum:{refundAmount:true}})
    const grossRevenue=sales.reduce((sum,sale)=>sum.add(sale.totalAmount),decimal(0))
    const refundAmount=decimal(returns._sum.refundAmount??0)
    const totalRevenue=grossRevenue.sub(refundAmount)
    const averageCheck=totalSales?totalRevenue.div(totalSales).toDecimalPlaces(2):decimal(0)
    const dayPayments=await db.payment.findMany({where:{paidAt:range,status:'recorded',...(storeId&&{storeId})}})
    const paymentTotal=(type:string)=>dayPayments.filter(p=>p.paymentType===type).reduce((sum,p)=>sum.add(p.direction==='in'?p.amount:p.amount.negated()),decimal(0))
    const cashPayments=paymentTotal('cash'),cardPayments=paymentTotal('card')

    // Open shifts
    const openShifts = await db.shift.count({
      where: {
        status: 'open',
        ...(storeId && { register: { storeId } }),
      },
    })

    // Low stock items
    const lowStockItems = await db.inventoryBalance.findMany({
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
    const productSales = await db.saleItem.groupBy({
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
        const product = await db.product.findUnique({
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
        grossRevenue,
        refundAmount,
        averageCheck,
        cashPayments,
        cardPayments,
        openShifts,
        lowStockCount,
        topProducts,
      },
    })

  } catch (error) {
    if (error instanceof AccessError) throw error
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}
export const GET = withApi(handleGET)
