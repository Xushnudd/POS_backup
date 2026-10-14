import {cursorExport,EXPORT_PAGE_SIZE} from '../cursor'
import {assertLiveContext} from "@/server/operations"
import {activeStatus} from "@/server/catalog/status"
import {csv,EXPORT_CAP} from "@/server/exports/csv"
import {consumeLimit} from "@/server/auth/rate-limit"
import {AccessError} from "@/server/auth/policy"
import {scopedPrisma} from "@/server/auth/scoped-prisma"
import {NextResponse} from "next/server"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
import {parseListQuery,namedListSorts} from '@/lib/list-query'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function querySuppliers(payload:TokenPayload,request:NextRequest) {
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

    let query;try{query=parseListQuery(searchParams,namedListSorts,'name_asc')}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER')}
    const {search,page,limit,skip,sort}=query
    const orderBy=sort==='newest'||sort==='oldest'?[{createdAt:sort==='newest'?'desc' as const:'asc' as const},{id:'asc' as const}]:[{name:sort==='name_desc'?'desc' as const:'asc' as const},{id:'asc' as const}]
    const where={organizationId,...activeStatus(searchParams,payload),...(search?{OR:[{name:{contains:search,mode:'insensitive' as const}},{phone:{contains:search}},{tin:{contains:search}}]}:{})}
    const exporting=searchParams.get('format')==='csv'
    if(exporting)await consumeLimit('supplier.export',payload.organizationId+':'+payload.userId,10,60000)
    const paginated=['status','search','sort','page','limit'].some(key=>searchParams.has(key))
    const result=await db.$transaction(async tx=>{
      await assertLiveContext(tx,payload)
      const total=await tx.supplier.count({where})
      if(exporting&&total>EXPORT_CAP)throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 qatordan oshdi; filtrni toraytiring')
      const rows=exporting?await cursorExport(cursor=>tx.supplier.findMany({where,orderBy,take:EXPORT_PAGE_SIZE,...(cursor?{cursor:{id:cursor},skip:1}:{})})):await tx.supplier.findMany({where,orderBy,...(paginated?{skip,take:limit}:{})})
      if(exporting)return {success:true,data:{filename:'suppliers-'+payload.organizationId+'.csv',content:csv([['ID','Nomi','Telefon','STIR','Manzil','Izoh','Bank','Bank hisob raqami','To‘lov/yetkazish shartlari','Faol'],...rows.map(row=>[row.id,row.name,row.phone,row.tin,row.address,row.note,row.bankName,row.bankAccount,row.paymentTerms,row.isActive?'ha':'yo‘q'])])}}
      return {success:true,data:rows,...(paginated?{pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}:{})}
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
