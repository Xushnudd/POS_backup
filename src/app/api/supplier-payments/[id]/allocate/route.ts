import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {allocateSupplierAdvance,supplierAllocateSchema} from '@/server/purchases/suppliers'
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');const {id}=await params;return NextResponse.json({success:true,data:await allocateSupplierAdvance(ctx,id,supplierAllocateSchema.parse(await request.json()))});});
