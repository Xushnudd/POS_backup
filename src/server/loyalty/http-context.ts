import type {NextRequest} from 'next/server';
import {verifyToken,getRequestToken} from '@/lib/auth';
import {AccessError} from '../auth/policy';
export async function loyaltyContext(request:NextRequest){const context=await verifyToken(getRequestToken(request)??'');if(!context)throw new AccessError(401,'UNAUTHORIZED');return context;}
