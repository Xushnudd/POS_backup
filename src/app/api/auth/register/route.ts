import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateToken } from '@/lib/auth'
import { z } from 'zod'

const registerSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(9),
  email: z.string().email().optional(),
  password: z.string().min(6),
  organizationName: z.string().min(2),
  tin: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = registerSchema.parse(body)

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

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name: validatedData.organizationName,
        tin: validatedData.tin,
        phone: validatedData.phone,
        currencyCode: 'UZS',
        timezone: 'Asia/Tashkent',
      }
    })

    // Create user
    const user = await prisma.user.create({
      data: {
        fullName: validatedData.fullName,
        phone: validatedData.phone,
        email: validatedData.email,
        passwordHash,
      }
    })

    // Create organization user (owner role)
    const organizationUser = await prisma.organizationUser.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: 'owner',
      }
    })

    // Create default store
    const store = await prisma.store.create({
      data: {
        organizationId: organization.id,
        name: 'Asosiy do\'kon',
        address: '',
        phone: validatedData.phone,
      }
    })

    // Give user access to the store
    await prisma.userStore.create({
      data: {
        organizationUserId: organizationUser.id,
        storeId: store.id,
      }
    })

    // Create default register
    await prisma.register.create({
      data: {
        storeId: store.id,
        name: 'Kassa 1',
        code: 'REG001',
      }
    })

    // Create default discount policy
    await prisma.discountPolicy.create({
      data: {
        organizationId: organization.id,
        cashierMaxPercent: 5,
        adminMaxPercent: 100,
        requireReasonFromPercent: 10,
      }
    })

    // Generate token
    const token = generateToken({
      userId: user.id,
      organizationId: organization.id,
      role: 'owner',
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
          id: organization.id,
          name: organization.name,
          currencyCode: organization.currencyCode,
        },
      },
      message: 'Muvaffaqiyatli ro\'yxatdan o\'tdingiz'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.errors } },
        { status: 400 }
      )
    }

    console.error('Registration error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}