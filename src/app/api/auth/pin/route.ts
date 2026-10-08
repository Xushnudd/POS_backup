import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import bcrypt from 'bcryptjs'
import {prisma} from '@/lib/prisma'
import {getRequestToken,verifyToken,verifyPassword} from '@/lib/auth'
import {withApi} from '@/server/api'
import {AccessError} from '@/server/auth/policy'
import {assertLiveContext,audit} from '@/server/operations'
import {consumeLimit} from '@/server/auth/rate-limit'
const schema=z.object({currentPassword:z.string().min(1).max(72),pin:z.string().regex(/^\d{6}$/).nullable()}).strict()
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');if(context.role!=='cashier')throw new AccessError(403,'CASHIER_ONLY');
 await consumeLimit('pin-configuration',context.organizationUserId);const input=schema.parse(await request.json());const user=await prisma.user.findUniqueOrThrow({where:{id:context.userId}});if(!await verifyPassword(input.currentPassword,user.passwordHash))throw new AccessError(403,'INVALID_PASSWORD');
 const pinHash=input.pin===null?null:await bcrypt.hash(input.pin,12);
 await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id=${context.userId} FOR UPDATE`;await assertLiveContext(tx,context);const current=await tx.user.findUniqueOrThrow({where:{id:context.userId}});if(current.passwordHash!==user.passwordHash)throw new AccessError(409,'PASSWORD_CHANGED');await tx.organizationUser.update({where:{id:context.organizationUserId},data:{pinHash}});await tx.session.updateMany({where:{userId:context.userId,organizationId:context.organizationId,authenticationMethod:'pin',revokedAt:null},data:{revokedAt:new Date()}});await audit(tx,context,'OrganizationUser',context.organizationUserId,input.pin===null?'pin_disabled':'pin_changed');});return NextResponse.json({success:true});
})
