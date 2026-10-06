import { activeStatus } from '@/server/catalog/status'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'

const createCategorySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2),
  sortOrder: z.number().default(0),
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

    const where = {organizationId, ...activeStatus(searchParams,payload)}
    const paginated=['status','page','limit'].some(key=>searchParams.has(key))
    const page=Number(searchParams.get('page')??1),limit=Number(searchParams.get('limit')??20)
    if((page-1)*limit>2147483647)throw new AccessError(400,'INVALID_PAGINATION')
    const result=await db.$transaction(async tx=>{
      const total=await tx.category.count({where})
      const data=await tx.category.findMany({where,orderBy:[{sortOrder:'asc'},{id:'asc'}],...(paginated?{skip:(page-1)*limit,take:limit}:{})})
      return {success:true,data,...(paginated?{pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}:{})}
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
    const validatedData = createCategorySchema.parse(body)

    const category = await db.$transaction(async tx => {
      const result = await tx.category.create({
      data: validatedData,
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Category",entityId:result.id,action:"create"}})
      return result
    })

    return NextResponse.json({
      success: true,
      data: category,
      message: 'Kategoriya muvaffaqiyatli yaratildi',
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
