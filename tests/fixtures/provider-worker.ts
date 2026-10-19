// Test-only deterministic transport. Never imported by production workers.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { prisma } from '@/lib/prisma'
import { bindingKey, processProviderOutbox, type ProviderBinding } from '@/server/integrations/outbox'
const connection = new URL(process.env.DATABASE_URL ?? '')
if (connection.hostname !== '127.0.0.1' || connection.port !== '55439' || connection.pathname !== '/pos_test' || connection.username !== 'pos_test') throw new Error('Isolated DB only')
const id = process.env.POS_PROVIDER_TEST_INTENT ?? ''
if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Test intent missing')
const path = join(tmpdir(), 'pos-provider-restart-' + id + '.json')
const binding: ProviderBinding = {
  supportsCompensation: false,
  transport: {
    async execute(command) {
      if (command.operationId !== id || process.env.POS_PROVIDER_TEST_MODE !== 'crash') throw new Error('Unexpected resubmit')
      writeFileSync(path, JSON.stringify({ operationId: id, externalId: 'test-restart-' + id, executeCalls: 1 }), { flag: 'wx', mode: 0o600 })
      process.exit(0) // Remote commit simulated; crash before local acknowledgement.
    },
    async lookup(identity) {
      if (identity.operationId !== id) throw new Error('Wrong identity')
      const proof = JSON.parse(readFileSync(path, 'utf8'))
      if (proof.operationId !== id) throw new Error('Wrong proof')
      return { state: 'confirmed', externalId: proof.externalId }
    },
  },
  async confirmed(tx, intent) {
    await tx.auditLog.create({ data: { organizationId: intent.organizationId, actorId: intent.actorId, entityType: 'ProviderIntent', entityId: intent.id, action: 'test_domain_confirmed' } })
  },
  async failed() { throw new Error('Unexpected failure') },
}
const registry = new Map([[bindingKey('restart-test', 'payment'), binding]])
processProviderOutbox(registry).then(result => { console.info(JSON.stringify(result)) }).finally(() => prisma.$disconnect())
