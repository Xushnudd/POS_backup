import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'

const createProductSchema = z.object({
  organizationId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  name: z.string().min(2),
  sku: z.string().min(2),
  barcode: z.string().min(2),
  unit: z.string().default('dona'),
  salePrice: z.number().positive(),
  costPrice: z.number().positive(),
  minStock: z.number().default(0),
  imageUrl: z.string().url().optional(),
})

const updateProductSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(2).optional(),
  sku: z.string().min(2).optional(),
  barcode: z.string().min(2).optional(),
  unit: z.string().optional(),
  salePrice: z.number().positive().optional(),
  costPrice: z.number().positive().optional(),
  minStock: z.number().optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
})

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
    const search = searchParams.get('search')
    const categoryId = searchParams.get('categoryId')
    const barcode = searchParams.get('barcode')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAM', message: 'Organization ID talab qilinadi' } },
        { status: 400 }
      )
    }

    // Search by barcode
    if (barcode) {
      const product = await db.product.findFirst({
        where: {
          organizationId,
          barcode,
          isActive: true,
        },
        include: {
          category: true,
        },
      })

      if (!product) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Mahsulot topilmadi' } },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: product,
      })
    }

    // Build where clause
    const where: any = {
      organizationId,
      isActive: true,
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          category: true,
        },
        orderBy: {
          name: 'asc',
        },
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ])

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
    if (error instanceof AccessError) throw error
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}

async function handlePOST(request: NextRequest) {
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

    const body = await request.json()
    const validatedData = createProductSchema.parse(body)

    // Check if SKU or barcode already exists
    const existingProduct = await db.product.findFirst({
      where: {
        organizationId: validatedData.organizationId,
        OR: [
          { sku: validatedData.sku },
          { barcode: validatedData.barcode },
        ],
      },
    })

    if (existingProduct) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'SKU yoki barkod allaqachon mavjud' } },
        { status: 400 }
      )
    }

    const product = await db.product.create({
      data: validatedData,
      include: {
        category: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Mahsulot muvaffaqiyatli yaratildi',
    })

  } catch (error) {
    if (error instanceof AccessError) throw error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.issues } },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}
export const GET = withApi(handleGET)

export const POST = withApi(handlePOST)
