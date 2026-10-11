import {queryReportsSupplierBalances} from '@/server/exports/queries/reports-supplier-balances'
import {NextRequest} from 'next/server'



import {getRequestToken,verifyToken} from '@/lib/auth'
import {withApi} from '@/server/api'
import {AccessError} from '@/server/auth/policy'




export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return queryReportsSupplierBalances(context,request)
})
