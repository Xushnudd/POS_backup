import {NextRequest,NextResponse} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {commitCatalogImport,importCommitSchema} from '@/server/catalog/imports'
export const POST=withApi(async(request:NextRequest)=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');await consumeLimit('catalog.import',ctx.organizationId+':'+ctx.userId,5,60000);return NextResponse.json({success:true,data:await commitCatalogImport(ctx,importCommitSchema.parse(await request.json()))})},{validateBodyReferences:false})
