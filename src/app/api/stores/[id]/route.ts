import {assertLiveContext} from '@/server/operations'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'

const updateStoreSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
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

    const store = await db.store.findUnique({
      where: { id },
      include: {
        registers: {
          where: { isActive: true },
        },
      },
    })

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Do\'kon topilmadi' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: store,
    })

  } catch (error) {
    if (error instanceof AccessError) throw error
    throw error
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
    const validatedData = updateStoreSchema.parse(body)

    const store = await db.$transaction(async tx => {
      await assertLiveContext(tx,payload)
      const result = await tx.store.update({
      where: { id },
      data: validatedData,
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Store",entityId:result.id,action:"update"}})
      return result
    })

    return NextResponse.json({
      success: true,
      data: store,
      message: 'Do\'kon muvaffaqiyatli yangilandi',
    })

  } catch (error) {
    if (error instanceof AccessError) throw error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.issues } },
        { status: 400 }
      )
    }

    throw error
  }
}

async function handleDELETE(
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

    // Soft delete
    await db.$transaction(async tx => {
      await assertLiveContext(tx,payload)
      const result = await tx.store.update({
      where: { id },
      data: { isActive: false },
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Store",entityId:result.id,action:"update"}})
      return result
    })

    return NextResponse.json({
      success: true,
      message: 'Do\'kon muvaffaqiyatli o\'chirildi',
    })

  } catch (error) {
    if (error instanceof AccessError) throw error
    throw error
  }
}
export const GET = withApi(handleGET)

export const PUT = withApi(handlePUT)

export const DELETE = withApi(handleDELETE)
