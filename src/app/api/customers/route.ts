import { activeStatus } from '@/server/catalog/status'
import { csv, numeric, EXPORT_CAP } from '@/server/exports/csv'
import { consumeLimit } from '@/server/auth/rate-limit'
import { Prisma } from '@prisma/client'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'

const createCustomerSchema = z.object({
  organizationId: z.string().uuid(),
  fullName: z.string().min(2),
  phone: z.string().min(9),
  address: z.string().optional(),
  note: z.string().optional(),
  creditLimit: z.number().default(0),
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
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAM', message: 'Organization ID talab qilinadi' } },
        { status: 400 }
      )
    }

    const where: Prisma.CustomerWhereInput = {
      organizationId,
      ...activeStatus(searchParams, payload),
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]
    }

    if(searchParams.get('format')==='csv'){
      if(payload.role!=='owner')throw new AccessError(403,'FORBIDDEN')
      await consumeLimit('customers.export',payload.organizationId+':'+payload.userId,10,60000)
      const data=await db.$transaction(async tx=>{
        const total=await tx.customer.count({where})
        if(total>EXPORT_CAP)throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 qatordan oshdi; filtrni toraytiring')
        const rows=await tx.customer.findMany({where,orderBy:[{fullName:'asc'},{id:'asc'}],select:{id:true,fullName:true,phone:true,address:true,creditLimit:true}})
        const debts=await tx.debtEntry.groupBy({by:['customerId'],where:{customerId:{in:rows.map(row=>row.id)}},_sum:{amount:true}})
        const balances=new Map(debts.map(row=>[row.customerId,row._sum.amount??new Prisma.Decimal(0)]))
        return {filename:'customers-'+payload.organizationId+'.csv',content:csv([['ID','Mijoz','Telefon','Manzil','Nasiya limiti','Joriy ledger qoldig‘i'],...rows.map(row=>[row.id,row.fullName,row.phone,row.address,numeric(row.creditLimit),numeric(balances.get(row.id)??0)])])}
      },{isolationLevel:'RepeatableRead'})
      return NextResponse.json({success:true,data})
    }

    const [customers, total] = await db.$transaction(async tx=>{
      const rows=await tx.customer.findMany({where,orderBy:[{fullName:'asc'},{id:'asc'}],skip,take:limit})
      return [rows,await tx.customer.count({where})] as const
    },{isolationLevel:'RepeatableRead'})

    return NextResponse.json({
      success: true,
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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
    const validatedData = createCustomerSchema.parse(body)

    // Check if phone already exists
    const existingCustomer = await db.customer.findFirst({
      where: {
        organizationId: validatedData.organizationId,
        phone: validatedData.phone,
      },
    })

    if (existingCustomer) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'Bu telefon raqam allaqachon mavjud' } },
        { status: 400 }
      )
    }

    const customer = await db.$transaction(async tx => {
      const result = await tx.customer.create({
      data: validatedData,
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Customer",entityId:result.id,action:"create"}})
      return result
    })

    return NextResponse.json({
      success: true,
      data: customer,
      message: 'Mijoz muvaffaqiyatli yaratildi',
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
export const GET = withApi(handleGET)

export const POST = withApi(handlePOST)
