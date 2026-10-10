import {billingDatabaseError} from '@/server/billing/errors'
import {assertLiveContext} from '@/server/operations'
import { AccessError,tenantScope } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'

const createStoreSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().optional(),
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
    const db = scopedPrisma(payload)

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAM', message: 'Organization ID talab qilinadi' } },
        { status: 400 }
      )
    }

    // Get user's accessible stores
    const organizationUser = await db.organizationUser.findFirst({
      where: {
        userId: payload.userId,
        organizationId,
        isActive: true,
      },
      include: {
        userStores: {
          where:{store:{AND:tenantScope('Store',payload),isActive:true}},
          include: {
            store: {
              include: {
                registers: {
                  where: { isActive: true },
                },
              },
            },
          },
        },
      },
    })

    if (!organizationUser) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q' } },
        { status: 403 }
      )
    }

    const stores = organizationUser.userStores.map(us => ({
      ...us.store,
      registers: us.store.registers,
    }))

    return NextResponse.json({
      success: true,
      data: stores,
    })

  } catch (error) {
    const billingError=billingDatabaseError(error);if(billingError)throw billingError
    if (error instanceof AccessError) throw error
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
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
    const db = scopedPrisma(payload)

    const body = await request.json()
    const validatedData = createStoreSchema.parse(body)

    // Check if user has permission (owner or admin)
    const orgUser = await db.organizationUser.findFirst({
      where: {
        userId: payload.userId,
        organizationId: validatedData.organizationId,
        role: { in: ['owner', 'admin'] },
      },
    })

    if (!orgUser) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q' } },
        { status: 403 }
      )
    }

    const store = await db.$transaction(async tx => {
      await assertLiveContext(tx,payload)
      const result = await tx.store.create({
      data: validatedData,
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Store",entityId:result.id,action:"create"}})
    // Give creator access to the store
    await tx.userStore.create({
      data: {
        organizationUserId: orgUser.id,
        storeId: result.id,
      },
    })

      return result
    })


    return NextResponse.json({
      success: true,
      data: store,
      message: 'Do\'kon muvaffaqiyatli yaratildi',
    })

  } catch (error) {
    const billingError=billingDatabaseError(error);if(billingError)throw billingError
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

export const POST = withApi(handlePOST)
