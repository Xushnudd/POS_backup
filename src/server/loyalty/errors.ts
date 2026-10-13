import {Prisma} from '@prisma/client';
import {AccessError} from '../auth/policy';
const messages:Record<string,string>={POINTS_BALANCE_CHANGED:'Ball qoldig‘i yoki siyosati o‘zgardi. Tanlovni bekor qilib, qayta ko‘rib chiqing.',LOYALTY_SALE_CHANGED:'Ball tanlovi savatga bog‘langan. Savatni o‘zgartirishdan oldin ball tanlovini bekor qiling.',LOYALTY_POSTING_INVALID:'Ball operatsiyasi yakunlanmadi. Original savdo holatini tekshiring.',LOYALTY_CURRENCY_UNSUPPORTED:'Bonus siyosati UZS uchun ishlaydi.',LOYALTY_OFFLINE_UNAVAILABLE:'Ball sarflash uchun onlayn tasdiq kerak.',LOYALTY_SOURCE_UNSUPPORTED:'Bu original chek bonus sarflashni qo‘llamaydi.',LOYALTY_CUSTOMER_CHANGED:'Mijoz kartasi o‘zgardi. Tanlovni yangilang.',POINT_WALLET_TOO_LARGE:'Ball manbalari hajmi chegaradan oshdi. Administrator bilan tekshiring.'};
export function loyaltyDatabaseError(error:unknown):AccessError|null{
 if(!(error instanceof Prisma.PrismaClientKnownRequestError)&&!(error instanceof Prisma.PrismaClientUnknownRequestError))return null;
 const text=error instanceof Prisma.PrismaClientKnownRequestError?String(error.meta?.database_error??error.meta?.message??error.message):error.message;
 const code=text.match(/(?:message: "|ERROR:\s*)(POINTS_BALANCE_CHANGED|LOYALTY_SALE_CHANGED|LOYALTY_POSTING_INVALID|LOYALTY_CURRENCY_UNSUPPORTED|LOYALTY_OFFLINE_UNAVAILABLE|LOYALTY_SOURCE_UNSUPPORTED|LOYALTY_CUSTOMER_CHANGED|POINT_WALLET_TOO_LARGE)(?:"|\s|$)/)?.[1];
 return code?new AccessError(409,code,messages[code]):null;
}
