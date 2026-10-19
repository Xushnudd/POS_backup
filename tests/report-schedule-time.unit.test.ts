import test from 'node:test';
import assert from 'node:assert/strict';
import {nextReportOccurrence,latestReportOccurrence,cadenceSchema} from '@/server/reports/schedule-contract';
test('Business-local daily/weekly/monthly cadence preserves strict boundaries and year/month transitions',()=>{
  const zone='Asia/Tashkent';
  assert.equal(nextReportOccurrence(new Date('2026-10-13T03:59:59.999Z'),zone,{frequency:'daily',hour:9,minute:0}).toISOString(),'2026-10-13T04:00:00.000Z');
  assert.equal(nextReportOccurrence(new Date('2026-10-13T04:00:00Z'),zone,{frequency:'daily',hour:9,minute:0}).toISOString(),'2026-10-14T04:00:00.000Z');
  assert.equal(latestReportOccurrence(new Date('2026-10-13T04:00:00Z'),zone,{frequency:'daily',hour:9,minute:0}).toISOString(),'2026-10-13T04:00:00.000Z');
  assert.equal(nextReportOccurrence(new Date('2026-10-13T10:00:00Z'),zone,{frequency:'weekly',weekday:1,hour:9,minute:0}).toISOString(),'2026-10-19T04:00:00.000Z');
  assert.equal(nextReportOccurrence(new Date('2026-12-28T05:00:00Z'),zone,{frequency:'monthly',day:28,hour:9,minute:0}).toISOString(),'2027-01-28T04:00:00.000Z');
  assert.equal(latestReportOccurrence(new Date('2026-03-01T00:00:00Z'),zone,{frequency:'monthly',day:28,hour:9,minute:0}).toISOString(),'2026-02-28T04:00:00.000Z');
  assert.throws(()=>cadenceSchema.parse({frequency:'weekly',hour:9,minute:0}));
  assert.throws(()=>cadenceSchema.parse({frequency:'monthly',hour:9,minute:0,day:31}));
  assert.throws(()=>cadenceSchema.parse({frequency:'daily',hour:9,minute:0,weekday:1}));
});
