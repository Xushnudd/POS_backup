import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { AccessError } from '../auth/policy'

// Empty optional tax identity means absent, never a shared unique empty string.
export const organizationTin = z.preprocess(
  value => typeof value === 'string' ? value.trim() || null : value,
  z.string().nullable().optional(),
)
export const organizationCurrency = z.string().trim().regex(/^[A-Z]{3}$/)
export const organizationTimezone = z.string().trim().min(1).max(100).refine(value => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true }
  catch { return false }
}, 'Invalid timezone')

export function organizationError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && error.meta?.modelName === 'Organization') {
    const target = error.meta.target
    if (Array.isArray(target) && target.length === 1 && target[0] === 'tin') return new AccessError(409, 'TIN_EXISTS')
  }
  return error
}
