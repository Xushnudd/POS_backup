import {Prisma} from '@prisma/client'
import {AccessError} from '../auth/policy'
import {replayValuationFacts,type ValuationFact,type ValuationDispositions} from '../inventory/valuation-replay'
import type {readProductValuationFacts} from '../inventory/valuation-facts'
import {applicationProductSchema} from './cost-application-contract'
const Exact=Prisma.Decimal.clone({precision:60,rounding:Prisma.Decimal.ROUND_HALF_UP})
type History=Awaited<ReturnType<typeof readProductValuationFacts>>
type Previous={planId:string;varianceCorrection:Prisma.Decimal;roundingCorrection:Prisma.Decimal;cogsEntries:Prisma.JsonValue}
function reject():never{throw new AccessError(409,'COST_SOURCE_RECONCILIATION_REQUIRED')}
/** Marginal contributions follow immutable application ordinal, never dates.
 * Actual write-off costs already recognized in profit are deducted so a later
 * continuation cannot expense the same capitalised freight a second time. */
export function calculateCostContinuations(history:History,previous:readonly Previous[]){
 const originals=history.applications.filter(row=>row.application.reversalOfId===null)
 if(history.facts.length*(originals.length+1)*(history.writeOffs.length+1)>500000)throw new AccessError(413,'COST_HISTORY_TOO_LARGE')
 const base:ValuationFact[]=history.financialFacts.map(fact=>{const clean={...fact};if(clean.kind==='receipt')delete clean.additionalValue;return clean})
 const dispositions:ValuationDispositions=history.financialDispositions
 const planOrder=originals.map(row=>row.application.planId)
 const withCharges=(applications:History['applications'])=>{
  const amounts=new Map<string,Prisma.Decimal>()
  for(const row of applications)amounts.set(row.application.planId,(amounts.get(row.application.planId)??new Exact(0)).add(row.product.allocatedAmount))
  let facts=base.map(row=>({...row})),before=replayValuationFacts(facts,history.baselineUnitCost,dispositions)
  const effects=new Map<string,{before:typeof before;after:typeof before}>()
  for(const original of originals){
   const amount=amounts.get(original.application.planId)??new Exact(0)
   if(amount.lt(0))reject()
   if(amount.gt(0))facts=facts.map(fact=>fact.kind==='receipt'&&fact.id===original.product.receiptEventId?{...fact,additionalValue:new Exact(fact.additionalValue??0).add(amount).toFixed(2)}:fact)
   const after=amount.eq(0)?before:replayValuationFacts(facts,history.baselineUnitCost,dispositions)
   effects.set(original.application.planId,{before,after});before=after
  }
  return {effects,after:before}
 }
 const desired=withCharges(history.applications)
 for(const field of ['averageCost','inventoryValue','cogsValue','varianceValue','roundingValue'] as const)if(!new Exact(desired.after[field]).eq(history.financialReplay[field]))reject()
 const writtenOff=new Map<string,Prisma.Decimal>()
 for(const writeOff of history.writeOffs){
  const link=history.links.find(row=>row.itemId===writeOff.saleItemId&&row.sourceType==='sale');if(!link)reject()
  const issue=history.facts.find(row=>row.id===link.eventId);if(!issue||issue.kind!=='sale')reject()
  const selected=writeOff.applicationId?history.applications.find(row=>row.application.id===writeOff.applicationId):null
  if(writeOff.applicationId&&!selected)reject()
  const recognized=withCharges(history.applications.filter(row=>selected?row.application.ordinal<=selected.application.ordinal:BigInt(row.product.afterSequence)<BigInt(issue.sequence)))
  const effective=recognized.after.rows.find(row=>row.id===issue.id)
  if(!effective||!new Exact(effective.averageCost).eq(writeOff.unitCost))reject()
  for(const planId of planOrder){const effect=recognized.effects.get(planId)!;const before=effect.before.rows.find(row=>row.id===issue.id),after=effect.after.rows.find(row=>row.id===issue.id);if(!before||!after)reject();writtenOff.set(planId,(writtenOff.get(planId)??new Exact(0)).add(new Exact(after.averageCost).sub(before.averageCost).mul(writeOff.quantity)))}
 }
 const booked=new Map<string,Prisma.Decimal>()
 for(const row of history.applications)for(const entry of row.product.cogsEntries)booked.set(entry.itemId,(booked.get(entry.itemId)??new Exact(0)).add(entry.amount))
 for(const row of previous)for(const entry of applicationProductSchema.shape.cogsEntries.parse(row.cogsEntries))booked.set(entry.itemId,(booked.get(entry.itemId)??new Exact(0)).add(entry.amount))
 const cogsEntries:Prisma.InputJsonObject[]=[]
 const compare=(id:string,kind:string,expected:string,recorded:string)=>{
  const link=history.links.find(row=>row.eventId===id);if(!link?.storeId)reject()
  const amount=new Exact(expected).sub(recorded).mul(kind==='sale'?1:-1).sub(booked.get(link.itemId)??0)
  if(amount.eq(0))return
  if(!['sale','return','nonstock_return'].includes(link.sourceType))reject()
  cogsEntries.push({itemId:link.itemId,sourceId:link.sourceId,sourceType:link.sourceType,storeId:link.storeId,amount:amount.toFixed()})
 }
 for(const row of desired.after.rows)if(row.kind==='sale'||row.kind==='return'){const raw=history.replay.rows.find(raw=>raw.id===row.id);if(!raw)reject();compare(row.id,row.kind,row.entryValue,raw.entryValue)}
 for(const row of desired.after.dispositionRows)if(row.kind==='nonstock_return'){const raw=history.replay.dispositionRows.find(raw=>raw.id===row.id);if(!raw)reject();compare(row.id,row.kind,row.entryValue,raw.entryValue)}
 return originals.map((row,index)=>{
  const planId=row.application.planId,effect=desired.effects.get(planId)!
  const sum=(field:'varianceCorrection'|'roundingCorrection')=>history.applications.filter(row=>row.application.planId===planId).reduce((sum,row)=>sum.add(row.product[field]),new Exact(0)).add(previous.filter(row=>row.planId===planId).reduce((sum,row)=>sum.add(row[field].toString()),new Exact(0)))
  const variance=new Exact(effect.after.varianceValue).sub(effect.before.varianceValue).sub(writtenOff.get(planId)??0).sub(sum('varianceCorrection'))
  const rounding=new Exact(effect.after.roundingValue).sub(effect.before.roundingValue).sub(sum('roundingCorrection'))
  return {planId,storeId:row.application.storeId,varianceCorrection:variance.toFixed(),roundingCorrection:rounding.toFixed(),cogsEntries:index===0?cogsEntries:[],snapshot:{version:1,applicationId:row.application.id,lastSequence:history.lastSequence,currentAverageCost:history.replay.averageCost,financialAverageCost:history.financialReplay.averageCost,ownedValue:history.financialReplay.inventoryValue,cogsValue:history.financialReplay.cogsValue,recognizedWriteOffFreight:(writtenOff.get(planId)??new Exact(0)).toFixed(),desiredVariance:new Exact(effect.after.varianceValue).sub(effect.before.varianceValue).toFixed(),desiredRounding:new Exact(effect.after.roundingValue).sub(effect.before.roundingValue).toFixed()}}
 }).filter(row=>!new Exact(row.varianceCorrection).eq(0)||!new Exact(row.roundingCorrection).eq(0)||row.cogsEntries.length>0)
}
