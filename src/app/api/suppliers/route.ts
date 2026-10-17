import {querySuppliers} from '@/server/exports/queries/suppliers'
import {assertLiveContext} from '@/server/operations'



import {AccessError} from '@/server/auth/policy'
import {scopedPrisma} from '@/server/auth/scoped-prisma'
import {withApi} from '@/server/api'
import {NextRequest,NextResponse} from 'next/server'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {z} from 'zod'

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

async function handleGET(request:NextRequest) {
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return querySuppliers(context,request)
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

    throw error
  }
}
export const GET = withApi(handleGET)

export const POST = withApi(handlePOST)
