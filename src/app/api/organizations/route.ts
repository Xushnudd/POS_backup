import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'
import { z } from 'zod'

const createOrganizationSchema = z.object({
  name: z.string().min(2),
  tin: z.string().optional(),
  phone: z.string().min(9),
  currencyCode: z.string().default('UZS'),
  timezone: z.string().default('Asia/Tashkent'),
  allowNegativeStock: z.boolean().default(false),
  receiptFooter: z.string().optional(),
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

    // Get user's organizations
    const organizationUsers = await prisma.organizationUser.findMany({
      where: {
        userId: payload.userId,
        isActive: true,
      },
      include: {
        organization: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      data: organizationUsers.map(ou => ({
        id: ou.organization.id,
        name: ou.organization.name,
        tin: ou.organization.tin,
        phone: ou.organization.phone,
        currencyCode: ou.organization.currencyCode,
        timezone: ou.organization.timezone,
        allowNegativeStock: ou.organization.allowNegativeStock,
        receiptFooter: ou.organization.receiptFooter,
        role: ou.role,
        createdAt: ou.organization.createdAt,
      })),
    })

  } catch (error) {
    console.error('Get organizations error:', error)
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
    const validatedData = createOrganizationSchema.parse(body)

    // Create organization
    const organization = await prisma.organization.create({
      data: validatedData,
    })

    // Add current user as owner
    await prisma.organizationUser.create({
      data: {
        organizationId: organization.id,
        userId: payload.userId,
        role: 'owner',
      },
    })

    return NextResponse.json({
      success: true,
      data: organization,
      message: 'Tashkilot muvaffaqiyatli yaratildi',
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.errors } },
        { status: 400 }
      )
    }

    console.error('Create organization error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}