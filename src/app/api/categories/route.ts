import {queryCategories} from '@/server/exports/queries/categories'
import {assertLiveContext} from '@/server/operations'
import {validateCategoryParent} from '@/server/catalog/category-tree'
import {Prisma} from '@prisma/client'



import {AccessError} from '@/server/auth/policy'
import {scopedPrisma} from '@/server/auth/scoped-prisma'
import {withApi} from '@/server/api'
import {NextRequest,NextResponse} from 'next/server'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {z} from 'zod'

const createCategorySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(-2147483648).max(2147483647).default(0),
})

async function handleGET(request:NextRequest) {
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return queryCategories(context,request)
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
      await assertLiveContext(tx,payload)
      if(validatedData.parentId!==undefined)await validateCategoryParent(tx,payload.organizationId,validatedData.parentId)
      const result = await tx.category.create({
      data: validatedData,
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Category",entityId:result.id,action:"create"}})
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`
      return result
    })

    return NextResponse.json({
      success: true,
      data: category,
      message: 'Kategoriya muvaffaqiyatli yaratildi',
    })

  } catch (error) {
    if (error instanceof Prisma.PrismaClientUnknownRequestError) throw error
    if (error instanceof AccessError || error instanceof Prisma.PrismaClientKnownRequestError) throw error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ma\'lumotlar noto\'g\'ri', details: error.issues } },
        { status: 400 }
      )
    }

    throw error
  }
}
export const GET = withApi(handleGET)

export const POST = withApi(handlePOST)
