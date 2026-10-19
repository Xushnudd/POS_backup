import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {prisma} from '@/lib/prisma'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {categorySchema,createExpenseCategory,financeManager} from '@/server/finance/accounts'
export const GET=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');financeManager(ctx);const rows=await prisma.expenseCategory.findMany({where:{organizationId:ctx.organizationId,isActive:true},orderBy:{name:'asc'},take:10001});if(rows.length>10000)throw new AccessError(413,'CATEGORY_LIST_TOO_LARGE','Toifalar ro‘yxati 10000 dan oshdi; qisman ro‘yxat qaytarilmaydi');return NextResponse.json({success:true,data:rows});});
export const POST=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await createExpenseCategory(ctx,categorySchema.parse(await request.json()))});});
