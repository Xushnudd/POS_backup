import {paging} from "@/server/catalog/queries"
import {NextResponse} from "next/server"
import {prisma} from "@/lib/prisma"
import {AccessError} from "@/server/auth/policy"
import {financialFilter,financialSummary} from "@/server/reports/financial"
import {salesReportCsv} from "@/server/exports/sales-report"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function queryReportsSales(context:TokenPayload,request:NextRequest) {
 const params=request.nextUrl.searchParams
 if(!params.get('organizationId'))throw new AccessError(400,'MISSING_PARAM')
 if(params.get('format')==='csv')return NextResponse.json({success:true,data:await salesReportCsv(context,params)})
 const {page,limit,skip}=paging(params,50)
 const result=await prisma.$transaction(async tx=>{
  const filter=await financialFilter(tx,context,params)
  const {total,summary}=await financialSummary(tx,context,filter)
  const data=await tx.sale.findMany({where:filter.sales,include:{items:true,customer:true,register:true,cashier:{select:{id:true,fullName:true}},payments:true},orderBy:[{completedAt:'desc'},{id:'asc'}],skip,take:limit})
  return {success:true,data,summary,meta:filter.meta,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}
 },{isolationLevel:'RepeatableRead',timeout:15000})
 return NextResponse.json(result)
}
