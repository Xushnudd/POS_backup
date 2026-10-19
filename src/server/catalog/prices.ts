import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {AccessError} from '../auth/policy'
import {assertLiveContext,audit,payloadHash,runOperation} from '../operations'
import {amountSchema} from '../sales/service'
import {nonnegativeQuantitySchema} from './service'
export const priceBatchSchema=z.object({operationId:z.string().uuid(),field:z.enum(['salePrice','costPrice']),reason:z.string().trim().min(3).max(2000),preview:z.boolean().default(false),confirmationHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),items:z.array(z.object({productId:z.string().uuid(),expected:nonnegativeQuantitySchema,value:nonnegativeQuantitySchema}).strict()).min(1).max(100)}).strict();
export async function priceActor(tx:Pick<Prisma.TransactionClient,'$queryRaw'>,ctx:TokenPayload,source:string){await tx.$queryRaw`SELECT set_config('pos.price_actor',${ctx.userId},true),set_config('pos.price_source',${source},true)`;}
/** Bind future manual cost approvals to actual native events from this exact
 * transaction. Existing history is never joined by timestamps or backfilled. */
type CostReferenceReader={
 $queryRaw:Prisma.TransactionClient['$queryRaw'];
 inventoryValuationEvent:{findMany(args:{where:{organizationId:string;productId:{in:string[]};transactionId:bigint;kind:string};select:{id:true;productId:true;beforeUnitCost:true;afterUnitCost:true};orderBy:{productId:'asc'}}):Promise<{id:string;productId:string;beforeUnitCost:Prisma.Decimal|null;afterUnitCost:Prisma.Decimal|null}[]>};
}
export async function costChangeReferences(tx:CostReferenceReader,ctx:TokenPayload,productIds:string[]){
 // Administrators can edit sale prices but cannot read or change owner-only costs.
 if(ctx.role!=='owner')return []
 const [current]=await tx.$queryRaw<{id:bigint}[]>`SELECT txid_current() AS id`
 const rows=await tx.inventoryValuationEvent.findMany({where:{organizationId:ctx.organizationId,productId:{in:productIds},transactionId:current.id,kind:'cost_change'},select:{id:true,productId:true,beforeUnitCost:true,afterUnitCost:true},orderBy:{productId:'asc'}})
 return rows.map(row=>({...row,beforeUnitCost:row.beforeUnitCost?.toFixed(6)??null,afterUnitCost:row.afterUnitCost?.toFixed(6)??null}))
}
export async function changePrices(ctx:TokenPayload,input:z.infer<typeof priceBatchSchema>){
 if(!['owner','admin'].includes(ctx.role))throw new AccessError(403,'FORBIDDEN');
 if(input.field==='costPrice'&&ctx.role!=='owner')throw new AccessError(403,'COST_CHANGE_FORBIDDEN');
 if(new Set(input.items.map(item=>item.productId)).size!==input.items.length)throw new AccessError(400,'DUPLICATE_ITEM');
 if(input.field==='salePrice')for(const item of input.items){amountSchema.parse(item.expected);amountSchema.parse(item.value);}
 const execute=async(tx:Prisma.TransactionClient)=>{
  await assertLiveContext(tx,ctx);
  const rows=[];
  for(const item of [...input.items].sort((a,b)=>a.productId.localeCompare(b.productId))){
   await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${item.productId} AND "organizationId"=${ctx.organizationId} FOR UPDATE`;
   const product=await tx.product.findFirst({where:{id:item.productId,organizationId:ctx.organizationId,isActive:true}});
   if(!product)throw new AccessError(404,'PRODUCT_NOT_FOUND');
   if(!product[input.field].eq(item.expected))throw new AccessError(409,'PRICE_CHANGED','Narx o‘zgardi; yangi preview oling');
   rows.push({productId:product.id,name:product.name,expected:product[input.field].toFixed(),value:new Prisma.Decimal(item.value).toFixed()});
  }
  const hash=payloadHash({field:input.field,reason:input.reason,items:rows});
  if(input.preview)return {items:rows,confirmationHash:hash};
  if(input.confirmationHash!==hash)throw new AccessError(409,'PRICE_PREVIEW_REQUIRED','Oldindan ko‘rilgan narxlarni qayta tasdiqlang');
  await priceActor(tx,ctx,'catalog.bulk');
  for(const row of rows)await tx.product.update({where:{id:row.productId},data:{[input.field]:new Prisma.Decimal(row.value)}});
  await audit(tx,ctx,'PriceBatch',input.operationId,'prices_changed',{field:input.field,count:rows.length,reason:input.reason,confirmationHash:hash,approvedBy:ctx.userId,approvedRole:ctx.role,items:rows,...(input.field==='costPrice'?{valuationReferences:await costChangeReferences(tx,ctx,rows.map(row=>row.productId))}:{})});
  return {items:rows,confirmationHash:hash};
 };
 return input.preview?prisma.$transaction(execute,{isolationLevel:'RepeatableRead'}):runOperation(ctx,'catalog.prices',input.operationId,input,execute);
}
