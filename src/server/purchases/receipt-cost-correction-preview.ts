import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError } from '../auth/policy'
import { assertLiveContext } from '../operations'
import {Prisma} from '@prisma/client'
import {planValuationFactCorrection} from '../inventory/valuation-replay'
import {readProductValuationFacts} from '../inventory/valuation-facts'
import { landedCostPreviewSchema, receiptLandedCostTx } from './landed-cost-preview'

export const receiptCostCorrectionPreviewSchema = landedCostPreviewSchema.refine(input =>
  /[1-9]/.test(input.amount), { path: ['amount'], message: 'Musbat xarajat kerak' })

/** Read-only, authoritative historical replay. The original receipt, sale and
 * return snapshots remain untouched. A successful preview is not a posting. */
export async function previewReceiptCostCorrection(context: TokenPayload, stockDocumentId: string,
  input: z.input<typeof receiptCostCorrectionPreviewSchema>) {
  if (context.role !== 'owner') throw new AccessError(403, 'OWNER_REQUIRED')
  const parsed = receiptCostCorrectionPreviewSchema.parse(input)
  return prisma.$transaction(async tx => {
    await assertLiveContext(tx, context)
    const allocation = await receiptLandedCostTx(tx, context, stockDocumentId, parsed)
    const items = await tx.stockDocumentItem.findMany({ where: { stockDocumentId,
      stockDocument: { organizationId: context.organizationId } }, orderBy: { id: 'asc' } })
    if (items.length > 20) throw new AccessError(413, 'COST_HISTORY_TOO_LARGE', 'Katta taqsimot uchun background reconciliation kerak')
    const products = []
    let eventCount = 0
    for (const item of items) {
      const line = allocation.lines.find(row => row.id === item.id)
      if (!line) throw new AccessError(409, 'COST_SOURCE_RECONCILIATION_REQUIRED')
      const history = await readProductValuationFacts(tx, context, item.productId)
      eventCount += history.facts.length
      if (eventCount > 10_000) throw new AccessError(413, 'COST_HISTORY_TOO_LARGE', 'Katta tarix uchun background reconciliation kerak')
      const original = history.links.find(row => row.sourceType === 'stock_document' && row.sourceId === stockDocumentId && row.itemId === item.id)
      if (!original) throw new AccessError(409, 'COST_SOURCE_RECONCILIATION_REQUIRED')
      if (line.allocatedAmount === '0.00') {
        products.push({ productId: item.productId, stockDocumentItemId: item.id, lastSequence: history.lastSequence,
          allocatedAmount: line.allocatedAmount, quantity: history.replay.physicalQuantity,
          beforeAverageCost: history.replay.averageCost, afterAverageCost: history.replay.averageCost,
          inventoryCorrection: '0', cogsCorrection: '0', roundingCorrection: '0', varianceCorrection:'0', cogsEntries: [] })
        continue
      }
      const correction=planValuationFactCorrection(history.facts,history.baselineUnitCost,original.eventId,line.allocatedAmount,history.dispositions)
      const Exact=Prisma.Decimal.clone({precision:60}),difference=(before:string,after:string)=>new Exact(after).sub(before)
      const rawEntries=[...correction.after.rows.flatMap((row,index)=>{
        if(!['sale','return'].includes(row.kind))return []
        const amount=difference(correction.before.rows[index].entryValue,row.entryValue).mul(row.kind==='return'?-1:1)
        return amount.eq(0)?[]:[{eventId:row.id,sequence:row.sequence,kind:row.kind==='sale'?'issue':'return',amount:amount.toFixed()}]
      }),...correction.after.dispositionRows.flatMap((row,index)=>{
        if(row.kind!=='nonstock_return')return []
        const amount=difference(correction.before.dispositionRows[index].entryValue,row.entryValue).negated()
        return amount.eq(0)?[]:[{eventId:row.id,sequence:null,kind:row.kind,amount:amount.toFixed()}]
      })]
      if(!rawEntries.reduce((sum,row)=>sum.add(row.amount),new Exact(0)).eq(correction.cogsCorrection))throw new AccessError(409,'COST_SOURCE_RECONCILIATION_REQUIRED')
      products.push({productId:item.productId,stockDocumentItemId:item.id,lastSequence:history.lastSequence,allocatedAmount:line.allocatedAmount,
        quantity:correction.after.physicalQuantity,beforeAverageCost:correction.before.averageCost,afterAverageCost:correction.after.averageCost,
        inventoryCorrection:correction.inventoryCorrection,cogsCorrection:correction.cogsCorrection,roundingCorrection:correction.roundingCorrection,
        varianceCorrection:correction.varianceCorrection,beforeTransitValue:correction.before.transitValue,afterTransitValue:correction.after.transitValue,
        cogsEntries:rawEntries.map(entry=>{const source=history.links.find(row=>row.eventId===entry.eventId);if(!source)throw new AccessError(409,'COST_SOURCE_RECONCILIATION_REQUIRED');return {...entry,sourceType:source.sourceType,sourceId:source.sourceId,itemId:source.itemId,storeId:source.storeId}})})
    }
    return { stockDocumentId, storeId: allocation.storeId, amount: allocation.amount, method: allocation.method,
      previewOnly: true as const, financialPosting: false as const, products }
  }, { isolationLevel: 'RepeatableRead', timeout: 30_000 })
}
