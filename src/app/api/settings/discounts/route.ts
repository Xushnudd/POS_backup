import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withApi } from '@/server/api'
import { getRequestToken, verifyToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
import { audit,assertLiveContext } from '@/server/operations'
const schema=z.object({cashierMaxPercent:z.number().min(0).max(100),adminMaxPercent:z.number().min(0).max(100),requireReasonFromPercent:z.number().min(0).max(100)})
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context || context.role!=='owner') throw new AccessError(403,'FORBIDDEN')
 return NextResponse.json({success:true,data:await prisma.discountPolicy.findFirst({where:{organizationId:context.organizationId,isActive:true}})})
})
export const PUT=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context || context.role!=='owner') throw new AccessError(403,'FORBIDDEN')
 const input=schema.parse(await request.json())
 const result=await prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${context.organizationId} FOR UPDATE`
  await tx.discountPolicy.updateMany({where:{organizationId:context.organizationId},data:{isActive:false}})
  const policy=await tx.discountPolicy.create({data:{organizationId:context.organizationId,...input}})
  await audit(tx,context,'DiscountPolicy',policy.id,'updated',input);return policy
 })
 return NextResponse.json({success:true,data:result})
})
