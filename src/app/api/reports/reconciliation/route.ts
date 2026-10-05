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
 const result=await reconcile(context,kind,params.get('storeId')??undefined,Number(params.get('page')??1),Number(params.get('limit')??50))
 return NextResponse.json({success:true,data:result.rows,pagination:result.pagination})
})
