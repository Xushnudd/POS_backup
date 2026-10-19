import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {AccessError} from '@/server/auth/policy'
import {assertLiveContext} from '@/server/operations'
import {consumeLimit} from '@/server/auth/rate-limit'
import {prepareItems,requireOpenShift,saleDraftSchema} from '@/server/sales/service'
export const POST=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');const input=saleDraftSchema.parse(await request.json());await consumeLimit('sale-preview',ctx.organizationId+':'+ctx.userId,120,60000);const data=await prisma.$transaction(async tx=>{await assertLiveContext(tx,ctx);const shift=await requireOpenShift(tx,ctx,input.shiftId);if(shift.registerId!==input.registerId||shift.register.storeId!==input.storeId)throw new AccessError(409,'INVALID_RELATION');const prepared=await prepareItems(tx,ctx,input.items,input.discountAmount,input);return {totals:prepared.totals,taxFingerprint:prepared.taxFingerprint,items:prepared.rows};},{isolationLevel:'RepeatableRead'});return NextResponse.json({success:true,data});});
