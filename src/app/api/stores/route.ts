import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'
import { z } from 'zod'

const createStoreSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().optional(),
})

const updateStoreSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
})

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

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAM', message: 'Organization ID talab qilinadi' } },
        { status: 400 }
      )
    }

    // Get user's accessible stores
    const organizationUser = await prisma.organizationUser.findFirst({
      where: {
        userId: payload.userId,
        organizationId,
        isActive: true,
      },
      include: {
        userStores: {
          include: {
            store: {
              include: {
                registers: {
                  where: { isActive: true },
                },
              },
            },
          },
        },
      },
    })

    if (!organizationUser) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q' } },
        { status: 403 }
      )
    }

    const stores = organizationUser.userStores.map(us => ({
      ...us.store,
      registers: us.store.registers,
    }))

    return NextResponse.json({
      success: true,
      data: stores,
    })

  } catch (error) {
    console.error('Get stores error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const validatedData = createStoreSchema.parse(body)

    // Check if user has permission (owner or admin)
    const orgUser = await prisma.organizationUser.findFirst({
      where: {
        userId: payload.userId,
        organizationId: validatedData.organizationId,
        role: { in: ['owner', 'admin'] },
      },
    })

    if (!orgUser) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q' } },
        { status: 403 }
      )
    }

    const store = await prisma.store.create({
      data: validatedData,
    })

    // Give creator access to the store
    await prisma.userStore.create({
      data: {
        organizationUserId: orgUser.id,
        storeId: store.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: store,
      message: 'Do\'kon muvaffaqiyatli yaratildi',
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.errors } },
        { status: 400 }
      )
    }

    console.error('Create store error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}