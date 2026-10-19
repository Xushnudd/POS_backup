import {queryInventoryMovements} from '@/server/exports/queries/inventory-movements'




import {AccessError} from '@/server/auth/policy'

import {withApi} from '@/server/api'
import {NextRequest} from 'next/server'
import {verifyToken,getRequestToken} from '@/lib/auth'

async function handleGET(request:NextRequest) {
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return queryInventoryMovements(context,request)
}
export const GET = withApi(handleGET)
