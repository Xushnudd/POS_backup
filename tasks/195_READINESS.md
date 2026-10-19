# 195 maqsadining haqiqiy holati

2026-10-16. PLAN1da259 original band bor: **185 done,74 ochiq**.195ga yetish uchun yana **10 original band** to‘liq qabul qilinishi kerak. Ushbu qayta tekshiruv hech bir checkboxni o‘zgartirmadi va dastur kodiga tegmadi.

Ochiq holatlar:29 `blocked_external`,29 `deferred`,6 `in_progress`,10 `todo`. Barcha259 checkbox joriy STATUS jadvali bilan mos.74 bandning to‘liq ro‘yxati va to‘siqlari avvalgi [qabul to‘siqlari indeksida](190_BLOCKERS.md) saqlanadi; fayl nomidagi190 tarixiy maqsadni bildiradi.

Foydalanuvchi staging, mustaqil status hosti va pilot hali tayyor emasligini tasdiqlagan. Real provider/hardware implementatsiyalarini keyinga qoldirish, production deployment uchun alohida tasdiq hamda qaytarib bo‘lmaydigan o‘chirishni bajarmaslik cheklovlari o‘z kuchida. Yangi195 maqsadi bu cheklovlarni bekor qilmaydi.

## O‘nta original qabul uchun mumkin bo‘lgan yo‘l

Quyidagilar hali bajarilmagan. Bu ro‘yxat ularning original qabul mezonlarini almashtirmaydi; faqat kerakli kirish va natijani ko‘rsatadi. Haqiqiy ishtirokchilar va pilot bo‘lmaguncha ularni agentning o‘zi yakunlay olmaydi.

| Original band | Yetishmayotgan kirish va qabul natijasi |
| --- | --- |
| MKT-01.01 | Haqiqiy10–15 biznes egasi va5–10 kassir bilan suhbatlar, qaydlar va umumlashtirilgan talablar. |
| MKT-01.02 | Amaldagi kassada bir ish kunining kuzatuvi va jarayon/vaqt/muammo qaydlari. |
| MKT-01.03 | Bizneslarda haqiqatan ishlatiladigan qurilmalar, internet va provayderlar inventari; taxminiy model yozilmaydi. |
| MKT-01.04 | Eski tizimdan ko‘chishdagi to‘siqlar va mijozlar to‘lashga tayyor narx haqidagi real javoblar. Tasdiqlangan SaaS narxi bu tadqiqot natijasi o‘rniga o‘tmaydi. |
| MKT-01.05 | Suhbat/kuzatuv natijalariga asoslangan eng muhim besh muammo va mahsulot ustunligi. |
| MKT-01.06 | Kamida uch real pilot biznesning sinov doirasi va muvaffaqiyat mezonlari bo‘yicha kelishuvi. |
| BIZ-02.05 | Haqiqiy mijozning boshlang‘ich stock/debt/cash hisoblari bilan solishtirish, farqlarni hal etish va mijoz tasdig‘i. |
| BIZ-02.06 | Haqiqiy eski tizim uchun kelishilgan cutover sanasi, write-stop qaydi va duplicate posting yo‘qligi dalili. |
| OPS-04.01 | Pilotning haqiqiy katalog/savdo/kassa/request/peak o‘lchovlari va ular asosidagi test profili. Sintetik50k/1m/20 fixture bu kuzatuv o‘rniga o‘tmaydi. |
| RELEASE-01.09 | Import/opening/trening/onboarding qo‘llanmasini haqiqiy pilot foydalanuvchida tekshirish va natijalarini qayd qilish. |

Bu yo‘l vendor APIlarini taxmin qilishni talab qilmaydi. Mijoz ma’lumotlariga ruxsat, haqiqiy ishtirokchilar va har bandning to‘liq mezonlari baribir zarur. Real ishga tushirish uchun mavjud alohida deployment tasdig‘i talabi saqlanadi.

## Core bo‘yicha ochiq ishni yashirmaslik

**2026-10-17 yangilanishi:** BIZ-02.07 katta web eksporti PostgreSQL chunk storage bilan tayyorlandi; operator faylidan alohida, brauzer orqali1GiBgacha oqim va yopish prerequisite mosligi mavjud. Read-only/close/cancel core saqlanadi. Batafsil [serverga tayyorgarlik](SERVER_PREPARATION.md). Yakuniy retention/legal-hold/delete tasdig‘i alohida ochiq; original band hali185 hisobiga qo‘shimcha done bo‘lmadi. Quyidagi2026-10-16 test natijalari tarixiy; yangi natijalar alohida evidencega yoziladi.

## Shu davomda tekshirilgan dalillar

- Original259 ID,185 checkbox va joriy STATUS holatlari mosligi tekshirildi.
- Avvalgi `post185-fixes-20261016/validation.json`dagi barcha source/artefakt hashlari STATUSdagi joriy maqsad yangilanishidan **oldin** mos edi. Tarixiy protokol o‘zgartirilmadi; keyingi STATUS hash farqi ushbu hujjatdagi yangi maqsad bilan izohlanadi.
- `node scripts/release/check-service-targets.cjs` o‘tdi:636 source fayli uchun dalil mos; qidiruv p95309.31ms, checkout p95190.44ms, yakuniy0/200 va fizik0/300 xato. Bu avvalgi lokal o‘lchovning yangilanmagan kodga mosligini tekshirish, yangi yuklama sinovi yoki production SLA emas.
- `node scripts/release/check-claims.cjs` o‘tdi:44 matn,7 imkoniyat,9 dalil,5 sirt;0 muammo.
- `node scripts/release/check-data-flows.cjs` o‘tdi:9 oqim,13 source fayli,0 faol tashqi provider; production tekshirilgan deb hisoblanmaydi.
- `node scripts/i18n/catalog.cjs check` o‘tdi:960 yozuv,0 tekshirilmagan,0 yetishmagan.

Avvalgi457 PostgreSQL,168 unit,42 ops,11 security/status va10 Chromium natijalari tarixiy test protokolidir. Ushbu davomda ular qayta ishga tushirilmadi; dastur kodi o‘zgarmadi. `.env`, biznes bazasi, vendorlar va real deploymentga tegilmadi.

Mashina o‘qiydigan qayta tekshiruv: [original-plan-195-readiness-20261016.json](evidence/original-plan-195-readiness-20261016.json). Hozirgi natija **185/259;195 bajarilmagan**.
