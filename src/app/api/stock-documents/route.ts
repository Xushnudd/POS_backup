import {queryStockDocuments} from '@/server/exports/queries/stock-documents'
import {prisma} from '@/lib/prisma'
import {assertLiveContext,runOperation} from '@/server/operations'
import {resolveConversion} from '@/server/catalog/conversions'



import {signedQuantitySchema,nonnegativeQuantitySchema} from '@/server/catalog/service'
import {Prisma} from '@prisma/client'
import {AccessError} from '@/server/auth/policy'

import {withApi} from '@/server/api'
import {NextRequest,NextResponse} from 'next/server'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {z} from 'zod'

const createStockDocumentSchema = z.object({
  operationId: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  storeId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  documentType: z.enum(['purchase', 'opening', 'adjustment', 'transfer_out', 'transfer_in', 'return_in']),
  documentNo: z.string().trim().min(1),
  note: z.string().trim().max(2000).optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: signedQuantitySchema,
    tradeUnit:z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/).optional(),
    unitCost: nonnegativeQuantitySchema,
    note: z.string().trim().max(2000).optional(),
  })).min(1).max(500),
}).refine(doc => doc.documentType === "adjustment" || doc.items.every(item => Number(item.quantity) > 0), "Kirim miqdori musbat bo‘lishi kerak").refine(doc=>!['opening','adjustment'].includes(doc.documentType)||(doc.note?.length??0)>=3,'Boshlang‘ich qoldiq/tuzatish sababi kamida3 belgi bo‘lishi kerak').refine(doc=>new Set(doc.items.map(item=>item.productId)).size===doc.items.length,'Takror mahsulot qatorlari mumkin emas')

async function handleGET(request:NextRequest) {
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return queryStockDocuments(context,request)
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
    const validatedData = createStockDocumentSchema.parse(body)
    const { items, operationId, ...documentData } = validatedData

    const create = async (tx:Prisma.TransactionClient) => {
      await assertLiveContext(tx,payload)
      const prepared=[];
      for(const item of items){const product=await tx.product.findFirst({where:{id:item.productId,organizationId:payload.organizationId}});if(!product)throw new AccessError(404,'PRODUCT_NOT_FOUND');const converted=await resolveConversion(tx,payload.organizationId,product,item.quantity,item.tradeUnit);const {tradeUnit:ignored,...row}=item;void ignored;prepared.push({...row,quantity:converted.quantity,conversionSnapshot:converted.snapshot??Prisma.DbNull})}
      const result = await tx.stockDocument.create({
      data: {
        ...documentData,
        createdBy: payload.userId,
        items: {
          create: prepared,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"StockDocument",entityId:result.id,action:"create"}})
      return result
    }
    const document = operationId
      ? await runOperation(payload,'stock.document.draft',operationId,validatedData,create)
      : await prisma.$transaction(create)

    return NextResponse.json({
      success: true,
      data: document,
      message: 'Ombor hujjati muvaffaqiyatli yaratildi',
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
