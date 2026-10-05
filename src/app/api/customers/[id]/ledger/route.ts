import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { commercialStatementCsv } from '@/server/customers/commercial'
import { statementHtml } from '@/server/customers/print'
import { statementCsv } from '@/server/customers/export'
import { customerStatement, postDebtDocument, debtDocumentSchema } from '@/server/customers/ledger'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const query=new URL(request.url).searchParams
 if(context.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')
 const exporting=['csv','commercial-csv','html'].includes(query.get('format')??'')
 await consumeLimit(exporting?'customer.export':'customer.statement',context.organizationId+':'+context.userId,exporting?10:60,60000)
 if(query.get('format')==='commercial-csv')return NextResponse.json({success:true,data:await commercialStatementCsv(context,(await params).id,{from:query.get('from'),to:query.get('to')})})
 if(['csv','html'].includes(query.get('format')??'')){
  const id=(await params).id,period={from:query.get('from'),to:query.get('to')}
  const statement=await customerStatement(context,id,{...period,exportAll:true})
  const html=query.get('format')==='html'
  return NextResponse.json({success:true,data:{filename:`customer-debt-${id}.${html?'html':'csv'}`,content:html?statementHtml(statement,period):statementCsv(statement,period)}})
 }
 return NextResponse.json({success:true,data:await customerStatement(context,(await params).id,{page:Number(query.get('page')??1),limit:Number(query.get('limit')??50),from:query.get('from'),to:query.get('to')})})
})
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return NextResponse.json({success:true,data:await postDebtDocument(context,(await params).id,debtDocumentSchema.parse(await request.json()))})
})
