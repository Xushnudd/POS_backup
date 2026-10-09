import {Prisma} from '@prisma/client'
import {z} from 'zod'
import type {TokenPayload} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {AccessError} from '../auth/policy'
import {assertLiveContext,audit,runOperation} from '../operations'
import {decimal} from '../sales/calculations'
import {validateUnitQuantity} from './service'
import {convertQuantity,type ConversionSnapshot} from './conversion-math'
export const conversionSchema=z.object({operationId:z.string().uuid(),tradeUnit:z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),ratio:z.string().regex(/^\d+(\.\d{1,6})?$/).refine(v=>decimal(v).gt(0)&&decimal(v).lt('100000000')),isActive:z.boolean(),reason:z.string().trim().min(3).max(2000)}).strict()
export async function listConversions(ctx:TokenPayload,productId:string){return prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx);const product=await tx.product.findFirst({where:{id:productId,organizationId:ctx.organizationId},select:{id:true,unit:true}});if(!product)throw new AccessError(404,'NOT_FOUND');return {product,conversions:await tx.productUnitConversion.findMany({where:{productId,organizationId:ctx.organizationId},orderBy:{tradeUnit:'asc'}})}})}
export async function setConversion(ctx:TokenPayload,productId:string,input:z.infer<typeof conversionSchema>){if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED');return runOperation(ctx,'catalog.conversion',input.operationId,{productId,...input},async tx=>{
 await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${productId} AND "organizationId"=${ctx.organizationId} FOR UPDATE`;
 const product=await tx.product.findFirst({where:{id:productId,organizationId:ctx.organizationId}});if(!product)throw new AccessError(404,'NOT_FOUND');if(product.unit===input.tradeUnit)throw new AccessError(400,'BASE_UNIT_CONVERSION');
 const units=await tx.unit.findMany({where:{organizationId:ctx.organizationId,code:{in:[product.unit,input.tradeUnit]},isActive:true}});if(units.length!==2)throw new AccessError(409,'UNIT_UNAVAILABLE');convertQuantity('1',input.ratio,units.find(unit=>unit.code===product.unit)!.precision);
 const before=await tx.productUnitConversion.findUnique({where:{productId_tradeUnit:{productId,tradeUnit:input.tradeUnit}}});const data={ratio:decimal(input.ratio),isActive:input.isActive};const row=await tx.productUnitConversion.upsert({where:{productId_tradeUnit:{productId,tradeUnit:input.tradeUnit}},create:{organizationId:ctx.organizationId,productId,baseUnit:product.unit,tradeUnit:input.tradeUnit,...data},update:data});await audit(tx,ctx,'Product',productId,'conversion_updated',{before,after:row,reason:input.reason});return row;
})}
export type ConversionCatalogue={units:{code:string;name?:string;precision:number;isActive:boolean}[];conversions:{productId:string;baseUnit:string;tradeUnit:string;ratio:Prisma.Decimal;isActive:boolean}[]};
export async function resolveConversion(tx:Prisma.TransactionClient,organizationId:string,product:{id:string;unit:string},quantity:string|number|Prisma.Decimal,tradeUnit?:string,catalogue?:ConversionCatalogue){
 if(!tradeUnit||tradeUnit===product.unit){if(catalogue){const unit=catalogue.units.find(u=>u.code===product.unit&&u.isActive);if(!unit)throw new AccessError(409,'UNIT_UNAVAILABLE');if(decimal(quantity).decimalPlaces()>unit.precision)throw new AccessError(400,'INVALID_UNIT_PRECISION','Birlik uchun kasr aniqligi noto‘g‘ri')}else await validateUnitQuantity(tx,organizationId,product.unit,quantity);return {quantity:decimal(quantity),snapshot:null}}
 const conversion=catalogue?catalogue.conversions.find(c=>c.productId===product.id&&c.baseUnit===product.unit&&c.tradeUnit===tradeUnit&&c.isActive):await tx.productUnitConversion.findFirst({where:{organizationId,productId:product.id,baseUnit:product.unit,tradeUnit,isActive:true}});if(!conversion)throw new AccessError(409,'CONVERSION_UNAVAILABLE');
 if(catalogue){const trade=catalogue.units.find(u=>u.code===tradeUnit&&u.isActive);if(!trade)throw new AccessError(409,'UNIT_UNAVAILABLE');if(decimal(quantity).decimalPlaces()>trade.precision)throw new AccessError(400,'INVALID_UNIT_PRECISION','Birlik uchun kasr aniqligi noto‘g‘ri')}else await validateUnitQuantity(tx,organizationId,tradeUnit,quantity);const base=catalogue?catalogue.units.find(u=>u.code===product.unit):await tx.unit.findUnique({where:{organizationId_code:{organizationId,code:product.unit}}});if(!base?.isActive)throw new AccessError(409,'UNIT_UNAVAILABLE');
 const converted=convertQuantity(quantity,conversion.ratio,base.precision),snapshot:ConversionSnapshot={baseUnit:product.unit,tradeUnit,ratio:conversion.ratio.toFixed(),tradeQuantity:decimal(quantity).toFixed()};return {quantity:converted,snapshot};
}
export async function assertCurrentConversion(tx:Prisma.TransactionClient,organizationId:string,product:{id:string;unit:string},quantity:Prisma.Decimal,snapshot:Prisma.JsonValue|null){
 if(snapshot===null)return;
 const frozen=snapshot as unknown as ConversionSnapshot;if(frozen.baseUnit!==product.unit)throw new AccessError(409,'CONVERSION_CHANGED');const current=await resolveConversion(tx,organizationId,product,frozen.tradeQuantity,frozen.tradeUnit);
 if(!current.snapshot||current.snapshot.ratio!==frozen.ratio||!current.quantity.eq(quantity))throw new AccessError(409,'CONVERSION_CHANGED','Birlik nisbati o‘zgardi; savatni yangilang');
}
