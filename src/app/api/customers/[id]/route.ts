import {customerPhoneSchema,assertCustomerPhone,normalizeCustomerPhone} from '@/server/customers/identity'
import {amountSchema} from '@/server/sales/service'
import {assertLiveContext} from '@/server/operations'
import { assertCustomerCanArchive } from '@/server/customers/archive'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'

const updateCustomerSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: customerPhoneSchema.optional(),
  address: z.string().optional(),
  note: z.string().optional(),
  creditLimit: amountSchema.optional(),
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

    const customer = await db.customer.findUnique({
      where: { id },
    })

    if (!customer) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Mijoz topilmadi' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: customer,
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
    const validatedData = updateCustomerSchema.parse(body)

    const customer = await db.$transaction(async tx => {
      await assertLiveContext(tx,payload)
      await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${id} AND "organizationId"=${payload.organizationId} FOR UPDATE`
      const current=await tx.customer.findFirst({where:{id,organizationId:payload.organizationId}});if(!current)throw new AccessError(404,'CUSTOMER_NOT_FOUND');if(current.mergedIntoId)throw new AccessError(409,'CUSTOMER_MERGED','Original karta merge tarixida saqlangan; asosiy kartani tahrirlang')
      if(validatedData.phone!==undefined||(validatedData.isActive===true&&normalizeCustomerPhone(current.phone)!==null))await assertCustomerPhone(tx,payload,validatedData.phone??current.phone,id)
      if(validatedData.isActive===false)await assertCustomerCanArchive(tx,payload.organizationId,id)
      const result = await tx.customer.update({
      where: { id },
      data: validatedData,
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Customer",entityId:result.id,action:"update"}})
      return result
    })

    return NextResponse.json({
      success: true,
      data: customer,
      message: 'Mijoz muvaffaqiyatli yangilandi',
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
      const current=await tx.customer.findFirst({where:{id,organizationId:payload.organizationId}});if(!current)throw new AccessError(404,'CUSTOMER_NOT_FOUND');if(current.mergedIntoId)throw new AccessError(409,'CUSTOMER_MERGED','Original merge karta tarixda saqlanadi')
      await assertCustomerCanArchive(tx,payload.organizationId,id)
      const result = await tx.customer.update({
      where: { id },
      data: { isActive: false },
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Customer",entityId:result.id,action:"update"}})
      return result
    })

    return NextResponse.json({
      success: true,
      message: 'Mijoz muvaffaqiyatli o\'chirildi',
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

export const PUT = withApi(handlePUT)

export const DELETE = withApi(handleDELETE)
