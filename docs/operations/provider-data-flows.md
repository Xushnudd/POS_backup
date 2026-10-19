# Ma’lumot oqimlari va provayderlar reyestri

LEG-01.06ning **joriy core oqimlari inventarizatsiyasi** yakunlandi. Mashina o‘qiydigan asosiy reyestr: `ops/privacy/data-flows.json`. Bu kelajakdagi hosting/shartnoma/region tasdig‘i yoki vendor integratsiyasi bajarildi degani emas. Haqiqiy staging/production, SMS/e-mail, Click, fiskal va hardware bandlari o‘z holatida qoladi.

2026-10-16 kod auditi: payment/fiscal registry va SMS/e-mail provider ro‘yxati bo‘sh; faol uchinchi tomon adapteri **0**. Lokal konfiguratsiyada APP_ORIGIN loopback HTTPS, API default nisbiy `/api`; maxfiy qiymatlar dalilga chiqarilmagan. Tashqi rasm hostiga avtomatik so‘rovlar egasining tasdig‘i bilan yopildi. Oldingi tashqi URLlar tarixiy metadata sifatida saqlanadi.

| Oqim | Uzatiladigan maydonlar va maqsad | Joylashuv / retention / shartnoma |
| --- | --- | --- |
| Brauzer → first-party POS backend | HttpOnly session cookie, vakolatli tenant API DTOlari: katalog, savdo, mijoz, qoldiq va hisobot; ichki normalizatsiya qilingan rasm | Tekshirilgani — lokal workstation/test Docker. Production operator/region/hosting shartnomasi tanlanmagan. Tenant retention konfiguratsiyasi va alohida backup tartibi; avtomatik qaytarib bo‘lmas o‘chirish yo‘q |
| Shaxsan elektron chek | Original receiptNo/time, saqlangan merchant/branch, item name/unit/quantity/price/discount/line total, subtotal/discount/tax/total/currency, original inbound payment type/amount. Capability identity va maxfiy qism fragment hamda JSON POSTda | First-party. Egasi 2026-10-16 tasdiqlagan kanal. TTL1soat, grant/revoke audit, key-removal va restore fence. Tokenning o‘zi DB/logda saqlanmaydi; snapshot/hash/history tenant retentionga kiradi |
| Shaxsan xizmat eslatmasi/ko‘chirma | Alohida rozilikdagi customer name; merchant/currency/timezone/as-of; debt/overdue/upcoming/no-due/unallocated; ledger date/due/receipt/source type/amount/balance; capability identity | First-party. Egasi 2026-10-16 tasdiqlagan kanal. Worker faqat tayyorlaydi, yetkazildi demaydi. TTL≤1soat; nashr va ochishda amaldagi rozilik/karta reviziyasi; restore fence. Job/history avtomatik o‘chirilmaydi |
| Eski tashqi rasm URLlari | **Uzatilmaydi.** Yangi HTTP(S)/protocol-relative assignment API va DBda rad; UI/CSP avtomatik yuklamaydi. Ichki `/api/files/{uuid}` ishlaydi | Approved image vendor yo‘q. Eski URL matni saqlangan, remote host region/retention/shartnoma tasdiqlanmagan va faollashtirilmagan |
| Click / PaymentProvider | **Real uzatish yo‘q.** Ichki boundary operationId, organizationId, business identity, amount/currency va mavjud bo‘lsa external identity | Click tanlangan, API/sandbox/region/retention/shartnoma hali tasdiqlanmagan. Boundary haqiqiy vendor request formati emas; PAN/CVV uchun field yo‘q |
| Fiskal / E-POS | **Real uzatish yo‘q.** Ichki operationId/documentId va business identity | Provayder/model/protokol/region/retention/shartnoma tanlanmagan. Taxminiy endpoint/payload yo‘q |
| SMS / e-mail / Telegram marketing | **Real uzatish yo‘q.** Ichki auth boundary purpose/destination/ephemeral secret/expiresAt; marketing va service consent alohida | Provider/sender/region/retention/shartnoma tanlanmagan. Unavailable javobi; production mock tasdiqlash yo‘q. Shaxsan xizmat kanali SMS roziligi o‘rniga ishlatilmaydi |
| Printer / Scale / Scanner / CashDrawer | **Vendor uzatish yo‘q.** Faqat ichki interfeys va standart browser amallari | Model/transport/SDK/region/shartnoma tasdiqlanmagan; apparat sinovi deb ko‘rsatilmaydi |
| Hosting / off-site backup / monitoring | **Tashqi upload yoki on-call jo‘natish yo‘q.** Lokal backup DB+manifestni GPG shifrlaydi; monitoring safe request/tenant/operation/status/duration metadata | Haqiqiy hosting/storage/monitoring region, retention, contract va mas’ullar tayinlanmagan. Recovery private key receiverga yuborilmaydi. Real off-host/on-call qabuli ochiq |

Mijoz telefon/e-maili, xodim nomi, actor/session ID, yozuv izohi, cost yoki maxfiy token public chek DTOsiga qo‘shilmaydi. Ko‘chirma mijozning alohida roziligi asosida ismi va moliyaviy qatorlarini ko‘rsatadi; telefon, xodim ismi, ichki izoh va session/credential chiqarilmaydi. Havola egasi uni boshqalarga berishi mumkinligi uchun operator faqat tegishli mijozga shaxsan taqdim etadi; umumiy e’lon kanali yo‘q.

Maxfiy kalit va rotation vakolati — application/deployment operatorining vazifasi. Hozir real provayder credentiali va production custodian tayinlanmagan. Mavjud authentication root keyda alohida purpose-domain HMAC qo‘llanadi; active/previous key rotationdan chiqqan capability qayta ochilmaydi. Private recovery/key custody haqiqiy deploydan oldin operator tomonidan tasdiqlanadi.

Tekshiruv:

```bash
node scripts/release/check-data-flows.cjs
node --test --test-isolation=none scripts/ops/data-flows.test.mjs
```

Gate `.env` yoki DBni ochmaydi. Ko‘rib chiqilgan transport, consent delivery, API origin, rasm validator/UI/CSP, public snapshot va service-worker manbalari hamda integratsiya papkasini SHA256 bilan bog‘laydi. Yangi adapter yoki boundary o‘zgarishi review talab qiladi. Hozirgi reyestrda approved bo‘lmagan uchinchi tomon adapterini active qilish rad etiladi. Bu ixtiyoriy obfuskatsiyalangan kod uchun universal network sandbox emas; source review va runtime egress siyosati saqlanadi.

Yangi provayder yoqilishidan oldin reyestrga aniq yuridik tomon/xizmat, uzatiladigan maydon/maqsad, source→receiver→subprocessor, geografik region, retention/o‘chirish tartibi, shartnoma/DPA reference, credential egasi/rotation/revocation va sandbox dalili kiritiladi. Zarur biznes/huquqiy asos alohida tasdiqlanadi. Hozircha bular o‘rniga uydirma qiymat yozilmagan.
