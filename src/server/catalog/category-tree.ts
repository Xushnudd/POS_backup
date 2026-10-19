import {Prisma} from '@prisma/client'
import {AccessError} from '../auth/policy'
export async function validateCategoryParent(tx:Pick<Prisma.TransactionClient,'$queryRaw'>,organizationId:string,parentId:string|null,id?:string){
 await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId} FOR UPDATE`
 let cursor=parentId,depth=0;const seen=new Set<string>()
 while(cursor){if(cursor===id||seen.has(cursor))throw new AccessError(409,'CATEGORY_CYCLE','Kategoriya o‘zining yoki avlodining ichiga joylashtirilmaydi');if(++depth>=100)throw new AccessError(409,'CATEGORY_DEPTH_LIMIT');seen.add(cursor);const [parent]=await tx.$queryRaw<{parentId:string|null}[]>`SELECT "parentId" FROM "Category" WHERE id=${cursor} AND "organizationId"=${organizationId}`;if(!parent)throw new AccessError(404,'CATEGORY_NOT_FOUND');cursor=parent.parentId;}
}
