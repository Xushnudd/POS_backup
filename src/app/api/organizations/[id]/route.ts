import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/auth'
import { z } from 'zod'

const updateOrganizationSchema = z.object({
  name: z.string().min(2).optional(),
  tin: z.string().optional(),
  phone: z.string().min(9).optional(),
  currencyCode: z.string().optional(),
  timezone: z.string().optional(),
  allowNegativeStock: z.boolean().optional(),
  receiptFooter: z.string().optional(),
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

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        stores: {
          where: { isActive: true },
          include: {
            registers: {
              where: { isActive: true },
            },
          },
        },
        users: {
          include: {
            user: true,
          },
        },
      },
    })

    if (!organization) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tashkilot topilmadi' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: organization,
    })

  } catch (error) {
    console.error('Get organization error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const validatedData = updateOrganizationSchema.parse(body)

    const organization = await prisma.organization.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json({
      success: true,
      data: organization,
      message: 'Tashkilot muvaffaqiyatli yangilandi',
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.errors } },
        { status: 400 }
      )
    }

    console.error('Update organization error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}