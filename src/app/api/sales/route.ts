import {billingDatabaseError} from '@/server/billing/errors'
import { Prisma } from '@prisma/client'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'
import { createDraft, saleDraftSchema } from '@/server/sales/service'
import {parseSalesListQuery} from '@/lib/sales-list-query'
import {assertLiveContext} from '@/server/operations'

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
    const storeId = searchParams.get('storeId')
    const shiftId = searchParams.get('shiftId')
    let query: ReturnType<typeof parseSalesListQuery>
    try { query = parseSalesListQuery(searchParams) }
    catch (error) { throw new AccessError(400, error instanceof Error ? error.message : 'INVALID_FILTER') }
    const {status,page,limit,skip,search,sort}=query

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAM', message: 'Organization ID talab qilinadi' } },
        { status: 400 }
      )
    }

    const where: Prisma.SaleWhereInput = {
      organizationId,
    }

    if (storeId) where.storeId = storeId
    if (shiftId) where.shiftId = shiftId
    if (status) where.status = status
    const customerId=searchParams.get('customerId')
    if(customerId)where.customerId=customerId
    if(search)where.OR=[{receiptNo:{contains:search,mode:'insensitive'}},{customer:{fullName:{contains:search,mode:'insensitive'}}}]
    const orderBy:Prisma.SaleOrderByWithRelationInput[] = sort==='oldest'
      ? [{createdAt:'asc'},{id:'asc'}]
      : sort==='amount_asc' ? [{totalAmount:'asc'},{id:'asc'}]
      : sort==='amount_desc' ? [{totalAmount:'desc'},{id:'desc'}]
      : sort==='receipt' ? [{receiptNo:'asc'},{id:'asc'}]
      : [{createdAt:'desc'},{id:'desc'}]

    const [sales, total] = await db.$transaction(async tx=>{
      await assertLiveContext(tx,payload)
      const sales=await tx.sale.findMany({
        where,
        include: {
          customer: true,
          items: true,
          payments: true,
          ...(customerId?{saleReturns:{select:{id:true,refundAmount:true,returnReceiptNo:true,returnedAt:true}}}:{}),
        },
        orderBy,
        skip,
        take: limit,
      })
      return [sales,await tx.sale.count({where})] as const
    },{isolationLevel:'RepeatableRead'})

    return NextResponse.json({
      success: true,
      data: sales,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
    const body = await request.json()
    const validatedData = saleDraftSchema.parse(body)
    const sale = await createDraft(payload, validatedData, validatedData.operationId ?? request.headers.get('idempotency-key') ?? '')

    return NextResponse.json({
      success: true,
      data: sale,
      message: 'Savdo muvaffaqiyatli yaratildi',
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

    if (error instanceof Error && ['INVALID_DISCOUNT', 'INVALID_AMOUNT'].includes(error.message)) {
      return NextResponse.json({success:false,error:{code:error.message,message:'Savdo miqdori yoki chegirmasi noto‘g‘ri'}},{status:409})
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}
export const GET = withApi(handleGET)

export const POST = withApi(handlePOST)
