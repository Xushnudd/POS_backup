# Ommaviy va’dalar va qabul dalillari

`RELEASE-01.12` ommaviy sahifadagi va’dalar ayni nomzod versiyada ishlaydigan imkoniyatga mos bo‘lishini tekshiradi. Bu band real pilot, server yoki production deployment tasdig‘i emas. Ularga tegishli original bandlar va egasining alohida deployment tasdig‘i saqlanadi.

## Qaysi matn tekshiriladi?

`src/release/public-copy.ts` sahifa, navigatsiya, tarif izohlari, footer, HTML metadata, manifest tavsifi va til almashtirilgandagi hujjat sarlavhasining44 ta source-owned matnini belgilaydi. Har kalit mavjud Uz/Ru dictionaryning typed kalitidir. Brend nomi identifikator; administrator kiritgan tarif nomlari va joriy DB qiymatlari foydalanuvchi ma’lumoti sifatida saqlanadi.

`tasks/release/PUBLIC_CLAIMS.json` mijozga yuborilmaydigan review xaritasidir. Har matn `claim`, `boundary` yoki `neutral` sifatida ko‘rib chiqilgan. Yetti imkoniyat guruhi mavjud: savdo/qaytarish/mijoz hisobi, tenant/filial vakolatlari, katalog/ombor/xarid, smena/hisobot, obuna, browser/ichki chek va onboarding. Har guruhda qabul qilingan original PLAN1 IDlari, immutable dalil fayllari va tekshirilgan xizmat/test manbalarining SHA256lari bor.

Oldingi dalillar o‘z doirasi bilan ishlatiladi. Masalan, BIZ-02.07 retention/read-only core dalili butun yopish/o‘chirish bandi qabul qilingan degani emas. Ichki58/80mm browser nusxasi POS-02.09dagi elektron yetkazish tugaganini anglatmaydi. Yangi `public-claims-core-20261015.json`100 ta haqiqiy isolated PostgreSQL holatini, jumladan onboarding va katalog importini alohida qayd qiladi.

## Tarif va mavjudlik

Narx, valyuta, filial/kassa/xodim limiti, trial tarifi va trial/grace kunlari DBning joriy versiyasidan olinadi. Ommaviy configuration cache60 soniya; invoice joriy versiyani alohida tekshiradi. Sahifa narx yangilanishi darhol ko‘rinishini yoki qat’iy abadiy trial muddatini va’da qilmaydi.

Tarif o‘qilishi muvaffaqiyatsiz bo‘lsa, narx kartalari va trial va’dasi chiqarilmaydi; xabar va oddiy ro‘yxatdan o‘tish havolasi ko‘rsatiladi. Faol trial bo‘lmagan konfiguratsiyada ham CTA “Ro‘yxatdan o‘tish” bo‘ladi. Tarif nomi tarjima qilinmaydi va HTML sifatida bajarilmaydi.

Pul `BigInt` va `Intl.formatToParts` bilan ko‘rsatiladi. ICU versiyalari o‘zbekcha minglik ajratgichini har xil tanlashi mumkin; faqat `group` qismlari bir xil bo‘shliqqa normallashtiriladi. SSR, browser va standalone offline ekran shu formatterdan foydalanadi. Minor birliklar, canonical request sonlari va moliyaviy hisoblash o‘zgarmaydi.

## Chegaralar ko‘rinadigan bo‘lishi kerak

Karta/bank yozuvi qo‘lda tasdiqlanishi, chekning fiskal bo‘lmagan browser nusxasi ekanligi, real Click/fiskal/E-POS ulanmaganligi va real hardware modellari tasdiqlanmaganligi ochiq yoziladi. Browser engine testi aniq printer, tarozi yoki boshqa model sertifikati emas. To‘liq offline to‘lov kafolati, cheksiz limit, uydirma mijozlar soni yoki rasmiy tasdiqlanmagan SLA reklama qilinmaydi.

## CI va o‘zgarish tartibi

`npm run release:claims:check` faqat o‘qiydi. U quyidagilarda xato beradi:

- Ro‘yxatsiz matn, dinamik public-copy kaliti yoki yangi ko‘rib chiqilmagan public komponent importi paydo bo‘lsa.
- Matnning istalgan tildagi review hashi yoki besh public render manbasining fingerprinti o‘zgarsa.
- Tarjima, locale, pul formatteri yoki exact-money yordamchisining ko‘rib chiqilgan runtime manbasi o‘zgarsa.
- Va’da qabul qilinmagan original bandga bog‘lansa, dalil yetishmasa yoki hash mos kelmasa.
- Tegishli iqtisodiy xizmat/test manbasi attested versiyadan o‘zgarsa.
- Zarur cheklov matni renderdan olib tashlansa yoki eski faol bo‘lmagan marketing dictionary qayta import qilinsa.

Yangi matn qo‘shishda uning ma’nosini, mavjud funksiyani, qabul bandlarini va doirasini review qiling. Typed copy va ikki tarjimani yangilang; mos haqiqiy testni bajaring va yangi dalilni saqlang; keyin review xaritasini aniq yangilang. Eski qabul faylini yangi natijaga moslab qayta yozmang. CI avtomatik “approve/update hashes” qilmaydi. SHA tekshiruvi matnning ma’nosini o‘zi isbotlamaydi: capability mapping va dalil doirasini reviewer tekshiradi.

## Qayta tekshirish

Node unit sinovlari reviewga kiritilmagan va’da, o‘zgargan ruscha matn, qalbaki hash, deferred band, o‘zgargan biznes manbasi va olib tashlangan cheklovni rad etadi. React SSR holatlari null/bo‘sh/no-trial tarif va escape qilingan `Saqlash` nomini tekshiradi.

`public-claims.spec.ts` haqiqiy lokal HTTPS sahifasini ikkala tilda DB qiymatlari, metadata va manifest bilan solishtiradi; generatsiya qilingan `/pwa/format.js` ham uch browser engineda bajariladi. Public-only worker cache v4 yangi formatter assetini oladi; faol kassaga majburiy takeover qilinmaydi, private cache qo‘shilmaydi.

`public-pricing-failure.spec.ts` **alohida fresh test serverida** ishlatiladi: isolated DBdagi `BillingPlan` jadvali transaction locki ostida haqiqiy o‘qish timeoutiga uchraydi. Ikkala tilda taxminiy narx/trial chiqmasligi tekshiriladi; transaction tugashi lockni olib tashlaydi, tariflar o‘zgartirilmaydi. Default Playwright config bu faylni chiqarib tashlaydi; `npm run test:e2e` odatiy cohort tugagach `playwright.pricing-failure.config.ts` orqali yangi server bilan alohida ishga tushiradi. Faqat shu holat uchun buyruq: `npx playwright test --config=playwright.pricing-failure.config.ts`. Uni oldin muvaffaqiyatli public-pricing so‘rovi ishlagan serverga qo‘shmang:60s cache xizmatning to‘g‘ri mavjud xususiyatidir.

Yakuniy versiya, buyruqlar, natijalar va hashlar `tasks/evidence/public-claims-release-20261015.json`da saqlanadi. Faqat local production-mode build va isolated DB sinovlari; real publish yoki deployment bajarilmaydi.
