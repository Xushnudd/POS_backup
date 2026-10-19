import {NextRequest,NextResponse} from 'next/server';
import {withApi} from '@/server/api';
import {consumeLimit} from '@/server/auth/rate-limit';
import {loyaltyContext} from '@/server/loyalty/http-context';
import {readBenefits,prepareBenefit,prepareBenefitSchema} from '@/server/loyalty/marketing';
import {z} from 'zod';
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const options=z.object({cardPage:z.coerce.number().int().min(1).max(1000000),promotionPage:z.coerce.number().int().min(1).max(1000000),search:z.string().max(200)}).parse({cardPage:request.nextUrl.searchParams.get('cardPage')??1,promotionPage:request.nextUrl.searchParams.get('promotionPage')??1,search:request.nextUrl.searchParams.get('search')??''});
 return NextResponse.json({success:true,data:await readBenefits(await loyaltyContext(request),(await params).id,options)});
});
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const context=await loyaltyContext(request);await consumeLimit('loyalty.benefits',context.organizationId+':'+context.userId,30,60000);
 return NextResponse.json({success:true,data:await prepareBenefit(context,(await params).id,prepareBenefitSchema.parse(await request.json()))});
});
