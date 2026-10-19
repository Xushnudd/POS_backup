import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {barcodeSvg} from '@/server/catalog/labels'
import {htmlText} from '@/server/customers/print'
import {consumeLimit} from '@/server/auth/rate-limit'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');if(!['owner','admin'].includes(context.role))throw new AccessError(403,'FORBIDDEN')
 const {id}=await params,input=z.object({barcodeId:z.string().uuid(),copies:z.coerce.number().int().min(1).max(100).default(1)}).parse(Object.fromEntries(request.nextUrl.searchParams))
 await consumeLimit('barcode.labels',context.organizationId+':'+context.userId,10,60000)
 const barcode=await prisma.productBarcode.findFirst({where:{id:input.barcodeId,productId:id,organizationId:context.organizationId},include:{product:true}})
 if(!barcode)throw new AccessError(404,'NOT_FOUND')
 const svg=barcodeSvg(barcode.value),label=`<article><strong>${htmlText(barcode.product.name)}</strong>${svg}<div>${htmlText(barcode.value)}</div><small>SKU: ${htmlText(barcode.product.sku)}</small></article>`
 const content=`<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline'"><title>Barkod etiketka</title><style>@page{size:80mm 35mm;margin:2mm}body{margin:0;font:11px sans-serif}article{box-sizing:border-box;width:76mm;height:31mm;text-align:center;break-after:page;overflow:hidden}strong{display:block;height:5mm;overflow:hidden}svg{display:block;width:100%;height:15mm;background:white}small{display:block}</style></head><body>${Array(input.copies).fill(label).join('')}</body></html>`
 return NextResponse.json({success:true,data:{filename:'barcode-'+barcode.id+'.html',content}})
})
