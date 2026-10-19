import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {reportDecimal} from './numeric';

export const forecastConfigSchema=z.object({
  method:z.enum(['moving_average','weekday_average']),
  windowDays:z.number().int().min(1).max(90),
  seasonalWeeks:z.number().int().min(2).max(12),
  historyDays:z.number().int().min(28).max(365),
  backtestDays:z.number().int().min(7).max(90),
  horizonDays:z.number().int().min(1).max(30),
}).strict().refine(config=>config.historyDays>=config.backtestDays+(config.method==='moving_average'?config.windowDays:7*config.seasonalWeeks),'Backtest uchun oldingi training tarixi yetarli bo‘lsin');
export type ForecastConfig=z.infer<typeof forecastConfigSchema>;
export type DemandDay={date:string;quantity:string};
const ZERO=reportDecimal(0);
const ONE_DAY=86400000;
function dateNumber(date:string){
  const value=Date.parse(date+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(value)||new Date(value).toISOString().slice(0,10)!==date)throw Error('INVALID_DEMAND_DATE');
  return value;
}
function fixed(value:Prisma.Decimal){return value.toDecimalPlaces(6,Prisma.Decimal.ROUND_HALF_UP).toFixed(6);}
function average(values:Prisma.Decimal[]){return values.length?values.reduce((sum,value)=>sum.add(value),ZERO).div(values.length):ZERO;}
function predict(history:Prisma.Decimal[],targetIndex:number,config:ForecastConfig){
  if(config.method==='moving_average')return average(history.slice(-config.windowDays));
  const values:Prisma.Decimal[]=[];
  for(let week=1;week<=config.seasonalWeeks;week++){
    const index=targetIndex-week*7;
    if(index>=0&&index<history.length)values.push(history[index]);
  }
  return average(values);
}

// This predicts observed gross sold base units, not unconstrained demand.
// A caller must supply a dense, complete series from the tenant's own source.
// No prices, money, external feeds or fabricated historical observations enter.
export function demandForecast(days:DemandDay[],input:ForecastConfig){
  const config=forecastConfigSchema.parse(input);
  if(days.length>config.historyDays)throw Error('INVALID_DEMAND_WINDOW');
  const dates=days.map(row=>dateNumber(row.date));
  const values=days.map(row=>{
    if(!/^\d+(?:\.\d{1,6})?$/.test(row.quantity)||row.quantity.length>40)throw Error('INVALID_DEMAND_QUANTITY');
    return reportDecimal(row.quantity);
  });
  if(dates.some((date,index)=>index>0&&date-dates[index-1]!==ONE_DAY))throw Error('INCOMPLETE_DEMAND_SERIES');
  const minimumTraining=config.method==='moving_average'?config.windowDays:config.seasonalWeeks*7;
  if(days.length<minimumTraining+config.backtestDays||!values.some(value=>value.gt(0)))return {
    status:'insufficient_history' as const,method:config.method,observedDays:days.length,requiredDays:minimumTraining+config.backtestDays,
    forecast:[],metrics:null,basis:'Observed gross sold base units; no claim of unconstrained demand or production accuracy.',
  };
  const start=values.length-config.backtestDays;
  let absolute=ZERO,squared=ZERO,actualTotal=ZERO;
  const backtest:{date:string;actual:string;predicted:string}[]=[];
  for(let index=start;index<values.length;index++){
    // Rolling origin: an actual day is never included in its own training data.
    const predicted=predict(values.slice(0,index),index,config),actual=values[index],error=predicted.sub(actual);
    absolute=absolute.add(error.abs());squared=squared.add(error.mul(error));actualTotal=actualTotal.add(actual);
    backtest.push({date:days[index].date,actual:fixed(actual),predicted:fixed(predicted)});
  }
  const mae=absolute.div(config.backtestDays),baseline=actualTotal.div(config.backtestDays);
  const forecast:{date:string;quantity:string}[]=[];
  // Recursive multi-day baseline: future actual data is unavailable. This is
  // explicit and differs from the one-step rolling-origin backtest above.
  const history=[...values];
  for(let step=0;step<config.horizonDays;step++){
    const quantity=predict(history,history.length,config);
    forecast.push({date:new Date(dates[dates.length-1]+(step+1)*ONE_DAY).toISOString().slice(0,10),quantity:fixed(quantity)});
    history.push(quantity);
  }
  return {status:'measured_baseline' as const,method:config.method,observedDays:days.length,requiredDays:minimumTraining+config.backtestDays,
    forecast,backtest,metrics:{backtestDays:config.backtestDays,mae:fixed(mae),rmse:fixed(squared.div(config.backtestDays).sqrt()),
      wapePercent:actualTotal.gt(0)?fixed(absolute.div(actualTotal).mul(100)):null,zeroBaselineMae:fixed(baseline),
      beatsZeroBaseline:mae.lt(baseline),horizonEvaluated:1},
    basis:'Observed gross sold base units. Rolling-origin one-day backtest; recursive future baseline. Historical stock-outs, lost sales and causal factors are not measured; multi-day accuracy is not certified.'};
}
