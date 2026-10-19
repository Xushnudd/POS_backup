import {assertLiveContext} from '@/server/operations'
import { AccessError } from '@/server/auth/policy'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { withApi } from '@/server/api'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { z } from 'zod'

const updateSupplierSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  phone: z.string().max(64).optional(),
  tin: z.string().max(64).optional(),
  address: z.string().max(500).optional(),
  note: z.string().max(2000).optional(),
  bankName: z.string().trim().max(200).optional(),
  bankAccount: z.string().trim().max(128).optional(),
  paymentTerms: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
})

async function handlePUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const validatedData = updateSupplierSchema.parse(body)

    const supplier = await db.$transaction(async tx => {
      await assertLiveContext(tx,payload)
      await tx.$queryRaw`SELECT id FROM "Supplier" WHERE id=${id} AND "organizationId"=${payload.organizationId} FOR UPDATE`
      if(validatedData.isActive===false){
        const [balance]=await tx.$queryRaw<{blocked:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "SupplierInvoiceBalance" i WHERE i."supplierId"=${id} AND i."organizationId"=${payload.organizationId} AND i."netAmount">COALESCE((SELECT sum(a.amount) FROM "SupplierAllocationBalance" a WHERE a."invoiceId"=i.id),0)) OR EXISTS(SELECT 1 FROM "SupplierPayment" p JOIN "FinancialDocument" d ON d.id=p."financialDocumentId" WHERE p."supplierId"=${id} AND p."organizationId"=${payload.organizationId} AND d.amount>COALESCE((SELECT sum(a.amount) FROM "SupplierAllocationBalance" a WHERE a."paymentId"=p.id),0)) AS blocked`;
        if(balance.blocked)throw new AccessError(409,'SUPPLIER_BALANCE_NOT_ZERO','Qarz yoki taqsimlanmagan avans bor; avval hisobni solishtiring')
      }
      const result = await tx.supplier.update({
      where: { id },
      data: validatedData,
    })
      await tx.auditLog.create({data:{organizationId:payload.organizationId,actorId:payload.userId,entityType:"Supplier",entityId:result.id,action:"update"}})
      return result
    })

    return NextResponse.json({
      success: true,
      data: supplier,
      message: 'Yetkazib beruvchi muvaffaqiyatli yangilandi',
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
export const PUT = withApi(handlePUT)

export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params
 const row=await scopedPrisma(context).supplier.findUnique({where:{id}})
 if(!row)throw new AccessError(404,'NOT_FOUND')
 return NextResponse.json({success:true,data:row})
})
