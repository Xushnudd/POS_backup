import { consumeLimit, clearLimit } from '@/server/auth/rate-limit'
import { AccessError } from '@/server/auth/policy'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth'
import { z } from 'zod'
import { createSession, setSessionCookie } from '@/server/auth/session'

const loginSchema = z.object({
  phone: z.string().min(9),
  password: z.string().min(1),
})

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = loginSchema.parse(body)

    await consumeLimit('login-account',validatedData.phone)
    if (process.env.TRUST_PROXY === 'true') await consumeLimit('login-ip',request.headers.get('x-forwarded-for')?.split(',')[0].trim()??'unknown',30)
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

    const token = await prisma.$transaction(tx => createSession(tx, user.id, firstOrgUser.organizationId))

    const response = NextResponse.json({
      success: true,
      data: {
        token: "cookie-session",
        user: {
          id: user.id,
          fullName: user.fullName,
          phone: user.phone,
          email: user.email,
          organizationUserId: firstOrgUser.id,
        },
        organization: firstOrgUser.organization,
        role: firstOrgUser.role,
      },
      message: 'Muvaffaqiyatli kirdingiz'
    })
    await clearLimit('login-account',validatedData.phone)
    setSessionCookie(response, token)
    return response

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
export const POST = withApi(handlePOST, { public: true })
