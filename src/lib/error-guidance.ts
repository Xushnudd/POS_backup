export type ErrorGuidance={message:string;nextAction:string}
const guidance:Record<string,ErrorGuidance>={
 UNAUTHORIZED:{message:'Sessiya tugagan.',nextAction:'Qayta kiring. Kutilayotgan amalni yangi kalit bilan takrorlamang.'},
 SESSION_CHANGED:{message:'Sessiya yoki vakolat o‘zgargan.',nextAction:'Qayta kiring va asl amal natijasini tekshiring.'},
 FORBIDDEN:{message:'Bu amal uchun vakolatingiz yo‘q.',nextAction:'Biznes egasi yoki rahbarga murojaat qiling.'},
 MANAGER_REQUIRED:{message:'Bu amalni rahbar bajarishi kerak.',nextAction:'Rahbar tasdig‘ini oling; boshqa hisob parolini so‘ramang.'},
 VALIDATION_ERROR:{message:'Kiritilgan ma’lumotlar noto‘g‘ri.',nextAction:'Belgilangan maydonlarni tekshiring. Xato so‘rov pul yoki qoldiqni o‘zgartirmaydi.'},
 INVALID_PAGINATION:{message:'Sahifa yoki qatorlar soni noto‘g‘ri.',nextAction:'Sahifa kamida1, limit1–200 bo‘lsin.'},
 INSUFFICIENT_STOCK:{message:'Yetarli qoldiq yo‘q.',nextAction:'Qoldiq va savat miqdorini tekshiring; rahbar bilan eski urinishni hal qiling.'},
 TAX_CHANGED:{message:'Soliq siyosati qoralama yaratilgandan keyin o‘zgargan.',nextAction:'Asl savdo natijasini tekshiring; eski qoralamani serverda bekor qilib, yangi narx/soliq hisobini qayta tasdiqlang.'},
 TAX_OR_TOTAL_CHANGED:{message:'To‘lov previewidagi soliq yoki jami summa eskirgan.',nextAction:'To‘lov yuborilmadi; server hisobini qayta oling va tasdiqlang.'},
 TAX_PROFILE_UNAVAILABLE:{message:'Faol, kuchga kirgan soliq siyosati topilmadi.',nextAction:'Tashkilot egasi mahsulotning soliq profili va sanasini tekshirsin; tayyor bo‘lmaguncha savdoni yakunlamang.'},
 TAX_EFFECTIVE_DATE:{message:'Soliq stavkasining sanasi avvalgi tarixni o‘zgartiradi.',nextAction:'Oxirgi versiyadan keyingi hozirgi/yangi sanani kiriting; eski versiyani o‘zgartirmang.'},
 PRICE_CHANGED:{message:'Savatdagi narx o‘zgargan.',nextAction:'Joriy narxni ko‘rib, savatni qayta tasdiqlang.'},
 CONCURRENT_CONFLICT:{message:'Parallel amallar to‘qnashdi.',nextAction:'Asl amal kaliti bilan natijani tekshiring yoki qayta urinib ko‘ring.'},
 NETWORK_ERROR:{message:'Server bilan ulanish uzildi; amal natijasi noma’lum.',nextAction:'Internetni tiklang va asl amal natijasini tekshiring. Yangi kalit bilan qayta yubormang.'},
 NOT_FOUND:{message:'Resurs topilmadi yoki unga kirish yopiq.',nextAction:'Tanlangan biznes/filialni tekshiring va ro‘yxatni yangilang.'},
 PAYLOAD_TOO_LARGE:{message:'So‘rov hajmi ruxsat etilgan chegaradan katta.',nextAction:'So‘rovni1MiBdan kichik yoki importni kichik guruhlarga ajrating.'},
 RATE_LIMITED:{message:'So‘rovlar juda ko‘p.',nextAction:'Ko‘rsatilgan muddatni kuting; iqtisodiy amal kalitini saqlang.'},
 INTERNAL_ERROR:{message:'Server amalni yakunlay olmadi.',nextAction:'Asl natijani tekshiring. So‘rov raqamini yordam xizmatiga bering; maxfiy ma’lumot yubormang.'},
}
export function errorGuidance(code:string,message?:string):ErrorGuidance{
 return guidance[code]??{message:message??'Amalni bajarib bo‘lmadi.',nextAction:'Savat va amal holatini saqlang, sababni tekshiring va zarur bo‘lsa rahbarga murojaat qiling.'}
}
