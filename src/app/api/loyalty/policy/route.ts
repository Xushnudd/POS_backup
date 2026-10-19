import {NextRequest,NextResponse} from 'next/server';
import {withApi} from '@/server/api';
import {consumeLimit} from '@/server/auth/rate-limit';
import {loyaltyContext} from '@/server/loyalty/http-context';
import {readLoyaltyPolicy,publishLoyaltyPolicy,publishLoyaltyPolicySchema} from '@/server/loyalty/policy';
export const GET=withApi(async(request:NextRequest)=>{const context=await loyaltyContext(request);return NextResponse.json({success:true,data:await readLoyaltyPolicy(context)});});
export const POST=withApi(async(request:NextRequest)=>{const context=await loyaltyContext(request);await consumeLimit('loyalty.policy',context.organizationId+':'+context.userId,10,60000);return NextResponse.json({success:true,data:await publishLoyaltyPolicy(context,publishLoyaltyPolicySchema.parse(await request.json()))});});
