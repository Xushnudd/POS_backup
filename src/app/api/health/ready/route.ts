import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    // Verify both DB connectivity and the core migration contract.
    await prisma.$queryRaw`SELECT 1 FROM "Operation" LIMIT 0`
    await prisma.$queryRaw`SELECT "actorId" FROM "Operation" LIMIT 0`
    return Response.json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
