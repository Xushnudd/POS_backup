import {assertLiveContext} from '@/server/operations'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'

const updateRegisterSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
})

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
    const validatedData = updateRegisterSchema.parse(body)

    const register = await db.$transaction(async tx => {
      await assertLiveContext(tx,payload)
      const result = await tx.register.update({
      where: { id },
      data: validatedData,
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Register",entityId:result.id,action:"update"}})
      return result
    })

    return NextResponse.json({
      success: true,
      data: register,
      message: 'Kassa muvaffaqiyatli yangilandi',
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
export const PUT = withApi(handlePUT)
