import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    // Verify both DB connectivity and the core migration contract.
    await prisma.$queryRaw`SELECT 1 FROM "Operation" LIMIT 0`
    await prisma.$queryRaw`SELECT "actorId" FROM "Operation" LIMIT 0`
    const migrated=await prisma.$queryRaw<{ok:number}[]>`SELECT 1 AS ok FROM "_prisma_migrations" WHERE migration_name='202610050012_transfer_returns' AND finished_at IS NOT NULL AND rolled_back_at IS NULL LIMIT 1`
    if (!migrated.length) throw new Error('Migration incomplete')
    return Response.json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
