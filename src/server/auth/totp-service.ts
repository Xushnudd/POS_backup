import { createHash, randomUUID, randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { TOTP } from 'otpauth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword, type TokenPayload } from '@/lib/auth'
import { assertLiveContext, audit } from '../operations'
import { AccessError } from './policy'
import { consumeLimit } from './rate-limit'
import { matchTotpCounter, newTotpSecret, sealTotpSecret, unsealTotpSecret } from './totp'

const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const recoveryHash = (factorId: string, code: string) => digest('pos-totp-recovery-v1\0' + factorId + '\0' + code)
const password = z.string().min(1).max(72).refine(value => Buffer.byteLength(value,'utf8') <= 72, 'Parol UTF-8 bo‘yicha 72 baytdan oshmasin')
export const totpEnrollmentSchema = z.object({ password }).strict()
export const totpConfirmationSchema = z.object({ factorId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) }).strict()
export const totpProofSchema = z.object({ code: z.string().regex(/^\d{6}$/), action: z.string().regex(/^[a-z][a-z0-9_.-]{2,80}(?![\s\S])/), operationKey: z.string().uuid(), payloadHash: z.string().regex(/^[0-9a-f]{64}$/) }).strict()
export const totpRecoverySchema = z.object({ password, factorId: z.string().uuid(), recoveryCode: z.string().regex(/^[0-9a-f]{32}$/) }).strict()
export const totpRotationSchema = z.object({ password, code: z.string().regex(/^\d{6}$/) }).strict()
async function issueRecoveryCodes(tx: Prisma.TransactionClient, factorId: string, now: Date) {
  const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(16).toString('hex'))
  for (const code of recoveryCodes) await tx.totpRecoveryCode.create({ data: { factorId, secretHash: recoveryHash(factorId, code), createdAt: now, expiresAt: new Date(now.getTime() + 365 * 86400000) } })
  return recoveryCodes
}
async function identity(tx: Prisma.TransactionClient, ctx: TokenPayload, currentPassword?: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${ctx.userId} FOR UPDATE`
  await tx.$queryRaw`SELECT id FROM "Session" WHERE id=${ctx.sessionId} FOR UPDATE`
  await assertLiveContext(tx, ctx)
  const session = await tx.session.findFirst({ where: { id: ctx.sessionId, userId: ctx.userId, authenticationMethod: 'password' } })
  if (!session) throw new AccessError(403, 'PASSWORD_SESSION_REQUIRED')
  const user = await tx.user.findUniqueOrThrow({ where: { id: ctx.userId } })
  if (currentPassword !== undefined && !await verifyPassword(currentPassword, user.passwordHash)) throw new AccessError(403, 'REAUTHENTICATION_FAILED')
  const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`
  return { user, now }
}
export async function beginTotpEnrollment(ctx: TokenPayload, input: z.input<typeof totpEnrollmentSchema>) {
  const parsed = totpEnrollmentSchema.parse(input)
  await consumeLimit('auth.totp.enroll', ctx.userId, 5, 15 * 60000)
  return prisma.$transaction(async tx => {
    const { user, now } = await identity(tx, ctx, parsed.password)
    const active = await tx.totpFactor.findFirst({ where: { userId: ctx.userId, revokedAt: null } })
    if (active?.confirmedAt) throw new AccessError(409, 'TOTP_ALREADY_ENABLED')
    if (active) await tx.totpFactor.update({ where: { id: active.id }, data: { revokedAt: now, sealedSecret: null } })
    const id = randomUUID(), secret = newTotpSecret(), expiresAt = new Date(now.getTime() + 10 * 60000)
    await tx.totpFactor.create({ data: { id, userId: ctx.userId, sessionId: ctx.sessionId!, passwordDigest: digest(user.passwordHash), sealedSecret: sealTotpSecret(secret, ctx.userId, id), createdAt: now, expiresAt } })
    await audit(tx, ctx, 'TotpFactor', id, 'enrollment_started', { expiresAt })
    // A credential is intentionally presented once to its reauthenticated owner.
    // Never put this URI in audit, logs, operation results or local storage.
    return { factorId: id, expiresAt, provisioningUri: new TOTP({ issuer: 'POS', label: ctx.userId, secret, algorithm: 'SHA1', digits: 6, period: 30 }).toString() }
  })
}
export async function confirmTotpEnrollment(ctx: TokenPayload, input: z.input<typeof totpConfirmationSchema>) {
  const parsed = totpConfirmationSchema.parse(input)
  await consumeLimit('auth.totp.verify', ctx.userId, 20, 15 * 60000)
  const accepted = await prisma.$transaction(async tx => {
    const { user, now } = await identity(tx, ctx)
    const factor = await tx.totpFactor.findFirst({ where: { id: parsed.factorId, userId: ctx.userId, sessionId: ctx.sessionId, revokedAt: null, confirmedAt: null } })
    if (!factor || factor.expiresAt <= now || factor.attempts >= 5 || factor.passwordDigest !== digest(user.passwordHash)) return false
    const counter = matchTotpCounter(unsealTotpSecret(factor.sealedSecret!, ctx.userId, factor.id), parsed.code, now.getTime(), factor.lastCounter)
    if (counter === null) {
      const attempts = factor.attempts + 1
      await tx.totpFactor.update({ where: { id: factor.id }, data: { attempts, ...(attempts === 5 ? { revokedAt: now, sealedSecret: null } : {}) } })
      return false // Invalid attempts commit before the HTTP error.
    }
    await tx.totpFactor.update({ where: { id: factor.id }, data: { confirmedAt: now, lastCounter: counter } })
    await audit(tx, ctx, 'TotpFactor', factor.id, 'enrollment_confirmed', {})
    return issueRecoveryCodes(tx, factor.id, now)
  })
  if (!accepted) throw new AccessError(409, 'TOTP_CODE_INVALID')
  // Presented once; database/audit persist hashes only. A lost response requires
  // an authenticated rotation workflow, never plaintext retrieval from storage.
  return { enabled: true, recoveryCodes: accepted }
}
export async function createTotpProof(ctx: TokenPayload, input: z.input<typeof totpProofSchema>) {
  const parsed = totpProofSchema.parse(input)
  await consumeLimit('auth.totp.verify', ctx.userId, 20, 15 * 60000)
  const result = await prisma.$transaction(async tx => {
    const { user, now } = await identity(tx, ctx)
    const factor = await tx.totpFactor.findFirst({ where: { userId: ctx.userId, revokedAt: null, confirmedAt: { not: null } } })
    if (!factor || factor.passwordDigest !== digest(user.passwordHash)) return null
    const counter = matchTotpCounter(unsealTotpSecret(factor.sealedSecret!, ctx.userId, factor.id), parsed.code, now.getTime(), factor.lastCounter)
    if (counter === null) return null
    await tx.totpFactor.update({ where: { id: factor.id }, data: { lastCounter: counter } })
    const proof = await tx.totpProof.create({ data: { userId: ctx.userId, factorId: factor.id, sessionId: ctx.sessionId!, action: parsed.action, operationKey: parsed.operationKey, payloadHash: parsed.payloadHash, createdAt: now, expiresAt: new Date(now.getTime() + 5 * 60000) } })
    await audit(tx, ctx, 'TotpProof', proof.id, 'step_up_verified', { action: parsed.action, operationKey: parsed.operationKey })
    return { proofId: proof.id, expiresAt: proof.expiresAt }
  })
  if (!result) throw new AccessError(409, 'TOTP_CODE_INVALID')
  return result
}
export async function assertTotpStepUp(tx: Prisma.TransactionClient, ctx: TokenPayload, action: string, operationKey: string, payloadHash: string) {
  const { user, now } = await identity(tx, ctx)
  const proof = await tx.totpProof.findFirst({ where: { userId: ctx.userId, sessionId: ctx.sessionId, action, operationKey, payloadHash, expiresAt: { gt: now }, factor: { revokedAt: null, confirmedAt: { not: null }, passwordDigest: digest(user.passwordHash) } } })
  if (!proof) throw new AccessError(403, 'STEP_UP_REQUIRED')
  if (!proof.approvedOperationAt) await tx.totpProof.update({ where: { id: proof.id }, data: { approvedOperationAt: now } })
}
export async function recoverTotpFactor(ctx: TokenPayload, input: z.input<typeof totpRecoverySchema>) {
  const parsed = totpRecoverySchema.parse(input)
  await consumeLimit('auth.totp.recover', ctx.userId, 5, 15 * 60000)
  const accepted = await prisma.$transaction(async tx => {
    const { now } = await identity(tx, ctx, parsed.password)
    const factor = await tx.totpFactor.findFirst({ where: { id: parsed.factorId, userId: ctx.userId, confirmedAt: { not: null }, revokedAt: null } })
    if (!factor) return false
    const recovery = await tx.totpRecoveryCode.findFirst({ where: { factorId: factor.id, secretHash: recoveryHash(factor.id, parsed.recoveryCode), usedAt: null, expiresAt: { gt: now } } })
    if (!recovery) return false
    await tx.totpRecoveryCode.update({ where: { id: recovery.id }, data: { usedAt: now } })
    await tx.totpFactor.update({ where: { id: factor.id }, data: { revokedAt: now, sealedSecret: null } })
    await tx.session.updateMany({ where: { userId: ctx.userId, revokedAt: null }, data: { revokedAt: now } })
    const memberships = await tx.organizationUser.findMany({ where: { userId: ctx.userId, isActive: true }, select: { organizationId: true } })
    for (const membership of memberships) await tx.auditLog.create({ data: { organizationId: membership.organizationId, actorId: ctx.userId, entityType: 'TotpFactor', entityId: factor.id, action: 'factor_recovered', afterData: { allSessionsRevoked: true } } })
    return true
  })
  if (!accepted) throw new AccessError(409, 'TOTP_RECOVERY_INVALID')
  return { recovered: true, loginRequired: true }
}
export async function rotateTotpRecoveryCodes(ctx: TokenPayload, input: z.input<typeof totpRotationSchema>) {
  const parsed = totpRotationSchema.parse(input)
  await consumeLimit('auth.totp.rotate', ctx.userId, 5, 15 * 60000)
  return prisma.$transaction(async tx => {
    const { user, now } = await identity(tx, ctx, parsed.password)
    const factor = await tx.totpFactor.findFirst({ where: { userId: ctx.userId, confirmedAt: { not: null }, revokedAt: null } })
    if (!factor || factor.passwordDigest !== digest(user.passwordHash)) throw new AccessError(409, 'TOTP_CODE_INVALID')
    const counter = matchTotpCounter(unsealTotpSecret(factor.sealedSecret!, ctx.userId, factor.id), parsed.code, now.getTime(), factor.lastCounter)
    if (counter === null) throw new AccessError(409, 'TOTP_CODE_INVALID')
    await tx.totpFactor.update({ where: { id: factor.id }, data: { lastCounter: counter } })
    await tx.totpRecoveryCode.updateMany({ where: { factorId: factor.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })
    const recoveryCodes = await issueRecoveryCodes(tx, factor.id, now)
    await audit(tx, ctx, 'TotpFactor', factor.id, 'recovery_codes_rotated', {})
    return { factorId: factor.id, recoveryCodes, expiresAt: new Date(now.getTime() + 365 * 86400000) }
  })
}
export async function totpStatus(ctx: TokenPayload) {
  return prisma.$transaction(async tx => {
    await assertLiveContext(tx, ctx)
    const factor = await tx.totpFactor.findFirst({ where: { userId: ctx.userId, revokedAt: null } })
    if (!factor) return { enabled: false, factorId: null, enrollmentExpiresAt: null, recoveryCodesRemaining: 0, passwordRebindRequired: false }
    const user = await tx.user.findUniqueOrThrow({ where: { id: ctx.userId } })
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`
    return { enabled: !!factor.confirmedAt, factorId: factor.id, enrollmentExpiresAt: factor.confirmedAt ? null : factor.expiresAt,
      recoveryCodesRemaining: factor.confirmedAt ? await tx.totpRecoveryCode.count({ where: { factorId: factor.id, usedAt: null, expiresAt: { gt: now } } }) : 0,
      passwordRebindRequired: factor.passwordDigest !== digest(user.passwordHash) }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
}
