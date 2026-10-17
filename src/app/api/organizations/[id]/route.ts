import {assertLiveContext} from '@/server/operations'
import {organizationTin,organizationCurrency,organizationTimezone,organizationError} from '@/server/organizations/validation'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'

const updateOrganizationSchema = z.object({
  name: z.string().min(2).optional(),
  tin: organizationTin,
  phone: z.string().min(9).optional(),
  currencyCode: organizationCurrency.optional(),
  timezone: organizationTimezone.optional(),
  allowNegativeStock: z.literal(false).optional(),
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
    throw organizationError(error)
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
      await assertLiveContext(tx,payload)
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
    throw organizationError(error)
  }
}
export const GET = withApi(handleGET)

export const PUT = withApi(handlePUT)
import {staffSelect} from '@/server/auth/user-dto'
