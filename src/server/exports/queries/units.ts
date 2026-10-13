import {parseListQuery,unitListSorts} from '@/lib/list-query'
import {AccessError} from '@/server/auth/policy'
import {Prisma} from '@prisma/client'
import {cursorExport,EXPORT_PAGE_SIZE} from '../cursor'
import {assertLiveContext} from "@/server/operations"
import {activeStatus} from "@/server/catalog/status"
import {csv,numeric} from "@/server/exports/csv"
import {exporting,exportCap,pagination} from "@/server/catalog/queries"
import {NextResponse} from "next/server"
import {prisma} from "@/lib/prisma"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function queryUnits(context:TokenPayload,request:NextRequest) {
 const q=new URL(request.url).searchParams
 let query:ReturnType<typeof parseListQuery<typeof unitListSorts[number]>>
 try{query=parseListQuery(q,unitListSorts,'name_asc',200)}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER')}
 const {page,limit,skip,search,sort}=query
 const orderBy:Prisma.UnitOrderByWithRelationInput[]=sort==='name_desc'?[{name:'desc'},{id:'desc'}]:sort==='code'?[{code:'asc'},{id:'asc'}]:[{name:'asc'},{id:'asc'}]
 const statusQuery=new URLSearchParams(q);if(!q.has('status'))statusQuery.set('status','all')
 const where={organizationId:context.organizationId,...activeStatus(statusQuery,context),...(search?{OR:[{name:{contains:search,mode:'insensitive' as const}},{code:{contains:search,mode:'insensitive' as const}}]}:{})}
 const isExport=await exporting(q,context,'unit.export')
 const result=await prisma.$transaction(async tx=>{
   await assertLiveContext(tx,context)
  const total=await tx.unit.count({where});if(isExport)exportCap(total)
  const rows=isExport?await cursorExport(cursor=>tx.unit.findMany({where,orderBy,...(!isExport?{skip,take:limit}:{}),take:EXPORT_PAGE_SIZE,...(cursor?{cursor:{id:cursor},skip:1}:{})})):await tx.unit.findMany({where,orderBy,...(!isExport?{skip,take:limit}:{})})
  if(isExport)return {success:true,data:{filename:'units-'+context.organizationId+'.csv',content:csv([['ID','Kod','Nomi','Aniqlik','Faol'],...rows.map(row=>[row.id,row.code,row.name,numeric(row.precision,0),row.isActive?'ha':'yo‘q'])])}}
  return {success:true,data:rows,pagination:pagination(page,limit,total)}
 },{isolationLevel:'RepeatableRead'})
 return NextResponse.json(result)
}
