import {NextRequest,NextResponse} from 'next/server';
import {withApi} from '@/server/api';
import {consumeLimit} from '@/server/auth/rate-limit';
import {loyaltyContext} from '@/server/loyalty/http-context';
import {cancelBenefit,cancelBenefitSchema} from '@/server/loyalty/marketing';
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await loyaltyContext(request);await consumeLimit('loyalty.benefits',context.organizationId+':'+context.userId,30,60000);
 return NextResponse.json({success:true,data:await cancelBenefit(context,(await params).id,cancelBenefitSchema.parse(await request.json()))});
});
