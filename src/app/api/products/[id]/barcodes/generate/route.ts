import {randomUUID} from 'node:crypto'
import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {runOperation,audit} from '@/server/operations'
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');if(!['owner','admin'].includes(context.role))throw new AccessError(403,'FORBIDDEN')
 const {id}=await params,{operationId}=z.object({operationId:z.string().uuid()}).parse(await request.json())
 const result=await runOperation(context,'barcode.generate',operationId,{productId:id},async tx=>{
  if(!await tx.product.findFirst({where:{id,organizationId:context.organizationId,isActive:true}}))throw new AccessError(404,'NOT_FOUND')
  const barcode=await tx.productBarcode.create({data:{organizationId:context.organizationId,productId:id,value:'INT-'+randomUUID().replaceAll('-','').slice(0,16)}})
  await audit(tx,context,'ProductBarcode',barcode.id,'barcode_generated',{productId:id,value:barcode.value});return barcode
 });return NextResponse.json({success:true,data:result})
})
