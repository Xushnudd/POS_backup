import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader, hashPassword } from '@/lib/auth'
import { z } from 'zod'

const createUserSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(9),
  email: z.string().email().optional(),
  password: z.string().min(6),
  role: z.enum(['owner', 'admin', 'cashier']),
  storeIds: z.array(z.string()).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const organizationUsers = await prisma.organizationUser.findMany({
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
    console.error('Get organization users error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const validatedData = createUserSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone: validatedData.phone }
    })

    let user
    if (existingUser) {
      user = existingUser
    } else {
      // Create new user
      const passwordHash = await hashPassword(validatedData.password)
      user = await prisma.user.create({
        data: {
          fullName: validatedData.fullName,
          phone: validatedData.phone,
          email: validatedData.email,
          passwordHash,
        },
      })
    }

    // Create organization user
    const organizationUser = await prisma.organizationUser.create({
      data: {
        organizationId: id,
        userId: user.id,
        role: validatedData.role,
      },
    })

    // Assign stores if provided
    if (validatedData.storeIds && validatedData.storeIds.length > 0) {
      await prisma.userStore.createMany({
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.errors } },
        { status: 400 }
      )
    }

    console.error('Create user error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}