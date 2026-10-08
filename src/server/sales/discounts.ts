import type {Prisma} from '@prisma/client'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {decimal,money,type DecimalInput} from './calculations'
export function discountAmount(base:DecimalInput,amount:DecimalInput,percent?:DecimalInput){
 const gross=money(base),off=money(amount);
 if(percent===undefined||percent===null)return off;
 const rate=decimal(percent);
 if(rate.lt(0)||rate.gt(100)||rate.decimalPlaces()>2)throw new AccessError(400,'INVALID_DISCOUNT_PERCENT');
 const calculated=money(gross.mul(rate).div(100));
 // UI may supply its reviewed amount, but cannot override server arithmetic.
 if(!off.eq(0)&&!off.eq(calculated))throw new AccessError(409,'DISCOUNT_AMOUNT_CHANGED');
 return calculated;
}
export async function discountAuthorization(tx:Prisma.TransactionClient,ctx:TokenPayload,rows:{quantity:Prisma.Decimal;unitPrice:Prisma.Decimal}[],net:Prisma.Decimal,reason?:string|null,requireReason=true){
 const gross=rows.reduce((n,r)=>n.add(r.quantity.mul(r.unitPrice)),decimal(0)),off=gross.sub(net);
 const policy=await tx.discountPolicy.findFirst({where:{organizationId:ctx.organizationId,isActive:true}});
 const max=ctx.role==='owner'?decimal(100):decimal(ctx.role==='admin'?policy?.adminMaxPercent??0:policy?.cashierMaxPercent??0);
 const rate=gross.eq(0)?decimal(0):off.mul(100).div(gross);
 if(rate.gt(max))throw new AccessError(403,'DISCOUNT_LIMIT','Chegirma vakolat chegarasidan oshdi; rahbar o‘z hisobida tasdiqlashi kerak');
 if(requireReason&&off.gt(0)&&rate.gte(policy?.requireReasonFromPercent??10)&&(!reason||reason.trim().length<3))throw new AccessError(400,'DISCOUNT_REASON_REQUIRED','Chegirma sababini yozing');
 return {discountReason:off.gt(0)?reason?.trim()??null:null,discountApprovedBy:off.gt(0)?ctx.userId:null,discountApprovedRole:off.gt(0)?ctx.role:null,discountApprovedAt:off.gt(0)?new Date():null,discountPolicySnapshot:{policyId:policy?.id??null,maxPercent:max.toFixed(),requireReasonFromPercent:decimal(policy?.requireReasonFromPercent??10).toFixed(),actualPercent:rate.toFixed(6)}};
}
