import {cursorExport,EXPORT_PAGE_SIZE} from '../cursor'
import {documentFilters} from "@/server/inventory/list-filters"
import {csv,numeric,productValue} from "@/server/exports/csv"
import {paging,exporting,exportCap,pagination} from "@/server/catalog/queries"
import {Prisma} from "@prisma/client"
import {AccessError} from "@/server/auth/policy"
import {scopedPrisma} from "@/server/auth/scoped-prisma"
import {NextResponse} from "next/server"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function queryStockDocuments(payload:TokenPayload,request:NextRequest) {
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
    const where:Prisma.StockDocumentWhereInput={organizationId,...documentFilters(searchParams,organization.timezone)}
    const {page,limit,skip}=paging(searchParams)
    const isExport=await exporting(searchParams,payload,'stock-document.export')
    const result=await db.$transaction(async tx=>{
      const total=await tx.stockDocument.count({where})
      if(isExport){exportCap(total);const lines=await tx.stockDocumentItem.count({where:{stockDocument:where}}),empty=await tx.stockDocument.count({where:{...where,items:{none:{}}}});exportCap(lines+empty)}
      const rows=isExport?await cursorExport(cursor=>tx.stockDocument.findMany({where,include:{store:true,supplier:true,reversal:{select:{id:true,documentNo:true}},items:{include:{product:true},orderBy:{id:'asc'}}},orderBy:[{createdAt:'desc'},{id:'asc'}],...(!isExport?{skip,take:limit}:{}),take:EXPORT_PAGE_SIZE,...(cursor?{cursor:{id:cursor},skip:1}:{})})):await tx.stockDocument.findMany({where,include:{store:true,supplier:true,reversal:{select:{id:true,documentNo:true}},items:{include:{product:true},orderBy:{id:'asc'}}},orderBy:[{createdAt:'desc'},{id:'asc'}],...(!isExport?{skip,take:limit}:{})})
      if(isExport)return {success:true,data:{filename:'stock-documents-'+payload.organizationId+'.csv',content:csv([['Hujjat ID','Raqam','Sana (UTC)','Tasdiqlangan (UTC)','Filial','Supplier','Turi','Holat','Asl hujjat ID','Qarshi hujjat ID','Mahsulot (joriy)','Birlik (joriy)','Miqdor','Birlik tannarxi','Qator qiymati','Izoh'],...rows.flatMap(row=>{
        const prefix=[row.id,row.documentNo,row.createdAt.toISOString(),row.confirmedAt?.toISOString(),row.store.name,row.supplier?.name,row.documentType,row.status,row.reversalOfId,row.reversal?.id]
        return row.items.length?row.items.map(item=>[...prefix,item.product.name,item.product.unit,numeric(item.quantity,6),numeric(item.unitCost,6),numeric(productValue(item.quantity,item.unitCost)),item.note??row.note]):[[...prefix,'','','','','',row.note]]
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
