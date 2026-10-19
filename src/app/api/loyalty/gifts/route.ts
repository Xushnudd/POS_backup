import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {withApi} from '@/server/api';
import {consumeLimit} from '@/server/auth/rate-limit';
import {loyaltyContext} from '@/server/loyalty/http-context';
import {issueGiftSchema,redeemGiftSchema,refundGiftSchema,issueGift,redeemGift,refundGift,listGifts} from '@/server/loyalty/gifts';
const commands=z.discriminatedUnion('action',[
 issueGiftSchema.extend({action:z.literal('issue')}),redeemGiftSchema.extend({action:z.literal('redeem')}),refundGiftSchema.extend({action:z.literal('refund')}),
]);
export const GET=withApi(async(request:NextRequest)=>{
 const context=await loyaltyContext(request),params=request.nextUrl.searchParams;
 const query=z.object({page:z.coerce.number().int().min(1).max(1000000),limit:z.coerce.number().int().min(1).max(200),query:z.string().max(200),customerId:z.string().uuid().optional()}).parse({page:params.get('page')??1,limit:params.get('limit')??20,query:params.get('search')??'',customerId:params.get('customerId')??undefined});
 return NextResponse.json({success:true,data:await listGifts(context,query)});
});
export const POST=withApi(async(request:NextRequest)=>{
 const context=await loyaltyContext(request);await consumeLimit('loyalty.gifts',context.organizationId+':'+context.userId,20,60000);
 const {action,...data}=commands.parse(await request.json());
 const result=action==='issue'?await issueGift(context,issueGiftSchema.parse(data)):action==='redeem'?await redeemGift(context,redeemGiftSchema.parse(data)):await refundGift(context,refundGiftSchema.parse(data));
 return NextResponse.json({success:true,data:result});
});
