import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
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

    const organization = await db.organization.findUnique({
      where: { id },
      include: {
        stores: {
          where: { isActive: true, ...(payload.role!=='owner'?{id:{in:payload.storeIds}}:{}) },
          include: {
            registers: {
              where: { isActive: true },
            },
          },
        },
        users: {
          where: payload.role==='owner'?{}:{id:{in:[]}},
          include: {
            user: {select:staffSelect},
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
    if (error instanceof AccessError) throw error
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}

async function handlePUT(
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
    const validatedData = updateOrganizationSchema.parse(body)

    const organization = await db.$transaction(async tx => {
      const result = await tx.organization.update({
      where: { id },
      data: validatedData,
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Organization",entityId:result.id,action:"update"}})
      return result
    })

    return NextResponse.json({
      success: true,
      data: organization,
      message: 'Tashkilot muvaffaqiyatli yangilandi',
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

export const PUT = withApi(handlePUT)
import {staffSelect} from '@/server/auth/user-dto'
