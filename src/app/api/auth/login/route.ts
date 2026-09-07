import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'
import { z } from 'zod'

const loginSchema = z.object({
  phone: z.string().min(9),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = loginSchema.parse(body)

    // Find user by phone
    const user = await prisma.user.findUnique({
      where: { phone: validatedData.phone },
      include: {
        organizationUsers: {
          where: { isActive: true },
          include: {
            organization: true,
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Telefon raqam yoki parol noto\'g\'ri' } },
        { status: 401 }
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_INACTIVE', message: 'Hisob faol emas' } },
        { status: 403 }
      )
    }

    // Verify password
    const isValidPassword = await verifyPassword(validatedData.password, user.passwordHash)

    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Telefon raqam yoki parol noto\'g\'ri' } },
        { status: 401 }
      )
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    // Get first active organization (for simplicity, in real app you'd let user choose)
    const firstOrgUser = user.organizationUsers[0]
    if (!firstOrgUser) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_ORGANIZATION', message: 'Tashkilot topilmadi' } },
        { status: 403 }
      )
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      organizationId: firstOrgUser.organizationId,
      role: firstOrgUser.role,
    })

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          fullName: user.fullName,
          phone: user.phone,
          email: user.email,
        },
        organization: {
          id: firstOrgUser.organization.id,
          name: firstOrgUser.organization.name,
          currencyCode: firstOrgUser.organization.currencyCode,
        },
        role: firstOrgUser.role,
      },
      message: 'Muvaffaqiyatli kirdingiz'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.errors } },
        { status: 400 }
      )
    }

    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}