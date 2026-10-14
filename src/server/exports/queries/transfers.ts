import {parseListQuery,journalListSorts} from '@/lib/list-query'
import {cursorExport,EXPORT_PAGE_SIZE} from '../cursor'
import {transferFilters} from "@/server/inventory/list-filters"
import {assertLiveContext} from "@/server/operations"
import {csv,numeric} from "@/server/exports/csv"
import {exporting,exportCap,pagination} from "@/server/catalog/queries"
import {Prisma} from "@prisma/client"
import {AccessError} from "@/server/auth/policy"
import {scopedPrisma} from "@/server/auth/scoped-prisma"
import {NextResponse} from "next/server"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function queryTransfers(payload:TokenPayload,request:NextRequest) {
  try {
    const db = scopedPrisma(payload)

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAM', message: 'Organization ID talab qilinadi' } },
        { status: 400 }
      )
    }

    const organization=await db.organization.findUniqueOrThrow({where:{id:payload.organizationId},select:{timezone:true}})
    const where:Prisma.StockTransferWhereInput={organizationId,...transferFilters(searchParams,organization.timezone)}
    let query;try{query=parseListQuery(searchParams,journalListSorts,'newest')}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER')}
    const {page,limit,skip,sort}=query,orderBy=[{createdAt:sort==='oldest'?'asc' as const:'desc' as const},{id:'asc' as const}]
    const isExport=await exporting(searchParams,payload,'transfer.export')
    const result=await db.$transaction(async tx=>{
      await assertLiveContext(tx,payload)
      const total=await tx.stockTransfer.count({where})
      if(isExport){exportCap(total);const lines=await tx.stockTransferItem.count({where:{stockTransfer:where}}),empty=await tx.stockTransfer.count({where:{...where,items:{none:{}}}});exportCap(lines+empty)}
      const rows=isExport?await cursorExport(cursor=>tx.stockTransfer.findMany({where,include:{fromStore:true,toStore:true,items:{include:{product:true,dispositions:true},orderBy:{id:'asc'}}},orderBy,...(!isExport?{skip,take:limit}:{}),take:EXPORT_PAGE_SIZE,...(cursor?{cursor:{id:cursor},skip:1}:{})})):await tx.stockTransfer.findMany({where,include:{fromStore:true,toStore:true,items:{include:{product:true,dispositions:true},orderBy:{id:'asc'}}},orderBy,...(!isExport?{skip,take:limit}:{})})
      if(isExport)return {success:true,data:{filename:'transfers-'+payload.organizationId+'.csv',content:csv([['ID','Yaratilgan (UTC)','Jo‘natilgan (UTC)','Qabul yopilgan (UTC)','Jo‘natuvchi','Qabul qiluvchi','Holat','Mahsulot (joriy)','Birlik (joriy)','Rejalangan miqdor','Qabul miqdori','Manbaga qaytarilgan','Ajratilmagan miqdor','Birlik tannarxi','Izoh','Brak','Tasdiqlangan kamomad'],...rows.flatMap(row=>{
        const prefix=[row.id,row.createdAt.toISOString(),row.sentAt?.toISOString(),row.receivedAt?.toISOString(),row.fromStore.name,row.toStore.name,row.status]
        return row.items.length?row.items.map(item=>[...prefix,item.product.name,item.product.unit,numeric(item.quantity,6),numeric(item.receivedQuantity,6),numeric(item.returnedQuantity,6),numeric(item.quantity.sub(item.receivedQuantity).sub(item.returnedQuantity).sub(item.damagedQuantity).sub(item.shortageQuantity),6),numeric(item.unitCost,6),row.note,numeric(item.damagedQuantity,6),numeric(item.shortageQuantity,6)]):[[...prefix,'','','','','','','',row.note,'','']]
      })])}}
      return {success:true,data:rows,pagination:pagination(page,limit,total)}
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
