const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function parts(at:Date){return Object.fromEntries(formatter.formatToParts(at).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));}
/** Convert an explicitly labelled business-local form value without trusting
 * the operator's browser timezone or interpreting a localized number. */
export function tashkentLocalToISO(input:string){
 const match=input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);if(!match)throw Error('INVALID_BUSINESS_TIME');
 const [year,month,day,hour,minute]=match.slice(1).map(Number);if(year<2000||month<1||month>12||day<1||day>31||hour>23||minute>59)throw Error('INVALID_BUSINESS_TIME');
 const candidate=Date.UTC(year,month-1,day,hour,minute),local=parts(new Date(candidate));
 const offset=Date.UTC(Number(local.year),Number(local.month)-1,Number(local.day),Number(local.hour),Number(local.minute))-candidate;
 const result=new Date(candidate-offset),actual=parts(result);
 if(`${actual.year}-${actual.month}-${actual.day}T${actual.hour}:${actual.minute}`!==input)throw Error('INVALID_BUSINESS_TIME');
 return result.toISOString();
}
