import { Prisma } from '@prisma/client'
import type { TokenPayload } from '@/lib/auth'
import { AccessError } from '../auth/policy'
import { readProductValuationHistory } from './valuation-history'
import { replayMovingAverage, type CostReplayEvent } from './cost-replay'

function invalid(): never {
  throw new AccessError(409, 'COST_SOURCE_RECONCILIATION_REQUIRED', 'Original hujjat va tannarx jurnali mos emas; avtomatik tuzatish rad etildi')
}
function unsupported(): never {
  throw new AccessError(409, 'COST_SOURCE_UNSUPPORTED', 'Bu tarixdagi harakat uchun alohida valuation adapteri kerak')
}
const equal = (a: string | Prisma.Decimal | null, b: string | Prisma.Decimal | null) =>
  a !== null && b !== null && new Prisma.Decimal(a).eq(b)

/** Convert committed native order to economic events by validating the original
 * documents. Cost-change rows are checked consequences of receipts/returns,
 * never independent fabricated receipts. Unsupported sources fail closed.
 * The caller must retain one consistent transaction through preview/posting.
 */
export async function readReplayableProductHistory(tx: Prisma.TransactionClient, context: TokenPayload, productId: string) {
  const history = await readProductValuationHistory(tx, context, productId)
  if (history.events.length > 10_000) throw new AccessError(413, 'COST_HISTORY_TOO_LARGE', 'Bu tarix uchun background reconciliation kerak')
  const movements = history.events.filter(row => row.kind === 'movement')
  const ids = (sourceType: string) => [...new Set(movements.filter(row => row.sourceType === sourceType).map(row => row.sourceId!).filter(Boolean))]
  // All source reads are scoped independently; a native sourceId is not authority.
  const documents = await tx.stockDocument.findMany({ where: { id: { in: ids('stock_document') }, organizationId: context.organizationId },
    include: { items: { where: { productId } } } })
  const sales = await tx.sale.findMany({ where: { id: { in: ids('sale') }, organizationId: context.organizationId },
    include: { items: { where: { productId } } } })
  const returns = await tx.saleReturn.findMany({ where: { id: { in: ids('return') }, sale: { organizationId: context.organizationId } },
    include: { sale: true, items: { where: { productId }, include: { saleItem: true } } } })
  const documentById = new Map(documents.map(row => [row.id, row]))
  const saleById = new Map(sales.map(row => [row.id, row]))
  const returnById = new Map(returns.map(row => [row.id, row]))
  const events: CostReplayEvent[] = []
  const links: { eventId: string; sourceType: string; sourceId: string; itemId: string; storeId: string }[] = []
  const issued = new Map<string, string>()
  const expectedAverages: string[] = []
  let catalogueCost = history.boundary.baselineUnitCost!
  let pendingCost: (typeof history.events)[number] | undefined
  for (const row of history.events) {
    if (row.kind === 'cost_change') {
      if (pendingCost || !equal(row.beforeUnitCost, catalogueCost) || row.afterUnitCost === null) invalid()
      pendingCost = row
      continue
    }
    if (row.kind !== 'movement' || !row.movementId || !row.storeId || !row.sourceId || row.quantityDelta === null || row.unitCost === null) invalid()
    const delta = new Prisma.Decimal(row.quantityDelta)
    let event: CostReplayEvent
    let itemId: string
    if (row.sourceType === 'stock_document') {
      const document = documentById.get(row.sourceId)
      if (!document || document.storeId !== row.storeId || document.items.length !== 1) invalid()
      if (!['purchase', 'opening'].includes(document.documentType) || document.reversalOfId) unsupported()
      if (document.status !== 'confirmed') invalid()
      const item = document.items[0]
      if (!delta.gt(0) || !equal(delta, item.quantity) || !equal(row.unitCost, item.unitCost)) invalid()
      itemId = item.id
      event = { id: row.movementId, sequence: row.sequence, kind: 'receipt', quantity: delta.toFixed(), unitCost: row.unitCost }
    } else if (row.sourceType === 'sale') {
      const sale = saleById.get(row.sourceId)
      if (!sale || sale.storeId !== row.storeId || sale.items.length !== 1 || !['completed', 'partially_returned', 'returned'].includes(sale.status)) invalid()
      const item = sale.items[0]
      if (!delta.lt(0) || !equal(delta.negated(), item.quantity) || !equal(row.unitCost, item.unitCost) || !equal(row.unitCost, catalogueCost) || pendingCost) invalid()
      itemId = item.id
      if (issued.has(item.id)) invalid()
      issued.set(item.id, row.movementId)
      event = { id: row.movementId, sequence: row.sequence, kind: 'issue', quantity: delta.negated().toFixed() }
    } else if (row.sourceType === 'return') {
      const returned = returnById.get(row.sourceId)
      if (!returned || returned.sale.storeId !== row.storeId || returned.status !== 'completed' || returned.items.length !== 1) invalid()
      const item = returned.items[0], issueId = issued.get(item.saleItemId)
      if (!issueId || item.disposition !== 'sellable' || item.saleItem.saleId !== returned.saleId || !delta.gt(0) || !equal(delta, item.quantity) || !equal(row.unitCost, item.saleItem.unitCost)) invalid()
      itemId = item.id
      event = { id: row.movementId, sequence: row.sequence, kind: 'return', quantity: delta.toFixed(), issueId }
    } else unsupported()
    // A cost update may only be consumed by the next receipt/return in exactly
    // the same committed transaction. Manual catalogue overrides need a journal.
    if (pendingCost && (event.kind === 'issue' || pendingCost.transactionId !== row.transactionId)) invalid()
    events.push(event)
    links.push({ eventId: event.id, sourceType: row.sourceType!, sourceId: row.sourceId, itemId, storeId: row.storeId })
    catalogueCost = pendingCost?.afterUnitCost ?? catalogueCost
    expectedAverages.push(catalogueCost!)
    pendingCost = undefined
  }
  if (pendingCost || !equal(catalogueCost, history.averageCost)) invalid()
  const replay = replayMovingAverage(events)
  if (replay.rows.some((row, index) => !equal(row.averageCost, expectedAverages[index]))) invalid()
  const balances = await tx.inventoryBalance.aggregate({ where: { productId, store: { organizationId: context.organizationId } }, _sum: { quantity: true } })
  if (!equal(replay.quantity, balances._sum.quantity ?? new Prisma.Decimal(0))) invalid()
  return { productId, lastSequence: history.boundary.lastSequence, events, links, replay }
}
