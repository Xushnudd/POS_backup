import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {prisma} from '@/lib/prisma'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {profitSummary} from '@/server/reports/profit'
import {financeManager} from '@/server/finance/accounts'
export const GET=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');financeManager(ctx);return NextResponse.json({success:true,data:await prisma.$transaction(tx=>profitSummary(tx,ctx,request.nextUrl.searchParams),{isolationLevel:'RepeatableRead'})});});
