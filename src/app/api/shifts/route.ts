import { csv, numeric, EXPORT_CAP } from '@/server/exports/csv'
import { consumeLimit } from '@/server/auth/rate-limit'
import { dateRange } from '@/server/reports/dates'
import { Prisma } from '@prisma/client'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'
import { openShift, openSchema } from '@/server/finance/shifts'

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
    const registerId = searchParams.get('registerId')
    const status = searchParams.get('status')

    const where: Prisma.ShiftWhereInput = {}

    if (registerId) {
      where.registerId = registerId
    }

    if (status) {
      where.status = status
    }

    if(status&&!['open','closed'].includes(status))throw new AccessError(400,'INVALID_STATUS')
    const storeId=searchParams.get('storeId')
    if(storeId)where.register={storeId}
    const organization=await db.organization.findUniqueOrThrow({where:{id:payload.organizationId},select:{timezone:true}})
    const range=dateRange(searchParams.get('from'),searchParams.get('to'),organization.timezone)
    if(Object.keys(range).length)where.openedAt=range
    if(searchParams.get('format')==='csv'){
      if(payload.role==='cashier')throw new AccessError(403,'FORBIDDEN')
      await consumeLimit('shift.export',payload.organizationId+':'+payload.userId,10,60000)
      const data=await db.$transaction(async tx=>{
        const total=await tx.shift.count({where})
        if(total>EXPORT_CAP)throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 qatordan oshdi; filtrni toraytiring')
        const rows=await tx.shift.findMany({where,include:{register:{include:{store:true}},organizationUser:{select:{user:{select:{fullName:true}}}}},orderBy:[{openedAt:'desc'},{id:'asc'}]})
        const cash=(value:Prisma.Decimal|null)=>value===null?'':numeric(value)
        return {filename:'shifts-'+payload.organizationId+'.csv',content:csv([['ID','Filial','Kassa','Xodim','Holat','Ochilgan (UTC)','Yopilgan (UTC)','Boshlang‘ich naqd','Yopilish kutilgan naqd','Sanab chiqilgan','Farq'],...rows.map(row=>[row.id,row.register.store.name,row.register.name,row.organizationUser.user.fullName,row.status,row.openedAt.toISOString(),row.closedAt?.toISOString(),cash(row.openingCash),cash(row.expectedCash),cash(row.countedCash),cash(row.cashDifference)])])}
      },{isolationLevel:'RepeatableRead'})
      return NextResponse.json({success:true,data})
    }
    const shifts = await db.shift.findMany({
      where,
      include: {
        register: true,
        organizationUser: {
          include: {
            user: {select:operatorSelect},
          },
        },
      },
      orderBy: {
        openedAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      data: shifts,
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
    const body = await request.json()
    const validatedData = openSchema.parse(body)
    const shift = await openShift(payload, validatedData)

    return NextResponse.json({
      success: true,
      data: shift,
      message: 'Sena muvaffaqiyatli ochildi',
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
import {operatorSelect} from '@/server/auth/user-dto'
