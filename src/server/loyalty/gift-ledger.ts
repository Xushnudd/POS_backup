import {z} from 'zod';
import {decimal} from '../sales/calculations';
import {loyaltyPolicySchema,type LoyaltyPolicy} from './calculations';

const amount=z.string().regex(/^\d+(?:\.\d{1,2})?$/).max(30)
 .refine(value=>decimal(value).gt(0)&&decimal(value).lt('1000000000000'));
const entrySchema=z.object({id:z.string().uuid(),operationId:z.string().uuid(),kind:z.enum(['issue','redeem','restore','cash_refund']),
 amount,originalEntryId:z.string().uuid().nullable(),at:z.date()}).strict();
export type GiftEntry=z.infer<typeof entrySchema>;
export type GiftTerms={issuedAt:Date;expiresAt:Date|null;configuration:LoyaltyPolicy['gifts']};

/** Ordered immutable journal reconciliation. Issue is cash-in and liability,
 * not goods revenue. Redeem settles liability against the existing sale; it
 * creates neither a second sale nor a second cash receipt. Expiry only blocks
 * spending: it never silently writes off outstanding liability. Transaction,
 * source-sale/refund validation and unique keys remain the persistence layer's
 * responsibility. The rule engine deliberately cannot activate a provider. */
export function giftPosition(terms:GiftTerms,input:GiftEntry[]){
 const configuration=loyaltyPolicySchema.shape.gifts.parse(terms.configuration);
 const {issuedAt,expiresAt}=terms;
 if(!Number.isFinite(issuedAt.getTime())||(expiresAt!==null&&(!Number.isFinite(expiresAt.getTime())||expiresAt<=issuedAt)))throw Error('GIFT_VALIDITY_INVALID');
 const expectedExpiry=configuration.validityDays===null?null:issuedAt.getTime()+configuration.validityDays*86400000;
 if((expiresAt?.getTime()??null)!==expectedExpiry)throw Error('GIFT_VALIDITY_INVALID');
 if(input.length>10000)throw Error('GIFT_JOURNAL_TOO_LARGE');
 const entries=input.map(entry=>entrySchema.parse(entry));
 const ids=new Set<string>(),operations=new Set<string>(),redeemed=new Map<string,{amount:string;restored:string}>();
 let available=decimal(0),issued=decimal(0),spent=decimal(0),restored=decimal(0),refunded=decimal(0),previous=issuedAt;
 for(let index=0;index<entries.length;index++){
  const entry=entries[index],value=decimal(entry.amount);
  if(ids.has(entry.id)||operations.has(entry.operationId)||entry.at<previous||entry.at<issuedAt)throw Error('GIFT_JOURNAL_INVALID');
  ids.add(entry.id);operations.add(entry.operationId);previous=entry.at;
  if(entry.kind==='issue'){
   if(index!==0||entry.originalEntryId!==null||entry.at.getTime()!==issuedAt.getTime()||!configuration.enabled||
    value.lt(configuration.minIssueAmount)||value.gt(configuration.maxIssueAmount))throw Error('GIFT_ISSUE_INVALID');
   issued=value;available=value;
  }else{
   if(index===0||issued.isZero())throw Error('GIFT_ISSUE_REQUIRED');
   if(entry.kind==='redeem'){
    if(entry.originalEntryId!==null||(expiresAt!==null&&entry.at>=expiresAt))throw Error('GIFT_REDEMPTION_INVALID');
    if(value.gt(available))throw Error('GIFT_BALANCE_EXCEEDED');
    available=available.sub(value);spent=spent.add(value);redeemed.set(entry.id,{amount:entry.amount,restored:'0'});
   }else if(entry.kind==='restore'){
    const original=entry.originalEntryId?redeemed.get(entry.originalEntryId):undefined;
    if(!original||value.add(original.restored).gt(original.amount))throw Error('GIFT_RESTORE_EXCEEDED');
    original.restored=value.add(original.restored).toFixed(2);available=available.add(value);restored=restored.add(value);
   }else{
    if(entry.originalEntryId!==entries[0].id||!configuration.allowUnusedCashRefund)throw Error('GIFT_CASH_REFUND_DENIED');
    if(value.gt(available))throw Error('GIFT_BALANCE_EXCEEDED');
    available=available.sub(value);refunded=refunded.add(value);
   }
  }
 }
 return {issued:issued.toFixed(2),redeemed:spent.toFixed(2),restored:restored.toFixed(2),cashRefunded:refunded.toFixed(2),
  liability:available.toFixed(2),netCash:issued.sub(refunded).toFixed(2),goodsRevenue:'0.00'};
}

/** Historical restoration retains the original expiry and liability. Current
 * enabled state can suspend spending, without rewriting the issuance terms. */
export function giftSpendable(terms:GiftTerms,entries:GiftEntry[],at:Date,currentlyEnabled:boolean){
 z.boolean().parse(currentlyEnabled);
 if(!Number.isFinite(at.getTime())||at<terms.issuedAt)throw Error('GIFT_VALIDITY_INVALID');
 if(entries.some(entry=>entry.at>at))throw Error('GIFT_JOURNAL_FUTURE');
 const position=giftPosition(terms,entries);
 return {...position,spendable:currentlyEnabled&&(terms.expiresAt===null||at<terms.expiresAt)?position.liability:'0.00'};
}
