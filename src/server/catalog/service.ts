import { Prisma } from '@prisma/client'
import { z } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessError } from '../auth/policy'
import { assertLiveContext, audit } from '../operations'
import { decimal } from '../sales/calculations'
export const signedQuantitySchema=z.union([z.number().finite(),z.string().regex(/^-?\d+(\.\d{1,6})?$/)]).refine(value=>(typeof value==='number'?Number.isFinite(value):/^-?\d+(\.\d{1,6})?$/.test(value)) && decimal(value).abs().lt('100000000000000') && !decimal(value).isZero() && decimal(value).decimalPlaces()<=6)
export const nonnegativeQuantitySchema=z.union([z.number().finite(),z.string().regex(/^\d+(\.\d{1,6})?$/)]).refine(value=>(typeof value==='number'?Number.isFinite(value):/^\d+(\.\d{1,6})?$/.test(value)) && decimal(value).gte(0) && decimal(value).decimalPlaces()<=6 && decimal(value).lt('100000000000000'))
export const unitSchema=z.object({code:z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),name:z.string().trim().min(1).max(100),precision:z.number().int().min(0).max(6)})
export const updateUnitSchema=unitSchema.omit({code:true}).partial().extend({isActive:z.boolean().optional()})
export const barcodeSchema=z.object({value:z.string().trim().min(2).max(200)})
function manager(context:TokenPayload){if(context.role==='cashier')throw new AccessError(403,'FORBIDDEN')}
export async function validateUnitQuantity(tx:Prisma.TransactionClient,organizationId:string,code:string,quantity:Prisma.Decimal|number|string) {
 const unit=await tx.unit.findUnique({where:{organizationId_code:{organizationId,code}}})
 if (!unit?.isActive) throw new AccessError(409,'UNIT_UNAVAILABLE','Mahsulot birligi faol emas')
 if (decimal(quantity).decimalPlaces()>unit.precision) throw new AccessError(400,'INVALID_UNIT_PRECISION',`${unit.name} uchun kasr aniqligi ${unit.precision}`)
}
export async function createUnit(context:TokenPayload,input:z.infer<typeof unitSchema>) {
 manager(context)
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  const unit=await tx.unit.create({data:{...input,organizationId:context.organizationId}})
  await audit(tx,context,'Unit',unit.id,'unit_created',input)
  return unit
 })
}
export async function updateUnit(context:TokenPayload,id:string,input:z.infer<typeof updateUnitSchema>) {
 manager(context)
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  await tx.$queryRaw`SELECT id FROM "Unit" WHERE id=${id} FOR UPDATE`
  const unit=await tx.unit.findFirst({where:{id,organizationId:context.organizationId}})
  if (!unit) throw new AccessError(404,'NOT_FOUND')
  if ((input.precision!==undefined && input.precision!==unit.precision) || input.isActive===false) {
   if (await tx.product.count({where:{organizationId:context.organizationId,unit:unit.code}})||await tx.productUnitConversion.count({where:{organizationId:context.organizationId,tradeUnit:unit.code}})) throw new AccessError(409,'UNIT_IN_USE','Ishlatilgan birlik aniqligi yoki faol holatini o‘zgartirib bo‘lmaydi')
  }
  const result=await tx.unit.update({where:{id},data:input})
  await audit(tx,context,'Unit',id,'unit_updated',input)
  return result
 })
}
export async function addBarcode(context:TokenPayload,productId:string,value:string) {
 manager(context)
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  const product=await tx.product.findFirst({where:{id:productId,organizationId:context.organizationId}})
  if (!product) throw new AccessError(404,'NOT_FOUND')
  const old=await tx.productBarcode.findUnique({where:{organizationId_value:{organizationId:context.organizationId,value}}})
  if (old) {
   if (old.productId===productId)return old
   throw new AccessError(409,'BARCODE_EXISTS','Barkod boshqa mahsulotga tegishli')
  }
  const result=await tx.productBarcode.create({data:{organizationId:context.organizationId,productId,value}})
  await audit(tx,context,'ProductBarcode',result.id,'barcode_added',{productId,value})
  return result
 })
}
export async function deleteBarcode(context:TokenPayload,productId:string,id:string) {
 manager(context)
 return prisma.$transaction(async tx=>{
  await assertLiveContext(tx,context)
  const barcode=await tx.productBarcode.findFirst({where:{id,productId,organizationId:context.organizationId}})
  if (!barcode)throw new AccessError(404,'NOT_FOUND')
  if(barcode.isPrimary)throw new AccessError(409,'PRIMARY_BARCODE','Asosiy barkodni mahsulot formasida o‘zgartiring')
  await tx.productBarcode.delete({where:{id}})
  await audit(tx,context,'ProductBarcode',id,'barcode_removed',{productId,value:barcode.value})
  return {id}
 })
}
