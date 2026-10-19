import { csv } from '@/server/exports/csv'
import { paging, searchTerm, exporting, exportCap, pagination } from '@/server/catalog/queries'
import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError } from '@/server/auth/policy'
import { addBarcode, barcodeSchema } from '@/server/catalog/service'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context)throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params
 const q=new URL(request.url).searchParams,search=searchTerm(q),{page,limit,skip}=paging(q,200)
 const where={productId:id,organizationId:context.organizationId,...(search?{value:{contains:search,mode:'insensitive' as const}}:{})}
 const isExport=await exporting(q,context,'barcode.export')
 const result=await prisma.$transaction(async tx=>{
  const total=await tx.productBarcode.count({where});if(isExport)exportCap(total)
  const rows=await tx.productBarcode.findMany({where,orderBy:[{isPrimary:'desc'},{createdAt:'asc'},{id:'asc'}],...(!isExport?{skip,take:limit}:{})})
  if(isExport)return {success:true,data:{filename:'barcodes-'+id+'.csv',content:csv([['ID','Mahsulot ID','Barkod','Asosiy'],...rows.map(row=>[row.id,row.productId,row.value,row.isPrimary?'ha':'yo‘q'])])}}
  return {success:true,data:rows,pagination:pagination(page,limit,total)}
 },{isolationLevel:'RepeatableRead'})
 return NextResponse.json(result)
})
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context)throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params,input=barcodeSchema.parse(await request.json())
 return NextResponse.json({success:true,data:await addBarcode(context,id,input.value)})
})
