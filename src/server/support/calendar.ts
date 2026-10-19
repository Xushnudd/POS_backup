export type SupportCalendar={timezone:string;weekdays:number[];opensMinute:number;closesMinute:number}
function validate(policy:SupportCalendar){if(policy.timezone!=='Asia/Tashkent'||!policy.weekdays.length||new Set(policy.weekdays).size!==policy.weekdays.length||policy.weekdays.some(day=>!Number.isInteger(day)||day<1||day>7)||!Number.isInteger(policy.opensMinute)||!Number.isInteger(policy.closesMinute)||policy.opensMinute<0||policy.closesMinute>1440||policy.closesMinute<=policy.opensMinute)throw new Error('Invalid support calendar')}
function formatter(policy:SupportCalendar){return new Intl.DateTimeFormat('en-CA',{timeZone:policy.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})}
function parts(value:Date,format:Intl.DateTimeFormat){const result:Record<string,number>={};for(const part of format.formatToParts(value))if(part.type!=='literal')result[part.type]=Number(part.value);return result}
function localDay(value:Date,format:Intl.DateTimeFormat){const p=parts(value,format);return Date.UTC(p.year,p.month-1,p.day)}
function interval(day:number,policy:SupportCalendar,format:Intl.DateTimeFormat){
 const weekday=new Date(day).getUTCDay()||7
 if(!policy.weekdays.includes(weekday))return null
 // Runtime IANA timezone data, without hardcoding a UTC offset.
 const noon=new Date(day+12*3600000),p=parts(noon,format),offset=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-noon.getTime()
 return {start:day-offset+policy.opensMinute*60000,end:day-offset+policy.closesMinute*60000}
}
export function businessMinutesBetween(start:Date,end:Date,policy:SupportCalendar):number|null{
 validate(policy);if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<start)throw new Error('Invalid support interval')
 const format=formatter(policy),last=localDay(end,format);let sum=0,day=localDay(start,format),days=0
 for(;day<=last&&days<4000;day+=86400000,days++){const window=interval(day,policy,format);if(window)sum+=Math.max(0,Math.min(end.getTime(),window.end)-Math.max(start.getTime(),window.start))}
 return day<=last?null:sum/60000
}
export function supportDeadline(start:Date,minutes:number,policy:SupportCalendar){
 validate(policy);if(!Number.isFinite(start.getTime())||!Number.isInteger(minutes)||minutes<1||minutes>43200)throw new Error('Invalid support deadline')
 const format=formatter(policy);let remaining=minutes*60000,day=localDay(start,format)
 for(let i=0;i<4000;i++,day+=86400000){const window=interval(day,policy,format);if(!window)continue;const begin=Math.max(start.getTime(),window.start),available=Math.max(0,window.end-begin);if(available>=remaining)return new Date(begin+remaining);remaining-=available}
 throw new Error('Support deadline outside calendar limit')
}
