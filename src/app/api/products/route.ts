import {queryProducts} from '@/server/exports/queries/products'
import {assertLiveContext} from '@/server/operations'





import {amountSchema} from '@/server/sales/service'
import {nonnegativeQuantitySchema} from '@/server/catalog/service'
import {Prisma} from '@prisma/client'
import {AccessError} from '@/server/auth/policy'
import {scopedPrisma} from '@/server/auth/scoped-prisma'
import {withApi} from '@/server/api'
import {NextRequest,NextResponse} from 'next/server'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {z} from 'zod'

const createProductSchema = z.object({
  organizationId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  taxProfileId:z.string().uuid().nullable().optional(),
  brandId: z.string().uuid().nullable().optional(),
  description: z.string().max(4000).optional(),
  name: z.string().trim().min(2).max(200),
  sku: z.string().trim().min(2).max(100),
  barcode: z.string().trim().min(2).max(200),
  unit: z.string().default('dona'),
  salePrice: amountSchema,
  costPrice: nonnegativeQuantitySchema,
  minStock: nonnegativeQuantitySchema.default(0),
  imageUrl: z.union([z.string().url().refine(value=>/^https?:\/\//i.test(value)),z.string().regex(/^\/api\/files\/[0-9a-f-]{36}$/i)]).nullable().optional(),
})

async function handleGET(request:NextRequest) {
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return queryProducts(context,request)
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
    const validatedData = createProductSchema.parse(body)

    if (!await db.unit.findFirst({where:{organizationId:payload.organizationId,code:validatedData.unit,isActive:true}})) throw new AccessError(400,'INVALID_UNIT','Faol birlikni tanlang')

    // Check if SKU or barcode already exists
    const existingProduct = await db.product.findFirst({
      where: {
        organizationId: validatedData.organizationId,
        OR: [
          { sku: validatedData.sku },
          { barcode: validatedData.barcode },
          {barcodes:{some:{value:validatedData.barcode}}},
        ],
      },
    })

    if (existingProduct) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'SKU yoki barkod allaqachon mavjud' } },
        { status: 400 }
      )
    }

    const product = await db.$transaction(async tx => {
      await assertLiveContext(tx,payload)
      const result = await tx.product.create({
      data: validatedData,
      include: {
        category: true,
      },
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Product",entityId:result.id,action:"create"}})
      return result
    })

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Mahsulot muvaffaqiyatli yaratildi',
    })

  } catch (error) {
    if (error instanceof Prisma.PrismaClientUnknownRequestError) throw error
    if (error instanceof AccessError) throw error
    if (error instanceof Prisma.PrismaClientKnownRequestError) throw error
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
