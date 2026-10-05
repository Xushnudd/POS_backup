import { dateRange } from '@/server/reports/dates'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { Prisma } from '@prisma/client'
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
      status: { in: ['completed','partially_returned','returned'] },
    }

    if (storeId) where.storeId = storeId
    const organization=await db.organization.findUniqueOrThrow({where:{id:payload.organizationId}})
    const range=dateRange(startDate,endDate,organization.timezone)
    if (Object.keys(range).length) where.completedAt = range

    const [sales, total, sums, itemCount, returns] = await Promise.all([
      db.sale.findMany({
        where,
        include: {
          items: true,
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
      db.sale.count({ where }),
      db.sale.aggregate({ where, _sum: { totalAmount: true, discountAmount: true } }),
      db.saleItem.count({ where: { sale: where } }),
      db.saleReturn.aggregate({ where: { ...(Object.keys(range).length && { returnedAt: range }), sale: { organizationId, ...(storeId && { storeId }) } }, _sum: { refundAmount: true } }),
    ])

    const grossRevenue = new Prisma.Decimal(sums._sum.totalAmount ?? 0)
    const refundAmount = new Prisma.Decimal(returns._sum.refundAmount ?? 0)
    const totalRevenue = grossRevenue.sub(refundAmount)
    const totalDiscount = new Prisma.Decimal(sums._sum.discountAmount ?? 0)
    const totalItems = itemCount

    return NextResponse.json({
      success: true,
      data: sales,
      summary: {
        totalRevenue,
        grossRevenue,
        refundAmount,
        totalDiscount,
        totalItems,
        averageSale: total > 0 ? totalRevenue.div(total).toDecimalPlaces(2).toString() : "0.00",
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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
