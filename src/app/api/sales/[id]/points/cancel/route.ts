import {NextRequest,NextResponse} from 'next/server';
import {withApi} from '@/server/api';
import {consumeLimit} from '@/server/auth/rate-limit';
import {loyaltyContext} from '@/server/loyalty/http-context';
import {cancelPointRedemption,cancelPointRedemptionSchema} from '@/server/loyalty/redemption';
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const context=await loyaltyContext(request);await consumeLimit('loyalty.cancel',context.organizationId+':'+context.userId,20,60000);return NextResponse.json({success:true,data:await cancelPointRedemption(context,(await params).id,cancelPointRedemptionSchema.parse(await request.json()))});});
