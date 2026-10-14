import {parseListQuery,reconciliationListSorts} from '@/lib/list-query'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { reconcile } from '@/server/reconciliation/service'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 const params=new URL(request.url).searchParams
 const kind=z.enum(['inventory','sales','returns','shifts']).parse(params.get('kind')??'inventory')
 let parsed;try{parsed=parseListQuery(params,reconciliationListSorts,'source',50)}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER')}
 const {page,limit,sort,search}=parsed,result=await reconcile(context,kind,params.get('storeId')??undefined,page,limit,{sort,search})
 return NextResponse.json({success:true,data:result.rows,pagination:result.pagination})
})
