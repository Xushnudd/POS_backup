import {NextRequest,NextResponse} from 'next/server'
import {prisma} from '@/lib/prisma'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED')
 const rows=await prisma.ownershipTransfer.findMany({where:{organizationId:context.organizationId,state:'pending',expiresAt:{gt:new Date()},OR:[{fromMembershipId:context.organizationUserId},{toMembershipId:context.organizationUserId}]},orderBy:{createdAt:'desc'},take:20})
 return NextResponse.json({success:true,data:rows.map(row=>({...row,incoming:row.toMembershipId===context.organizationUserId}))})
})
