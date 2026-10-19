import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {withApi} from '@/server/api';
import {consumeLimit} from '@/server/auth/rate-limit';
import {loyaltyContext} from '@/server/loyalty/http-context';
import {issueCardSchema,createPromotionSchema,revokeRegistrySchema,issueCard,createPromotion,revokeRegistry,listMarketing} from '@/server/loyalty/marketing';
const commands=z.discriminatedUnion('action',[issueCardSchema.extend({action:z.literal('issue_card')}),createPromotionSchema.extend({action:z.literal('create_promotion')}),revokeRegistrySchema.extend({action:z.literal('revoke')})]);
export const GET=withApi(async(request:NextRequest)=>{
 const context=await loyaltyContext(request),params=request.nextUrl.searchParams;
 const options=z.object({kind:z.enum(['card','promotion']),page:z.coerce.number().int().min(1).max(1000000),search:z.string().max(200),customerId:z.string().uuid().optional(),limit:z.coerce.number().int().min(1).max(200),sort:z.enum(['newest','oldest','code'])}).parse({kind:params.get('kind'),page:params.get('page')??1,search:params.get('search')??'',customerId:params.get('customerId')??undefined,limit:params.get('limit')??20,sort:params.get('sort')??'newest'});
 return NextResponse.json({success:true,data:await listMarketing(context,options)});
});
export const POST=withApi(async(request:NextRequest)=>{
 const context=await loyaltyContext(request);await consumeLimit('loyalty.marketing',context.organizationId+':'+context.userId,20,60000);
 const {action,...data}=commands.parse(await request.json());
 const result=action==='issue_card'?await issueCard(context,issueCardSchema.parse(data)):action==='create_promotion'?await createPromotion(context,createPromotionSchema.parse(data)):await revokeRegistry(context,revokeRegistrySchema.parse(data));
 return NextResponse.json({success:true,data:result});
});
