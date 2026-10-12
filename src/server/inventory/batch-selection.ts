import { z } from 'zod';
import { decimal } from '../sales/calculations';
import { AccessError } from '../auth/policy';

export const batchDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Partiya sanasi haqiqiy kalendar kuni bo‘lishi kerak');
const quantity = z.string().regex(/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/);
const positiveQuantity = quantity.refine(value => decimal(value).gt(0), 'Musbat miqdor kerak');
const selectionSchema = z.object({
  quantity: positiveQuantity,
  today: batchDate,
  expiryRequired: z.boolean().default(true),
  batches: z.array(z.object({
    id: z.string().uuid(),
    expiresOn: batchDate.nullable(),
    receivedOn: batchDate,
    availableQuantity: quantity,
  }).strict()).max(10_000),
}).strict().superRefine((input, context) => {
  if (new Set(input.batches.map(batch => batch.id)).size !== input.batches.length)
    context.addIssue({ code: 'custom', path: ['batches'], message: 'Takror partiya mumkin emas' });
});

/** Pure allocation only. The caller must load authoritative available quantities,
 * exclude reservations/quarantine, lock rows and post the plan in one transaction.
 * An expiry date is the last valid business day, including that entire day.
 */
export function selectFefo(input: z.input<typeof selectionSchema>) {
  const parsed = selectionSchema.parse(input);
  const eligible = parsed.batches.filter(batch =>
    decimal(batch.availableQuantity).gt(0) && batch.receivedOn <= parsed.today &&
    (batch.expiresOn === null ? !parsed.expiryRequired : batch.expiresOn >= parsed.today),
  ).sort((a, b) => {
    const expiry = a.expiresOn === null ? (b.expiresOn === null ? 0 : 1) : b.expiresOn === null ? -1 : a.expiresOn.localeCompare(b.expiresOn);
    return expiry || a.receivedOn.localeCompare(b.receivedOn) || a.id.localeCompare(b.id);
  });
  let remaining = decimal(parsed.quantity);
  const allocations: { batchId: string; quantity: string }[] = [];
  for (const batch of eligible) {
    if (remaining.eq(0)) break;
    const take = decimal(batch.availableQuantity).lt(remaining) ? decimal(batch.availableQuantity) : remaining;
    allocations.push({ batchId: batch.id, quantity: take.toFixed(6) });
    remaining = remaining.sub(take);
  }
  if (remaining.gt(0)) throw new AccessError(409, 'INSUFFICIENT_VALID_BATCH_STOCK', 'Yaroqli partiyalarda yetarli erkin qoldiq yo‘q');
  return { quantity: decimal(parsed.quantity).toFixed(6), allocations };
}

export function inventoryBusinessDate(now: Date, timeZone: string) {
  if (!Number.isFinite(now.getTime()) || !timeZone.trim()) throw new Error('INVALID_BATCH_CLOCK');
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (kind: string) => parts.find(value => value.type === kind)!.value;
  return batchDate.parse(`${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`);
}

export function batchExpiryState(expiresOn: string | null, today: string, alertDays: number) {
  const day = batchDate.parse(today);
  const interval = z.number().int().min(0).max(3650).parse(alertDays);
  if (expiresOn === null) return 'unknown' as const;
  const expiry = batchDate.parse(expiresOn);
  if (expiry < day) return 'expired' as const;
  const cutoff = new Date(day + 'T00:00:00.000Z');
  cutoff.setUTCDate(cutoff.getUTCDate() + interval);
  const lastDay = cutoff.getUTCFullYear() > 9999 ? '9999-12-31' : cutoff.toISOString().slice(0, 10);
  return expiry <= lastDay ? 'due_soon' as const : 'valid' as const;
}
