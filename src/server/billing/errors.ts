import { Prisma } from '@prisma/client'
import { AccessError } from '../auth/policy'
export function billingDatabaseError(error: unknown): AccessError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) && !(error instanceof Prisma.PrismaClientUnknownRequestError)) return null
  const text = error instanceof Prisma.PrismaClientKnownRequestError ? String(error.meta?.database_error ?? error.meta?.message ?? error.message) : error.message
  const code = text.match(/(?:message: "|ERROR:\s*)(PLAN_LIMIT_REACHED|SUBSCRIPTION_EXPIRED)(?:"|\s|$)/)?.[1]
  if (code === 'PLAN_LIMIT_REACHED') return new AccessError(409, code, 'Tarif limiti tugadi. Mavjud ma’lumotlar saqlanadi; tarifni yangilang.')
  if (code === 'SUBSCRIPTION_EXPIRED') return new AccessError(409, code, 'Obuna muddati tugadi. Ko‘rish va eksport ochiq; yangi savdo uchun obunani yangilang.')
  return null
}
