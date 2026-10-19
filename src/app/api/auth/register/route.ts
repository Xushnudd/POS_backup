import { Prisma } from '@prisma/client'
import { consumeLimit } from '@/server/auth/rate-limit'
import { newPasswordSchema } from '@/server/auth/password-policy'
import { AccessError } from '@/server/auth/policy'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { z } from 'zod'
import { createSession, setSessionCookie } from '@/server/auth/session'

const registerSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(9),
  email: z.preprocess(value => typeof value === 'string' ? value.trim() || undefined : value, z.string().email().optional()),
  password: newPasswordSchema,
  organizationName: z.string().min(2),
  tin: z.preprocess(value => typeof value === 'string' ? value.trim() || undefined : value, z.string().optional()),
})

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = registerSchema.parse(body)

    await consumeLimit('register-account',validatedData.phone,5,15*60*1000)
    if(process.env.TRUST_PROXY_IP==='true')await consumeLimit('register-ip',request.headers.get('x-real-ip')??'unknown',30,15*60*1000)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone: validatedData.phone }
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_EXISTS', message: 'Bu telefon raqam allaqachon ro\'yxatdan o\'tgan' } },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(validatedData.password)

    const { organization, user, organizationUser, token } = await prisma.$transaction(async (tx) => {
    // Create organization
    const organization = await tx.organization.create({
      data: {
        name: validatedData.organizationName,
        tin: validatedData.tin,
        phone: validatedData.phone,
        currencyCode: 'UZS',
        timezone: 'Asia/Tashkent',
      }
    })

    // Create user
    const user = await tx.user.create({
      data: {
        fullName: validatedData.fullName,
        phone: validatedData.phone,
        email: validatedData.email,
        passwordHash,
      }
    })

    // Create organization user (owner role)
    const organizationUser = await tx.organizationUser.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: 'owner',
      }
    })

    // Create default store
    const store = await tx.store.create({
      data: {
        organizationId: organization.id,
        name: 'Asosiy do\'kon',
        address: '',
        phone: validatedData.phone,
      }
    })

    // Give user access to the store
    await tx.userStore.create({
      data: {
        organizationUserId: organizationUser.id,
        storeId: store.id,
      }
    })

    // Create default register
    await tx.register.create({
      data: {
        storeId: store.id,
        name: 'Kassa 1',
        code: 'REG001',
      }
    })

    // Create default discount policy
    await tx.discountPolicy.create({
      data: {
        organizationId: organization.id,
        cashierMaxPercent: 5,
        adminMaxPercent: 100,
        requireReasonFromPercent: 10,
      }
    })

      const token = await createSession(tx, user.id, organization.id)
      return { organization, user, organizationUser, token }
    })

    const response = NextResponse.json({
      success: true,
      data: {
        token: "cookie-session",
        user: {
          id: user.id,
          fullName: user.fullName,
          phone: user.phone,
          email: user.email,
          organizationUserId: organizationUser.id,
        },
        organization,
        role: "owner",
      },
      message: 'Muvaffaqiyatli ro\'yxatdan o\'tdingiz'
    })
    setSessionCookie(response, token)
    return response

  } catch (error) {
    // The unique indexes remain authoritative, including concurrent sign-ups.
    // Never disclose the existing tenant/user or turn an expected conflict into500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = error.meta?.target
      const field = Array.isArray(target) && target.length === 1 ? target[0] : null
      if (error.meta?.modelName === 'Organization' && field === 'tin') throw new AccessError(409, 'TIN_EXISTS')
      if (error.meta?.modelName === 'User' && field === 'email') throw new AccessError(409, 'EMAIL_EXISTS')
      if (error.meta?.modelName === 'User' && field === 'phone') throw new AccessError(400, 'USER_EXISTS')
    }
    // Shared handling supplies safe validation, billing and unexpected-error logs.
    throw error
  }
}
export const POST = withApi(handlePOST, { public: true })
