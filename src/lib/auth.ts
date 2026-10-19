import { newPasswordSchema } from '@/server/auth/password-policy'
import bcrypt from 'bcryptjs'
export { verifySession as verifyToken, getRequestToken } from '@/server/auth/session'
export type TokenPayload = NonNullable<Awaited<ReturnType<typeof import('@/server/auth/session').verifySession>>>

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(newPasswordSchema.parse(password), 12)
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
