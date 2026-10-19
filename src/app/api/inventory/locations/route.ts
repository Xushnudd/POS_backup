import {journalListSorts,parseListQuery} from '@/lib/list-query'
import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {createLocation,listStockControl,locationSchema} from '@/server/inventory/reservations'
export const GET=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');const storeId=request.nextUrl.searchParams.get('storeId');if(!storeId)throw new AccessError(400,'STORE_REQUIRED');const q=request.nextUrl.searchParams;let list;try{list=parseListQuery(q,journalListSorts,'newest',50)}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER')}return NextResponse.json({success:true,data:await listStockControl(ctx,storeId,list.page,list.limit,{sort:list.sort,search:list.search,status:q.get('status')??undefined,kind:q.get('kind')??undefined})})})
export const POST=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');return NextResponse.json({success:true,data:await createLocation(ctx,locationSchema.parse(await request.json()))})})
