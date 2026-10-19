import test from 'node:test';
import assert from 'node:assert/strict';
import {demandForecast,type ForecastConfig} from '@/server/reports/forecast';
const config:ForecastConfig={method:'moving_average',windowDays:7,seasonalWeeks:4,historyDays:56,backtestDays:14,horizonDays:7};
function days(values:string[]){return values.map((quantity,index)=>({date:new Date(Date.UTC(2026,7,1+index)).toISOString().slice(0,10),quantity}));}
test('Moving-average demand baseline measures exact rolling-origin accuracy, not leaked training data',()=>{
  const result=demandForecast(days(Array(56).fill('3.000001')),config);
  assert.equal(result.status,'measured_baseline');assert.equal(result.metrics?.mae,'0.000000');assert.equal(result.metrics?.rmse,'0.000000');
  assert.equal(result.metrics?.wapePercent,'0.000000');assert.equal(result.metrics?.zeroBaselineMae,'3.000001');
  assert.equal(result.metrics?.beatsZeroBaseline,true);assert.equal(result.forecast.length,7);assert.equal(result.forecast[0].quantity,'3.000001');
  const shock=demandForecast(days([...Array(55).fill('0'), '70']),config);
  assert.equal(shock.status,'measured_baseline');assert.equal(shock.backtest?.at(-1)?.predicted,'0.000000');
  assert.equal(shock.metrics?.mae,'5.000000');assert.equal(shock.metrics?.wapePercent,'100.000000');assert.equal(shock.metrics?.beatsZeroBaseline,false);
  assert.equal(shock.forecast[0].quantity,'10.000000');
  const exact=demandForecast(days(Array(56).fill('9007199254740993.000001')),config);
  assert.equal(exact.forecast[0].quantity,'9007199254740993.000001');assert.equal(exact.metrics?.mae,'0.000000');
});
test('Weekday demand baseline is measured against recurring weekdays with exact quantities',()=>{
  const values=Array.from({length:56},(_,index)=>String(index%7+1)),result=demandForecast(days(values),{...config,method:'weekday_average'});
  assert.equal(result.status,'measured_baseline');assert.equal(result.metrics?.mae,'0.000000');assert.deepEqual(result.forecast.map(row=>row.quantity),['1.000000','2.000000','3.000000','4.000000','5.000000','6.000000','7.000000']);
});
test('Missing history, invalid dates, gaps and negative observed quantities cannot produce a fabricated forecast',()=>{
  assert.equal(demandForecast(days(Array(56).fill('0')),config).status,'insufficient_history');
  assert.equal(demandForecast(days(Array(10).fill('1')),config).status,'insufficient_history');
  assert.throws(()=>demandForecast([{date:'2026-02-30',quantity:'1'}],config),/INVALID_DEMAND_DATE/);
  assert.throws(()=>demandForecast([{date:'2026-08-01',quantity:'1'},{date:'2026-08-03',quantity:'1'}],config),/INCOMPLETE_DEMAND_SERIES/);
  assert.throws(()=>demandForecast(days(['-1']),config),/INVALID_DEMAND_QUANTITY/);
  assert.throws(()=>demandForecast(days(['1.0000001']),config),/INVALID_DEMAND_QUANTITY/);
  assert.throws(()=>demandForecast(days(['1']),{...config,historyDays:28,windowDays:28}),/training/);
});
