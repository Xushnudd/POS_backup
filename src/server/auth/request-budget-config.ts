import { AccessError } from './policy'
const settings={API_READS_PER_MINUTE:{fallback:600,min:10,max:100000},API_WRITES_PER_MINUTE:{fallback:300,min:10,max:100000},API_PUBLIC_WRITES_PER_MINUTE:{fallback:1200,min:10,max:100000},API_BODY_TIMEOUT_MS:{fallback:10000,min:50,max:30000}} as const
export function requestBudgetSetting(name:keyof typeof settings,env:Record<string,string|undefined>=process.env){
 const setting=settings[name],text=env[name]
 if(text===undefined||text==='')return setting.fallback
 const value=Number(text)
 if(!/^\d+$/.test(text)||!Number.isSafeInteger(value)||value<setting.min||value>setting.max)throw new AccessError(503,'REQUEST_BUDGET_UNAVAILABLE')
 return value
}
