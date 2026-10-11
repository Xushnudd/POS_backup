import { Prisma } from '@prisma/client'
import { AccessError } from '../auth/policy'
export function billingDatabaseError(error: unknown): AccessError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) && !(error instanceof Prisma.PrismaClientUnknownRequestError)) return null
  const text = error instanceof Prisma.PrismaClientKnownRequestError ? String(error.meta?.database_error ?? error.meta?.message ?? error.message) : error.message
  const code = text.match(/(?:message: "|ERROR:\s*)(PLAN_LIMIT_REACHED|SUBSCRIPTION_EXPIRED|ORGANIZATION_CLOSING|CLOSURE_CANCELLATION_EXPIRED|CLOSURE_ACTIVE_WORK)(?:"|\s|$)/)?.[1]
  if (code === 'ORGANIZATION_CLOSING') return new AccessError(409, code, 'Tashkilotni yopish so‘rovi faol. Ko‘rish va eksport ochiq; muddat ichida egasi so‘rovni bekor qilishi mumkin.')
  if (code === 'CLOSURE_CANCELLATION_EXPIRED' || code === 'CLOSURE_ACTIVE_WORK') return new AccessError(409, code, code === 'CLOSURE_ACTIVE_WORK' ? 'Avval ochiq amallarni hal qiling.' : 'Yopish so‘rovini bekor qilish muddati tugadi.')
  if (code === 'PLAN_LIMIT_REACHED') return new AccessError(409, code, 'Tarif limiti tugadi. Mavjud ma’lumotlar saqlanadi; tarifni yangilang.')
  if (code === 'SUBSCRIPTION_EXPIRED') return new AccessError(409, code, 'Obuna muddati tugadi. Ko‘rish va eksport ochiq; yangi biznes amallari uchun obunani yangilang.')
  return null
}
