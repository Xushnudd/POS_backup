import {Prisma} from '@prisma/client';
import {AccessError} from '../auth/policy';
const messages:Record<string,string>={POINTS_BALANCE_CHANGED:'Ball qoldig‘i yoki siyosati o‘zgardi. Tanlovni bekor qilib, qayta ko‘rib chiqing.',LOYALTY_SALE_CHANGED:'Ball tanlovi savatga bog‘langan. Savatni o‘zgartirishdan oldin ball tanlovini bekor qiling.',LOYALTY_POSTING_INVALID:'Ball operatsiyasi yakunlanmadi. Original savdo holatini tekshiring.',LOYALTY_CURRENCY_UNSUPPORTED:'Bonus siyosati UZS uchun ishlaydi.',LOYALTY_OFFLINE_UNAVAILABLE:'Ball sarflash uchun onlayn tasdiq kerak.',LOYALTY_SOURCE_UNSUPPORTED:'Bu original chek bonus sarflashni qo‘llamaydi.',LOYALTY_CUSTOMER_CHANGED:'Mijoz kartasi o‘zgardi. Tanlovni yangilang.',POINT_WALLET_TOO_LARGE:'Ball manbalari hajmi chegaradan oshdi. Administrator bilan tekshiring.'};
export function loyaltyDatabaseError(error:unknown):AccessError|null{
 if(!(error instanceof Prisma.PrismaClientKnownRequestError)&&!(error instanceof Prisma.PrismaClientUnknownRequestError))return null;
 const text=error instanceof Prisma.PrismaClientKnownRequestError?String(error.meta?.database_error??error.meta?.message??error.message):error.message;
 const code=text.match(/(?:message: "|ERROR:\s*)(POINTS_BALANCE_CHANGED|LOYALTY_SALE_CHANGED|LOYALTY_POSTING_INVALID|LOYALTY_CURRENCY_UNSUPPORTED|LOYALTY_OFFLINE_UNAVAILABLE|LOYALTY_SOURCE_UNSUPPORTED|LOYALTY_CUSTOMER_CHANGED|POINT_WALLET_TOO_LARGE)(?:"|\s|$)/)?.[1];
 if(code)return new AccessError(409,code,messages[code]);
 const gift=text.match(/(?:message: "|ERROR:\s*)(GIFT_UNAVAILABLE|GIFT_ISSUE_INVALID|GIFT_VALIDITY_INVALID|GIFT_PROOF_REQUIRED|GIFT_CASH_REFUND_DENIED|GIFT_SALE_REQUIRED|GIFT_SOURCE_INVALID|GIFT_IMMUTABLE)(?:"|\s|$)/)?.[1];
 if(gift)return new AccessError(409,gift,'Sertifikat muddati, qoldig‘i va original shartlarini tekshiring. Yangi pul amalini yuborishdan oldin original natijani tekshiring.');
 const benefit=text.match(/(?:message: "|ERROR:\s*)(CARD_UNAVAILABLE|PROMO_UNAVAILABLE|PROMO_USE_LIMIT|PROMO_MIN_AMOUNT|PROMO_STORE_UNAVAILABLE|PROMO_STACKING_DENIED|LOYALTY_POLICY_CHANGED|LOYALTY_ACTOR_CHANGED|LOYALTY_REGISTRY_PROOF_REQUIRED|LOYALTY_REGISTRY_IMMUTABLE)(?:"|\s|$)/)?.[1];
 return benefit?new AccessError(409,benefit,'Karta/promo original qoidasi, mijoz va chek holatini tekshiring.'):null;
}
