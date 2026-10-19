import {Prisma} from '@prisma/client'
import {z} from 'zod'
import type {TokenPayload} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {AccessError} from '../auth/policy'
import {assertLiveContext,audit,payloadHash,runOperation} from '../operations'
export const stepNames=['organization','register','catalog','opening','staff','sale'] as const
export const checkpointSchema=z.object({operationId:z.string().uuid(),storeId:z.string().uuid(),step:z.enum(stepNames),confirmationHash:z.string().regex(/^[a-f0-9]{64}$/),reason:z.string().trim().min(3).max(2000)}).strict()
function owner(ctx:TokenPayload){if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')}
async function statusTx(tx:Prisma.TransactionClient,ctx:TokenPayload,storeId:string){
 const store=await tx.store.findFirst({where:{id:storeId,organizationId:ctx.organizationId,isActive:true}});if(!store)throw new AccessError(404,'STORE_NOT_FOUND')
 const organization=await tx.organization.findUniqueOrThrow({where:{id:ctx.organizationId}}),register=await tx.register.findFirst({where:{storeId,isActive:true},orderBy:{id:'asc'}}),imported=await tx.operation.findFirst({where:{organizationId:ctx.organizationId,type:'catalog.import',state:'completed'},orderBy:{createdAt:'desc'},select:{id:true}}),products=await tx.product.count({where:{organizationId:ctx.organizationId,isActive:true}}),opening=await tx.stockDocument.findFirst({where:{organizationId:ctx.organizationId,storeId,documentType:'opening',status:'confirmed',reversal:null,items:{some:{quantity:{gt:0}}}},orderBy:{id:'asc'},select:{id:true}}),staff=await tx.organizationUser.findFirst({where:{organizationId:ctx.organizationId,role:'cashier',isActive:true,archivedAt:null,user:{isActive:true},userStores:{some:{storeId}}},select:{id:true}}),sale=await tx.sale.findFirst({where:{organizationId:ctx.organizationId,storeId,status:{in:['completed','partially_returned','returned']},items:{some:{}},completedAt:{not:null}},orderBy:{completedAt:'asc'},select:{id:true,receiptNo:true}})
 const checks=await tx.onboardingCheckpoint.findMany({where:{organizationId:ctx.organizationId,storeId}}),proofs={organization:organization.name.trim()&&organization.phone.trim()?{organizationId:ctx.organizationId}:null,register:register?{storeId,registerId:register.id}:null,catalog:imported&&products>0?{importOperationId:imported.id,activeProducts:products}:null,opening:opening?{stockDocumentId:opening.id}:null,staff:staff?{membershipId:staff.id}:null,sale:sale?{saleId:sale.id,receiptNo:sale.receiptNo}:null}
 const steps=stepNames.map(step=>{const proof=proofs[step],checkpoint=checks.find(c=>c.step===step);return {step,ready:proof!==null,confirmed:!!checkpoint,complete:!!checkpoint&&proof!==null,proof,confirmationHash:payloadHash({organizationId:ctx.organizationId,storeId,step,proof}),confirmedAt:checkpoint?.createdAt??null}})
 return {storeId,storeName:store.name,steps,complete:steps.every(s=>s.complete)}
}
export async function onboardingStatus(ctx:TokenPayload,storeId:string){owner(ctx);return prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx);return statusTx(tx,ctx,storeId)},{isolationLevel:'RepeatableRead'})}
export async function confirmOnboarding(ctx:TokenPayload,input:z.infer<typeof checkpointSchema>){owner(ctx);return runOperation(ctx,'onboarding.checkpoint',input.operationId,input,async tx=>{
 const status=await statusTx(tx,ctx,input.storeId),i=stepNames.indexOf(input.step),step=status.steps[i];if(!step.ready||status.steps.slice(0,i).some(s=>!s.complete))throw new AccessError(409,'ONBOARDING_PREREQUISITE','Avval oldingi bosqichlarni tugating va haqiqiy ma’lumotni tekshiring')
 if(step.confirmationHash!==input.confirmationHash)throw new AccessError(409,'ONBOARDING_CHANGED','Bosqich ma’lumoti o‘zgardi; qayta ko‘ring')
 const prior=await tx.onboardingCheckpoint.findUnique({where:{organizationId_storeId_step:{organizationId:ctx.organizationId,storeId:input.storeId,step:input.step}}});if(prior)return prior
 const result=await tx.onboardingCheckpoint.create({data:{organizationId:ctx.organizationId,storeId:input.storeId,step:input.step,proof:step.proof!,confirmedBy:ctx.userId}});await audit(tx,ctx,'OnboardingCheckpoint',result.id,'onboarding_step_confirmed',{step:input.step,storeId:input.storeId,proof:step.proof,reason:input.reason});return result
 })}
