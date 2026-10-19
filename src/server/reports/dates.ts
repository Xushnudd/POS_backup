import { AccessError } from '../auth/policy'
export function localDate(now:Date,zone:string) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
 const get=(key:string)=>parts.find(x=>x.type===key)?.value
 return `${get('year')}-${get('month')}-${get('day')}`
}
export function dateBoundary(value:string,zone:string,nextDay=false):Date {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
  if (nextDay || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) throw new AccessError(400,'INVALID_DATE')
  const date=new Date(value);if (!Number.isFinite(date.getTime())) throw new AccessError(400,'INVALID_DATE');return date
 }
 const target=new Date(value+'T00:00:00Z')
 if (!Number.isFinite(target.getTime()) || target.toISOString().slice(0,10)!==value) throw new AccessError(400,'INVALID_DATE')
 if (nextDay) target.setUTCDate(target.getUTCDate()+1)
 let epoch=target.getTime()
 try {
  const fmt=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
  for(let i=0;i<3;i++) {
   const parts=fmt.formatToParts(new Date(epoch));const part=(key:string)=>Number(parts.find(x=>x.type===key)?.value)
   const displayed=Date.UTC(part('year'),part('month')-1,part('day'),part('hour'),part('minute'),part('second'))
   const delta=target.getTime()-displayed
   if (!delta) return new Date(epoch)
   epoch+=delta
  }
 } catch { throw new AccessError(400,'INVALID_TIMEZONE') }
 throw new AccessError(400,'INVALID_DATE_BOUNDARY')
}
export function dateRange(start:string|null,end:string|null,zone:string) {
 const gte=start?dateBoundary(start,zone):undefined
 const lt=end?dateBoundary(end,zone,/^\d{4}-\d{2}-\d{2}$/.test(end)):undefined
 if (gte && lt && gte>=lt) throw new AccessError(400,'INVALID_DATE_RANGE')
 return {...(gte&&{gte}),...(lt&&{lt})}
}
