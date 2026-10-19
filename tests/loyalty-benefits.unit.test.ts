import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {quotePromotion,quoteDiscountCard,type BenefitCart} from '@/server/loyalty/benefits';
import {giftPosition,giftSpendable,type GiftEntry,type GiftTerms} from '@/server/loyalty/gift-ledger';
import {promotionDiscount} from '@/server/loyalty/calculations';
const at=new Date('2026-10-14T00:00:00Z'),later=new Date('2026-10-15T00:00:00Z');
const cart:BenefitCart={storeId:randomUUID(),customerId:randomUUID(),lines:[
 {id:randomUUID(),productId:randomUUID(),net:'0.05'},
 {id:randomUUID(),productId:randomUUID(),net:'0.05'},
 {id:randomUUID(),productId:randomUUID(),net:'100.00'},
]};
const rule={enabled:true,kind:'percent' as const,value:'10',minEligibleNet:'0',maxDiscount:'20',maxUses:100,maxUsesPerCustomer:2,
 storeIds:[cart.storeId],productIds:[cart.lines[0].productId,cart.lines[1].productId],startsAt:at.toISOString(),endsAt:later.toISOString()};
const promoPolicy={enabled:true,allowStackingWithCard:false,allowStackingWithPoints:false};
const usage={total:1,customer:1},existing={card:false,points:false};
test('Product-scoped promo does not discount unrelated goods and largest remainder conserves the cent',()=>{
 const quote=quotePromotion(cart,rule,promoPolicy,usage,existing,at);
 assert.equal(quote.eligibleNet,'0.10');assert.equal(quote.discountAmount,'0.01');
 assert.equal(quote.lineDiscounts[cart.lines[2].id],undefined);
 assert.deepEqual(Object.values(quote.lineDiscounts).sort(),['0.00','0.01']);
 assert.equal(quotePromotion(cart,{...rule,productIds:[],kind:'fixed',value:'200'},promoPolicy,usage,existing,at).discountAmount,'20.00');
});
test('Promo denies wrong branch, empty scope, exhausted global/customer use and forbidden stacking',()=>{
 assert.throws(()=>quotePromotion({...cart,storeId:randomUUID()},rule,promoPolicy,usage,existing,at),/PROMO_STORE_UNAVAILABLE/);
 assert.throws(()=>quotePromotion(cart,{...rule,productIds:[randomUUID()]},promoPolicy,usage,existing,at),/PROMO_PRODUCTS_UNAVAILABLE/);
 for(const count of [{total:100,customer:1},{total:2,customer:2}])assert.throws(()=>quotePromotion(cart,rule,promoPolicy,count,existing,at),/PROMO_USE_LIMIT/);
 for(const selection of [{card:true,points:false},{card:false,points:true}])assert.throws(()=>quotePromotion(cart,rule,promoPolicy,usage,selection,at),/PROMO_STACKING_DENIED/);
 assert.throws(()=>quotePromotion(cart,rule,promoPolicy,{total:0,customer:1},existing,at),/PROMO_USAGE_INVALID/);
 assert.throws(()=>quotePromotion(cart,rule,promoPolicy,usage,existing,later),/PROMO_UNAVAILABLE/);
 assert.throws(()=>promotionDiscount('100',rule,new Date(NaN)),/PROMO_UNAVAILABLE/);
 assert.throws(()=>quotePromotion({...cart,lines:[cart.lines[0],cart.lines[0]]},rule,promoPolicy,usage,existing,at));
});
test('Customer-bound card uses exact percentage and preserves original half-open validity',()=>{
 const config={enabled:true,discountPercent:'12.5',validityDays:1};
 const card={customerId:cart.customerId,isActive:true,issuedAt:at,expiresAt:later};
 assert.equal(quoteDiscountCard(cart,config,card,at).discountAmount,'12.51');
 assert.throws(()=>quoteDiscountCard(cart,config,{...card,customerId:randomUUID()},at),/CARD_UNAVAILABLE/);
 assert.throws(()=>quoteDiscountCard(cart,config,card,later),/CARD_UNAVAILABLE/);
 assert.throws(()=>quoteDiscountCard(cart,config,{...card,isActive:false},at),/CARD_UNAVAILABLE/);
 assert.throws(()=>quoteDiscountCard(cart,config,card,new Date(NaN)),/CARD_VALIDITY_INVALID/);
 const large={...cart,lines:[{...cart.lines[0],net:'999999999999.99'}]};
 assert.equal(quoteDiscountCard(large,{...config,discountPercent:'99.99'},card,at).discountAmount,'999899999999.99');
});
function entry(kind:GiftEntry['kind'],amount:string,originalEntryId:string|null=null,when=at):GiftEntry{
 return {id:randomUUID(),operationId:randomUUID(),kind,amount,originalEntryId,at:when};
}
const terms:GiftTerms={issuedAt:at,expiresAt:later,configuration:{enabled:true,minIssueAmount:'1',maxIssueAmount:'999999999999.99',validityDays:1,allowUnusedCashRefund:true}};
test('Gift issue, spend, original restoration and unused cash refund reconcile without a second goods revenue',()=>{
 const issue=entry('issue','100.00'),redeem=entry('redeem','60.00'),restore=entry('restore','20.00',redeem.id),refund=entry('cash_refund','10.00',issue.id);
 const position=giftPosition(terms,[issue,redeem,restore,refund]);
 assert.deepEqual(position,{issued:'100.00',redeemed:'60.00',restored:'20.00',cashRefunded:'10.00',liability:'50.00',netCash:'90.00',goodsRevenue:'0.00'});
 // Net cash = settled goods funding + unspent liability, exactly.
 assert.equal(Number(position.netCash),Number(position.redeemed)-Number(position.restored)+Number(position.liability));
});
test('Gift liability survives expiry and goods restoration never extends original spending expiry',()=>{
 const issue=entry('issue','100.00'),redeem=entry('redeem','100.00'),restore=entry('restore','100.00',redeem.id,later);
 assert.equal(giftSpendable(terms,[issue,redeem,restore],later,true).liability,'100.00');
 assert.equal(giftSpendable(terms,[issue,redeem,restore],later,true).spendable,'0.00');
 assert.equal(giftSpendable(terms,[issue],at,false).liability,'100.00');
 assert.equal(giftSpendable(terms,[issue],at,false).spendable,'0.00');
 assert.throws(()=>giftPosition(terms,[issue,entry('redeem','1.00',null,later)]),/GIFT_REDEMPTION_INVALID/);
 assert.throws(()=>giftSpendable(terms,[issue,redeem,restore],at,true),/GIFT_JOURNAL_FUTURE/);
});
test('Gift journal rejects duplicates, foreign/repeated restoration, overdraw and unapproved cash refund',()=>{
 const issue=entry('issue','100.00'),redeem=entry('redeem','60.00');
 assert.throws(()=>giftPosition(terms,[issue,issue]),/GIFT_JOURNAL_INVALID/);
 assert.throws(()=>giftPosition(terms,[issue,{...redeem,operationId:issue.operationId}]),/GIFT_JOURNAL_INVALID/);
 assert.throws(()=>giftPosition(terms,[issue,entry('redeem','100.01')]),/GIFT_BALANCE_EXCEEDED/);
 assert.throws(()=>giftPosition(terms,[issue,redeem,entry('restore','1',randomUUID())]),/GIFT_RESTORE_EXCEEDED/);
 assert.throws(()=>giftPosition(terms,[issue,redeem,entry('restore','40',redeem.id),entry('restore','21',redeem.id)]),/GIFT_RESTORE_EXCEEDED/);
 assert.throws(()=>giftPosition({...terms,configuration:{...terms.configuration,allowUnusedCashRefund:false}},[issue,entry('cash_refund','1',issue.id)]),/GIFT_CASH_REFUND_DENIED/);
 assert.throws(()=>giftPosition(terms,[entry('redeem','1')]),/GIFT_ISSUE_REQUIRED/);
 assert.throws(()=>giftPosition({...terms,expiresAt:null},[issue]),/GIFT_VALIDITY_INVALID/);
});
test('Many fractional gift uses conserve six-figure liability without floating-point rounding',()=>{
 const issue=entry('issue','999999999999.99'),redeem=entry('redeem','123456789012.34');
 const restores=Array.from({length:100},()=>entry('restore','0.01',redeem.id));
 assert.equal(giftPosition(terms,[issue,redeem,...restores]).liability,'876543210988.65');
});
