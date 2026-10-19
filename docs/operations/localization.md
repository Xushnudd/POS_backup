# Interfeys tillari: o‘zbek lotin va rus

`UX-01.02` mavjud JSON dictionary, TypeScript, React Context va `Intl` bilan bajariladi. Qo‘shimcha tarjima kutubxonasi yoki URL prefiksi kerak emas. Operator sarlavhadagi yoki ochiq modal ichidagi `UZ / RU` tanlovidan foydalanadi. Kirish sahifalari va internet uzilgandagi mustaqil kassa ekranida ham tanlov mavjud.

## Til va ma’lumot chegarasi

- `pos_locale` cookie va localStorage faqat ko‘rinish tilini saqlaydi. Faqat `uz` va `ru` qabul qilinadi; boshqa qiymat `uz`ga qaytadi. Cookie sessiya, rol yoki tashkilotni aniqlamaydi. HTTPSda `Secure`, barcha muhitlarda `SameSite=Lax`, bir yil muddat ishlatiladi.
- SSR har so‘rov cookiesidan alohida til oladi. Serverda umumiy o‘zgaruvchan locale yo‘q. Metadata, HTML `lang`, manifest va boshlang‘ich React tili shu afzallikka mos keladi.
- Til almashtirish navigatsiya yoki workspace remount qilmaydi. Telefon/parol qoralamasi, savat, tanlangan manba, modal, sana inputi, naqd summa, idempotency kaliti va yuborilishi kutilayotgan original body qayta yozilmaydi. Reload odatdagi credential tozalash siyosatini saqlaydi.
- Mahsulot, mijoz, tashkilot va xodim ismlari, SKU/barkod, izoh, original rekvizit va saqlangan hujjat matnlari tarjima qilinmaydi. Masalan, `Saqlash` nomli mahsulot rus interfeysida ham `Saqlash` bo‘lib qoladi. DOM yoki barcha stringlarni umumiy almashtirish taqiqlanadi.
- API machine code, status qiymati, URL/query, permission nomi va JSON request/response contracti o‘zgarmaydi. Interfeysda ruxsatli enumning faqat ko‘rinadigan yorlig‘i tarjima qilinadi.

## Matn qo‘shish tartibi

1. `src/dictionary/ui.uz.json` va `ui.ru.json`ga bir xil kalit bilan mazmunli ikkita matn qo‘shing. Mavjud kalitlar o‘zbekcha manba matndir; yozilishi va apostrofi aniq mos bo‘lishi kerak.
2. Client renderda `useTranslation().t(key, values)` ishlating. `{amount}` kabi nomlangan slotlar ikki tilda bir xil bo‘lsin. Yetishmayotgan kalit yoki slot jim yashirilmaydi.
3. Hookning localega bog‘langan funksiyalarini ishlating. Ushbu loyihadagi React Compiler uchun render ichida global `document.lang` o‘qiydigan o‘zgarmas funksiya eski tilni memoizatsiya qilishi mumkin. Server va mustaqil generatorga locale ochiq parametr sifatida uzatiladi.
4. Statik label/option/help jadvallari `localizeOwnedLabels` yoki aniq typed label orqali ko‘rsatiladi; yangi statik jadvalni `scripts/i18n/owned-tables.json`ga kiriting. Ularning `value`, `href`, permission va boshqa machine maydonlari tarjima qilinmaydi.
5. `node scripts/i18n/catalog.cjs check` va typecheckni bajaring. Katalog JSX, display atributlari/ifodalar, canonical UI xabarlari, ro‘yxatga kiritilgan 39 ta label jadvali va static PWA annotatsiyalarini tekshiradi. Bu runtime foydalanuvchi ma’lumotini yoki ixtiyoriy tashqi diagnostikani tarjima qilish mexanizmi emas. `apply` faqat ikkala tilda ko‘rib chiqilgan kalitlarni ishlatadi; o‘zgarishni review qiling.

## Pul, miqdor va sana

`src/i18n/format.ts` display projection hisoblanadi. Pul avval mavjud exact fixed-point yordamchi orqali BigInt minor birlikka olinadi, so‘ng `Intl.NumberFormat` bilan guruhlanadi. `formatToParts` orqali minglik ajratgich har ikkala tilda oddiy bo‘shliqqa keltiriladi: Node va brauzer ICU versiyasi farq qilsa ham `249 000` ko‘rinishi saqlanadi. `9007199254740993.01` kabi Number safe integerdan katta decimal string ham yo‘qotilmaydi. UZ ko‘rinishi `12.50 so‘m`, RU ko‘rinishi `12,50 сум`. Moliyaviy hisoblash serverning mavjud Decimal contractida qoladi.

Formalar va requestlar canonical nuqtali decimalni saqlaydi: `12.50`, `0.125`; RU input yordam matni shu talabni tushuntiradi. Yetakchi nolli barkod stringligicha qoladi. Ko‘rinadigan umumiy quantity formatter mavjud uch xonali aniqlikni saqlaydi; original source/unit-conversion ma’lumoti alohida o‘z aniqligida ko‘rsatiladi.

Sana Gregorian/lotin raqamlari bilan formatlanadi. Instant, hujjatning branch timezone snapshoti, ISO input va report cutoff/filter chegarasi tilga qarab qayta hisoblanmaydi. Eski hujjat original vaqt zonasi bilan ko‘rsatiladi.

## Xatolar va recovery

`ApiError`ning original message/code/status/details/requestId qiymatlari saqlanadi. UI chegarasi `src/i18n/errors.ts` va ruxsatli `error-guidance.ts` orqali ikki tildagi foydali xabarni ko‘rsatadi. Unknown native browser xatosi callerning ko‘rib chiqilgan fallbackiga o‘tadi; stack yoki credential chiqarilmaydi. Diagnostic request ID tarjima qilinmaydi. Canonical status xabari ko‘rinishda tarjima qilinadi, durable bodyga locale yozilmaydi.

Global/dashboard xato chegaralari va 404 ham tarjima qilinadi. Next 16.3.8 error boundary uchun o‘rnatilgan hujjatlardagi `retry` prop ishlatiladi. Recovery tugmasi savdo/to‘lovni yangidan yuborish degani emas: noaniq javob uchun original amal natijasini tekshirish tartibi saqlanadi.

## Chek va offline

Sale chekidagi yorliqlar, pul va sana tanlangan tilda; original organization/branch/cashier/footer snapshoti saqlanadi. Brauzer print so‘rovi javobsiz qolsa, original operation ID, qog‘oz kengligi, copy belgisi, locale va markup bir urinish sifatida saqlanadi. Real printer tasdig‘i da’vo qilinmaydi. Return HTML cheki alohida pure generator orqali tarjima qilinadi va original ismlar/izohlar escape qilinadi.

`src/offline/static-locale.ts` faqat `data-i18n` bilan belgilangan owned elementlarni tarjima qiladi. `cash-screen.ts` tanlangan lease, unlock inputi, tender va original encrypted ticketni saqlaydi. Cookie afzalligi bo‘lmasa localStorage afzalligi ishlaydi; storage yopiq bo‘lsa joriy sahifada til o‘zgartirish ishlashda davom etadi.

`node scripts/build-offline.cjs` ayni dictionary va formatterdan public ES modullarni yaratadi. Service worker `shuni-public-shell-v4` ostida faqat 12 ta ochiq shell assetini cache qiladi. Authenticated HTML, API, chek, private fayl va financial ma’lumotlar umumiy cachega kiritilmaydi. `skipWaiting`/`clients.claim` bilan faol kassani majburiy yangilash yo‘q. Source/dictionary o‘zgargach offline assetlarni qayta generatsiya qiling.

`RELEASE-01.12` davomida topilgan Node/brauzer pul formatlash farqining tuzatishi public formatterga ham tarqalishi uchun cache versiyasi `v3`dan `v4`ga ko‘tarildi. Yangi worker odatdagi xavfsiz activationni kutadi; faollashganda faqat eski `shuni-public-shell-*` cachelarini, jumladan `v3`ni o‘chiradi. Joriy `v4` va boshqa ilovalar cachelari saqlanadi. Bu keyingi tuzatish avvalgi `localization-20261015.json` qabul dalilini qayta yozmaydi; uning tekshiruvi `RELEASE-01.12` dalillarida alohida ko‘rsatiladi.

## Tekshirish va dalil

`tests/localization.unit.test.ts` dictionary/slot parity, exact decimal, timezone, API error diagnostikasi, source-owned label chegarasi, return HTML/XSS va katalogni ikki marta qo‘llashni tekshiradi. `tests/e2e/localization.spec.ts` uch native brauzerda SSR afzalligi, credential qoralamasi, offline encrypted ticket va real local cash savdoda til almashish/yo‘qolgan ACKni tekshiradi. Savdo DB, bitta payment/movement, canonical quantity/tender/change va original pending body bilan solishtiriladi. Sintetik offline ticket real hardware yoki production issuance dalili sifatida talqin qilinmaydi.

Yakuniy qabul natijasi, aniq buyruqlar, screenshotlar, source/log SHA va cheklovlar `tasks/evidence/localization-20261015.json`da saqlanadi. Bu lokal core qabulidir; tashqi vendor, hosting, real printer/fiskalizatsiya va pilot tasdiqlari alohida qoladi.
