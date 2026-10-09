import {assertLiveContext} from '@/server/operations'
import { activeStatus } from '@/server/catalog/status'
import { csv, EXPORT_CAP } from '@/server/exports/csv'
import { consumeLimit } from '@/server/auth/rate-limit'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'

const createSupplierSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  phone: z.string().max(64).optional(),
  tin: z.string().max(64).optional(),
  address: z.string().max(500).optional(),
  note: z.string().max(2000).optional(),
  bankName: z.string().trim().max(200).optional(),
  bankAccount: z.string().trim().max(128).optional(),
  paymentTerms: z.string().trim().max(2000).optional(),
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

    const search=searchParams.get('search')?.trim()??''
    if(search.length>200)throw new AccessError(400,'INVALID_FILTER')
    const where={organizationId,...activeStatus(searchParams,payload),...(search?{OR:[{name:{contains:search,mode:'insensitive' as const}},{phone:{contains:search}},{tin:{contains:search}}]}:{})}
    const page=Number(searchParams.get('page')??1),limit=Number(searchParams.get('limit')??20)
    if((page-1)*limit>2147483647)throw new AccessError(400,'INVALID_PAGINATION')
    const exporting=searchParams.get('format')==='csv'
    if(exporting)await consumeLimit('supplier.export',payload.organizationId+':'+payload.userId,10,60000)
    const paginated=['status','search','page','limit'].some(key=>searchParams.has(key))
    const result=await db.$transaction(async tx=>{
      await assertLiveContext(tx,payload)
      const total=await tx.supplier.count({where})
      if(exporting&&total>EXPORT_CAP)throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 qatordan oshdi; filtrni toraytiring')
      const rows=await tx.supplier.findMany({where,orderBy:[{name:'asc'},{id:'asc'}],...(!exporting&&paginated?{skip:(page-1)*limit,take:limit}:{})})
      if(exporting)return {success:true,data:{filename:'suppliers-'+payload.organizationId+'.csv',content:csv([['ID','Nomi','Telefon','STIR','Manzil','Izoh','Bank','Bank hisob raqami','To‘lov/yetkazish shartlari','Faol'],...rows.map(row=>[row.id,row.name,row.phone,row.tin,row.address,row.note,row.bankName,row.bankAccount,row.paymentTerms,row.isActive?'ha':'yo‘q'])])}}
      return {success:true,data:rows,...(paginated?{pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}:{})}
    },{isolationLevel:'RepeatableRead'})
    return NextResponse.json(result)

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
    const validatedData = createSupplierSchema.parse(body)

    const supplier = await db.$transaction(async tx => {
      await assertLiveContext(tx,payload)
      const result = await tx.supplier.create({
      data: validatedData,
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Supplier",entityId:result.id,action:"create"}})
      return result
    })

    return NextResponse.json({
      success: true,
      data: supplier,
      message: 'Yetkazib beruvchi muvaffaqiyatli yaratildi',
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
