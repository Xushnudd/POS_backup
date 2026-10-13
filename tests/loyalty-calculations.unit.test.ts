import test from 'node:test';
import assert from 'node:assert/strict';
import {earnedPoints,pointsDiscount,cumulativePointReversal,promotionDiscount,pointPosition,loyaltyPolicySchema,type LoyaltyPolicy} from '@/server/loyalty/calculations';
import {planPointSpend,type PointLot} from '@/server/loyalty/lots';
const policy:LoyaltyPolicy={points:{enabled:true,earnMoneyPerPoint:'100',redeemMoneyPerPoint:'1.25',maxRedeemPercent:'50',minEligibleNet:'0',expiryDays:30,earnOnDiscountedSales:false,earnOnCreditSales:false},cards:{enabled:false,discountPercent:'0',validityDays:null},promos:{enabled:false,allowStackingWithCard:false,allowStackingWithPoints:false},gifts:{enabled:false,minIssueAmount:'1',maxIssueAmount:'1000',validityDays:null,allowUnusedCashRefund:false}};
test('Reward rules require explicit administrator choices and exact UZS integer points',()=>{
 assert.equal(earnedPoints('999.99',policy.points).toString(),'9');assert.equal(earnedPoints('1000.00',policy.points,true).toString(),'0');assert.equal(earnedPoints('1000.00',policy.points,false,true).toString(),'0');
 assert.equal(pointsDiscount('3','4','10',policy.points),'3.75');assert.throws(()=>pointsDiscount('5','4','100',policy.points),/POINTS_BALANCE_EXCEEDED/);assert.throws(()=>pointsDiscount('5','5','10',policy.points),/POINTS_DISCOUNT_LIMIT/);
 assert.equal(loyaltyPolicySchema.safeParse({}).success,false);assert.equal(loyaltyPolicySchema.safeParse({...policy,gifts:{...policy.gifts,minIssueAmount:'2000'}}).success,false);
 assert.throws(()=>pointsDiscount('1.5','3','100',policy.points),/INVALID_POINTS/);
});
test('Cumulative partial refunds reverse one original grant without rounding abuse or a negative spendable wallet',()=>{
 let paid='0.00',reversed=BigInt(0);const increments=['0.01','33.32','33.33','33.34'];
 const before=['0.00','0.01','33.33','66.66'];
 for(let i=0;i<increments.length;i++){paid=before[i];reversed+=cumulativePointReversal('7','100.00',paid,increments[i],reversed);}
 assert.equal(reversed.toString(),'7');assert.equal(cumulativePointReversal('9007199254740993','100','0','100','0').toString(),'9007199254740993');
 assert.throws(()=>cumulativePointReversal('7','100','99','2','6'),/RECONCILIATION/);
 assert.deepEqual(pointPosition('-7'),{available:'0',recoveryDebt:'7'});assert.deepEqual(pointPosition('9007199254740993'),{available:'9007199254740993',recoveryDebt:'0'});
});
test('Promotion math retains cents, configured maximum and half-open validity boundaries',()=>{
 const rule={enabled:true,kind:'percent' as const,value:'12.5',minEligibleNet:'10',maxDiscount:'20',maxUses:100,maxUsesPerCustomer:1,storeIds:[],productIds:[],startsAt:'2026-01-01T00:00:00Z',endsAt:'2026-02-01T00:00:00Z'};
 assert.equal(promotionDiscount('100',rule,new Date(rule.startsAt)),'12.50');assert.equal(promotionDiscount('999.99',rule,new Date(rule.startsAt)),'20.00');
 assert.throws(()=>promotionDiscount('9.99',rule,new Date(rule.startsAt)),/PROMO_MIN_AMOUNT/);assert.throws(()=>promotionDiscount('100',rule,new Date(rule.endsAt)),/PROMO_UNAVAILABLE/);
});
test('Expired grants are unavailable, refund recovery clears once, and original FIFO allocations retain exact point identities',()=>{
 const at=new Date('2026-10-13T00:00:00Z'),createdAt=new Date('2026-10-01T00:00:00Z');
 const lots:PointLot[]=[{id:'old-debt',remaining:'-7',createdAt,expiresAt:new Date('2026-10-12T00:00:00Z')},{id:'expired-unused',remaining:'1000',createdAt,expiresAt:at},{id:'new-credit',remaining:'10',createdAt:new Date('2026-10-02T00:00:00Z'),expiresAt:null}];
 assert.deepEqual(planPointSpend(lots,'3',at),{settlements:[{fromLotId:'new-credit',toLotId:'old-debt',points:'7'}],allocations:[{lotId:'new-credit',points:'3'}],available:'3',recoveryDebt:'0'});
 assert.throws(()=>planPointSpend(lots,'4',at),/POINTS_BALANCE_EXCEEDED/);
 // Persisted recovery is represented by the changed balances. Expiring the
 // remaining unused credit later cannot reinstate already settled debt.
 assert.deepEqual(planPointSpend([{...lots[0],remaining:'0'},{...lots[2],remaining:'3',expiresAt:at}],'0',at),{settlements:[],allocations:[],available:'0',recoveryDebt:'0'});
 assert.throws(()=>planPointSpend([lots[0],lots[0]],'0',at),/POINT_LOT_RECONCILIATION/);
});
