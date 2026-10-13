import {exactPoints} from './calculations';
export type PointLot={id:string;remaining:string;createdAt:Date;expiresAt:Date|null};
type BalanceLot=PointLot&{balance:bigint};
const ZERO=BigInt(0);
function rows(input:PointLot[]){
 if(input.length>10000||new Set(input.map(row=>row.id)).size!==input.length)throw Error('POINT_LOT_RECONCILIATION');
 return input.map(row=>{
  if(!row.id||!Number.isFinite(row.createdAt.getTime())||(row.expiresAt!==null&&!Number.isFinite(row.expiresAt.getTime()))||!/^-?\d+$/.test(row.remaining))throw Error('POINT_LOT_RECONCILIATION');
  const value=BigInt(row.remaining);exactPoints((value<ZERO?-value:value).toString());return {...row,balance:value};
 }).sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime()||(a.id<b.id?-1:a.id>b.id?1:0));
}
function active(row:BalanceLot,at:Date){return row.expiresAt===null||row.expiresAt>at;}
/** This is only a deterministic plan. A caller must lock the actual wallet and
 * persist every settlement/allocation atomically with its original operation.
 * Returned recovery transfers clear old debt now, rather than reserving a
 * positive lot whose later expiry would incorrectly charge the same debt again. */
export function planPointSpend(input:PointLot[],requested:string,at:Date){
 if(!Number.isFinite(at.getTime()))throw Error('INVALID_POINT_CUTOFF');
 const lots=rows(input),settlements:{fromLotId:string;toLotId:string;points:string}[]=[];
 const credits=lots.filter(row=>row.balance>ZERO&&active(row,at)),debts=lots.filter(row=>row.balance<ZERO);
 let creditIndex=0;
 for(const debt of debts)while(debt.balance<ZERO&&creditIndex<credits.length){
  const credit=credits[creditIndex];if(credit.balance<=ZERO){creditIndex++;continue;}
  const amount=credit.balance<-debt.balance?credit.balance:-debt.balance;
  credit.balance-=amount;debt.balance+=amount;settlements.push({fromLotId:credit.id,toLotId:debt.id,points:amount.toString()});
 }
 const available=credits.reduce((sum,row)=>sum+row.balance,ZERO),recoveryDebt=debts.reduce((sum,row)=>sum-row.balance,ZERO);
 let remaining=exactPoints(requested);if(remaining>available)throw Error('POINTS_BALANCE_EXCEEDED');
 const allocations:{lotId:string;points:string}[]=[];
 for(const lot of credits){if(remaining===ZERO)break;const amount=lot.balance<remaining?lot.balance:remaining;if(amount>ZERO){allocations.push({lotId:lot.id,points:amount.toString()});remaining-=amount;}}
 return {settlements,allocations,available:available.toString(),recoveryDebt:recoveryDebt.toString()};
}
