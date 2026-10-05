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
    const storeId = searchParams.get('storeId')
    const categoryId = searchParams.get('categoryId')
    const lowStock = searchParams.get('lowStock') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: any = {}

    if (storeId) {
      where.storeId = storeId
    }

    if (categoryId) {
      where.product = {
        categoryId,
      }
    }

    if (lowStock) {
      where.product = {
        ...where.product,
        minStock: {
          gt: 0,
        },
      }
    }

    const [balances, total] = await Promise.all([
      db.inventoryBalance.findMany({
        where,
        include: {
          product: {
            include: {
              category: true,
            },
          },
          store: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        skip,
        take: limit,
      }),
      db.inventoryBalance.count({ where }),
    ])

    // Filter low stock if requested
    let filteredBalances = balances
    if (lowStock) {
      filteredBalances = balances.filter(
        balance => Number(balance.quantity) < Number(balance.product.minStock)
      )
    }

    return NextResponse.json({
      success: true,
      data: filteredBalances,
      pagination: {
        page,
        limit,
        total: lowStock ? filteredBalances.length : total,
        totalPages: Math.ceil((lowStock ? filteredBalances.length : total) / limit),
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
