import {createHash} from 'node:crypto'
import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {consumeLimit} from '@/server/auth/rate-limit'
import {receiptViewSchema,viewReceipt} from '@/server/sales/receipt-links'
export const POST=withApi(async(request:NextRequest)=>{
 const input=receiptViewSchema.parse(await request.json())
 await consumeLimit('receipt.view',createHash('sha256').update(input.organizationId+'.'+input.operationId).digest('hex'),60,60000)
 return NextResponse.json({success:true,data:await viewReceipt(input)},{headers:{'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive'}})
},{public:true,touchSession:false})
