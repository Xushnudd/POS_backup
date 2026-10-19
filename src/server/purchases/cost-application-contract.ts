import {z} from 'zod'
export const costValue=z.string().regex(/^-?(?:0|[1-9]\d{0,39})(?:\.\d{1,12})?$/)
const cost=z.string().regex(/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/)
const sequence=z.string().regex(/^(?:0|[1-9]\d{0,18})$/)
export const applicationProductSchema=z.object({
 productId:z.string().uuid(),stockDocumentItemId:z.string().uuid(),receiptEventId:z.string().uuid(),
 lastSequence:sequence,afterSequence:sequence,costChangeEventId:z.string().uuid().nullable(),
 allocatedAmount:costValue,beforeAverageCost:cost,afterAverageCost:cost,
 inventoryCorrection:costValue,cogsCorrection:costValue,varianceCorrection:costValue,roundingCorrection:costValue,
 issueCosts:z.array(z.object({itemId:z.string().uuid(),unitCost:cost})).max(10000),
 transferCosts:z.array(z.object({itemId:z.string().uuid(),unitCost:cost})).max(10000),
 cogsEntries:z.array(z.object({itemId:z.string().uuid(),sourceId:z.string().uuid(),sourceType:z.enum(['sale','return','nonstock_return']),storeId:z.string().uuid(),amount:costValue})).max(10000),
 storeCorrections:z.array(z.object({storeId:z.string().uuid(),quantity:cost,amount:costValue})).max(10000),
 transitCorrection:costValue,
})
export const applicationSnapshotSchema=z.object({version:z.literal(1),products:z.array(applicationProductSchema).min(1).max(200)})
export type ApplicationProduct=z.infer<typeof applicationProductSchema>
