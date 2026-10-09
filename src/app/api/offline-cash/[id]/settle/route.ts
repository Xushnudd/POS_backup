import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {settleOfflineCash,settleCashSchema} from '@/server/offline/cash'
export const POST=withApi(async(request:NextRequest,route:{params:Promise<{id:string}>})=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await settleOfflineCash(ctx,(await route.params).id,settleCashSchema.parse(await request.json()))})})
