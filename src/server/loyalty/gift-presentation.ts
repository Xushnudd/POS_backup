import type {Prisma} from '@prisma/client';
/** Only the immutable funding amount/code belongs on a scoped goods receipt.
 * Do not expose its authorization session, private source document or owner. */
type GiftFundingReader={giftCheckout:{findFirst(args:{where:{saleId:string;organizationId:string};select:{amount:true;gift:{select:{code:true}}}}):Promise<{amount:Prisma.Decimal;gift:{code:string}}|null>}};
export async function attachGiftFunding<T extends {id:string;organizationId:string}>(tx:GiftFundingReader,sale:T){
 const source=await tx.giftCheckout.findFirst({where:{saleId:sale.id,organizationId:sale.organizationId},select:{amount:true,gift:{select:{code:true}}}});
 return {...sale,...(source?{giftFunding:{amount:source.amount.toFixed(2),code:source.gift.code}}:{})};
}
