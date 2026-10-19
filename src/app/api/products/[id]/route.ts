import {internalProductImagePattern} from '@/lib/product-image'
import {postCostContinuations} from '@/server/purchases/cost-continuations'
import {assertLiveContext} from '@/server/operations'
import {priceActor,costChangeReferences} from '@/server/catalog/prices'
import { Prisma } from '@prisma/client'
import { amountSchema } from '@/server/sales/service'
import { nonnegativeQuantitySchema } from '@/server/catalog/service'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'

const updateProductSchema = z.object({
  categoryId: z.string().uuid().optional(),
  taxProfileId:z.string().uuid().nullable().optional(),
  brandId: z.string().uuid().nullable().optional(),
  description: z.string().max(4000).optional(),
  name: z.string().trim().min(2).max(200).optional(),
  sku: z.string().trim().min(2).max(100).optional(),
  barcode: z.string().trim().min(2).max(200).optional(),
  unit: z.string().optional(),
  salePrice: amountSchema.optional(),
  costPrice: nonnegativeQuantitySchema.optional(),
  minStock: nonnegativeQuantitySchema.optional(),
  imageUrl: z.string().regex(internalProductImagePattern).nullable().optional(),
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

    const product = await db.product.findUnique({
      where: { id },
      include: {
        category: true,unitConversions:{where:{isActive:true},orderBy:{tradeUnit:'asc'}},brand:true,taxProfile:true,
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Mahsulot topilmadi' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {...product,unitPrecision:(await db.unit.findFirst({where:{organizationId:payload.organizationId,code:product.unit}}))?.precision??6},
    })

  } catch (error) {
    if (error instanceof Prisma.PrismaClientUnknownRequestError) throw error
    if (error instanceof AccessError) throw error
    if (error instanceof Prisma.PrismaClientKnownRequestError) throw error
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
    const validatedData = updateProductSchema.parse(body)

    const product = await db.$transaction(async tx => {
      await assertLiveContext(tx,payload)
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${id} FOR UPDATE`
      const current=await tx.product.findUniqueOrThrow({where:{id}})
      if(validatedData.costPrice!==undefined&&!current.costPrice.eq(validatedData.costPrice)&&payload.role!=='owner')throw new AccessError(403,'COST_CHANGE_FORBIDDEN');
      await priceActor(tx,payload,'catalog.edit');
      if (validatedData.unit!==undefined) {
        if (!await tx.unit.findFirst({where:{organizationId:payload.organizationId,code:validatedData.unit,isActive:true}})) throw new AccessError(400,'INVALID_UNIT')
        if (validatedData.unit!==current.unit && (await tx.saleItem.count({where:{productId:id}}) || await tx.inventoryMovement.count({where:{productId:id}}) || await tx.inventoryBalance.count({where:{productId:id,quantity:{not:0}}}))) throw new AccessError(409,'UNIT_IN_USE','Harakati bor mahsulotning bazaviy birligini o‘zgartirib bo‘lmaydi')
      }
      if (validatedData.barcode!==undefined) {
        const alias=await tx.productBarcode.findFirst({where:{organizationId:payload.organizationId,value:validatedData.barcode,productId:{not:id}}})
        if(alias)throw new AccessError(409,'BARCODE_EXISTS')
      }

      const result = await tx.product.update({
      where: { id },
      data: validatedData,
      include: {
        category: true,
      },
    })
      const costAudit=await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Product",entityId:result.id,action:"update",afterData:{approvedBy:payload.userId,approvedRole:payload.role,valuationReferences:await costChangeReferences(tx,payload,[result.id]),prices:{salePrice:{before:current.salePrice.toFixed(),after:result.salePrice.toFixed()},costPrice:{before:current.costPrice.toFixed(),after:result.costPrice.toFixed()}}}}})
      if(!current.costPrice.eq(result.costPrice))await postCostContinuations(tx as unknown as import('@prisma/client').Prisma.TransactionClient,payload,{auditId:costAudit.id,productId:result.id})
      return result
    })

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Mahsulot muvaffaqiyatli yangilandi',
    })

  } catch (error) {
    if (error instanceof Prisma.PrismaClientUnknownRequestError) throw error
    if (error instanceof AccessError) throw error
    if (error instanceof Prisma.PrismaClientKnownRequestError) throw error
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
      const result = await tx.product.update({
      where: { id },
      data: { isActive: false },
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Product",entityId:result.id,action:"update"}})
      return result
    })

    return NextResponse.json({
      success: true,
      message: 'Mahsulot muvaffaqiyatli o\'chirildi',
    })

  } catch (error) {
    if (error instanceof Prisma.PrismaClientUnknownRequestError) throw error
    if (error instanceof AccessError) throw error
    if (error instanceof Prisma.PrismaClientKnownRequestError) throw error
    throw error
  }
}
export const GET = withApi(handleGET)

export const PUT = withApi(handlePUT)

export const DELETE = withApi(handleDELETE)
