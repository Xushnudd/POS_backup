import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newPasswordSchema } from '@/server/auth/password-policy'
import { hashPassword } from '@/lib/auth'
import { acceptInvitationSchema } from '@/server/users/invitations'
test('All new-password boundaries reject UTF-8 truncation and preserve the 72-byte boundary',async()=>{
 assert.ok(newPasswordSchema.safeParse('я'.repeat(36)).success)
 assert.equal(newPasswordSchema.safeParse('я'.repeat(37)).success,false)
 assert.equal(newPasswordSchema.safeParse('😀'.repeat(20)).success,false)
 assert.equal(newPasswordSchema.safeParse('short').success,false)
 await assert.rejects(()=>hashPassword('я'.repeat(40)))
 assert.equal(acceptInvitationSchema.safeParse({token:'a'.repeat(43),password:'я'.repeat(40)}).success,false)
})
