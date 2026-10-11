import {cursorExport,EXPORT_PAGE_SIZE} from '../cursor'
import {assertLiveContext} from "@/server/operations"
import {Prisma} from "@prisma/client"
import {csv,numeric} from "@/server/exports/csv"
import {paging,searchTerm,exporting,exportCap,pagination} from "@/server/catalog/queries"
import {activeStatus} from "@/server/catalog/status"
import {AccessError} from "@/server/auth/policy"
import {scopedPrisma} from "@/server/auth/scoped-prisma"
import {NextResponse} from "next/server"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function queryCategories(payload:TokenPayload,request:NextRequest) {
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

    const search=searchTerm(searchParams)
    const where = {organizationId, ...activeStatus(searchParams,payload),...(search?{name:{contains:search,mode:'insensitive' as const}}:{})}
    const paginated=['status','search','page','limit'].some(key=>searchParams.has(key))
    const {page,limit,skip}=paging(searchParams)
    const isExport=await exporting(searchParams,payload,'category.export')
    const result=await db.$transaction(async tx=>{
      await assertLiveContext(tx,payload)
      const total=await tx.category.count({where})
      if(isExport)exportCap(total)
      const rows=isExport?await cursorExport(cursor=>tx.category.findMany({where,include:{parent:{select:{id:true,name:true}}},orderBy:[{sortOrder:'asc'},{id:'asc'}],...(paginated&&!isExport?{skip,take:limit}:{}),take:EXPORT_PAGE_SIZE,...(cursor?{cursor:{id:cursor},skip:1}:{})})):await tx.category.findMany({where,include:{parent:{select:{id:true,name:true}}},orderBy:[{sortOrder:'asc'},{id:'asc'}],...(paginated&&!isExport?{skip,take:limit}:{})})
      if(isExport)return {success:true,data:{filename:'categories-'+organizationId+'.csv',content:csv([['ID','Nomi','Tartib','Faol'],...rows.map(row=>[row.id,row.name,numeric(row.sortOrder,0),row.isActive?'ha':'yo‘q'])])}}
      return {success:true,data:rows,...(paginated?{pagination:pagination(page,limit,total)}:{})}
    },{isolationLevel:'RepeatableRead'})
    return NextResponse.json(result)

  } catch (error) {
    if (error instanceof Prisma.PrismaClientUnknownRequestError) throw error
    if (error instanceof AccessError || error instanceof Prisma.PrismaClientKnownRequestError) throw error
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}
