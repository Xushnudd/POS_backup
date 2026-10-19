import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {allocateMoney,decimal} from '../sales/calculations';
import {loyaltyPolicySchema,promotionDiscount,promotionRuleSchema,type LoyaltyPolicy} from './calculations';

const amount=z.string().regex(/^\d+(?:\.\d{1,2})?$/).max(30)
 .refine(value=>decimal(value).lt('1000000000000'));
const lineSchema=z.object({id:z.string().uuid(),productId:z.string().uuid(),net:amount}).strict();
const cartSchema=z.object({storeId:z.string().uuid(),customerId:z.string().uuid(),lines:z.array(lineSchema).min(1).max(2000)}).strict()
 .refine(cart=>new Set(cart.lines.map(line=>line.id)).size===cart.lines.length,'Duplicate sale line');
export type BenefitCart=z.infer<typeof cartSchema>;
type Rule=z.infer<typeof promotionRuleSchema>;

/** Inputs must be read from the locked server-side sale, never request prices.
 * Net is each line's remaining payable value after earlier discounts. This
 * function quotes a benefit; it does not reserve or consume a promo use. */
export function quotePromotion(cartInput:BenefitCart,ruleInput:Rule,policyInput:LoyaltyPolicy['promos'],
 usage:{total:number;customer:number},existing:{card:boolean;points:boolean},at:Date){
 const cart=cartSchema.parse(cartInput),rule=promotionRuleSchema.parse(ruleInput),policy=loyaltyPolicySchema.shape.promos.parse(policyInput);
 z.object({card:z.boolean(),points:z.boolean()}).strict().parse(existing);
 if(!policy.enabled)throw Error('PROMO_UNAVAILABLE');
 if((existing.card&&!policy.allowStackingWithCard)||(existing.points&&!policy.allowStackingWithPoints))throw Error('PROMO_STACKING_DENIED');
 if(!Number.isSafeInteger(usage.total)||!Number.isSafeInteger(usage.customer)||usage.customer<0||usage.total<usage.customer)throw Error('PROMO_USAGE_INVALID');
 if(usage.total>=rule.maxUses||usage.customer>=rule.maxUsesPerCustomer)throw Error('PROMO_USE_LIMIT');
 if(rule.storeIds.length&&!rule.storeIds.includes(cart.storeId))throw Error('PROMO_STORE_UNAVAILABLE');
 const products=new Set(rule.productIds),lines=cart.lines.filter(line=>!products.size||products.has(line.productId));
 const eligible=lines.reduce((sum,line)=>sum.add(line.net),decimal(0));
 if(eligible.isZero())throw Error('PROMO_PRODUCTS_UNAVAILABLE');
 const discount=promotionDiscount(eligible.toFixed(2),rule,at);
 return {eligibleNet:eligible.toFixed(2),discountAmount:discount,
  lineDiscounts:Object.fromEntries(Object.entries(allocateMoney(discount,lines.map(line=>({id:line.id,weight:line.net})))).map(([id,value])=>[id,value.toFixed(2)]))};
}

export function quoteDiscountCard(cartInput:BenefitCart,policyInput:LoyaltyPolicy['cards'],
 card:{customerId:string;isActive:boolean;issuedAt:Date;expiresAt:Date|null},at:Date){
 const cart=cartSchema.parse(cartInput),policy=loyaltyPolicySchema.shape.cards.parse(policyInput);
 z.object({customerId:z.string().uuid(),isActive:z.boolean(),issuedAt:z.date(),expiresAt:z.date().nullable()}).strict().parse(card);
 if(!Number.isFinite(at.getTime())||!Number.isFinite(card.issuedAt.getTime())||
  (card.expiresAt!==null&&(!Number.isFinite(card.expiresAt.getTime())||card.expiresAt<=card.issuedAt)))throw Error('CARD_VALIDITY_INVALID');
 if(!policy.enabled||!card.isActive||card.customerId!==cart.customerId||at<card.issuedAt||
  (card.expiresAt!==null&&at>=card.expiresAt))throw Error('CARD_UNAVAILABLE');
 const eligible=cart.lines.reduce((sum,line)=>sum.add(line.net),decimal(0));
 if(eligible.gte('1000000000000'))throw Error('INVALID_AMOUNT');
 const discount=eligible.mul(policy.discountPercent).div(100).toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
 return {eligibleNet:eligible.toFixed(2),discountAmount:discount,
  lineDiscounts:Object.fromEntries(Object.entries(allocateMoney(discount,cart.lines.map(line=>({id:line.id,weight:line.net})))).map(([id,value])=>[id,value.toFixed(2)]))};
}
