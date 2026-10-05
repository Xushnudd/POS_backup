import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/server/api'
import { prisma } from '@/lib/prisma'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 const params=new URL(request.url).searchParams
 const key=params.get('operationId'),type=params.get('type')
 if (!key || !type) throw new AccessError(400,'MISSING_PARAM')
 const operation=await prisma.operation.findUnique({where:{organizationId_type_key:{organizationId:context.organizationId,type,key}}})
 if (!operation) return NextResponse.json({success:true,data:{state:'not_found'}})
 // Cashiers may only retrieve results for their own economic operations.
 const result=operation.result as Record<string,unknown>
 if (context.role==='cashier' && result.cashierId!==context.userId) throw new AccessError(403,'FORBIDDEN')
 return NextResponse.json({success:true,data:{state:'completed',result:operation.result}})
})
