import type {NextRequest} from 'next/server';
import {getRequestToken,verifyToken} from '@/lib/auth';
import {AccessError} from '../auth/policy';
export async function reportContext(request:NextRequest){
  const context=await verifyToken(getRequestToken(request)??'');
  if(!context)throw new AccessError(401,'UNAUTHORIZED');
  if(context.role!=='owner'||context.customRole)throw new AccessError(403,'OWNER_REQUIRED');
  return context;
}
