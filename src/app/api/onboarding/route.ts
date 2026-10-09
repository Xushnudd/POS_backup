import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {checkpointSchema,onboardingStatus,confirmOnboarding} from '@/server/onboarding/service'
import {z} from 'zod'
export const GET=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await onboardingStatus(ctx,z.string().uuid().parse(request.nextUrl.searchParams.get('storeId')))})})
export const POST=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await confirmOnboarding(ctx,checkpointSchema.parse(await request.json()))})})
