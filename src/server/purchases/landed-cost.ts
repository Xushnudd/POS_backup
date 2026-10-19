import { z } from 'zod'
import { decimal } from '../sales/calculations'

const ZERO = BigInt(0)
const HUNDRED = BigInt(100)

// All measures are receipt snapshots in base units. Weight is kg per base unit,
// not a live catalogue property; mixed units require the value/weight method.
const measure = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/)
export const positiveLandedCostMeasure = measure.refine(value => {
  try { return decimal(value).gt(0) } catch { return false }
}, 'Musbat qiymat kerak')
export const landedCostSchema = z.object({
  amount: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/),
  method: z.enum(['value', 'quantity', 'weight']),
  lines: z.array(z.object({
    id: z.string().uuid(),
    quantity: positiveLandedCostMeasure,
    unitCost: measure,
    unit: z.string().trim().min(1).max(32),
    unitWeightKg: positiveLandedCostMeasure.optional(),
  }).strict()).min(1).max(200),
}).strict().superRefine((input, ctx) => {
  if (new Set(input.lines.map(line => line.id)).size !== input.lines.length)
    ctx.addIssue({ code: 'custom', message: 'Takror kirim qatori mumkin emas', path: ['lines'] })
  if (input.method === 'quantity' && new Set(input.lines.map(line => line.unit)).size !== 1)
    ctx.addIssue({ code: 'custom', message: 'Miqdor usuli uchun bazaviy birliklar bir xil bo‘lishi kerak', path: ['method'] })
  if (input.method === 'weight' && input.lines.some(line => line.unitWeightKg === undefined))
    ctx.addIssue({ code: 'custom', message: 'Har bir qatorning kg/baza birligi snapshoti kerak', path: ['lines'] })
})

function scaled(value: string, places: number): bigint {
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole + fraction.padEnd(places, '0'))
}
function centsText(value: bigint): string {
  return `${value / HUNDRED}.${(value % HUNDRED).toString().padStart(2, '0')}`
}

/** Pure preview: no inventory/cash/debt changes and no historical cost edits.
 * Allocated amount, rather than rounded unit cost, is the accounting source.
 * Zero-weight rows receive zero; the final positive row absorbs cent residuals.
 */
export function allocateLandedCost(input: z.input<typeof landedCostSchema>) {
  const parsed = landedCostSchema.parse(input)
  const cents = scaled(parsed.amount, 2)
  const rows = [...parsed.lines].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    .map(line => ({
      ...line,
      weight: parsed.method === 'quantity' ? scaled(line.quantity, 6)
        : scaled(line.quantity, 6) * scaled(parsed.method === 'value' ? line.unitCost : line.unitWeightKg!, 6),
    }))
  const denominator = rows.reduce((sum, row) => sum + row.weight, ZERO)
  if (denominator === ZERO) throw new Error('LANDED_COST_ZERO_DENOMINATOR')
  const last = rows.findLastIndex(row => row.weight > ZERO)
  let assigned = ZERO
  const lines = rows.map((row, index) => {
    const share = index === last ? cents - assigned : cents * row.weight / denominator
    assigned += share
    const amount = centsText(share)
    const additionalUnitCost = decimal(amount).div(row.quantity).toDecimalPlaces(6)
    return {
      id: row.id, quantity: row.quantity, unitCost: row.unitCost, unit: row.unit,
      ...(row.unitWeightKg !== undefined ? { unitWeightKg: row.unitWeightKg } : {}),
      allocationBasis: parsed.method === 'quantity' ? decimal(row.quantity).toFixed()
        : decimal(row.quantity).mul(parsed.method === 'value' ? row.unitCost : row.unitWeightKg!).toFixed(),
      allocatedAmount: amount,
      landedUnitCost: decimal(row.unitCost).add(additionalUnitCost).toFixed(6),
      // Must become a separate value entry on posting, never disappear in rounding.
      roundingResidual: decimal(amount).sub(additionalUnitCost.mul(row.quantity)).toFixed(),
    }
  })
  return { method: parsed.method, amount: centsText(cents), lines }
}
