import {assertLiveContext} from '@/server/operations'
import {validateCategoryParent} from '@/server/catalog/category-tree'
import {Prisma} from '@prisma/client'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'

const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(-2147483648).max(2147483647).optional(),
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
    const validatedData = updateCategorySchema.parse(body)

    const category = await db.$transaction(async tx => {
      await assertLiveContext(tx,payload)
      if(validatedData.parentId!==undefined)await validateCategoryParent(tx,payload.organizationId,validatedData.parentId,id)
      const result = await tx.category.update({
      where: { id },
      data: validatedData,
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Category",entityId:result.id,action:"update"}})
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`
      return result
    })

    return NextResponse.json({
      success: true,
      data: category,
      message: 'Kategoriya muvaffaqiyatli yangilandi',
    })

  } catch (error) {
    if (error instanceof AccessError || error instanceof Prisma.PrismaClientKnownRequestError) throw error
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
      const result = await tx.category.update({
      where: { id },
      data: { isActive: false },
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Category",entityId:result.id,action:"update"}})
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`
      return result
    })

    return NextResponse.json({
      success: true,
      message: 'Kategoriya muvaffaqiyatli o\'chirildi',
    })

  } catch (error) {
    if (error instanceof AccessError || error instanceof Prisma.PrismaClientKnownRequestError) throw error
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}
export const PUT = withApi(handlePUT)

export const DELETE = withApi(handleDELETE)
