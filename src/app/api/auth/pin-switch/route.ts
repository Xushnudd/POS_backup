import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import bcrypt from 'bcryptjs'
import {prisma} from '@/lib/prisma'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {withApi} from '@/server/api'
import {AccessError,tenantScope} from '@/server/auth/policy'
import {assertLiveContext,audit} from '@/server/operations'
import {consumeLimit,clearLimit} from '@/server/auth/rate-limit'
import {paging,pagination} from '@/server/catalog/queries'
import {createSession,setSessionCookie} from '@/server/auth/session'
const schema=z.object({targetMembershipId:z.string().uuid(),storeId:z.string().uuid(),pin:z.string().regex(/^\d{6}$/)}).strict()
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');const storeId=z.string().uuid().parse(request.nextUrl.searchParams.get('storeId'));
 return prisma.$transaction(async tx=>{await assertLiveContext(tx,context);if(!await tx.store.findFirst({where:{id:storeId,AND:tenantScope('Store',context),isActive:true}}))throw new AccessError(404,'NOT_FOUND');const {page,limit,skip}=paging(request.nextUrl.searchParams),where={organizationId:context.organizationId,role:'cashier',isActive:true,pinHash:{not:null},user:{isActive:true},userStores:{some:{storeId}}},total=await tx.organizationUser.count({where}),rows=await tx.organizationUser.findMany({where,select:{id:true,user:{select:{fullName:true}}},orderBy:{id:'asc'},skip,take:limit});return NextResponse.json({success:true,data:rows.map(row=>({id:row.id,fullName:row.user.fullName})),pagination:pagination(page,limit,total)});},{isolationLevel:'RepeatableRead'});
})
export const POST=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');const input=schema.parse(await request.json());await consumeLimit('pin-switch-actor',context.userId,20);await consumeLimit('pin-switch-target',context.organizationId+':'+input.targetMembershipId,5);
 const token=await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Session" WHERE id=${context.sessionId} FOR UPDATE`;await assertLiveContext(tx,context);if(!await tx.store.findFirst({where:{id:input.storeId,AND:tenantScope('Store',context),isActive:true}}))throw new AccessError(404,'NOT_FOUND');await tx.$queryRaw`SELECT id FROM "OrganizationUser" WHERE id=${input.targetMembershipId} AND "organizationId"=${context.organizationId} FOR UPDATE`;const target=await tx.organizationUser.findFirst({where:{id:input.targetMembershipId,organizationId:context.organizationId,role:'cashier',isActive:true,pinHash:{not:null},user:{isActive:true},userStores:{some:{storeId:input.storeId}}}});if(!target||!await bcrypt.compare(input.pin,target.pinHash!))throw new AccessError(401,'INVALID_PIN','Kassir yoki PIN noto‘g‘ri');await clearLimit('pin-switch-target',context.organizationId+':'+input.targetMembershipId,tx);await clearLimit('pin-switch-actor',context.userId,tx);const token=await createSession(tx,target.userId,context.organizationId,{pinStoreId:input.storeId});await tx.session.updateMany({where:{id:context.sessionId,revokedAt:null},data:{revokedAt:new Date()}});await audit(tx,context,'OrganizationUser',target.id,'cashier_pin_switch',{storeId:input.storeId});return token;},{timeout:15000});
 const response=NextResponse.json({success:true});setSessionCookie(response,token);return response;
})
