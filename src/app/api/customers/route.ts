import {queryCustomers} from '@/server/exports/queries/customers'
import {customerPhoneSchema,assertCustomerPhone} from '@/server/customers/identity'
import {amountSchema} from '@/server/sales/service'
import {assertLiveContext} from '@/server/operations'



import {Prisma} from '@prisma/client'
import {AccessError} from '@/server/auth/policy'
import {scopedPrisma} from '@/server/auth/scoped-prisma'
import {withApi} from '@/server/api'
import {NextRequest,NextResponse} from 'next/server'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {z} from 'zod'

const createCustomerSchema = z.object({
  organizationId: z.string().uuid(),
  fullName: z.string().min(2),
  phone: customerPhoneSchema,
  address: z.string().optional(),
  note: z.string().optional(),
  creditLimit: amountSchema.default(0),
})

async function handleGET(request:NextRequest) {
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return queryCustomers(context,request)
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

    const customer = await db.$transaction(async tx => {
      await assertLiveContext(tx,payload)
      await assertCustomerPhone(tx,payload,validatedData.phone)
      const result = await tx.customer.create({
      data: {...validatedData,creditLimit:new Prisma.Decimal(validatedData.creditLimit)},
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

    throw error
  }
}
export const GET = withApi(handleGET)

export const POST = withApi(handlePOST)
