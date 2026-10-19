import {NextRequest,NextResponse} from 'next/server';
import {withApi} from '@/server/api';
import {consumeLimit} from '@/server/auth/rate-limit';
import {loyaltyContext} from '@/server/loyalty/http-context';
import {preparePointRedemption,preparePointRedemptionSchema,salePointRedemption} from '@/server/loyalty/redemption';
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const context=await loyaltyContext(request);return NextResponse.json({success:true,data:await salePointRedemption(context,(await params).id)});});
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const context=await loyaltyContext(request);await consumeLimit('loyalty.redeem',context.organizationId+':'+context.userId,20,60000);return NextResponse.json({success:true,data:await preparePointRedemption(context,(await params).id,preparePointRedemptionSchema.parse(await request.json()))});});
