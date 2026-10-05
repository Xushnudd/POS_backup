import { prisma } from '@/lib/prisma'
import type { TokenPayload } from '@/lib/auth'
import { tenantScope } from './policy'

// Defense in depth for top-level ORM operations. Nested relation consistency is
// validated by the request guard and DB constraints, not by this extension.
export function scopedPrisma(context: TokenPayload) {
  return prisma.$extends({ query: { $allModels: { async $allOperations({ model, operation, args, query }) {
    const input = args as unknown as Record<string, unknown>
    if (['findUnique','findUniqueOrThrow','findFirst','findFirstOrThrow','findMany','count','aggregate','groupBy','update','updateMany','delete','deleteMany','upsert'].includes(operation)) {
      const where = (input.where ?? {}) as Record<string, unknown>
      input.where = { ...where, AND: [where.AND ?? {}, tenantScope(model, context)] }
    }
    return query(args)
  } } } })
}
