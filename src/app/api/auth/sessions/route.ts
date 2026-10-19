import {Prisma} from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withApi } from '@/server/api'
import { getRequestToken, verifySession } from '@/server/auth/session'
import { AccessError } from '@/server/auth/policy'
import { consumeLimit } from '@/server/auth/rate-limit'
import { assertLiveContext, audit } from '@/server/operations'
async function contextFor(request:NextRequest){
 const context=await verifySession(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');return context
}
export const GET=withApi(async(request:NextRequest)=>{
 const context=await contextFor(request),now=new Date()
 const page=Number(request.nextUrl.searchParams.get('page')??1),limit=Number(request.nextUrl.searchParams.get('limit')??20)
 if((page-1)*limit>2147483647)throw new AccessError(400,'INVALID_PAGINATION')
 await consumeLimit('session.read',context.userId,60,60000)
 const state=z.enum(['active','all','revoked','expired']).parse(request.nextUrl.searchParams.get('state')??'active')
 const result=await prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  const where:Prisma.SessionWhereInput={userId:context.userId,...(state!=='active'?{createdAt:{gte:new Date(now.getTime()-90*86400000)}}:{}),...(state==='active'?{revokedAt:null,expiresAt:{gt:now},idleExpiresAt:{gt:now}}:state==='revoked'?{revokedAt:{not:null}}:state==='expired'?{revokedAt:null,OR:[{expiresAt:{lte:now}},{idleExpiresAt:{lte:now}}]}:{})}
  const total=await tx.session.count({where})
  const rows=await tx.session.findMany({where,skip:(page-1)*limit,take:limit,orderBy:[{createdAt:'desc'},{id:'asc'}],select:{id:true,organizationId:true,createdAt:true,expiresAt:true,idleExpiresAt:true,revokedAt:true,authenticationMethod:true}})
  return {success:true,data:rows.map(row=>({...row,current:row.id===context.sessionId,status:row.revokedAt?'revoked':row.expiresAt<=now||row.idleExpiresAt<=now?'expired':'active'})),pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}
 },{isolationLevel:'RepeatableRead'})
 return NextResponse.json(result)
})
export const POST=withApi(async(request:NextRequest)=>{
 const context=await contextFor(request),input=z.object({sessionId:z.string().uuid()}).strict().parse(await request.json())
 if(input.sessionId===context.sessionId)throw new AccessError(409,'CURRENT_SESSION','Joriy sessiyadan chiqish uchun Chiqish tugmasini ishlating')
 await consumeLimit('session.revoke',context.userId,30,60000)
 const result=await prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  const target=await tx.session.findFirst({where:{id:input.sessionId,userId:context.userId},select:{id:true}})
  if(!target)throw new AccessError(404,'NOT_FOUND')
  const changed=await tx.session.updateMany({where:{id:target.id,userId:context.userId,revokedAt:null},data:{revokedAt:new Date()}})
  if(changed.count)await audit(tx,context,'Session',target.id,'session_revoked')
  return {id:target.id,revoked:true}
 })
 return NextResponse.json({success:true,data:result})
})
