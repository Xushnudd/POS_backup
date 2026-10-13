import {Prisma} from '@prisma/client';
import {z} from 'zod';

// Financial rule arithmetic must retain integer points and exact decimal UZS,
// including values beyond JavaScript's safe integer range.
const Exact=Prisma.Decimal.clone({precision:50});
const ZERO=BigInt(0),MAX_POINTS=BigInt('9223372036854775807');
const moneyText=z.string().regex(/^\d+(?:\.\d{1,2})?$/).max(30).refine(value=>new Exact(value).lt('1000000000000'));
const positiveMoney=moneyText.refine(value=>new Exact(value).gt(0));
const percentText=moneyText.refine(value=>new Exact(value).lte(100));
const validityDays=z.number().int().min(1).max(36500).nullable();
export const loyaltyPolicySchema=z.object({
  points:z.object({enabled:z.boolean(),earnMoneyPerPoint:positiveMoney,redeemMoneyPerPoint:positiveMoney,maxRedeemPercent:percentText,
    minEligibleNet:moneyText,expiryDays:validityDays,earnOnDiscountedSales:z.boolean(),earnOnCreditSales:z.boolean()}).strict(),
  cards:z.object({enabled:z.boolean(),discountPercent:percentText,validityDays}).strict(),
  promos:z.object({enabled:z.boolean(),allowStackingWithCard:z.boolean(),allowStackingWithPoints:z.boolean()}).strict(),
  gifts:z.object({enabled:z.boolean(),minIssueAmount:moneyText,maxIssueAmount:moneyText,validityDays,allowUnusedCashRefund:z.boolean()}).strict()
    .refine(value=>new Exact(value.maxIssueAmount).gte(value.minIssueAmount)&&(!value.enabled||new Exact(value.minIssueAmount).gt(0)),'Active gift amount range must be positive and ordered'),
}).strict();
export type LoyaltyPolicy=z.infer<typeof loyaltyPolicySchema>;
export const promotionRuleSchema=z.object({
  enabled:z.boolean(),kind:z.enum(['percent','fixed']),value:positiveMoney,minEligibleNet:moneyText,maxDiscount:positiveMoney,
  maxUses:z.number().int().min(1).max(100000000),maxUsesPerCustomer:z.number().int().min(1).max(100000),
  storeIds:z.array(z.string().uuid()).max(100),productIds:z.array(z.string().uuid()).max(500),
  startsAt:z.iso.datetime({offset:true}),endsAt:z.iso.datetime({offset:true}),
}).strict().refine(value=>new Date(value.endsAt)>new Date(value.startsAt),'Promotion interval must be ordered')
 .refine(value=>value.kind!=='percent'||new Exact(value.value).lte(100),'Percentage cannot exceed100')
 .refine(value=>new Set(value.storeIds).size===value.storeIds.length&&new Set(value.productIds).size===value.productIds.length,'Scopes must be unique');

export function exactPoints(input:string|bigint){
  const value=String(input);if(!/^\d+$/.test(value))throw Error('INVALID_POINTS');
  const result=BigInt(value);if(result>MAX_POINTS)throw Error('POINTS_TOO_LARGE');return result;
}
function exactMoney(input:string){const value=moneyText.parse(input);return new Exact(value);}
export function earnedPoints(eligibleNet:string,config:LoyaltyPolicy['points'],discounted=false,hasCredit=false){
  const policy=loyaltyPolicySchema.shape.points.parse(config),net=exactMoney(eligibleNet);
  if(!policy.enabled||net.lt(policy.minEligibleNet)||(discounted&&!policy.earnOnDiscountedSales)||(hasCredit&&!policy.earnOnCreditSales))return ZERO;
  return exactPoints(net.div(policy.earnMoneyPerPoint).toDecimalPlaces(0,Prisma.Decimal.ROUND_DOWN).toFixed(0));
}
export function pointsDiscount(requested:string|bigint,available:string|bigint,eligibleNet:string,config:LoyaltyPolicy['points']){
  const policy=loyaltyPolicySchema.shape.points.parse(config),points=exactPoints(requested),balance=exactPoints(available),base=exactMoney(eligibleNet);
  if(!policy.enabled)throw Error('LOYALTY_DISABLED');if(points>balance)throw Error('POINTS_BALANCE_EXCEEDED');
  const amount=new Exact(points.toString()).mul(policy.redeemMoneyPerPoint);
  // Monetary cap floors to cents: rounding up must not exceed the owner's cap.
  const cap=base.mul(policy.maxRedeemPercent).div(100).toDecimalPlaces(2,Prisma.Decimal.ROUND_DOWN);
  if(amount.gt(cap)||amount.gt(base))throw Error('POINTS_DISCOUNT_LIMIT');return amount.toFixed(2);
}
/** Original-proportional cumulative ceiling prevents many tiny refunds from
 * retaining an extra earned point. Only the cumulative target is rounded;
 * final refund reverses exactly the original grant, independent of splitting. */
export function cumulativePointReversal(original:string|bigint,originalPayable:string,returnedBefore:string,returnedNow:string,reversedBefore:string|bigint){
  const grant=exactPoints(original),before=exactPoints(reversedBefore),base=exactMoney(originalPayable),paidBefore=exactMoney(returnedBefore),increment=exactMoney(returnedNow),cumulative=paidBefore.add(increment);
  if(before>grant||cumulative.gt(base))throw Error('POINTS_REFUND_RECONCILIATION');
  if(base.isZero()){if(grant!==ZERO)throw Error('POINTS_REFUND_RECONCILIATION');return ZERO;}
  const target=exactPoints(new Exact(grant.toString()).mul(cumulative).div(base).toDecimalPlaces(0,Prisma.Decimal.ROUND_UP).toFixed(0));
  if(target<before)throw Error('POINTS_REFUND_RECONCILIATION');return target-before;
}
export function promotionDiscount(eligibleNet:string,rule:z.infer<typeof promotionRuleSchema>,at:Date){
  const config=promotionRuleSchema.parse(rule),base=exactMoney(eligibleNet);
  if(!config.enabled||at<new Date(config.startsAt)||at>=new Date(config.endsAt))throw Error('PROMO_UNAVAILABLE');
  if(base.lt(config.minEligibleNet))throw Error('PROMO_MIN_AMOUNT');
  const proposed=config.kind==='percent'?base.mul(config.value).div(100).toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP):new Exact(config.value);
  return Exact.min(proposed,config.maxDiscount,base).toFixed(2);
}
/** A refund can claw back previously spent rewards without blocking a legal
 * goods return: recovery debt is separate from spendable points. Never expose
 * a negative redeemable balance; later grants clear recovery debt first. */
export function pointPosition(net:string){
  if(!/^-?\d+$/.test(net))throw Error('INVALID_POINTS');const value=BigInt(net);
  if(value>MAX_POINTS||value<-MAX_POINTS)throw Error('POINTS_TOO_LARGE');
  return {available:(value>ZERO?value:ZERO).toString(),recoveryDebt:(value<ZERO?-value:ZERO).toString()};
}
