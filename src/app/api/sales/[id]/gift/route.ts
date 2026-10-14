import {NextRequest,NextResponse} from 'next/server';
import {withApi} from '@/server/api';
import {consumeLimit} from '@/server/auth/rate-limit';
import {loyaltyContext} from '@/server/loyalty/http-context';
import {checkoutGift,checkoutGiftSchema,saleGiftChoices} from '@/server/loyalty/gifts';
import {z} from 'zod';
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await loyaltyContext(request),options=z.object({page:z.coerce.number().int().min(1).max(1000000),search:z.string().max(200)}).parse({page:request.nextUrl.searchParams.get('page')??1,search:request.nextUrl.searchParams.get('search')??''});
 return NextResponse.json({success:true,data:await saleGiftChoices(context,(await params).id,options)});
});
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await loyaltyContext(request);await consumeLimit('loyalty.gift.checkout',context.organizationId+':'+context.userId,30,60000);
 return NextResponse.json({success:true,data:await checkoutGift(context,(await params).id,checkoutGiftSchema.parse(await request.json()))});
});
