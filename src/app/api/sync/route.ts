import {commitOfflineCash,commitCashSchema} from '@/server/offline/cash'
import {recordConflict} from '@/server/sync/reviews'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withApi } from '@/server/api'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { AccessError, assertRoutePermission } from '@/server/auth/policy'
import { createDraft, saleDraftSchema, completeSale, completeSchema } from '@/server/sales/service'
import { returnSale, returnSchema } from '@/server/returns/service'
import { collectDebt, collectionSchema } from '@/server/payments/collections'
const schema=z.object({commands:z.array(z.object({operationId:z.string().uuid(),type:z.enum(['sale.create','sale.complete','sale.return','debt.collect','offline.cash']),payload:z.unknown()})).min(1).max(25)})
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 const input=schema.parse(await request.json())
 const results=[]
 for (const command of input.commands) {
  try {
   let result:unknown
   const object=z.record(z.string(),z.unknown()).parse(command.payload)
   if(command.type==='offline.cash'){
    result=await commitOfflineCash(context,commitCashSchema.parse({...object,operationId:command.operationId}))
   } else if (command.type==='sale.create') {
    assertRoutePermission('/api/sales','POST',context.role)
    const data=saleDraftSchema.parse({...object,operationId:command.operationId})
    result=await createDraft(context,data,command.operationId)
   } else if (command.type==='sale.complete') {
    assertRoutePermission('/api/sales','POST',context.role)
    const saleId=z.string().uuid().parse(object.saleId)
    result=await completeSale(context,saleId,completeSchema.parse(object),command.operationId)
   } else if (command.type==='sale.return') {
    assertRoutePermission('/api/sales','POST',context.role)
    const saleId=z.string().uuid().parse(object.saleId)
    result=await returnSale(context,saleId,returnSchema.parse({...object,operationId:command.operationId}))
   } else {
    assertRoutePermission('/api/payments/credit','POST',context.role)
    result=await collectDebt(context,collectionSchema.parse({...object,operationId:command.operationId}))
   }
   results.push({operationId:command.operationId,state:'synced',result})
  } catch (error) {
   const code=error instanceof AccessError?error.code:error instanceof z.ZodError?'VALIDATION_ERROR':'INTERNAL_ERROR'
   const retryable=code==='INTERNAL_ERROR'||code==='CONCURRENT_CONFLICT'
   let reviewId:string|undefined
   if(!retryable){const review=await recordConflict(context,command,code);reviewId=review.id}
   results.push({operationId:command.operationId,state:retryable?'pending':'conflict',code,reviewId})
  }
 }
 return NextResponse.json({success:true,data:results})
})
