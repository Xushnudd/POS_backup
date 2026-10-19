import {queryReportsSales} from '@/server/exports/queries/reports-sales'

import {NextRequest} from 'next/server'

import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'


export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if(!context)throw new AccessError(401,'UNAUTHORIZED')
 return queryReportsSales(context,request)
})
