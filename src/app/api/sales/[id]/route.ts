import {attachSaleBatches} from '@/server/inventory/batches'
import {attachGiftFunding} from '@/server/loyalty/gift-presentation'
import { audit,assertLiveContext } from '@/server/operations'
import { prisma } from '@/lib/prisma'
import { AccessError, tenantScope } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'
import { enforceDiscountLimit, prepareItems, quantitySchema, amountSchema } from '@/server/sales/service'
import {priceTaxLines,type TaxMode} from '@/server/taxes/calculations'
import {decimal} from '@/server/sales/calculations'
import {discountAmount as resolveDiscount} from '@/server/sales/discounts'
import { draftTotals } from '@/server/sales/calculations'

const updateSaleSchema = z.object({
 customerId:z.string().uuid().nullable().optional(),note:z.string().max(2000).optional(),discountAmount:amountSchema.optional(),discountPercent:amountSchema.refine(v=>decimal(v).lte(100)).nullable().optional(),discountReason:z.string().trim().min(3).max(2000).optional(),
 items:z.array(z.object({productId:z.string().uuid(),quantity:quantitySchema,discountAmount:amountSchema.default(0),discountPercent:amountSchema.refine(v=>decimal(v).lte(100)).optional()})).min(1).max(500).optional(),
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

    const sale = await db.$transaction(async tx=>{const original=await tx.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        cashier:{select:{fullName:true}},
        items: true,
        payments: true,
        register: true,
        shift: true,
      },
    })
    return original?attachGiftFunding(tx,await attachSaleBatches(tx,payload,original)):null},{isolationLevel:'RepeatableRead'})

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
      await assertLiveContext(tx,payload)
      // Lock the draft so checkout and edits cannot race.
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${id} FOR UPDATE`
      const current = await tx.sale.findUniqueOrThrow({ where: { id, AND: tenantScope("Sale", payload) }, include: { items: true } })
      if (current.status !== 'draft') throw new Error('INVALID_STATUS')
      if(await tx.offlineCashLease.findFirst({where:{saleId:id,state:'issued'}}))throw new AccessError(409,'OFFLINE_TICKET_PENDING','Offline ticketni avval hal qiling')
      if (validatedData.customerId && !await tx.customer.findFirst({where:{id:validatedData.customerId,organizationId:payload.organizationId,isActive:true}})) throw new AccessError(404,'CUSTOMER_NOT_FOUND')
      const receiptPercent=validatedData.discountPercent!==undefined?validatedData.discountPercent??undefined:validatedData.discountAmount===undefined?current.discountPercent?.toFixed():undefined
      const preparedDiscount=validatedData.discountAmount??(receiptPercent===undefined?current.discountAmount:0)
      const pricingChanged=validatedData.customerId!==undefined&&validatedData.customerId!==current.customerId
      const effectiveItems=validatedData.items??(pricingChanged?current.items.map(i=>({productId:i.productId,quantity:i.quantity.toFixed(),discountAmount:i.discountAmount.toFixed(),...(i.discountPercent?{discountPercent:i.discountPercent.toFixed()}:{} )})):undefined)
      const prepared = effectiveItems ? await prepareItems(tx, payload, effectiveItems, preparedDiscount,{storeId:current.storeId,customerId:validatedData.customerId!==undefined?validatedData.customerId:current.customerId,discountReason:validatedData.discountReason??current.discountReason,discountPercent:receiptPercent}) : null
      const discountChanged=validatedData.discountAmount!==undefined||validatedData.discountPercent!==undefined
      const receiptDiscount=discountChanged?resolveDiscount(current.subtotal,validatedData.discountAmount??0,validatedData.discountPercent??undefined):current.discountAmount
      const rawTotals=draftTotals(current.items,receiptDiscount)
      const authorization=prepared?.authorization??await enforceDiscountLimit(tx,payload,current.items,rawTotals.totalAmount,validatedData.discountReason??current.discountReason,discountChanged||current.discountPolicySnapshot!==null)
      // Legacy drafts can contain repeated SKU rows. Keep row identity when
      // allocating cents; product identity would overwrite the first row twice.
      const uniqueProducts=new Set(current.items.map(i=>i.productId)).size===current.items.length
      const repriced=!prepared&&discountChanged?priceTaxLines(current.items.map(i=>({...i,id:uniqueProducts?i.productId:i.id,taxMode:i.taxMode as TaxMode})),receiptDiscount):null
      const totals=prepared?.totals??(repriced?{...rawTotals,taxAmount:repriced.reduce((n,i)=>n.add(i.taxAmount),decimal(0)),netAmount:repriced.reduce((n,i)=>n.add(i.taxBase),decimal(0)),totalAmount:repriced.reduce((n,i)=>n.add(i.payableAmount),decimal(0))}:{subtotal:current.subtotal,discountAmount:current.discountAmount,totalAmount:current.totalAmount,taxAmount:current.taxAmount,netAmount:current.netAmount})
      if(totals.totalAmount.gte('1000000000000'))throw new AccessError(400,'INVALID_AMOUNT')
      if(repriced)for(const item of repriced){await tx.saleItem.update({where:{id:uniqueProducts?current.items.find(i=>i.productId===item.productId)!.id:item.id},data:{receiptDiscount:item.receiptDiscount,taxAmount:item.taxAmount,taxBase:item.taxBase,payableAmount:item.payableAmount,roundingVersion:item.roundingVersion}})}
      if(pricingChanged)await tx.sale.update({where:{id},data:{customerId:validatedData.customerId}})
      if (effectiveItems !== undefined) {
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
          ...totals,...authorization,
          ...((discountChanged||prepared)&&{discountPercent:receiptPercent===undefined?null:decimal(receiptPercent)}),
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
    throw error
  }
}
export const GET = withApi(handleGET)

export const PUT = withApi(handlePUT)
