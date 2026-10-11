import {cursorExport,EXPORT_PAGE_SIZE} from '../cursor'
import {assertLiveContext} from "@/server/operations"
import {activeStatus} from "@/server/catalog/status"
import {csv,numeric} from "@/server/exports/csv"
import {paging,searchTerm,exporting,exportCap,pagination} from "@/server/catalog/queries"
import {NextResponse} from "next/server"
import {prisma} from "@/lib/prisma"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function queryUnits(context:TokenPayload,request:NextRequest) {
 const q=new URL(request.url).searchParams,search=searchTerm(q),{page,limit,skip}=paging(q,200)
 const statusQuery=new URLSearchParams(q);if(!q.has('status'))statusQuery.set('status','all')
 const where={organizationId:context.organizationId,...activeStatus(statusQuery,context),...(search?{OR:[{name:{contains:search,mode:'insensitive' as const}},{code:{contains:search,mode:'insensitive' as const}}]}:{})}
 const isExport=await exporting(q,context,'unit.export')
 const result=await prisma.$transaction(async tx=>{
   await assertLiveContext(tx,context)
  const total=await tx.unit.count({where});if(isExport)exportCap(total)
  const rows=isExport?await cursorExport(cursor=>tx.unit.findMany({where,orderBy:[{name:'asc'},{id:'asc'}],...(!isExport?{skip,take:limit}:{}),take:EXPORT_PAGE_SIZE,...(cursor?{cursor:{id:cursor},skip:1}:{})})):await tx.unit.findMany({where,orderBy:[{name:'asc'},{id:'asc'}],...(!isExport?{skip,take:limit}:{})})
  if(isExport)return {success:true,data:{filename:'units-'+context.organizationId+'.csv',content:csv([['ID','Kod','Nomi','Aniqlik','Faol'],...rows.map(row=>[row.id,row.code,row.name,numeric(row.precision,0),row.isActive?'ha':'yo‘q'])])}}
  return {success:true,data:rows,pagination:pagination(page,limit,total)}
 },{isolationLevel:'RepeatableRead'})
 return NextResponse.json(result)
}
