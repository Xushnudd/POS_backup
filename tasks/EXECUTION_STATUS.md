# Bajarish statusi

Sana: 2026-10-05. Barcha PLAN1 bandlari quyida kuzatiladi. Kod mavjudligi yakuniy qabul dalili emas. Oldingi foundation kodi mavjud `9594e50` commitda; keyingi o‘zgarishlar ishchi daraxtda. Avtomatik commit yaratilmaydi.

## Checkpoint

- Boshlang‘ich Git holati toza.
- Node 24.18.0, Prisma 5.22 mavjud.
- Baseline typecheck: muvaffaqiyatsiz (Prisma config, Zod4, Decimal, report items, transfer, JWT).
- Docker standart sandboxda yopiq; faqat alohida test konteyneri uchun escalation tekshiruvi muvaffaqiyatli. Haqiqiy bazaga tegilmaydi.
- Baseline muammolari tuzatildi. Production build o‘tdi; yakuniy o‘zgarishdan keyingi qayta tekshiruv davom etmoqda.
- MKT/LEG/PILOT: haqiqiy intervyu, tasdiqlar va 14 kunlik pilot tashqi dalillari yo‘q.

| ID | Release | Status | Natija / kerakli contract | Dalil / to‘siq | Keyingi amal |
| --- | --- | --- | --- | --- | --- |
| MKT-01.01 | CORE-1 | blocked_external | 10–15 ta biznes egasi va 5–10 ta kassir bilan suhbat o‘tkazish. | — | — |
| MKT-01.02 | CORE-1 | blocked_external | Amaldagi kassada bir ish kunining asosiy amallarini kuzatish. | — | — |
| MKT-01.03 | CORE-1 | blocked_external | Qaysi qurilmalar, internet, printer, tarozi va fiskal provayder ishlatilishini yozib olish. | — | — |
| MKT-01.04 | CORE-1 | blocked_external | Hozirgi dasturdan ko‘chishdagi qiyinchiliklar va to‘lashga tayyor narxni tekshirish. | — | — |
| MKT-01.05 | CORE-1 | blocked_external | Eng ko‘p talab qilingan besh muammo va mahsulotning ustunligini belgilash. | — | — |
| MKT-01.06 | CORE-1 | blocked_external | Kamida uchta pilot biznes, ularning sinov doirasi va muvaffaqiyat mezonini kelishish. | — | — |
| FIX-01.01 | CORE-1 | done | TypeScript, Prisma konfiguratsiyasi, Zod va JWT turlari bo‘yicha xatolarni tuzatish. | Typecheck/build; tests/foundation.integration.test.ts; secret build ignores | Yangi o‘zgarishlarda regressiyani saqlash |
| FIX-01.02 | CORE-1 | done | Savdo hisobotidagi yuklanmagan `items`ga murojaatni tuzatish. | Typecheck/build; tests/foundation.integration.test.ts; secret build ignores | Yangi o‘zgarishlarda regressiyani saqlash |
| FIX-01.03 | CORE-1 | done | Transfer yaratishda bog‘langan mahsulot qatorlarini to‘g‘ri saqlash. | Typecheck/build; tests/foundation.integration.test.ts; secret build ignores | Yangi o‘zgarishlarda regressiyani saqlash |
| FIX-01.04 | CORE-1 | done | Qoralamada faqat izoh/mijoz o‘zgarsa mahsulot qatorlari saqlanishini ta’minlash. | Typecheck/build; tests/foundation.integration.test.ts; secret build ignores | Yangi o‘zgarishlarda regressiyani saqlash |
| FIX-01.05 | CORE-1 | done | Chegirma alohida o‘zgarsa summalarni qayta hisoblash; nol qiymatni to‘g‘ri qabul qilish. | Typecheck/build; tests/foundation.integration.test.ts; secret build ignores | Yangi o‘zgarishlarda regressiyani saqlash |
| FIX-01.06 | CORE-1 | done | Ro‘yxatdan o‘tish javobini frontend ehtiyoji bilan moslashtirish; birlamchi yaratishni tranzaksiyaga olish. | Typecheck/build; tests/foundation.integration.test.ts; secret build ignores | Yangi o‘zgarishlarda regressiyani saqlash |
| FIX-01.07 | CORE-1 | in_progress | SKU va barkod noyobligini tashkilot doirasiga o‘tkazish; mavjud bazaga xavfsiz migratsiya tayyorlash. | Foundation–006 migration, tenant FK/trigger, isolated PostgreSQL tests | Real eski data clone preflight/backfill va fresh-db qayta qabul sinovi |
| FIX-01.08 | CORE-1 | done | `ignoreBuildErrors`ni olib tashlash; paketlar mosligini va Prisma client yaratishni majburiy tekshirish. | Typecheck/build; tests/foundation.integration.test.ts; secret build ignores | Yangi o‘zgarishlarda regressiyani saqlash |
| FIX-01.09 | CORE-1 | done | Docker build, standalone chiqishi va bazaga ulanish tartibini tuzatish. | Node24/Next16.3.8 non-root image build; temporary container /health/ready=200; image Prisma CLI: 11 migrations up-to-date on pos_test | Real deployment OPS tasks remain open |
| FIX-01.10 | CORE-1 | done | Maxfiy muhit fayllari image yoki build kontekstiga kirishini to‘xtatish. | Typecheck/build; tests/foundation.integration.test.ts; secret build ignores | Yangi o‘zgarishlarda regressiyani saqlash |
| SEC-01.01 | CORE-1 | in_progress | Tashkilotni faqat so‘rov tanasidan emas, haqiqiy sessiya va faol a’zolikdan aniqlash. | Live Session, route matrix, scopedPrisma, withApi, SQL scope; tenant/revoke/CSRF tests | Har yangi endpoint/export/worker uchun negative permission coverage va browser acceptance |
| SEC-01.02 | CORE-1 | in_progress | Har bir ro‘yxat, tafsilot, o‘zgartirish, eksport, fayl va fon ishida tashkilot chegarasini tekshirish. | Live Session, route matrix, scopedPrisma, withApi, SQL scope; tenant/revoke/CSRF tests | Har yangi endpoint/export/worker uchun negative permission coverage va browser acceptance |
| SEC-01.03 | CORE-1 | in_progress | Do‘kon, kassa, smena, mahsulot, mijoz va to‘lov bir tashkilotga tegishli ekanini tekshirish. | Live Session, route matrix, scopedPrisma, withApi, SQL scope; tenant/revoke/CSRF tests | Har yangi endpoint/export/worker uchun negative permission coverage va browser acceptance |
| SEC-01.04 | CORE-1 | in_progress | Egasi/admin/kassir uchun amallar jadvalini yozish va serverda qo‘llash. | Live Session, route matrix, scopedPrisma, withApi, SQL scope; tenant/revoke/CSRF tests | Har yangi endpoint/export/worker uchun negative permission coverage va browser acceptance |
| SEC-01.05 | CORE-1 | in_progress | Kassir boshqa kassir smenasida ruxsatsiz savdo qilmasligi; tannarx va foydani vakolatsiz ko‘rmasligi. | Live Session, route matrix, scopedPrisma, withApi, SQL scope; tenant/revoke/CSRF tests | Har yangi endpoint/export/worker uchun negative permission coverage va browser acceptance |
| SEC-01.06 | CORE-1 | in_progress | Ruxsatlar bekor bo‘lganda eski sessiya ham bu amallarni bajara olmasligi. | Live Session, route matrix, scopedPrisma, withApi, SQL scope; tenant/revoke/CSRF tests | Har yangi endpoint/export/worker uchun negative permission coverage va browser acceptance |
| SEC-01.07 | CORE-1 | in_progress | Admin panel va yordam xizmati kirishlarini ham shu nazoratga olish. | Live Session, route matrix, scopedPrisma, withApi, SQL scope; tenant/revoke/CSRF tests | Har yangi endpoint/export/worker uchun negative permission coverage va browser acceptance |
| SEC-02.01 | CORE-1 | in_progress | HTTPS; productionda kuchli kalit majburiy, standart kalit bilan ishga tushmaslik. | HTTPS origin startup validation, cookie, DB login limit, bounded JSON, requestId | TLS hosting, reset/import limits, fayl/CSV himoyasi va security-event UI |
| SEC-02.02 | CORE-1 | in_progress | Brauzer uchun xavfsiz sessiya yechimi: HttpOnly/Secure cookie, muddat, serverda bekor qilish; cookie ishlatilsa CSRF himoyasi. | Live Session, route matrix, scopedPrisma, withApi, SQL scope; tenant/revoke/CSRF tests | Har yangi endpoint/export/worker uchun negative permission coverage va browser acceptance |
| SEC-02.03 | CORE-1 | in_progress | Chiqish, barcha qurilmalardan chiqish, parol almashtirish va parol tiklash. | Logout/logout-all/change-password, sessiyalar bekor qilinadi | Xavfsiz parol tiklash va real delivery boundary |
| SEC-02.04 | CORE-1 | todo | Telefon/e-mail tasdiqlash, bir martalik kod muddati va urinishlar chegarasi. | — | — |
| SEC-02.05 | CORE-1 | in_progress | Kirish, tiklash, import va qimmat so‘rovlarda tezlik/hajm cheklovlari. | HTTPS origin startup validation, cookie, DB login limit, bounded JSON, requestId | TLS hosting, reset/import limits, fayl/CSV himoyasi va security-event UI |
| SEC-02.06 | CORE-1 | todo | Owner, platforma admini va muhim amallar uchun ikki bosqichli tasdiq. | — | — |
| SEC-02.07 | CORE-1 | in_progress | API javobi va loglardan parol xeshi, token, maxfiy kalit va keraksiz shaxsiy maydonlarni chiqarish. | Live Session, route matrix, scopedPrisma, withApi, SQL scope; tenant/revoke/CSRF tests | Har yangi endpoint/export/worker uchun negative permission coverage va browser acceptance |
| SEC-02.08 | CORE-1 | in_progress | XSS, fayl yuklash, zararli CSV va noto‘g‘ri parametrlar himoyasi. | HTTPS origin startup validation, cookie, DB login limit, bounded JSON, requestId | TLS hosting, reset/import limits, fayl/CSV himoyasi va security-event UI |
| SEC-02.09 | CORE-1 | in_progress | Sessiyalar va xavfsizlik hodisalari tarixi; shubhali kirish haqida bildirishnoma. | HTTPS origin startup validation, cookie, DB login limit, bounded JSON, requestId | TLS hosting, reset/import limits, fayl/CSV himoyasi va security-event UI |
| USR-01.01 | CORE-1 | in_progress | Taklif qilish, rol/do‘kon berish, tahrirlash, vaqtincha bloklash va arxivlash. | Member update/ownership/switch API, audit, owner guard, role discount policy | Taklif, boshqaruv UI, ownership negative tests, manager approval record |
| USR-01.02 | CORE-1 | in_progress | Oxirgi egani o‘chirish/bloklashga yo‘l qo‘ymaslik; egalikni topshirish jarayoni. | Member update/ownership/switch API, audit, owner guard, role discount policy | Taklif, boshqaruv UI, ownership negative tests, manager approval record |
| USR-01.03 | CORE-1 | in_progress | Bir foydalanuvchining bir nechta biznesi orasida vakolat bilan almashish. | Member update/ownership/switch API, audit, owner guard, role discount policy | Taklif, boshqaruv UI, ownership negative tests, manager approval record |
| USR-01.04 | CORE-1 | todo | Tez kassir almashish uchun PIN; PIN yuqori vakolat o‘rnini bosmasligi. | — | — |
| USR-01.05 | CORE-1 | in_progress | Qaytarish, narx o‘zgartirish, katta chegirma va inventar farqiga manager tasdig‘i. | Member update/ownership/switch API, audit, owner guard, role discount policy | Taklif, boshqaruv UI, ownership negative tests, manager approval record |
| USR-01.06 | CORE-1 | todo | Kelgusida omborchi/buxgalter/kuzatuvchi roli va moslashtiriladigan vakolatlar. | — | — |
| POS-01.01 | CORE-1 | in_progress | Narx, tannarx, birlik, kassir va vakolatlarni serverda ishonchli manbadan olish. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-01.02 | CORE-1 | in_progress | Bo‘sh savat, manfiy/yaroqsiz son, ortiqcha chegirma va noto‘g‘ri IDlarni rad etish. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-01.03 | CORE-1 | in_progress | Savdo, to‘lov, ombor va auditni bitta nazorat qilinadigan amalda yakunlash. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-01.04 | CORE-1 | in_progress | Takror so‘rov bir savdoni ikki marta yozmasligi uchun yagona amal kaliti qo‘shish — idempotency. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-01.05 | CORE-1 | in_progress | Ochiq smena, qoldiq, limit va holatni tranzaksiya ichida tekshirish; parallel amallardan himoya. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-01.06 | CORE-1 | in_progress | Chek raqamini yozuvlar soniga bog‘lamasdan noyob ajratish; fiskal raqamni alohida saqlash. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-01.07 | CORE-1 | in_progress | Timeoutdan keyin “sotildimi?” holatini tekshirib, xavfsiz davom ettirish. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-01.08 | CORE-1 | in_progress | Yakunlangan savdoni yashirin tahrirlash/o‘chirishni taqiqlash; tuzatishni qarshi hujjat bilan yuritish. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-02.01 | CORE-1 | in_progress | Qoralamani saqlash, vaqtincha chetga qo‘yish, qayta ochish va bekor qilish. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-02.02 | CORE-1 | in_progress | Savatni brauzer yopilishi/yangilanishidan tiklash; qurilma va foydalanuvchi chegarasi. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-02.03 | CORE-1 | in_progress | Aralash to‘lov: masalan, 60 000 naqd + 40 000 karta; qisman nasiya. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-02.04 | CORE-1 | in_progress | Qaytimni haqiqiy naqd berilgan summa bilan ko‘rsatish, tushumga faqat tegishli summani yozish. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-02.05 | CORE-1 | todo | Klaviatura tezkor tugmalari, USB skaner, tezkor mahsulotlar, qulay qidiruv. | — | — |
| POS-02.06 | CORE-1 | in_progress | Har qator/butun chek chegirmasi; foiz/summa; sabab va tasdiq. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-02.07 | CORE-1 | in_progress | Qoldiq va narx o‘zgarganini savat yakunida tushunarli ko‘rsatish. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-02.08 | CORE-1 | in_progress | Mijoz tanlash, chek izohi, sotuvchi/xizmat turi kerak bo‘lsa belgilash. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-02.09 | CORE-1 | todo | Chekni qayta chiqarish, elektron chek, 58/80 mm andozalari; qayta chiqarishni belgilash. | — | — |
| RET-01.01 | CORE-1 | in_progress | Original chek bo‘yicha to‘liq va qisman qaytarish. | Internal return service + UI, receipt allocation, cash/debt conservation, retry tests | Disposition UI, repayment-channel policy, tax snapshot, manager approval acceptance |
| RET-01.02 | CORE-1 | in_progress | Oldingi qaytarishlarni hisobga olish; sotilganidan ko‘p qaytarishni taqiqlash. | Internal return service + UI, receipt allocation, cash/debt conservation, retry tests | Disposition UI, repayment-channel policy, tax snapshot, manager approval acceptance |
| RET-01.03 | CORE-1 | in_progress | Chegirma va soliqni qaytarilayotgan qatorga to‘g‘ri taqsimlash. | Internal return service + UI, receipt allocation, cash/debt conservation, retry tests | Disposition UI, repayment-channel policy, tax snapshot, manager approval acceptance |
| RET-01.04 | CORE-1 | in_progress | Tovar omborga qaytadimi, brak omborigami yoki hisobdan chiqadimi — aniq tanlash. | Internal return service + UI, receipt allocation, cash/debt conservation, retry tests | Disposition UI, repayment-channel policy, tax snapshot, manager approval acceptance |
| RET-01.05 | CORE-1 | in_progress | Naqd/karta/nasiya aralash savdoda pul va qarzning qaytarish tartibini belgilash. | Internal return service + UI, receipt allocation, cash/debt conservation, retry tests | Disposition UI, repayment-channel policy, tax snapshot, manager approval acceptance |
| RET-01.06 | EXTERNAL-LATER | deferred | Provayder orqali refund, uning kutish/xato holati va takror so‘rovdan himoya. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| RET-01.07 | CORE-1 | in_progress | Sabab, vakolat, tasdiqlovchi, qaytarma chek va audit. | Internal return service + UI, receipt allocation, cash/debt conservation, retry tests | Disposition UI, repayment-channel policy, tax snapshot, manager approval acceptance |
| RET-01.08 | CORE-1 | todo | Tovar almashtirishni original qaytarish + yangi savdo sifatida bog‘lash. | — | — |
| CAT-01.01 | CORE-1 | todo | Kategoriya daraxti, brend, rasm, tavsif va faol/arxiv holati. | — | — |
| CAT-01.02 | CORE-1 | todo | Bir mahsulot uchun bir nechta barkod; barkod yaratish va etiketka chiqarish. | — | — |
| CAT-01.03 | CORE-1 | todo | Rang/o‘lcham kabi variantlar; har variantning alohida qoldig‘i va barkodi. | — | — |
| CAT-01.04 | CORE-1 | todo | Birlik konvertatsiyasi: 1 quti = 12 dona; asosiy birlikda qoldiq, hujjatda savdo birligi. | — | — |
| CAT-01.05 | CORE-1 | todo | Kasr bilan sotish, birlik aniqligi, tarozi barkodidan vazn/narx ajratish. | — | — |
| CAT-01.06 | CORE-1 | todo | Chakana/ulgurji/mijoz narxlari; filial narxi va sanadan kuchga kiradigan narx. | — | — |
| CAT-01.07 | CORE-1 | todo | Narx tarixi va ommaviy o‘zgartirish; tannarx uchun alohida ruxsat. | — | — |
| CAT-01.08 | CORE-1 | todo | Excel/CSV import, oldindan ko‘rish, dublikat/xato qatorlar hisoboti, eksport. | — | — |
| CAT-01.09 | CORE-1 | todo | Soliq turi, MXIK va markirovka xususiyatlari tegishli tovar uchun. | — | — |
| INV-01.01 | CORE-1 | in_progress | Har bir o‘zgarish uchun hujjat va ombor harakati; bevosita qoldiqni almashtirishni taqiqlash. | Atomic movement journal, stock documents, partial transfers, weighted purchase cost tests | Stock reconciliation, cancellation/reversal, shortage/damage, purchase history UI |
| INV-01.02 | CORE-1 | in_progress | Boshlang‘ich qoldiqni hujjat bilan kiritish; musbat/manfiy tuzatish, sabab va tasdiq. | Atomic movement journal, stock documents, partial transfers, weighted purchase cost tests | Stock reconciliation, cancellation/reversal, shortage/damage, purchase history UI |
| INV-01.03 | CORE-1 | done | Tasdiqlangan hujjat o‘zgarmasligi; xatoni bekor qiluvchi yoki qarshi hujjat. | Migration011 DB guards + unique original/reversal link; service/API/UI; economic.integration stock reversal/rollback tests; Chromium UI reversal passed | — |
| INV-01.04 | CORE-1 | in_progress | Jo‘natishda yetarli qoldiq, yo‘ldagi mahsulot, qisman qabul, kamomad/brak hisobini yuritish. | Atomic movement journal, stock documents, partial transfers, weighted purchase cost tests | Stock reconciliation, cancellation/reversal, shortage/damage, purchase history UI |
| INV-01.05 | CORE-1 | done | Transferni jo‘natishdan oldin bekor qilish; jo‘natilgandan keyingi qaytarish qoidasi. | Draft cancel no stock effect; transit return quantity journal/audit/idempotency; migration012 received+returned bound; parallel receive/return test; browser return passed | Received goods use a new reverse-direction transfer, ADR-008 |
| INV-01.06 | CORE-1 | todo | Qoldiq jurnaliga mosligini tekshiradigan avtomatik solishtirish va farq ogohlantirishi. | — | — |
| INV-01.07 | CORE-1 | in_progress | Manfiy qoldiq siyosatini aniq belgilash; yoqilsa foyda/tannarx ta’sirini hisoblash. | Atomic movement journal, stock documents, partial transfers, weighted purchase cost tests | Stock reconciliation, cancellation/reversal, shortage/damage, purchase history UI |
| INV-02.01 | CORE-1 | done | To‘liq/qisman sanash; kutilgan qoldiqni yashirib sanash imkoniyati. | StockCount/Line/Reading API+UI; blind DTO hides expected/cost until review; full/partial and browser checks | 1–2000 SKU per session; larger catalog split into partial sessions, ADR-009 |
| INV-02.02 | CORE-1 | done | Sanash davridagi savdolarni hisobga olish yoki vaqtinchalik bloklash siyosati. | Selected SKU logical freeze; short common advisory lock+balance version; DB freeze trigger; concurrent checkout checkpoint test and unselected SKU sale | No long DB transaction during physical counting; manager finalizes/cancels active freezes |
| INV-02.03 | CORE-1 | done | Farq hujjati, qayta sanash va tasdiqlovchi. | Append-only rounds/actor/time; nonzero requires recount; idempotent linked adjustment+journal+manager reason/audit; terminal history guards; browser approval | — |
| INV-02.04 | CORE-1 | todo | Minimal/maksimal qoldiq, tugayotgan mahsulot va qayta buyurtma tavsiyasi. | — | — |
| INV-02.05 | CORE-1 | todo | Ombor manzili/zonasi, brak va rezerv qoldiq kerak bo‘lsa alohida yuritish. | — | — |
| INV-02.06 | CORE-1 | todo | Partiya, yaroqlilik muddati, FEFO tanlash va muddati yaqin ogohlantirish — oziq-ovqat segmentida P1. | — | — |
| INV-02.07 | CORE-1 | todo | Seriya raqami/kafolat — elektronika segmentida P1. | — | — |
| PUR-01.01 | CORE-1 | in_progress | Yetkazib beruvchi kartasi, kontaktlar, rekvizitlar, shartlar va tarix. | Atomic movement journal, stock documents, partial transfers, weighted purchase cost tests | Stock reconciliation, cancellation/reversal, shortage/damage, purchase history UI |
| PUR-01.02 | CORE-1 | todo | Buyurtma → qisman/to‘liq qabul → xarid hisoboti → to‘lov zanjiri. | — | — |
| PUR-01.03 | CORE-1 | todo | Yetkazib beruvchiga qaytarish, narx/miqdor farqi va qarzni yangilash. | — | — |
| PUR-01.04 | CORE-1 | todo | Yetkazib beruvchi qarzi, oldindan to‘lov va qisman to‘lash. | — | — |
| PUR-01.05 | CORE-1 | todo | Yetkazish/xarid xarajatlarini tannarxga taqsimlash siyosati. | — | — |
| PUR-01.06 | CORE-1 | in_progress | Xarid narxi tarixi, mahsulot/yetkazib beruvchi bo‘yicha tahlil. | Atomic movement journal, stock documents, partial transfers, weighted purchase cost tests | Stock reconciliation, cancellation/reversal, shortage/damage, purchase history UI |
| CRM-01.01 | CORE-1 | in_progress | Nasiya uchun mijoz, vakolat va limitni serverda majburiy tekshirish. | DebtEntry alohida ledger, FIFO collection allocation, customer locking, cash/debt return tests | Opening debt, advance/statement/due-date UI; non-cash refund policy; provider card external-later |
| CRM-01.02 | CORE-1 | in_progress | Qarz yozuvini haqiqiy pul to‘lovidan ajratish: nasiya naqd tushum deb olinmasligi. | DebtEntry alohida ledger, FIFO collection allocation, customer locking, cash/debt return tests | Opening debt, advance/statement/due-date UI; non-cash refund policy; provider card external-later |
| CRM-01.03 | CORE-1 | in_progress | Qarzni naqd/karta/o‘tkazma bilan undirish; pulni haqiqiy smena yoki hisobga yozish. | DebtEntry alohida ledger, FIFO collection allocation, customer locking, cash/debt return tests | Opening debt, advance/statement/due-date UI; non-cash refund policy; provider card external-later |
| CRM-01.04 | CORE-1 | in_progress | Qisman undirish, oldindan to‘lov, ortiqcha to‘lov va qaytarish qoidalari. | DebtEntry alohida ledger, FIFO collection allocation, customer locking, cash/debt return tests | Opening debt, advance/statement/due-date UI; non-cash refund policy; provider card external-later |
| CRM-01.05 | CORE-1 | in_progress | To‘lovni qaysi qarz/savdoga ajratishni yuritish; boshlang‘ich qarzni alohida hujjat bilan kiritish. | Opening debt source/actor/date/due/reason API+owner UI; sale-based FIFO + explicit per-sale amount allocations via API/sync + owner customer-card UI; paginated positive targets; general opening group; immutable document tests | Individual opening-document allocations and legacy allocation repair remain |
| CRM-01.06 | CORE-1 | done | Qarzni o‘chirish/tuzatish faqat sabab, vakolat va audit bilan. | Owner-only immutable new adjustment/write-off; bounds/tenant/live auth/idempotency; migration015 append-only DB guard; weighted write-off refund conservation tests; real browser duplicate prevention | No original ledger edit/delete; correction is a new audited entry |
| CRM-01.07 | CORE-1 | in_progress | Mijoz ko‘chirmasi: savdo, qaytarish, to‘lov, qarz qoldig‘i va muddat. | Owner debt statement: sources/receipt/actor/reason/effective/due dates, timezone period, opening/closing/running/global balance, pagination; SQL repeatable-read/window tests | Cash-only purchase activity/full statement export and complete due-date UI remain |
| CRM-02.01 | CORE-1 | todo | P1: mijoz qidirish, dublikatlarni nazorat qilish, xarid tarixi, guruhlar va narx darajasi. | — | — |
| CRM-02.02 | CORE-1 | todo | P1: qarz muddati/kechikish hisoboti, mijozga ko‘chirma va rozilik asosida eslatma. | — | — |
| CRM-02.03 | EXTENSIONS | deferred | P2: bonus ballari, chegirma kartasi, promo-kod va sovg‘a sertifikati. | — | — |
| CRM-02.04 | EXTENSIONS | deferred | P2: bonusning qaytarishda bekor bo‘lishi, muddati va suiiste’moldan himoya. | — | — |
| CRM-02.05 | EXTENSIONS | deferred | P2: marketing SMS/Telegram; xizmat xabari va reklama roziligini alohida boshqarish. | — | — |
| FIN-01.01 | CORE-1 | in_progress | Har kassada bir ochiq smena qoidasi bazada ham himoyalangan bo‘lishi. | Open-shift unique index, cash ledger, immutable close, checkout cost snapshot; economic tests | Handover/approval/cash tender snapshot, tax snapshots, browser acceptance |
| FIN-01.02 | CORE-1 | in_progress | Smenani ochish, yopish va topshirish; ochiq savdolar/integratsiya kutishlari uchun siyosat. | Open-shift unique index, cash ledger, immutable close, checkout cost snapshot; economic tests | Handover/approval/cash tender snapshot, tax snapshots, browser acceptance |
| FIN-01.03 | CORE-1 | in_progress | Savdo, qarz undirish, refund, naqd kirim/chiqim va inkassatsiyani alohida hisoblash. | Open-shift unique index, cash ledger, immutable close, checkout cost snapshot; economic tests | Handover/approval/cash tender snapshot, tax snapshots, browser acceptance |
| FIN-01.04 | CORE-1 | in_progress | Sanalgan pul, kutilgan pul, farq, sabab va rahbar tasdig‘i. | Open-shift unique index, cash ledger, immutable close, checkout cost snapshot; economic tests | Handover/approval/cash tender snapshot, tax snapshots, browser acceptance |
| FIN-01.05 | CORE-1 | in_progress | Naqd savdoda berilgan pul/qaytimni tushum bilan chalkashtirmaslik. | Open-shift unique index, cash ledger, immutable close, checkout cost snapshot; economic tests | Handover/approval/cash tender snapshot, tax snapshots, browser acceptance |
| FIN-01.06 | EXTERNAL-LATER | deferred | Karta/QR/o‘tkazma bo‘yicha provayder tushumi, komissiya va bank tushumini solishtirish. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| FIN-01.07 | CORE-1 | in_progress | Yopilgan smenani yashirin tahrirlamaslik; tuzatish hujjati. | Open-shift unique index, cash ledger, immutable close, checkout cost snapshot; economic tests | Handover/approval/cash tender snapshot, tax snapshots, browser acceptance |
| FIN-02.01 | CORE-1 | in_progress | Tannarx usulini belgilash: dastlab vaznli o‘rtacha; FIFO/partiya ehtiyoji bo‘lsa kengaytirish. | Open-shift unique index, cash ledger, immutable close, checkout cost snapshot; economic tests | Handover/approval/cash tender snapshot, tax snapshots, browser acceptance |
| FIN-02.02 | CORE-1 | in_progress | Har savdo qatorining tarixiy tannarxi, chegirmasi, solig‘i va yaxlitlanishini saqlash. | Open-shift unique index, cash ledger, immutable close, checkout cost snapshot; economic tests | Handover/approval/cash tender snapshot, tax snapshots, browser acceptance |
| FIN-02.03 | CORE-1 | in_progress | Chek chegirmasini qatorlarga taqsimlash; qaytarishni shu qiymatlardan hisoblash. | Open-shift unique index, cash ledger, immutable close, checkout cost snapshot; economic tests | Handover/approval/cash tender snapshot, tax snapshots, browser acceptance |
| FIN-02.04 | CORE-1 | todo | Biznes xarajatlari, toifalari va to‘lov hisoblari. | — | — |
| FIN-02.05 | CORE-1 | todo | Yalpi foyda va operatsion foydani aniq ajratish; to‘liq buxgalteriya hisobi bilan teng deb ko‘rsatmaslik. | — | — |
| FIN-02.06 | CORE-1 | todo | Naqd, bank va provayder hisoblari orasidagi pul o‘tkazmalarini ikki marta tushum deb hisoblamaslik. | — | — |
| FIN-02.07 | CORE-1 | todo | Soliq stavkasi, imtiyoz, narx ichida/tashqarisida soliq siyosatini sozlash; stavka tarixini saqlash. | — | — |
| REP-01.01 | CORE-1 | in_progress | P0: tashkilot va do‘kon filtri hamma ko‘rsatkichga tatbiq etilishi. | Timezone date ranges, global totals, SQL products/lowStock pagination, historical cost/refunds | Reports fixture coverage; full exports, additional breakdowns, repeatable snapshot |
| REP-01.02 | CORE-1 | in_progress | P0: vaqt zonasi, davr boshi/oxiri; oxirgi kun to‘liq kirishi. | Timezone date ranges, global totals, SQL products/lowStock pagination, historical cost/refunds | Reports fixture coverage; full exports, additional breakdowns, repeatable snapshot |
| REP-01.03 | CORE-1 | in_progress | P0: yig‘indilar joriy sahifadan emas, barcha mos yozuvlardan olinishi. | Timezone date ranges, global totals, SQL products/lowStock pagination, historical cost/refunds | Reports fixture coverage; full exports, additional breakdowns, repeatable snapshot |
| REP-01.04 | CORE-1 | in_progress | P0: sotuv, refund, nasiya va haqiqiy pul tushumi bir-biridan ajratilishi. | Timezone date ranges, global totals, SQL products/lowStock pagination, historical cost/refunds | Reports fixture coverage; full exports, additional breakdowns, repeatable snapshot |
| REP-01.05 | CORE-1 | in_progress | P0: tannarx har qator `miqdor × tarixiy tannarx`dan hisoblanishi. | Timezone date ranges, global totals, SQL products/lowStock pagination, historical cost/refunds | Reports fixture coverage; full exports, additional breakdowns, repeatable snapshot |
| REP-01.06 | CORE-1 | in_progress | P1: savdo, mahsulot, kategoriya, kassir, filial va to‘lov turi kesimidagi tahlil. | Timezone date ranges, global totals, SQL products/lowStock pagination, historical cost/refunds | Reports fixture coverage; full exports, additional breakdowns, repeatable snapshot |
| REP-01.07 | CORE-1 | in_progress | P1: qoldiq qiymati, ombor harakati, kam qoldiq, yaroqlilik va sekin sotiladigan tovarlar. | Timezone date ranges, global totals, SQL products/lowStock pagination, historical cost/refunds | Reports fixture coverage; full exports, additional breakdowns, repeatable snapshot |
| REP-01.08 | CORE-1 | todo | P1: smena, pul farqi, mijoz qarzi muddati, yetkazib beruvchi qarzi va xarid hisoboti. | — | — |
| REP-01.09 | CORE-1 | todo | P1: to‘liq filtrlangan CSV/XLSX/PDF eksport; katta eksportni fon ishida bajarish. | — | — |
| REP-01.10 | CORE-1 | in_progress | P1: jadvaldagi umumiy son, eksport va dashboard bir davr uchun mos kelishi. | Timezone date ranges, global totals, SQL products/lowStock pagination, historical cost/refunds | Reports fixture coverage; full exports, additional breakdowns, repeatable snapshot |
| REP-01.11 | EXTENSIONS | deferred | P2: rejalashtirilgan hisobot, filial taqqoslash, KPI va talab prognozi. | — | — |
| LOC-01.01 | EXTERNAL-LATER | deferred | Mijoz faoliyati, soliq rejimi va savdo turiga tatbiq etiladigan amaldagi talablarni tekshirish. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-01.02 | EXTERNAL-LATER | deferred | Shuni POS fiskal provayderga ulanadimi yoki mustaqil virtual kassa maqomini oladimi — qaror. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-01.03 | EXTERNAL-LATER | deferred | Birinchi chiqarish uchun tegishli reestr/talablarga mos provayderni tanlash; shartnoma va test muhiti. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-01.04 | EXTERNAL-LATER | deferred | Savdo, qaytarish, bekor qilish, aralash to‘lov va smena bo‘yicha provider oqimlarini xaritalash. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-01.05 | EXTERNAL-LATER | deferred | Fiskal ID, raqam, vaqt, QR va holatni saqlash; qayta chiqarishda original fiskal ma’lumotni ishlatish. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-01.06 | EXTERNAL-LATER | deferred | MXIK, birlik, soliq va zarur chek rekvizitlarini mahsulot/hujjatga qo‘shish va validatsiya qilish. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-01.07 | EXTERNAL-LATER | deferred | Timeoutda provayder holatini tekshirish; takror fiskal chek yaratmaslik. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-01.08 | EXTERNAL-LATER | deferred | Fiskal yuborish xatosini kassir va egaga ko‘rsatish; qo‘lda hal qilish/audit jarayoni. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-01.09 | EXTERNAL-LATER | deferred | Fiskal va savdo summalarini kunlik solishtirish. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-02.01 | EXTERNAL-LATER | deferred | 2D skaner va Data Matrix o‘qish; kodni mahsulot va birlik bilan bog‘lash. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-02.02 | EXTERNAL-LATER | deferred | Takror, yaroqsiz yoki allaqachon sotilgan kodni nazorat qilish. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-02.03 | EXTERNAL-LATER | deferred | Qabul qilish, savdo, qaytarish va hisobdan chiqarish uchun tegishli integratsiya. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-02.04 | EXTERNAL-LATER | deferred | Markirovka kodini fiskal jarayon bilan bog‘lash va holatlar tarixini saqlash. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-02.05 | EXTERNAL-LATER | deferred | Pilotdagi aniq mahsulot guruhlari bo‘yicha moslikni tasdiqlash. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-03.01 | EXTERNAL-LATER | deferred | P1: tanlangan terminal/QR/to‘lov provayderi bilan pilot uchun integratsiya. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-03.02 | EXTERNAL-LATER | deferred | Click/Payme yoki boshqa provayderlar — mijoz ehtiyoji, API va shartnoma imkoniyatiga qarab. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-03.03 | EXTERNAL-LATER | deferred | Imzolangan callback, serverdan holat tekshirish, dublikatdan himoya va kunlik solishtirish. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-03.04 | EXTERNAL-LATER | deferred | “Kutilmoqda”, “tasdiqlandi”, “bekor bo‘ldi”, “qaytarildi” holatlari; noma’lum to‘lovni muvaffaqiyatli deb olmaslik. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-03.05 | EXTERNAL-LATER | deferred | Karta ma’lumotlarini POS bazasida saqlamaslik; to‘lovni provayder tomonida bajarish. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| LOC-03.06 | EXTENSIONS | deferred | P2: buxgalteriya/1C eksporti, EHF va bank bilan ulanish; tanlangan integratsiyaning ikki tomonlama mosligi. | — | — |
| OFF-01.01 | CORE-1 | in_progress | Tarmoq holatini ko‘rsatish, savatni xavfsiz saqlash va muvaffaqiyatsiz so‘rovni nazoratli takrorlash. | Scoped IndexedDB cart/queue, status lookup, sync core, server-authoritative posting | PWA/catalog cache, conflict/cancel resolution UI, offline policy and browser crash tests |
| OFF-01.02 | CORE-1 | in_progress | Savdo yozilgan, ammo javob kelmagan holatda serverdagi natijani topish. | Scoped IndexedDB cart/queue, status lookup, sync core, server-authoritative posting | PWA/catalog cache, conflict/cancel resolution UI, offline policy and browser crash tests |
| OFF-01.03 | CORE-1 | todo | Printer ishlamasa savdoni ikkinchi marta yaratmasdan chekni qayta chiqarish. | — | — |
| OFF-01.04 | CORE-1 | in_progress | Qurilma ishdan chiqsa boshqa qurilmadan vakolatli davom ettirish. | Scoped IndexedDB cart/queue, status lookup, sync core, server-authoritative posting | PWA/catalog cache, conflict/cancel resolution UI, offline policy and browser crash tests |
| OFF-01.05 | CORE-1 | todo | Integratsiya xatosi, savdo xatosi va faqat chek chop etish xatosini alohida ko‘rsatish. | — | — |
| OFF-02.01 | CORE-1 | in_progress | PWA va lokal saqlash; mahsulot/narxlar uchun yangilanish chegarasi. | Scoped IndexedDB cart/queue, status lookup, sync core, server-authoritative posting | PWA/catalog cache, conflict/cancel resolution UI, offline policy and browser crash tests |
| OFF-02.02 | CORE-1 | in_progress | Lokal savdo navbati, qurilma identifikatori va server bilan bir martalik sinxronlash. | Scoped IndexedDB cart/queue, status lookup, sync core, server-authoritative posting | PWA/catalog cache, conflict/cancel resolution UI, offline policy and browser crash tests |
| OFF-02.03 | CORE-1 | in_progress | Offline qoldiqni bir nechta kassada mutlaq kafolatlab bo‘lmasligini siyosat bilan hal qilish: rezerv, limit yoki ruxsatli manfiy qoldiq. | Scoped IndexedDB cart/queue, status lookup, sync core, server-authoritative posting | PWA/catalog cache, conflict/cancel resolution UI, offline policy and browser crash tests |
| OFF-02.04 | CORE-1 | in_progress | Eskirgan narx, nasiya limiti, bloklangan xodim va smena uchun alohida cheklov. | Scoped IndexedDB cart/queue, status lookup, sync core, server-authoritative posting | PWA/catalog cache, conflict/cancel resolution UI, offline policy and browser crash tests |
| OFF-02.05 | CORE-1 | in_progress | Lokal ma’lumot xavfsizligi, chiqishda tozalash va sinxronlanmagan savdoni yo‘qotishdan himoya. | Scoped IndexedDB cart/queue, status lookup, sync core, server-authoritative posting | PWA/catalog cache, conflict/cancel resolution UI, offline policy and browser crash tests |
| OFF-02.06 | EXTERNAL-LATER | deferred | Kartali to‘lov, markirovka va fiskal amallar offline rejimda faqat provayder/qoidalar ruxsat bergan tartibda. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| OFF-02.07 | CORE-1 | in_progress | Navbat holati, xato savdolarni qo‘lda hal qilish, egaga ogohlantirish. | Scoped IndexedDB cart/queue, status lookup, sync core, server-authoritative posting | PWA/catalog cache, conflict/cancel resolution UI, offline policy and browser crash tests |
| HW-01.01 | EXTERNAL-LATER | deferred | USB/2D skaner, 58/80 mm printer, pul tortmasi va tanlangan elektron tarozi. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| HW-01.02 | EXTERNAL-LATER | deferred | Qurilmalar ro‘yxati, OS/brauzer, ulanish usuli va ishlaydigan modellar jadvali. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| HW-01.03 | EXTERNAL-LATER | deferred | Zarur bo‘lsa xavfsiz lokal printer/tarozi agenti; uni o‘rnatish va yangilash. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| HW-01.04 | EXTERNAL-LATER | deferred | Windows kassasi, planshet va mobil ekranlarda real sinov. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| HW-01.05 | CORE-1 | todo | Kassir ekrani uchun katta tugmalar; egaga telefon orqali dashboard. | — | — |
| HW-01.06 | EXTENSIONS | deferred | P2: mijoz displeyi, alohida mobil ilova va ombor terminali. | — | — |
| UX-01.01 | CORE-1 | todo | Birlamchi sozlash: tashkilot → filial/kassa → import → boshlang‘ich qoldiq → sinov savdo. | — | — |
| UX-01.02 | CORE-1 | todo | O‘zbek lotin va rus tili; barcha ishchi matnlarni yagona tarjima tizimiga olish. | — | — |
| UX-01.03 | CORE-1 | todo | Bir xil jadval/formalar, qidiruv, filtr, saralash, sahifalash va bo‘sh holatlar. | — | — |
| UX-01.04 | CORE-1 | todo | Xatolarni odam tushunadigan qilib yozish; foydalanuvchi keyin nima qilishi ko‘rsatilishi. | — | — |
| UX-01.05 | CORE-1 | todo | Loading, qayta urinish, saqlanmagan o‘zgarishlar va amaliy holatning aniq belgisi. | — | — |
| UX-01.06 | CORE-1 | todo | Klaviatura bilan boshqarish, kontrast, label va fokus; kassa uchun katta o‘qiladigan matn. | — | — |
| UX-01.07 | CORE-1 | todo | Rolga mos boshlang‘ich ekran va muhim ogohlantirishlar. | — | — |
| UX-01.08 | CORE-1 | todo | Qisqa video/yo‘riqnoma, demo ma’lumotlar, yangi kassirni o‘rgatish. | — | — |
| UX-01.09 | CORE-1 | todo | Import xatolari va printer/internet sozlash bo‘yicha yordam sahifalari. | — | — |
| DATA-01.01 | CORE-1 | in_progress | Moliyaviy hisobni aniq decimal bilan bajarish; pulni turli joyda turlicha yaxlitlamaslik. | Decimal/BigInt, serializable retry including Operation unique snapshot race, transactional audit, bounded requests | All financial/catalog validation, API contract and full audit coverage |
| DATA-01.02 | CORE-1 | in_progress | Foreign key, noyob indeks, son/holat cheklovi va kerakli qidiruv indekslari. | Foundation–006 migration, tenant FK/trigger, isolated PostgreSQL tests | Real eski data clone preflight/backfill va fresh-db qayta qabul sinovi |
| DATA-01.03 | CORE-1 | in_progress | Qoldiq/savdo/smena holatini atomik o‘zgartirish; deadlock/konfliktni nazoratli qayta urinish. | Decimal/BigInt, serializable retry including Operation unique snapshot race, transactional audit, bounded requests | All financial/catalog validation, API contract and full audit coverage |
| DATA-01.04 | CORE-1 | in_progress | Tashkilot kaliti va bog‘langan resurs egaligini butun modelda izchil qo‘llash. | Foundation–006 migration, tenant FK/trigger, isolated PostgreSQL tests | Real eski data clone preflight/backfill va fresh-db qayta qabul sinovi |
| DATA-01.05 | CORE-1 | in_progress | Audit yozuvini biznes o‘zgarishi bilan bir tranzaksiyada saqlash. | Decimal/BigInt, serializable retry including Operation unique snapshot race, transactional audit, bounded requests | All financial/catalog validation, API contract and full audit coverage |
| DATA-01.06 | CORE-1 | todo | Tashqi provayder chaqirig‘ini uzoq baza tranzaksiyasi ichida ushlamaslik; navbat va kompensatsiya jarayoni. | — | — |
| DATA-01.07 | CORE-1 | todo | Tashqi chaqiriq natijasi noma’lum bo‘lsa tekshirish va solishtirish; “ikki tizimda bitta tranzaksiya” deb faraz qilmaslik. | — | — |
| DATA-01.08 | CORE-1 | in_progress | Standart xato formati, so‘rov identifikatori, pagination/hajm cheklovi va API shartnomasi. | Decimal/BigInt, serializable retry including Operation unique snapshot race, transactional audit, bounded requests | All financial/catalog validation, API contract and full audit coverage |
| DATA-01.09 | CORE-1 | todo | Fayllar uchun vakolatli saqlash, yuklash cheklovi va o‘chirish siyosati. | — | — |
| DATA-01.10 | CORE-1 | in_progress | Migratsiya, ma’lumot ko‘chirish va mavjud hisobni tekshirish uchun skript/reja. | Foundation–006 migration, tenant FK/trigger, isolated PostgreSQL tests | Real eski data clone preflight/backfill va fresh-db qayta qabul sinovi |
| OPS-01.01 | CORE-1 | in_progress | Development, staging va production alohida baza/kalit bilan. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Docker image actual build; staging/TLS/off-site scheduler/PITR/on-call; real data restore rehearsal |
| OPS-01.02 | CORE-1 | in_progress | Builddan `db push`ni chiqarish; versiyalangan migratsiyani alohida chiqarish bosqichida bajarish. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Docker image actual build; staging/TLS/off-site scheduler/PITR/on-call; real data restore rehearsal |
| OPS-01.03 | CORE-1 | in_progress | Yangi/avvalgi ilova bilan mos migratsiya, ma’lumot backfilli va qaytish rejasi. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Docker image actual build; staging/TLS/off-site scheduler/PITR/on-call; real data restore rehearsal |
| OPS-01.04 | CORE-1 | in_progress | CI: lint → turlar → test → build → staging → qabul tekshiruvi → production. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Docker image actual build; staging/TLS/off-site scheduler/PITR/on-call; real data restore rehearsal |
| OPS-01.05 | CORE-1 | in_progress | Image versiyasi, minimal vakolatli jarayon, xavfsiz secret saqlash va kalit aylantirish. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Docker image actual build; staging/TLS/off-site scheduler/PITR/on-call; real data restore rehearsal |
| OPS-01.06 | CORE-1 | in_progress | TLS, domen, firewall; bazani umumiy internetga ochmaslik. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Docker image actual build; staging/TLS/off-site scheduler/PITR/on-call; real data restore rehearsal |
| OPS-01.07 | CORE-1 | in_progress | Health/readiness endpoint, nazoratli restart, ulanish pooli va graceful shutdown. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Docker image actual build; staging/TLS/off-site scheduler/PITR/on-call; real data restore rehearsal |
| OPS-01.08 | CORE-1 | todo | Yangilash vaqtida savdoni yo‘qotmaslik; texnik xizmat oynasi va xabar berish. | — | — |
| OPS-02.01 | CORE-1 | in_progress | Tuzilgan loglar, request ID, tashkilot ID; maxfiy/shaxsiy ma’lumotlarni niqoblash. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Docker image actual build; staging/TLS/off-site scheduler/PITR/on-call; real data restore rehearsal |
| OPS-02.02 | CORE-1 | todo | API xatolari, sekin so‘rov, baza, disk, navbat, fiskal/to‘lov xatolari monitoringi. | — | — |
| OPS-02.03 | CORE-1 | todo | Savdo/to‘lov/qoldiq solishtirish farqi uchun biznes ogohlantirishlari. | — | — |
| OPS-02.04 | CORE-1 | todo | Navbatdagi ishlarni takrorlash va yechilmagan ishlar ro‘yxati. | — | — |
| OPS-02.05 | CORE-1 | todo | Xatoni mas’ul xodimga yuborish va eskalatsiya; kim javob berishi aniq bo‘lishi. | — | — |
| OPS-02.06 | CORE-1 | todo | Status sahifasi, hodisa jurnali va jiddiy hodisadan keyingi tahlil. | — | — |
| OPS-03.01 | CORE-1 | in_progress | Shifrlangan avtomatik backup; bazaning asosiy serveridan boshqa saqlash joyi. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Docker image actual build; staging/TLS/off-site scheduler/PITR/on-call; real data restore rehearsal |
| OPS-03.02 | CORE-1 | todo | Baza bilan birga mahsulot rasmlari, hujjatlar va zarur konfiguratsiya zaxirasi. | — | — |
| OPS-03.03 | CORE-1 | in_progress | Nuqtaga tiklash imkoniyati, backup muddati va kirish vakolati. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Docker image actual build; staging/TLS/off-site scheduler/PITR/on-call; real data restore rehearsal |
| OPS-03.04 | CORE-1 | in_progress | Alohida muhitga amaliy tiklash sinovi; faqat “backup olindi” xabari yetarli emas. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Docker image actual build; staging/TLS/off-site scheduler/PITR/on-call; real data restore rehearsal |
| OPS-03.05 | CORE-1 | in_progress | Tashkilotga tegishli yozuvni tiklashda boshqa tashkilot ma’lumotiga ta’sirni tekshirish. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Docker image actual build; staging/TLS/off-site scheduler/PITR/on-call; real data restore rehearsal |
| OPS-03.06 | CORE-1 | in_progress | Tiklashdan keyin provider, offline navbat va savdo holatlarini solishtirish. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Docker image actual build; staging/TLS/off-site scheduler/PITR/on-call; real data restore rehearsal |
| OPS-04.01 | CORE-1 | todo | Pilotdan katalog, savdo hajmi, kassalar va parallel so‘rovlar profilini olish. | — | — |
| OPS-04.02 | CORE-1 | todo | Dastlabki test profili: bir tashkilotda 50 000 mahsulot, 1 million savdo qatori, 20 parallel faol kassa. | — | — |
| OPS-04.03 | CORE-1 | todo | Namuna yuklamada qidiruv p95 ≤ 500 ms, ichki savdo yakunlash p95 ≤ 2 s; provider vaqti alohida o‘lchanadi. | — | — |
| OPS-04.04 | CORE-1 | todo | N+1 so‘rovlarni kamaytirish, indekslar, cheklangan pagination va katta eksport uchun worker. | — | — |
| OPS-04.05 | CORE-1 | todo | Hisob/ruxsat ma’lumotini eskirgan keshdan olish xavfini boshqarish. | — | — |
| OPS-04.06 | CORE-1 | todo | Stress, uzoq davomli yuklama va tiklanish sinovlari. | — | — |
| QA-01.01 | CORE-1 | todo | Pul/chegirma/soliq/tannarx/nasiya formulalari uchun birlik testlari. | — | — |
| QA-01.02 | CORE-1 | todo | Haqiqiy PostgreSQL bilan savdo, qoldiq, qaytarish va migratsiya integratsion testlari. | — | — |
| QA-01.03 | CORE-1 | todo | Kassirning boshidan oxirigacha jarayonlari uchun brauzer testlari. | — | — |
| QA-01.04 | CORE-1 | todo | Tashkilot/rol/do‘kon chegaralarining barcha API guruhlari bo‘yicha testlari. | — | — |
| QA-01.05 | CORE-1 | todo | Parallel so‘rov va takror amal testlari. | — | — |
| QA-01.06 | CORE-1 | todo | Provider sandbox, timeout, noto‘g‘ri imzo, takror/kechikkan callback testlari. | — | — |
| QA-01.07 | CORE-1 | todo | Offline/reconnect, printer uzilishi, brauzer yopilishi va server restart sinovlari. | — | — |
| QA-01.08 | CORE-1 | todo | Paket xavfsizligi, secret scanning va stagingda xavfsizlik tekshiruvi. | — | — |
| QA-01.09 | CORE-1 | todo | Backup restore, migratsiya va chiqarishdan qaytish mashqi. | — | — |
| BIZ-01.01 | CORE-1 | todo | SaaS obuna, lokal o‘rnatish yoki ikkalasini qo‘llash modelini tanlash. | — | — |
| BIZ-01.02 | CORE-1 | todo | Tarifni filial/kassa/xodim yoki funksiyalar bo‘yicha tushunarli belgilash. | — | — |
| BIZ-01.03 | CORE-1 | todo | Sinov davri, obuna, hisob/invoice, to‘lov tarixi, yangilash va bekor qilish. | — | — |
| BIZ-01.04 | CORE-1 | todo | Tarif limitlarini backendda tekshirish; mavjud ma’lumotni limitdan oshganda yo‘qotmaslik. | — | — |
| BIZ-01.05 | CORE-1 | todo | Obuna tugaganda xabar, imtiyozli muddat, eksport va xavfsiz o‘qish rejimi siyosati. | — | — |
| BIZ-01.06 | CORE-1 | todo | Fiskal provayder, SMS, printer agenti va integratsiya xarajatlarini alohida hisoblash. | — | — |
| BIZ-01.07 | CORE-1 | todo | Marketing sahifasida haqiqatda ishlaydigan funksiyalar, narx, mos qurilmalar va yordam tartibi. | — | — |
| BIZ-02.01 | CORE-1 | todo | Tashkilotlar, tarif, xizmat holati, integratsiyalar va hodisalar uchun platforma admin paneli. | — | — |
| BIZ-02.02 | CORE-1 | todo | Support biznes ma’lumotiga faqat vaqtli, ruxsatli va auditli kira olishi. | — | — |
| BIZ-02.03 | CORE-1 | todo | Kassir/egasi uchun murojaat, diagnostika, javob muddati va favqulodda aloqa. | — | — |
| BIZ-02.04 | CORE-1 | todo | Mijozni o‘rnatish: import, boshlang‘ich qoldiq/qarz, qurilmalar, trening va ishga tushirish. | — | — |
| BIZ-02.05 | CORE-1 | todo | Ishga tushirishdan oldingi hisobni imzolangan/kelishilgan solishtirish bilan tasdiqlash. | — | — |
| BIZ-02.06 | CORE-1 | todo | Mavjud dasturdan ko‘chirishda ikki marta savdo yuritmaslik va o‘tish sanasini belgilash. | — | — |
| BIZ-02.07 | CORE-1 | todo | Xizmatdan chiqishda to‘liq ma’lumot eksporti va saqlash/o‘chirish tartibi. | — | — |
| LEG-01.01 | CORE-1 | blocked_external | Mijoz/xodim telefonlari, savdo va qarz tarixining maqsadi, kirishlari va saqlash muddatini belgilash. | — | — |
| LEG-01.02 | CORE-1 | blocked_external | Amaldagi shaxsga doir ma’lumotlar, saqlash joyi va reestr talablarini tegishli ma’lumot toifasi uchun tekshirish; hostingni shu tekshiruvdan keyin tanlash. | — | — |
| LEG-01.03 | CORE-1 | blocked_external | Maxfiylik siyosati, foydalanish shartlari, xizmat shartnomasi va javobgarlik chegarasi. | — | — |
| LEG-01.04 | CORE-1 | blocked_external | Qonun talab qiladigan moliyaviy yozuvlarni saqlash bilan shaxsiy ma’lumotni o‘chirish talabini moslashtirish. | — | — |
| LEG-01.05 | CORE-1 | blocked_external | Elektron chek, xizmat eslatmasi va reklama roziligini alohida qayd etish. | — | — |
| LEG-01.06 | CORE-1 | blocked_external | Integratsiya, xosting va aloqa provayderlariga uzatiladigan ma’lumotlarni hujjatlashtirish. | — | — |
| PILOT-01.01 | CORE-1 | blocked_external | Kamida uchta biznesda kelishilgan savdo hajmi va qurilmalar bilan sinash. | — | — |
| PILOT-01.02 | CORE-1 | blocked_external | Kamida ikki hafta odatiy savdo; oy/davr yopilishi ssenariysini ham alohida tekshirish. | — | — |
| PILOT-01.03 | CORE-1 | blocked_external | Har kuni savdo, pul, qarz, qoldiq va fiskal/to‘lov natijalarini solishtirish. | — | — |
| PILOT-01.04 | CORE-1 | blocked_external | Qaytarish, nasiya undirish, transfer, internet/printer uzilishi real yoki boshqariladigan sinovda bajarilishi. | — | — |
| PILOT-01.05 | CORE-1 | blocked_external | Kassir va egasi fikri, yordam murojaatlari va sarflangan vaqtni qayd qilish. | — | — |
| PILOT-01.06 | CORE-1 | blocked_external | Ma’lumot yo‘qolishi, ruxsatsiz kirish va hal qilinmagan pul farqi bo‘lmasligi. | — | — |
| RELEASE-01.01 | CORE-1 | todo | Chiqarish doirasidagi barcha P0 va zarur P1 vazifalar yopilgan. | — | — |
| RELEASE-01.02 | CORE-1 | todo | Muhim hisob/ruxsat ssenariylari avtomatik va amaliy sinovdan o‘tgan. | — | — |
| RELEASE-01.03 | CORE-1 | todo | Qaytarish, nasiya, xarid va smena hisoblari bir-biriga mos. | — | — |
| RELEASE-01.04 | CORE-1 | todo | Fiscal/markirovka talabi tegishli mijozlar uchun bajarilgan. | — | — |
| RELEASE-01.05 | CORE-1 | todo | Tanlangan qurilmalar sinovdan o‘tgan va moslik ro‘yxati e’lon qilingan. | — | — |
| RELEASE-01.06 | CORE-1 | todo | Real backup tiklash, migratsiya va qaytish mashqi muvaffaqiyatli. | — | — |
| RELEASE-01.07 | CORE-1 | todo | Kuzatish, ogohlantirish va javobgar yordam xodimi mavjud. | — | — |
| RELEASE-01.08 | CORE-1 | todo | Yuklama natijalari va xizmat ko‘rsatish maqsadlari hujjatlashtirilgan. | — | — |
| RELEASE-01.09 | CORE-1 | todo | Import, boshlang‘ich hisob, trening va onboarding qo‘llanmasi tayyor. | — | — |
| RELEASE-01.10 | CORE-1 | todo | Xizmat shartlari, maxfiylik, tarif va eksport/o‘chirish siyosati tayyor. | — | — |
| RELEASE-01.11 | CORE-1 | todo | Pilotta ochiq kritik yoki yuqori darajadagi xatolar qolmagan. | — | — |
| RELEASE-01.12 | CORE-1 | todo | Bozorga va’da qilinadigan har funksiya haqiqatan shu release’da ishlaydi. | — | — |
| MODEL-01 | CORE-1 | todo | PLAN1 jadvali, 1-qator/bosqich | — | — |
| MODEL-02 | CORE-1 | todo | PLAN1 jadvali, 2-qator/bosqich | — | — |
| MODEL-03 | CORE-1 | todo | PLAN1 jadvali, 3-qator/bosqich | — | — |
| MODEL-04 | CORE-1 | todo | PLAN1 jadvali, 4-qator/bosqich | — | — |
| MODEL-05 | CORE-1 | todo | PLAN1 jadvali, 5-qator/bosqich | — | — |
| MODEL-06 | CORE-1 | todo | PLAN1 jadvali, 6-qator/bosqich | — | — |
| MODEL-07 | CORE-1 | todo | PLAN1 jadvali, 7-qator/bosqich | — | — |
| MODEL-08 | CORE-1 | todo | PLAN1 jadvali, 8-qator/bosqich | — | — |
| MODEL-09 | CORE-1 | todo | PLAN1 jadvali, 9-qator/bosqich | — | — |
| MODEL-10 | CORE-1 | todo | PLAN1 jadvali, 10-qator/bosqich | — | — |
| MODEL-11 | CORE-1 | todo | PLAN1 jadvali, 11-qator/bosqich | — | — |
| MODEL-12 | CORE-1 | todo | PLAN1 jadvali, 12-qator/bosqich | — | — |
| MODEL-13 | CORE-1 | todo | PLAN1 jadvali, 13-qator/bosqich | — | — |
| MODEL-14 | CORE-1 | todo | PLAN1 jadvali, 14-qator/bosqich | — | — |
| SCENARIO-01 | CORE-1 | todo | PLAN1 jadvali, 1-qator/bosqich | — | — |
| SCENARIO-02 | CORE-1 | todo | PLAN1 jadvali, 2-qator/bosqich | — | — |
| SCENARIO-03 | CORE-1 | todo | PLAN1 jadvali, 3-qator/bosqich | — | — |
| SCENARIO-04 | CORE-1 | todo | PLAN1 jadvali, 4-qator/bosqich | — | — |
| SCENARIO-05 | CORE-1 | todo | PLAN1 jadvali, 5-qator/bosqich | — | — |
| SCENARIO-06 | CORE-1 | todo | PLAN1 jadvali, 6-qator/bosqich | — | — |
| SCENARIO-07 | CORE-1 | todo | PLAN1 jadvali, 7-qator/bosqich | — | — |
| SCENARIO-08 | CORE-1 | todo | PLAN1 jadvali, 8-qator/bosqich | — | — |
| SCENARIO-09 | CORE-1 | todo | PLAN1 jadvali, 9-qator/bosqich | — | — |
| SCENARIO-10 | CORE-1 | todo | PLAN1 jadvali, 10-qator/bosqich | — | — |
| SCENARIO-11 | CORE-1 | todo | PLAN1 jadvali, 11-qator/bosqich | — | — |
| SCENARIO-12 | CORE-1 | todo | PLAN1 jadvali, 12-qator/bosqich | — | — |
| STAGE-00 | CORE-1 | todo | PLAN1 jadvali, 0-qator/bosqich | — | — |
| STAGE-01 | CORE-1 | todo | PLAN1 jadvali, 1-qator/bosqich | — | — |
| STAGE-02 | CORE-1 | todo | PLAN1 jadvali, 2-qator/bosqich | — | — |
| STAGE-03 | CORE-1 | todo | PLAN1 jadvali, 3-qator/bosqich | — | — |
| STAGE-04 | CORE-1 | todo | PLAN1 jadvali, 4-qator/bosqich | — | — |
| STAGE-05 | CORE-1 | todo | PLAN1 jadvali, 5-qator/bosqich | — | — |
| STAGE-06 | CORE-1 | todo | PLAN1 jadvali, 6-qator/bosqich | — | — |
| STAGE-07 | EXTENSIONS | deferred | PLAN1 jadvali, 7-qator/bosqich | — | — |
| SEGMENT-01 | EXTENSIONS | deferred | PLAN1 jadvali, 1-qator/bosqich | — | — |
| SEGMENT-02 | EXTENSIONS | deferred | PLAN1 jadvali, 2-qator/bosqich | — | — |
| SEGMENT-03 | EXTENSIONS | deferred | PLAN1 jadvali, 3-qator/bosqich | — | — |
| SEGMENT-04 | EXTENSIONS | deferred | PLAN1 jadvali, 4-qator/bosqich | — | — |
| SEGMENT-05 | EXTENSIONS | deferred | PLAN1 jadvali, 5-qator/bosqich | — | — |
| SEGMENT-06 | EXTENSIONS | deferred | PLAN1 jadvali, 6-qator/bosqich | — | — |
| SEGMENT-07 | EXTENSIONS | deferred | PLAN1 jadvali, 7-qator/bosqich | — | — |
| SEGMENT-08 | EXTENSIONS | deferred | PLAN1 jadvali, 8-qator/bosqich | — | — |

## 2026-10-05 texnik checkpoint

- Unit: 6 sinov; PostgreSQL integration: 26 sinov; haqiqiy Chromium/HTTPS browser: 1 kompleks sinov o‘tdi. Lint 0 error / 0 warning, typecheck va Next16.3.8 production build o‘tdi.
- Browser: ro‘yxatdan o‘tish, Secure/HttpOnly cookie, smena ochish, IndexedDB savatni reload bilan tiklash; server savdoni commit qilganidan keyin HTTP javobni uzish va operation recovery orqali bitta sale/payment/stock effektini olish tekshirildi.
- Migration 010 terminal cancelled operationni qo‘shadi. Kechikkan posting cancellation tombstone bilan to‘qnashadi; mavjud savdoni void qilish manager vakolatida qoladi. Real bazaga migration qo‘llanmagan.
- Node24 non-root Docker image va ichidagi migration CLI sinovi o‘tdi; yakuniy Next16.3.8/cancellation image qayta build qilindi, vaqtinchalik image container readiness=200 va migration CLI 11 migration up-to-date ekanini tasdiqladi. CIga browser va runtime audit qo‘shildi; remote CI hali ishlatilmagan.
- Fresh hamda eski discounted-credit fixture bazadan migration sinovlari o‘tdi. GPG encrypted backup/checksum va bo‘sh DBga transactional restore sinovi o‘tdi. Migration010dan keyin ikkala smoke sinovi qayta o‘tdi. Real eski business data clone/PITR/off-site retention hali tekshirilmagan.
- Qo‘shilgan core: invitation qabul/revoke/expiry va account takeoverdan himoya; tenant unit precision, qo‘shimcha barkodlar va tarixiy unit snapshot; reconciliation hisoboti. Ownership API sinovi bor; UI/reauth hali kerak.
- Runtime dependency auditda 0 vulnerability; development ESLint glob zanjiridagi upstream braces topilmasi ADR-006da qayd etilgan.
- Core manual payment vendor tasdig‘i emas; status `recorded`. Nasiya/payment/sale/refund alohida business oqimlari.
- Tashqi integratsiyalar scope tashqarisida; interfeyslar `src/server/integrations/contracts.ts`da. Mavjud browser print/camera barcode saqlangan.
- Ochiq core ishlar: PIN/MFA/reset, birlik conversion/narx tarixi/variants/import, purchase order/supplier ledger, inventar zonalari/reservlar, expense/tax, full export, keng offline conflict UI/PWA, yuklama sinovlari va boshqa jadvaldagi yakunlanmagan ishlar. Bu checkpoint production tayyorligi yoki butun PLAN1 tugaganligi tasdig‘i emas.

## Ombor checkpoint — 2026-10-05

- Bazaviy commit `ffc9a47` va keyingi ishchi daraxt: INV-01.03 va INV-01.05 qabul mezonlari bajarildi. Manbalar: `src/server/inventory/documents.ts`, inventory UI, migration011/012, `tests/economic.integration.test.ts`, `tests/e2e/core.spec.ts`.
- 19 integration sinovi: confirmed header/item update/delete/add rad, original saqlanishi, inverse weighted cost, insufficient-stock rollback, bir kalitning parallel reversal natijasi; draft cancel/send race; transit partial/full return; concurrent receive/return conservation.
- Chromium production HTTPS scenario checkout recovery + stock reversal UI + transit return UI bilan o‘tdi. Lint 0 error/warning, typecheck, Next production build va git diff whitespace tekshiruvi o‘tdi.
- Fresh va legacy fixturega 13 migration o‘tdi; shifrlangan backup va bo‘sh DBga transactional restore qayta o‘tdi. Haqiqiy biznes bazasiga tegilmadi. Readiness contract migration012ga yangilandi.
- StockDocument draft edit endi create kabi signed 6-decimal quantity/nonnegative cost, 1–500 satr va bounded note tekshiradi; transaction ichida live session va scoped locked document tekshiruvi, audit bor.
- Docker image ushbu migrationlar bilan qayta build qilindi; vaqtinchalik non-root container readiness=200, image CLI 13 migrations up-to-date. Pilot/production deploy va barcha PLAN1 tugallanishi hali tasdiqlanmagan.

## Inventarizatsiya checkpoint — 2026-10-05

- Bazaviy `e8b2e49` va keyingi ishchi daraxt: INV-02.01/02/03 qabul mezonlari bajarildi. Manbalar: `src/server/inventory/counts.ts`, `movements.ts`, `/api/stock-counts`, `/inventory/counts`, migration013/014, iqtisodiy va browser testlar.
- 22 integration sinovi o‘tdi: blind DTO, partial/full count, selected balance update/delete va sale posting bloklanishi; recountsiz farq reject; bir key parallel approval → bitta adjustment; terminal reading append/update reject; cancel → freeze release/no stock effect; concurrent checkout → count expected=current checkpoint; unselected SKU savdosi va zero-difference approval.
- Chromium HTTPS real UI: count boshlash, expected yashirinligi, reading, submit/review, recount, reason/approval, linked adjustment va freeze release o‘tdi. Lint/typecheck/production build va diff check o‘tdi.
- 15 migration fresh va legacy fixturega qo‘llandi; encrypted backupdan active count + expected quantity + reading + freeze + actual balance aynan tiklandi. Real biznes bazasiga tegilmadi. Readiness migration014ni talab qiladi.
- Qo‘llanma ADR-009 va OPERATIONS_RUNBOOKda. Docker image build o‘tdi; vaqtinchalik non-root container readiness=200, image migration CLI 15 migration up-to-date. Barcha PLAN1 yoki real production/pilot qabul hali tugamagan.

## Mijoz qarz checkpoint — 2026-10-05

- Bazaviy `11cbbc6` va keyingi ishchi daraxt. CRM-01.06 yakunlandi; CRM-01.05/07 uchun opening hujjat va debt statement qo‘shildi, qolgan scope jadvallarda ochiq.
- `src/server/customers/ledger.ts`, owner `/customers/:id/ledger` API va CustomerLedger UI: new immutable opening/increase/decrease/write-off, reason/actor/effective/due dates; shift/paymentdan mustaqil liability hujjati. Sale debt write-off owner vakolatida, mavjud customer/account/receipt mosligi serverda tekshiriladi.
- 26 PostgreSQL integration sinovi o‘tdi: source/idempotency race, old row update/delete reject, no fake cash, reduction bound, statement pagination/date running balances, cross-tenant/role reject, waived full/partial/mixed refunds, unrelated duplicate conflict; old POS/count/transfer tests saqlangan.
- Chromium production HTTPS scenario debt document va debt cash collection javoblarini real commitdan keyin uzib, same key bilan aynan bitta hujjat/to‘lov effektini oldi. Form payload response noaniq bo‘lganda o‘zgartirilmaydi. Money collection input string + fixed-point validation; float calculation yo‘q.
- Lint/typecheck/production build va 16 fresh/legacy migrations o‘tdi. Backup smoke count/freeze va customer ledger actor/effective/due fieldsni tiklaydi. Real biznes bazasi/tashqi adapterga tegilmadi. Readiness migration015ni talab qiladi.
- Docker image build o‘tdi; final non-root container readiness=200 va image CLI 16 migrations up-to-date. Barcha PLAN1 yoki real production qabul tugagan deb belgilanmadi.

- Qo‘shimcha browser tekshiruvi: collection javobi yo‘qolgach original smena yopildi; close expectedCash to‘lovni aynan bir marta oldi. Original collection key bilan natija yopiq smenadan ham tiklandi; yangi collection uchun ochiq smena talabi saqlanadi.


### CRM-01.05: savdo qarziga aniq allocation — 2026-10-05

- Bazaviy `db56152` va ishchi daraxt: `src/server/payments/collections.ts`, `tests/economic.integration.test.ts`, `api.md`.
- Ixtiyoriy `allocations` orqali har bir tanlangan savdoga aniq summa ajratiladi; mavjud FIFO payloadlar o‘zgarmaydi. API va sync bitta service/schema ishlatadi. Har ledger allocation payment UUID va debt origin UUID bilan bog‘langan.
- Decimal jami paymentga teng; duplicate target, begona/yo‘q target, target qoldig‘idan oshish rad etiladi. Kechroq target xato bo‘lsa oldingi allocation/payment ham rollback; parallel ayni operation ikki marta posting qilmaydi, o‘zgargan payload replay rad.
- Dalil: `npm test` 6/6; izolyatsiyalangan `pos_test` bilan `npm run test:integration` 27/27; `npm run lint`, `npm run typecheck`, `npm run build` muvaffaqiyatli. Loglar: `/tmp/pos-unit.log`, `/tmp/pos-integration.log`, `/tmp/pos-lint.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-build.log`. UI o‘zgarmagan; bu bosqichda browser test qayta ishlatilmagan.
- CRM-01.05 hali `in_progress`: explicit tanlash UI, opening hujjatlariga individual allocation va legacy noaniq taqsimotlarni vakolatli tuzatish qolgan. `saleId: null` umumiy guruh; eski immutable tarixga taxminiy bog‘lanish yozilmadi. Yangi migration va real DB o‘zgarishi yo‘q. Tashqi integratsiyalarga tegilmadi.


### CRM-01.05: qarz tanlash UI — 2026-10-05

- Bazaviy `7afb9b1` va ishchi daraxt: customer detail/list UI, `DebtAllocationPicker`, debt API, API/types, browser va foundation integration testlari.
- Owner mijoz kartasida FIFO yoki explicit taqsimotni tanlaydi. Har chek uchun summa, joriy qoldiq va 50 tadan pagination mavjud. Sahifalararo tanlovlar saqlanadi; jami BigInt orqali to‘lovga solishtiriladi. Yuborilgan payloadda taqsimot nusxasi saqlanadi; javob noaniq bo‘lsa maydonlar va yopish bloklanadi, retry ayni payload bilan bajariladi. Admin/cashier FIFO ishlashi saqlangan.
- Ochiq target API faqat owner; tenant scope, pozitiv net balans, yopilgan targetni chiqarish, page validation tekshirildi. Mijozlar ro‘yxatidagi ism orqali karta ochiladi.
- Dalil: izolyatsiyalangan `pos_test` integration 28/28; HTTPS Chromium E2E 1/1. Browser aniq kredit chekiga 10.25 ajratadi, commitdan keyin javob uziladi, smena yopiladi, retry yagona undirishni tiklaydi; chek qoldig‘i 90, mijoz jami qarzi 170. `npm run build`, lint va typecheck muvaffaqiyatli. `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-build.log`, `/tmp/pos-lint.log`, `/tmp/pos-typecheck.log`.
- CRM-01.05 hali in_progress: alohida opening hujjatlari allocationlari va eski noaniq taqsimotlarni vakolatli tuzatish qolgan. Pending undirish hali xotirada; reload/offline durable recovery alohida qolgan ish. Migration, real DB va tashqi integratsiyalar o‘zgarmagan.
