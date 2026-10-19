import type {Prisma} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import {AccessError} from './policy'
export async function authenticationRestoreReady(db:Pick<Prisma.TransactionClient,'$queryRaw'>=prisma){
 const rows=await db.$queryRaw<{ready:boolean}[]>`SELECT auth_restore_ready() AS ready`
 return rows[0]?.ready===true
}
export async function assertAuthenticationRestoreReady(db:Pick<Prisma.TransactionClient,'$queryRaw'>=prisma){
 if(!await authenticationRestoreReady(db))throw new AccessError(503,'AUTH_RESTORE_REVIEW_REQUIRED','Tiklangan hisoblar operator tekshiruvini kutmoqda')
}
