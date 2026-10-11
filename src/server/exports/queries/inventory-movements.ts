import {cursorExport,EXPORT_PAGE_SIZE} from '../cursor'
import {csv,numeric,EXPORT_CAP} from "@/server/exports/csv"
import {consumeLimit} from "@/server/auth/rate-limit"
import {dateRange} from "@/server/reports/dates"
import {Prisma} from "@prisma/client"
import {AccessError} from "@/server/auth/policy"
import {scopedPrisma} from "@/server/auth/scoped-prisma"
import {NextResponse} from "next/server"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function queryInventoryMovements(payload:TokenPayload,request:NextRequest) {
  try {
    const db = scopedPrisma(payload)

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    const storeId = searchParams.get('storeId')
    const productId = searchParams.get('productId')
    const movementType = searchParams.get('movementType')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit
    if(skip>2147483647)throw new AccessError(400,'INVALID_PAGINATION')

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAM', message: 'Organization ID talab qilinadi' } },
        { status: 400 }
      )
    }

    const where: Prisma.InventoryMovementWhereInput = {
      organizationId,
    }

    if (storeId) where.storeId = storeId
    if (productId) where.productId = productId
    if (movementType) where.movementType = movementType

    for(const field of ['movementType','sourceType'])if((searchParams.get(field)?.length??0)>100)throw new AccessError(400,'INVALID_FILTER')
    const sourceId=searchParams.get('sourceId')
    if(sourceId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId))throw new AccessError(400,'INVALID_ID')
    if(sourceId)where.sourceId=sourceId
    if(searchParams.get('sourceType'))where.sourceType=searchParams.get('sourceType')!
    const organization=await db.organization.findUniqueOrThrow({where:{id:payload.organizationId},select:{timezone:true}})
    const range=dateRange(searchParams.get('from'),searchParams.get('to'),organization.timezone)
    if(Object.keys(range).length)where.occurredAt=range
    const exporting=searchParams.get('format')==='csv'
    await consumeLimit(exporting?'inventory.export':'inventory.journal',payload.organizationId+':'+payload.userId,exporting?10:60,60000)
    const result=await db.$transaction(async tx=>{
      const total=await tx.inventoryMovement.count({where})
      if(exporting&&total>EXPORT_CAP)throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 qatordan oshdi; filtrni toraytiring')
      const rows=exporting?await cursorExport(cursor=>tx.inventoryMovement.findMany({where,include:{product:true,store:true,creator:{select:{id:true,fullName:true}}},orderBy:[{occurredAt:'desc'},{id:'asc'}],take:EXPORT_PAGE_SIZE,...(cursor?{cursor:{id:cursor},skip:1}:{})})):await tx.inventoryMovement.findMany({where,include:{product:true,store:true,creator:{select:{id:true,fullName:true}}},orderBy:[{occurredAt:'desc'},{id:'asc'}],skip,take:limit})
      if(exporting)return {success:true,data:{filename:'stock-movements-'+payload.organizationId+'.csv',content:csv([['ID','Vaqt (UTC)','Filial','Mahsulot (joriy nom)','Birlik (joriy)','Harakat','Miqdor o‘zgarishi','Birlik tannarxi','Manba turi','Manba ID','Xodim','Izoh'],...rows.map(row=>[row.id,row.occurredAt.toISOString(),row.store.name,row.product.name,row.product.unit,row.movementType,numeric(row.quantityDelta,6),numeric(row.unitCost,6),row.sourceType,row.sourceId,row.creator?.fullName,row.note])])}}
      return {success:true,data:rows,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}
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
