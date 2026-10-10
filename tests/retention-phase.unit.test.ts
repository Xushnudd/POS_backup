import {test} from 'node:test'
import assert from 'node:assert/strict'
import {retentionSchedule} from '@/server/retention/phase'
test('Retention review uses actual paid/trial end, not grace end or a deletion timer',()=>{
 const policy={expiredSubscriptionDays:90},trialEndsAt=new Date('2026-01-15T00:00:00Z'),paidThrough=new Date('2026-02-01T00:00:00Z'),sub={trialEndsAt,paidThrough,graceDays:7}
 assert.equal(retentionSchedule(new Date('2026-02-07T23:59:59Z'),sub,policy).plannedReviewAt,null)
 const expired=retentionSchedule(new Date('2026-02-08T00:00:00Z'),sub,policy)
 assert.equal(expired.subscriptionState,'expired');assert.equal(expired.plannedReviewAt?.toISOString(),'2026-05-02T00:00:00.000Z');assert.equal(expired.reviewDue,false)
 assert.equal(retentionSchedule(new Date('2026-05-02T00:00:00Z'),sub,policy).reviewDue,true)
 const renewed={...sub,paidThrough:new Date('2026-06-01T00:00:00Z')}
 assert.equal(retentionSchedule(new Date('2026-05-02T00:00:00Z'),renewed,policy).plannedReviewAt,null)
 const legacy=retentionSchedule(new Date('2026-05-02T00:00:00Z'),null,policy)
 assert.deepEqual(legacy,{subscriptionState:'legacy_unmanaged',periodEndsAt:null,plannedReviewAt:null,reviewDue:false})
 assert.equal(retentionSchedule(new Date('2026-02-08T00:00:00Z'),sub,{expiredSubscriptionDays:120}).plannedReviewAt?.toISOString(),'2026-06-01T00:00:00.000Z')
 for(const days of [0,-1,1.5,3651,NaN])assert.throws(()=>retentionSchedule(new Date(),sub,{expiredSubscriptionDays:days}))
 assert.throws(()=>retentionSchedule(new Date('invalid'),sub,policy))
})
