import {organizationTin,organizationCurrency,organizationTimezone,organizationError} from '@/server/organizations/validation'
import {assertLiveContext} from '@/server/operations'
import { prisma } from '@/lib/prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'
import {activeMembershipWhere} from '@/server/auth/custom-role-policy'

const createOrganizationSchema = z.object({
  name: z.string().min(2),
  tin: organizationTin,
  phone: z.string().min(9),
  currencyCode: organizationCurrency.default('UZS'),
  timezone: organizationTimezone.default('Asia/Tashkent'),
  allowNegativeStock: z.literal(false).default(false),
  receiptFooter: z.string().optional(),
})

async function handleGET(request: NextRequest) {
  try {
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

    // Get user's organizations
    const organizationUsers = await prisma.organizationUser.findMany({
      where: {
        userId: payload.userId,
        ...activeMembershipWhere,
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
    throw organizationError(error)
  }
}

async function handlePOST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const validatedData = createOrganizationSchema.parse(body)

    const organization = await prisma.$transaction(async tx => {
      await assertLiveContext(tx,payload)
      const organization=await tx.organization.create({data:validatedData})
      await tx.organizationUser.create({data:{organizationId:organization.id,userId:payload.userId,role:'owner'}})
      return organization
    })

    return NextResponse.json({
      success: true,
      data: organization,
      message: 'Tashkilot muvaffaqiyatli yaratildi',
    })

  } catch (error) {
    throw organizationError(error)
  }
}
export const GET = withApi(handleGET)

export const POST = withApi(handlePOST)
