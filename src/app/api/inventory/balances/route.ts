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
      prisma.inventoryBalance.findMany({
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
      prisma.inventoryBalance.count({ where }),
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
    console.error('Get inventory balances error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}