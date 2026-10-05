import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken, hashPassword } from '@/lib/auth'
import { z } from 'zod'

const createUserSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(9),
  email: z.string().email().optional(),
  password: z.string().min(6),
  role: z.enum(['owner', 'admin', 'cashier']),
  storeIds: z.array(z.string()).optional(),
})

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const organizationUsers = await db.organizationUser.findMany({
      where: {
        organizationId: id,
        isActive: true,
      },
      include: {
        user: true,
        userStores: {
          include: {
            store: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: organizationUsers.map(ou => ({
        id: ou.id,
        user: {
          id: ou.user.id,
          fullName: ou.user.fullName,
          phone: ou.user.phone,
          email: ou.user.email,
          isActive: ou.user.isActive,
        },
        role: ou.role,
        isActive: ou.isActive,
        stores: ou.userStores.map(us => ({
          id: us.store.id,
          name: us.store.name,
        })),
        createdAt: ou.createdAt,
      })),
    })

  } catch (error) {
    if (error instanceof AccessError) throw error
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}

async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const validatedData = createUserSchema.parse(body)

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { phone: validatedData.phone }
    })

    let user
    if (existingUser) {
      user = existingUser
    } else {
      // Create new user
      const passwordHash = await hashPassword(validatedData.password)
      user = await db.user.create({
        data: {
          fullName: validatedData.fullName,
          phone: validatedData.phone,
          email: validatedData.email,
          passwordHash,
        },
      })
    }

    // Create organization user
    const organizationUser = await db.organizationUser.create({
      data: {
        organizationId: id,
        userId: user.id,
        role: validatedData.role,
      },
    })

    // Assign stores if provided
    if (validatedData.storeIds && validatedData.storeIds.length > 0) {
      await db.userStore.createMany({
        data: validatedData.storeIds.map(storeId => ({
          organizationUserId: organizationUser.id,
          storeId,
        })),
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...organizationUser,
        user,
      },
      message: 'Foydalanuvchi muvaffaqiyatli qo\'shildi',
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
