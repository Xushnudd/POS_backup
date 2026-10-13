import {NextResponse,type NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
import {exporting} from '../../catalog/queries'
import {csv,numeric} from '../csv'
import {batchQuerySchema,queryBatches} from '../../inventory/batches'
export async function queryInventoryBatches(context:TokenPayload,request:NextRequest){
 const params=new URL(request.url).searchParams,all=await exporting(params,context,'inventory-batch.export')
 const values=Object.fromEntries(params);delete values.organizationId;delete values.format
 const result=await queryBatches(context,batchQuerySchema.parse(values),all)
 return NextResponse.json({success:true,meta:{businessDate:result.today,asOf:new Date().toISOString()},data:all?{filename:'inventory-batches-'+context.organizationId+'.csv',content:csv([['Filial ID','Mahsulot ID','Mahsulot','Birlik','Partiya','Kirim kuni','Yaroqlilik kuni','Qoldiq','Holat','Ogohlantirish kunlari','Biznes kuni'],...result.rows.map(row=>[values.storeId,row.productId,row.productName,row.unit,row.code,row.receivedOn,row.expiresOn,numeric(row.quantity,6),row.state,String(row.alertDays),result.today])])}:result},{headers:{'Cache-Control':'no-store'}})
}
