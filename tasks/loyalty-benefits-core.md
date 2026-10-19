# CRM-02.03: karta, promo va sertifikat qoida mexanizmi

2026-10-14. Original band **in_progress**. Bu hujjat `done` qabul protokoli emas. Administrator siyosatidagi karta, promo va sertifikatni yoqish hanuz `LOYALTY_FEATURE_UNAVAILABLE` bilan rad etiladi. Real checkout, persistence va UI tayyor deb ko‘rsatilmaydi.

## Tayyor hisoblash qismlari

`src/server/loyalty/benefits.ts` serverdagi qulflangan chekdan olingan qatorlar uchun karta va promo taklifini hisoblaydi. Requestdan kelgan summa yoki mijoz narxi ushbu funksiyalarga ishonchli manba sifatida berilmaydi. `net` — oldingi chegirmalar hisobga olingandan keyingi qator summasi. Hozir bu modulga savdo endpointi ulanmagan.

- Promo filial va mahsulot cheklovlarini tekshiradi. Boshqa mahsulot summasi minimal xarid shartiga yoki chegirma bazasiga kirmaydi.
- Global va mijoz limitlari, administrator ruxsat bergan stacking, boshlanish va tugash sanalari tekshiriladi. Tugash vaqti intervalga kirmaydi. Noto‘g‘ri sana rad etiladi.
- Kartada faol holat, chek mijoziga tegishlilik va original amal qilish intervali tekshiriladi. Yangi siyosat eski karta muddatini o‘z-o‘zidan uzaytirmaydi.
- Decimal bilan hisoblangan chegirma mavjud `allocateMoney` orqali qatorlarga tarqatiladi. Qator chegirmalari yig‘indisi aynan chek chegirmasiga teng; mahsulotlar qamrovidan tashqariga pul tarqatilmaydi.
- Quote foydalanishni band qilmaydi. Parallel checkoutda foydalanish limitini tranzaksion ravishda yana tekshirish majburiy.

`src/server/loyalty/gift-ledger.ts` original chiqarish shartlari va ketma-ket jurnal yozuvlaridan sertifikat majburiyatini solishtiradi:

| Amal | Majburiyat | Naqd harakat | Ushbu jurnalning tovar daromadi |
| --- | --- | --- | --- |
| Chiqarish | oshadi | kirim | 0 |
| Tovarga sarflash | kamayadi | 0 | 0; tovar daromadi original savdoda |
| Original sarflashni qaytarish | oshadi | 0 | 0; original qaytarish o‘z hujjatida |
| Ruxsat etilgan ishlatilmagan pulni qaytarish | kamayadi | chiqim | 0 |

Sertifikat muddati tugashi qarzdorlikni yoki naqd pulni avtomatik o‘zgartirmaydi. Qaytarish original sarflashga bog‘lanadi va uning qaytarilmagan summasidan oshmaydi. Qaytarilgan qiymat original muddatni uzaytirmaydi; muddati tugagan sertifikatdagi qaytarilgan majburiyat sarflanadigan qoldiqka aylanmaydi. Ikki bir xil entry/operation, qaytarishning begona manbasi, ortiqcha sarflash, noma’lum pul formati, tartibsiz yoki kelajakdagi jurnal rad etiladi. Cash refund original chiqarish qatoriga bog‘langan va original administrator shartidagi ruxsatga muhtoj. Avtomatik write-off yoki breakage daromadi yo‘q.

## Tugallanish uchun qolgan majburiy ishlar

1. Karta, promo, sertifikat va ularning immutable source/journal yozuvlarini Prisma va yangi append-only migrationda saqlash. Applied168–173 fayllar o‘zgartirilmaydi.
2. Har bir yozuv uchun tenant, faol actor, filial/kassa/smena, native FK va audit proof; read-only guard; eksport klassifikatsiyasi va yangi fingerprint.
3. Checkoutda policy version, original cart snapshot, karta/mijoz, promo scope/usage va sertifikat balansini qulflab qayta tekshirish. Idempotency qayta kelganda original natija qaytariladi; foydalanish ikkinchi marta sarflanmaydi.
4. Karta/promo/points birga qo‘llanganda qator va chek chegirmalarini izchil saqlash, mavjud kassir discount limitlarini bajarish. Hozirgi points snapshot himoyasini chetlab o‘tish mumkin emas.
5. Sertifikatni moliyaviy kirim va majburiyatga atomik bog‘lash. Mavjud customer advance endpointlari sertifikat limitini yoki muddatini chetlab o‘tmasligi kerak. Eski advance yozuvlari sertifikat deb qayta belgilab chiqilmaydi.
6. Goods refund va cash refund uchun original manbalarni bog‘lash: aynan bir qaytarish ham naqd payout, ham sertifikat restore bilan ikki marta qoplanmasin. Original soliq va revenue hujjatlari o‘zgarmaydi.
7. Owner sozlamalari, chiqarish/revoke, kassir tanlovi/consent, aniq summa va foydalanish tarixi uchun ishlaydigan UI/API. Ulanmagan funksiyalarning policy guardi faqat shu ishlar to‘liq qabul qilingandan keyin olib tashlanadi.
8. Haqiqiy lokal PG parallel sarflash, original/replay, expiry, tenant/role, fault rollback, partial/final refund va restore testlari; uch brauzer checkout/lost-ACK. Pure test bu dalillar o‘rniga o‘tmaydi.

Yangi servis yoki tashqi vendor qo‘shilmadi. Bu ishlar mavjud TypeScript/Zod/Prisma/PostgreSQL/Decimal va tranzaksiya/idempotency mexanizmlari bilan davom ettiriladi.
