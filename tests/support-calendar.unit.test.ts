import assert from 'node:assert/strict'
import { businessMinutesBetween,supportDeadline } from '@/server/support/calendar'
const policy={timezone:'Asia/Tashkent',weekdays:[1,2,3,4,5,6],opensMinute:540,closesMinute:1080}
// Saturday17:00 local +4business hours → Monday12:00; Sunday is closed.
const start=new Date('2026-10-10T12:00:00Z'),end=supportDeadline(start,240,policy)
assert.equal(end.toISOString(),'2026-10-12T07:00:00.000Z')
assert.equal(businessMinutesBetween(start,end,policy),240)
assert.equal(businessMinutesBetween(new Date('2026-10-11T00:00:00Z'),new Date('2026-10-11T23:00:00Z'),policy),0)
assert.equal(supportDeadline(new Date('2026-10-12T02:00:00Z'),240,policy).toISOString(),'2026-10-12T08:00:00.000Z')
assert.equal(businessMinutesBetween(new Date('2026-10-12T04:00:00Z'),new Date('2026-10-12T04:00:30Z'),policy),0.5)
assert.throws(()=>supportDeadline(start,0,policy))
assert.throws(()=>supportDeadline(start,240,{...policy,weekdays:[]}))
assert.throws(()=>supportDeadline(start,240,{...policy,closesMinute:500}))
assert.throws(()=>businessMinutesBetween(end,start,policy))
