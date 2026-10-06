# Bajarish statusi

Sana: 2026-10-06. Barcha PLAN1 bandlari quyida kuzatiladi. Kod mavjudligi yakuniy qabul dalili emas. Oldingi foundation kodi mavjud `9594e50` commitda; keyingi o‘zgarishlar ishchi daraxtda. Avtomatik commit yaratilmaydi.

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
| SEC-01.03 | CORE-1 | done | Do‘kon, kassa, smena, mahsulot, mijoz va to‘lov bir tashkilotga tegishli ekanini tekshirish. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| SEC-01.04 | CORE-1 | in_progress | Egasi/admin/kassir uchun amallar jadvalini yozish va serverda qo‘llash. | Live Session, route matrix, scopedPrisma, withApi, SQL scope; tenant/revoke/CSRF tests | Har yangi endpoint/export/worker uchun negative permission coverage va browser acceptance |
| SEC-01.05 | CORE-1 | done | Kassir boshqa kassir smenasida ruxsatsiz savdo qilmasligi; tannarx va foydani vakolatsiz ko‘rmasligi. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| SEC-01.06 | CORE-1 | done | Ruxsatlar bekor bo‘lganda eski sessiya ham bu amallarni bajara olmasligi. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| SEC-01.07 | CORE-1 | in_progress | Admin panel va yordam xizmati kirishlarini ham shu nazoratga olish. | Live Session, route matrix, scopedPrisma, withApi, SQL scope; tenant/revoke/CSRF tests | Har yangi endpoint/export/worker uchun negative permission coverage va browser acceptance |
| SEC-02.01 | CORE-1 | in_progress | HTTPS; productionda kuchli kalit majburiy, standart kalit bilan ishga tushmaslik. | HTTPS origin startup validation, cookie, DB login limit, bounded JSON, requestId | TLS hosting, reset/import limits, fayl/CSV himoyasi va security-event UI |
| SEC-02.02 | CORE-1 | in_progress | Brauzer uchun xavfsiz sessiya yechimi: HttpOnly/Secure cookie, muddat, serverda bekor qilish; cookie ishlatilsa CSRF himoyasi. | Live Session, route matrix, scopedPrisma, withApi, SQL scope; tenant/revoke/CSRF tests | Har yangi endpoint/export/worker uchun negative permission coverage va browser acceptance |
| SEC-02.03 | CORE-1 | in_progress | Chiqish, barcha qurilmalardan chiqish, parol almashtirish va parol tiklash. | Logout/logout-all/change-password UI; shared UTF-8 password policy; atomic session revocation and password race protection; pending intent guards | Forgotten-password reset and real delivery boundary remain |
| SEC-02.04 | CORE-1 | todo | Telefon/e-mail tasdiqlash, bir martalik kod muddati va urinishlar chegarasi. | — | — |
| SEC-02.05 | CORE-1 | in_progress | Kirish, tiklash, import va qimmat so‘rovlarda tezlik/hajm cheklovlari. | PostgreSQL login/register/operation/report/CSV/session budgets; Retry-After; bounded request and 10000-row export caps | Reset/import/worker/hosting traffic protection remains |
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
| POS-01.01 | CORE-1 | done | Narx, tannarx, birlik, kassir va vakolatlarni serverda ishonchli manbadan olish. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-01.02 | CORE-1 | done | Bo‘sh savat, manfiy/yaroqsiz son, ortiqcha chegirma va noto‘g‘ri IDlarni rad etish. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-01.03 | CORE-1 | done | Savdo, to‘lov, ombor va auditni bitta nazorat qilinadigan amalda yakunlash. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-01.04 | CORE-1 | done | Takror so‘rov bir savdoni ikki marta yozmasligi uchun yagona amal kaliti qo‘shish — idempotency. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-01.05 | CORE-1 | done | Ochiq smena, qoldiq, limit va holatni tranzaksiya ichida tekshirish; parallel amallardan himoya. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-01.06 | CORE-1 | in_progress | Chek raqamini yozuvlar soniga bog‘lamasdan noyob ajratish; fiskal raqamni alohida saqlash. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-01.07 | CORE-1 | done | Timeoutdan keyin “sotildimi?” holatini tekshirib, xavfsiz davom ettirish. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-01.08 | CORE-1 | done | Yakunlangan savdoni yashirin tahrirlash/o‘chirishni taqiqlash; tuzatishni qarshi hujjat bilan yuritish. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-02.01 | CORE-1 | in_progress | Qoralamani saqlash, vaqtincha chetga qo‘yish, qayta ochish va bekor qilish. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-02.02 | CORE-1 | done | Savatni brauzer yopilishi/yangilanishidan tiklash; qurilma va foydalanuvchi chegarasi. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-02.03 | CORE-1 | done | Aralash to‘lov: masalan, 60 000 naqd + 40 000 karta; qisman nasiya. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-02.04 | CORE-1 | done | Qaytimni haqiqiy naqd berilgan summa bilan ko‘rsatish, tushumga faqat tegishli summani yozish. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-02.05 | CORE-1 | in_progress | Klaviatura tezkor tugmalari, USB skaner, tezkor mahsulotlar, qulay qidiruv. | F2/F4/F9/Esc UI shortcuts with local/unknown/dialog/typing guards; existing keyboard barcode input | Quick-product presets and complete scanner/keyboard acceptance remain; special hardware deferred |
| POS-02.06 | CORE-1 | in_progress | Har qator/butun chek chegirmasi; foiz/summa; sabab va tasdiq. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-02.07 | CORE-1 | in_progress | Qoldiq va narx o‘zgarganini savat yakunida tushunarli ko‘rsatish. | Sales service, Decimal, operation ledger, SQL locks; economic tests; local basket/status recovery UI | Browser checkout/recovery/zero-price/discount tests; qoralama/conflict resolution; fiscal raqam external-later |
| POS-02.08 | CORE-1 | done | Mijoz tanlash, chek izohi, sotuvchi/xizmat turi kerak bo‘lsa belgilash. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-02.09 | CORE-1 | in_progress | Chekni qayta chiqarish, elektron chek, 58/80 mm andozalari; qayta chiqarishni belgilash. | 58/80mm browser print/PDF; isolated receipt document; copy/nonfiscal/draft labels; original cashier/timezone; no economic repost | Idempotent print-request audit via Operation; owner audit CSV; electronic delivery and historical organization snapshot remain |
| RET-01.01 | CORE-1 | done | Original chek bo‘yicha to‘liq va qisman qaytarish. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| RET-01.02 | CORE-1 | done | Oldingi qaytarishlarni hisobga olish; sotilganidan ko‘p qaytarishni taqiqlash. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| RET-01.03 | CORE-1 | in_progress | Chegirma va soliqni qaytarilayotgan qatorga to‘g‘ri taqsimlash. | Internal return service + UI, receipt allocation, cash/debt conservation, retry tests | Disposition UI, repayment-channel policy, tax snapshot, manager approval acceptance |
| RET-01.04 | CORE-1 | in_progress | Tovar omborga qaytadimi, brak omborigami yoki hisobdan chiqadimi — aniq tanlash. | Per-item sellable/damaged/write_off UI, paginated scoped return history with frozen item names, transactional refund/stock/replay tests | Dedicated damaged-stock warehouse/location remains |
| RET-01.05 | CORE-1 | in_progress | Naqd/karta/nasiya aralash savdoda pul va qarzning qaytarish tartibini belgilash. | Internal return service + UI, receipt allocation, cash/debt conservation, retry tests | Disposition UI, repayment-channel policy, tax snapshot, manager approval acceptance |
| RET-01.06 | EXTERNAL-LATER | deferred | Provayder orqali refund, uning kutish/xato holati va takror so‘rovdan himoya. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| RET-01.07 | CORE-1 | done | Sabab, vakolat, tasdiqlovchi, qaytarma chek va audit. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| RET-01.08 | CORE-1 | todo | Tovar almashtirishni original qaytarish + yangi savdo sifatida bog‘lash. | — | — |
| CAT-01.01 | CORE-1 | in_progress | Kategoriya daraxti, brend, rasm, tavsif va faol/arxiv holati. | Product/category archive filters; category CRUD/order/search/paging/CSV; manager restore UI; historical records retained | Category tree, brand, description/image management remain |
| CAT-01.02 | CORE-1 | in_progress | Bir mahsulot uchun bir nechta barkod; barkod yaratish va etiketka chiqarish. | Existing multi-barcode service/UI; now stable paginated/searchable complete lists and manager bounded full CSV; primary guard preserved | Label generation/print remains; special hardware external-later |
| CAT-01.03 | CORE-1 | todo | Rang/o‘lcham kabi variantlar; har variantning alohida qoldig‘i va barkodi. | — | — |
| CAT-01.04 | CORE-1 | todo | Birlik konvertatsiyasi: 1 quti = 12 dona; asosiy birlikda qoldiq, hujjatda savdo birligi. | — | — |
| CAT-01.05 | CORE-1 | in_progress | Kasr bilan sotish, birlik aniqligi, tarozi barkodidan vazn/narx ajratish. | Existing unit precision/service guard; complete manager paginated unit management/search/CSV | Scale-barcode parsing requires approved format; real scale hardware external-later |
| CAT-01.06 | CORE-1 | todo | Chakana/ulgurji/mijoz narxlari; filial narxi va sanadan kuchga kiradigan narx. | — | — |
| CAT-01.07 | CORE-1 | todo | Narx tarixi va ommaviy o‘zgartirish; tannarx uchun alohida ruxsat. | — | — |
| CAT-01.08 | CORE-1 | in_progress | Excel/CSV import, oldindan ko‘rish, dublikat/xato qatorlar hisoboti, eksport. | Full filtered active catalog CSV with primary/additional barcodes, Decimal prices/cost, formula protection, tenant/role/cap/rate limit and UI | CSV/XLSX import preview/duplicate/error workflow and XLSX export remain |
| CAT-01.09 | CORE-1 | todo | Soliq turi, MXIK va markirovka xususiyatlari tegishli tovar uchun. | — | — |
| INV-01.01 | CORE-1 | in_progress | Har bir o‘zgarish uchun hujjat va ombor harakati; bevosita qoldiqni almashtirishni taqiqlash. | Atomic movement journal; scoped/filterable journal UI and signed Decimal full CSV; stock documents, partial transfers, weighted cost tests | Stock reconciliation, cancellation/reversal, shortage/damage, purchase history UI |
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
| PUR-01.01 | CORE-1 | in_progress | Yetkazib beruvchi kartasi, kontaktlar, rekvizitlar, shartlar va tarix. | Supplier create/edit/archive/restore/search/paging UI and contacts card; scoped document history/date/status/paging/full CSV; confirmed purchase/reversal value summary | Commercial terms and supplier payment/debt ledger remain |
| PUR-01.02 | CORE-1 | todo | Buyurtma → qisman/to‘liq qabul → xarid hisoboti → to‘lov zanjiri. | — | — |
| PUR-01.03 | CORE-1 | todo | Yetkazib beruvchiga qaytarish, narx/miqdor farqi va qarzni yangilash. | — | — |
| PUR-01.04 | CORE-1 | todo | Yetkazib beruvchi qarzi, oldindan to‘lov va qisman to‘lash. | — | — |
| PUR-01.05 | CORE-1 | todo | Yetkazish/xarid xarajatlarini tannarxga taqsimlash siyosati. | — | — |
| PUR-01.06 | CORE-1 | in_progress | Xarid narxi tarixi, mahsulot/yetkazib beruvchi bo‘yicha tahlil. | Supplier scoped item cost/quantity history and confirmed purchase/reversal value totals, event dates, exact rounded SQL; full CSV | Product/supplier comparison and price-trend reports remain |
| CRM-01.01 | CORE-1 | in_progress | Nasiya uchun mijoz, vakolat va limitni serverda majburiy tekshirish. | DebtEntry alohida ledger, FIFO collection allocation, customer locking, cash/debt return tests | Opening debt, advance/statement/due-date UI; non-cash refund policy; provider card external-later |
| CRM-01.02 | CORE-1 | in_progress | Qarz yozuvini haqiqiy pul to‘lovidan ajratish: nasiya naqd tushum deb olinmasligi. | DebtEntry alohida ledger, FIFO collection allocation, customer locking, cash/debt return tests | Opening debt, advance/statement/due-date UI; non-cash refund policy; provider card external-later |
| CRM-01.03 | CORE-1 | in_progress | Qarzni naqd/karta/o‘tkazma bilan undirish; pulni haqiqiy smena yoki hisobga yozish. | DebtEntry alohida ledger, FIFO collection allocation, customer locking, cash/debt return tests | Opening debt, advance/statement/due-date UI; non-cash refund policy; provider card external-later |
| CRM-01.04 | CORE-1 | in_progress | Qisman undirish, oldindan to‘lov, ortiqcha to‘lov va qaytarish qoidalari. | DebtEntry alohida ledger, FIFO collection allocation, customer locking, cash/debt return tests | Opening debt, advance/statement/due-date UI; non-cash refund policy; provider card external-later |
| CRM-01.05 | CORE-1 | in_progress | To‘lovni qaysi qarz/savdoga ajratishni yuritish; boshlang‘ich qarzni alohida hujjat bilan kiritish. | Opening debt source/actor/date/due/reason API+owner UI; sale-based FIFO + explicit per-sale amount allocations via API/sync + owner customer-card UI; paginated positive targets; general opening group; immutable document tests | Individual opening-document allocations and legacy allocation repair remain |
| CRM-01.06 | CORE-1 | done | Qarzni o‘chirish/tuzatish faqat sabab, vakolat va audit bilan. | Owner-only immutable new adjustment/write-off; bounds/tenant/live auth/idempotency; migration015 append-only DB guard; weighted write-off refund conservation tests; real browser duplicate prevention | No original ledger edit/delete; correction is a new audited entry |
| CRM-01.07 | CORE-1 | in_progress | Mijoz ko‘chirmasi: savdo, qaytarish, to‘lov, qarz qoldig‘i va muddat. | Owner debt statement: sources/receipt/actor/reason/effective/due dates, timezone period, opening/closing/running/global balance, pagination; owner bounded full-period debt CSV + formula protection; SQL repeatable-read/window tests | Customer cash/credit sales + returns history UI done; Owner combined commercial CSV, checkout due-date UI and debt HTML/PDF print done; Current sale-based aging done; opening/legacy document allocation remains |
| CRM-02.01 | CORE-1 | in_progress | P1: mijoz qidirish, dublikatlarni nazorat qilish, xarid tarixi, guruhlar va narx darajasi. | Active customer search and owner full CSV export with Decimal current debt; existing customer purchase history | Manager archive/restore with locked nonzero debt/advance guard; duplicate rules, groups and price levels remain |
| CRM-02.02 | CORE-1 | todo | P1: qarz muddati/kechikish hisoboti, mijozga ko‘chirma va rozilik asosida eslatma. | — | — |
| CRM-02.03 | EXTENSIONS | deferred | P2: bonus ballari, chegirma kartasi, promo-kod va sovg‘a sertifikati. | — | — |
| CRM-02.04 | EXTENSIONS | deferred | P2: bonusning qaytarishda bekor bo‘lishi, muddati va suiiste’moldan himoya. | — | — |
| CRM-02.05 | EXTENSIONS | deferred | P2: marketing SMS/Telegram; xizmat xabari va reklama roziligini alohida boshqarish. | — | — |
| FIN-01.01 | CORE-1 | done | Har kassada bir ochiq smena qoidasi bazada ham himoyalangan bo‘lishi. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| FIN-01.02 | CORE-1 | in_progress | Smenani ochish, yopish va topshirish; ochiq savdolar/integratsiya kutishlari uchun siyosat. | Open-shift unique index, cash ledger, immutable close, checkout cost snapshot; economic tests | Handover/approval/cash tender snapshot, tax snapshots, browser acceptance |
| FIN-01.03 | CORE-1 | done | Savdo, qarz undirish, refund, naqd kirim/chiqim va inkassatsiyani alohida hisoblash. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| FIN-01.04 | CORE-1 | in_progress | Sanalgan pul, kutilgan pul, farq, sabab va rahbar tasdig‘i. | Open-shift unique index, cash ledger, immutable close, checkout cost snapshot; economic tests | Handover/approval/cash tender snapshot, tax snapshots, browser acceptance |
| FIN-01.05 | CORE-1 | done | Naqd savdoda berilgan pul/qaytimni tushum bilan chalkashtirmaslik. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| FIN-01.06 | EXTERNAL-LATER | deferred | Karta/QR/o‘tkazma bo‘yicha provayder tushumi, komissiya va bank tushumini solishtirish. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| FIN-01.07 | CORE-1 | done | Yopilgan smenani yashirin tahrirlamaslik; tuzatish hujjati. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| FIN-02.01 | CORE-1 | done | Tannarx usulini belgilash: dastlab vaznli o‘rtacha; FIFO/partiya ehtiyoji bo‘lsa kengaytirish. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| FIN-02.02 | CORE-1 | in_progress | Har savdo qatorining tarixiy tannarxi, chegirmasi, solig‘i va yaxlitlanishini saqlash. | Open-shift unique index, cash ledger, immutable close, checkout cost snapshot; economic tests | Handover/approval/cash tender snapshot, tax snapshots, browser acceptance |
| FIN-02.03 | CORE-1 | done | Chek chegirmasini qatorlarga taqsimlash; qaytarishni shu qiymatlardan hisoblash. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| FIN-02.04 | CORE-1 | todo | Biznes xarajatlari, toifalari va to‘lov hisoblari. | — | — |
| FIN-02.05 | CORE-1 | todo | Yalpi foyda va operatsion foydani aniq ajratish; to‘liq buxgalteriya hisobi bilan teng deb ko‘rsatmaslik. | — | — |
| FIN-02.06 | CORE-1 | todo | Naqd, bank va provayder hisoblari orasidagi pul o‘tkazmalarini ikki marta tushum deb hisoblamaslik. | — | — |
| FIN-02.07 | CORE-1 | todo | Soliq stavkasi, imtiyoz, narx ichida/tashqarisida soliq siyosatini sozlash; stavka tarixini saqlash. | — | — |
| REP-01.01 | CORE-1 | done | P0: tashkilot va do‘kon filtri hamma ko‘rsatkichga tatbiq etilishi. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| REP-01.02 | CORE-1 | done | P0: vaqt zonasi, davr boshi/oxiri; oxirgi kun to‘liq kirishi. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| REP-01.03 | CORE-1 | done | P0: yig‘indilar joriy sahifadan emas, barcha mos yozuvlardan olinishi. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| REP-01.04 | CORE-1 | done | P0: sotuv, refund, nasiya va haqiqiy pul tushumi bir-biridan ajratilishi. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| REP-01.05 | CORE-1 | done | P0: tannarx har qator `miqdor × tarixiy tannarx`dan hisoblanishi. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| REP-01.06 | CORE-1 | in_progress | P1: savdo, mahsulot, kategoriya, kassir, filial va to‘lov turi kesimidagi tahlil. | Timezone date ranges, global totals, SQL products/lowStock pagination, historical cost/refunds | Reports fixture coverage; full exports, additional breakdowns, repeatable snapshot |
| REP-01.07 | CORE-1 | in_progress | P1: qoldiq qiymati, ombor harakati, kam qoldiq, yaroqlilik va sekin sotiladigan tovarlar. | Scoped movement journal; balance single-snapshot paging/search/lowStock and exact full CSV valuation/shortage | Expiry and slow-moving products analysis remain |
| REP-01.08 | CORE-1 | in_progress | P1: smena, pul farqi, mijoz qarzi muddati, yetkazib beruvchi qarzi va xarid hisoboti. | Scoped full shift CSV of frozen close totals/difference; current customer aging/ledger | Supplier debts and full purchase reporting remain |
| REP-01.09 | CORE-1 | in_progress | P1: to‘liq filtrlangan CSV/XLSX/PDF eksport; katta eksportni fon ishida bajarish. | Full filtered sales/returns, products, categories, units, barcodes, supplier contact/history, stock documents/transfers/balances, movements, shifts and minimal audit CSV; repeatable-read/Decimal/scope,10000 cap, bounded actor budgets, browser downloads | XLSX/PDF and background large exports remain |
| REP-01.10 | CORE-1 | done | P1: jadvaldagi umumiy son, eksport va dashboard bir davr uchun mos kelishi. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
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
| OFF-01.01 | CORE-1 | done | Tarmoq holatini ko‘rsatish, savatni xavfsiz saqlash va muvaffaqiyatsiz so‘rovni nazoratli takrorlash. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| OFF-01.02 | CORE-1 | done | Savdo yozilgan, ammo javob kelmagan holatda serverdagi natijani topish. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| OFF-01.03 | CORE-1 | todo | Printer ishlamasa savdoni ikkinchi marta yaratmasdan chekni qayta chiqarish. | — | — |
| OFF-01.04 | CORE-1 | in_progress | Qurilma ishdan chiqsa boshqa qurilmadan vakolatli davom ettirish. | Scoped IndexedDB cart/queue, status lookup, sync core, server-authoritative posting | PWA/catalog cache, conflict/cancel resolution UI, offline policy and browser crash tests |
| OFF-01.05 | CORE-1 | todo | Integratsiya xatosi, savdo xatosi va faqat chek chop etish xatosini alohida ko‘rsatish. | — | — |
| OFF-02.01 | CORE-1 | in_progress | PWA va lokal saqlash; mahsulot/narxlar uchun yangilanish chegarasi. | Scoped IndexedDB cart/queue, status lookup, sync core, server-authoritative posting | PWA/catalog cache, conflict/cancel resolution UI, offline policy and browser crash tests |
| OFF-02.02 | CORE-1 | done | Lokal savdo navbati, qurilma identifikatori va server bilan bir martalik sinxronlash. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| OFF-02.03 | CORE-1 | in_progress | Offline qoldiqni bir nechta kassada mutlaq kafolatlab bo‘lmasligini siyosat bilan hal qilish: rezerv, limit yoki ruxsatli manfiy qoldiq. | Scoped IndexedDB cart/queue, status lookup, sync core, server-authoritative posting | PWA/catalog cache, conflict/cancel resolution UI, offline policy and browser crash tests |
| OFF-02.04 | CORE-1 | in_progress | Eskirgan narx, nasiya limiti, bloklangan xodim va smena uchun alohida cheklov. | Scoped IndexedDB cart/queue, status lookup, sync core, server-authoritative posting | PWA/catalog cache, conflict/cancel resolution UI, offline policy and browser crash tests |
| OFF-02.05 | CORE-1 | done | Lokal ma’lumot xavfsizligi, chiqishda tozalash va sinxronlanmagan savdoni yo‘qotishdan himoya. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
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
| DATA-01.03 | CORE-1 | done | Qoldiq/savdo/smena holatini atomik o‘zgartirish; deadlock/konfliktni nazoratli qayta urinish. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
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
| QA-01.02 | CORE-1 | done | Haqiqiy PostgreSQL bilan savdo, qoldiq, qaytarish va migratsiya integratsion testlari. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
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


### Undirishning reload recovery qismi — 2026-10-05

- Bazaviy `fb81e1c` va ishchi daraxt: customer detail UI, `src/lib/offline.ts`, HTTPS browser testi. OFF-01.02 / OFF-02.02 / OFF-02.05 uchun qo‘shimcha dalil; bandlar to‘liq yakunlanmagan.
- Mijoz kartasidan undirish HTTPdan avval mavjud IndexedDB operations navbatiga yoziladi. Organization/user/device scope va customer bo‘yicha oldingi pending/conflict urinish tiklanadi; operationId, original shift/store, amount, note va explicit allocation saqlanadi. Lokal o‘qish xatosi yangi undirishni bloklaydi; lokal save tugamasa HTTP yuborilmaydi.
- Muvaffaqiyatli server javobi lokal `synced` bilan tasdiqlangach UI urinishni bo‘shatadi. Birinchi so‘rovdagi aniq validation/debt rejection lokal `rejected` terminal holatiga yoziladi; noaniq urinish retryidagi xatolar oldingi kalitni tashlab yubormaydi. `rejected` navbatdagi pending hisobiga kirmaydi; u server posting yoki cancellation emas.
- Yakuniy browser dalili: 100.25 kredit chek qarzi to‘liq undirildi; server commitdan keyingi javob uzildi; eski smena 200.50 cash bilan yopildi; sahifa reload qilindi; eski payload aynan teng holda qayta yuborildi. Yagona undirish, chek qarzi 0, umumiy opening qarzi 80; muvaffaqiyatdan keyingi reload qayta pending modal ochmaydi. Saqlangan retry uchun yangi qarz qoldig‘iga bog‘liq HTML max olib tashlanadi, server idempotency nazorati ishlaydi.
- Tekshiruv: integration 28/28 (`/tmp/pos-integration.log`), HTTPS Chromium E2E 1/1 (`/tmp/pos-e2e.log`), lint, typecheck va production build o‘tdi (`/tmp/pos-lint.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-build.log`). Browser testi dastlab pending UI hali commit bo‘lmagan paytda smenani yopayotganini ko‘rsatdi; test endi haqiqiy payment commitini kutadi, vaqtga bog‘liq sleep yo‘q.
- Chegara: bu mijoz kartasi oqimi; mijozlar ro‘yxatidagi eski tez-undirish va manual debt hujjatlari uchun durable recovery hali qolgan. To‘liq offline undirish/PWA, manager conflict resolution va boshqa qurilmadan recovery ham ochiq.
- CRM-01.05 opening-document allocation hali qolgan: oldingi general-group collection/correctionlar hujjat kesimida ishonchli ajratilmagan, shu sababli legacy reconciliation bilan birga additive arxitektura kerak. Tarixga taxminiy allocation yozilmadi. Migration, real DB va tashqi integratsiyalar o‘zgarmagan.


### Mijozlar ro‘yxatidagi undirish oqimi birlashtirildi — 2026-10-05

- `customers/page.tsx` dagi alohida tez-undirish modal/service chaqiruvi olib tashlandi. Ro‘yxatdagi tugma `/customers/:id?collect=1` orqali ayni himoyalangan undirish oynasini ochadi. IndexedDB original payload/scope/retry qoidalari barcha UI undirish kirish nuqtalari uchun bitta oqimda ishlaydi. Ortiqcha ikkinchi tugma bosish talab qilinmaydi.
- `collect` faqat bir martalik UI ko‘rsatma: lokal pending tekshirilgach URLdan native History API bilan chiqariladi. Reload avvalgi to‘lov tugagan bo‘lsa yangi modal ochmaydi; haqiqiy pending bo‘lsa uning original payloaddi tiklanadi.
- Ro‘yxat debt qiymatini Decimal string sifatida saqlaydi, qarzdorlik mavjudligini BigInt bilan tekshiradi; undirishdagi eski parseFloat/step1000 va o‘zgaruvchan retry payload yo‘li qolmadi. Customer debt tipi number|string bilan mavjud o‘quvchilarni saqlaydi.
- Dalil: core integration 28/28; yakuniy HTTPS Chromium E2E 1/1 ro‘yxatdan kirish, explicit 100.25 undirish, uzilgan javob, yopilgan smena, reload, bir xil payload retry va terminal reloadni qamradi. Lint/typecheck/build o‘tdi. Loglar `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-lint.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-build.log`.
- Oldingi yozuvdagi mijozlar ro‘yxati durable recovery cheklovi shu bosqichda yopildi. Manual debt hujjatlarining durable recovery, opening-document individual allocation/legacy reconciliation, manager conflict resolution, PWA va boshqa qurilmadan tiklash hali qolgan. Real DB/migration va tashqi integratsiyalarga tegilmadi.


### Manual qarz hujjatlarining durable recovery qismi — 2026-10-05

- `CustomerLedger.tsx` hujjat postingdan oldin mavjud IndexedDB operations navbatiga `debt.document` intentini yozadi. Organization/user/device va customer scope bo‘yicha pending/conflict hujjat tiklanadi: original operationId, kind, amount, reason, saleId, effectiveAt va dueAt saqlanadi. Sanalar tashkilot timezone bo‘yicha ko‘rsatiladi, retry uchun original ISO timestamp qayta ishlatiladi.
- Lokal queue o‘qilmasa yangi hujjat bloklanadi; local save tugamasa HTTP yuborilmaydi. Tiklangan hujjat maydonlari bloklangan, shu amalni tekshirish tugmasi mavjud. Successful server javobi local synced yozilgach urinish tugaydi; birinchi aniq validation/date/reduction rad javobi rejected terminal state, oldingi noaniq urinish retryidagi 4xx esa kalitni tashlab yubormaydi.
- `debt.document` owner tuzatishi avtomatik synchronize navbatidan chiqarilgan: bu posting uchun yangi offline/sync API emas. Egasi customer kartasida explicit retry qiladi; pending hujjatlar clearScope/organization switch himoyasiga kiradi.
- Dalil: production HTTPS Chromium E2E 1/1 boshlang‘ich qarz saqlangach javobni uzadi, reload qiladi, 100.25 summa/sabab/locked fieldni tiklaydi, retry payload JSON tengligini va yagona opening_debt yozuvini tekshiradi. Shu test keyingi write-off va to‘liq credit collection/reload oqimini ham bajardi. Core integration 28/28; lint/typecheck/build o‘tdi. Loglar `/tmp/pos-e2e.log`, `/tmp/pos-integration.log`, `/tmp/pos-lint.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-build.log`.
- Oldingi manual debt hujjatlarining in-memory recovery cheklovi yopildi. Hali qolgan: individual opening allocation/legacy reconciliation, owner konfliktni hal qilish, PWA/offline siyosat, boshqa qurilmadan recovery. Real DB/migration va tashqi integratsiyalar o‘zgarmagan.


### CRM-01.07: davr bo‘yicha qarz CSV eksporti — 2026-10-05

- `src/server/customers/export.ts`, ledger service/API, API client, CustomerLedger export tugmasi, unit/integration/browser testlari. Mavjud ishchi daraxt o‘zgarishlari saqlangan; avtomatik commit yo‘q.
- Owner tanlangan from/to davrning barcha DebtEntry yozuvlarini bitta repeatable-read snapshot bilan oladi. UI page/limit eksportni cheklamaydi; 10000 yozuvdan oshsa EXPORT_TOO_LARGE 413, davrni qisqartirish kerak. Summary opening/increases/reductions/closing/current balance va satrma-satr running balance bir xil snapshotdan. Tenant va owner contract saqlangan.
- UTF-8 BOM/CRLF CSV: customer ID/name, organization timezone, davr, summary, source/receipt/sale/actor/reason, Decimal ikki xonali amount/balance, UTC effective/due sanalari. Matnlar quote qilinadi, comma/newline/quote bir katakda saqlanadi; boshlang‘ich =,+,-,@ (whitespace bilan ham) formula matnlari apostrof bilan zararsizlantiriladi. Ishonchli Decimal numeric ustunlar, jumladan manfiy reduction, string orqali toFixed(2) bilan chiqariladi; floating-point hisob yo‘q.
- Endpoint JSON {filename,content} qaytaradi; withApi sanitize/requestId/private-no-store/nosniff himoyasi saqlangan. Browser Blob orqali faylni yuklaydi, object URL keyin tozalanadi. Bu faqat qarz ko‘chirmasi, naqd-only customer xaridlari bo‘yicha to‘liq commercial statement emas.
- Dalil: unit 7/7, integration 29/29 (54 ledger yozuvli export barcha receiptlarni oladi, cross-tenant 404/admin403, 10001-row export rad, tor bo‘sh davrda opening=closing10001), production HTTPS Chromium 1/1 haqiqiy download filename/failure hamda oldingi iqtisodiy/reload oqimlari; lint/typecheck/build o‘tdi. Loglar `/tmp/pos-unit.log`, `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-lint.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-build.log`.
- CRM-01.07 in_progress: cash-only purchase activity/full commercial statement va complete due-date UI qolgan. Opening-document allocation/legacy reconciliation, offline/PWA va konflikt resolution ham qolgan. Migration, real DB yoki tashqi integratsiya o‘zgarmagan.


### CRM-01.07: mijozning naqd/nasiya savdo tarixi — 2026-10-05

- `CustomerSales.tsx`, customer detail UI, `/api/sales` customerId filter, API/types va foundation/browser testlari. Mavjud ishchi daraxt saqlangan, commit yaratilmagan.
- Mijoz kartasida barcha payment turidagi unga bog‘langan savdolar: receipt havolasi, organization-timezone sana, holat, original summa, payment direction/type/summa, qaytarish receipt/refundAmount. Qaytarish qiymati tovar qiymati ekanligi, uning hammasi naqd refund emasligi ko‘rsatiladi. Pagination 20 tadan, loading/error/retry mavjud; createdAt/id bilan tartib barqaror.
- Mavjud Sale tenant/branch/own-cashier scope saqlangan; customerId filtri scopega qo‘shimcha AND sifatida ishlaydi. Customer filterda saleReturns minimal DTO qo‘shiladi; umumiy sales list yangi returns payload bilan og‘irlashmaydi.
- Dalil: integration 29/29: 53 ta customer sale, cash-only Paymentli sale ko‘rinadi, boshqa customer sale natijadan chiqarib tashlanadi, pagination20/53 va cross-tenant customer404; HTTPS browser 1/1 customer tarixida credit receipt link ko‘rindi, keyingi debt/export/reload oqimlari o‘tdi. Lint/typecheck va build o‘tdi. Loglar `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-lint.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-build.log`.
- CRM-01.07 in_progress: cash purchase activity endi ko‘rsatiladi; savdo/payment/returns/debtni birlashtirgan commercial statement/export va complete due-date UI hali qolgan. Existing debt CSV faqat DebtEntry ko‘chirmasi. Schema/migration, real DB va tashqi integratsiyalar o‘zgarmagan.


### CRM-01.07: birlashtirilgan commercial CSV — 2026-10-05

- `src/server/customers/commercial.ts`, mavjud ledger GET format, API client va CustomerLedger download tugmasi, iqtisodiy/browser testlar. Mavjud ishchi daraxt saqlangan; commit yo‘q.
- Owner tanlangan organization-timezone davrni bir repeatable-read snapshotda Sale, SaleReturn, Payment, DebtEntry hodisalaridan eksport qiladi. Draft/voided sale va yakunlanmagan returns kirmaydi. Sale bilan bog‘langan customerId-null legacy payment parent sale orqali topiladi; OR predicate bir paymentni ikki marta qaytarmaydi.
- Savdo qiymati, qaytarilgan tovar qiymati, recorded non-credit pul kirimi/chiqimi, debt delta/running balance alohida. Credit payment pul kirimi emas; faqat DebtEntry balansni o‘zgartiradi. Manual recorded card/transfer provider confirmation deb ko‘rsatilmaydi. Summary bir xil davr/snapshotdan; opening balance davrdan oldingi qarz ledgeridan.
- CSV customer/timezone/period, source ID/kind/reference/detail/reason, UTC timestamp/due date, actor ID va Decimal numeric ustunlarni saqlaydi. Matnlar mavjud formula/CSV quoting himoyasidan o‘tadi. 10000 hodisa cap; ortiq bo‘lsa EXPORT_TOO_LARGE 413 va davrni toraytirish kerak. Auth/tenant/owner va API no-store/sanitize saqlangan.
- Dalil: integration 30/30: 100 savdo (40 cash+60 credit), cash debt collection20, full return100 (cash out60), opening25 -> sales100/returns100/in60/out60/closingDebt25. Hodisalar: sale1/return1/payment4/debt4, duplicate qarz yo‘q. Formula note himoyalangan; cashier/cross-tenant rad; 10001 ledger hodisasi cap rad. Production HTTPS browser 1/1 commercial CSV filename va download success, oldingi debt/recovery oqimlari o‘tdi. Lint/typecheck/build o‘tdi; `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-lint.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-build.log`.
- CRM-01.07 hali in_progress: nasiya savdosiga due-date kiritishning complete UI qismi qolgan. Individual opening allocation/legacy reconciliation va offline conflict resolution boshqa ochiq ishlar. Migration, real DB va tashqi integratsiyalar o‘zgarmagan.


### Nasiya savdosining to‘lov muddati UI — 2026-10-05

- PaymentModal, POS checkout payload, API client va completeSale validation, economic/browser testlari. Mavjud ishchi daraxt o‘zgarishlari saqlangan.
- Full credit va mixed uchun ixtiyoriy date input. Tashkilot timezone bo‘yicha tanlangan kun oxiri ISOga aylantiriladi. Musbat credit qismi bo‘lsa creditDueAt completionga qo‘shiladi; cash-only savdoga ko‘chmaydi. Mavjud payloadlar optional field yubormasa avvalgidek ishlaydi.
- Sale.complete IndexedDB payloadi payments bilan birga original creditDueAtni saqlaydi; keyingi sync uni aynan yuboradi. Server muddatni nasiya yo‘q bo‘lsa yoki o‘tgan bo‘lsa rad etadi. Oldingi committed operation replay oldingi dueAtni qaytaradi, boshqa dueAt bilan shu kalit qayta yuborilsa payload conflict. DebtEntry dueAt ledger va exportlarda ko‘rinadi.
- Dalil: economic integration 31/31: replay dueAt exact, changed date conflict, past/cash-only invalid due date draft holatini saqlaydi va payment/debt yaratmaydi. HTTPS browser1/1 due input credit/mixed usullarida saqlanadi, cash usulida yashiriladi va cash checkout o‘tadi; mavjud reload/export oqimlari ham o‘tdi. Lint/typecheck/build o‘tdi; `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-lint.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-build.log`.
- CRM-01.07 hali in_progress: checkout due-date input yopildi, ammo dueAt kesimida ayni qoldiqni ishonchli guruhlash (opening/legacy allocation bilan bog‘liq) va HTML/PDF/print ko‘rinishi qolgan. Umumiy ledger qoldig‘i va commercial CSV tayyor. Real DB/schema/migration yoki vendor integratsiyasi o‘zgarmagan.


### CRM-01.07: qarz ko‘chirmasining HTML/PDF print ko‘rinishi — 2026-10-06

- `src/server/customers/print.ts`, mavjud ledger format, API client, CustomerLedger download tugmasi va unit/integration/browser testlari. Mavjud ishchi daraxt saqlangan.
- Owner tanlangan davrning barcha qarz yozuvlarini (UI sahifasi bilan cheklanmaydi) existing 10000 cap/repeatable-read snapshotdan script-free HTML faylga chiqaradi. Customer/timezone/period, summary, source/receipt, Decimal amount/running balance, dueAt, actor/reason ko‘rsatiladi. A4 landscape, qaytariladigan table header, satr break-inside avoid, printda ko‘rsatma yashiriladi. Brauzer Ctrl+P bilan print yoki PDF Save; vendor hardware protokoli yo‘q.
- Untrusted matn HTML entity escape bilan chiqariladi, atributlar ham escape; CSP default-src none/script yo‘q, inline print style cheklangan. API hali JSON {filename,content}, auth/tenant/owner/no-store/sanitize orqali ishlaydi; static downloadable file ekani yozilgan. Full commercial CSV saqlangan, bu HTML debt statementning print ko‘rinishi.
- Dalil: unit8/8 HTML markup/attribute escaping; integration31/31 HTML54 entries (UI50dan ortiq), summary513.75 va CSP/script-free contract; production HTTPS browser1/1 download .html, faylni yangi pageda render, 2 real ledger row, preferCSSPageSize PDF bytes %PDF, va mavjud cash/debt/reload/export oqimlari o‘tdi. Lint/typecheck/build o‘tdi. `/tmp/pos-unit.log`, `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-lint.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-build.log`.
- CRM-01.07 in_progress: dueAt kesimida haqiqiy remaining debt (opening/legacy allocation bilan bog‘liq) qolgan. Actual printer/fiscal/Click integratsiyalari, real DB va migration o‘zgarmagan. PDF preview faqat izolyatsiyalangan browser fixture asosida tekshirildi.


### CRM-01.07: joriy qarzning muddat guruhlari — 2026-10-06

- `src/server/customers/aging.ts`, ledger snapshot, API types, CustomerLedger UI, debt CSV, economic/browser testlari. Mavjud ishchi daraxt saqlangan; migratsiya/real DB o‘zgarmagan.
- SaleId kesimida immutable ledger net balance olinadi; yagona original sale debt yozuvining dueAtiga ko‘ra overdue/upcoming/noDueDate. Qisman collection, write-off/return net balansga kiradi; zero guruhlar tashlanadi. AsOf serverning joriy vaqti; bu davr filtri bo‘yicha historical aging emas, ayni snapshotdagi currentBalancega tegishli.
- General opening/correction guruhi hujjatga aniq bog‘lanmagani uchun unallocated. Negative guruh yoki legacy_payment null-sale reduction bo‘lsa entire positive net debt unallocated va requiresReconciliation=true: ma’lum ko‘ringan savdo qoldig‘iga noaniq eski to‘lovni taxminiy taqsimlash yo‘q. Negative net balans creditBalance sifatida ajratiladi; debtTotal-creditBalance=ledger net. Age buckets overdue+upcoming+noDueDate+unallocated=debtTotal.
- Owner UI 4 bucket va noaniqlik izohini ko‘rsatadi; qarz CSVda current aging buckets qo‘shilgan. Eski source history o‘zgarmaydi, overdue degan xulosa original opening dueAtdan umumiy collectionni taxminiy bo‘lish orqali chiqarilmaydi.
- Dalil: integration32/32 aging80 overdue+90 upcoming+100 noDue+25 general=295; legacy unallocated payment5 -> total290 entirely unallocated/needs reconciliation. API current aging ledgerga teng. HTTPS Chromium1/1 customer general bucket80 va mavjud sale/debt/export/print/PDF/reload oqimlari o‘tdi. Lint/typecheck/build o‘tdi. `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-lint.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-build.log`.
- CRM-01.07 hali in_progress: opening/legacy hujjatlari kesimida to‘liq due residual allocation CRM-01.05ga bog‘liq. Sale-based current aging va general uncertainty ko‘rinishi tugallangan. Historical asOf aging/aging intervals alohida kengaytirish; hozir API current snapshot deb aniq belgilangan. Hardware/fiscal/Clickga tegilmadi.


### SEC-02.05: ko‘chirma/eksportlarning umumiy rate limiti — 2026-10-06

- Mavjud PostgreSQL RateLimit ishlatildi; yangi texnologiya yo‘q. Ledger GET barcha export formatlari (debt CSV, commercial CSV, HTML) uchun organization+user kesimida bitta budget10/min; normal statement60/min alohida budget. Mijoz, format, session yoki query davrini almashtirish identityni o‘zgartirmaydi. Owner vakolati limitdan oldin tekshiriladi, tenant references existing withApi orqali tekshiriladi.
- Atomic INSERT ON CONFLICT increment parallel requestsda bitta budgetni nazorat qiladi. Existing rate limiter expiredAtni qaytaradi, remaining seconds bilan AccessError yaratadi. withApi rate-limit error javobiga Retry-After header qo‘shadi; shared login/operation limiterlar ham shu yordamdan foydalanadi. HTTP status429/codeRATE_LIMITED, no-store va requestId saqlangan; server logga identity/secret chiqmaydi.
- Dalil: integration33/33: 12 parallel ikki customer/uchformat so‘rovi exactly10 success+2 rate-limited, Retry-After1..60; oddiy statement va boshqa owner/org eksporti ishlaydi. Production HTTPS Chromium1/1 barcha customerCSV/commercialCSV/HTML/PDF va mavjud checkout/debt/reload oqimlari o‘tdi. Lint0warnings/typecheck/build o‘tdi; `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-lint.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-build.log`.
- SEC-02.05 hali in_progress: reset/import/boshqa report/worker limitlari va hosting/proxy himoyasi qolgan. Bu per-actor application budget, global infrastruktura trafik himoyasi degan da’vo yo‘q. Schema/migration, real DB va tashqi integratsiyalar o‘zgarmagan.

### SEC-02.05: hisobotlarning umumiy rate limiti — 2026-10-06

- Mavjud withApi va PostgreSQL atomic RateLimit orqali barcha GET report endpointlari uchun organization+user kesimida umumiy 60/min limit qo‘shildi. Reconciliation qo‘shimcha 10/min limitga ega. Endpoint/query/kind almashishi budgetni yangilamaydi; yangi texnologiya yoki migration kerak bo‘lmadi.
- Auth, permission va tenant/filial reference tekshiruvlari limitdan oldin bajariladi. Hisobot hisobi va scoped access o‘zgarmaydi. Limit oshsa 429 RATE_LIMITED va qolgan sekundli Retry-After; existing private/no-store saqlanadi. API qo‘llanmasiga kontrakt yozildi.
- Dalil: integration34/34: sales/products bir budgetni sarflaydi, dashboard va reconciliation umumiy capda rad etiladi; reconciliation kind almashganda ham 10/min cap saqlanadi; boshqa organization/owner mustaqil; cashier403 limitdan oldin. Typecheck, lint0warnings, production build va git diff --check o‘tdi. Production HTTPS Chromium1/1 checkout, stock/count/transfer, customer debt recovery va CSV/HTML/PDF oqimlari o‘tdi. Loglar `/tmp/pos-integration.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-lint.log`, `/tmp/pos-build.log`, `/tmp/pos-e2e.log`.
- SEC-02.05 in_progress: reset/import/worker va hosting/proxy himoyasi qolgan. Butun POS production tayyor deb belgilanmadi. Tekshiruvlar faqat ajratilgan test bazasida; real DB, fiskal/Click va hardware integratsiyalariga tegilmadi.

### RET-01.04: qaytarilgan tovar holatini tanlash — 2026-10-06

- Savdo detailidagi qaytarish oynasiga har bir tovar uchun sellable/damaged/write_off tanlovi qo‘shildi. Avval ekran barcha qatorlarni sellable yuborar edi; endi tanlangan holat existing return APIga yuboriladi. Muvaffaqiyatdan keyin tanlovlar tozalanadi. Takroriy nomli mahsulotlarda input/select IDlari saleItemId bilan noyob.
- Existing server tranzaksiyasi va moliyaviy qoidalari saqlangan: faqat sellable stock movement yaratadi. Damaged/write_off qaytarish hujjatida qayd etiladi; alohida brak ombori yaratilmaydi va UI bu cheklovni ochiq aytadi. Yangi texnologiya, schema yoki migration yo‘q.
- Dalil: integration35/35; yangi iqtisodiy test uchala disposition uchun refund100, sotiladigan stock1/0/0, return movement1/0/0, bitta cash refund, replay bir hujjat va changed-disposition same-key conflictni tekshiradi. Production HTTPS browser1/1 real ekran tanlovlari/default/izoh va avvalgi checkout/debt/export/stock oqimlari o‘tdi. Typecheck, lint0warnings, build va git diff --check o‘tdi. Loglar `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-lint.log`, `/tmp/pos-build.log`.
- RET-01.04 in_progress: alohida brak joylashuvi/qoldig‘i va disposition tarixi ekrani qolgan. Refund unknown-result durable UI recovery ham alohida ochiq ish; bu bosqich uni tugallangan deb belgilamaydi. Real DB va tashqi integratsiyalarga tegilmadi.

### RET/POS: qaytarishning durable unknown-result recovery oqimi — 2026-10-06

- Savdo detailidagi qaytarish existing IndexedDB operations storega HTTPdan oldin yoziladi. Original saleId/operationId/shiftId/reason/items immutable payload; organization/user/device scope va ayni sale bo‘yicha tiklanadi. Quantity/disposition/reason unknown holatda qulflangan; replay hozirgi smena yoki o‘zgargan formadan yangi payload yasamaydi.
- Reload avtomatik oldingi intent oynasini ochadi, hatto sale returned bo‘lsa ham. Committed refund original shift yopilgach ham exact operation replay orqali tekshiriladi. Successdan keyin local synced acknowledgment, so‘ng form reset va sale refresh. Local read failure yangi postingni bloklaydi; enqueue failure HTTPgacha to‘xtaydi. First explicit validation/business rejection local rejected holati bilan yopiladi; oldingi unknown retry xatosida asl intent saqlanadi.
- Dalil: integration35/35 va production HTTPS Chromium1/1. Yangi browser bosqichi real cash sale refundni damaged qilib serverda commit qiladi, javobni abort qiladi, original shiftni yopadi, reload qiladi, locked quantity/disposition/reasonni tekshiradi va exact payloadni replay qiladi. SaleReturn1, cash refund1, sellable return movement0; navbatdagi reloadda modal yo‘q. Oldingi customer/stock/export oqimlari ham o‘tdi. Typecheck, lint0warnings, production build va git diff --check o‘tdi; `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-lint.log`, `/tmp/pos-build.log`.
- Umumiy offline conflict resolution/cross-device recovery va damaged-stock warehouse hali ochiq. Existing sale.return sync serveri va permissionlar o‘zgarmadi; yangi migration/texnologiya yoki real tashqi integratsiya yo‘q. Real biznes DB ishlatilmadi.

### RET-01.04/RET-01.07: qaytarish va disposition tarixi — 2026-10-06

- Mavjud sales/:id/returns routega GET qo‘shildi; Sale tenant/branch/own-cashier scope bilan tekshiriladi. Count va paginated rows repeatable-read snapshotda, returnedAt/id descending. Default20, existing limit1..200. Minimal DTO: return receipt/time/status/reason/amount, processor fullName va original SaleItem productName/sku/unit, quantity/lineTotal/disposition. Current catalog nomi tarixga qo‘llanmaydi; cost/profile secrets chiqarilmaydi.
- Savdo detailiga ReturnHistory qo‘shildi: loading/error/retry, 20 tadan sahifalash, har itemning sotiladigan/brak/write_off holati, sabab va bajargan xodim. Refund success/replaydan keyin yangilanadi. UI qiymatni returned goods amount deb izohlaydi, hammasini naqd refund deb ko‘rsatmaydi. React orqali matnlar escape qilinadi.
- Dalil: integration36/36. Yangi test21 returns: page20+1, stable date order, frozen item name, Decimal DTO, minimal employee field, cross-tenant404, invalid page400, own-cashier200/other-cashier404. Production HTTPS browser1/1 real damaged refund recoverydan keyin tarixdagi reason/disposition/amount izohi ko‘rindi; avvalgi POS/debt/stock/export oqimlari o‘tdi. Typecheck, lint0warnings, build va git diff --check o‘tdi; `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-lint.log`, `/tmp/pos-build.log`.
- RET-01.04 hali in_progress: alohida brak stock location/qoldig‘i qolgan, disposition history UI yopildi. RET-01.07ning manager approval acceptance/audit presentation bo‘yicha qolgan shartlari mavjud. Migration/real DB yoki tashqi hardware/fiskal/Click integratsiyalariga tegilmadi.

### DATA-01.05/SEC: owner audit summary va tarixi ekrani — 2026-10-06

- Existing audit GETga opt-in view=summary qo‘shildi; oldingi API contract saqlangan. Summary owner-only, tenant scoped, minimal actor.fullName va hodisa ID/type/entity/action/time; beforeData/afterData/IP yoki xodim profilining qolgan qismlari olinmaydi. Exact entity/action/actor filtrlar, UUID/length/date/skip validation, organization-timezone kun chegaralari, repeatable-read count+rows, default50/max200 va PostgreSQL60/min budget mavjud.
- Owner menyusiga /audit sahifasi qo‘shildi: filtr formasi,50 tadan pagination, loading/error/retry va organization timezone sana. Text React orqali escape qilinadi. UI qayd etilgan audit hodisalarini ko‘rsatadi; mavjud raw audit API yoki barcha audit writerlarni katta refactor qilmaydi.
- Dalil: integration37/37; yangi test Tashkent kunining UTC19:00 chegaralari, page1/page2, actor name, payload/IP yo‘qligi, cross-tenant empty result, invalid UUID/date400 va admin/cashier403ni tekshiradi. Production HTTPS Chromium1/1 real refunddan keyin owner menyusi/audit page ochildi va SaleReturn/returned filtri aynan1 Browser Owner hodisasini ko‘rsatdi. Avvalgi POS/stock/customer/recovery/export oqimlari ham o‘tdi. Typecheck, lint0warnings, build va git diff --check o‘tdi; `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-lint.log`, `/tmp/pos-build.log`.
- DATA-01.05/SEC ishlari hali in_progress: barcha writer coverage, raw auditning payload/branch siyosati, security-event modeli/bildirishnomalari va retention qolgan. Summary bu qolgan ishlarni tugallangan deb ko‘rsatmaydi. Yangi migration/texnologiya yo‘q; real DB va tashqi integratsiyalarga tegilmadi.

### SEC-01.02/SEC-02.05: eski audit API scope va budget himoyasi — 2026-10-06

- AuditLog filial bilan ishonchli bog‘lanmaganligi sabab barcha audit GET rejimlari owner-only qilindi. Oldingi admin org-wide raw audit access yopildi; owner batafsil beforeData/afterData ko‘rishi saqlangan, existing recursive secret sanitization amal qiladi. IP manzil DTOdan chiqarildi. Summary hali minimal DTO.
- Legacy audit ham summaryning exact filters, UUID/date/length validation, timezone range va repeatable-read count/rowsini ishlatadi. Ikkala view umumiy existing audit.summary60/min budget; view almashtirish limitni chetlab o‘tmaydi. Noma’lum view va Prisma offset chegarasidan katta page400 bilan rad etiladi.
- Dalil: integration37/37; audit test legacy owner payload/sanitized secret/no-IP, timezone-filtered total2, invalid view/ID/offset400, summary60th200/legacy61st429 Retry-After, admin raw403 va summary403ni tekshiradi. Production HTTPS Chromium1/1 owner audit sahifasi va barcha oldingi core oqimlar o‘tdi. Typecheck, lint0warnings, build va git diff --check o‘tdi; `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-lint.log`, `/tmp/pos-build.log`.
- API qo‘llanmasida access tightening qayd etildi. Branch-aware admin audit keyin explicit store scope bilan loyihalanishi kerak; generic entityIddan taxminiy filial chiqarilmadi. Barcha writer coverage, payload retention/redaction siyosati va security-event bildirishnomalari hali ochiq. Schema/migration, real DB va tashqi integratsiyalar o‘zgarmadi.

### SEC-02.09: faol sessiyalarni ko‘rish va tanlab bekor qilish — 2026-10-06

- Existing Session modeli asosida GET/POST /api/auth/sessions va barcha rollar uchun /security menyu/ekran qo‘shildi. User faqat o‘z barcha bizneslardagi faol (revoked/expired/idle-expired emas) sessiyalarini ko‘radi. Minimal DTO/time/current flag,20 tadan UI pagination, repeatable-read count+rows va60/min user read budget. TokenHash/secret/profile yoki taxminiy device/location yo‘q.
- POST target userId bilan qat’iy tekshiriladi; boshqa user404, joriy session409 CURRENT_SESSION, UUID/strict body validation, existing CSRF. Revoke va current-organization audit bir transactionda; repeated/parallel revoke200 va faqat actual revoke audit yaratadi.30/min user revoke budget. Joriy sessiyani tasodifan UI orqali uzish mumkin emas; existing logout saqlangan.
- Dalil: integration38/38; expired omission, pagination1/2, current exactly1, no-token DTO, other-user404, current409, parallel revoke one audit, revoked token invalid/current valid, cashier self list200. Production HTTPS Chromium1/1 ikkinchi contextda login, security sahifasidan other session revoke, uning /auth/me401 va joriy /auth/me200; avvalgi core oqimlar o‘tdi. Typecheck, lint0warnings, production build va git diff --check o‘tdi. Loglar `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-lint.log`, `/tmp/pos-build.log`.
- SEC-02.09 hali in_progress: security-event tarixi/shubhali login notification, device metadata va retention siyosati qolgan. Password reset/delivery boshqa ochiq ish. Mavjud Session schema ishlatildi; migration, real biznes DB yoki tashqi integratsiyaga tegilmadi.

### SEC-02.03: parol almashtirish UI va parallel request himoyasi — 2026-10-06

- Existing change-password API endi strict body va yangi parolning UTF-8 72-byte bcrypt chegarasini tekshiradi. Bcrypt hash hisoblangach tranzaksiyada User/Session locks, active user/live session/old hash qayta tekshiriladi. Concurrent eski-password so‘rovi birinchi commitni bosib ketmaydi. Mavjud5/15min budget, CSRF, password+all session revoke+secret-free audit atomicligi va cookie clear saqlangan.
- /security ekrani current/new/confirm password formga ega. Mismatch va byte length clientda tekshiriladi. Current organization/user/device pending yoki conflict operations aniqlansa yoki local queue read xato bersa HTTPgacha bloklanadi. Local intents o‘chirilmaydi; password offline queuega yozilmaydi. Success auth context refresh va Next router.replace orqali login; Next local guide o‘qildi.
- Dalil: integration39/39: wrong current403, Unicode80-byte new400, parallel2 change requests exactly1 success, winner hash correct/old incorrect, zero live sessions va exactly1 password_changed audit. Production HTTPS Chromium1/1 mismatch UI, successful change→login, old session401, old password401 va new password login200. Avvalgi core oqimlar ham o‘tdi. Typecheck, lint0warnings, build va git diff --check o‘tdi; `/tmp/pos-integration.log`, `/tmp/pos-e2e.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-lint.log`, `/tmp/pos-build.log`.
- SEC-02.03 hali in_progress: forgotten-password reset/delivery va barcha auth entrypointlarda umumiy password policy audit qolgan. Unknown transport natijasida yangi password bilan qayta kirish tekshiriladi; passwordni IndexedDBga saqlab replay qilinmaydi. Schema/migration, real biznes DB yoki tashqi integratsiyaga tegilmadi.

### 10 ta aniq core vazifa yakunlandi — 2026-10-06

Foydalanuvchining “10 ta vazifa bajarilguncha davom et” topshirig‘i bo‘yicha quyidagi doiralar implementatsiya va tekshiruvdan o‘tdi. Bular PLAN1dagi katta parent talablarning to‘liq yopilgani degani emas: jadvaldagi parent statuslar qolgan acceptance shartlari uchun in_progress saqlangan.

| # | PLAN1 bog‘lanishi | Yakunlangan aniq vazifa | Qabul dalili |
| --- | --- | --- | --- |
| 1 | SEC-02.03/SEC-02.08 | Register/staff/invitation/change-password uchun yagona8..72-character/max72-UTF-8-byte yangi parol siyosati; hash helper defense | Unit boundary72/74/80-byte, direct hash reject; register/staff/invitation400/no user, existing change-password race tests |
| 2 | SEC-02.05 | Register validated phone5/15min va opt-in trusted proxy IP30/15min limiti; bcrypt/account creationdan oldin | Phone/IP budget429 Retry-After va user count0; boshqa raw header defaultda ishlatilmaydi |
| 3 | SEC-02.03 | Barcha sessiyalardan chiqish UI; pending/conflict local intent guard, queue saqlanadi | HTTPS browser synthetic pending intent block/current session200; pending olib tashlangach current/other sessions401 va login redirect |
| 4 | DATA-01.05/SEC-01.02 | AuditLog append-only PostgreSQL guard va tenant/time/id index; readiness016 | UPDATE/DELETE/actor edit rad; haqiqiy user delete actor→null; Org cascade; fresh/legacy17 migrations va encrypted restore passed |
| 5 | CAT-01.08 | To‘liq filtrlangan active catalog CSV API/UI: primary/additional barcode, unit/category, Decimal price/cost/minStock |55 rows despite limit1/page2, formula/quote escaping, archived omitted, tenant403/cashier403,10001 cap413; browser download |
| 6 | CRM-02.01/REP-01.09 | Owner active customers CSV API/UI; current DebtEntry net balance |55 rows despite limit1,12.25 exact debt, formula escaping, admin403,10001 cap413; browser download |
| 7 | REP-01.09/REP-01.04 | Savdo hisobotining to‘liq CSVsi: davr sales + returned goods events, Decimal gross/refund/net, scoped snapshot |55 sales+1 return, original sale outside date included through in-period return, net54.00, hidden branch omitted, cashier403,10001 cap413; browser download |
| 8 | REP-01.09/REP-01.05 | Mahsulot hisobotining to‘liq CSVsi: signed quantity/revenue va historical cost/profit SQL |55 product groups despite limit1, historical0.500000 cost, admin assigned branch conservation, cross-tenant store404,10001 groups413; browser download |
| 9 | POS-02.05/UX-01.06 | F2/F4/F9/Esc POS shortcuts; local/processing/unknown/modal/typing guard, automatic posting yo‘q | Browser empty-cart F9 no modal, F2 focus, F4 clear, F9 payment open/Esc close; existing exactly-once checkout passed |
| 10 | POS-02.09/OFF-01.03 |58/80mm isolated browser print/PDF receipt templates; history copy/nonfiscal/draft labels, original cashier/org timezone, signed payment labels | Browser both paper widths rendered DOM and valid%PDF; CHEK NUSXASI; Sale/Payment counts unchanged through old exactly-once flow |

Umumiy yakuniy dalillar: **integration44/44**, **unit9/9**, **production HTTPS Chromium1/1** (kengaytirilgan core scenario), typecheck, lint0warnings, production build, git diff --check. Fresh/legacy migration script barcha17 migrationni qo‘lladi; encrypted backup/empty-target restore, migration record match, count/freeze/debt recovery va nonempty-target refusal o‘tdi. Loglar `/tmp/pos-integration.log`, `/tmp/pos-unit.log`, `/tmp/pos-e2e.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-lint.log`, `/tmp/pos-build.log`, `/tmp/pos-migration-tests.log`, `/tmp/pos-backup-tests.log`.

- Yangi texnologiya/dependency qo‘shilmadi: Next/React, Prisma/PostgreSQL, Zod, bcrypt, browser IndexedDB/Blob/print va mavjud Playwright ishlatildi. CSV UTF-8 BOM/CRLF, delimiter/newline/formula protection va trusted Decimal numeric cells; shared export cap10000. Catalog/customers budgets alohida10/min, report CSVs shared10/min + report.read60/min. CSVlardan UI page limit olib tashlanadi, limit oshsa partial file berilmaydi.
- Yangi migration `202610060016_audit_history_guards`. Readiness endi016 finished holatini talab qiladi; deployda oldin migrate deploy bajariladi. Migration faqat pos_test va ephemeral fresh/legacy bazalarda qo‘llandi; actual business DB/deployga tegilmadi.
- Avtomatik approval reviewer avval migration sinovini account usage limiti, keyin build tekshiruvini timeout sabab bajarmadi. Tekshiruv chetlab o‘tilmadi; reviewer keyinchalik muvaffaqiyatli ishladi, ruxsat etilgan retry va yangi tasdiqlar bilan build/migration/backup/browser checks yakunlandi. Ochiq approval blocker qolmagan.
- Qolgan doiralar: forgotten-password delivery/reset, security events/retention, CSV/XLSX import, XLSX/PDF/background reports, quick-product presets, receipt print-request audit/electronic delivery/historical org snapshot. Vendor printer/fiscal/Click/special scanner/scale/cash drawer implementatsiyasi yozilmadi. Butun loyiha production-ready deb belgilanmadi; commit yaratilmagan, foydalanuvchining avvalgi o‘zgarishlari saqlangan.

### Keyingi 10 ta core vazifa yakunlandi — 2026-10-06

Bu batch `d288212` bazaviy versiya ustidagi ishchi daraxtda bajarildi; agent commit yaratmadi. Quyidagi aniq doiralar tugallandi, katta PLAN1 parentlar qolgan acceptance talablari uchun in_progress saqlandi.

| # | PLAN1 bog‘lanishi | Yakunlangan ish | Qabul dalili |
| --- | --- | --- | --- |
| 1 | CAT-01.01 | Mahsulot archived/all filtri, manager arxiv/tiklash ekrani, stable snapshot pagination | Browser mahsulotni arxivlab qayta tikladi; historical sale retained; cashier archive403, other tenant403 |
| 2 | CRM-02.01/DATA-01.03 | Mijoz archived/all va arxiv/tiklash; PUT/DELETE row-lock + nonzero qarz/avans guard | Positive/negative qoldiq409; zero-balance restore; concurrent locked debt posting archive409; browser qarzdor arxivi blocked |
| 3 | CAT-01.01 | Kategoriya arxiv/tiklash va opt-in paginated list, legacy active array saqlanadi | Browser kategoriya archive/restore; category list status/error/tenant checks; products cascade arxivlanmaydi |
| 4 | PUR-01.01 | Supplier create/edit/archive/restore/search/pagination, kontakt/STIR/manzil/izoh kartasi | UI create/edit/archive/restore; field bounds400; linked StockDocument saqlanadi |
| 5 | PUR-01.01/REP-01.09 | Supplier full filtered CSV |22 rows despite limit1/page2, formula/newline protection, tenant403,10001 rows413; browser download |
| 6 | INV-01.01/REP-01.07 | Scoped ombor movement jurnali UI/API: store/product/type/source/date, stable paging/snapshot | Tashkent midnight/date boundaries, stable tied timestamps, hidden admin branch omitted, cross-tenant403/hidden store404; browser source filter |
| 7 | REP-01.07/REP-01.09 | Movement full CSV signed quantityDelta va unitCost6 precision |21 visible rows despite UI limit1/page2, -1.123456 va0.123456 exact, formula escaping,10001 cap413; browser download |
| 8 | REP-01.08/REP-01.09 | Scoped smena full CSV: frozen close cash totals/farq; open unknown settlement bo‘sh | Closed12.25/10.00/-2.25, open blanks, hidden branch omitted, cashier403,10001 cap413; browser current register CSV |
| 9 | SEC-01.02/REP-01.09 | Owner-only minimal audit full filtered CSV | Payload/IP omitted, text formula escaped, admin403,10001 cap413; browser download |
| 10 | POS-02.09/SEC-01.02 | Strict/idempotent receipt print-request audit API + existing receipt UI | Parallel requests one audit, changed width409, other tenant/other cashier404; Sale/Payment/Movement unchanged. Browser commit→abort→same payload/key retry, one audit;58/80mm PDFs; two distinct print intents exactly2 audit |

Yakuniy dalillar: **integration51/51**, **unit9/9**, **production HTTPS Chromium1/1** (13.1s; kengaytirilgan existing core scenario); typecheck, lint0warnings, production build va git diff --check o‘tdi. Integrationning birinchi urinishidagi yagona xato manfiy opening_debt test fixture bo‘lgan: DB sign constraint to‘g‘ri rad etdi; fixture debt_adjustmentga tuzatilib barcha testlar qayta o‘tdi. Browserning ilk yangi bosqichidagi alert locator Next announcerga ham mos tushgan; locator aniq error matniga tuzatildi, final scenarios o‘tdi. Default sandbox unit runner faqat2 file summary bergan; ruxsatli tekshiruvda barcha9 haqiqiy test alohida tasdiqlandi.

- Artefaktlar: `tests/catalog-journal.integration.test.ts`, `tests/e2e/core.spec.ts`; `/tmp/pos-integration.log`, `/tmp/pos-unit.log`, `/tmp/pos-e2e.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-lint.log`, `/tmp/pos-build.log`. API kontrakti `api.md`, arxitektura qarori ADR-012 `tasks/DECISIONS.md`da.
- Yangi dependency, schema yoki migration qo‘shilmadi. Mavjud Next/React/Prisma/PostgreSQL/Zod/Decimal/Blob/Playwright ishlatildi. Faqat ajratilgan pos_test tekshirildi; fresh/legacy17 migration va encrypted backup/restore avvalgi batchda o‘tgan, ushbu schema-o‘zgarmagan batchda takrorlanmadi.
- Qolgan parent scope: kategoriya daraxti/brend/tavsif, CRM duplicate/group/price level, supplier commercial terms/purchase history/debt, XLSX/PDF/background exports, elektron chek delivery/historical organization snapshot va boshqa PLAN1 backlog. Real fiscal/E-POS/Click/hardware implementatsiyalariga tegilmadi. Core batch tugallangan, butun loyiha yoki real deployment production-ready deb belgilanmagan.

### Keyingi 20 ta aniq core doira yakunlandi — 2026-10-06

Foydalanuvchining “keyingi20 ta vazifa” topshirig‘i shu batchdagi quyidagi20 aniq implementatsiya doirasi bilan bajarildi. Bular PLAN1dagi20 katta parentning barcha talablarini yopish emas; qatorlarda parentlar qolgan scope uchun in_progress. Bazaviy `fe51db1` ustidagi ishchi daraxt; agent commit yaratmadi.

| # | Parent | Yakunlangan yangi doira | Dalil |
| --- | --- | --- | --- |
| 1 | CAT-01.01 | Kategoriya API search va trim/name200/Int sortOrder validation | Invalid whitespace/name201/fractional/out-of-range sort400; case-insensitive search va206-row stable paging |
| 2 | CAT-01.01 | Kategoriya create/edit/order/search/archive/restore manager ekrani | HTTPS real form create/edit, search, archive/restore, existing product/sale unchanged |
| 3 | CAT-01.08/REP-01.09 | To‘liq filtrlangan kategoriya CSV |206 rows despite UI limit1/page2; formula/quotes, tenant403/cashier403; browser filtered download |
| 4 | CAT-01.05 | Unit API status/search/stable snapshot paging;200dan keyingi qatorlar |205 selected units pages200+5; total snapshot, default legacy200 saqlangan |
| 5 | CAT-01.05 | Unit management UI search/status/page20/retry va stale response cancellation | Browser25-unit fixture page1→2, create/unused archive/reactivate/search; existing in-use guard saqlangan |
| 6 | CAT-01.08/REP-01.09 | Unit full CSV |205 active rows despite limit1, formula protection, archived excluded; browser custom unit CSV |
| 7 | CAT-01.02 | Barkod API stable primary/createdAt/id paging va search |206 rows pages200+6; primary first; other tenant404; cashier read200/export403 |
| 8 | CAT-01.02 | Product barcode UI page50/search/retry; add/remove existing guards | Browser manual add+60 fixture, filtered page1→2; read cancellation, delete last-page recovery |
| 9 | CAT-01.02/REP-01.09 | Product barcode full filtered CSV |205 search matches despite limit1, formula protection; browser61 rows on second UI page |
| 10 | PUR-01.01 | Scoped supplier detail GET for active/archive contacts | Same tenant200/STIR; other tenant404; cashier forbidden by existing area permission |
| 11 | PUR-01.01 | Supplier contact card UI and clickable list navigation | Browser contact card/history heading, phone/TIN/status fields; lookup error/retry |
| 12 | PUR-01.01/PUR-01.06 | Supplier scoped document history API | Local-day range, page1 limit1 count4; admin hidden branch omitted; status confirmed3; unrelated supplier reference rejected |
| 13 | PUR-01.01/PUR-01.06 | Supplier history UI date/store/status/search/page20 and reversal/item details | Browser current purchase row, number filter, signed reversal/history; loading/error/retry |
| 14 | PUR-01.06/REP-01.09 | Supplier full filtered history CSV via shared stock-document export | Confirmed3 rows including signed reversal -1 and cost12.345678; hidden branch omitted; browser number-filtered download |
| 15 | PUR-01.06 | Confirmed purchase/reversal value API + understandable summary UI | Draft/adjustment excluded; old-period original + in-period reversal;24.69−12.35=12.34 exactly; admin branch scope, unsupported filters400; browser net4 UZS |
| 16 | INV-01.01 | Stock document API+UI date/supplier/type/status/number filters and snapshot pagination |25 same-time documents stable distinct pages; invalid type/date400; browser scoped confirmed search; page20/error/retry |
| 17 | REP-01.09/INV-01.01 | Stock document full per-item CSV with original/reversal/time/cost/value | Full25 rows despite limit1;21×500 lines cap413/no partial content; signed quantities/value and browser export |
| 18 | INV-01.04 | Transfer API+UI source/destination/status/date filtering + stable snapshot paging |25 assigned transfers second page5, hidden destination404, invalid status400; browser source/destination and page1→2 |
| 19 | REP-01.09/INV-01.04 | Transfer full per-item CSV with planned/received/returned/unallocated/cost |2.123456−1−0.123456=1.000000;25 rows despite limit1, formula safe, hidden omitted;21×500 child-line cap413; browser25 empty-fixture metadata rows |
| 20 | REP-01.07/REP-01.09 | Scoped balance full CSV + single-snapshot read/paging/search/lowStock |25 low-stock rows despite limit1, exact1.123456 qty/1.876544 shortage/0.123456 cost/0.14 value; equal threshold excluded; budget429; browser qty2/min3/shortage1/cost2/value4 |

Umumiy dalillar: **integration57/57**, **unit11/11**, **production HTTPS Chromium2/2** (old comprehensive core13.4s + new catalog/purchase/export3.8s; total18.2s); production build, typecheck, lint0warnings va git diff --check. Unit katta max NUMERIC(20,6)×max qiymati `9999999999999999999800000000.00`, shortage `199999999999999.999998`ni tekshirdi va global Decimal precision o‘zgarmaganini tasdiqladi. Shared export/pagination helper boundary10000/10001 va safe offsets tekshirildi.

- Yangi artefaktlar `tests/catalog-purchase.integration.test.ts`, `tests/export-precision.unit.test.ts`, kengaytirilgan `tests/e2e/core.spec.ts`. Loglar `/tmp/pos-integration.log`, `/tmp/pos-unit.log`, `/tmp/pos-e2e.log`, `/tmp/pos-build.log`, `/tmp/pos-typecheck.log`, `/tmp/pos-lint.log`. API `api.md`; qaror ADR-013 `tasks/DECISIONS.md`.
- Birinchi supplier test fixture confirmed parentga nested item qo‘shishga uringanda existing immutable DB guard to‘g‘ri rad etdi. Fixture draft→confirmedga tuzatildi; barcha57 test qayta o‘tdi. Birinchi new browser fixture destination storega UserStore biriktirmagani sabab option topilmadi; real existing assignment qoidasi asosida fixture tuzatildi, ikkala final scenario o‘tdi. Ishlaydigan vakolat/immutability qoidalari yumshatilmadi.
- Yangi dependency/schema/migration yo‘q. Next/React/Prisma/PostgreSQL/Zod/Decimal/Blob/Playwright ishlatildi. CSV output rows cap va parent cap oldindan count qilinadi; text spreadsheet injection himoyasi, same snapshot, shared org+actor budgets. Balance details500-key batches/linear lookup bilan, SQL va details bir transactionda. Harakat va moliyaviy mutation xizmatlari saqlangan.
- Unit/barcode default API limit200 compatibility uchun qolgan; yangi management UI barcha pagelar orqali yetadi. Product creationdagi eski option selectors va kategoriya legacy arrayning katta-ro‘yxat UXsi alohida kengaytirish scope. Supplier contact/history va qiymat summary tugallandi; tijorat shartlari, supplier payment/debt ledgeri, price-trend comparisons, category tree/brand, label generation, unit conversion, XLSX/PDF/background export va qolgan parent acceptance ishlari backlogda. Bu20 doira butun POS production-ready yoki real deploy qilingan degani emas.
- Faqat localhost pos_test sinov bazasi ishlatildi; real biznes bazasiga tegilmadi. Oldingi17 migrations/backup-restore dalili saqlangan; schema o‘zgarmagani uchun qayta bajarilmadi. Real Click/fiscal/E-POS/printer/scale/special scanner/cash drawer vendor implementatsiyalariga tegilmadi.


## Yana 10 ta PLAN1 bandi — yakuniy qabul (2026-10-06)

Bu safar aynan **10 ta alohida PLAN1 ID** `done`ga o‘tdi; kichik doiralar parent bandlar o‘rniga sanalmadi. Quyidagi dalillar bugungi testlangan kodga tegishli. Qolgan bandlar holati saqlangan; bu butun loyiha yoki haqiqiy production release tugadi degani emas.

| ID | Status | Tekshirilgan kirish va kutilgan → haqiqiy natija | Takrorlanadigan dalil |
| --- | --- | --- | --- |
| POS-01.01 | done | Soxta price/cost/unit/total va client cashier; server katalog narxi100, tannarxi50, dona va session actorni oladi. Duplicate SKU quantity3/discount5 → bitta snapshot, total295 va bitta stock posting. Narx/tannarx snapshot regressiyasi ham o‘tdi. | economic: `Checkout trusts catalog snapshots...`, `Checkout snapshots current weighted cost...`; foundation: `Sale HTTP contract...`; source: src/server/sales/service.ts |
| POS-01.02 | done | Empty, zero/negative/NaN/Infinity, noto‘g‘ri UUID, birlik precision va foreign IDs rad, sale/operation/audit yaratilmaydi. Excess discount HTTP409, yaroqsiz quantity/payment400, foreign organization403; Decimal exception500 emas. | economic: `Invalid baskets...`; foundation: `Sale HTTP contract...`; src/app/api/sales/route.ts |
| POS-01.03 | done | Birinchi stock line yozilgach ikkinchisida shortage: barcha stock/snapshot/debt/operation rollback. To‘lov yozilgandan keyingi injected audit failure: payment/stock/sale/operation ham rollback; fault olib tashlangach original key bilan bitta muvaffaqiyat. | economic: `A failure after the first stock posting...`, `A late audit failure...`; successful checkout audit/payment assertions va HTTPS oqimi |
| POS-01.04 | done | Parallel create/complete bir key bilan bitta sale/payment/movement; retry original ID; boshqa payload HTTP409 OPERATION_PAYLOAD_CONFLICT. Revoke va actor/tenant chegaralari saqlangan. | economic: `Create/complete retries...`, `A business duplicate without a committed operation...`, `Revoked sessions...`; foundation HTTP contract; existing tenant tests |
| POS-01.05 | done | Oxirgi dona uchun ikki parallel savdodan bittasi o‘tadi. Parallel credit customer limit100dan oshmaydi. Yopiq smena, mavjud count freeze va joriy chegirma vakolati rad; hech qanday posting yo‘q. Takror SKU birlashtiriladi, har original quantity precision tekshiriladi. | economic: `Two tills competing...`, `Parallel credit checkouts...`, `Checkout rechecks current discount limits...`, count/concurrency regressiyasi |
| POS-01.07 | done | HTTPS browser commit javobini abort qilib reload/retry qiladi; original operation status original sale IDni beradi; payment/stock dublikat bo‘lmaydi. Qayta yopilgan smenadan committed replay ham existing oqimda tekshirilgan. | tests/e2e/core.spec.ts birinchi scenario; foundation: `Sale HTTP contract...`; src/app/api/operations/route.ts va mavjud offline recovery UI |
| POS-01.08 | done | Posted sale note/status/delete, item edit/delete/insert va product/store cascade rad. Checkoutni kutib qolgan child edit yangi posted statusda rad. Linked return original snapshotni o‘zgartirmay yangi return+audit bilan holatni o‘zgartiradi; organization cleanup ishlaydi. | economic: `Posted receipt DB snapshots...`, `A child edit waiting for checkout...`; migrations 202610060017_sale_history va 202610060018_sale_item_lock; HTTPS returns |
| FIN-01.01 | done | Ikki turli operation bilan parallel shift.open → aynan bitta open shift. Bevosita DB duplicate insert ham partial unique index sabab rad; eski closed shift saqlanadi. | economic: `Parallel shift opens and direct DB inserts...`; foundation DB constraint; existing PostgreSQL open-shift unique migration |
| FIN-02.03 | done | To‘rt birlik/two SKU receipt discount0.01 snapshot yig‘indisi aynan0.01. Katalog999/888ga o‘zgargach ketma-ket bir birlik partial returns jami399.99, out cash399.99; yakuniy rounding qoldig‘i yo‘qolmaydi. | economic: `Multi-line cent allocation and successive partial returns...`, mixed cash/debt return conservation; calculations.unit: stable allocation ties |
| QA-01.02 | done | Real PG suite sale/stock/return/locks/FK/ledger/audit/rollbackni tekshiradi. Fresh19 migration va legacy discounted credit fixture backfill o‘tdi. DB guard noto‘g‘ri host/port/user/path/missing URLni compilation/connectiondan oldin rad etdi, credential log qilinmadi. | scripts/test.cjs; barcha tests/*.integration.test.ts; scripts/ops/test-migrations.sh; scripts/ops/test-backup.sh |

### Yakuniy protokol va artefaktlar

Versiya: boshlang‘ich commit `21c0188` + ushbu ishchi daraxt. Quyidagi testlangan source to‘plamining SHA256 qiymati: `76018c76ad636c666ddf6787c10c31f8d429b81d96821358c3795288dbae1ec0`. To‘plam: src/server/sales/service.ts, src/app/api/sales/route.ts, scripts/test.cjs, 2026100600* migration.sql va tests/*.integration.test.ts; sorted path + NUL + file bytes + NUL ketma-ketligi. AI commit yaratmadi. ADR-014 qarorlarni, api.md contractni va README kassir/deployment yo‘lini qayd etadi.

- `npm run typecheck`: exit0; `/tmp/pos-typecheck.log`.
- `npm run lint`: exit0, warning/error yo‘q; `/tmp/pos-lint.log`.
- `npm test`: **11/11**, failed/skipped/todo0; `/tmp/pos-unit.log`.
- Izolyatsiyalangan DATABASE_URL bilan `npm run test:integration`: **68/68**, failed/skipped/todo0; `/tmp/pos-integration.log`.
- Shu test URL bilan `npm run build`: exit0; `/tmp/pos-build.log`.
- Test URL + PLAYWRIGHT_BROWSERS_PATH=/tmp/pos-playwright-browsers bilan `npm run test:e2e`: **2/2 HTTPS scenario**,18.3s; `/tmp/pos-e2e.log`. Birinchi13.4s, ikkinchi3.9s.
- `bash scripts/ops/test-migrations.sh`: fresh va legacy **19 migration** o‘tdi; `/tmp/pos-migration-suite.log`. Legacy fixture receipt allocation0.01/debt2.99/barcode1/unit8 saqlangan.
- `bash scripts/ops/test-backup.sh`: encrypted dump, checksum, transactional empty-DB restore, migration soni va active count/debt ledger recovery o‘tdi; existing-table restore rad. `/tmp/pos-backup.log`.
- Test runnerning missing URL/wrong path/wrong port/wrong user/remote hostname beshta konfiguratsiyasi: barchasi DBga ulanishdan oldin exit1, credential matni chiqmagan.
- `git diff --check`: o‘tdi.

Testlar faqat pos-plan-test-db konteyneridagi localhost:55439/pos_test yoki ops skript yaratib o‘chiradigan vaqtinchalik bazalarda ishladi. Production DB ishlatilmadi. Loglar joriy muhit uchun vaqtinchalik artefakt; doimiy takrorlanadigan dalil — yuqoridagi test fayllari, skriptlar va versioned migratsiyalar. Fresh/legacy fixture haqiqiy biznes bazasi clone yoki real pilot deb ko‘rsatilmaydi.

UIga yangi komponent talab qilinmadi: checkout/recovery, returns va shift mavjud ekranlarda ishlaydi, server/DB invariantlari shu oqimlarga tatbiq etildi va browserda tekshirildi. Tashqi fiskal/payment/hardware yozilmagan; POS-01.06 fiskal raqam bandi va tashqi integratsiya vazifalari bu o‘nta ID orasida yo‘q. Sale atomicitydagi ichki cash/debt doirasi qabul qilindi; provider-specific outbox/real settlement foydalanuvchi belgilagan keyingi integratsiya doirasida qoladi.

## Yana 15 ta PLAN1 bandi — yakuniy qabul (2026-10-06)

Aynan15 ta alohida PLAN1 ID qabul mezoni bo‘yicha `done`ga o‘tdi: umumiy done **25→40**. Oldingi batch holati qayta sanalmadi. Qolgan parent bandlar, tashqi integratsiyalar va real release/pilot tugallangan deb ko‘rsatilmaydi.

| ID | Status | Tekshirilgan kirish va kutilgan → haqiqiy natija | Takrorlanadigan dalil |
| --- | --- | --- | --- |
| SEC-01.03 | done | Foreign store/register/shift/product/customer bilan checkout rad; sale/operation/audit0. Draft customer update404, eski customer/note saqlangan. Foreign payment store/shift/customer DB insert rad va payment0. Old composite FK/chain triggers + yangi correction branch guard saqlangan. | reports-finance: `Every checkout reference...`, `Correction references...`; foundation tenant API; migration004_scope; src/server/sales/service.ts va src/app/api/sales/[id]/route.ts |
| SEC-01.05 | done | Kassir boshqa kassir/owner smenasida HTTP checkout/sync qilolmaydi404, own shift200. Product/sale nested tannarx redacted; financial reports/refund403. Unauthorized effect0. | reports-finance: `Cashier shift ownership...`; catalog-journal existing cashier costs; src/server/auth/policy.ts/scoped-prisma.ts/api.ts |
| SEC-01.06 | done | Store vakolati updateMember orqali bekor bo‘lgach old session/raw cookie ham401; old verified context bilan economic service401 va posting0. | reports-finance: `Cashier shift ownership...`; economic: `Revoked sessions...`; auth/session va operations |
| RET-01.01 | done | Original chekdan qisman va to‘liq return original line IDs bilan, qaytarmaga stock/refund/debt bog‘langan. Foreign original chek rad, begona hujjat/effect yaratilmaydi. | economic: mixed cash/debt partial/full return va disposition; reports-finance: `Parallel returns...`; HTTPS birinchi oqim |
| RET-01.02 | done | Bir original dona uchun parallel ikki return: aynan bittasi muvaffaqiyatli, inventory original2ga qaytgan. Old returns ayiriladi, excess rad; replay duplicate emas. | reports-finance: `Parallel returns...`; economic successive partial/mixed returns; returns/service Serializable/row locks |
| RET-01.07 | done | Blank reason validation rad. Owner approval processedBy=approvedBy, role/time va original link/audit saqlangan; cashier403. Parent/item edit/delete/late append rad, approval role NULL bilan partial hujjat CHECK rad. Browser HTML nusxada original ID/sabab/owner tasdiq bor. | reports-finance: `Parallel returns...`, cashier test; tests/e2e/core.spec.ts HTML download; migrations019/021; ReturnHistory.tsx |
| FIN-01.03 | done | Opening10, cash sale100, collection30, refund65, manual+5−2, cash+7−3, deposit20, inkassatsiya10 → expected52; close/detail52. Barcha manbalar alohida, bir key bilan cash replay bitta. Closed payment/cash edit/delete rad. | reports-finance: `Cash sources...`; shifts.ts shiftCashSummary/closeShift; ShiftCashSummary.tsx va cash UI |
| FIN-01.07 | done | Closed original expected0 edit/delete/register cascade rad. +3.50 yangi open smenada linked immutable correction+cash+audit, parallel replay1, original0 saqlangan, posting expected3.50. Orphan correction cash rad; boshqa tenant/branch/role rad. Committed replay posting closed bo‘lgach ham original ID. | reports-finance: `Closed shift correction...`, `Correction references...`; HTTPS yangi oqim commit-javob abort→reload→same-payload retry1; migrations019/020 |
| FIN-02.01 | done | Weighted average10×50+10×100 /20=75, zero stock cost reset va6-digit rounding/max NUMERIC precision unitda mos. New stock150ga original50 return → cost100; stock0 katalog999ga original50 return →50. Replay qayta revalue qilmaydi. Negative quantity reconciliation rad. | calculations.unit weighted tests; reports-finance: `Sellable returns...`; economic purchase weighted/reversal regressiyasi; inventory/valuation.ts; ADR-015 global cost policy |
| REP-01.01 | done | Sales/products/dashboard/reconciliation va CSV: A/B organization403, admin hidden branch404, allowed filial ko‘rinadi, hidden data total/exportga kirmaydi. | reports-finance: `All reports and exports...`; prior inventory/catalog/ledger export scope tests; financial.ts va parameterized SQL |
| REP-01.02 | done | Tashkent kunining birinchi/oxirgi millisekundi kiradi, oldingi/keyingi kun chiqadi. Calendar/future cutoff400; UTC conversion, NewYork DST23/25h unitda. | reports-finance: `Report day boundaries...`; calculations.unit DST; reports/dates.ts |
| REP-01.03 | done |1000 receipts, page1 va page1000 limit1 → global count1000, gross19000, net18990.50; summary sahifaga bog‘liq emas. Unsafe offset400. Product global qty1999, tarixiy cost6663.332667. | reports-finance: `1000 receipts...`; sales/products SQL aggregates va shared paging |
| REP-01.04 | done | Dataset cashsales9500, creditsales9500, debtcollection11, cashrefund9.50, cashnet9501.50; gross19000−refund9.50=net18990.50. Nasiya haqiqiy cash receiptga aralashmaydi, collection sale revenuega ikkinchi marta qo‘shilmaydi. | reports-finance:1000 dataset/cash sources; economic commercial export conservation; financialSummary va CSV markers |
| REP-01.05 | done | Har receipt qty2×originalcost3.333333;1000 receipts minus1-unit return → qty1999, COGS6663.332667. Catalogcost999/saleprice888 eski revenue/costni o‘zgartirmaydi; CSV/product summary mos. | reports-finance:1000 dataset; economic snapshot tests; products report SUM(quantity*unitCost), return reversal |
| REP-01.10 | done | Ayni tenant/store/local-date/asOfda table/global summary/dashboard/salesCSV count1000 va net18990.50 mos. Keyin yozilgan receipt eski cutoffdan chiqadi, refresh count1001. HTTPS61-row page2/export/dashboard bir cutoff61; keyingi sale refresh62, link ham cutoffni tashiydi. | reports-finance:1000 dataset; tests/e2e/core.spec.ts uchinchi oqim; reports/financial.ts, report/dashboard UI |

### Yakuniy protokol va versiya

Boshlang‘ich commit `ede4188` + joriy ishchi daraxt. Testlangan source SHA256: `35ceefab9e5e2160ec7184ed9a14dee1d296fb5683e48f9ebc46f691659c2cec`. To‘plam229 fayl: src/tests/prisma/scripts ostidagi `.ts`, `.tsx`, `.sql`, `.prisma`, `.cjs`, `.sh`; sorted path + NUL + file bytes + NUL. Docs hashga kirmaydi. AI commit yaratmadi. ADR-015, api.md va README qaror/contract/foydalanuvchi oqimini qayd etadi.

- `npm run typecheck`: exit0, `/tmp/pos-typecheck.log`.
- `npm run lint`: exit0, warnings/errors0, `/tmp/pos-lint.log`.
- `npm test`: **14/14**, failed/skipped/todo0, `/tmp/pos-unit.log`.
- Izolyatsiyalangan test DATABASE_URL bilan `npm run test:integration`: **78/78**, failed/skipped/todo0, `/tmp/pos-integration.log`. Yangi doimiy artefakt `tests/reports-finance.integration.test.ts`10 scenario va calculations.unit qo‘shimchalari.
- Shu test URL bilan `npm run build`: exit0, `/tmp/pos-build.log`.
- Test URL + `PLAYWRIGHT_BROWSERS_PATH=/tmp/pos-playwright-browsers npm run test:e2e`: **3/3 production HTTPS Chromium scenario**, `/tmp/pos-e2e.log`; eski core/katalog regressiyasi va yangi correction/report/recovery oqimi.
- `bash scripts/ops/test-migrations.sh`: **22 migration**, fresh va legacy allocation/debt/barcode/unit fixture backfill o‘tdi, `/tmp/pos-migration-suite.log`.
- `bash scripts/ops/test-backup.sh`: encrypted checksumli dump, transactional empty DB restore,22 migration records va count/readings/freeze/debt recovery o‘tdi; nonempty overwrite rad. `/tmp/pos-backup.log`.
- `git diff --check`: exit0.

Migratsiyalar019/020/021 faqat localhost:55439/pos_testga qo‘llandi; ops script vaqtinchalik fresh/legacy/restore bazalarni yaratib tozaladi. Real biznes DBga tegilmagan. Loglar joriy muhit uchun vaqtinchalik; doimiy dalil versioned kod/test/skriptlar. Birinchi browser run eski credit draftda500 oldi; alohida qayta runs3/3 o‘tdi, mutation/DDL testlarini bitta bazada parallel yuritish yakuniy qabul protokolida ishlatilmadi. Xavfsizlik qoidalari yumshatilmadi.

Chegaralar: asOf event/createdAt cutoff; har request repeatable-read bo‘lsa ham cross-request durable PostgreSQL snapshot emas, cutoffdan oldin boshlangan va keyin commit bo‘lgan transaction uchun alohida historical-report snapshot kerak bo‘lishi mumkin. Dashboard operational stock/open-shift va katalog sarlavhasi current; topProducts gross, net tahlil mahsulot hisobotida. Bankdeposit/inkassatsiya custody journal, tashqi bank settlement emas. Legacy approver NULL, tarix taxmin qilinmagan. Return HTML nonfiscal nusxa; hardware yo‘q. FIFO/partiya layers, real provider va uch-brauzer QA acceptance qolgan doira: **QA-01.03 done emas va15 hisobiga kiritilmadi**. Real Click/fiscal/E-POS/printer/scale/special scanner/cashdrawer implementatsiyalariga tegilmadi.

## Keyingi 10 ta PLAN1 bandi — savat va to‘lov qabul protokoli (2026-10-06)

Aynan10 yangi PLAN1 ID `done`: **40→50**. Mavjud bandlar qayta hisoblanmadi. OFF-02.03/.04 reservation/signed lease, PWA, provider yoki butun production release tugadi deb ko‘rsatilmaydi.

| ID | Status | Tekshirilgan kirish va kutilgan → haqiqiy natija | Takrorlanadigan dalil |
| --- | --- | --- | --- |
| POS-02.02 | done | O‘z cart/customer/note/service IndexedDBda persist; tab yopilib shu browser contextda yangi oyna ochilgach tiklandi, old comprehensive refresh ham o‘tdi. Boshqa user/device navbati0; scope almashtirishda in-memory savat tozalanib hydration gate ishlaydi. Draft envelope version1, legacy versionless qabul qilinadi, unknown version overwrite yo‘q. | tests/e2e/core.spec.ts1/4/5-scenario; src/lib/offline.ts, POS hydration; browser disk/user-profile tozalash yoki evict bu persistent guarantee emas |
| POS-02.03 | done |100000 receipt:60000cash+40000card → cash60000, card40000;60000cash+40000credit → cash60000, debt40000. Server payment sums exact; HTTP/browser mixed payment, scientific notation rad va effect0. Card ichki manual record, provider pending success deb qabul qilinmaydi. | reports-finance: `Mixed cash/card...`; HTTPS4-scenario customer/credit; PaymentModal fixed-point validation; existing ledger conservation tests |
| POS-02.04 | done |100000cashsale uchun120000tender−20000change=100000applied. Server computes snapshot; insufficient/no-cash tender400 va rollback, o‘zgargan retry409. Browser100.25sale/150.25tender→50change; mixed80000tender/60000cash→20000change. | reports-finance: `Tender and change...`; HTTPS1/4; service.ts/PaymentModal/ReceiptPreview; migration022 |
| POS-02.08 | done | Customer, chek izohi, current-user seller va optional serviceType yangi draft/posted receiptda saqlanadi; browser reopen/recovery+HTML receipt note mos. Foreign seller rad, cashier boshqa seller rad, blank service schema rad; optional maydonsiz legacy checkout o‘tadi. | reports-finance: `Mixed cash/card...`, `Optional sale metadata...`; HTTPS4; saleDraftSchema, migration023 seller scope/length guard; POS note/service UI |
| FIN-01.05 | done | Tender120000 kassaga revenue deb qo‘shilmaydi; applied100000expectedCash. Mixedcard/debt datasetda expected120000cash (ikki60000), debt40000 alohida; change snapshot immutable, legacy tenderNULL va taxminiy backfill yo‘q. | reports-finance:tender/mixed testlar; shiftCashSummary/payment ledger; immutable Sale guard; unit exact money regressiyalari |
| OFF-01.01 | done | Real readiness503 (navigator online bo‘lsa ham) → offline banner, saved cart va disabled checkout, sale0. Reconnect automatic GET-only bounded backoff bilan online; economic POST operator actiondan keyin, original key bilan. | HTTPS4; usePosConnection timeout5s,2/4/8/16/30s failure backoff/online30s; existing commit-response-loss recovery1-scenario |
| OFF-01.02 | done | Server commitdan keyin complete response abort, reload → operation status asl sale ID. Asl payments/stock bir marta; UI original receiptni qaytaradi, yangi sale yo‘q. Foreign actor/tenant operation qayta ishlatilmaydi. | HTTPS1/4; reports-finance: `Sync response loss...`; foundation `Sale HTTP contract...`; operations/status va POS recoverCheckout |
| OFF-02.02 | done | Device ID barqaror; pending queue reloadga chidamli; repeated/concurrent sync bitta sale/payment/movement. Single ID boshqa type/scope/payload bilan atomik rad. Web Locks same-scope syncni serialize qiladi; server final duplicate guard. Wrong acknowledgement ID local queuega tegmaydi. | HTTPS4/5; reports-finance:`Sync response loss...`; offline.ts single IDB transaction/ack batch validation; sync max25 |
| OFF-02.05 | done | Pending navbat bilan logout va clear rad, draft/queue saqlangan; synceddan keyin scoped clear ishlaydi, boshqa user draft saqlangan. Boshqa device/user pending listing0. New local cart extra customer/private/nested supplier/cost maydonlarini strip qiladi. Terminal syncedni kechikkan conflict qayta ochmaydi. | HTTPS4 logout guard va5 IDB clear/ack/concurrent payload/minimization; AuthContext logout va offline clearScope ikki-store transaction |
| DATA-01.03 | done | Concurrent checkout last-unit, stock receive/return, partial/full return va parallel shift/open/correction final invariantlari saqlangan. Prisma serialization/deadlock codes bilan retry aynan3, permission1; uchinchi conflict boshqariladigan409 CONCURRENT_CONFLICT. | tests/operations.unit.test.ts; economic explicit Promise.all concurrency/rollback; reports-finance parallel return/correction/sync; runOperation |

### Testlar, versiya va chegaralar

Boshlang‘ich commit `18268f4` + ishchi daraxt. Testlangan source SHA256 `4658b30b2f3e0c7a9b319479e0c1c55b6d45cd64c8610d96538270f991577601`. To‘plam233 fayl: src/tests/prisma/scripts ostidagi `.ts`, `.tsx`, `.sql`, `.prisma`, `.cjs`, `.sh`; sorted path+NUL+bytes+NUL. Docs hashga kirmaydi. AI commit yaratmadi. ADR-016, api.md va README contract/qaror/foydalanuvchi oqimini qayd etadi.

- `npm run typecheck`: exit0; `/tmp/pos-typecheck.log`.
- `npm run lint`: exit0, error/warning0; `/tmp/pos-lint.log`.
- `npm test`: **15/15**, failed/skipped/todo0; `/tmp/pos-unit.log`. Yangi bounded retry artefakti `tests/operations.unit.test.ts`.
- Test DATABASE_URL bilan `npm run test:integration`: **83/83**, failed/skipped/todo0; `/tmp/pos-integration.log`. Yangi5 scenario reports-finance faylida; old78 regressiya saqlangan. Fayllar shared DB/DDL isolation uchun ketma-ket, test ichidagi explicit concurrent amallar parallel.
- Shu URL bilan `npm run build`: exit0; `/tmp/pos-build.log`.
- Test URL+`PLAYWRIGHT_BROWSERS_PATH=/tmp/pos-playwright-browsers npm run test:e2e`: **5/5 production HTTPS Chromium scenario**; `/tmp/pos-e2e.log`. New scenarios real POS recovery va real browser IndexedDB kutubxona funksiyalari. Test-only transpiled offline module import browserda, production debug endpoint qo‘shilmagan.
- `bash scripts/ops/test-migrations.sh`: **24 migration** fresh va legacy fixture backfill o‘tdi; `/tmp/pos-migration-suite.log`.
- `bash scripts/ops/test-backup.sh`: encrypted checksumli dump va transactional empty DB restore,24 migration records/count/readings/freeze/debt recovery; nonempty overwrite rad; `/tmp/pos-backup.log`.
- `git diff --check`: exit0.

Birinchi parallel-files integration run transient P2034 oldi: suite fayl concurrency1ga o‘tkazildi, iqtisodiy parallel testlar o‘zgarmadi va final83/83 o‘tdi. Oxirgi retryable production conflict endi generic500 emas409. Birinchi yangi browser test status matnini button bilan bir DOM text node sifatida topolmadi; status alohida span qilindi. Fixtureda missing openingCash TypeScript tomonidan tutildi va0 bilan tuzatildi. Final build/typecheck/browser qabul qayta o‘tdi; guardlar yumshatilmadi.

Faqat localhost:55439/pos_test va ops skript yaratib tozalaydigan vaqtinchalik bazalar. Production data/deploy yo‘q. Loglar vaqtinchalik artefaktlar, doimiy dalil versioned test/skript/migration. Browser test bir profile/context ichida tabni yopib qayta ochish va reloadni tekshiradi; device storage evict/qo‘lda tozalash/XSSdan mutlaq himoya da’vosi yo‘q. Offline cart navbati global stock reservation yoki darhol revoke yetkazish kafolati emas; server live validation authoritative. PWA, signed lease, reservation, worker/bg sync, manual conflict resolutionning qolgan bandlari ochiq. QA-01.03 ko‘p brauzerli acceptance yoki SEC-02.02 full CSRF-token contracti bu10 hisobiga kiritilmadi. Tashqi Click/fiscal/E-POS/printer/scale/special scanner/cashdrawer vendor implementatsiyalariga tegilmadi.
