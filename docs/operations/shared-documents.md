# Shaxsan beriladigan chek va qarz ko‘chirmasi

Egasi 2026-10-16da ikki kanalni alohida tasdiqladi: savdo chekining QR/havolasini mijozga shaxsan berish va alohida service consent bilan qarz eslatmasini shaxsan berish. SMS/e-mail/Telegram yoki hardware adapteri yoqilmagan. Real mijozga taqdim etish/pilot dalili sifatida sintetik test ko‘rsatilmaydi.

## Elektron chek — POS-02.09

Savdo cheki oynasida mijozning shaxsan olish roziligini belgilang, amalni ko‘rib tasdiqlang. Bir soatlik havola va QR chiqadi. `Yangilash`, sahifalash va `Havolani bekor qilish` mavjud. 20tadan oshgan tarixdagi havolalar ham boshqariladi. Noma’lum ACKda aynan original kalit bilan tiklanadi; browser durable ACKda bearer URL saqlanmaydi, faqat amal metadatasi saqlanadi.

- POST `/api/sales/{id}/receipt-links`: `{operationId,consent:true}`; faqat authorized sale scope. Original summa/rekvizit serverdan olinadi, klient receipt HTML yoki narx yubormaydi.
- GET shu endpoint `?page=1`: 20ta global tartiblangan yozuv, total/pages, amaldagi link/QR. Eski, bekor qilingan, keyi yo‘q yoki restore’dan oldingi link faol ko‘rsatilmaydi.
- DELETE shu endpoint: `{operationId:<asl share kaliti>}`; idempotent revoke va audit. Security revoke obuna read-only davrida ham ruxsatli.
- `/r#organizationId.operationId.capability`: public sahifa. Maxfiy qism HTTP URL/query/access logiga kirmaydi. U JSON POST `/api/receipt-view` orqali, cookie yubormasdan tekshiriladi. URLni qayta ochish TTL ichida mumkin; revoke/expiry/restore/key-removal keyingi o‘qishni bloklaydi.

Token 256bit HMAC capability; serverda faqat hash/key fingerprint va immutable minimal snapshot bor. Grant/revoke append-only Operation + o‘sha transactiondagi live actor/session audit proof bilan himoyalangan. Native trigger posted source/tenant/raqam/summani tekshiradi; snapshot/history tahriri rad. Chekda mijoz telefoni, xodim ismi, tannarx yoki credential yo‘q. Legacy original identity yo‘q bo‘lsa joriy tashkilot nomi bilan backfill qilinmaydi.

58/80mm original browser receipt va elektron nusxa bir xil original summalarni ko‘rsatadi; nusxa belgili. Takror print/link/revoke Sale/Payment/Stock yaratmaydi. Bu fiskal chek emas va jismoniy printer ishlagani tasdiqlanmaydi. Katta snapshot limitdan oshsa butun amal rad; yashirin truncation yo‘q. Grant/revoke va snapshot tarixining saqlanishi tenant retention siyosatiga kiradi, expiry avtomatik tarix o‘chirish emas.

## Xizmat eslatmasi — CRM-02.02

Tashkilot egasi mijoz kartasida `Xizmat eslatmasi roziligi` va `Shaxsan taqdim etish` kanalini, manba/dalil/policy versiyasini qayd qiladi. Eslatmalar kartasini yangilab `Ko‘chirmani tayyorlash navbatiga qo‘yish`ni tasdiqlaydi. Mavjud jobs worker ko‘chirmani tayyorlaydi. `succeeded` — **tayyorlandi**; mijozga yetkazilganlik emas, API `in_person_not_confirmed` deydi.

- GET/POST `/api/customers/{id}/reminders`: owner-only scoped list yoki `{operationId,consentEventId}` bilan navbat.
- Shu customer + consent event + tashkilotning mahalliy kuni uchun native unique index takror queue’ni to‘xtatadi. Original key replay yangi job yaratmaydi.
- Oddiy `jobs` worker mavjud durable lease/generation/fencing va source Session authorizationni ishlatadi. Parallel yoki eski worker faqat bitta snapshot/eventni publish qiladi. Vendor yoki tarmoq chaqiruvi yo‘q.
- Due/overdue hisob mavjud source-linked debt/return/collection algoritmiga tayangan: `dueAt < asOf` overdue; tengligi upcoming. Isbotlanmagan taqsimot alohida ko‘rsatiladi.
- Snapshot bir transactionda to‘liq statementdan olinadi, money Decimal. Name, merchant, vaqt, aging va ledger date/due/receipt/source/amount/balance bor; telefon, actor name va izoh yo‘q. 10k row yoki byte budget oshsa rad, truncation yo‘q.
- `/d#organizationId.jobId.capability` va cookie talab qilmaydigan POST `/api/reminder-view`; no-store/no-referrer/noindex, public va capability rate budgetlari.

Consent yo‘q/revoked, boshqa kanal/purpose, archived/merged customer yoki kontakt/karta native revisioni o‘zgargan bo‘lsa queue/prepare/read rad. Re-grant eski consent eventni qayta jonlantirmaydi. Eski consent bilan manual job retry ham rad. Bir soatlik job expiry, root key overlapdan chiqishi yoki backup restore checkpointi eski public accessni yopadi. Oldindan o‘qilgan/yuklab olingan nusxani mijoz qurilmasidan qaytarib o‘chirib bo‘lmaydi; keyingi server access tekshiriladi.

Asl vakolatli CSV/HTML ko‘chirma va accounting tarixini ko‘rish funksiyalari ishlashda davom etadi. Rozilikni qayd etish, queue tayyorlash va public o‘qish yangi qarz, savdo yoki to‘lov yaratmaydi.

## Qabul dalillari

`tests/receipt-links.integration.test.ts`, `customer-reminders.integration.test.ts`, `files-catalog.integration.test.ts`; haqiqiy Chromium `shared-documents.spec.ts`, `customer-consent.spec.ts`, `permission-receipts.spec.ts`. QR SVG rasterga aylantirilib mavjud ZXing bilan qayta decode qilinadi; 58/80mm PDF MediaBox o‘lchanadi. Bu haqiqiy scanner/printer sinovi emas.

`node scripts/ops/test-release-images.mjs` yangi lokal image va haqiqiy worker bilan chek/eslatmani yaratadi, GPG backup/restore qiladi va auth review’dan keyin ham ikkalasining eski capabilitysi404 bo‘lishini tekshiradi. Owner ro‘yxati va old-key replay ham `available:false`. Production server, off-host recovery, haqiqiy mijoz yoki provayder qabuli alohida qoladi.
