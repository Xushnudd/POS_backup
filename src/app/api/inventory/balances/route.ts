import {queryInventoryBalances} from '@/server/exports/queries/inventory-balances'


import {NextRequest} from 'next/server'

import {withApi} from '@/server/api'

import {verifyToken,getRequestToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return queryInventoryBalances(context,request)
})
