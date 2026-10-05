import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { returnSale, returnSchema } from '@/server/returns/service'
import { AccessError, tenantScope } from '@/server/auth/policy'
import { prisma } from '@/lib/prisma'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params
 const page=Number(request.nextUrl.searchParams.get('page')??1),limit=Number(request.nextUrl.searchParams.get('limit')??20)
 const result=await prisma.$transaction(async tx=>{
  const sale=await tx.sale.findFirst({where:{id,AND:tenantScope('Sale',context)},select:{id:true}})
  if(!sale)throw new AccessError(404,'NOT_FOUND')
  const where={saleId:sale.id}
  const total=await tx.saleReturn.count({where})
  const data=await tx.saleReturn.findMany({where,orderBy:[{returnedAt:'desc'},{id:'desc'}],skip:(page-1)*limit,take:limit,
   select:{id:true,returnReceiptNo:true,returnedAt:true,status:true,refundAmount:true,reason:true,processor:{select:{fullName:true}},items:{orderBy:{id:'asc'},select:{id:true,saleItemId:true,quantity:true,lineTotal:true,disposition:true,saleItem:{select:{productName:true,sku:true,unit:true}}}}}})
  return {success:true,data,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}
 },{isolationLevel:'RepeatableRead'})
 return NextResponse.json(result)
})
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 const {id}=await params
 const result=await returnSale(context,id,returnSchema.parse(await request.json()))
 return NextResponse.json({success:true,data:result})
})
