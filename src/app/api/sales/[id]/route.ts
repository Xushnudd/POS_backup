import { audit } from '@/server/operations'
import { prisma } from '@/lib/prisma'
import { AccessError, tenantScope } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'
import { enforceDiscountLimit, prepareItems, quantitySchema, amountSchema } from '@/server/sales/service'
import { draftTotals } from '@/server/sales/calculations'

const updateSaleSchema = z.object({
 customerId:z.string().uuid().nullable().optional(),note:z.string().max(2000).optional(),discountAmount:amountSchema.optional(),
 items:z.array(z.object({productId:z.string().uuid(),quantity:quantitySchema,discountAmount:amountSchema.default(0)})).min(1).max(500).optional(),
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

    const sale = await db.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
        payments: true,
        register: true,
        shift: true,
      },
    })

    if (!sale) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Savdo topilmadi' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: sale,
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
    const validatedData = updateSaleSchema.parse(body)

    const sale = await db.sale.findUnique({
      where: { id },
    })

    if (!sale) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Savdo topilmadi' } },
        { status: 404 }
      )
    }

    if (sale.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Faqat draft statusidagi savdoni tahrirlash mumkin' } },
        { status: 400 }
      )
    }

    const updatedSale = await prisma.$transaction(async (tx) => {
      // Lock the draft so checkout and edits cannot race.
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${id} FOR UPDATE`
      const current = await tx.sale.findUniqueOrThrow({ where: { id, AND: tenantScope("Sale", payload) }, include: { items: true } })
      if (current.status !== 'draft') throw new Error('INVALID_STATUS')
      const prepared = validatedData.items ? await prepareItems(tx, payload, validatedData.items, validatedData.discountAmount ?? current.discountAmount) : null
      const totals = prepared?.totals ?? draftTotals(current.items, validatedData.discountAmount ?? current.discountAmount)
      if (!prepared) await enforceDiscountLimit(tx,payload,current.items,totals.totalAmount)
      if (validatedData.items !== undefined) {
        await tx.saleItem.deleteMany({ where: { saleId: id } })
        await tx.saleItem.createMany({
          data: prepared!.rows.map(item => ({...item,saleId:id})),
        })
      }
      const result=await tx.sale.update({
        where: { id },
        data: {
          ...(validatedData.customerId !== undefined && { customerId: validatedData.customerId }),
          ...(validatedData.note !== undefined && { note: validatedData.note }),
          ...totals,
        },
        include: { items: true },
      })
      await audit(tx,payload,"Sale",id,"draft_updated")
      return result
    })

    return NextResponse.json({
      success: true,
      data: updatedSale,
      message: 'Savdo muvaffaqiyatli yangilandi',
    })

  } catch (error) {
    if (error instanceof AccessError) throw error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.issues } },
        { status: 400 }
      )
    }

    if (error instanceof Error && ['INVALID_DISCOUNT', 'INVALID_AMOUNT', 'INVALID_STATUS'].includes(error.message)) {
      return NextResponse.json({ success: false, error: { code: error.message, message: 'Savdo miqdori, chegirmasi yoki holati noto‘g‘ri' } }, { status: 409 })
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}
export const GET = withApi(handleGET)

export const PUT = withApi(handlePUT)
