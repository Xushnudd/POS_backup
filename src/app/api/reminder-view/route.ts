import {createHash} from 'node:crypto'
import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {consumeLimit} from '@/server/auth/rate-limit'
import {reminderViewSchema,viewCustomerReminder} from '@/server/customers/reminders'
export const POST=withApi(async(request:NextRequest)=>{
 const input=reminderViewSchema.parse(await request.json())
 await consumeLimit('reminder.view',createHash('sha256').update(input.organizationId+'.'+input.jobId).digest('hex'),60,60000)
 return NextResponse.json({success:true,data:await viewCustomerReminder(input)},{headers:{'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive'}})
},{public:true,touchSession:false})
