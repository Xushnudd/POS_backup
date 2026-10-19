import {NextRequest,NextResponse} from 'next/server';
import {withApi} from '@/server/api';
import {loyaltyContext} from '@/server/loyalty/http-context';
import {readPointWallet} from '@/server/loyalty/wallet';
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const context=await loyaltyContext(request);return NextResponse.json({success:true,data:await readPointWallet(context,(await params).id)});});
