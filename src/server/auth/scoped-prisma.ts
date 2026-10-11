import { prisma } from '@/lib/prisma'
import type { TokenPayload } from '@/lib/auth'
import {tenantInsertReference} from './tenant-write'
import {AccessError, tenantScope } from './policy'

// Defense in depth for top-level ORM operations. Nested relation consistency is
// validated by the request guard and DB constraints, not by this extension.
export function scopedPrisma(context: TokenPayload) {
  return prisma.$extends({ query: { $allModels: { async $allOperations({ model, operation, args, query }) {
    const input = args as unknown as Record<string, unknown>
    tenantScope(model,context) // Unknown/shared models never inherit an implicit scope.
    if(['create','createMany','createManyAndReturn','upsert'].includes(operation)){
      const values=operation==='upsert'?[input.create]:Array.isArray(input.data)?input.data:[input.data]
      for(const value of values){
        const parent=tenantInsertReference(model,value,context)
        if(parent){
          const delegate=(prisma as unknown as Record<string,{findFirst(input:unknown):Promise<unknown>}>)[parent.model[0].toLowerCase()+parent.model.slice(1)]
          if(!await delegate.findFirst({where:{id:parent.id,AND:tenantScope(parent.model,context)},select:{id:true}}))throw new AccessError(404,'NOT_FOUND')
        }
      }
    }
    if (['findUnique','findUniqueOrThrow','findFirst','findFirstOrThrow','findMany','count','aggregate','groupBy','update','updateMany','delete','deleteMany','upsert'].includes(operation)) {
      const where = (input.where ?? {}) as Record<string, unknown>
      input.where = { ...where, AND: [where.AND ?? {}, tenantScope(model, context)] }
    }
    return query(args)
  } } } })
}
