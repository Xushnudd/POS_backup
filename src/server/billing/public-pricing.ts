import { prisma } from '@/lib/prisma'
export type PublicPlan = { code:string; name:string; monthlyPrice:string; currency:string; branchLimit:number; registerLimit:number; staffLimit:number; isTrial:boolean; trialDays:number; graceDays:number }
let cached: { expires:number; rows:PublicPlan[] } | null = null
let flight: Promise<PublicPlan[]> | null = null
// Bounded configuration-only cache; invoices independently check current version.
export function publicPricing():Promise<PublicPlan[]> {
  if(cached && performance.now()<cached.expires)return Promise.resolve(cached.rows)
  if(flight)return flight
  flight=prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '2000ms'")
    const plans=await tx.billingPlan.findMany({where:{isActive:true},include:{currentVersion:true},orderBy:{code:'asc'},take:101})
    if(plans.length>100)throw new Error('PUBLIC_PLAN_CAPACITY')
    const rows=plans.map(({code,isTrial,currentVersion:v})=>({code,isTrial,name:v.name,monthlyPrice:v.monthlyPrice.toFixed(2),currency:v.currency,branchLimit:v.branchLimit,registerLimit:v.registerLimit,staffLimit:v.staffLimit,trialDays:v.trialDays,graceDays:v.graceDays}))
    cached={expires:performance.now()+60000,rows};return rows
  },{maxWait:1000,timeout:3000}).finally(()=>{flight=null})
  return flight
}
