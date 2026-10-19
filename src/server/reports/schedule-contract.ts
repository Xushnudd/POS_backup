import {z} from 'zod';
import {dateBoundary,localDate} from './dates';
import {plannedReportSchema,reportCalendarDay} from './planned-report';

export const cadenceSchema=z.object({
  frequency:z.enum(['daily','weekly','monthly']),
  hour:z.number().int().min(0).max(23),minute:z.number().int().min(0).max(59),
  weekday:z.number().int().min(0).max(6).optional(),day:z.number().int().min(1).max(28).optional(),
}).strict().refine(value=>value.frequency==='weekly'?value.weekday!==undefined&&value.day===undefined:value.frequency==='monthly'?value.day!==undefined&&value.weekday===undefined:value.weekday===undefined&&value.day===undefined,'Haftalik/oylik jadval uchun tegishli kunni tanlang');
export const scheduleConfigurationSchema=z.object({
  cadence:cadenceSchema,report:plannedReportSchema,
  retentionHours:z.number().int().min(1).max(720),
  missedRunPolicy:z.enum(['latest_only','catch_up']),
}).strict();
export type ScheduleConfiguration=z.infer<typeof scheduleConfigurationSchema>;
export const configureScheduleSchema=z.object({
  operationId:z.string().uuid(),id:z.string().uuid().optional(),expectedRevision:z.number().int().min(0),
  name:z.string().trim().min(2).max(200),enabled:z.boolean(),configuration:scheduleConfigurationSchema,
  reason:z.string().trim().min(3).max(2000),
}).strict().refine(value=>value.id?value.expectedRevision>=1:value.expectedRevision===0,'Original revision kerak');
export const stopScheduleSchema=z.object({operationId:z.string().uuid(),expectedRevision:z.number().int().min(1),reason:z.string().trim().min(3).max(2000)}).strict();
export const scheduleDefinitionSchema=z.object({
  name:z.string().min(2).max(200),configuration:scheduleConfigurationSchema,grantMembershipId:z.string().uuid(),
  timezone:z.literal('Asia/Tashkent'),currency:z.literal('UZS'),
}).strict();

function scheduledDate(day:string,zone:string,cadence:z.infer<typeof cadenceSchema>){
  // The product's current business-time contract has no daylight-saving time.
  // Additional zones need an explicit wall-clock ambiguity policy first.
  if(zone!=='Asia/Tashkent')throw Error('REPORT_TIMEZONE_UNSUPPORTED');
  const virtual=new Date(day+'T00:00:00Z');
  if(cadence.frequency==='weekly'&&virtual.getUTCDay()!==cadence.weekday)return null;
  if(cadence.frequency==='monthly'&&virtual.getUTCDate()!==cadence.day)return null;
  return new Date(dateBoundary(day,zone).getTime()+(cadence.hour*60+cadence.minute)*60000);
}
export function nextReportOccurrence(after:Date,zone:string,input:z.infer<typeof cadenceSchema>){
  const cadence=cadenceSchema.parse(input);let day=localDate(after,zone);
  for(let count=0;count<32;count++,day=reportCalendarDay(day,1)){
    const candidate=scheduledDate(day,zone,cadence);if(candidate&&candidate>after)return candidate;
  }
  throw Error('INVALID_REPORT_CADENCE');
}
export function latestReportOccurrence(at:Date,zone:string,input:z.infer<typeof cadenceSchema>){
  const cadence=cadenceSchema.parse(input);let day=localDate(at,zone);
  for(let count=0;count<32;count++,day=reportCalendarDay(day,-1)){
    const candidate=scheduledDate(day,zone,cadence);if(candidate&&candidate<=at)return candidate;
  }
  throw Error('INVALID_REPORT_CADENCE');
}
