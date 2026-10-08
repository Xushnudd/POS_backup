import { createHash } from 'node:crypto'
import type {Prisma} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AccessError } from './policy'
export async function consumeLimit(category:string,identity:string,limit=5,windowMs=15*60*1000) {
 const key=createHash('sha256').update(category+':'+identity).digest('hex')
 const now=new Date(),expires=new Date(now.getTime()+windowMs)
 const rows=await prisma.$queryRaw<{attempts:number;expiresAt:Date}[]>`
  INSERT INTO "RateLimit" (key,attempts,"expiresAt") VALUES (${key},1,${expires})
  ON CONFLICT (key) DO UPDATE SET attempts=CASE WHEN "RateLimit"."expiresAt"<=${now} THEN 1 ELSE "RateLimit".attempts+1 END,
  "expiresAt"=CASE WHEN "RateLimit"."expiresAt"<=${now} THEN ${expires} ELSE "RateLimit"."expiresAt" END
  RETURNING attempts,"expiresAt"`
 if (rows[0].attempts>limit) throw new AccessError(429,'RATE_LIMITED','Ko‘p urinish. Keyinroq qayta urinib ko‘ring',Math.max(1,Math.ceil((rows[0].expiresAt.getTime()-now.getTime())/1000)))
}
export async function clearLimit(category:string,identity:string,tx?:Prisma.TransactionClient) {
 const key=createHash('sha256').update(category+':'+identity).digest('hex')
 await (tx??prisma).rateLimit.deleteMany({where:{key}})
}
