import {errorMessage} from '@/i18n/errors';
export type PosFailure={stage:'sale'|'integration'|'print';code:string;message:string;nextAction:string}
export function posFailure(error:unknown,stage:PosFailure['stage']='sale'):PosFailure{
 const value=error as {code?:string;message?:string}|null
 const code=value?.code??(stage==='print'?'PRINT_FAILED':'RESULT_UNKNOWN')
 const resolved=['INTEGRATION_UNAVAILABLE','PAYMENT_PROVIDER_UNAVAILABLE','FISCAL_UNAVAILABLE'].includes(code)?'integration':stage
 return {stage:resolved,code,message:errorMessage(error,'Amal natijasini tekshirish kerak'),nextAction:resolved==='print'?'Savdo saqlangan. Chekni shu savdodan qayta chiqaring; yangi savdo yaratmang.':resolved==='integration'?'Tashqi xizmat natijasini aniqlang. To‘lovni yangi kalit bilan takrorlamang; rahbarga murojaat qiling.':'Asl amal natijasini tekshiring. Narx, soliq yoki qoldiq konflikti bo‘lsa eski urinishni serverda bekor qilib, savatni qayta tasdiqlang.'}
}
