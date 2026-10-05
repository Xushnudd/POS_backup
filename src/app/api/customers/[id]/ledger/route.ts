import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { customerStatement, postDebtDocument, debtDocumentSchema } from '@/server/customers/ledger'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const query=new URL(request.url).searchParams
 return NextResponse.json({success:true,data:await customerStatement(context,(await params).id,{page:Number(query.get('page')??1),limit:Number(query.get('limit')??50),from:query.get('from'),to:query.get('to')})})
})
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return NextResponse.json({success:true,data:await postDebtDocument(context,(await params).id,debtDocumentSchema.parse(await request.json()))})
})
