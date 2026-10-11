// Operator-only service; no HTTP endpoint accepts deployment keys.
import {createHash,randomUUID} from 'node:crypto'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {AccessError} from './policy'
import {totpKeyConfiguration} from './totp-keys'
import {isTotpEnvelopeCurrent,sealTotpSecret,unsealTotpSecret} from './totp'
const hash=(value:string)=>createHash('sha256').update(value).digest('hex')
export const rotationSchema=z.object({actorId:z.string().uuid(),batchId:z.string().uuid(),reason:z.string().trim().min(3).max(2000)}).strict()
export async function rotateTotpEnvelope(input:z.input<typeof rotationSchema>,factorId:string,apply=false){
 const parsed=rotationSchema.parse(input);z.string().uuid().parse(factorId)
 const configuration=totpKeyConfiguration();if(!configuration)throw new AccessError(503,'TOTP_UNAVAILABLE')
 return prisma.$transaction(async tx=>{
  if(!await tx.platformOperator.findFirst({where:{userId:parsed.actorId,role:'platform_admin',isActive:true,user:{isActive:true}}}))throw new AccessError(403,'PLATFORM_ADMIN_REQUIRED')
  const original=await tx.totpFactor.findUnique({where:{id:factorId},select:{userId:true}})
  if(!original)return {state:'absent' as const}
  // Same first lock as proof/recovery/enrollment prevents replay-counter races.
  for(const id of [...new Set([original.userId,parsed.actorId])].sort())await tx.$queryRaw`SELECT id FROM "User" WHERE id=${id} FOR UPDATE`
  await tx.$queryRaw`SELECT "userId" FROM "PlatformOperator" WHERE "userId"=${parsed.actorId} FOR SHARE`
  if(!await tx.platformOperator.findFirst({where:{userId:parsed.actorId,role:'platform_admin',isActive:true,user:{isActive:true}}}))throw new AccessError(403,'PLATFORM_ADMIN_REQUIRED')
  const factor=await tx.totpFactor.findFirst({where:{id:factorId,revokedAt:null,sealedSecret:{not:null}}})
  if(!factor)return {state:'absent' as const}
  if(isTotpEnvelopeCurrent(factor.sealedSecret!,factor.userId,factor.id))return {state:'current' as const}
  if(!apply)return {state:'pending' as const}
  const secret=unsealTotpSecret(factor.sealedSecret!,factor.userId,factor.id),sealed=sealTotpSecret(secret,factor.userId,factor.id)
  // Verify both ciphertext and binding before any write; counters/codes stay unchanged.
  if(unsealTotpSecret(sealed,factor.userId,factor.id)!==secret||!isTotpEnvelopeCurrent(sealed,factor.userId,factor.id))throw new AccessError(409,'TOTP_SECRET_INVALID')
  await tx.totpKeyRotation.create({data:{id:randomUUID(),...parsed,factorId:factor.id,oldEnvelopeHash:hash(factor.sealedSecret!),newEnvelopeHash:hash(sealed),targetKeyFingerprint:createHash('sha256').update(Buffer.from(configuration.current,'hex')).digest('hex')}})
  await tx.totpFactor.update({where:{id:factor.id},data:{sealedSecret:sealed}})
  return {state:'rotated' as const}
 },{timeout:10000})
}
