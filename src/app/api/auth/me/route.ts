import { AccessError } from '@/server/auth/policy'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, getRequestToken } from '@/lib/auth'

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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        organizationUsers: {
          where: { 
            isActive: true,
            ...(payload.organizationId && { organizationId: payload.organizationId })
          },
          include: {
            organization: true,
            userStores: {
              include: {
                store: true,
              }
            }
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'Foydalanuvchi topilmadi' } },
        { status: 404 }
      )
    }

    const orgUser = user.organizationUsers[0]
    if (!orgUser) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_ORGANIZATION', message: 'Tashkilot topilmadi' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          phone: user.phone,
          email: user.email,
          organizationUserId: orgUser.id,
        },
        organization: {
          id: orgUser.organization.id,
          name: orgUser.organization.name,
          tin: orgUser.organization.tin,
          phone: orgUser.organization.phone,
          currencyCode: orgUser.organization.currencyCode,
          timezone: orgUser.organization.timezone,
          allowNegativeStock: orgUser.organization.allowNegativeStock,
          receiptFooter: orgUser.organization.receiptFooter,
        },
        role: orgUser.role,
        stores: orgUser.userStores.map(us => ({
          id: us.store.id,
          name: us.store.name,
          address: us.store.address,
          phone: us.store.phone,
        })),
      },
    })

  } catch (error) {
    if (error instanceof AccessError) throw error
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}
export const GET = withApi(handleGET)
