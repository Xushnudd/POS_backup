import {test} from 'node:test'
import assert from 'node:assert/strict'
import {Prisma} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import {runOperation} from '@/server/operations'
import {AccessError} from '@/server/auth/policy'
import type {TokenPayload} from '@/lib/auth'
test('Serialization and deadlock retry stop at three attempts with a controlled conflict',async()=>{
 const original=prisma.$transaction
 const context={} as TokenPayload
 try{
  for(const error of [new Prisma.PrismaClientKnownRequestError('serialization',{code:'P2034',clientVersion:'5.22.0'}),new Prisma.PrismaClientKnownRequestError('deadlock',{code:'P2010',clientVersion:'5.22.0',meta:{code:'40P01'}})]){
   let attempts=0
   prisma.$transaction=(async()=>{attempts++;throw error}) as typeof prisma.$transaction
   await assert.rejects(()=>runOperation(context,'test','key',{},async()=>null),error=>error instanceof AccessError&&error.status===409&&error.code==='CONCURRENT_CONFLICT')
   assert.equal(attempts,3)
  }
  let attempts=0;const forbidden=new AccessError(403,'FORBIDDEN')
  prisma.$transaction=(async()=>{attempts++;throw forbidden}) as typeof prisma.$transaction
  await assert.rejects(()=>runOperation(context,'test','key',{},async()=>null),error=>error===forbidden);assert.equal(attempts,1)
 }finally{prisma.$transaction=original;await prisma.$disconnect()}
})
