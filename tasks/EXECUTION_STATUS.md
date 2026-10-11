# Bajarish statusi

Sana: 2026-10-11. Barcha PLAN1 bandlari quyida kuzatiladi. Kod mavjudligi yakuniy qabul dalili emas. Oldingi foundation kodi mavjud `9594e50` commitda; keyingi o‘zgarishlar ishchi daraxtda. Avtomatik commit yaratilmaydi.

Joriy original done: **158**. Eng so‘nggi +20 so‘rov baseline158, target178: **0/20**, 20 band ochiq. Oldingi baseline157 hisob tarixiy checkpointda saqlangan. Core tayyorgarlik tashqi qabul o‘rnida sanalmaydi.

## Boshlang‘ich checkpoint (tarixiy)

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
| SEC-01.01 | CORE-1 | done | Tashkilotni faqat so‘rov tanasidan emas, haqiqiy sessiya va faol a’zolikdan aniqlash. | +50 checkpoint: individual qabul protokoli, versioned tests/migrations; 90 PG + 17 unit + 6 HTTPS browser | Regressiyani saqlash |
| SEC-01.02 | CORE-1 | done | Har bir ro‘yxat, tafsilot, o‘zgartirish, eksport, fayl va fon ishida tashkilot chegarasini tekshirish. | 2026-10-08: soliq/refund/scope/backup yakuniy protokoli; versioned source va avtomatik sinovlar | Regressiyani saqlash; hosting/vendor integratsiyalari alohida |
| SEC-01.03 | CORE-1 | done | Do‘kon, kassa, smena, mahsulot, mijoz va to‘lov bir tashkilotga tegishli ekanini tekshirish. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| SEC-01.04 | CORE-1 | done | 243 explicit protected action role matrix; unknown path/method/role failclosed; existing DAL/tenant/branch/shift/platform constraints retained | full253/final focused16/unit25/three-browser12 PASS; permission-receipt-20261010.json | New endpoints require explicit map plus allow/deny acceptance |
| SEC-01.05 | CORE-1 | done | Kassir boshqa kassir smenasida ruxsatsiz savdo qilmasligi; tannarx va foydani vakolatsiz ko‘rmasligi. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| SEC-01.06 | CORE-1 | done | Ruxsatlar bekor bo‘lganda eski sessiya ham bu amallarni bajara olmasligi. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| SEC-01.07 | CORE-1 | done | Admin panel va yordam xizmati kirishlarini ham shu nazoratga olish. | Owner consent + live operator/session/branch/scope/expiry/revoke; migration062; full158/158, focused2/2, browser9/9 | Regression; real operator provisioning/deploy alohida |
| SEC-02.01 | CORE-1 | blocked_external | HTTPS; productionda kuchli kalit majburiy, standart kalit bilan ishga tushmaslik. | HTTPS origin startup validation, cookie, DB login limit, bounded JSON, requestId | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| SEC-02.02 | CORE-1 | done | Brauzer uchun xavfsiz sessiya yechimi: HttpOnly/Secure cookie, muddat, serverda bekor qilish; cookie ishlatilsa CSRF himoyasi. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| SEC-02.03 | CORE-1 | blocked_external | Chiqish, barcha qurilmalardan chiqish, parol almashtirish va parol tiklash. | Existing logout/change-password; secure hashed reset token, encrypted delivery queue, expiry/one-use/rate controls, atomic password/session/PIN revocation, recovery UI; authentication-delivery.md | SMS/e-mail vendor unselected; production reset delivery unavailable, not counted done |
| SEC-02.04 | CORE-1 | blocked_external | Telefon/e-mail tasdiqlash, bir martalik kod muddati va urinishlar chegarasi. | Provider interfaces; HMAC OTP, AES-GCM queue, current-contact proof, expiry/5 attempts/resend limits, failclosed delivery, test-only mock | Owner deferred real SMS/e-mail; no production mock verification; not counted done |
| SEC-02.05 | CORE-1 | done | Kirish, tiklash, import va qimmat so‘rovlarda tezlik/hajm cheklovlari. | Shared org+actor API budget, public auth admission/IP spoof protection; specific login/reset/import/report/export budgets;1MiB/stream deadline and bounded parser;243 handler429 inventory; full250/final focused6/unit24/browser9 PASS | Application admission accepted; real hosting/TCP/WAF deployment remains under OPS tasks |
| SEC-02.06 | CORE-1 | done | Owner, platforma admini va muhim amallar uchun ikki bosqichli tasdiq. | 21 action MFA; SQL119–125, recovery/rekey/restore quarantine; full313, focused35, CLI2, unit33, browser15 PASS; critical-mfa-restore-20261011.json | Core qabul; real hosting rollout va restore credential/access operator reconciliation alohida tashqi ish |
| SEC-02.07 | CORE-1 | done | API javobi va loglardan parol xeshi, token, maxfiy kalit va keraksiz shaxsiy maydonlarni chiqarish. | Joriy plus-20-b individual qabul: 117 PG,27 unit, browser regressiya va restore/restart/worker artefaktlari | Regressiyani saqlash; tashqi integratsiya/hosting alohida ochiq |
| SEC-02.08 | CORE-1 | done | XSS, fayl yuklash, zararli CSV va noto‘g‘ri parametrlar himoyasi. | 2026-10-08 protected files/katalog/CSP protokoli; migration052..055, versioned tests | Regressiyani saqlash |
| SEC-02.09 | CORE-1 | done | Own-account90kun security/session history, suspicious login inbox, audited bounded retry va passive no-touch polling. | ADR052;191full+6focused PG,40unit,86migrations/restore,6browser realworker; qabul quyida | Regression; production jobs worker operator tomonidan ishga tushiriladi |
| USR-01.01 | CORE-1 | done | Taklif, rol/filial tahriri, bloklash va explicit arxivlash/tiklash; moliyaviy tarix saqlanadi. | +1 checkpoint: migration026, economic invitation test, reports-finance lifecycle tests, HTTPS browser archive/reload/restore/reactivate | Regressiyani saqlash |
| USR-01.02 | CORE-1 | done | Oxirgi egani o‘chirish/bloklashga yo‘l qo‘ymaslik; egalikni topshirish jarayoni. | +50 checkpoint: individual qabul protokoli, versioned tests/migrations; 90 PG + 17 unit + 6 HTTPS browser | Regressiyani saqlash |
| USR-01.03 | CORE-1 | done | Bir foydalanuvchining bir nechta biznesi orasida vakolat bilan almashish. | +50 checkpoint: individual qabul protokoli, versioned tests/migrations; 90 PG + 17 unit + 6 HTTPS browser | Regressiyani saqlash |
| USR-01.04 | CORE-1 | done | Tez kassir almashish uchun PIN; PIN yuqori vakolat o‘rnini bosmasligi. | 2026-10-08 cashier PIN protokoli; migration056 + integration/browser | Regressiyani saqlash |
| USR-01.05 | CORE-1 | done | Qaytarish, narx o‘zgartirish, katta chegirma va inventar farqiga manager tasdig‘i. | 2026-10-08: PWA/manager protokoli, versioned service/unit/integration/E2E | Regressiyani saqlash |
| USR-01.06 | CORE-1 | done | Owner boshqaradigan admin/cashier subset profillari; Omborchi/Buxgalter/Kuzatuvchi namunasi. | SQL122, allow/deny/branch/revision/session/rollback; full302, unit33files, browser3, fresh/legacy/build/worker/lint | Keyingi MFA inventory va operator rekey SEC-02.06 doirasida alohida |
| POS-01.01 | CORE-1 | done | Narx, tannarx, birlik, kassir va vakolatlarni serverda ishonchli manbadan olish. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-01.02 | CORE-1 | done | Bo‘sh savat, manfiy/yaroqsiz son, ortiqcha chegirma va noto‘g‘ri IDlarni rad etish. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-01.03 | CORE-1 | done | Savdo, to‘lov, ombor va auditni bitta nazorat qilinadigan amalda yakunlash. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-01.04 | CORE-1 | done | Takror so‘rov bir savdoni ikki marta yozmasligi uchun yagona amal kaliti qo‘shish — idempotency. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-01.05 | CORE-1 | done | Ochiq smena, qoldiq, limit va holatni tranzaksiya ichida tekshirish; parallel amallardan himoya. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-01.06 | CORE-1 | done | Chek raqamini yozuvlar soniga bog‘lamasdan noyob ajratish; fiskal raqamni alohida saqlash. | +10 checkpoint: individual expected/actual, source SHA256,101 PG +18 unit +27 browser +28 migration/restore | Qabul qilingan; regression va documented integration/legacy boundaries saqlansin |
| POS-01.07 | CORE-1 | done | Timeoutdan keyin “sotildimi?” holatini tekshirib, xavfsiz davom ettirish. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-01.08 | CORE-1 | done | Yakunlangan savdoni yashirin tahrirlash/o‘chirishni taqiqlash; tuzatishni qarshi hujjat bilan yuritish. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-02.01 | CORE-1 | done | Qoralamani saqlash, vaqtincha chetga qo‘yish, qayta ochish va bekor qilish. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| POS-02.02 | CORE-1 | done | Savatni brauzer yopilishi/yangilanishidan tiklash; qurilma va foydalanuvchi chegarasi. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-02.03 | CORE-1 | done | Aralash to‘lov: masalan, 60 000 naqd + 40 000 karta; qisman nasiya. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-02.04 | CORE-1 | done | Qaytimni haqiqiy naqd berilgan summa bilan ko‘rsatish, tushumga faqat tegishli summani yozish. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-02.05 | CORE-1 | done | Klaviatura tezkor tugmalari, USB skaner, tezkor mahsulotlar, qulay qidiruv. | Joriy plus-20-b individual qabul: 117 PG,27 unit, browser regressiya va restore/restart/worker artefaktlari | Regressiyani saqlash; tashqi integratsiya/hosting alohida ochiq |
| POS-02.06 | CORE-1 | done | Har qator/butun chek chegirmasi; foiz/summa; sabab va tasdiq. | 2026-10-08: soliq/refund/scope/backup yakuniy protokoli; versioned source va avtomatik sinovlar | Regressiyani saqlash; hosting/vendor integratsiyalari alohida |
| POS-02.07 | CORE-1 | done | Qoldiq va narx o‘zgarganini savat yakunida tushunarli ko‘rsatish. | +10 checkpoint: individual expected/actual, source SHA256,101 PG +18 unit +27 browser +28 migration/restore | Qabul qilingan; regression va documented integration/legacy boundaries saqlansin |
| POS-02.08 | CORE-1 | done | Mijoz tanlash, chek izohi, sotuvchi/xizmat turi kerak bo‘lsa belgilash. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| POS-02.09 | CORE-1 | in_progress | 58/80mm copy labels, browser print audit/replay and migration109 immutable organization/branch/register/cashier/currency/timezone/footer snapshot | full253/focused16/browser12; legacy identity stays NULL, no fabricated backfill | Token-link core and approved-contact electronic delivery remain; SMS/e-mail vendor deferred; not counted done |
| RET-01.01 | CORE-1 | done | Original chek bo‘yicha to‘liq va qisman qaytarish. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| RET-01.02 | CORE-1 | done | Oldingi qaytarishlarni hisobga olish; sotilganidan ko‘p qaytarishni taqiqlash. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| RET-01.03 | CORE-1 | done | Chegirma va soliqni qaytarilayotgan qatorga to‘g‘ri taqsimlash. | 2026-10-08: soliq/refund/scope/backup yakuniy protokoli; versioned source va avtomatik sinovlar | Regressiyani saqlash; hosting/vendor integratsiyalari alohida |
| RET-01.04 | CORE-1 | done | Sellable/brak/write_off; alohida filial DamageLocation va immutable disposition journal/qoldiq. | Migration036/037; scoped UI/API/CSV; frozen cost; replay/rollback integration; uch-browser acceptance | Repair/release va general reservation INV-02 doirasida ochiq |
| RET-01.05 | CORE-1 | done | Naqd/karta/nasiya aralash savdoda pul va qarzning qaytarish tartibini belgilash. | Joriy plus-20-b individual qabul: 117 PG,27 unit, browser regressiya va restore/restart/worker artefaktlari | Regressiyani saqlash; tashqi integratsiya/hosting alohida ochiq |
| RET-01.06 | EXTERNAL-LATER | deferred | Provayder orqali refund, uning kutish/xato holati va takror so‘rovdan himoya. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| RET-01.07 | CORE-1 | done | Sabab, vakolat, tasdiqlovchi, qaytarma chek va audit. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| RET-01.08 | CORE-1 | done | Tovar almashtirishni original qaytarish + yangi savdo sifatida bog‘lash. | ADR050;179 full PG+4focused,83fresh/legacy,40unit,9browser; qabul quyida | Original exchange/naqd/nasiya/rollback regressiyasini saqlash |
| CAT-01.01 | CORE-1 | done | Kategoriya daraxti, brend, rasm, tavsif va faol/arxiv holati. | 2026-10-08 protected files/katalog/CSP protokoli; migration052..055, versioned tests | Regressiyani saqlash |
| CAT-01.02 | CORE-1 | done | Bir mahsulot uchun bir nechta barkod; barkod yaratish va etiketka chiqarish. | +50 checkpoint: individual qabul protokoli, versioned tests/migrations; 90 PG + 17 unit + 6 HTTPS browser | Regressiyani saqlash |
| CAT-01.03 | CORE-1 | done | Canonical rang/o‘lcham variantlari, har SKU stock/barcode mustaqil; eski default backfill. | Quyidagi CAT-01.03 protokoli:138 integration,27 unit,9 browser,fresh/legacy51 | Regressiyani saqlash |
| CAT-01.04 | CORE-1 | done | Birlik konvertatsiyasi: 1 quti = 12 dona; asosiy birlikda qoldiq, hujjatda savdo birligi. | — | — |
| CAT-01.05 | CORE-1 | in_progress | Kasr bilan sotish, birlik aniqligi, tarozi barkodidan vazn/narx ajratish. | Existing unit precision/service guard; complete manager paginated unit management/search/CSV | Scale-barcode parsing requires approved format; real scale hardware external-later |
| CAT-01.06 | CORE-1 | done | Chakana/ulgurji/mijoz narxlari; filial narxi va sanadan kuchga kiradigan narx. | ADR044/045; immutable rule/receipt, normalized duplicates + settled alias history; full163, finalfocused5, unit35,73migration,browser18 | Regression; open debt merge blocked, external verification not assumed |
| CAT-01.07 | CORE-1 | done | Avtomatik narx tarixi; 100lik reviewed atomic batch; cost edit/history/export alohida owner vakolati. | Migration035/037; prices service/UI; expected-price/hash/audit/replay; lost response + exact six-decimal browser test | Katta katalog alohida tasdiqlangan batchlarda; eski chek snapshotlari saqlanadi |
| CAT-01.08 | CORE-1 | done | Excel/CSV import, oldindan ko‘rish, dublikat/xato qatorlar hisoboti, eksport. | ADR048 va quyidagi2026-10-09 import qabul protokoli:3 focused,174 full PG,40unit,9browser,standalone | Regressiyani saqlash; import faqat reviewed new products, no silent updates |
| CAT-01.09 | CORE-1 | done | Owner tasnifi, MXIK manbasi va tax/marking checkout/offline fail-closed; immutable receipt snapshot. | ADR053;194 PG,14unit,3browser,87fresh/legacy,encrypted restore6s; dalil quyida | Rasmiy katalog/vendor integratsiyasi alohida |
| INV-01.01 | CORE-1 | done | Har bir o‘zgarish uchun hujjat va ombor harakati; bevosita qoldiqni almashtirishni taqiqlash. | +50 checkpoint: individual qabul protokoli, versioned tests/migrations; 90 PG + 17 unit + 6 HTTPS browser | Regressiyani saqlash |
| INV-01.02 | CORE-1 | done | Boshlang‘ich qoldiqni hujjat bilan kiritish; musbat/manfiy tuzatish, sabab va tasdiq. | +50 checkpoint: individual qabul protokoli, versioned tests/migrations; 90 PG + 17 unit + 6 HTTPS browser | Regressiyani saqlash |
| INV-01.03 | CORE-1 | done | Tasdiqlangan hujjat o‘zgarmasligi; xatoni bekor qiluvchi yoki qarshi hujjat. | Migration011 DB guards + unique original/reversal link; service/API/UI; economic.integration stock reversal/rollback tests; Chromium UI reversal passed | — |
| INV-01.04 | CORE-1 | done | Jo‘natishda yetarli qoldiq, yo‘ldagi mahsulot, qisman qabul, kamomad/brak hisobini yuritish. | 2026-10-08 transfer outcomes protokoli; migrations060/061,158PG,3browser | Regressiyani saqlash |
| INV-01.05 | CORE-1 | done | Transferni jo‘natishdan oldin bekor qilish; jo‘natilgandan keyingi qaytarish qoidasi. | Draft cancel no stock effect; transit return quantity journal/audit/idempotency; migration012 received+returned bound; parallel receive/return test; browser return passed | Received goods use a new reverse-direction transfer, ADR-008 |
| INV-01.06 | CORE-1 | done | Qoldiq jurnaliga mosligini tekshiradigan avtomatik solishtirish va farq ogohlantirishi. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| INV-01.07 | CORE-1 | in_progress | Manfiy qoldiq siyosatini aniq belgilash; yoqilsa foyda/tannarx ta’sirini hisoblash. | Atomic movement journal, stock documents, partial transfers, weighted purchase cost tests | Stock reconciliation, cancellation/reversal, shortage/damage, purchase history UI |
| INV-02.01 | CORE-1 | done | To‘liq/qisman sanash; kutilgan qoldiqni yashirib sanash imkoniyati. | StockCount/Line/Reading API+UI; blind DTO hides expected/cost until review; full/partial and browser checks | 1–2000 SKU per session; larger catalog split into partial sessions, ADR-009 |
| INV-02.02 | CORE-1 | done | Sanash davridagi savdolarni hisobga olish yoki vaqtinchalik bloklash siyosati. | Selected SKU logical freeze; short common advisory lock+balance version; DB freeze trigger; concurrent checkout checkpoint test and unselected SKU sale | No long DB transaction during physical counting; manager finalizes/cancels active freezes |
| INV-02.03 | CORE-1 | done | Farq hujjati, qayta sanash va tasdiqlovchi. | Append-only rounds/actor/time; nonzero requires recount; idempotent linked adjustment+journal+manager reason/audit; terminal history guards; browser approval | — |
| INV-02.04 | CORE-1 | done | Minimal/maksimal qoldiq, tugayotgan mahsulot va qayta buyurtma tavsiyasi. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| INV-02.05 | CORE-1 | done | Ombor manzili/zonasi, brak va rezerv qoldiq kerak bo‘lsa alohida yuritish. | 2026-10-09: zona/rezerv qabul protokoli, 074/075 va versioned tests | Regressiyani saqlash |
| INV-02.06 | CORE-1 | todo | Partiya, yaroqlilik muddati, FEFO tanlash va muddati yaqin ogohlantirish — oziq-ovqat segmentida P1. | — | — |
| INV-02.07 | CORE-1 | todo | Seriya raqami/kafolat — elektronika segmentida P1. | — | — |
| PUR-01.01 | CORE-1 | done | Yetkazib beruvchi kartasi, kontaktlar, rekvizitlar, shartlar va tarix. | Migration032 +042..044; scoped card/receipt/price/payment history; validation/archive/restore; supplier acceptance below | — |
| PUR-01.02 | CORE-1 | done | Buyurtma → qisman/to‘liq qabul → xarid hisoboti → to‘lov zanjiri. | Original Order/Receipt/Stock/Invoice/Allocation FK; atomic partial receipt; races/rollback/3 browsers; migrations045..048 | — |
| PUR-01.03 | CORE-1 | done | Original-bound supplier return/price credit, stock/payable/advance atomic. | Quyidagi PUR-01.03 qabul protokoli:135 integration,27 unit,9 browser,fresh/legacy49 | Regressiyani saqlash; actual cash refund va landed cost alohida |
| PUR-01.04 | CORE-1 | done | Yetkazib beruvchi qarzi, oldindan to‘lov va qisman to‘lash. | Immutable invoice/payment/allocation; cash/bank proof; replay/race/audit rollback; API+three browsers | — |
| PUR-01.05 | CORE-1 | in_progress | Yetkazish/xarid xarajatlarini tannarxga taqsimlash siyosati. | 2026-10-09: exact BigInt allocation; Receipt-backed preview API/UI; durable prepared/cancelled expense-linked immutable plan, 096–097 source/reversal/unique guards, exact source amount and audit rollback; 75 focused financial cases/5 final plan cases PASS | Apply inventory value/COGS corrections and reporting, apply/cancel UI recovery, backup fixture acceptance remain |
| PUR-01.06 | CORE-1 | done | Xarid narxi tarixi, mahsulot/yetkazib beruvchi bo‘yicha tahlil. | +50 checkpoint2; reports/purchases API/UI, historical cost SQL; 92 PG / 17 unit / 6 HTTPS browser, ADR018 | Regressiya va jonli vakolat himoyasini saqlash |
| CRM-01.01 | CORE-1 | done | Nasiya uchun mijoz, vakolat va limitni serverda majburiy tekshirish. | +50 checkpoint2; reports/purchases API/UI, historical cost SQL; 92 PG / 17 unit / 6 HTTPS browser, ADR018 | Regressiya va jonli vakolat himoyasini saqlash |
| CRM-01.02 | CORE-1 | done | Qarz yozuvini haqiqiy pul to‘lovidan ajratish: nasiya naqd tushum deb olinmasligi. | +50 checkpoint2; reports/purchases API/UI, historical cost SQL; 92 PG / 17 unit / 6 HTTPS browser, ADR018 | Regressiya va jonli vakolat himoyasini saqlash |
| CRM-01.03 | CORE-1 | done | Qarzni naqd/karta/o‘tkazma bilan undirish; pulni haqiqiy smena yoki hisobga yozish. | plus-20-c: manual cash/card/transfer UI3 browsers;118 PG+focused proof/readiness2; migration034 unique proof; cash30/debt10 | Regressiyani saqlash; real provider va full finance accounts alohida bandlar |
| CRM-01.04 | CORE-1 | done | Qisman undirish, oldindan to‘lov, ortiqcha to‘lov va qaytarish qoidalari. | Immutable cash advance/allocation/refund, original-funded sale return, exact cash/debt balance; full206/browser3/fresh95/restore23s | Real Click/bank advance external-later; unsupported channels fail closed |
| CRM-01.05 | CORE-1 | done | To‘lovni qaysi qarz/savdoga ajratishni yuritish; boshlang‘ich qarzni alohida hujjat bilan kiritish. | +10 checkpoint: individual expected/actual, source SHA256,101 PG +18 unit +27 browser +28 migration/restore | Qabul qilingan; regression va documented integration/legacy boundaries saqlansin |
| CRM-01.06 | CORE-1 | done | Qarzni o‘chirish/tuzatish faqat sabab, vakolat va audit bilan. | Owner-only immutable new adjustment/write-off; bounds/tenant/live auth/idempotency; migration015 append-only DB guard; weighted write-off refund conservation tests; real browser duplicate prevention | No original ledger edit/delete; correction is a new audited entry |
| CRM-01.07 | CORE-1 | done | Mijoz ko‘chirmasi: savdo, qaytarish, to‘lov, qarz qoldig‘i va muddat. | +10 checkpoint: individual expected/actual, source SHA256,101 PG +18 unit +27 browser +28 migration/restore | Qabul qilingan; regression va documented integration/legacy boundaries saqlansin |
| CRM-02.01 | CORE-1 | done | P1: mijoz qidirish, dublikatlarni nazorat qilish, xarid tarixi, guruhlar va narx darajasi. | ADR044/045; immutable rule/receipt, normalized duplicates + settled alias history; full163, finalfocused5, unit35,73migration,browser18 | Regression; open debt merge blocked, external verification not assumed |
| CRM-02.02 | CORE-1 | todo | P1: qarz muddati/kechikish hisoboti, mijozga ko‘chirma va rozilik asosida eslatma. | — | — |
| CRM-02.03 | EXTENSIONS | deferred | P2: bonus ballari, chegirma kartasi, promo-kod va sovg‘a sertifikati. | — | — |
| CRM-02.04 | EXTENSIONS | deferred | P2: bonusning qaytarishda bekor bo‘lishi, muddati va suiiste’moldan himoya. | — | — |
| CRM-02.05 | EXTENSIONS | deferred | P2: marketing SMS/Telegram; xizmat xabari va reklama roziligini alohida boshqarish. | — | — |
| FIN-01.01 | CORE-1 | done | Har kassada bir ochiq smena qoidasi bazada ham himoyalangan bo‘lishi. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| FIN-01.02 | CORE-1 | done | Smenani ochish, yopish va topshirish; ochiq savdolar/integratsiya kutishlari uchun siyosat. | +10 checkpoint: individual expected/actual, source SHA256,101 PG +18 unit +27 browser +28 migration/restore | Qabul qilingan; regression va documented integration/legacy boundaries saqlansin |
| FIN-01.03 | CORE-1 | done | Savdo, qarz undirish, refund, naqd kirim/chiqim va inkassatsiyani alohida hisoblash. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| FIN-01.04 | CORE-1 | done | Sanalgan pul, kutilgan pul, farq, sabab va rahbar tasdig‘i. | +10 checkpoint: individual expected/actual, source SHA256,101 PG +18 unit +27 browser +28 migration/restore | Qabul qilingan; regression va documented integration/legacy boundaries saqlansin |
| FIN-01.05 | CORE-1 | done | Naqd savdoda berilgan pul/qaytimni tushum bilan chalkashtirmaslik. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| FIN-01.06 | EXTERNAL-LATER | deferred | Karta/QR/o‘tkazma bo‘yicha provayder tushumi, komissiya va bank tushumini solishtirish. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| FIN-01.07 | CORE-1 | done | Yopilgan smenani yashirin tahrirlamaslik; tuzatish hujjati. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| FIN-02.01 | CORE-1 | done | Tannarx usulini belgilash: dastlab vaznli o‘rtacha; FIFO/partiya ehtiyoji bo‘lsa kengaytirish. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| FIN-02.02 | CORE-1 | done | Har savdo qatorining tarixiy tannarxi, chegirmasi, solig‘i va yaxlitlanishini saqlash. | 2026-10-08: soliq/refund/scope/backup yakuniy protokoli; versioned source va avtomatik sinovlar | Regressiyani saqlash; hosting/vendor integratsiyalari alohida |
| FIN-02.03 | CORE-1 | done | Chek chegirmasini qatorlarga taqsimlash; qaytarishni shu qiymatlardan hisoblash. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| FIN-02.04 | CORE-1 | done | Biznes xarajatlari, toifalari va to‘lov hisoblari. | plus-20 finance qabul: 124 PG,27 unit,3 HTTPS browser; migration038–041; quyidagi individual protokol | Regressiyani saqlash; boshqa plus-20 bandlari ochiq |
| FIN-02.05 | CORE-1 | done | Yalpi foyda va operatsion foydani aniq ajratish; to‘liq buxgalteriya hisobi bilan teng deb ko‘rsatmaslik. | plus-20 finance qabul: 124 PG,27 unit,3 HTTPS browser; migration038–041; quyidagi individual protokol | Regressiyani saqlash; boshqa plus-20 bandlari ochiq |
| FIN-02.06 | CORE-1 | done | Naqd, bank va provayder hisoblari orasidagi pul o‘tkazmalarini ikki marta tushum deb hisoblamaslik. | plus-20 finance qabul: 124 PG,27 unit,3 HTTPS browser; migration038–041; quyidagi individual protokol | Regressiyani saqlash; boshqa plus-20 bandlari ochiq |
| FIN-02.07 | CORE-1 | done | Soliq stavkasi, imtiyoz, narx ichida/tashqarisida soliq siyosatini sozlash; stavka tarixini saqlash. | 2026-10-08: soliq/refund/scope/backup yakuniy protokoli; versioned source va avtomatik sinovlar | Regressiyani saqlash; hosting/vendor integratsiyalari alohida |
| REP-01.01 | CORE-1 | done | P0: tashkilot va do‘kon filtri hamma ko‘rsatkichga tatbiq etilishi. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| REP-01.02 | CORE-1 | done | P0: vaqt zonasi, davr boshi/oxiri; oxirgi kun to‘liq kirishi. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| REP-01.03 | CORE-1 | done | P0: yig‘indilar joriy sahifadan emas, barcha mos yozuvlardan olinishi. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| REP-01.04 | CORE-1 | done | P0: sotuv, refund, nasiya va haqiqiy pul tushumi bir-biridan ajratilishi. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| REP-01.05 | CORE-1 | done | P0: tannarx har qator `miqdor × tarixiy tannarx`dan hisoblanishi. | 2026-10-06: quyidagi “Yana 15 ta PLAN1 bandi” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| REP-01.06 | CORE-1 | done | P1: savdo, mahsulot, kategoriya, kassir, filial va to‘lov turi kesimidagi tahlil. | Yangi +20 checkpoint: 125 PG + final focused report test;3 HTTPS browsers; five exact reconciled dimensions; quyidagi protokol | Regressiyani saqlash; boshqa +20 bandlari ochiq |
| REP-01.07 | CORE-1 | in_progress | P1: qoldiq qiymati, ombor harakati, kam qoldiq, yaroqlilik va sekin sotiladigan tovarlar. | Scoped balance/movement/low-stock; branch inactiveDays rolling30/60/90 API/UI/full CSV; finance67/focused1/unit33/browser3 PASS; inactive-stock-20261011.json | Partiya/yaroqlilik INV-02.06 va expiry report ochiq; original done emas |
| REP-01.08 | CORE-1 | done | P1: smena, pul farqi, mijoz qarzi muddati, yetkazib beruvchi qarzi va xarid hisoboti. | Supplier balance/aging + existing customer due/shift/purchase; cross-report exact fixture; bounded full CSV + 3 browsers | — |
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
| OFF-01.03 | CORE-1 | done | Printer ishlamasa savdoni ikkinchi marta yaratmasdan chekni qayta chiqarish. | +10 checkpoint: individual expected/actual, source SHA256,101 PG +18 unit +27 browser +28 migration/restore | Qabul qilingan; regression va documented integration/legacy boundaries saqlansin |
| OFF-01.04 | CORE-1 | done | Qurilma ishdan chiqsa boshqa qurilmadan vakolatli davom ettirish. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| OFF-01.05 | CORE-1 | done | Integratsiya xatosi, savdo xatosi va faqat chek chop etish xatosini alohida ko‘rsatish. | +10 checkpoint: individual expected/actual, source SHA256,101 PG +18 unit +27 browser +28 migration/restore | Qabul qilingan; regression va documented integration/legacy boundaries saqlansin |
| OFF-02.01 | CORE-1 | done | PWA va lokal saqlash; mahsulot/narxlar uchun yangilanish chegarasi. | 2026-10-08: PWA/manager protokoli, versioned service/unit/integration/E2E | Regressiyani saqlash |
| OFF-02.02 | CORE-1 | done | Lokal savdo navbati, qurilma identifikatori va server bilan bir martalik sinxronlash. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| OFF-02.03 | CORE-1 | done | Offline qoldiqni bir nechta kassada mutlaq kafolatlab bo‘lmasligini siyosat bilan hal qilish: rezerv, limit yoki ruxsatli manfiy qoldiq. | 2026-10-09: quyidagi offline cash yakuniy qabul; 171 PG,38 unit,27 browser,81 migration/restore va source SHA256 | Regressiyani saqlash; native cash-only, tashqi vendor/hardware deferred |
| OFF-02.04 | CORE-1 | done | Eskirgan narx, nasiya limiti, bloklangan xodim va smena uchun alohida cheklov. | 2026-10-09: quyidagi offline cash yakuniy qabul; 171 PG,38 unit,27 browser,81 migration/restore va source SHA256 | Regressiyani saqlash; native cash-only, tashqi vendor/hardware deferred |
| OFF-02.05 | CORE-1 | done | Lokal ma’lumot xavfsizligi, chiqishda tozalash va sinxronlanmagan savdoni yo‘qotishdan himoya. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| OFF-02.06 | EXTERNAL-LATER | deferred | Kartali to‘lov, markirovka va fiskal amallar offline rejimda faqat provayder/qoidalar ruxsat bergan tartibda. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| OFF-02.07 | CORE-1 | done | Navbat holati, xato savdolarni qo‘lda hal qilish, egaga ogohlantirish. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| HW-01.01 | EXTERNAL-LATER | deferred | USB/2D skaner, 58/80 mm printer, pul tortmasi va tanlangan elektron tarozi. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| HW-01.02 | EXTERNAL-LATER | deferred | Qurilmalar ro‘yxati, OS/brauzer, ulanish usuli va ishlaydigan modellar jadvali. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| HW-01.03 | EXTERNAL-LATER | deferred | Zarur bo‘lsa xavfsiz lokal printer/tarozi agenti; uni o‘rnatish va yangilash. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| HW-01.04 | EXTERNAL-LATER | deferred | Windows kassasi, planshet va mobil ekranlarda real sinov. | ADR-002: foydalanuvchi hozir implementatsiya qilmaslikni belgiladi; vendor contract taxmin qilinmaydi | Alohida topshiriq va rasmiy contract/uskuna tayyor bo‘lganda |
| HW-01.05 | CORE-1 | done | Kassir ekrani uchun katta tugmalar; egaga telefon orqali dashboard. | +10 checkpoint: individual expected/actual, source SHA256,101 PG +18 unit +27 browser +28 migration/restore | Qabul qilingan; regression va documented integration/legacy boundaries saqlansin |
| HW-01.06 | EXTENSIONS | deferred | P2: mijoz displeyi, alohida mobil ilova va ombor terminali. | — | — |
| UX-01.01 | CORE-1 | done | Birlamchi sozlash: tashkilot → filial/kassa → import → boshlang‘ich qoldiq → sinov savdo. | ADR049;176 PG,82migration/restore,40unit,6browser; quyidagi qabul | Source va immutable progress regressiyasini saqlash |
| UX-01.02 | CORE-1 | todo | O‘zbek lotin va rus tili; barcha ishchi matnlarni yagona tarjima tizimiga olish. | — | — |
| UX-01.03 | CORE-1 | todo | Bir xil jadval/formalar, qidiruv, filtr, saralash, sahifalash va bo‘sh holatlar. | — | — |
| UX-01.04 | CORE-1 | done | Xatolarni odam tushunadigan qilib yozish; foydalanuvchi keyin nima qilishi ko‘rsatilishi. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| UX-01.05 | CORE-1 | todo | Loading, qayta urinish, saqlanmagan o‘zgarishlar va amaliy holatning aniq belgisi. | — | — |
| UX-01.06 | CORE-1 | done | Klaviatura bilan boshqarish, kontrast, label va fokus; kassa uchun katta o‘qiladigan matn. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| UX-01.07 | CORE-1 | done | Rolga mos boshlang‘ich ekran va muhim ogohlantirishlar. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| UX-01.08 | CORE-1 | done | Qisqa video/yo‘riqnoma, demo ma’lumotlar, yangi kassirni o‘rgatish. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| UX-01.09 | CORE-1 | done | Import xatolari va printer/internet sozlash bo‘yicha yordam sahifalari. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| DATA-01.01 | CORE-1 | done | Moliyaviy hisobni aniq decimal bilan bajarish; pulni turli joyda turlicha yaxlitlamaslik. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| DATA-01.02 | CORE-1 | done | Foreign key, noyob indeks, son/holat cheklovi va kerakli qidiruv indekslari. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| DATA-01.03 | CORE-1 | done | Qoldiq/savdo/smena holatini atomik o‘zgartirish; deadlock/konfliktni nazoratli qayta urinish. | 2026-10-06: quyidagi “Keyingi 10 ta PLAN1 bandi — savat va to‘lov” test/versiya dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| DATA-01.04 | CORE-1 | in_progress | Tashkilot kaliti va bog‘langan resurs egaligini butun modelda izchil qo‘llash. | Foundation–006 migration, tenant FK/trigger, isolated PostgreSQL tests | Real eski data clone preflight/backfill va fresh-db qayta qabul sinovi |
| DATA-01.05 | CORE-1 | done | Audit yozuvini biznes o‘zgarishi bilan bir tranzaksiyada saqlash. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| DATA-01.06 | CORE-1 | done | Tashqi provayder chaqirig‘ini uzoq baza tranzaksiyasi ichida ushlamaslik; navbat va kompensatsiya jarayoni. | 098–099; transactional outbox, lock-free transport, fenced lookup/compensation; full PG221/221 + final core9/9 | Real vendor adapter/sandbox alohida topshiriq; docs/operations/provider-outbox.md |
| DATA-01.07 | CORE-1 | done | Tashqi chaqiriq natijasi noma’lum bo‘lsa tekshirish va solishtirish; “ikki tizimda bitta tranzaksiya” deb faraz qilmaslik. | 098–099; transactional outbox, lock-free transport, fenced lookup/compensation; full PG221/221 + final core9/9 | Real vendor adapter/sandbox alohida topshiriq; docs/operations/provider-outbox.md |
| DATA-01.08 | CORE-1 | done | Standart xato formati, so‘rov identifikatori, pagination/hajm cheklovi va API shartnomasi. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| DATA-01.09 | CORE-1 | done | Fayllar uchun vakolatli saqlash, yuklash cheklovi va o‘chirish siyosati. | 2026-10-08 protected files/katalog/CSP protokoli; migration052..055, versioned tests | Regressiyani saqlash |
| DATA-01.10 | CORE-1 | in_progress | Migratsiya, ma’lumot ko‘chirish va mavjud hisobni tekshirish uchun skript/reja. | Foundation–006 migration, tenant FK/trigger, isolated PostgreSQL tests | Real eski data clone preflight/backfill va fresh-db qayta qabul sinovi |
| OPS-01.01 | CORE-1 | blocked_external | Development, staging va production alohida baza/kalit bilan. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| OPS-01.02 | CORE-1 | done | Builddan `db push`ni chiqarish; versiyalangan migratsiyani alohida chiqarish bosqichida bajarish. | +50 checkpoint: individual qabul protokoli, versioned tests/migrations; 90 PG + 17 unit + 6 HTTPS browser | Regressiyani saqlash |
| OPS-01.03 | CORE-1 | blocked_external | Yangi/avvalgi ilova bilan mos migratsiya, ma’lumot backfilli va qaytish rejasi. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| OPS-01.04 | CORE-1 | blocked_external | CI: lint → turlar → test → build → staging → qabul tekshiruvi → production. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| OPS-01.05 | CORE-1 | blocked_external | Image versiyasi, minimal vakolatli jarayon, xavfsiz secret saqlash va kalit aylantirish. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| OPS-01.06 | CORE-1 | blocked_external | TLS, domen, firewall; bazani umumiy internetga ochmaslik. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| OPS-01.07 | CORE-1 | done | Health/readiness endpoint, nazoratli restart, ulanish pooli va graceful shutdown. | Joriy plus-20-b individual qabul: 117 PG,27 unit, browser regressiya va restore/restart/worker artefaktlari | Regressiyani saqlash; tashqi integratsiya/hosting alohida ochiq |
| OPS-01.08 | CORE-1 | done | Yangilash vaqtida savdoni yo‘qotmaslik; texnik xizmat oynasi va xabar berish. | Operator atomic flag, durable admission/committed replay, readiness/worker drain, notice/native deploymentId; saved basket/pending original-key three-browser recovery | Real host routing/operator release discipline separately required; non-durable metadata CRUD not blanket-blocked |
| OPS-02.01 | CORE-1 | done | Tuzilgan loglar, request ID, tashkilot ID; maxfiy/shaxsiy ma’lumotlarni niqoblash. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| OPS-02.02 | CORE-1 | blocked_external | API xatolari, sekin so‘rov, baza, disk, navbat, fiskal/to‘lov xatolari monitoringi. | Scoped bounded API metrics, DB/queue/lease alerts, independent uptime and disk probe scripts, local tests; monitoring.md | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| OPS-02.03 | CORE-1 | done | Savdo/to‘lov/qoldiq solishtirish farqi uchun biznes ogohlantirishlari. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| OPS-02.04 | CORE-1 | done | Navbatdagi ishlarni takrorlash va yechilmagan ishlar ro‘yxati. | ADR051;183full+5focused PG,84migrations/restore,40unit,6browser realworker; qabul quyida | Lease/authorization/history/retry regressiyasini saqlash |
| OPS-02.05 | CORE-1 | blocked_external | Xatoni mas’ul xodimga yuborish va eskalatsiya; kim javob berishi aniq bo‘lishi. | — | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| OPS-02.06 | CORE-1 | todo | Status sahifasi, hodisa jurnali va jiddiy hodisadan keyingi tahlil. | — | — |
| OPS-03.01 | CORE-1 | blocked_external | Shifrlangan avtomatik backup; bazaning asosiy serveridan boshqa saqlash joyi. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| OPS-03.02 | CORE-1 | done | Baza bilan birga mahsulot rasmlari, hujjatlar va zarur konfiguratsiya zaxirasi. | 2026-10-08: soliq/refund/scope/backup yakuniy protokoli; versioned source va avtomatik sinovlar | Regressiyani saqlash; hosting/vendor integratsiyalari alohida |
| OPS-03.03 | CORE-1 | blocked_external | Nuqtaga tiklash imkoniyati, backup muddati va kirish vakolati. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| OPS-03.04 | CORE-1 | done | Alohida muhitga amaliy tiklash sinovi; faqat “backup olindi” xabari yetarli emas. | Joriy plus-20-b individual qabul: 117 PG,27 unit, browser regressiya va restore/restart/worker artefaktlari | Regressiyani saqlash; tashqi integratsiya/hosting alohida ochiq |
| OPS-03.05 | CORE-1 | done | Offline recovered clone→read-only tenant comparison; missing/changed/current-only digests, FK review, private exclusive0600 artifact | 5/5 recovery+export PG;33 unit files;build/worker/types/lint PASS; tenant-recovery-20261011.json | Planning criterion accepted; no automatic import/delete/overwrite or real production recovery |
| OPS-03.06 | CORE-1 | in_progress | Tiklashdan keyin provider, offline navbat va savdo holatlarini solishtirish. | Node24 non-root image, explicit migrations, CI, env validation, health, GPG backup/empty-db restore smoke | Docker image actual build; staging/TLS/off-site scheduler/PITR/on-call; real data restore rehearsal |
| OPS-04.01 | CORE-1 | blocked_external | Pilotdan katalog, savdo hajmi, kassalar va parallel so‘rovlar profilini olish. | — | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| OPS-04.02 | CORE-1 | done | Reproducible isolated generator:50000 products,1000000 draft sale lines,20 active tills. | Fresh seed exit0; tasks/evidence/volume-dataset-20261009.json; source/version quyida | Real pilot profili alohida |
| OPS-04.03 | CORE-1 | done | Namuna yuklamada qidiruv p95 ≤ 500 ms, ichki savdo yakunlash p95 ≤ 2 s; provider vaqti alohida o‘lchanadi. | — | — |
| OPS-04.04 | CORE-1 | done | N+1 so‘rovlarni kamaytirish, indekslar, cheklangan pagination va katta eksport uchun worker. | 50000-row profile: 206 queries, EXPLAIN comparison; snapshot/cursor worker, immutable scoped artifact; full202/focused9/browser6, migrations93/restore | Catalogue CSV only; REP-01.09 and OPS-04.06 separately pending |
| OPS-04.05 | CORE-1 | done | Hisob/ruxsat ma’lumotini eskirgan keshdan olish xavfini boshqarish. | +50 checkpoint: individual qabul protokoli, versioned tests/migrations; 90 PG + 17 unit + 6 HTTPS browser | Regressiyani saqlash |
| OPS-04.06 | CORE-1 | todo | Stress, uzoq davomli yuklama va tiklanish sinovlari. | — | — |
| QA-01.01 | CORE-1 | done | Pul/chegirma/soliq/tannarx/nasiya formulalari uchun birlik testlari. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| QA-01.02 | CORE-1 | done | Haqiqiy PostgreSQL bilan savdo, qoldiq, qaytarish va migratsiya integratsion testlari. | 2026-10-06: qabul mezoni va regressiya o‘tdi; quyidagi “Yana 10 ta PLAN1 bandi” dalili | Qabul qilingan; keyingi o‘zgarishlarda regressiyani saqlash |
| QA-01.03 | CORE-1 | done | Kassirning boshidan oxirigacha jarayonlari uchun brauzer testlari. | +10 checkpoint: individual expected/actual, source SHA256,101 PG +18 unit +27 browser +28 migration/restore | Qabul qilingan; regression va documented integration/legacy boundaries saqlansin |
| QA-01.04 | CORE-1 | done | Tashkilot/rol/do‘kon chegaralarining barcha API guruhlari bo‘yicha testlari. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| QA-01.05 | CORE-1 | done | Parallel so‘rov va takror amal testlari. | +50 checkpoint: individual qabul protokoli, versioned tests/migrations; 90 PG + 17 unit + 6 HTTPS browser | Regressiyani saqlash |
| QA-01.06 | CORE-1 | todo | Provider sandbox, timeout, noto‘g‘ri imzo, takror/kechikkan callback testlari. | — | — |
| QA-01.07 | CORE-1 | in_progress | Offline/reconnect, printer uzilishi, brauzer yopilishi va server restart sinovlari. | Uch browser core offline/reconnect/close/print boundary va actual standalone restart o‘tdi | Haqiqiy printer uzilishi vendor/hardware tayyor bo‘lganda tekshiriladi |
| QA-01.08 | CORE-1 | todo | Paket xavfsizligi, secret scanning va stagingda xavfsizlik tekshiruvi. | — | — |
| QA-01.09 | CORE-1 | done | Backup restore, migratsiya va chiqarishdan qaytish mashqi. | +20 qabul: kirish/natija va versioned testlar quyidagi plus-20-2026-10-07 checkpointda | Yangi o‘zgarishlarda regressiyani saqlash; tashqi release/pilot alohida bandlarda |
| BIZ-01.01 | CORE-1 | done | SaaS obuna, lokal o‘rnatish yoki ikkalasini qo‘llash modelini tanlash. | — | — |
| BIZ-01.02 | CORE-1 | done | Tarifni filial/kassa/xodim yoki funksiyalar bo‘yicha tushunarli belgilash. | saas-core-20261010.json; billing SQL/API/race/replay/export, cost source/CSV, three-browser recovery | Vendor/hosting/MFA global acceptance alohida bandlarda; fake integration yo‘q |
| BIZ-01.03 | CORE-1 | done | Sinov davri, obuna, hisob/invoice, to‘lov tarixi, yangilash va bekor qilish. | saas-core-20261010.json; billing SQL/API/race/replay/export, cost source/CSV, three-browser recovery | Vendor/hosting/MFA global acceptance alohida bandlarda; fake integration yo‘q |
| BIZ-01.04 | CORE-1 | done | Tarif limitlarini backendda tekshirish; mavjud ma’lumotni limitdan oshganda yo‘qotmaslik. | saas-core-20261010.json; billing SQL/API/race/replay/export, cost source/CSV, three-browser recovery | Vendor/hosting/MFA global acceptance alohida bandlarda; fake integration yo‘q |
| BIZ-01.05 | CORE-1 | done | Obuna tugaganda xabar, imtiyozli muddat, eksport va xavfsiz o‘qish rejimi siyosati. | saas-core-20261010.json; billing SQL/API/race/replay/export, cost source/CSV, three-browser recovery | Vendor/hosting/MFA global acceptance alohida bandlarda; fake integration yo‘q |
| BIZ-01.06 | CORE-1 | done | Fiskal provayder, SMS, printer agenti va integratsiya xarajatlarini alohida hisoblash. | saas-core-20261010.json; billing SQL/API/race/replay/export, cost source/CSV, three-browser recovery | Vendor/hosting/MFA global acceptance alohida bandlarda; fake integration yo‘q |
| BIZ-01.07 | CORE-1 | done | Marketing sahifasida haqiqatda ishlaydigan funksiyalar, narx, mos qurilmalar va yordam tartibi. | saas-core-20261010.json; billing SQL/API/race/replay/export, cost source/CSV, three-browser recovery | Vendor/hosting/MFA global acceptance alohida bandlarda; fake integration yo‘q |
| BIZ-02.01 | CORE-1 | done | MFA-required platform overview/panel: organizations, tariff/service/integration-boundary/incident metadata; private DTO and audited read. | Full296/296, focused29/29, platform3 browsers + MFA/TOTP9 regressions; platform-admin-20261011.json | Real deployment/vendor adapters remain separate; global SEC-02.06 inventory open |
| BIZ-02.02 | CORE-1 | done | Support biznes ma’lumotiga faqat vaqtli, ruxsatli va auditli kira olishi. | Owner consent + live operator/session/branch/scope/expiry/revoke; migration062; full158/158, focused2/2, browser9/9 | Regression; real operator provisioning/deploy alohida |
| BIZ-02.03 | CORE-1 | blocked_external | Kassir/egasi uchun murojaat, diagnostika, javob muddati va favqulodda aloqa. | Internal ticket lifecycle/assignment/severity, immutable history and policy versions, business-hours first-response/resolution metrics, scoped UI/API; support-tickets.md | Owner approved draft core only; official SLA/emergency channel/operator process unconfirmed; not counted done |
| BIZ-02.04 | CORE-1 | todo | Mijozni o‘rnatish: import, boshlang‘ich qoldiq/qarz, qurilmalar, trening va ishga tushirish. | — | — |
| BIZ-02.05 | CORE-1 | todo | Ishga tushirishdan oldingi hisobni imzolangan/kelishilgan solishtirish bilan tasdiqlash. | — | — |
| BIZ-02.06 | CORE-1 | todo | Mavjud dasturdan ko‘chirishda ikki marta savdo yuritmaslik va o‘tish sanasini belgilash. | — | — |
| BIZ-02.07 | CORE-1 | in_progress | Xizmatdan chiqishda to‘liq ma’lumot eksporti va saqlash/o‘chirish tartibi. | ADR062/064/065/066/067; retention/export/read-only/closure evidence; migrations110–118 | Legal hold/toifalar va irreversible deletion blocked_external; limitdan katta eksport arxitekturasi ochiq |
| LEG-01.01 | CORE-1 | blocked_external | Mijoz/xodim telefonlari, savdo va qarz tarixining maqsadi, kirishlari va saqlash muddatini belgilash. | — | — |
| LEG-01.02 | CORE-1 | blocked_external | Amaldagi shaxsga doir ma’lumotlar, saqlash joyi va reestr talablarini tegishli ma’lumot toifasi uchun tekshirish; hostingni shu tekshiruvdan keyin tanlash. | — | — |
| LEG-01.03 | CORE-1 | blocked_external | Maxfiylik siyosati, foydalanish shartlari, xizmat shartnomasi va javobgarlik chegarasi. | — | — |
| LEG-01.04 | CORE-1 | blocked_external | Qonun talab qiladigan moliyaviy yozuvlarni saqlash bilan shaxsiy ma’lumotni o‘chirish talabini moslashtirish. | — | — |
| LEG-01.05 | CORE-1 | blocked_external | Elektron chek, xizmat eslatmasi va reklama roziligini alohida qayd etish. | — | — |
| LEG-01.06 | CORE-1 | blocked_external | Integratsiya, xosting va aloqa provayderlariga uzatiladigan ma’lumotlarni hujjatlashtirish. | — | — |
| PILOT-01.01 | CORE-1 | blocked_external | Kamida uchta biznesda kelishilgan savdo hajmi va qurilmalar bilan sinash. | — | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| PILOT-01.02 | CORE-1 | blocked_external | Kamida ikki hafta odatiy savdo; oy/davr yopilishi ssenariysini ham alohida tekshirish. | — | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| PILOT-01.03 | CORE-1 | blocked_external | Har kuni savdo, pul, qarz, qoldiq va fiskal/to‘lov natijalarini solishtirish. | — | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| PILOT-01.04 | CORE-1 | blocked_external | Qaytarish, nasiya undirish, transfer, internet/printer uzilishi real yoki boshqariladigan sinovda bajarilishi. | — | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| PILOT-01.05 | CORE-1 | blocked_external | Kassir va egasi fikri, yordam murojaatlari va sarflangan vaqtni qayd qilish. | — | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| PILOT-01.06 | CORE-1 | blocked_external | Ma’lumot yo‘qolishi, ruxsatsiz kirish va hal qilinmagan pul farqi bo‘lmasligi. | — | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| RELEASE-01.01 | CORE-1 | todo | Chiqarish doirasidagi barcha P0 va zarur P1 vazifalar yopilgan. | — | — |
| RELEASE-01.02 | CORE-1 | todo | Muhim hisob/ruxsat ssenariylari avtomatik va amaliy sinovdan o‘tgan. | — | — |
| RELEASE-01.03 | CORE-1 | todo | Qaytarish, nasiya, xarid va smena hisoblari bir-biriga mos. | — | — |
| RELEASE-01.04 | CORE-1 | todo | Fiscal/markirovka talabi tegishli mijozlar uchun bajarilgan. | — | — |
| RELEASE-01.05 | CORE-1 | todo | Tanlangan qurilmalar sinovdan o‘tgan va moslik ro‘yxati e’lon qilingan. | — | — |
| RELEASE-01.06 | CORE-1 | blocked_external | Real backup tiklash, migratsiya va qaytish mashqi muvaffaqiyatli. | — | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| RELEASE-01.07 | CORE-1 | blocked_external | Kuzatish, ogohlantirish va javobgar yordam xodimi mavjud. | — | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
| RELEASE-01.08 | CORE-1 | todo | Yuklama natijalari va xizmat ko‘rsatish maqsadlari hujjatlashtirilgan. | — | — |
| RELEASE-01.09 | CORE-1 | blocked_external | Import, boshlang‘ich hisob, trening va onboarding qo‘llanmasi tayyor. | — | Real muhit/operator/pilot tasdiqlanmagan (2026-10-11 user qarori); core tayyorgarlik deployment-readiness.md da, haqiqiy qabul yo‘q |
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

## +50 so‘rovi — 1-checkpoint (2026-10-06)

**So‘rov hali to‘liq bajarilmagan.** Boshlanishida 50 done, maqsad 100. Ushbu checkpointda aynan **9 yangi checklist ID** done: **50→59**. Qolgan **41** yangi band yakunlanishi kerak. MODEL/SCENARIO/STAGE, ichki subtask, eski done yoki vendor integration bu sonni to‘ldirish uchun qayta hisoblanmadi. Bu checkpoint +50 yakuni yoki production release tasdig‘i emas.

| ID | Status | Kirish → kutilgan va haqiqiy natija | Individual dalil |
| --- | --- | --- | --- |
| INV-01.01 | done | Opening/adjustment/reversal va old sale/return/transfer/count postinglari source/actorli movement bilan bir transactionda. Balance CRUD POST/PUT/PATCH/DELETE405. Journal update/delete va missing source/zero delta/negative cost rad; matching opening sum2=balance2. | reports-finance `Stock journal rejects...`, old economic/count/transfer rollback tests; HTTPS6 unsupported methods; migration025 |
| INV-01.02 | done | Opening5 cost25, simultaneous same confirm1 movement; +3/−2 adjustment →6, reversal−5 →1. New opening/adjustment reason yo‘q400; repeated opening409; −100 insufficient rollback movement0. Ikki parallel openingdan faqat1, balance2. Manager confirmedBy/At va source hujjat saqlangan. | reports-finance `Opening and signed adjustments...`, `Two opening documents...`; documents.ts, stock-document API va inventory form/filter |
| USR-01.02 | done | Last owner block/demote rad; parallel ikki egadan1 mutation, kamida1 active owner. Request yaratish recipient cashier rolini o‘zgartirmaydi. Sender/outsider accept rad; recipient cancel/expired rad. Recipient accept role changes/revokes/audit/new cookie atomik; fresh-session replay audit1. | reports-finance ownership/parallel/expiry testlari; economic invitation regression ikki tomonli oqimga yangilandi; HTTPS6 settings sender + ikkinchi browser recipient; migration024 |
| USR-01.03 | done | Foreign/inactive switch403, old cookie live; active switch200, old cookie revoked, new org cookie. Browser A cart → B empty, A katalogi yo‘q → A cart restored. Empty branch/register null, kechikkan async response generation guard. Pending sale existing switch guard saqlangan. | reports-finance `Parallel owner removal...`; HTTPS6; switch route locks/audit, Header va OrganizationContext; scoped IDB old tests |
| CAT-01.02 | done | Existing primary+multiple codes search/tenant uniqueness tests saqlangan. Generate parallel same key1 code/audit. ASCII leading zeros/punctuation/max64 encoder→ZXing exact equality; unsupported422. HTML escaping/CSP, copies1–100, foreign404/cashier403. Browser generate + etiketka HTML download. | barcode.unit2 test; reports-finance barcode test; catalog-journal duplicate/primary tests; HTTPS2/6; bwip-js4.11.4 + lockfile |
| SEC-01.01 | done | Session authoritative: body/query foreign tenant rad; cookie/session missing/expired/revoked mutation rad, foreign reference read/write deny. Inactive membership switch denied; revoked member cannot post or read. Browser old owner auth/me401 after acceptance. | foundation `Tenant API...`; reports-finance tenant refs/session expiry/switch/ownership/stale role; withApi + verifySession + assertLiveContext |
| QA-01.05 | done | Concurrent last stock, last owner, shift open, opening, returns, sync and duplicate keys yakunida deterministic sale/payment/movement/owner/audit counts. Retry3 bounded, permission1. Fayllar shared DB uchun sequential; test ichidagi Promise.all haqiqiy parallel. | economic/core-count/reports-finance integration tests; operations.unit.test.ts; final90 PG test |
| OPS-01.02 | done | Build uchun ataylab ishlamaydigan localhost port9 DB URL → production build exit0. package build faqat next build; Docker builder no migrate/db push, runtime node server.js; compose migration profile/CI alohida migrate deploy. Fresh/legacy26 migrations o‘tdi. | /tmp/pos-build-no-db.log; package.json, Dockerfile, docker-compose.yml, .github/workflows/ci.yml, scripts/ops/test-migrations.sh; real deploy bajarilmadi |
| OPS-04.05 | done | Catalog read private,no-store. Draft100dan keyin catalog150 → PRICE_CHANGED, payment/movement0. Oxirgi stock boshqa draftda ishlatilgach eski draft INSUFFICIENT_STOCK, payment0. Staff revoke → SESSION_CHANGED va API401/no-store. Client local data vakolat/pricing manbasi emas. | reports-finance `Cached catalog prices...`; withApi no-store, live prepareItems/completeSale/moveStock/assertLiveContext; offline draft projection |

### Versiya va tekshiruv

Base commit `1c62f36` + ishchi daraxt; AI commit yaratilmagan. Source SHA256 `2c1b5006c0363074827b954e84e61511bd1c5fe01fc59f7a104b598b48f5c383`,242 fayl (src/tests/prisma/scripts .ts/.tsx/.sql/.prisma/.cjs/.sh, sorted path+NUL+bytes+NUL). Lockfile SHA256 `13a54193421c64f392c4b5f6d2544ff66d87bcc33523fd4f162cbb47c3f7d6ec`; package.json `d55ec71f49f7d229cbe50731a2fa8aa5dff17ef68de7e5f966756c50f452fdd5`. ADR017, api.md va README yangi contractlarni yozadi.

- `npm run typecheck`: exit0; `/tmp/pos-typecheck.log`.
- `npm run lint`: exit0, warning/error0; `/tmp/pos-lint.log`.
- `npm test`:17/17; `/tmp/pos-unit.log`.
- Isolated test URL bilan `npm run test:integration`:90/90; failed/skipped/todo0, `/tmp/pos-integration.log`.
- Unreachable localhost9 build-only URL va HTTPS build origin bilan `npm run build`:exit0; `/tmp/pos-build-no-db.log`. Ishlaydigan DB kerak bo‘lmadi.
- Isolated test URL, `/tmp/pos-playwright-browsers` bilan `npm run test:e2e`:6/6 production HTTPS Chromium; `/tmp/pos-e2e.log`. Firefox/WebKit acceptance qo‘shilmadi.
- `bash scripts/ops/test-migrations.sh`:26 fresh/legacy migratsiya; `/tmp/pos-migration-suite.log`.
- `bash scripts/ops/test-backup.sh`: encrypted checksum dump, empty transactional restore, migration records/freeze/count/debt recovery; nonempty overwrite rad; `/tmp/pos-backup.log`.
- `git diff --check`:exit0. Vaqtinchalik loglar doimiy evidence emas; versioned tests/migrations qayta tekshirish manbasi.

Birinchi test DB konteyneri oldindan o‘chgan, qayta start qilindi; old /tmp Chromium binarlari yo‘q bo‘lgan, qayta o‘rnatildi. Test compilationda bwip Node export declarations resolution va movement.quantityDelta fieldi tuzatildi. Qo‘lda pattern encoder bekor qilinib T02 generator ishlatildi. Browser fixtureda smena ochish qo‘shildi, bo‘sh cart uchun hidden payment button emas empty-state, restored cart uchun ikkita heading asserted. Stale-cache testiga existing service talabidagi operation key berildi. Yakuniy testlar yuqoridagi to‘liq natijalarni berdi; production guardlar yumshatilmadi.

Faqat `127.0.0.1:55439/pos_test` va ops yaratib tozalaydigan vaqtinchalik bazalar; production DB/deploy yo‘q. Real Click, fiscal/E-POS, printer, scale, special scanner, cash drawer implementatsiyalariga tegilmadi. Barcode label fizik qurilmadagi scan/print sifati tasdiqlangan deb ko‘rsatilmaydi. USR-01.05 hujjat-versiyali Approval modeli, qolgan katalog/inventory/offline/ops/security hamda tashqi dalillar hali ochiq. QA-01.03/SEC-02.02 yoki butun production release done emas. Keyingi ishlar faqat alohida acceptance bilan yopiladi; +50 maqsadi qolgan41 band bilan davom ettiriladi.

## +50 so‘rovi — 2-checkpoint: xarid narxlari va nasiya (2026-10-06)

**+50 so‘rovi hali tugamagan.** Bu davomiy qismda3 yangi checklist ID qabul qilindi: **59→62**. Boshlang‘ich50dan jami12 yangi done, maqsad100gacha **38** band qoldi. Avvalgi done yoki MODEL/SCENARIO/subtasklar qayta hisoblanmadi.

| ID | Status | Kirish → kutilgan / haqiqiy natija | Dalil |
| --- | --- | --- | --- |
| PUR-01.06 | done | SupplierA:2×10+3×20=80; SupplierB:1×30=30; original A xaridini reversal−20 → overall net90. Comparison A first10/latest20/min10/max20/weighted16, net quantity3/net value60. Current catalog cost999 bu natijalarni o‘zgartirmaydi; draft99×999 kirmaydi. History limit1da total4 va global90, filteredA net60, full CSV3 satr. Created2020/confirmedhozir receipt2020 event filtrida chiqmaydi. New receipt cutoffdan keyin eski asOf total4/net90. | reports-finance `Purchase price history...`; new GET /reports/purchases SQL RepeatableRead; /reports/purchases UI; HTTPS catalog scenario supplier/product name selection, view change, CSV; legacy-date/name metadata; tenant404/hidden branch404/cashier403/view400 |
| CRM-01.01 | done | Mijozsiz credit400 CUSTOMER_REQUIRED, draftdan keyin customer inactive404, limit99999 uchun100000 debt409. Barchasida payment/debt/movement0. Faol customer/limit100000 bilan posting1, keyingi100000 kredit409. Foreign actor404. Existing parallel limit100 ikkita100 draftdan faqat1, finaldebt100/payment1. Vakolat/session/branch/open-shift guardlari saqlangan. | reports-finance `Credit boundary...`; economic `Parallel credit checkouts...`; prior live revoke/foreign sale/closed shift/tenant-ref tests; completeSale customer lock + runOperation context check; override/permission bypass qo‘shilmadi |
| CRM-01.02 | done |100000 to‘liq nasiya → DebtEntry+100000, credit obligation Payment1, cash Payment0, shift expectedCash0, report revenue100000/creditSales100000/cashPayments0. Existing cash/debt collection va return conservation regressiyasi o‘tdi. Legacy credit backfill old versioned migrations bilan saqlangan. | reports-finance `Credit boundary...`; economic cash/debt/return tests; financialSummary va shiftCashSummary; last checkpoint fresh/legacy26 migration evidence unchanged |

### Testlangan versiya

Avvalgi checkpoint snapshoti `4c47bdb` + hozirgi ishchi daraxt. AI commit yaratmadi. Source245 fayl SHA256 `b3b46a2c824e4095a5901718b36ecbff1939ee4d2c4abb6676f7572d837ed553`; src/tests/prisma/scripts ostidagi .ts/.tsx/.sql/.prisma/.cjs/.sh, sorted path+NUL+bytes+NUL, docs bundan tashqari. API/README/ADR018 contractlarni qayd etadi.

- `npm run typecheck`:exit0, `/tmp/pos-typecheck-next.log`.
- `npm run lint`:exit0, error/warning0, `/tmp/pos-lint-next.log`.
- `npm test`:17/17, failed/skipped/todo0, `/tmp/pos-unit-next.log`.
- Isolated test DB URL bilan `npm run test:integration`:92/92, failed/skipped/todo0, `/tmp/pos-integration-next.log`.
- Unreachable localhost9 build-only URL bilan `npm run build`:exit0, `/tmp/pos-build-next.log`.
- Test DB URL + `/tmp/pos-playwright-browsers` bilan `npm run test:e2e`:6/6 production HTTPS Chromium, `/tmp/pos-e2e-next.log`. Existing catalog scenario xarid report bilan kengaytirildi; eski5 va scoped switch acceptance saqlangan.
- `git diff --check`:exit0. DB schema/migration o‘zgarmadi;26 versioned migration. Bu qismda schema/backupni o‘zgartirmaganimiz uchun fresh/restore mashqi takrorlanmadi, avvalgi checkpoint dalili saqlangan.

Birinchi test compile fixturega missing phone va shiftCashSummary argumentini topdi; existing model/signaturega mos tuzatildi. Keyingi run91/92da credit test reports/sales uchun majburiy organizationIdni yubormagan; fixture request tuzatildi, guard o‘zgartirilmadi. Final92/92 hamda browser/build qabul o‘tdi. Production yoki real biznes DBga tegilmadi; faqat isolated localhost55439/pos_test fixtures. Provider/hardware/fiskal integratsiya, supplier qarz/to‘lov zanjiri, credit override Approval yoki bank account modeli tugadi deb ko‘rsatilmaydi. asOf event cutoff, cross-request durable snapshot emas.

## +1: xodimlar hayot sikli (2026-10-06)

Joriy so‘rov bo‘yicha **bitta** yangi PLAN1 bandi — USR-01.01 qabul qilindi: **62 → 63 done**. Oldin bajarilgan bandlar qayta hisoblanmadi. Dastlabki +50 maqsadida 50→63, yana37 band qoladi; bu checkpoint butun production/pilot tayyorligini anglatmaydi.

| ID | Tekshirilgan kirish | Kutilgan va haqiqiy natija | Dalil |
| --- | --- | --- | --- |
| USR-01.01 | Xodim cash100 savdo; rol admin/filial update; yangi valid session; archive; restore; alohida activate | Savdo completed100, item1/payment1, balance9 saqlangan. Archive inactive+date, valid va eski sessionlar null. Restore date null, inactive, admin/filial saqlangan; activate eski sessiyani ochmaydi. Archive/restored audit2. | tests/reports-finance.integration.test.ts: Staff archive preserves financial history… |
| USR-01.01 | Begona tenant/member/filial, kassir actor, oxirgi owner, archive+isActive va restore+role | NOT_FOUND/FORBIDDEN/LAST_OWNER/STORE_NOT_FOUND; schema mixed action rad. Oddiy block archivedAtni o‘zgartirmaydi, activate ishlaydi. DB archived member isActive=true yozuvini rad qiladi. | Staff lifecycle denies foreign tenant…; migration026 CHECK; old parallel owner removal test |
| USR-01.01 | Invite yangi/mavjud hisob, token reuse/revoke/expiry, foreign store | Single-use, muddat/revoke rad; mavjud hisob egasi login qilishi shart, paroli o‘zgarmaydi; yangi hisob hash tekshiruvi. | tests/economic.integration.test.ts: Invitation is single-use… |
| USR-01.01 | Settings browser archive → reload → restore → activate | Arxivlangan badge; activate yo‘q; reload saqlangan; restore Bloklangan; alohida activate Faol. Existing recipient ownership handshake ham regressiyasiz. | tests/e2e/core.spec.ts: Business switching… HTTPS Chromium |

Tekshiruvlar: `npm run typecheck`, `npm run lint` (0 warnings), `npm test` **17/17**, isolated DB `npm run test:integration` **94/94**, DBsiz `npm run build`, HTTPS `npm run test:e2e` **6/6**, `bash scripts/ops/test-migrations.sh` **27 fresh/legacy migrations** — exit0. Loglar: `/tmp/pos-{typecheck,lint,unit,integration,build,e2e,migrations}-one.log`. Birinchi staff fixture mavjud ochiq registerga ikkinchi shift ochgani sabab rad etildi; fixture alohida staff registerga tuzatildi, to‘liq final94/94 qayta o‘tdi. Production constraint zaiflashtirilmadi.

Versiya: Git HEAD `4c47bdb` + ishchi daraxt, avtomatik commit qilinmadi. 246 source/test/migration/script fayl (sorted relative path+NUL+bytes+NUL; .ts/.tsx/.sql/.prisma/.cjs/.sh), SHA256 `9902f27a5b5cd575c29e904992de733bfa81df6f96bc349c7a0750ed9bd3bdaf`. Docs hashga kirmaydi. Vendor/hardware integratsiyalari o‘zgarmadi.

Backup qabul: `bash scripts/ops/test-backup.sh` exit0 (`/tmp/pos-backup-one.log`): encrypted dump/hash, empty database transactional restore, source bilan migration records teng (27), count/readings/freeze va customer ledger qayta tiklandi; mavjud jadvalli bazaga restore rad etildi. Yakuniy `git diff --check` exit0; PLAN1 va asosiy tracker done soni bir xil —63.

## +10: checkout, smena, qarz va brauzer qabul (2026-10-06)

Joriy so‘rovda **10 ta yangi PLAN1 ID** qabul qilindi: **63 → 73 done**. Oldingi done, subtask yoki testlar qayta sanalmadi. Oldingi +50 maqsadi doirasida 50→73, maqsad100gacha27 band qoladi. Bu butun production release yoki real biznes pilotini tugallangan deb bildirmaydi.

| ID | Tekshirilgan kirish | Kutilgan va haqiqiy natija | Versioned dalil |
| --- | --- | --- | --- |
| POS-01.06 | Bir registerda parallel draftlar, replay va rollback | POS-1/POS-2 noyob, UUID alohida; replay counterni oshirmaydi, muvaffaqiyatsiz transaction counter ajratmaydi. Fiscal reference nullable/alohida, real fiskal raqam yaratilmaydi. Legacy raqamlar saqlangan. | reports-finance integration receipt counter testi; migration027; ADR020 |
| POS-02.07 | Narx100→120; draftdan keyin stock0/request1 | HTTP409 PRICE_CHANGED/INSUFFICIENT_STOCK, scoped old/new price va quantity; payment/stock posting0. Modal mahsulot va farqni ko‘rsatadi; live narxni olish, eski urinishni explicit bekor qilish, discounts reset va qayta tasdiq. Kassir void uchun rahbar talab etiladi. | reports-finance checkout conflict testi; E2E Checkout price/stock conflicts…; POS page |
| OFF-01.03 | Print request response-loss, iframe print exception va original reprint | Sale/payment/movement soni o‘zgarmaydi, original receipt va print audit saqlanadi; response-loss bir xil attempt bilan tekshiriladi. Print retry yangi iqtisodiy operatsiya yaratmaydi. Fizik chop muvaffaqiyati browserdan kafolatlanmaydi. | E2E Production HTTPS… va Checkout price/stock conflicts…; ReceiptPreview; old receipt snapshot integration tests |
| OFF-01.05 | Sale409, boundary IntegrationUnavailable va PRINT_FAILED | Sale/integration/print tagged state va mos tiklash ko‘rsatmasi; boundary503 INTEGRATION_UNAVAILABLE. Print sale bekor qilmaydi. Browser provider failure faqat test intercept, real fake vendor implementatsiyasi yo‘q. | pos-failure.unit; reports-finance boundary503; E2E conflict/print/integration scenario |
| FIN-01.02 | Open, close, draft/pending payment, reject/resume, counted handover | Ochiq draft va pending/unknown payment close bloklaydi; pending approval shift iqtisodiy amallarini muzlatadi. Same-register/latest closed/count equality bilan yangi kassir o‘z smenasiga topshirilgan pulni qabul qiladi; audit va unique origin. Cross-tenant/bad amount rad. | reports-finance shift approval/zero/reject-handover tests; economic parallel shift/sale regressiyasi; E2E Cashier shortage… |
| FIN-01.04 | Expected50/count45 hamda nol farq; sabab yo‘q; wrong request; approval/replay | Farq−5, sabab majburiy. Cashier pending yaratadi, manager fingerprint/count/request tekshirib tasdiqlaydi; countedBy cashier/approvedBy manager/reason saqlanadi. Zero approval talab qilmaydi. Eski yopilgan shift immutable, replay takror yopmaydi; boshqa shiftga key reuse rad. Browser actual cashier mixed cash5+credit5: expected55/count50→−5, owner approves, handover50. | reports-finance 3 shift tests; E2E Cashier shortage…; ADR021 |
| CRM-01.05 | Opening100 overdue +200 upcoming; FIFO150; explicit50; over-allocation/foreign target | Individual origin documents; FIFO−100/−50, keyingi explicit−50, qoldiq100. Payment total hamda target limit saqlanadi; opening soxta sale emas. DB foreign customer/organization origin rad. Legacy unlinked kamaytirish taxminiy hujjatga bog‘lanmaydi. | reports-finance Opening document FIFO…; economic prior allocation/parallel collection tests; migration027 origin guard; DebtAllocationPicker |
| CRM-01.07 | Sale/return/payment/opening/date filters va due-bearing opening qoldig‘i | Statement opening+debits−settlement=closing ledger; proven opening qoldiq100 upcoming, overdue0/unallocated0. CSV/HTML provenance debtOriginId bilan. Legacy ambiguity requiresReconciliation/unallocated bo‘lib qoladi; tenant/cashier/branch vakolatlari saqlanadi. | economic ledger/return/aging tests; reports-finance Opening document FIFO…; E2E Production HTTPS… statement/export; customer ledger/export/print |
| HW-01.05 | 360/768/1280pxda owner dashboard va POS | Document horizontal overflow yo‘q; mahsulot, quantity controls, checkout va payment dialog yetib boriladi. POS targets≥44×44, accessible names va keyboard focus/Escape. | E2E Owner mobile dashboard… barcha3 browser; Header/POS/ProductSearch/CartItem |
| QA-01.03 | Chromium, Firefox, WebKitda9 ssenariy |27/27 HTTPS production browser cases: auth/revoke, checkout, actual cashier mixed pay, return, shift approval/handover, tenant switch, offline response-loss/IndexedDB, conflict/print va mobile. Success/failure assertions saqlangan; CI3 browser va failed trace/screenshot. | tests/e2e/core.spec.ts; playwright.config.ts; .github/workflows/ci.yml |

### Testlangan versiya va qayta tekshirish

Git HEAD `4c47bdb` + ishchi daraxt; AI commit yaratmadi. Source252 fayl SHA256 `0dc08136eae2c267f5c95fe9d57228bd47e936d26a91b6355804f1768a146c6f` (src/tests/prisma/scripts .ts/.tsx/.sql/.prisma/.cjs/.sh, sorted relative path+NUL+bytes+NUL). Lockfile `13a54193421c64f392c4b5f6d2544ff66d87bcc33523fd4f162cbb47c3f7d6ec`; Playwright config `06702319f415d75425d9692a17a3e1fd7f2e90c14c41a715f4e837cb121b4744`; CI `5525fd51af17a7877a1da298300053f9b68b2a3c7a45a95b427f4f584b6c9cf6`. README/api/ADR020–022 contractlarni yozadi. Vaqtinchalik /tmp loglar doimiy evidence emas; yuqoridagi versioned test/migration fayllari qabulni qayta bajarish manbasidir.

- `npm run typecheck`: exit0; `/tmp/pos-types-ten.log`.
- `npm run lint`: exit0, error/warning0; `/tmp/pos-lint-ten.log`.
- `npm test`:18/18, failed/skipped/todo0; `/tmp/pos-unit-ten.log`.
- Isolated test DATABASE_URL bilan `npm run test:integration`:101/101, failed/skipped/todo0; `/tmp/pos-integration-ten.log`.
- Unreachable localhost9 build-only DATABASE_URL va HTTPS APP_ORIGIN bilan `npm run build`:exit0; `/tmp/pos-build-ten.log`.
- Isolated test DATABASE_URL, PLAYWRIGHT_BROWSERS_PATH=/tmp/pos-playwright-browsers va POS_E2E_ALL_BROWSERS=1 bilan `npm run test:e2e`:27/27; `/tmp/pos-e2e-ten.log`. Browser testlar integration suite tugagandan keyin ketma-ket bajarildi; suite ichidagi haqiqiy parallel transaction sinovlari saqlangan.
- `bash scripts/ops/test-migrations.sh`:28 fresh/legacy migrations; `/tmp/pos-migrations-ten.log`.
- `bash scripts/ops/test-backup.sh`:encrypted dump/checksum, empty DB transactional restore,28 migration records, count/readings/freeze/customer ledger recovery, nonempty overwrite guard — exit0; `/tmp/pos-backup-ten.log`.
- `git diff --check`:exit0; PLAN1 va asosiy tracker done soni73.

Oraliq xatolar yashirilmagan: scoped Decimal error details JSONdan oldin sanitize qilinganida internal fields chiqdi — normalize tartibi tuzatildi. Opening aging endi proven due hujjatni hisoblaydi — eski unallocated fixture kutilmasi yangilandi. PDF rendering faqat Chromium API bilan; Firefox/WebKitda HTML receipt/export DOM assertions saqlangan. Mobile active-shift loading poygasi testdagi explicit open/wait bilan tuzatildi. WebKit logoutda menyu prefetch RSC background xatolarini ko‘rsatdi — Next16.3.8 local Link qo‘llanmasi asosida authenticated Sidebar/Header prefetch=false, pageerror assertion filtrlab yumshatilmadi. Final barcha27 browser test o‘tdi. Fedora WebKit fallback uchun ICU/JPEG runtime faqat /tmp browser bundle ichida; tizim yoki app dependency o‘zgartirilmagan, CI install --with-deps bilan.

Faqat localhost55439/pos_test va ops tozalaydigan vaqtinchalik restore DBlar ishlatildi. Real Click, fiskal/E-POS va hardware implementatsiyalari yozilmadi. Fiscal reference bo‘sh boundary; posted-sale guard saqlangani sabab kelajakdagi tasdiqlangan fiscal provider append-only reference/history siyosatini alohida ishlab chiqishi kerak. Physical receipt print/scan, provider settlement va real pilot qabul sinovi tugadi deb ko‘rsatilmaydi. Legacy debt provenance yetishmasa qo‘lda reconciliation talab etiladi; tarix taxmin qilinmaydi.

<a id="plus-20-2026-10-07"></a>

## +20: qoralama, sync ko‘rib chiqish, ogohlantirish va production qabul (2026-10-07)

Joriy so‘rov bo‘yicha **20 ta yangi PLAN1 ID qabul qilindi: 73 → 93 done**. Oldingi done, test yoki subtasklar qayta sanalmadi. Oldingi +50 so‘rovi boshlang‘ich50dan43 bandga yetdi;100gacha7 band qoladi. Bu barcha production/pilot vazifalari tugadi degani emas.

| ID | Tekshirilgan kirish | Kutilgan va haqiqiy natija | Versioned dalil |
| --- | --- | --- | --- |
| SEC-02.02 | HTTPS login, cookie/idle/absolute expiry, revoke, bearer-only, cross-origin JSON va qonuniy mutation | HttpOnly/Secure/Lax cookie,24h maxAge; opaque tokenning faqat hash DBda; expired/revoked/bearer-only rad. Cross-origin403, legal same-origin200. CSRF boundary: exact Origin, Sec-Fetch-Site, JSON-only, SameSite; alohida token kiritilmagan — ADR025 tanlovi. | reports-finance session/envelope tests; foundation/economic expiry/revoke; E2E Production HTTPS; src/server/auth/session.ts, api.ts |
| DATA-01.01 | 0.333333×0.03,999999999999.99 minus ikki0.01,0.10ni3 qism qaytarish, API1.01 |0.01,999999999999.97,0.03/0.03/0.04; DB/API/report decimal string,50-digit HALF_UP va2 kasr money; katta report aggregate cents yo‘qolmaydi. | calculations/production-next/export-precision unit; economic/reports-finance monetary tests; sales/calculations.ts, reports/numeric.ts |
| DATA-01.02 | Foreign tenant/actor, invalid min/max/state, duplicate/parallel operation, fresh/legacy schema | FK/scope triggers/CHECK/unique invalid yozuvni rad; parallel posting bir marta.028/029 review/incident/threshold actor va filial scope guardlari.30 migration fresh/legacy fixtureda muvaffaqiyatli. Real eski biznes clone bu qabulga kirmaydi. | foundation/economic/reports-finance integration; prisma/migrations; test-release-drill.sh |
| DATA-01.05 | Audit INSERTni faqat fixture org uchun rad etish; keyingi muvaffaqiyatli checkout | Audit failureda sale draft, payment/movement0, balance10: transaction rollback. Success actor/source/requestId bilan audit, sensitive nested fieldlar o‘chiriladi. Worker actor:null bilan system event. | reports-finance Audit failure…; operations audit helper; production-next redaction unit; test-worker.mjs |
| DATA-01.08 | Success decimal1.01, page0, foreign tenant,1048577 byte JSON, cross-origin | Standart success/error envelope, X-Request-Id va no-store;400/403/413 mos code/message/nextAction/requestId. Zod details faqat path/code/message, raw input yoki stack emas. | reports-finance envelope test; src/server/api.ts; lib/api.ts; api.md |
| INV-01.06 | Journal5/balance7; takror scan; mos5/5; image worker journal0/balance2 ikki scan | Expected5/actual7/difference2, bitta durable incident; mos datasetda nol discrepancy, yopish auditli. Worker0/2/2 exact string evidence, ikki system audit, incident1; balance2/journal0 o‘zgarmaydi. | reports-finance reconciliation tests; monitoring/service.ts; scripts/workers/reconcile.ts; scripts/ops/test-worker.mjs |
| INV-02.04 | Filial stock2/min3/max10; missing balance; max<min; foreign branch/cashier | Tavsiya8, missing balance10; min/max equality va fallback aniq; invalid400/DB CHECK, foreign/cashier rad. Report tavsiya/low-stock rowlari, avtomatik xarid yoki rezerv yo‘q. Takror scan bir incidentni yangilaydi. | reports-finance threshold/replenishment tests; E2E Owner sees durable inventory alert…; StockThreshold migration028 |
| QA-01.01 | Zero, maximum, fractional quantity, discount ties, included/excluded tax, weighted average, debt/advance, partial return |25 unit passed:112 tax-included→100+12;0.05×10%→0.01; average75 va extreme6-place; debt100+200−200=100, advance−20; final return remaining centni saqlaydi. Tax faqat pure arithmetic, legal default emas. | tests/calculations.unit.test.ts; production-next.unit.test.ts; export-precision.unit.test.ts; debtClosingBalance ledgerda ishlatiladi |
| QA-01.04 |89 real route fayli/125 HTTP handler; unauth, foreign org/store, forbidden cashier va positive scoped API guruhlari | Route discovery reyestri va public exceptionlar explicit; har protected handler negative sinovli. Service darajasidagi own cashier/store/owner checks va actual browser allow oqimlari saqlangan. | tests/route-boundaries.integration.test.ts; tasks/API_ACCESS_MATRIX.md; economic/reports-finance/e2e tests |
| QA-01.09 | Fresh/legacy migration, GPG backup/empty DB restore, previous5006313 app yangi additive schema bilan |30 migration; hash/restore/migration records/count readings/freeze/customer ledger tiklandi; nonempty restore rad. Old app1.01ni replay bilan bir marta sotdi: payment1/move1/balance1. Lokal elapsed7s, app rollback3s, fixture RPO loss0. | scripts/ops/test-release-drill.sh, test-migrations.sh, test-backup.sh, rollback-acceptance.ts; RELEASE_BASE(default HEAD^) |
| OFF-01.04 | Bir session egasi ikki browser contextda saqlangan draftni ochish, yakunlangan resultni qayta tekshirish | Original sale UUID/receipt va note saqlanadi; yangi sale yaratmaydi. Payment1/movement1. Cashier/shift/register/tenant vakolatlari tekshiriladi. Faqat lokal savat cloudga saqlangan deb ko‘rsatilmaydi. | reports-finance second-device draft test; E2E Held server draft…; POS/drafts/offline acknowledgeRecovered |
| OFF-02.07 | Pending cash99/total100 → conflict; proofsiz manager resolve; original draft void, keyingi resolve va local acknowledgement | Immutable original local/server payload va hash saqlanadi. Proofsiz409; terminal void dalili auditli resolution, lokal rejected; payment/movement0, resolution audit1. Resolved proof replay audit/postingni takrorlamaydi. | sync/reviews.ts; sync route; offline operationHistory; E2E Sync conflict…; immutable SQL028/actor029 |
| UX-01.04 | Validation/network/permission/price/stock/internal failure | Uzbek message va xavfsiz nextAction; unknown response yangi operationga undamaydi, request raqami bor. Client API shu ko‘rsatmani chiqaradi. | lib/error-guidance.ts, lib/api.ts; production-next unit; reports-finance envelope; E2E conflict/response-loss |
| UX-01.06 | F2/Enter/F9/Tab×12/Escape; label va enabled payment controls;360/768/1280px | Asosiy keyboard oqimi ishlaydi; dialog focus ichida qoladi va original tilega qaytadi. AutoFocus/rAF poygasi tuzatildi; async catalog refresh oldingi DOMni almashtirsa stable product focus key yangi controlga fokusni qaytaradi; unique input/select IDs, label/error ARIA. Target≥44px; asosiy tile/payment label/button contrast≥4.5:1 uch browserda canvas RGB bilan hisoblangan. | E2E Training is isolated… expectReadableText; Owner mobile…; UI Modal/Input/Select/Button/globals.css |
| UX-01.07 | Owner/cashier login/home; draft/open shift/approval/incident/sync countlari; hidden reports API | Cashier /pos, owner/admin /dashboard; server scoped operational overview va60s refresh. Cashier report403; owner/admin incidents branchga mos; server conflict overview admin uchun yopiq. | operations/overview route; OperationalAlerts; E2E owner alert va actual Cashier shortage…; route registry negative tests |
| UX-01.08 | Yangi cashier hisobida yo‘riqnoma + lokal mashq10000/15000; so‘ng actual isolated checkout cash5+credit5 | Demo qaytim5000, real sale/payment0; mashq org/user key bilan reset. Shu cashier real test POSda total10ni yakunladi, sale1. Matnli yo‘riqnoma ishlatiladi; video/human pilot dalili deb ko‘rsatilmaydi. | training page; E2E Cashier shortage… (training→checkout), Training is isolated…; ADR025 |
| UX-01.09 | Internet response-loss, print exception, katalog validation/barcode conflict va oversized request; yordam linklari | Help original result/receipt, xavfsiz retry, browser printer sozlash va katalog error code yo‘llarini beradi. Bulk CSV/XLSX import hali mavjud emas deb aniq yozilgan; mavjud bo‘lmagan vendor/protokol taxmin qilinmaydi. Help→queue real navigation o‘tgan. | help page; E2E offline/print/conflict/help; reports-finance envelope; catalog integration tests |
| OPS-02.01 | Parallel tenantA/B async context, secret/PII/header/error/path canary, API response/error va operation retry | JSON log allowlist faqat event/requestId/org/op/status/code/duration/kind/count; tenant/request correlation aralashmaydi. Parol, token, phone/email, payload/raw error yo‘q. Transactiondan keyin worker success log. | observability/context.ts; operations.ts; production-next Structured log…; api envelope/integration log; worker packaged test |
| OPS-02.03 | Sun’iy completed sale20/payment0 va inventory journal5/balance7, foreign scope, unresolved/resolved close | Mas’ul owner/filial rahbariga durable critical evidence, home alert va incidents UI. Farq mavjudligida close409; moslashgach actor/date/reason audit. Scan o‘zicha economic repair qilmaydi; recurrence existing incidentni qayta ochadi. | reports-finance System scan… va reconciliation tests; monitoring/service.ts; E2E Owner sees durable inventory alert…; ADR023 |
| POS-02.01 | Cartni serverda park qilish, boshqa authorized device reopen/complete, manager cancel va replay | Park faqat draft yozadi: payment/movement0, local basket bo‘shaydi. Original draftni aniq tugma bilan reopen; resumed basket frozen, original sale complete. Manager-only void saqlangan, void draft qayta sotilmaydi. | sales service/routes; reports-finance second-device/void tests; E2E Held server draft…; drafts/POS pages |

### Testlangan versiya va chegaralar

Git HEAD `5affd8b159473fa2c8e983aa7b771893837282b2` + yakuniy ishchi daraxt; AI commit yaratmadi. Node24.18.0, Next16.3.8, Prisma5.22.0. Source279 fayl SHA256 `fe68d1921c8e3f41c01f0db76e7bed43a6ca3cfad49a9cfffa1a8780e8038d61` (src/tests/prisma/scripts .ts/.tsx/.sql/.prisma/.cjs/.mjs/.sh, sorted relative path+NUL+bytes+NUL; docs bundan tashqari). Final buyruqlar va qabul sonlari quyida. Vaqtinchalik /tmp loglar doimiy evidence emas; versioned tests/migration/scripts qabulni qayta bajarish manbasidir.

Tanlovlar ADR023–025 bilan qayd etildi: CSRF uchun JSON-only/Origin browser boundary saqlangan; standalone CSRF token modeli tanlanmadi. Training iqtisodiy PostgreSQL demo seed o‘rniga org/user-scoped lokal mashqdan foydalanadi; yo‘riqnoma video talabini matn orqali bajaradi. Acceptance mezonlari o‘zgartirilmagan, bu implementation tanlovlari PLAN1 bajarish matnida aniq yozilgan.

Faqat localhost55439/pos_test va ops yaratib/tozalaydigan temporary DBlar ishlatildi. Real biznes deploy/DB, Click, fiskal/E-POS, printer/tarozi/scanner/cashdrawer vendor implementatsiyalari o‘zgarmadi. Fizik print, provider settlement,14 kunlik pilot, real hosting SLA yoki real eski data clone qabulidan o‘tgan deb ko‘rsatilmaydi. Faqat qurilmada qolgan basketni boshqa qurilmada tiklash kafolatlanmaydi. Offline signed lease/PWA/full offline economic posting bandlari ochiq; current sync server-authoritative. Bulk import, avtomatik replenishment purchase va tax legal policy qo‘shilmadi.

Oraliq failures yashirilmadi: yangi error nextAction/requestId eski exact text locatoriga mos kelmadi — original xato matnini saqlagan contains locator ishlatildi. Next route announcer ham alert bo‘lgani uchun test actual error text bilan scope qilindi. PaymentModal autoFocus prior-focus capturega xalal berdi — modalning mavjud focus boshqaruvi qoldirildi; keyboard restore assertion yumshatilmadi. Modal rAF focus poygasi layout effect bilan paintdan oldingi boshqaruvga o‘tkazildi; test native activationdan keyin opening control fokusini aniq tasdiqlaydi. WebKit focus trace actual debounced catalog refresh original DOMni almashtirganini ko‘rsatdi: stable data-focus-key orqali replacementga closing commitdan keyin fokus qaytariladi. Test katalog javobi/re-renderni modal ochiq paytda kutadi; debug monkeypatch final testdan olib tashlandi. Dark panel summa/mijoz labellari text-slate-300 bilan o‘qiladi. Mahsulot kontrasti modal overlaydan oldin, dialog label/button/spanlari ochiq paytda tekshiriladi. Packaged worker fixture NUMERIC(20,6) string2.000000 qaytaradi — expected DB formatga moslandi, decimal numberga aylantirilmadi. CommonJS fixture lint xatosi ESM test script bilan tuzatildi. Bir E2E run oldingi WebKit tugamasidan ishga tushib artifact/port clash berdi; final runlar ketma-ket. Keyboard Enter locator.press orqali aniq controlga yuboriladi, API/guard chetlab o‘tilmaydi. Firefox/WebKit selected quick-cash fonida3.65:1 kontrastni aniqladi; bg-emerald-700 va rang animatsiyasi o‘rniga transition-shadow bilan tuzatildi,4.5:1 assertion saqlangan. Fedora WebKit ICU74/JPEG8 faqat /tmp browser bundle ichida, tizim/app dependency o‘zgarmadi.


### Yakuniy tekshiruvlar

- `npm run typecheck`: exit0; `/tmp/pos-typecheck-twenty.log`.
- `npm run lint`: exit0, error/warning0; `/tmp/pos-lint-twenty.log`.
- `npm test`:25/25, failed/skipped/todo0; `/tmp/pos-unit-twenty.log`.
- Isolated test DATABASE_URL bilan `npm run test:integration`:111/111, failed/skipped/todo0; `/tmp/pos-integration-twenty.log`.
- Unreachable localhost9 build-only URL va HTTPS APP_ORIGIN bilan `npm run build`:exit0; `/tmp/pos-build-twenty.log`.
- Test DB, PLAYWRIGHT_BROWSERS_PATH=/tmp/pos-playwright-browsers va POS_E2E_ALL_BROWSERS=1 bilan `npm run test:e2e`:39/39 (13×3 production HTTPS browsers), failed/skipped0; `/tmp/pos-e2e-twenty.log`. Final integration, browser, packaged worker va ops mutating sinovlari bitta bazada ketma-ket bajarildi.
- `npm run worker:build` va isolated `npm run worker:reconcile -- --once`:exit0; `/tmp/pos-worker-{build,runtime}-twenty.log`.
- `docker build -t pos-app:twenty-test .`:exit0, image `sha256:37dadf27486669bab5ce9e6d816edd2b5ef181fbaa6e1a06d33c485d7b159d1a`, User `nextjs`; `/tmp/pos-docker-twenty.log`. `node scripts/ops/test-worker.mjs`:exit0, ikki scan/incident1/system audit2/no repair; `/tmp/pos-worker-packaged-twenty.log`.
- `bash scripts/ops/test-release-drill.sh`:exit0,30 fresh/legacy migrations, encrypted restore va previous5006313 source checkout/replay. Elapsed7s/app rollback3s/fixture RPO loss0; `/tmp/pos-release-twenty.log`. Real hosting SLA emas.
- `git diff --check`:exit0; PLAN1 va asosiy tracker **93 done**, qo‘shilgan IDlar aniq20.

Artifact SHA256:

| Artefakt | SHA256 |
| --- | --- |
| package.json | `2f824592d58f2a7e84c39a7c0d7e69df6d410f9c813cccb2714b248f6fd7879b` |
| package-lock.json | `13a54193421c64f392c4b5f6d2544ff66d87bcc33523fd4f162cbb47c3f7d6ec` |
| Dockerfile | `e53e6f1cf7560c55fc4d91f5ad1d2a07c7ade2f811bb6534a5e2267d09401b1e` |
| docker-compose.yml | `83d5167b0c84bbccd155410ab280ea18dc9bb15159c6604b44de1bf6ed7bd78d` |
| tsconfig.worker.json | `7eeb77949209051b9b84d7ae493510d6825c3e6fcc7297d3f9e154050b02c596` |
| playwright.config.ts | `06702319f415d75425d9692a17a3e1fd7f2e90c14c41a715f4e837cb121b4744` |
| .github/workflows/ci.yml | `ab2106c5d9c100bafaef448863456cbbb62ba4119a42f4d6a28c8c1498916868` |


## plus-20-2026-10-07-b — davom etayotgan qabul

Joriy so‘rov boshlanishida **93 done**, maqsad **113 done** (+20). Bu checkpoint oldingi +20 qabulidan alohida. Oldingi done bandlari va test/subtasklar yangi band sifatida sanalmaydi. Hozir **5 ta yangi band qabul qilindi: 93 → 98 done**. +20 maqsadga yana15 band kerak; so‘rov to‘liq tugagan deb belgilanmagan. Quyidagi implementatsiya va qabul dalillari shu checkpointga tegishli.

- POS-02.05: org/user/register-scoped 12 quick-product ID; fresh server validation; primary/alias barcode va aniq SKU/nom keyboard lookup; debounce/repeat/in-flight F9 guard.
- SEC-02.07: operator/staff DTO, nonowner nested branch/staff chegarasi, credential-key response defense va mavjud log allowlist regressiyasi. Owner invitation capability alohida explicit flow; session token berilmaydi.
- RET-01.05: cash/card/transfer/debt/waived exact allocation, preview, haqiqiy manual bank proof, stale/reused proof rejection, payment provenance boundary. Migration031/033. Click API implementatsiyasi yo‘q.
- PUR-01.01: bank rekvizitlari/terms UI/API/CSV, validation/archive/restore. Migration032; supplier qarz/to‘lov tarixi ochiq, band hali done emas.
- OPS-01.07: dependency/migration readiness, owned standalone app restart va recurring worker SIGTERM acceptance.
- OPS-03.04: yangi empty DBga encrypted restore va restored app orqali real scoped auth/count/debt acceptance.
- QA-01.07: core uch-browser offline/reconnect/close/print-boundary va server restart coverage; fizik hardware sinovi hali mavjud emas, full task done emas.

117 PostgreSQL integration va27 unit test o‘tdi; lint/typecheck/production build o‘tdi. 42 browser va migration/restore/restart/packaged worker yakuniy qabul natijalari quyida qo‘shiladi. Real biznes bazasi, deployment va vendor integratsiyalariga tegilmadi.

### Individual qabul natijalari

| ID | Kirish / kutilgan natija | Haqiqiy natija va qayta bajariladigan dalil |
| --- | --- | --- |
| SEC-02.07 | Nested credential/PII canary, owner/cashier nested organization, shift operator, API/export/log response | Normalized credential keys chiqarildi; password canary yo‘q; shift faqat id/fullName, nonowner nested staff/foreign branch yo‘q. Unit response/log canary; route-boundaries positive groups/nested DTO, economic/report CSV tests. Ownerning ruxsatli invitation capabilitysi ishlashda qoldi; sessiya tokeni qaytarilmaydi. |
| POS-02.05 | Quick ID add/reload, stale debounce, exact barcode/alias/SKU/name, noto‘g‘ri yoki ambiguous identifier, in-flight F9, keyboard-only 3 dona savdo | Preset narx saqlamaydi, scope aralashmaydi. Literal %/_ qisman qidiruv emas; ambiguous409, invalid400. Qidiruvda F9 yopiq; total30/payment1/quantity3. Broad suite WebKit focus yo‘qolishini topdi; grid refreshda saqlash tuzatildi, focused uch-browser suite3/3 o‘tdi. ProductSearch/lib/quick-products; E2E register va Training; identifier integration. Maxsus hardware driver dalili emas. |
| RET-01.05 | Mixed300 =90cash/60card/150credit, qisman return; qarz100 bankda collected; stale/reused proof, provider recorded source | Preview30/20/50, iqtisodiy writes0; manual proof bilan channel-only posting/replay bir marta. Full return90cash/60card/debt0/stock3; bank debt collection transfer100 qaytimi cash0. Stale va reused proof rollback. Provider source ikki yo‘ldan ham409, writes0. returns/service; reports-finance/economic integration; Manual bank refund UI; migration031/033. Real provider refund deferred. |
| OPS-01.07 | Ready migration marker o‘chiq/DB disconnected; 2 checkout+held draft; 2 SIGTERM/restart+replay; packaged recurring worker SIGTERM | Incomplete marker503, live disconnected200/ready503; completed2/payment2/movement2/balance1, held draft saqlandi. Owned server nazoratli yopildi. Image nextjs; scan3 audit3/incident1, no repair, exit0/noOOM/noSIGKILL. route-boundaries readiness; scripts/ops/test-restart.mjs va test-worker.mjs. Queue hozir Postgres Operation/sync core, qo‘shimcha vendor queue ulanmagan. |
| OPS-03.04 | GPG backupdan empty isolated DB restore; migration/active count/freeze/debt history va actual app reads; overwrite attempt | Restore33 migration, counting/3/2/3 freeze saqlandi, qarz3.75 original due2026-02-01; actual authenticated app count/debt o‘qidi, economic row count o‘zgarmadi. FixtureRPOloss0, RTO7s; mavjud jadvalga overwrite rad. test-backup.sh/verify-restored-app.mjs. Real offsite schedule/SLA/PITR bandlari ochiq. |

### Sinovdan o‘tgan versiya

- Git HEAD `4d048fc22e15106fc5309c51402b6ad600d06541` + joriy ishchi daraxt; AI commit yaratilmagan. Node24.18.0, Next16.3.8, Prisma5.22.0.
- Source288 fayl SHA256 `de9df5dec463a9a7f5c1995b771e850e434b064d0dc7e89c51fecc00c2276c1b`: src/tests/prisma/scripts .ts/.tsx/.sql/.prisma/.cjs/.mjs/.sh, sorted relative path+NUL+bytes+NUL; docs alohida.
- Final Docker image `sha256:6541ce3f58bfd9f32f4d575189f6443af5f3aa58a665fe24680bd9b79af95aa8`, foydalanuvchi `nextjs`; deployment qilinmagan.
- `npm run typecheck`, `npm run lint`, build-only disconnected placeholder bilan `npm run build`: exit0.
- `npm test`:27/27; isolated pos_test bilan `npm run test:integration`:117/117.
- Uch browser broad `POS_E2E_ALL_BROWSERS=1 npm run test:e2e`:41/42; WebKit Training focus regressiyasi topildi. Tuzatishdan keyin yangi production build bilan `npm run test:e2e -- --grep 'Training is isolated'`:3/3 (Chromium/Firefox/WebKit), exit0. Broad42/42 qayta o‘tdi degan da’vo yo‘q; shu fokus muammosi qayta tekshirildi.
- `RELEASE_BASE=4d048fc bash scripts/ops/test-release-drill.sh`: exit0,33 migrations fresh/legacy, restoreRTO7s, fixtureRPOloss0, old app checkout/replay, total18s/rollback5s. Local fixture dalili; actual staging rollout emas.
- `DATABASE_URL=<isolated pos_test> node scripts/ops/test-restart.mjs`: exit0; completed2/payment2/movement2/balance1; disconnected live200/ready503.
- `docker build -t pos-app:twenty-test .` va `node scripts/ops/test-worker.mjs`:exit0; recurring scan3/SIGTERM exit0, no economic repair.
- Vaqtinchalik loglar `/tmp/pos-next20-{unit,integration,e2e,keyboard,typecheck,lint,build,release,restart,image,worker}.log`; doimiy qayta bajarish manbasi versioned test/migration/scriptlardir.

### Ochiq ishlar

Maqsad113, joriy98: +20 so‘rov hali yakunlanmagan. PUR-01.01 supplier qarz/to‘lov tarixi; QA-01.07 physical printer qabul sinovi; OPS-01.03 actual staging rollout; qolgan core featurelar asosiy trackerda ochiq. Hech bir qabul mezoni sonni oshirish uchun pasaytirilmadi. Real Click/fiskal/hardware, business interviews, legal/pilot yoki hosting SLA bajarildi deb qayd qilinmaydi.


## plus-20-c — yangi so‘rov (2026-10-07)

Yangi so‘rov baseline **98 done**, maqsad **118 done**. Hozir **1 ta yangi band: CRM-01.03 qabul qilindi, jami99**. +20 maqsadga19 band qolgan; so‘rov tugadi deb belgilanmagan. Oldingi93→98 qabul qayta sanalmadi.

### CRM-01.03 individual qabul

- Kirish: credit sale100; UI orqali cash30/card30/transfer30, real manual bank hujjati va tasdiq; original key replay; yangi key bilan bir hujjat; bir hujjatga parallel ikki boshqa customer.
- Kutilgan/haqiqiy: UI3 Payment yozadi (har biri30, original store/shift/receiver, source manual); qarz10, cash journalga faqat30. Card proofsiz400/no write; same-key parallel replay payment1/allocation1; debt100→70, cash0. New-key same proof409 rollback/debt70. Cross-customer race bitta payment, ikkinchisi409. Provider API/fake confirmation yo‘q.
- Manba: collections.ts; customer detail form; api client; economic integration `Manual card debt collection…`; E2E `Debt collection UI records…`; migration034; health ready requires034.
- `npm run test:integration` isolated pos_test:118/118, exit0. Yakuniy proof-lock/readiness o‘zgarishidan keyin tsc test compile + node test-name-pattern:2/2, exit0.
- Eng yangi standalone build bilan Chromium/Firefox/WebKit focused collection E2E:3/3, exit0.
- Final typecheck/lint/build exit0; `git diff --check` exit0. Fresh+legacy fixture `bash scripts/ops/test-migrations.sh`:34 migratsiya, eski allocation/debt/barcode/unit natijasi saqlandi, exit0.
- Git HEAD4d048fc22e15106fc5309c51402b6ad600d06541 + ishchi daraxt. Source289 SHA256 `da68755007928402a930e582c5728f529e4f0e515490bfd7bfbf10195fa91568` (oldingi checkpoint bilan bir xil path+NUL+bytes+NUL algoritmi). AI commit/deployment yaratilmagan; real DBga tegilmagan.
- Logs `/tmp/pos-twenty-c-{integration,proof,e2e,migrate,fresh,typecheck,lint,build}.log`; doimiy dalil versioned source/tests/migration.

Full FinancialAccount/expense/transfer, supplier qarz/to‘lov va xarid zanjiri, tax snapshots va katalogning boshqa featurelari ochiq. CRM-01.03 manual Payment journalining original store/smena/usul/qabul qiluvchisini saqlash doirasida qabul qilingan; tashqi bank solishtirish yoki Click tasdig‘i bajarildi degan da’vo yo‘q.

## plus-2 — yakuniy qabul (2026-10-08)

Ushbu +2 so‘rov baseline **99 done**, maqsad **101 done**. **RET-01.04 va CAT-01.07 qabul qilindi: 99 → 101 done**. PLAN1 checkboxlari va asosiy ID tracker bir xil101; tarixiy checkpoint/subtasklar yangi vazifa sifatida qayta sanalmadi. Bu butun loyiha yoki tashqi pilot tugadi degani emas.

| ID | Tekshirilgan kirish va kutilgan natija | Haqiqiy natija / doimiy dalil |
| --- | --- | --- |
| CAT-01.07 | Ikki mahsulot preview, narx eskirishi, original hash tasdig‘i, parallel original key, cost role/export, late audit failure, lost acknowledgement/reload/temporary replay deny, 90071992547409.123456 cost | Preview writes0; bir stale row butun batchni rollback qiladi; key replay history2/audit1; payload conflict rad. Eski chek100 va original cost40 o‘zgarmadi. Admin sale edit200, manual cost edit/history/export403; katalog CSV cost ustunisiz; cashier history403, foreign product404. History immutable. Audit failure narx/history/Operationni to‘liq rollback qildi. Uch browserda unknown intent/retry deny original keyni saqladi, salePrice history1, katta6-decimal cost aniq saqlandi. prices.ts/routes/price UI; reports-finance integration; E2E Reviewed price batch… |
| RET-01.04 | Completed sale6; damaged2+1, disposal1, sellable1; original cost50dan katalog999ga o‘zgargan; preview/replay, branch scopes, journal/location tamper, late audit failure | Preview location/journal yozmaydi. Damaged qoldiq3 bitta filial locationida, write_off1 location null; available faqat sellable1. Entry snapshot cost50 va Frozen nomi; same-key duplicate yo‘q. Owner/assigned admin200; cashier403, foreign store404, unassigned admin empty. Location identity va journal update/delete rad. Late audit failure return/location/entry/refund/payment/Operationni rollback qildi. Three-browser journal + original40 cost acceptance. returns/service; dispositions route/UI; migrations036/037; reports-finance integration |

### Texnologiya va doira

- Mavjud Next/Prisma/PostgreSQL/IndexedDB ishlatildi; vendor SDK, yangi queue yoki fake provider yozilmadi. Price bulk1–100 unique mahsulot atomic transaction, katta katalog alohida reviewed batchlarda (ADR-029). Global million-row transaction yoki background worker bajarildi degan da’vo yo‘q.
- PostgreSQL trigger barcha haqiqiy price/cost o‘zgarishini tutadi; manual edit/bulk actor/source va audit, boshqa tizim cost hisobida source database/actor null. Migration baseline eski narx tarixini taxmin qilmaydi. Cost cheklovi manual catalog edit/history va katalog/history eksporti uchun owner-only; adminning mavjud financial read vakolati saqlangan. Admin product edit cost readonly; Decimal qiymatlar formadan satr bo‘lib yuboriladi.
- Damaged uchun alohida location va qaytarilgan physical balance; write_off disposal journal. General location/reservation va repair/release INV-02 bandlari alohida ochiq. Sahifa yig‘masi faqat sahifadagi product/store juftliklariga tegishli va ularning barcha matching yozuvlarini jamlaydi; butun katalog yig‘masi deb ko‘rsatilmaydi.
- Prisma journal relationlari SQL FK/delete/update qoidalariga mos; kelajakdagi generated migrationlar ularni tasodifan olib tashlamasligi uchun inverse relationlar explicit yozilgan. Migration037 history tenant/actor va location immutable identityni himoyalaydi; readiness035–037 markerlarini talab qiladi.

### Yakuniy tekshiruv va versiya

- Git HEAD `bbf07d6318e8d53defb80704f41e73806dd0c3a5` + joriy ishchi daraxt. AI commit/deploy qilinmagan. Node24 / Next16.3.8 / Prisma5.22.
- `npm run typecheck`, `npm run lint`, disconnected build-only DATABASE_URL va HTTPS APP_ORIGIN bilan `npm run build`: exit0; `/tmp/pos-plus2-{typecheck,lint,build}.log`.
- `npm test`:27/27, fail/skipped/todo0; `/tmp/pos-plus2-unit.log`. Sandbox faqat7 faylni sanagan natija qabul dalili sifatida ishlatilmadi; actual Node test ijrosi qayta tekshirildi.
- Final client bilan isolated pos_test `npm run test:integration`:121/121, fail/skipped/todo0; `/tmp/pos-plus2-integration.log`.
- Broad uch-browser E2E45/48: uchta yangi test Next route announcer bilan ambiguous alert locator sabab yiqildi. Locator to‘g‘rilandi; yangi cost batch uchun alohida sabab kiritish test qadami ham tuzatildi. **Eng yangi build bilan final `npm run test:e2e -- --grep 'Reviewed price batch|catalog management'`:6/6** (2×Chromium/Firefox/WebKit), exit0; `/tmp/pos-plus2-e2e-accepted.log`. Broad48/48 qayta o‘tdi degan da’vo yo‘q. Qolgan45 scenario broad run’da o‘tdi; o‘zgargan katalog va yangi price/disposition oqimlari final6 bilan tekshirildi.
- `bash scripts/ops/test-migrations.sh`:37 migrations fresh va legacy fixtures, exit0; `/tmp/pos-plus2-migrations.log`. Legacy baseline2 (oldValue null/source migration_baseline) va damaged/write_off2 original date2026-01-15/cost0.5/name Fixture bilan saqlandi. Avvalgi allocation/debt/barcode/unit natijalari ham saqlandi. Return fixture parent/items bitta transactionda, existing immutable-history guard chetlab o‘tilmadi.
- Fedora WebKit uchun ICU74/JPEG8 faqat /tmp test browser kutubxona katalogiga qo‘yildi; tizim paketlari o‘zgartirilmadi. Database suite, migrations va browser mutating sinovlari ketma-ket bajarildi. Haqiqiy biznes bazasiga tegilmadi.
- `git diff --check`:exit0. Vaqtinchalik loglar doimiy artefakt emas; qayta ijro manbasi versioned source/tests/migrations/scripts.

Source **297 fayl**, SHA256 `b4a57610f6eafe20587cb4581047a90d731659d2490f52ee85dc5eace702e925`: src/tests/prisma/scripts .ts/.tsx/.sql/.prisma/.cjs/.mjs/.sh; sorted relative path+NUL+bytes+NUL, docs alohida.

## plus-20 — faol bajarish (2026-10-08)

Baseline **101 done**, maqsad **121 done**. Tanlangan yangi IDlar: FIN-02.04/05/06/07/02, PUR-01.01/02/03/04/05, RET-01.03/08, POS-02.06, REP-01.06/08, CRM-01.04, CAT-01.01, DATA-01.09, SEC-01.02/04. Hozir bu checkpoint bo‘yicha **0 yangi done**. Har birining PLAN1 qabul mezoni saqlanadi; test yoki subtask alohida vazifa hisoblanmaydi. Tashqi fiskal/Click/hardware implementatsiyasi kiritilmaydi.


### plus-20 moliyaviy guruh — qabul qilingan +3 (2026-10-08)

**Amaldagi hisob: 101 → 104 done. So‘ralgan +20 ichidan3 qabul qilindi,17 hali ochiq. Maqsad121 o‘zgarmadi.** Test, migration yoki UI kichik qadamlar alohida PLAN1 vazifasi sifatida sanalmadi. Quyidagi uchta IDdan boshqa yangi checkbox yopilmagan.

Versiya: HEAD `e6639e8bcb86b2e46b40e663c6c47ec45d06d127` ustidagi ishchi daraxt; avtomatik commit/deploy yo‘q. `src/server/finance/accounts.ts` SHA256 `0ee2a989614ca595fb4451371826c6bf57e71032ac722d2168450f90f255c0a7`; `src/server/reports/profit.ts` SHA256 `057452081f9588d432b38a38b66c002e1d09d6f11282f4566aa7f3062fb75f71`. Test/schema versiyalari quyida.

| ID | Tekshirilgan kirish | Kutilgan va haqiqiy natija | Dalil |
| --- | --- | --- | --- |
| FIN-02.04 | cash opening1000, expense10, operating/capitalised category, original reversal; admin create, cashier read va foreign account negative; late AuditLog failure | Expense+cash posting+audit+Operation atomic; original retry bir marta; reversal originalni o‘zgartirmaydi; cashier403/admin account create403; late audit barcha pul/hujjatlarni rollback; CashMovement mirror update/delete SQLda taqiqlanadi | `tests/reports-finance.integration.test.ts`: “Financial accounts…”, “Financial transfer late…”, “Cross-branch transfer details…”; `src/app/(dashboard)/finance/page.tsx`; migrations038–041; uch browser “Finance UI…” |
| FIN-02.05 | sale100 originalcost50, operatingexpense10, capitalised20, originalexpense reversal | netSales100,COGS50,gross50,operating40,capitalised20; reversal operating50; bank transfer foydani o‘zgartirmaydi; label internal management/not statutory accounting | Profit API SQL RepeatableRead va exact Decimal; same finance test; browser expense10.25 → operating−10.25 → reversal0 |
| FIN-02.06 | cash→bank200; same-key parallel replay; bank ikki parallel debit200; UI bank20.05 transfer; cross-branch owner transfer/admin only one branch | Same document ostida ±200, sum0; cash800 bank300, savdo Payment soni o‘zgarmaydi; parallel debit faqatbittasi o‘tadi, bank80; UI secondary20.05 va finalprimary79.95; transfer revenue emas; admin unassigned account tafsiloti/export/reversal rad | Same finance PG tests, SQL deferred balancing, immutable journals, HTTPS browser exact cents/lost acknowledgement |

Yakuniy tekshiruvlar:

- `npm run typecheck`: exit0, `/tmp/pos-plus20-typecheck.log`.
- `npm run lint`: exit0, `/tmp/pos-plus20-lint.log`.
- `npm test`: 27/27, `/tmp/pos-plus20-unit.log`.
- `DATABASE_URL=<isolated pos_test> npm run test:integration`: 124/124, `/tmp/pos-plus20-finance-tests.log`. Faqat127.0.0.1:55439/pos_test; haqiqiy biznes bazasi ishlatilmadi.
- `DATABASE_URL=<build-only invalid connection> APP_ORIGIN=https://build.example.invalid npm run build`: exit0, `/tmp/pos-plus20-build.log`.
- `DATABASE_URL=<isolated> PLAYWRIGHT_BROWSERS_PATH=/tmp/pos-playwright-browsers POS_E2E_ALL_BROWSERS=1 npm run test:e2e -- --grep 'Finance UI'`: Chromium/Firefox/WebKit3/3, `/tmp/pos-plus20-finance-e2e.log`. HTTPS standalone production build; explicit preview, exact balance/profit, aborted successful reversal response, reload, original pending key, bitta reversal.
- `bash scripts/ops/test-migrations.sh`: exit0, `/tmp/pos-plus20-migrations.log`; alohida vaqtinchalik fresh/legacy bazalar41 migration va tarixiy backfills bilan. Cleanup yakunlangan.
- `git diff --check`: exit0.

Test versiyalari: `tests/reports-finance.integration.test.ts` SHA256 `7e31f18ae00df50f9f6ed859fb4406e9423d93691eaf9437d044c05bdd04982d`; `tests/e2e/core.spec.ts` SHA256 `c1b5b908d370c47aa23ea05d70813223ab20044b10eda3cb4ff19c8fa5f6f79b`; schema SHA256 `5bf6ee9a5ba12d1e185c06f8836489167fe2b6ecdb79ad8c3a26c0c162e4e10e`.

Oraliq xatolar yashirilmadi: SQL deferred trigger record shakli va OLD alias PostgreSQL trigger recordiga to‘qnashdi; qo‘llangan038 checksumiga tegilmay039/040 forward fixes bilan tuzatildi. 041 immutable cash mirror himoyasini qo‘shdi. Browser category create test server javobidan oldin DB lookup qilgan; real option ko‘rinishini kutish bilan tuzatildi, assertion yumshatilmadi. Final barcha tekshiruvlar o‘tdi.

Core cheklovlar: hisob/category ro‘yxati10000 dan oshsa explicit413, qisman natija emas. Cash mirror alohida yana cash balansga qo‘shilmaydi. Bank/provider kitobi qo‘lda qayd etilgan ichki jurnal; real vendor integration/confirmation emas. Tax snapshot va purchase landed-cost bu uch band bilan tugallangan deb da’vo qilinmaydi. `SEC-01.02/04` ham shu guruh bilan avtomatik done emas.

Qolgan17 ID: FIN-02.07/02, PUR-01.01/02/03/04/05, RET-01.03/08, POS-02.06, REP-01.06/08, CRM-01.04, CAT-01.01, DATA-01.09, SEC-01.02/04. Keyingi bajarish purchase/order/supplier payable/advance/return/landed-cost guruhidan davom etadi. Tashqi fiskal/E-POS/Click/hardware implementatsiyalari foydalanuvchi belgilaganidek chetlab o‘tiladi.

## Yangi +20 so‘rov — faol (2026-10-08)

Oldingi moliyaviy uch band bu so‘rovga qayta sanalmaydi. Baseline104, maqsad124 done; joriy yangi done0. So‘ralgan20 to‘liq qabul qilinmaguncha bu checkpoint complete emas. Birinchi guruh: REP-01.06 kesimlarida aynan bir davr savdo va qaytarma summalarini solishtirish; keyingi guruh purchase/supplier va qolgan core vazifalari. Tashqi/vendor integratsiyalar avvalgi taqiq bo‘yicha chetlab o‘tiladi.


### Yangi +20 — REP-01.06 qabul protokoli

**104 → 105 done. Bu yangi so‘rovdan1 ta qabul qilindi,19 ta hali ochiq; maqsad124 bajarilmagan.** Oldingi FIN-02.04/05/06 qayta sanalmaydi. Test, dimension, API, UI yoki CSV alohida PLAN1 vazifasi sifatida sanalmaydi.

REP-01.06: `/api/reports/breakdowns` va `/reports/breakdowns` product/category/cashier/store/payment kesimlari, tashkilot timezone davri, asOf, assigned-store scope, stable pagination, explicit refresh va full CSV. Same RepeatableRead snapshotda kesimlarning barcha sahifalar jami financialSummary netSalesga tengligini server tekshiradi. Nomuvofiqlik409 REPORT_UNRECONCILED; formula-safe CSV max10000. Kategoriya/katalog nomlari joriy; qaytarma original kassirga tegishli. Turli birliklar aralashmasligi uchun quantity faqat product kesimida. Payment original sales va refund channels bo‘yicha: later debt collections/manual payments/expenses/internal transfers revenuega qayta qo‘shilmaydi. Payment COGS/profit null: taxminiy taqsimot yo‘q, cash-flow hisoboti deb ko‘rsatilmaydi.

Tekshirilgan dataset: birinchi sale200−discount10=190, original cost100; yarim qaytarma95/cost50; ikkinchi filial/cashier/kategoriyasiz product sale120/cost30; keyingi qarz undirish10. Besh kesimning har birida **netSales215**, economic dimensions **COGS80/gross135**. Limit1da data1, total2; CSV ikki qator, barcha davr215. Birinchi store filtri95; unassigned admin0; cashier403; foreign store404; invalid dimension400. Uch brauzerda API orqali haqiqiy sale95/cost50dan besh UI kesimi95 va CSV download tasdiqlandi.

Dalillar:
- `npm run typecheck`, `npm run lint`:exit0; `/tmp/pos-new20-typecheck.log`, `/tmp/pos-new20-lint.log`.
- Build-only invalid DATABASE_URL va HTTPS APP_ORIGIN bilan `npm run build`:exit0; `/tmp/pos-new20-build.log`.
- Isolated `npm run test:integration`:125/125, `/tmp/pos-new20-integration.log`. Keyingi quantity-null va CSV completeness assertions bilan final focused `node --require ./scripts/test-resolver.cjs --test --test-name-pattern='All five sales breakdown' .test-build/tests/reports-finance.integration.test.js`:1/1; `/tmp/pos-new20-breakdowns.log`.
- `npm test`:27/27; `/tmp/pos-new20-unit.log`. Birinchi automatic approval review vaqt chegarasiga yetdi; ruxsat etilgan qayta urinish o‘tdi. Hech qanday unsafe action yoki foydalanuvchi approval talabi qolmagan.
- Final standalone production HTTPS `POS_E2E_ALL_BROWSERS=1 npm run test:e2e -- --grep 'Sales breakdown UI'`:Chromium/Firefox/WebKit3/3; `/tmp/pos-new20-e2e.log`.
- `git diff --check`:exit0. Haqiqiy DB/deploy/vendor integration ishlatilmadi; yangi migration yoki SDK kerak bo‘lmadi.

Versiya: joriy HEAD `3301aa37f41dfd0649966bbbf51e5bd4b219452e` + ishchi daraxt; AI commit qilmagan. Endpoint SHA256 `7c90588a0ce3442c82d56a17159b96ddeb20723180e8a3f9a3e1378b68f744f9`; UI `5efd597aed3829b2647f83e11aef9a17532c10feda90ab659437174d9e07bdc0`; integration test `4120f860fe1244502c2ec032b1f74e84db942d5a97d7303fd2fd3429424bd825`; browser test `653d5a11fc1fb7bd257d41e94f8afb046a4176f37c38fe8bf8b6a32ccc2d4740`. Vaqtinchalik loglar o‘rniga qayta ijro manbasi versioned route/UI/tests.

Oraliq xatolar: yangi customer fixture phone majburiyligi tuzatildi. ApiResponse summary avval faqat SalesReportSummaryga bog‘langan edi; backward-compatible default generic Summary bilan aniq yangi Totals turi berildi, unknown cast ishlatilmadi. Birinchi build shu type xatosida yiqilgan; final typecheck/build o‘tdi. Qabul mezoni yumshatilmadi.

### Yangi +20 — PUR-01.01 va PUR-01.04 qabul protokoli (2026-10-08)

**105 →107 done. Latest +20 baseline104dan3 qabul,17 hali ochiq; maqsad124.** Bu checkpoint butun loyiha production-ready degani emas.

PUR-01.01: existing kontakt/rekvizit/shartlar, draft/confirmed/reversed receipt history va original receipt price-history reportga qo‘shimcha scoped invoice/payment/allocation tarixi supplier kartasida ishlaydi. Contact/bank/terms bound400, foreign404, cashier403, archive/restore metadata saqlanishi oldingi hamda joriy supplier terms testida tekshirildi. Debt yoki advance nol bo‘lmasa archive409, ikkalasi nol bo‘lganda archive200/history200. Archived tarix o‘chmaydi.

PUR-01.04: avans30; original2×40 receipt invoice80; allocate30 →unpaid50/advance0; yangi cash20 →unpaid30; overpay31 rad va journal o‘zgarmagan. Ikki parallel30 so‘rovdan faqat bitta muvaffaqiyatli; paid80/cash920, invoice qarzi0. Bank proofsiz rad; proofli bank30 original key replayda bir marta. Keyingi invoice30ga uchta10 allocation: limit1 history total3, aggregate30, qarz/avans0. Cash10.25 audit failureda payment/account/shift/Operation rollback, aynan original retry bir marta. SQL immutable/scope/overallocate/source invariantlari triggerlarda; tracked purchase ordinary reversal409, original-bound return hali PUR-01.03 scope.

Browser protocol: invoice80, cash30 partial →qarz50; avans10.25 POST serverda commit bo‘lib javob ataylab uzildi; reload/original pending retry bitta payment; avans allocate→qarz39.75/advance0/cash959.75. Supplier va mavjud Finance recovery regression Chromium/Firefox/WebKit **6/6**.

Dalillar: `npm run typecheck`, `npm run lint`, disconnected-build `npm run build`:exit0, `/tmp/pos-rest19-{typecheck,lint,build}.log`. Isolated `npm run test:integration` **127/127**, `/tmp/pos-rest19-integration.log`; latest bounded history/archive assertions supplier focused **2/2**, `/tmp/pos-rest19-supplier-test.log`. `npm test` **27/27**, `/tmp/pos-rest19-unit.log`. `bash scripts/ops/test-migrations.sh` fresh+legacy **44 migration PASS**, `/tmp/pos-rest19-migrations.log`. HTTPS production `POS_E2E_ALL_BROWSERS=1 npm run test:e2e -- --grep 'Supplier ledger UI|Finance UI'` **6/6**, `/tmp/pos-rest19-e2e.log`. `git diff --check`:exit0. Database faqat isolated localhost55439/pos_test. Vendor API/real biznes DB/deploy/AI commit yo‘q.

Versiya: HEAD3301aa37f41dfd0649966bbbf51e5bd4b219452e + ishchi daraxt; qayta ijro uchun versioned tests/routes/migrations. SHA256:
- `src/server/purchases/suppliers.ts`: `67ac82486a5dd30f2aa7503930a3508d44b79eeb77ee7da2250f18c621df29c9`.
- `src/components/suppliers/SupplierLedger.tsx`: `ac576c93bcc4f948987232021ba78f1f3570e664be29de7da0c4c70de88685d2`.
- `tests/reports-finance.integration.test.ts`: `b61817c971a8123543920c02737055ffab39164a28c02f9bc389afd296ac7b57`.
- `tests/e2e/core.spec.ts`: `ef25ef39b77538cb41e2dbcc293e0169d088a1e7fb17514be0a6178ddf084ae4`.

### Yangi +20 — PUR-01.02 va REP-01.08 qabul protokoli

**107→109 done. Latest +20 baseline104dan5 qabul qilindi,15 hali ochiq; maqsad124.** Supplier return/landed cost/tax va boshqa ochiq parent vazifalar bu yerda tugadi deb sanalmaydi.

PUR-01.02: buyurtma5×10.25 stock/payable yaratmaydi; birinchi original qabul2→stock2/invoice20.50/remaining3. Qabul4 rad va journal unchanged. Parallel qolgan3ni ikki qabul qilishdan biri commit, ikkinchisi rad; stock5, ikkita receipt/movement/invoice, quantity remaining0. Payment51.25 ikki invoicega20.50/30.75 taqsimlanadi, replay bir marta, qarz/avans0. Foreign/hidden admin404, cashier403, invoice/receipt immutable; receipt history limit1/total2. Late receipt audit failure stock, weighted cost, invoice, original links va Operationni to‘liq rollback qiladi, original retry once. Original birlik o‘zgarsa409, qayta to‘g‘ri birlik bilan retry ishlaydi; complimentary2×0 original receipt/invoice0, yangi payable/cash yo‘q.

REP-01.08: original purchase value51.25. Past due invoice20.50, upcoming20.50, undated10.25; cash15ning10 invoicega/5advance→supplier unpaid41.25=overdue10.50+upcoming20.50+undated10.25, paid15/advance5. Xuddi shu summary supplier ledgerga teng, purchase report51.25. Before-payment asOf qayta o‘qilganda unpaid51.25. Customer future due100→statement currentBalance/debtTotal/upcoming100. Smena opening1000−suppliercash15=expected985, counted980/difference−5 frozen APIga teng. CSV formula safe; scope/cashier/future cutoff rad. Eski unregistered receiptga guessed debt yo‘q.

Browser: supplier ledger regression va purchase UI order5→receipt2→partial→receipt3 lost response→reload/original saved key→received; receipt/invoice2ta, stock5, debt51.25; supplier balance UI undated51.25 va CSV download. Chromium/Firefox/WebKit **6/6**, `/tmp/pos-orders-e2e.log`. Birinchi browser run parent refresh supplierni unmount qilgani uchun selection yo‘qolganini topdi; fix actor-scoped componentni saqlaydi, final6/6. Birinchi integration cleanup FK xatosini topdi, forward047 deferred NO ACTION bilan tuzatildi; applied045 checksum o‘zgartirilmadi.

Final `npm run test:integration`: **131/131**, `/tmp/pos-orders-integration.log`. Latest focused4/4 `/tmp/pos-orders-focused.log`. `bash scripts/ops/test-migrations.sh`: **fresh+legacy48 PASS**, `/tmp/pos-orders-migrations.log`. Typecheck/lint/disconnected production build exit0, `/tmp/pos-orders-{typecheck,lint,build}.log`. Unit27/27 bu turn oldingi supplier stage; pure calculation o‘zgarmagan. `git diff --check` exit0. Real business DB/deploy/vendor API/AI commit yo‘q.

Versiya HEAD3301aa37f41dfd0649966bbbf51e5bd4b219452e + ishchi daraxt; SHA256:
- `src/server/purchases/orders.ts`: `a894fed6c9d5269d203673a02a3ea7b51c18b9d9530b27c2b4328c2e0975dc18`.
- `src/components/suppliers/PurchaseOrders.tsx`: `45269b36789a9422ee6ff09d0320f19ce09c35fb40bc597b73b40d07c2baffd3`.
- `src/app/api/reports/supplier-balances/route.ts`: `724a2e1ca504345ccf2ff2db2118d4cfbbb0a4213cd23e5212fbfad700b8c3c7`.
- `src/app/(dashboard)/reports/supplier-balances/page.tsx`: `4d37f8204a0c2b7aa13cf07b671785290099c53bef1e59d58c2e5d3fc36ed8c9`.
- `tests/reports-finance.integration.test.ts`: `9727eb13af9331d853219e7091cb592012cac9bfef10923be23b31cf9f703525`.
- `tests/e2e/core.spec.ts`: `cf33d92d35ae9749253c36f1a27975e755b0e2c3569386de43b4986cc2471021`.

Davom navbati: FIN-02.07/02, PUR-01.03/05, RET-01.03/08, POS-02.06, CRM-01.04, CAT-01.01, DATA-01.09, SEC-01.02/04; latest +20ning qo‘shimcha uch o‘rni uchun CAT-01.03, INV-02.05, OFF-02.01 core backlogdan tanlanadi. Hozir jami15 ochiq, bu yangi tanlovlar done emas. Sharp rasm sanitizatsiyasi rasmiy constructor/output qo‘llanmasi va mavjud0.35.4 local package bo‘yicha dastlab o‘rganildi, biroq fayl yuklash modeli/dependency/endpoint/implementatsiya bu checkpointda yozilmadi va DATA-01.09 done emas.


### Yangi +20 — PUR-01.03 qabul protokoli (2026-10-08)

**109→110 done. Latest +20 baseline104dan6 ta qabul qilindi;14 ta hali ochiq, maqsad124.** UI/API/testlar alohida PLAN1 bandi sifatida sanalmaydi.

Original receipt/invoicega bog‘langan SupplierCredit/Item physical return va price correction ishlaydi. Credit original qolgan quantity/value chegarasida; goods return stockni kamaytiradi, price credit quantityni o‘zgartirmaydi. Qolgan qiymat qolgan quantityga taqsimlanadi; final remainder exact. Paid invoice kamayganda immutable original allocation release aynan original paymentning advance balansiga qaytadi, yangi cash/payment yaratilmaydi. Scope/live session/role, original key replay, locks va Serializable transaction saqlanadi.

Tekshirilgan hisob: original5×10.25=51.25 to‘langan; return2→credit20.50/net30.75/advance20.50; pricecredit5→net25.75/advance25.50; qolgan3 return→net0/advance51.25/stock0. Original cash movement1 va cash948.75 o‘zgarmaydi. Before-credit asOf51.25; joriy purchase gross51.25/credits51.25/net0. Keyingi invoice10ga released advance allocation→advance41.25, yangi cash yo‘q. Parallel original qty cheklovi, stale preview409, foreign404/cashier403, immutable journal, audit rollback va malformed deferred journal rad tekshirildi.

Qo‘shimcha: 1kg×0.01 uch fractional returnda jami0.01/stock0; original10, return0.5→5, pricecredit4, return0.25→0.50, final0.25→0.50; jami10. Price credit tarixiy sale costni qayta yozmaydi; landed-cost/sold-stock correction PUR-01.05. Actual supplier cash refund alohida, bu band bilan implemented deb da’vo qilinmaydi.

Dalillar: final isolated `npm run test:integration`135/135 (`/tmp/pos-supplier-return-integration.log`), `npm test`27/27 (`/tmp/pos-supplier-return-unit.log`), fresh+legacy `bash scripts/ops/test-migrations.sh`49 migration PASS (`/tmp/pos-supplier-return-migrations.log`). Final typecheck/lint va disconnected production build exit0 (`/tmp/pos-supplier-return-{typecheck,lint,build}.log`). Route inventory111 template/153 handler. Database faqat isolated localhost55439/pos_test yoki shu konteynerdagi temporary migration databases; real biznes DB/deploy/vendor API/AI commit yo‘q.

Browser acceptance: final production HTTPS `POS_E2E_ALL_BROWSERS=1 npm run test:e2e -- --grep 'Supplier return UI|Supplier ledger UI|Purchase order UI'` **9/9**, Chromium/Firefox/WebKit (`/tmp/pos-supplier-return-e2e.log`). Oldingi final run8/9 same-invoice selection/refresh lifecycle xatosini topdi. Ayni value qayta tanlanganda detail tozalash olib tashlandi; refresh paytida SupplierCreditsni unmount qilayotgan ledger busy conditional tuzatildi. Test forma ko‘ringach ayni invoice qayta tanlanishini explicit tekshiradi. Final9/9dan keyin checkbox va tracker donega o‘tkazildi. Browser original purchase2×10/paid20, return1 lost response/reload/original retry→credit1/advance10/stock1; finalunit→advance20/stock0, original cash movement1/balance980. WebKit yetishmayotgan ICU74/JPEG8 kutubxonalari faqat /tmp browser treega chiqarildi; system package o‘zgarmadi.

Versiya HEAD `d4662557f3901624392721aafc6e9313c21d5d6f` + ishchi daraxt (AI commit yo‘q). Qayta ijro versioned routes/services/migration049/integration/e2e testsdan. SHA256: credits `350b082107bc8af5d83430bb823aa823b8c518d81332907639175e8ba3c2a27e`; operations `efbf10a4615be9160bdb6c67bbde5c6d26d45b84fc06952e6da8beef7120cb3b`; integration `a4c0ce9e640d6318e613cedf32259430816fe67912a56135694bac92052628d6`; UI `ef358e9c801d41bb3c95cb5b0389fabf40a42e35edcc9d53140d7d3c3dfd9d83`; E2E `b97d6c9a6a904f4ef4fb063cbd831215d61a643b841740d18350c84752ae1677`.

Final SupplierLedger SHA256 `37b9bdb7ea192291bb9ff4f1c0799b27cf5d9b77adeb02cae086206f786ba0a5`. `git diff --check` exit0. Keyingi14 ochiq: FIN-02.07/02, PUR-01.05, RET-01.03/08, POS-02.06, CRM-01.04, CAT-01.01/03, DATA-01.09, SEC-01.02/04, INV-02.05, OFF-02.01. Latest +20 hali complete emas.


### Yangi +20 — CAT-01.03 qabul protokoli (2026-10-08)

**110→111 done. Latest +20 baseline104dan7 ta qabul qilindi,13 ta hali ochiq; maqsad124.** Yangi schema/API/UI/testlar bitta parent vazifa sifatida sanaladi. Butun loyiha production-ready deb da’vo qilinmaydi.

ProductVariant existing Product/SKU productIdsini stockKey sifatida saqlaydi. Root default/asl SKU; har child mustaqil barcode, narx, tannarx, stock va sale/return/purchase foreign keys. Rang/o‘lcham JSONB canonical trim/lowercase; option tartibi/case yangi kombinatsiya yaratmaydi, duplicate parallel bir marta. Eski mahsulotlarning name/barcode/quantity/historysi o‘zgarmaydi;050 backfill/default trigger,051 composite tenant FKs root/child scope invarianti. Mavjud texnologiyalar Prisma/PostgreSQL/React/IndexedDB; yangi vendor SDK yoki refactor kerak bo‘lmadi.

Kirish/natija: original stock10; red/M variant stock3, blue/L stock4, barcode lookup red productIdni qaytardi. Red125.50 sale1→red2, blue4/original10 unchanged; original sale return1→red3. Default original barcode va metadata{} saqlangan. Variant yaratish movement/payment0. GET limit1 data1/total3; cashier scoped read200/cost hidden; boshqa filial99 mavjud bo‘lganda assigned store5 ko‘rindi; foreign404, cashierPOST403. Unit/family/options/tenant rewrite SQLda rad; archive metadatani yo‘qotmaydi. Late audit failure product, primary barcode, price history, variant va Operationni to‘liq rollback qildi; original retry bitta child yaratdi.

Browser: existing root stock7. UI red/M12.50 variant creation serverda commit bo‘lib javob uzildi; reload/saved original retry→bitta product, ikki family rows, yangi stock0/movement0/payment0 va originalstock7. Variant tanlash aniq SKU/barcode/quantityni ko‘rsatdi. Chromium/Firefox/WebKit variant va oldingi purchase/return regression **9/9** (`/tmp/pos-variants-e2e.log`).

Dalillar: final isolated `npm run test:integration` **138/138**, `/tmp/pos-variants-integration.log`; `npm test` **27/27**, `/tmp/pos-variants-unit.log`; `bash scripts/ops/test-migrations.sh` fresh+legacy **51 migration PASS** va legacy-product defaultvariant count1, `/tmp/pos-variants-migrations.log`. Typecheck/lint/disconnected production build exit0 (`/tmp/pos-variants-{typecheck,lint,build}.log`); `git diff --check` exit0. Boundary inventory **112 template/155 handler**. Yangi migrationlar faqat isolated DBda; actual business DB/deploy/AI commit/vendor integration yo‘q.

Versiya HEAD `d4662557f3901624392721aafc6e9313c21d5d6f` + ishchi daraxt. SHA256: service `c7ba00f1114e8a19928a21d0107654ab83cda0953da1e1547f59f9b7d1acc627`; UI `7174e377da13beda8c609086bd7a481c903f6e797411d6e3324c4ef0e7a3a514`; integration `ef9482c2a6b739da202fe8279a083d0dac685eec4a584ae912d71beb533a9c37`; E2E `61ae63ceb956debbfe23c8470f6159699f24d00368ce0bdd05e6e3c3edac02f3`. Qayta ijro manbalari versioned migration/service/routes/tests; vaqtinchalik loglar yo‘qolsa ham shu buyruqlar qayta ishlatiladi.

Chegaralar: oilada1000 SKU cap; quantity sahifadagi har SKUning allowed-stores yig‘indisi, family aggregate emas. Variant metadata immutable, archive/restore mavjud Product lifecycle bilan. Bir oilada birlik umumiy; paket/unit conversion CAT-01.04ning alohida vazifasi. OFF/fiscal/Click/hardware shu bandga qo‘shilmadi.

Qolgan13: FIN-02.07/02, PUR-01.05, RET-01.03/08, POS-02.06, CRM-01.04, CAT-01.01, DATA-01.09, SEC-01.02/04, INV-02.05, OFF-02.01. Latest +20 hali complete emas.


## Yangi +20 so‘rov — faol (2026-10-08, baseline111)

Baseline111 done, yangi maqsad131. Oldingi so‘rovdagi yetti qabul qayta sanalmaydi. Yangi done13 (124 jami); qolgan7. To‘liq20 ta parent PLAN1 bandi qabul qilinmaguncha checkpoint complete emas. Birinchi guruh DATA-01.09/CAT-01.01/SEC-02.08: bounded protected assets, category tree/brand/description/image va xavfsizlik regressionlari. Tashqi integratsiyalar avvalgi taqiq bo‘yicha chetlab o‘tiladi.

### Yangi +20 — DATA-01.09, CAT-01.01, SEC-02.08 qabul protokoli

111→114 done; bu so‘rovdan3/20,17 ochiq. Uchta parent band sanaldi; endpoint/testlar qo‘shimcha task hisoblanmaydi.

DATA-01.09: PNG/JPEG/WebP canonical base64,512KiB va16Mp cheklovi, qayta WebP encode/EXIF stripping; SVG415/corrupt400/path traversal400/oversize413/foreign404/cashier mutation403. Protected cashier own binary200/private-no-store/nosniff/sandbox, anonymous401, expiry/deleted410. Org locked quota parallel ikki commanddanbitta; audit failure bytes/link/Operation rollback; original replayone; deletion bytesNULL/linkNULL, metadata retained/usedBytes0. Backup encrypted empty restore bytes/SHA256/Productlink/authenticated GETni qayta tikladi; fixture RTO5s/RPO0 hosting SLA emas. Existing PostgreSQL durable volume policy ADR-035; arbitrary hujjat/video allowlistda yo‘q.

CAT-01.01: category parent/tree manager UI, self/descendant/foreign/depth SQL+service guards; helper va raw parallel SQL cyclelardanbitta commit. Brand create/rename/archive/restore scoped/page; product description/image/brand preserved, lifecycle historical SKUga tegmaydi. UI unknown upload commit, lost acknowledgement, reload/original saved retry bitta asset; deletion image/bytes yo‘q, description saqlanadi. Brand search/paging selection va unsaved metadata preservation bor.

SEC-02.08: nonce strict-dynamic CSP document parserga kiritilgan nonce’siz scriptni uchbrauzerda bloklaydi, framework forms/offline/receipt iframe ishlaydi. React description plain-text; active URL/upload formats rad. Existing formula-safe CSV unit/integration tests regressionda. Private API/file عمومی cachega kirmaydi. Trusted browser evaluate runtime injection parser XSSga teng emasligi topildi; test HTML responsega hostile script kiritib haqiqiy mezonni tekshiradi.

Dalillar: unit27/27 `/tmp/pos-files-unit.log`; final full integration142/142 `/tmp/pos-files-integration.log`, latest strengthened files/category focused4/4 `/tmp/pos-files-focused.log`. Typecheck/lint/build exit0 `/tmp/pos-files-{typecheck,lint,build}.log`; fresh+legacy55 migrations PASS `/tmp/pos-files-migrations.log`; encrypted backup PASS `/tmp/pos-files-backup.log`. Final full HTTPS three-browser69 testdan68passed va WebKit count-flow transient failure `/tmp/pos-files-e2e-final.log`; aynan failing scenario unchanged buildda qayta19.2s PASS `/tmp/pos-files-webkit-recheck.log`. Previous full run66existing scenariospassed (new test hidden option selector failure); new catalog/parserCSP3/3 `/tmp/pos-files-media-e2e.log`. Failed inventory count assertion qayta tekshirildi, threshold/status yoki expectation yumshatilmadi; bu full-run69/69 degan da’vo emas.

Versiya HEAD d4662557f3901624392721aafc6e9313c21d5d6f + ishchi daraxt, AI commit yo‘q. Qayta ijro source/test/migration052..055da; faqat isolated55439/pos_test. Route boundary116template162handler. Haqiqiy biznes DB/deploy/vendor API ishlatilmagan. Keyingi cashier PIN bandi hali done emas.
ff30fb694c1e6cb132e006c4489df7e79577167b9ac86e5946445ccc409dbad0  src/server/files/assets.ts
4ff9fc3fb44bdda8bfdb60c3f4c0287a9f156bd9581a76a57afbd2558a72faf1  src/proxy.ts
5a2a520296d82f229eae6013681d1110be33151f2f143251ed94fc9d94c298be  tests/files-catalog.integration.test.ts
da1c02ec50f41d362f506a5782e06155e12bc07de1bc79eb6dbe1ff3daa9b503  src/app/(dashboard)/products/[id]/media/page.tsx

### Yangi +20 — USR-01.04 kassir PIN qabul protokoli

114→115 done, latest baseline111dan4/20;16 qolmoqda, maqsad131. PIN schema/API/UI/testlar bitta parent banddir. Tax qismi keyingi in-progress ish, bu protokolga kirmaydi.

Own cashier PIN password reauth bilan bcrypt12 hash; owner/admin403, invalidpassword403, malformed400. Source session→assigned active branch cashier target; target/sourcelock, new scoped8h session/source revoke/audit atomic. Role adminga o‘zgarsa PIN session401; organization switch403/passwordrequired; boshqa assigned branch ham PIN sessionga ochilmaydi. Fivewrong attempts401 keyingi429/RetryAfter, yangi sessionyo‘q. Successful PIN resets rate budgets. Configure/disable revokes PIN sessions; password rotation barcha membership PIN NULL va sessions revoked. PIN/hash response/audit/localStoragega chiqmaydi. Parallel source switch1success/1reject; audit trigger failureda original source active va new session0; retryonce.

Browser UI PIN password sozlash→wrongPIN→validswitch→/pos yangi cashier actor; own branchlist1, productPOST403, targetpromotionme401. Uchbrauzer3/3. Birinchi browser run test stores query organizationIdni bermagan400ni topdi; tuzatish davomida existing nested userStores inclusion barcha assigned branchesni qaytarishi aniqlanib tenantScope/active store relation filter bilan tuzatildi; integration ham own branchonly assertionni tekshiradi. Mezon yumshatilmadi. UI pending/conflict intentlar bilan switchblok, old actor draft retained/full reload cache discard.

Dalillar: final full isolated integration145/145 `/tmp/pos-pin-integration-final.log`; focused parallel/rollback/password3/3 `/tmp/pos-pin-focused.log` (latest branch assertion full145da). Unit27/27 `/tmp/pos-pin-unit.log`. Typecheck/lint/build exit0 `/tmp/pos-pin-{typecheck,lint,build}.log`; migration fresh+legacy56 PASS `/tmp/pos-pin-migrations.log`. HTTPS production Chromium/Firefox/WebKit3/3 `/tmp/pos-pin-e2e.log`. Route inventory118templates165handlers. `git diff --check` exit0.

Versiya HEAD d4662557f3901624392721aafc6e9313c21d5d6f + ishchi daraxt; AI commit/deploy/realbusinessDB/vendorAPI yo‘q. Qayta ijro source/routes/migration056/tests orqali. Tax model/migration057 tayyorlanmoqda, hali applied/tested/done emas. Qolgan16 parent: FIN-02.07/.02, RET-01.03, POS-02.06, RET-01.08, CRM-01.04, PUR-01.05, CAT-01.04/.06, INV-02.05, OFF-02.01/.03/.04, SEC-01.02/.04, USR-01.06. Bu tanlovlar hech biri shu protokol bilan yopilmaydi.
99b7144be0ad4d313b51b1ab7d2f5e32c5e3372d44558d957e792eb78dd35425  src/server/auth/session.ts
820afb2d4df38719b3f67e4de5cb50a7eaeaa87d19f991d18c0cad50fe56d8a6  src/app/api/auth/pin-switch/route.ts
8024bec7adc1a27f159522233d6012785762afe186f8c99bfba5f0af30f1aa26  src/components/security/CashierPin.tsx
43925214dd960f51838d1f3615cc9f5403a6af531db206ff0233274d09d6df48  tests/cashier-pin.integration.test.ts

### Soliq/chegirma joriy ish — hali qabul qilinmagan (2026-10-08)
057..059 faqat isolated bazaga qo‘llandi; deployed052..058 checksum o‘zgarmadi. FIN-02.07/FIN-02.02/RET-01.03/POS-02.06 uchun server/UI/history/refund kodi tayyorlanmoqda. 151 PG integration va30 unit o‘tdi; final API edit focused9/9. Fresh+legacy59 migratsiya o‘tdi. Birinchi full75 browser68passed/7failed: oldingi conflict/focus oqimi va Chromium terminal-loading scan race; sabablar tuzatildi, yangi buildda focused15 brauzer test ketmoqda. Final browser va backup dalilisiz bu to‘rtta band done qilinmaydi. Hozir115 done, baseline111dan4/20,16 hali ochiq.

### Soliq, refund, scope va backup — yakuniy qabul (2026-10-08)

**115→121 done; faol baseline111dan10/20, maqsad131, yana10 parent band qolmoqda.** USR-01.05 va SEC-01.04 hali yopilmaydi: umumiy testlar ularning barcha alohida mezonlarini avtomatik qabul qilish uchun yetarli deb sanalmaydi.

| Parent band | Tekshirilgan kirish → haqiqiy natija | Manba |
| --- | --- | --- |
| FIN-02.07 | Included/excluded/exempt, effective-date va kelajak stavka, foreign reference, role/archive chegaralari → server aniq Decimal total; eski version o‘zgarmaydi, noto‘g‘ri konfiguratsiya posting qilmaydi | src/server/taxes, tests/taxes.integration.test.ts, settings/taxes UI, migrations057..059 |
| FIN-02.02 | Sotishdan keyin joriy tannarx/narx/stavka o‘zgaradi → original cost/discount/tax/net/rounding snapshot va foyda o‘zgarmaydi; SQL rewrite rad | sales/service, taxes/calculations, reports; taxes integration va economics regression |
| RET-01.03 | Kasr miqdor va ketma-ket qisman qaytarish → cumulative tax gross ratio, discount quantity ratio bilan hisoblanadi; oxirgi refund original sentlarni aynan yopadi; ortiqcha/SQL noto‘g‘ri jurnal rad | returns/service, migration058, taxes integration |
| POS-02.06 | Qator/chek summa va foiz, sabab, owner/admin/cashier limit → exact half-up; admin ruxsatli chegirma approvedRole=admin, limitdan yuqori rad; stale preview/completion moliyaviy ta’sirsiz rad; browser reload/original retry bittadan posting | sales/discounts, DiscountInput, POS quote/cart, tax integration, POS E2E |
| SEC-01.02 | 122 protected route template/171 handler A/B, file/export/SQL va scoped worker → foreign404/forbidden, maxfiy maydonlar yashirilgan; worker(A,Bstore)0; own-worker faqat own incident. Sessiya handler ichida bekor qilinsa yetti CRUD/config endpoint401 va business/audit o‘zgarishsiz | API_ACCESS_MATRIX, permission-transactions.integration, reports-finance integration, operations assertLiveContext |
| OPS-03.02 | Shifrlangan DB+image/hujjat snapshot+dump SHA bilan bog‘langan config manifest; alohida explicit test-secret backup → empty isolated restore59 migration va byte/hash/linkni tikladi, config/recovery reference mos. Noto‘g‘ri dump va644 secret rad; secret nusxa600/shifrlangan | scripts/ops/backup-manifest.mjs, backup-secrets.sh, backup/restore/test-backup.sh, ADR039 |

Yakuniy avtomatik dalillar: full PostgreSQL **153/153** (`/tmp/pos-acceptance-integration.log`, `DATABASE_URL=<isolated55439/pos_test> npm run test:integration`); unit **30/30** (`/tmp/pos-discount-unit.log`, `npm test`); fresh+legacy **59 migratsiya PASS** (`/tmp/pos-discount-migrations.log`, `bash scripts/ops/test-migrations.sh`). Typecheck/lint/production build exit0 (`/tmp/pos-permission-typecheck.log`, `/tmp/pos-manifest-lint.log`, `/tmp/pos-permission-build.log`). Full production HTTPS Chromium/Firefox/WebKit **78/78** (`/tmp/pos-discount-e2e-full.log`); keyingi live-scope o‘zgarishidan so‘ng tegishli regression **21/21** (`/tmp/pos-permission-e2e.log`). Oldingi failed browser runlar yuqorida tarix sifatida saqlangan; final tekshiruvlar tuzatilgan kodda. Encrypted DB/file/config/separate-secret drill PASS (`/tmp/pos-manifest-backup.log`); fixture RTO5s/RPO0 real hosting SLA emas.

Versiya: foydalanuvchi yaratgan HEAD `44d6849c70f68556bcaebc0279632f440df7aeee` + ishchi daraxt; AI commit/deploy qilmagan. Faqat isolated DB va maxsus yaratilgan dummy-secret ishlatilgan; real .env/secret o‘qilmagan, vendor API/hardware yozilmagan. Backup OPS-03.02 core texnik qabulidir: production scheduler/offsite/PITR/key custody boshqa ochiq bandlarda. Legacy unconfigured tax tarixiga o‘ylab topilgan stavka yozilmaydi. Har yangi endpoint/worker reyestr va A/B testiga qo‘shilishi shart. Temporary loglar o‘chsa versioned test/script bilan qayta ijro mumkin.
b5636c37ebd55d15fc3e35336df6655872a84f28a5c8dec539c269c105e8b0cb  src/server/taxes/calculations.ts
9bf919deea67af9db4c6d07b63b13142ebb80839d96b7252ffca7e13deb6af9c  src/server/sales/discounts.ts
b57b27935b1cefd47a9bc3b883d1a0111718562b7f97e051d42d0838e0d0bec8  src/server/returns/service.ts
05f48f99cc50cee647067579b12f53a51fec3e4b6353c53f08bd5996deba797d  src/server/operations.ts
810df09e7a986a4e30b4c9a086e65d6649f89f1b0de6c8efc642b9ff850b1fab  scripts/ops/backup-manifest.mjs
256efeb0c0a328a2e78b5bd66daf9cce46bc20c648f6dcca4828369139260b08  tests/permission-transactions.integration.test.ts

### PWA va manager tasdig‘i — qabul (2026-10-08)

**121→123 done, baseline111dan12/20; yana8 parent band, maqsad131.** Transfer brak/kamomad implementatsiyasi keyingi in-progress ish; migration060 bu qabulda hali applied/tested/done emas.

USR-01.05: managerning o‘z live sessiyasidagi direct action approval; ko‘chiriladigan token emas (ADR040). Owner/admin price batch expected100→110, preview confirmationHash va approvedBy/Role; bir xil replay bitta audit, changed price payload rad. Sale110 original return1 approvedBy/currentRole/refund110; cashier deny, other saleId/sabab bilan ayni kalit rad, returncount1. Blind count expected5/last reading4/round2, submittedAt, readingId/unit/cost exact audit snapshot; adjustment1, boshqa hujjat/changed reason/revoked-session replay deny. Chegirma approval current policy/sum/reason/actor/time bilan sales postingda qayta tekshiriladi; admin within14.5% positive va21% deny tax integrationda. Har amal auditda hujjat/type/miktor/versiya bilan; sessiya expiry approval amal muddatidir. Yangi umumiy Approval jadvali/umumiy PIN talab qilinmadi. Audit Decimal/Date oldingi noto‘g‘ri obyekt serialization tuzatilib exact string/ISO bo‘ldi; nested secrets filtering saqlangan.

OFF-02.01: Next manifest install metadata va192/512 PNG; native worker faqat3public `/pwa` fayl cache. Last50 query catalog server content SHA/version/5min TTL, org/user/device/register scope, owner cost/balance/description/private image saqlanmaydi. Expiry/clock rollback/different actor/query/format/foreign/51 rows rad. Offline original-page katalog ko‘rinadi; expiry bo‘lsa o‘chadi, online qayta yuklanadi, salePOST0. Real worker server transport uzilganda shaxsiy ma’lumotsiz generic offline navigationni beradi; private API/serverHTML/receipt/chunk cachega kirmaydi. Worker update waiting, skipWaiting/claim/force-reload yo‘q; eski cache activate paytida o‘chadi, boshqa app cache saqlanadi. IndexedDBv2 old operations/draftsni saqlaydi. Server-issued catalog TTL authorization/signed offline sale lease degani emas, OFF-02.03/.04 ochiq.

Dalillar: unit **34/34**, `/tmp/pos-pwa-unit.log`; server katalog/core full **154/154**, `/tmp/pos-pwa-integration.log`; keyingi manager audit exact/replay focused **2/2**, `/tmp/pos-manager-focused.log` (owner/admin va count concurrency). Typecheck/lint/build PASS `/tmp/pos-pwa-{typecheck,lint,build}.log`. Real-worker three-browser test **3/3**, `/tmp/pos-pwa-e2e.log`. Final tegishli production HTTPS regression **18/18** (POS cash/lost-ack, price review, tax/discount, manual return va real PWA ×3), `/tmp/pos-pwa-regression-e2e-final.log`.

Birinchi worker browser sinovida Chromium self-signed test-cert rejection va Firefox/WebKit `setOffline`ning worker networkga bir xil tatbiq qilinmasligi aniqlandi: test-only TLS fixture flag va transport socket outage bilan haqiqiy worker fallback sinovga olindi. Birinchi keng regression16passed/2WebKit failed: worker `page.route` lost-ack fault injectionni aylanib o‘tgan. Network interception testlarda worker block, alohida real-worker PWA describe’da allow; final18passed. Production SSL/CSP/authorization yumshatilmadi, assertion/test timeout kamaytirilmadi.

Versiya HEAD44d6849c70f68556bcaebc0279632f440df7aeee + ishchi daraxt; AI commit/deploy yo‘q. Qayta ijro versioned tests/pwa-worker.unit, catalog-cache.unit, permission-transactions integration, economic approval test, e2e/core orqali. Browser build transfer060 boshlanishidan oldingi qabul kodi; keyingi migration/core o‘zgarishi alohida tekshiriladi.
a97e8799cb3c49ebfc04e6268cccc47834e8ebb30a6317bc09b9310d3f1f8e77  src/lib/catalog-cache.ts
9ac2983209d6a92d1622c14ba89529ccd3e71e43f29d969d996f44dea0d7271b  src/lib/offline.ts
82cf8635f51cd158a3f2c6499bfbb4760271a219faf89df5ddbc35a2ee83046a  public/sw.js
bad4809d847fc042247671d8b787fd1fc74332acb654e4e84abd5978c5f15020  src/server/observability/context.ts
9db57b9a9182a61da98a33a4897e4be91919615bd0ebf548445335fe90b4fa23  src/server/inventory/counts.ts

### Keyingi core ish — transfer va support (hali qabul qilinmagan)
Hozir123done, baseline111dan12/20,8parent ochiq. INV-01.04: partial/good/damaged/confirmed-shortage journal, immutable snapshots va exact conservation uchun060/061 isolated DBga applied; fresh+legacy61 PASS, transfer browser3/3. Birinchi full156 integrationda CSV original ustun tartibi regressiyasi topildi; yangi ustunlar oxiriga ko‘chirilib eski exact assertion saqlandi. Ikkinchi full run boundary inventory paytida hali yangi support route source qo‘shilgani uchun compiled module yo‘qligida to‘xtadi; bu run success deb sanalmaydi. API source reyestri stabil bo‘lgach support bilan birga full regression qayta boshlangan. Transfer parent hali done emas.
SEC-01.07/BIZ-02.02: explicit PlatformOperator + owner approved SupportGrant, password source session, operator/tenant/branch/scope/reason/1–60min, live revoke/expiry, read/deny audit, read-only bounded DTO, owner UI va operator console.062 isolated DBga applied. Source biznes roli platforma vakolati emas, platform_admin ham explicit owner grantdan ozod emas. Haqiqiy platforma xodimi provision/deploy qilinmadi; BIZ-02.01 platforma boshqaruvining qolgan qismlari ochiq. Final regression/browser daliligacha bu ikki parent qabul qilinmaydi.

### INV-01.04 — transfer natijalari yakuniy qabul

**123→124 done, baseline111dan13/20;7parent qoldi, maqsad131.**

Jo‘natish6, manba stock10→4. Qisman soz2/brak1/kamomad1, ikki parallel ayni kalit→bitta receipt ta’siri,2 immutable disposition entry; destination sellable2, yo‘lda2. Sababsiz farq/cashier/excess/changed payload rad. Manbaga1 physically returned→source5, final soz1→destination3;6=soz3+return1+brak1+shortage1+transit0, statusclosed. Journal original unitCost50, quantity1, actor/reason/branch/tenant saqlaydi; brak/kamomad sellablega kirmaydi, Payment0. Deferred journal/counter equality, monotonic outcomes, original posted header/item snapshot guard; SQL cost/qty rewrite, extra damaged counter, delete va journal edit rad. Late audit failure qoldiq/movement/disposition/counter/Operationni rollback; original retry bitta natija. Legacy `{}` receive all-remaining good oqimi saqlandi.

Browser original sent6/source4, first2good/1damaged/1shortage reply dropped→reload/saved original retry entries2/dest2/transit2; secondgood2→closed/dest4/source4, entries2/payment0. UI manager oldindan review, sabab va alohida counters/journal; remaining exact BigInt6-scale. CSV yangi ustunlari oxirida, old column order buzilmaydi.

Dalillar: final barcha core integration **158/158** `/tmp/pos-support-integration.log`, transfer exact/rollback/concurrency test `tests/economic.integration.test.ts`; fresh+legacy **61 migrations PASS** `/tmp/pos-transfer-migrations.log`; typecheck/lint/build PASS `/tmp/pos-transfer-{typecheck,lint,build}.log`; unit34/34 `/tmp/pos-transfer-unit.log`; Chromium/Firefox/WebKit **3/3** `/tmp/pos-transfer-e2e.log`. Old failed CSV va boundary source/compile race yuqorida ochiq yozilgan; final158run ikkalasidan keyin stabil reyestrda o‘tdi. Current source health62 support schema bo‘yicha yangilangan, support fresh62 va browser qabul alohida ketmoqda.

Versiya HEAD44d6849c70f68556bcaebc0279632f440df7aeee + dirty tree. Faqat isolated DB; business DB/deploy/AIcommit/vendorhardware yo‘q. Qayta ijro migrations060/061 + versioned service/routes/TransferReceipt/integration/E2E. Shortage faqat managerning tasdiqlangan yo‘qolgan miqdori; avtomatik taxmin qilinmaydi. Brak ushbu transfer journalida branch bo‘yicha alohida, qaytarma brak journalini o‘zgartirmaydi; umumiy zona/rezerv INV-02.05 ochiq.
aa45d11bb0fddf4bf2972a50f09026be71d7224f6d0b6ad01c053782c00a4683  src/server/inventory/documents.ts
ea8890b5738c2a50dd40de8da9cf7da6b4123b09ce321ee8cb8d5818ddaae222  src/components/inventory/TransferReceipt.tsx
adfbd80104d52383112571fbee9dc2befba590d5c2048179dcfcfe2de417f702  prisma/migrations/202610080060_transfer_dispositions/migration.sql
95ab0fe8555620b5474052772fb785cc845c516e9b4cc7b39ef782c220495179  prisma/migrations/202610080061_transfer_snapshot_guards/migration.sql

### Support yakuniy qabul 2026-10-08

**124→126 done. Faol +20 baseline111dan15/20;5 parent qoldi; maqsad131.** SEC-01.07 va BIZ-02.02 qabul qilindi. Owner/admin biznes roli platforma vakolati bermaydi. Explicit PlatformOperator support/platform_admin ham ownerning aynan shu operator, biznes, filiallar, to‘rt read scope, sabab va1–60min consentisiz targetga kira olmaydi. Biznes HTTP orqali platforma operatoriga aylantirish yo‘q. Password live source session, target branch va grant har read’da qayta tekshiriladi; immutable SQL guardlar, row lock revoke bilan ketma-ketlik, bounded50 no-cost/no-PII DTO. Read va ma’lum grant deny audit commit qiladi; audit failure ma’lumot bermaydi. Original consent/revoke operation retry bitta yozuv, changed payload deny. Owner UI va read-only console paginated; expiry data tozalaydi, revoke keyingi server readni403 qiladi. BIZ-02.01 to‘liq platforma boshqaruvi ochiq.

Dalillar: full core158/158 `/tmp/pos-support-integration.log`; final source focused2/2 `/tmp/pos-support-focused-final.log`; fresh+legacy62 migration `/tmp/pos-support-migrations.log`; unit34/34 `/tmp/pos-support-unit.log`; final typecheck/lint `/tmp/pos-support-{typecheck,lint}-final.log`, build `/tmp/pos-support-build.log` PASS. Chromium/Firefox/WebKit support+transfer+realPWA **9/9**, `/tmp/pos-support-e2e-final.log`. Old browser7/9 run umumiy role=alert Next route-announcerga mos tushgani sababli false-positive edi; errorning aniq revocation matni bilan assertion tuzatildi va hamma9 qayta o‘tdi. Backend deny traces403 edi; production access yumshatilmadi.

Versiya HEAD44d6849c70f68556bcaebc0279632f440df7aeee + ishchi daraxt, migration062 va versioned support service/UI/integration/E2E qayta ijro manbasi. Faqat isolated pos_test va test-only platform record; haqiqiy xodim/business DB/deploy/AIcommit/vendor integration yo‘q. Qolgan5 parent hali bajarilmagan, bu checkpoint yakun emas.

### Narx darajalari — bajarilmoqda, hali done emas

Joriy126done, baseline111dan15/20;5parent qoldi. CAT-01.06 uchun price rule append-only interval, deterministic customer/group/wholesale/retail/store/quantity/date resolution, canonical immutable SaleItem price snapshot, live completion recheck va POS explicit conflict review qo‘shilmoqda. CustomerGroup/assignment narx darajasi uchun qo‘shilgan, lekin CRM-02.01ning duplicate normalization/merge/history talablari hali ochiq; guruh API alohida parent sifatida sanalmaydi. Migration063 birinchi isolated urinishda DDL extractiondan CREATE TABLE tushib qolgani uchun birinchi statementda schema o‘zgarmasdan xato berdi; failed row rolled-back deb qayd qilinib hali applied bo‘lmagan migration tuzatildi, keyin applied. Qo‘llangan063 checksumiga keyin tegilmadi. Focused sinovda cascade FK check tartibi topilib additive064 deferred references va canonical snapshot guard bilan tuzatildi; final focused2/2 PASS. Birinchi advisory-lock SELECT void deserialize xatosi source executeRaw bilan tuzatildi. Full core, fresh/legacy, production build va browser daliligacha CAT-01.06 done emas.

### Mijoz identity va narx — yakuniy sinov ketyapti

Hali126done/15of20. CAT-01.06 focused2/2, full160/160, isolated66dan oldingi fresh+legacy65 PASS, narx/soliq/chegirma/support clean serial browser12/12 PASS. Old parallel-build/integration/browser run11/12 WebKitCONCURRENT_CONFLICT bilan failed; success deb sanalmadi, timeout/assertion yumshatilmadi, DB/browser alohida12/12 qayta tekshirildi.
CRM-02.01 normalized duplicate race, group assignment, immutable settled merge/root+aliases history, partial refunds uchun065 applied. Focusedcustomer+price4/4 PASS; full162dan161pass1large product-export timeout. Aynan failing cap fixture alohida1/1 qayta413 bilan o‘tdi; xato yashirilmadi. Receipt join/customer history/FK validation uchun online indexes rejasida066 birinchi multi-statement CONCURRENTLY file PG implicit transaction sababli hech indeks yaratmasdan rad bo‘ldi. Hali applied bo‘lmagan066 yakka statementga, qolganlari067–073 yakka statement migrationga ajratildi. Applied063–065 checksumlariga tegilmadi. Failed066 row audit/rolled-back va yangi/fresh/legacy verification hali qilinadi. Build/customerbrowser/finalregression daliligacha ikkala parent done emas. Customer valid phone fixture old16digit randomdan valid12digitsga tuzatildi; positive/negative permission assertions saqlandi. Real biznes DB, provider, deploy va AIcommit yo‘q.

### Narx va mijoz yakuniy qabul 2026-10-08

**126→128 done. Faol +20 baseline111dan17/20;3parent qoldi; maqsad131.** CAT-01.06 va CRM-02.01 qabul qilindi; groups/API/testlar qo‘shimcha parent hisoblanmaydi.

CAT-01.06: base100; retailglobal90/branch95,qty9branch95/qty10wholesale80; group85wholesale80danustun; customer70group85danustun, aynanbranchcustomer65global70danustun. startboundary95,1msbefore100,endboundary100. Same-tier interval overlap409, changed idempotency payload409, cashier mutation403, foreignbranch/product/customer404. Immutable rule edit/delete rad; archive retry bitta event. Sale65/cost50 original snapshot, arxivdan so‘ngnewprice70; originalpendingdraftcompletion409/payment0/stockunchanged, oldrefund65. PostgreSQL canonical snapshot/store/customer/rule/price checks va group relationship guards. POS actualreviewbase100→branch90, lost rule acknowledgement→reloadoriginalretry rule1/audit1, checkout90/payment1/stock10→9; archive eski90receipt/cost40ni o‘zgartirmaydi.

CRM-02.01: local/punctuated/international phones canonical; two parallel formatted same phone→200+400,1tenantactivecustomer; creditLimit exact1000.25. Unique phone/org lock+index; old duplicate IDs/phones/statuslar saqlanadi, no guessed winning ID. Owner-only paginated duplicate diagnostics preserves legacy2cards/keycount2, normalized search2, foreign0, admin403; reviewed merge→duplicates0/cards2/originalphonesunchanged. Active/root group assignment, tenant group pricing, futuregroup8.75 vs oldreceipt10.25. Source originaldraft blocks; per-target debt open merge409 +SQLreject; owneronly; sourcemerged inactiveimmutable, root/aliashistorysame originalSale/Paymentcustomer IDs, source/targetforeign404, reactivation/archive409, rawSQLrestoredeny. Auditfault rolls backall. Source cashsale20.50, lostmerge acknowledgement→saved originalretry audit1; partialreturn10.25 aftermerge appears inroot history atpartially_returned, originalprice10.25andpayment2 preserved. Alias has original debtor ledger, no transferred/guessed allocation or negative debt. Root max99aliases/nochain/cycle, outstanding obligations must be settled first; legacy/unallocated histories are preserved.

Dalillar: final full core **163/163** `/tmp/pos-customers-integration-accepted.log`, including all protected133template/186handler inventory. After full163, final structured DELETEmerged guard and group-pagination UI added; corresponding final focused **5/5** `/tmp/pos-customers-focused-final.log` includes DELETE409/role/legacy diagnosis; allothercorebehavior unchanged. Final unit **35/35** `/tmp/pos-customers-unit-final.log` (sandbox run had file-level12passreport; trusted isolated runner reports actual35). Fresh+legacy **73 migrations PASS** `/tmp/pos-customers-migrations-final.log`, explicit oldduplicate2activecards/canonicalNULL preserved and receipt/debt/unit/barcode snapshots unchanged. Final typecheck/lint/build PASS `/tmp/pos-customers-{typecheck,lint,build}-final.log`. Final productionHTTPS Chromium/Firefox/WebKit **18/18** `/tmp/pos-customers-e2e-final.log`: old fullcash/debt/refund/coreworkflow + tax/discount/support + tierreview + customermerge/partialhistory.

Failed runs preserved: firstcustomerfull161/162largeproduct-exporttimeout; samecapfocused1/1allfour413. Subsequentfull161/162 readiness503 while066migrationwasfailed, notclaimedgreen.066multiCONCURRENTfile failed beforeanyindex; rolled-backrecord, unappliedfile rewrittenone-statement +067–073oneeach. All8concurrentindexes then applied/tested, no increase to SQL/test timeouts, no weakening cap assertion. Applied063–065 and aftersuccess066–073 checksums notedited. Indexes support FK/cascades/history/receipt joins; separateone-statement migrations avoid PG implicitmulti-statement transaction. Live rollout remains operator/staging task; no liveindex/realbusinessdelete occurred.

Versiya HEAD44d6849c70f68556bcaebc0279632f440df7aeee + dirtytree. Qaytaijro source: migrations063–073, price-rules/customer-groups/identity services, prices/history/duplicatepages, tests/price-rules.integration/customer-identity.integration+unit/E2E. Onlyisolatedpos_test; no deploy/AIcommit/Click/hardware/fiscalprovider. **Remaining3parent must still be implemented and accepted; this is not final completion.**
1fbbef3174f897c96e0dbc1bb9d85a8c447202a2e80d660f348ced94eb79f015  src/server/catalog/price-rules.ts
75967b442f01ec082cecac99f315be278edd6ab4b144c7871eae026d5e83060d  src/server/customers/identity.ts
2000e1bc5f1cf906644e1f9d8ef164cdb7211bbc3515050ce25ad2acd025ad6c  src/server/sales/service.ts
a2df08d6161262c40772cd25974e12e73cf616580035af79ff47f4995fb866ce  tests/customer-identity.integration.test.ts

### Zona/rezerv core — bajarilmoqda, hali done emas

Joriy128done, baseline111dan17/20; uch parent hali ochiq. INV-02.05 uchun migration074 stock locations/reservations va immutable journals, deferred onHand/zone/reserved/available conservation;075 original unit/precision guard isolated pos_testga qo‘llandi. Existing physical inventory backfill qilinmaydi, zonaga biriktirilmagan hisoblanadi. Server sorted stock locks, exact quantities, tenant/store/live-role, manager reserve/release, exact-basket reserved-sale consumption, expiry worker SKIP LOCKED + system audit. UI reviewed durable relocation/reserve/release va original retry. Birinchi focused1/2da native upsert negative INSERT constraint update branchdan oldin tekshirishi topildi; create0+separate conditional stock-locked update bilan tuzatildi; ayni focused2/2 PASS `/tmp/pos-reservations-focused-final.log`. Full regression, fresh/legacy, worker/build va browser qabul hali tugamagan, hisob o‘zgarmadi. Applied074/075 checksumlariga tegilmaydi. OFF-02.03/.04 hali implementatsiya qilinmagan; hech qanday vendor/hardware yoki real business DB ishlatilmagan.

### INV-02.05 — zona/rezerv yakuniy qabul (2026-10-09)

**128→129 done; baseline111dan18/20. Qolgan ikki parent OFF-02.03/.04; maqsad131.**

Fizik5→zona3/unassigned2. Zonehold2 + ikki raqobatdosh unassignedhold2 so‘rovidan bittasi qabul: reserved4/available1; allowNegative=true ham rezervlangan2ni oddiy sotuvda ishlata olmaydi. Bir xil hold/release/sale original key replay ta’siri bittadan. Rezerv exactbasket2 cash20.50 bilan asl zonadan iste’mol qilinadi: physical3/zone1/reserved2; release→reserved0/available3, fysisk stock boshqa o‘zgarmaydi. Relocation InventoryMovement/Payment yaratmaydi; sellable/brak/rezerv alohida. Brak qaytarma va transfer disposition immutable journalidan yig‘iladi, sotiladigan qoldiqdan chiqarilgan. Physical negative legacy siyosati holds bo‘lmaganda saqlangan. Original unit/precision o‘zgarishi zoned/reserved quantity borligida rad. Foreign branch/SKU/location/session, cashier writes, journal/counter/expiry snapshot rawSQL rewrite rad; audit failure butun rezerv/Operationni rollback qiladi. Server-expiredhold immediately available formuladan chiqadi; scoped worker100/SKIPLOCKED bir expiry journal/system audit yozadi, qayta worker0. Shu sabab expired kvota offline ruxsat degani emas.

Manager UI create/relocate/reserve/release, physical/reserved/available/unassigned/brak counters, paginated reservation/draft history, exact original lost-ack/reload retry. Reserved sale reviewed selected draft + exact stock reservation + actual cash tender; general POS checkout holdni avtomatik ishlatmaydi. Bir filialda100 location technical cap,100 SKU/hold, GET20 headers/page; empty zones defaultlegacyrewrite yo‘q.

Dalil: full core **165/165** `/tmp/pos-reservations-integration.log` including138template/192handler; final unit/precision assertions bilan focused **2/2** `/tmp/pos-reservations-focused-final.log`. Fresh+legacy **75 migrations PASS** `/tmp/pos-reservations-migrations.log`; worker build PASS `/tmp/pos-reservations-worker-build.log`. Unit **37/37** `/tmp/pos-reservations-unit.log` (ikki yangi crypto unit offline parentlarni yopmaydi). Final typecheck/lint/build PASS `/tmp/pos-reservations-{typecheck,lint}-final.log`, `/tmp/pos-reservations-build.log`. Production HTTPS Chromium/Firefox/WebKit **9/9** `/tmp/pos-reservations-e2e.log`: stock-zone lost reservation acknowledgement→reload originalretry1/audit1→release no economic movement, previous price tier and customer historical merge/refund regression.

Old focused failure negative native upsert INSERT check fixed, unchanged assertions final2passed. BigInt literal compile target failure yangi offline utilityda BigInt(...)ga moslandi; TS target/strictness/testlar yumshatilmadi. Applied074/075 immutable. Version HEAD44d6849c70f68556bcaebc0279632f440df7aeee + dirtytree; onlyisolated DB, no deployment/AIcommit/livehardware/API. OFF-02.03/.04 hali ochiq; source crypto/store code implementation boshlanishi qabul emas. +20 hali tugamadi.
47f1549a41457738838457be64bee7a7c068196d2980e2c97965fc20e7135da0  src/server/inventory/reservations.ts
83a67ea4ac0e689fcf96af73c22943a133976e1d0d0649b1f742e266ad408c0b  src/server/inventory/movements.ts
b9c3b6e8c2a494c7872888d328f3be34ea0f0184e903731b92c8db7cb28f5a86  tests/reservations.integration.test.ts

### Offline cash — joriy implementatsiya, hali done emas (2026-10-09)

Jami129done, baseline111dan18/20; OFF-02.03/.04 hali ochiq.076..078 faqat isolated bazaga applied. Ownerning defaultdisabled branch-wide unresolved-cash summa limiti va30–300s explicit siyosati; own parked draft + current register/shift/user/session/device, fixed original cash operation, Ed25519 immutable signed ticket, source SKU exact reserve. Offline debt/card/transfer yo‘q. IndexedDB ticket AES-GCM/PBKDF2 unlock phrase serverga yuborilmaydi; original issuance resultdan lokal ack faqatleaseID, successful sale ack ham minimal receipt metadata, cost/PII snapshot yo‘q. Public shell staticcode-only, API/privateNextHTMLcacheyo‘q; local same-ticket cash claim IDB lease/actions bitta transactionda. Reconnect source livecontext/role/session/price/tax/policy/shift/customer/expiry validates before single cash/payment/stock transaction. Owner physical goods/cash reconciliation closes unknown ticket and voids original draft, old queued payment cannot repost it. No fake provider/hardware.

Muhim077: cash-ticket expiry authorizationni to‘xtatadi, ammo noma’lum offline tovar avtomatik availablega qaytmaydi. Cash-ticket hold pul/tovar haqiqatan hal qilinmaguncha saqlanadi; faqat manual reservations expiry worker bilan bo‘shaydi. Old INV-02.05 expiry protokoli manual holds uchun; yangi cash-ticket uncertainty bilan bu qoida kengaytirildi. Shift unresolved lease borida, expiry bo‘lsa ham, yopilmaydi.

Focused offline4+reservation2 **6/6** o‘tdi; canonical signature JSONB key-orderga bog‘liq emas. First browser6dan2pass/4fail: lost-ack network error inglizcha raw fetch matnida original saqlangan xabar yo‘q edi; UXga original amal saqlangan matni qo‘shildi. WebKit real worker reload `context.setOffline`da internal browsererror berdi; test-only disposable TLS transport-cookie server socketoutage ishlatilmoqda, production CSP/offline authorization yumshatilmadi. Source-context fixture closed shiftni reopen qilgani SQL immutable guardda rad bo‘ldi; test closed holatni saqladi. Inactive/revoke assertion existingSESSION_CHANGEDcontractga moslandi. Final full regression, migrations/browser qabul ketmoqda, hech biri success/done deb taxmin qilinmaydi.

### OFF-02.03 / OFF-02.04 — offline cash yakuniy qabul (2026-10-09)

**129→131 done. Faol +20 so‘rov: baseline111→131, aynan20 yangi PLAN1 parent band qabul qilindi.** Tarixiy checkpoint, test yoki yordamchi subtask qayta sanalmadi. SEC-01.04 exhaustive semantic role matritsasi, tashqi provayder/hardware, real hosting/pilot/huquqiy qabul hali o‘z bandlarida ochiq. Bu butun loyiha productionga deploy qilindi degani emas.

**OFF-02.03 — kirish/kutilgan/haqiqiy natija:** fizik stock5, ikki haqiqiy register/device bir SKUdan4tadan parallel rezerv qiladi. Bitta ticket/hold4 muvaffaqiyatli, ikkinchisi insufficient available bilan rad; available1, stock5. Filial jami unresolved quota25: bir ticket20.50dan keyin10.25lik ikkinchisi rad. Scope/SKU/amount/signature original sourcega bog‘liq, boshqa device/organization/key yoki o‘zgargan quantity rad. Offline native naqd20 uchun10.25 savdo/change9.75 lokal pending; server payment0/stock5, ikki tabdan original claim faqat1. Reload va real server transport outage cached public shell bilan ishlaydi. Reconnect yoki lost-ack recovery bitta payment, bitta stockmovement, stock4 va no debt; original operationId saqlanadi. Xatolar alohida SyncReview/local conflictda qoladi. Authorization expiry cash holdni avtomatik bo‘shatmaydi: noma’lum tovar qayta sotilmaydi; actual cancel yoki verified owner settlement kerak. Cash holdli SKU count/opening/adjustment va unresolved shiftclose blok.

**OFF-02.04 — kirish/kutilgan/haqiqiy natija:** server issued Ed25519 quote30–300s, source session absolute/idle expiryidan uzoq emas; owner explicit policy, defaultdisabled. Unit test expiry exact boundary, clock rollback va other device failclosed. Server signed-past source fixture expiry bilan payment/stock yaratmaydi; worker cash holdsni saqlaydi, manual expiry oldingi INV kontraktiga mos ishlaydi. Changed price/tax/rule, disabled policy/customer/staff, revoked/changed session/role, closed shift va source scope rad, original audit/hold/stock/payment o‘zgarmaydi. Strict cash commandga credit/card/arbitrary basket field yuborish mumkin emas; offline debt umuman yaratilmaydi. Offline revoke darhol yetishmasligi explicit amount/stock limit va qisqa TTL bilan cheklanadi, reconnect live authorization majburiy. Native AES-GCM/PBKDF2 encrypted IndexedDBda unlock phrase/PII/cost saqlanmaydi; wrong phrase/signature/tamper rad, API/privateHTML/Nextchunks cachega kirmaydi.

**Haqiqiy noaniq savdoni hal qilish:** egasi actual goods returned/notdelivered va net cash refunded/never received proof bilan draftni void qiladi; eski queued payment sourcega qayta post bo‘la olmaydi. Mijoz tovar bilan ketgan bo‘lsa, boshqa actual live owner ham asl signed davr ichidagi kuzatilgan vaqt, goods+cash, tender, evidence va sababni tekshirib `/settle` qiladi. Bloklangan original actor impersonation qilinmaydi, original cashier saqlanadi; actual owner receivedBy/audit actor. Current price11/cost9/archivedproduct bo‘lsa ham verified original quote10.25/cost4 saqlanadi, completedAt hozirgi server vaqti. Replay1payment/1movement, audit failure normal syncda butun transaction rollback; owner proof keyin immutable. Original expired sync operation uchun fake commit yo‘q; SyncReview owner terminal evidence bilan resolved. Keyingi real refund10.25 stockni5ga qaytaradi, ordinary refund journal ishlaydi. Browser owner confirmation original reviewni ko‘rsatadi; settlement lost acknowledgement/reload original keyni qayta tekshirib bitta receiptga olib keladi.

**Yakuniy tekshiruvlar, faqat disposable pos_test:**

- `DATABASE_URL=<isolated> npm run test:integration`: **171/171**, exit0; `/tmp/pos-offline-integration81.log`. Boundary inventory143templates/198handlers. Full run schema/service exports stable bo‘lgach boshlandi.
- Focused compile + `node --require ./scripts/test-resolver.cjs --test --test-concurrency=1 .test-build/tests/offline-cash.integration.test.js .test-build/tests/reservations.integration.test.js`: **8/8**, exit0; `/tmp/pos-offline-owner-focused3.log`. Full171 ham shu final service/migrationlarni tekshiradi.
- `npm test`: **38/38**, exit0; `/tmp/pos-offline-unit81.log`.
- `bash scripts/ops/test-migrations.sh`: **81 migration fresh + legacy035→81**, exact original allocation/debt/barcode/unit/price/disposition/variant/identity backfills PASS; `/tmp/pos-offline-migrations81.log`.
- `bash scripts/ops/test-backup.sh`: encrypted bundle/config/files+dummy recoverysecret, confirmedempty restore,81migration records/source economic counts, scoped authenticated ledger/count/image recovery, existing-table guard PASS; `/tmp/pos-offline-backup81.log`. Fixture RTO10s/RPOloss0; real hosting SLA emas.
- `npm run typecheck`, `npm run worker:build`, `npm run lint`, `npm run build`: exit0; `/tmp/pos-offline-type81.log`, `/tmp/pos-offline-worker81.log`, `/tmp/pos-offline-lint81.log`, `/tmp/pos-offline-build81.log`. Existing TypeScript compiler `prebuild` native three public modulesni chiqaradi.
- `DATABASE_URL=<isolated> PLAYWRIGHT_BROWSERS_PATH=/tmp/pos-playwright-browsers POS_E2E_ALL_BROWSERS=1 npm run test:e2e -- --grep 'Offline signed cash|Offline issuer|Owner reviews a changed-price|Stock zone UI|PWA private catalog|Configured tax UI|Discount UI|Sync conflict requires manager|Manual bank refund UI'`: **27/27**, Chromium/Firefox/WebKit, exit0; `/tmp/pos-offline-browser81.log`. Real worker transport outage, encrypted reload/wrong phrase/tamperedquantity/twotab, issue/sync/owner-settlement lostack va old tax/discount/manualrefund/reservation regressions.
- `git diff --check`: exit0. `.env`/`.env_backup` o‘qilmadi, hech qanday real API/hardware/live DB/deploy/AIcommit ishlatilmadi. Normal build environment autoload original loyiha mexanizmi.

Owner-focused birinchi testda runOperation JSON resultidagi completedAt string Date bilan bevosita solishtirilgani false bo‘ldi; test actual ISO vaqtni Datega parse qilib accounting-now invariantni saqladi. Sandboxdagi local TCP testlar ulanish cheklovida yiqilgan run acceptance emas; approved isolated connection bilan focused8 va full171 o‘tdi. Old browser6dan4failure UX/testtransport sababi yuqoridagi tarixiy checkpointda; final27 actual assertions bilan o‘tdi. Testlar va production permissions yumshatilmadi.076..081 applied checksumlar tahrirlanmadi;081 owner evidence missing-key SQL NULL semantics uchun alohida migration.

Faol +20 qabul IDlari: DATA-01.09, CAT-01.01, SEC-02.08, USR-01.04, FIN-02.07, FIN-02.02, RET-01.03, POS-02.06, SEC-01.02, OPS-03.02, USR-01.05, OFF-02.01, INV-01.04, SEC-01.07, BIZ-02.02, CAT-01.06, CRM-02.01, INV-02.05, OFF-02.03, OFF-02.04. Oldingi18ning individual test/versiya protokollari yuqorida saqlangan.

Versiya: HEAD `0bb58a44212068f8bfaeb592d7473e5cce94ed9d` + shu ishchi daraxt. AI commit yaratmagan. Quyidagi SHA256lar tekshirilgan source versiyalaridir:

```text
8b08592eb1f86f5e5e748227532ffefb39bf868d35c8c9bf04fd33f17c15bc7d  src/server/offline/cash.ts
fff7dc32eee80affc7abcd18c4c09b88c06a71079b35d8e10f5f1b841ae4affa  src/server/sales/service.ts
2fa70092cf7587fa3cf341a7935202027591e1f4aabd1dd85809789631c80dda  src/server/inventory/reservations.ts
ce37bd2b85ddadb51bd30a4f88d8e341ca686ba45b4e5fcce45335a7dd54d103  src/server/inventory/movements.ts
6c521e3aa15a73da4e7f887b6d0b8de33ab05b97fda68701addbd53487fbcf6b  src/server/sync/reviews.ts
bd0b91d5a14f898f278a21d1f697d801c5af860cf5c9055c848c80b06bfb3773  src/lib/offline-cash-crypto.ts
bce26a9fd356f8ae7ade2c0d65139b87fdf67af272fab433652af6535e11e184  src/lib/offline-cash-store.ts
2fe16d9c1ea99bca5bc5236f65f42fbd20ca541864a126f7112686b522144cbe  src/offline/cash-screen.ts
8f9fae7de645cbf3eb7718576ec6fd4f0f2d6feb9b2cb0d0847741a9ddec13dd  tests/offline-cash.integration.test.ts
efb93c6cc734dab984dfe1a3188dfbc7e1cec1070b1436896b6b75c521d51c79  tests/e2e/core.spec.ts
131c11e15fb3406c53624c9bf1d438d5515c7e5aaa29d47467d4ffcf9c375c61  prisma/migrations/202610090080_offline_owner_settlement/migration.sql
d9e983a26fa68edc019ff6709d7924e343f5650d1b9e7f7af5ac84127ecf6627  prisma/migrations/202610090081_offline_settlement_proof_guards/migration.sql
```

### Yangi +20 so‘rov — boshlanish (2026-10-09)

Baseline **131 done**, yangi maqsad **151 done**. Oldingi111→131 yigirmatalik qabul qayta sanalmaydi. Hozir **0/20** yangi qabul. Katalog import/export/onboarding, ombor tracking/valuation, xarid/customer/return business logic, UX va ichki security/worker vazifalari bo‘yicha yangi dalillar tayyorlanadi. Tashqi vendor/hardware/SMS endpointlari taxmin qilinmaydi, live business data va `.env` o‘qilmaydi. Bandlar actual qabul mezonlari bajarilmasdan `done`ga o‘tkazilmaydi.

### CAT-01.08 — CSV / Excel import va eksport qabul (2026-10-09)

**131→132 done; yangi +20 baseline131dan1/20. Maqsad151, yana19 parent band ochiq.**

Kirish: CSV5row (2valid, duplicateSKU, invalidprice, unknownunit), aniq leading-zero barcode va90071992547409.123456 cost; XLSX1000row. Kutilgan/haqiqiy: preview product/audit/Operation0; reviewed valid2 created, error3 explicit report; same-key parallel replaycreated2/audit1/Operation1, changed payload409. Exported Excel boshqatenant own owner importiga2valid va exact cost/alias;1000qator truncate emas, stock/payment0. Stale preview yangi SKU bilan409; live actualadmin/cashier403, revoked-session409; late audit failure barcha product/barcode/Operationni rollback qiladi. Active formula/object/multi-sheet/malformed/oversized row/workbook unitda rad. Owner UI lostack/reload originalintent bilan product1/importaudit1/Operation1; Excel download1.01 va0.333333 exact string; old zone/offline naqd regressiyalar saqlangan. Preview persistent staging yozmasdan read-only; PostgreSQLda final import row/source/result proof mavjud Operation+audit bilan saqlanadi (ADR048).

Dalillar: `npm run test:integration`174/174, `/tmp/pos-import-integration-final.log` (146templates/201handlers); runtime resolver fixdan keyin `npm test`40/40 va focusedimport3/3 `/tmp/pos-import-unit-runtime.log`, `/tmp/pos-import-focused-runtime.log`; typecheck/lint/build exit0 `/tmp/pos-import-{type,lint,build}-runtime.log`. Native ExcelJS `.next/standalone/node_modules/exceljs/excel.js` traced. `POS_E2E_ALL_BROWSERS=1 npm run test:e2e -- --grep "Catalog CSV import|Stock zone UI|Offline signed cash"`9/9 Chromium/Firefox/WebKit, `/tmp/pos-import-browser-runtime.log`. Full DBsuite171→174; no new migration for import, current81 remains. Only disposableDB, no deployment/vendor/hardware/env read/AIcommit.

Birinchi unit compile async callbackda await syntax errorni ko‘rsatdi, tuzatildi. Birinchi browser9dan6pass/3fail: Turbopack require.resolve moduleIDnumberni Workerga yubordi. Node createRequire runtime nativepath va traced external dependency bilan tuzatildi; assertions unchanged, final9passed. Failure qabul dalili deb sanalmadi. Sharp0.35.5/source-map-js1.2.2 auditpatchlari backend/build/image-regression bilan tekshirildi; boshqa dependency/security release findinglar QA-01.08ni avtomatik yopmaydi.

Versiya HEAD 0bb58a44212068f8bfaeb592d7473e5cce94ed9d + dirty tree, SHA256:

```text
f79f69225a433c4b1976d4ae3fb098ae568156e39185b449600504871d545e07  src/server/catalog/imports.ts
232660121e40593cf318f3dbb556dfdb78681b0461a5a481a5abfbb789258260  src/server/catalog/spreadsheets.ts
0e8618c993510de8008fabdf2c852327638e3bcaf7de61ee9a2daa37ac6a9af1  src/server/exports/xlsx.ts
d2f45d4d112ee9ed9c014872d1b5f62119ff341966b7a50826e5a0573c52722b  src/app/(dashboard)/products/import/page.tsx
a54b3d884efb3da00cefcd025db2afc66dfaa2b6001a3131c80ab601494c3379  tests/catalog-import.integration.test.ts
6a6bd9d86ddcce26864db12f31fb7cc5a3c3cbc3a5a539eebc11fd0bfbc79e50  tests/catalog-import.unit.test.ts
1139297b373c4ea282dd5fda7320458d7a832b758011f1ea830e67e764b16592  package-lock.json
```

### UX-01.01 — onboarding ishlab chiqilmoqda, hali qabul emas

Yangi +20 hisobi1/20/jami132. OnboardingCheckpoint82 migration faqat disposableDBga applied, serverda6bosqich immutable proof/actor/time+operation/audit. Bosqich source actual organization/register/import/opening/cashier/normalcompleted sale bilan tekshiriladi, oldingi checkpointlarsiz skip rad. Source keyin blocked bo‘lsa progress joriy invalidni ko‘rsatadi; eski tasdiq rewrite bo‘lmaydi. Worker/provider/hardware yoki avtomatik fake trial sale yozilmaydi. Existing /training faqat isolated local mashq, actual checkout odatiy physical/money journals. `/onboarding` owner wizard, scope remount, durable original confirmation/recovery.

Focused2/2 actual coreflow va auditrollback/scope/role/immutablehistory o‘tdi `/tmp/pos-onboarding-focused3.log`. Initial test fixture typed missing discountAmount/organizationId compilefail dalil sifatida qabul qilinmadi, required fields qo‘shildi. Full regression/migrations/backup/build va actual owner wizard uchbrowser qabul ketmoqda; parent hali done emas.

### UX-01.01 — onboarding qabul (2026-10-09)

**132→133 done; yangi +20 baseline131dan2/20. Maqsad151, yana18 band.**

Kirish: yangi owner, filial/kassa, CSV orqali1SKU(1.01 narx/0.333333 tannarx), boshlang‘ich5dona, shu filialga assigned cashier, isolated training va odatiy naqd POS savdosi. Kutilgan/haqiqiy:6ordered checkpoints, trainingdan Sale0; actual sale1/payment1/stock4; checkpoints/audit6. Lost checkpoint ACK/reload original key recovery1; old checkpointdan keyingi stage tiklandi. DraftSale readyfalse, skip409, boshqa tenant/actualadmin/cashier rad; register bloklanganda confirmedtrue/completefalse, immutable proof/history; audit xatosida checkpoint/Operation0.

Dalillar: full176/176 `/tmp/pos-onboarding-integration.log`; fresh+legacy82 `/tmp/pos-onboarding-migrations.log`; encrypted restore82 `/tmp/pos-onboarding-backup.log` RTO6s/fixtureRPO0. Native runtime resolverdan keyin focused5/5 `/tmp/pos-onboarding-focused-native.log`,40unit `/tmp/pos-onboarding-unit-native.log`, type/lint/build exit0 `/tmp/pos-onboarding-{type,lint,build}-native.log`. Browser6/6 Chromium/Firefox/WebKit `/tmp/pos-onboarding-browser-native.log` import+orderedwizard+original recovery+actualPOS. Workerbuild old core regressiya exit0 `/tmp/pos-onboarding-worker.log`.

Dastlab browser5pass/1fail Chromium sibling durableintent race; revision key remount bilan fixed. Default Turbopack localport OS1; Next hujjatdagi Webpack build used, production config o‘zgarmadi. Birinchi Webpack browser import failed: bundler moduleID rewrite; native Node builtin resolver bilan fixed, final6pass. Bu failures done deb sanalmadi. DB82 applied migration immutable. No liveDB/deploy/vendor/hardware/.env read/AIcommit. Versiya HEAD0bb58a44212068f8bfaeb592d7473e5cce94ed9d+dirty tree.

SHA256 onboarding qabul versiyasi:

```text
792bb2da2be882d596e787be679c3977d01e2283070e4fb4c58f17d63f9b8c09  src/server/onboarding/service.ts
918408e4e1d9384b0f63c5cb75fbf7351b4f272fa65769b08e4eaa0dae8d15d5  src/app/(dashboard)/onboarding/page.tsx
595c16c24c76f96209c5c555461908cec9829a61222f42630d4728b80c9a7155  prisma/migrations/202610090082_onboarding_checkpoints/migration.sql
233f674f0c422206580c83ac7ee47dfebc38cb41b7382b2e2c30a0951d600eb7  tests/onboarding.integration.test.ts
adbb285b304cb311485c10b96ebf03ff994eb751b1e83984ce48ae668def581b  src/server/catalog/spreadsheets.ts
```

### RET-01.08 — atomic exchange ishlab chiqilmoqda, hali qabul emas

Yangi +20 hisob2/20/jami133. Original return/replacement sale relations uchun83 migration disposableDBga qo‘llandi. Mavjud createDraft/returnSale wrapperlari saqlanib Tx funksiyalari ajratildi; naqd/nasiya quote va transaction service, owner/admin forma/history/recovery qurilmoqda. Native gross journalsning net farqi actual physical tender/change bilan exchange hujjatida ajraladi; original/new sale tenderiga taxminiy full amount yozilmaydi. Stock/credit fail ikkala yangi hujjatni rollback qiladi. Tests, fresh/legacy migrations va uchbrowser qabul hali tugamagan; done emas.

### RET-01.08 — atomic exchange qabul (2026-10-09)

**133→134 done; baseline131dan3/20, maqsad151, yana17 parent band.**

Kirish: original10.01 naqd/nasiya, replacement12.03, physical tender5.00; cheaper replacement5.01; asli cashier/owner/admin sessiyalari, bir branch/smena. Kutilgan/haqiqiy: diffCash2.02/change2.98, debtDiff2.02/currentDebt12.03; cheaper diff−5/refundDue5/tender0. Gross cash journals actual netcashga teng; replacement.cashTenderedNULL. Parallel original replay exchange1/return1/replacement1/operation1/audit1. Oldcost3.333333/newcost4.444444 va stock10/9 saqlanadi. Stale narx409; foreign404, actualassignedadmin success/actualcashier403, revokedsession401. Yetarli stock yo‘q yoki late auditfaultda return0/replacement0/advance journal0/Operation0; original sale/payment/debt/stock untouched. Immutable exchange update rad.

Dalillar: `/tmp/pos-exchange-integration.log`179/179 barcha old native refund/credit/stock/tax/offline regressiyalar; qo‘shimcha actualadmin/cashier+lateaudit kiritilgach4/4 `/tmp/pos-exchange-focused-final.log`. `npm test`40/40 `/tmp/pos-exchange-unit-final.log`. Fresh/legacy83 `/tmp/pos-exchange-migrations.log`. Workerbuild/type/lint/build exit0 `/tmp/pos-exchange-worker-final.log`, `/tmp/pos-exchange-{type,lint,build}-ui.log`. Browser9/9 Chromium/Firefox/WebKit `/tmp/pos-exchange-browser-ui.log`: original unknown ACK/reload/key once, linked replacement receipt actualtender/history, ordinary manualbankrefund va onboarding6step actualsale.

Initial Prisma client stale generation va test async callback compile xatosi tuzatildi; failure qabul emas. Birinchi browser exchange products query requiredorganizationIdni tashlab yuborgani ko‘rsatdi; own org query bilan fixed, assertions unchanged/final9passed.83 applied migration immutable. Taxminiy vendor/hardware/Click/liveDB/envread/deploy/AIcommit yo‘q. Versiya HEAD0bb58a44212068f8bfaeb592d7473e5cce94ed9d+dirty tree.

```text
407f9b12654046a93a8225d14792cba7a0860bdfa30cbf159f441d27dd36e9ea  src/server/returns/exchanges.ts
948d799ca538eb554f112d8abf3c1a956bb73588dad00e4fda4a1100102ff599  src/server/returns/service.ts
4dfe1dc90c55d99bfa3389aa96444dd3415ba345d1956e5bb7f2593ed605413b  src/server/sales/service.ts
fb40f3114611a8b9147be46293bf9ee878f85862bed24a13698c51eb9591f7f4  src/app/(dashboard)/sales/[id]/exchange/page.tsx
a4856f3ae2d3788f67f1ed5016b17005ca187d24570fd7e998102e80f1f47bdd  src/components/pos/ExchangeHistory.tsx
e5db3191919d24746a011edee7e373c66ce0aab6a54e51ecc202554ae2993d2c  prisma/migrations/202610090083_sale_exchanges/migration.sql
b132be54e3d1bb43e8e6ea6848a73e215d366a58369051a2c631f124deb5eb8f  tests/exchanges.integration.test.ts
f7551aaedf48db2b807e87abff0c8738d4adfe0dafd22759dd5cac5ad7a454a9  tests/e2e/core.spec.ts
```

### OPS-02.04 — fon navbati qabul yakunlanmoqda, hali done emas

Yangi hisob3/20/jami134. BackgroundJob/JobAuthorization/JobEvent84 migration applied onlydisposableDB, immutable source va actual owner proof. Native Node worker va owner/jobs UI implemented;3focused/183full PG/84freshlegacy/6browser(real compiledworker exhaustion+manualretry+exchange)/encryptedJobHistory restore passed. Quota20/rate429/size413/unknown-kind bo‘yicha qo‘shimcha qabul testi yakunlanmoqda. Birinchi test block sintaksisi vaAPI withApi context typecompile xatolari fixed; browser birinchi filial hydration typed reasonni yo‘qotgani corrected. Finalqabul olmadi degan bandni countga qo‘shmaymiz.

### OPS-02.04 — PostgreSQL fon navbati qabul (2026-10-09)

**134→135 done; baseline131dan4/20, maqsad151, yana16 parent band.**

Kirish: original owner queue/current branch, concurrent claim2, leaseexpiry→newclaim, samekey enqueue/retry,3actual auditfaults, slow7sDB scan +5sautoheartbeat +midwork sessionrevoke,20active-job boundary va actorAPI5/min. Kutilgan/haqiqiy: claim1, oldlease heartbeatfalse/resultfalse/Incident0; original source in-memory scope o‘zgartirilsa ham onlyselectedbranch Incident1/systemaudit1. Attempts3dead/visible; replaymanualretry generation1/authorization2/Operation1/audit1, worker succeeds once, historicalattempts kept. Current session revoke oldjobdead/AUTHORIZATION_CHANGED, actualadmin/cashier403, foreign404, expiredqueuecancelled/noeffects. Autoheartbeat actuallyticks before7squery ends; midrunrevoke rollsback allIncidents/systemaudit. Capacity19→parallel2 exactly1accepted/1JOB_LIMIT; replayoldkeynoadditionaljob. NativeHTTP5success→429RetryAfter, oversized413, unknownexternaltype400/nojob.

Dalillar:183/183full `/tmp/pos-jobs-integration.log` (3initialjobtests+4exchange); final5/5 includingquota/slowrealheartbeat `/tmp/pos-jobs-focused-heartbeat.log`;40unit `/tmp/pos-jobs-unit-heartbeat.log`.84fresh/legacy `/tmp/pos-jobs-migrations.log`; worker/type/lint/build exit0 `/tmp/pos-jobs-worker.log`, `/tmp/pos-jobs-{type,lint,build}-ui.log`; extraquota type/lint0 `/tmp/pos-jobs-{type,lint}-quota2.log`.6/6 Chromium/Firefox/WebKit `/tmp/pos-jobs-browser-ui.log`: actual compiledproductionNodeworker3faults→dead→ownerlostretryACK/reload→worker success1 +oldexchange. Encrypted deadjob/source-session-authorization/event restore `/tmp/pos-jobs-backup.log`: migration84/RTO11s/fixtureRPO0/economiccountsunchanged/overwriteguard.

Initial test brace/handler-context typecompile failures tuzatildi. Initial browser60stimeout reason typed beforestore hydration thenkeyremount erasedinput; wizardorg/user scope and actualstoredbranchname review fixed, final6passed.84 applied migration immutable. No realhosting/deploy/vendor/hardware/envread/AIcommit. HEAD0bb58a44212068f8bfaeb592d7473e5cce94ed9d+dirty tree.

```text
3768265726df3f3a22bb6fa402480b08fd9ac45445b334178022c263e7a5f77c  src/server/jobs/service.ts
9811ec70a75386e22030410eb85fe127e526e86e402411e3a45ca98f6cecebb2  scripts/workers/jobs.ts
769bd7fba34ed62f915bff72844c1b176ed9ad57a4dbb690f8f3c113bdd566c8  src/app/(dashboard)/jobs/page.tsx
a414633944e6ff1a98c1d96fc1c6f0a4569947d55370006f1155423668ef2526  prisma/migrations/202610090084_background_jobs/migration.sql
dfe5c5c71297df17131ac605dd1e555bec093f5e9ffed290d17a60fde6e2c192  tests/jobs.integration.test.ts
d057a089bb5951a9b7aa001862fda968c912ac9658bc709c681b01b54009b3aa  scripts/ops/test-backup.sh
e378f853f4e7d042ccadb123292b78859eb8302c6d40e228f9b9723f26885926  scripts/ops/verify-restored-app.mjs
```

### Joriy topshiriq doirasi: faqat bitta vazifa (2026-10-09)

Oxirgi foydalanuvchi ko‘rsatmasi oldingi +20 maqsadini shu bosqich uchun almashtirdi. Baseline135, maqsad136: faqat SEC-02.09. Xavfsizlik hodisalari/sessiyalar tarixi va ichki shubhali kirish bildirishnomasi qabuldan o‘tmaguncha done hisoblanmaydi.

### SEC-02.09 — xavfsizlik hodisalari va ichki bildirishnomalar qabul (2026-10-09)

**Faqat bitta yangi parent vazifa bajarildi:135→136 done. Oxirgi “faqat1ta vazifa” topshirig‘i1/1 tugadi. Boshqa parent statuslar o‘zgartirilmadi.**

Kirish: actual owner parol loginlari, bir brauzer hinti takrori va yangi browserUUID, parallel3invalidpassword,6thratelimit, source session revoke, ikki concurrent Node delivery, actual cashier scope, sourceSession/job FKhold, expired event va actual password change. Kutilgan/haqiqiy: firstknownbaseline noalert; newhint suspicious outbox1/inbox1/systemaudit1, revoked original session deliveryni to‘smasligi. Noto‘g‘ri parollar401 va failure auditactorNULL, uchinchidan suspicious, UTC15min bucketda1notice;6th429. Actual own account barcha bizneslardagi safehistoryni oladi; foreignaccount notice404, revokedcaller401. Token/hash/rawdevice/UA/phone/password/IP javob/history/auditga chiqmaydi. DefaultactiveSession behavior/PIN8h/password24h saqlanadi; explicitall/revoked/expired history90kun. UnreferencedSessiondelete immutable snapshotni o‘chirmaydi; financial/job-heldSession FKsaqlanadi.

Late login auditfaultda session/lastLoginAt/loginEvent rollback. Delivery auditfault3dead, inbox0; faulttuzalgach ownaccount paralleloriginal retry bitta Operation/audit bilan +3budget(old attempts3 preserved), nativeworker inbox1. Retry onlydead, max30; foreign/expiredsource va revokedcontext rad. SecurityEvent/Notice/source immutable SQL;90kun expiry faqatsecuritymetadata+outboxni o‘chiradi, pendingexpiry systemauditga yoziladi, sourceSession/JobAuthorization/moliyaviycounts untouched. Headerning passivGETi idledeadline’ni uzaytirmaydi, expired401; explicit normalSessionactivity touchni saqlaydi.

Dalillar: `npm test`40/40 `/tmp/pos-security-unit-final2.log`. `DATABASE_URL=<isolated127.0.0.1:55439/pos_test> npm run test:integration`191/191 `/tmp/pos-security-integration-final.log`, APIinventory155templates/213handlers;6securityintegrationtest shu fullsuite ichida (focused6/6 `/tmp/pos-security-focused-retry.log`, budgetfenced fixdan keyingi full191 yakuniy). Typecheck/lint/workerbuild/Webpackproductionbuild exit0 `/tmp/pos-security-{type,lint,worker}-final2.log`, `/tmp/pos-security-build-final.log`. NextdefaultTurbopack sandbox localport cheklovi uchun hujjatdagi Webpack flag ishlatildi, defaultdeploybuild o‘zgarmadi.

`86`fresh+legacy migrations `/tmp/pos-security-migrations-final.log`; encryptedrestore `/tmp/pos-security-backup-final.log`: security event/pendingoutbox+deadjob/sourceSession+stockfreeze+debt+protectedimage recovered, economiccountsunchanged, RTO7s/fixtureRPO0, existingDBoverwriteguard. `POS_E2E_ALL_BROWSERS=1 npm run test:e2e -- --grep 'Security history|Background jobs UI'`6/6 Chromium/Firefox/WebKit `/tmp/pos-security-browser.log`. Actual browserformdeviceB login, actual compiledproductionNodeworker deliveryfault3dead→UIoriginalretry lostACK/reconcile→workeronce inbox1, readACKlost→GETreadAt/Operation1/badge1→0, reload/actualrevokedSessionhistory; oldjobsworkerretry regression ham passed. Native delivery toaffected ownaccount, tashqi servisga so‘rov yo‘q.

Review yangi tuzatishlari: deadalert uchun retry yetishmasligi086additiveguard/service/UI bilan; loginresponse oldrole snapshoti transactionrole bilan; passivpoll idleuzaytirishi gateway+handler no-touch bilan tuzatildi va test qilindi. Applied085/086 migrationlar o‘zgarmas. Qabuldan oldingi190tests/85restore final86/191dalil o‘rnida ishlatilmadi. Realhosting/liveDB/deploy/vendor/hardware/envread/AIcommit yo‘q. Productionda existingjobsworker ishga tushirilishi kerak; OPSexternalhosting/MFA/reset alohida ochiq bandlar.

Versiya HEAD0bb58a44212068f8bfaeb592d7473e5cce94ed9d+dirtytree. Qabul sourceSHA256:

```text
eefb55f38769de7e631ece6d08e0d62cc1d02f0a4538c1e1009e01ce5ea417b4  src/server/security/service.ts
6995858223745994f9b00c11a0a9d5b42db5813a9f2d0df200fe88960940e083  src/server/auth/session.ts
2af5844a56c72cb6e570744c2e4d1b972b950410602a38557bca48495fdeb97b  src/app/api/auth/login/route.ts
4ee8e062c7b2a8716438234238e0ff53a3dfa506d61189acbea71fced0e0ecfa  src/components/security/SecurityHistory.tsx
03067a2d4c9b2540fe9f41f0657db3cfa4218fa9590d26a91e6a903bc5f18455  src/components/security/SecurityNoticeBadge.tsx
25c96024ec67df50fcba598d46727e3f036b83011188df2e48214cea5d73807d  prisma/migrations/202610090085_security_events/migration.sql
61b2658d937df27717fc2b4788705c27ff1950159b3472f2eca5acefc8614a37  prisma/migrations/202610090086_security_notice_retry/migration.sql
89a950325786847d0a9d9d3a3bd709c04141a04e1fd3e9fac6cce1a08f8cc537  tests/security-events.integration.test.ts
a75c2abf8dd961dab1ced97bc626dd6621d93dc025cb6827ae8f8ee5bd358c5a  scripts/workers/jobs.ts
```

### Yangi +20 topshirig‘i (2026-10-09)

Baseline136, maqsad156: yangi20ta original checklist bandi. Model/scenario/stage yoki yangi subtasklar hisobni to‘ldirish uchun checklist vazifasi o‘rnida sanalmaydi. Tashqi hardware/Click/fiskal integratsiyalar bo‘yicha oldingi taqiq saqlanadi. CAT-01.09 ishlanmoqda: owner manual classification/source/tax flags va marking fail-closed boundary; tax/MXIK zarur bo‘lsa missing bilan checkout0, oddiy goods unchanged, original frozen snapshot. Qabul va testdan oldin done emas.


### +20 — 1/20 qabul: CAT-01.09

Baseline136 →137 done. Test muhit: localhost:55439/pos_test; haqiqiy biznes bazasi o‘zgartirilmagan. MXIK/manba yo‘q →409, majburiy tax versiyasi yo‘q →409, marking →503 va payment/stock/lease yozilmaydi. Oddiy mahsulot checkouti ishlaydi. Tax/source snapshot katalog tahriridan keyin o‘zgarmaydi. Parallel bir xil kalitda bitta audit, owner/tenant/current-session va strict validation tekshirilgan.

`npm test`:14/14; `npm run test:integration`:194/194; focused classification:3/3 (offline issue assertion bilan); Playwright classification UI:Chromium/Firefox/WebKit3/3. Typecheck, lint, worker build va webpack production build o‘tdi. 87 migration fresh va legacy fixturega qo‘llandi; encrypted backup bo‘sh bazaga tiklandi, RTO6s/RPO0 fixtureda. Loglar `/tmp/pos-classification-{unit,integration,focused,type,lint,worker,build,migrations,backup,browser}.log`. Rasmiy katalogning huquqiy tasdig‘i va real markirovka integratsiyasi bu qabulga kirmaydi.

Versiya: HEAD0bb58a44212068f8bfaeb592d7473e5cce94ed9d + ishchi daraxt (commit yaratilmagan). Individual source SHA256 quyida.
6b3539d95b2cd2688da430d1e98deb22ff928af3401c64cfd5eada909733909b  src/server/catalog/compliance.ts
d49d348fa53216a0a900d3e23a6d87cf183f5fa0fb29f5f65f0c894a5f2b2d34  src/server/sales/service.ts
4f3d708db12097fa378fe832a927fedf40fb16d6a7fca8cef5b73043655e739a  src/server/offline/cash.ts
feaefae27389d5327e4105e337a35a28ba56c0df50f49dad6f32a96a620b06d8  src/app/api/products/[id]/compliance/route.ts
457745c17ac57b4e470a9b03bc40a8029e7728ee639ee8990203fcbe8bee16c7  src/app/(dashboard)/products/[id]/compliance/page.tsx
fe06768fd44a21dfeb4943d9105a4874ac943d6e06486167031957609854e6a8  prisma/migrations/202610090087_product_classification/migration.sql
61d9e891d217ea401adb49db336be70fadc63076f1ebe95854928549f18397e8  tests/classification.integration.test.ts


### QA-01.08 — lokal source scanner, hali done emas

`npm run security:scan` tracked va nonignored source ichidagi ma’lum private-key/token formatlarini tekshiradi. Natija faqat path/line/type; secret bytes chiqmaydi, `.env`/key store kontenti ochilmaydi. Repository inventarida credential store topilsa alohida bloklovchi finding. Scannerning ikki testi token matni logga chiqmasligini va takroriy regex holatini tekshiradi; CI ga lokal gate qo‘shildi. Bu minimal scanner git tarixini yoki container image CVElarini tekshirmaydi, to‘liq audit o‘rnini bosmaydi.

2026-10-09 automatic approval review `npm audit --json`ni rad etdi: dependency daraxti va loyiha metadata’sini tashqi npm registry’ga chiqarish uchun explicit ruxsat yo‘q. Ruxsat savoli yuborildi; audit ishga tushirilmadi va rad etilgan action aylanib o‘tilmadi. Dependency/image/staging scan dalili to‘liq emas; QA-01.08 qabul qilinmagan.


### +20 — konvertatsiya va yuklama davom etmoqda

CAT-01.04: ProductUnitConversion, original trade/base/ratio/quantity snapshot, base stock/pricing, purchase base-unit cost, original-ratio returns; owner form va POS unit selector. 088 applied, hali brauzer/fresh migration/regression qabul to‘liq emas. 50 focused classification/conversion/economic PG testi o‘tdi. Original total done137, yangi1/20 saqlanadi.

OPS-04.02/03: 50000 mahsulot, 1000000 sintetik draft SaleItem,20 active register haqiqatan yaratildi. Real measured cash checkout normal core service orqali. Birinchi urinishlar inventory compound PK/bulk advisory lock limitini ko‘rsatdi; batchlar kichraytirildi. SERIALIZABLE probe Register/Shift relation-wide predicate locks va Operation missing-key index gaplarni aniqladi; narrow indexed transaction planning + identity-only preprobe qo‘shildi (live context/actor/hash/cancellation transaction ichida tekshiriladi). Payment.saleId indeksi yo‘q edi:089/090 concurrent indexes qo‘shildi. 089 testda ikki concurrent statement bilan qo‘llanmadi; faqat qo‘llanmagan migration tuzatildi, failed test record rolled-back qilindi, har migrationda bitta statement bilan muvaffaqiyatli qo‘llandi. Applied old migrations o‘zgarmadi.

Haqiqiy yakuniy o‘lchov `/tmp/pos-volume-measure.json`:20 parallel tills,100 search +100 checkout, errors0; search p95=304.746707ms, checkout p95=140.561261ms. Bu service-level isolated synthetic muhit; real pilot, public network SLA yoki vendor vaqti emas. Reproducible fresh generator, qolgan full regressiya va version artefakti qabuldan oldin tekshiriladi.


197/197 full PG regressiya (2026-10-09) `/tmp/pos-conversion-integration.log`;50/50 focused `/tmp/pos-conversion-focused.log`; typecheck/lint clean. Birinchi focused urinishdagi yangi test201 kutishi existing API200 contractiga moslashtirildi; unit precisionning eski tushunarli `aniqligi` xabarini saqlash tuzatildi. Count/checkpoint invariant assertlari yumshatilmadi. Hozir final browser va fresh generator qabul ketmoqda.


### +20 — 2/20 qabul: OPS-04.02

136 →138 original done. `DATABASE_URL=<isolated pos_test> node --require ./scripts/test-resolver.cjs .test-build/tests/performance/core-profile.js --seed-only` fresh generator exit0. Bitta yangi sintetik tashkilotda exact50000 product,1000000 SaleItem,20 active register assertlari o‘tdi. `tasks/evidence/volume-dataset-20261009.json` artefakti, `/tmp/pos-volume-fresh-seed.log`. `--seed-only` faqat guarded test DBda fixture ni qayta measure/stress uchun saqlaydi; default run cleanup qiladi. Test SKU/row distribution deterministik, identity fresh UUID namespace. Rows draft; fabricated paid history yo‘q. Actual cash measure normal core service. Production yoki pilot DBga test yuborilmagan.

Versiya HEAD0bb58a44212068f8bfaeb592d7473e5cce94ed9d + uncommitted working tree; source SHA256 quyida.
ccfed12edfabf5f734d4f115f0543d51d94c2c71eb0dfd73136536fc2a46630c  tests/performance/core-profile.ts
835cd6dca3a57da48d98c5e0a895ad15ce643e7dcc09f68a45f4192a8a5aa4f7  tests/performance/core-measure.ts
edd8aaa4b2a8516bc87c8f6360d0430042d651f0f67c5c8ec67cae1f75f382eb  tasks/evidence/volume-dataset-20261009.json


### +20 — 3/20 qabul: CAT-01.04

136 →139 original done. Bir quti savdosi12base unit/1200cash/24→12stock; katalogratio10ga tahriridan keyin original0.5quti return6base/600cash/stock18. Purchase2quti→24base, basecost50; stale draft/expected ratio, foreign tenant/owner-only, precision/mixedSKU va SQL snapshot mismatch guards tekshirildi. Exact barcode/alias/SKU/list bir xil conversion metadata beradi. Owner unknown-ack recovery original key/audit1; POS barcode-unit selector va receipt original quantity barcha3brauzerda tasdiqlandi.

Dalil:16/16 unit `/tmp/pos-conversion-unit-final.log`;197/197 full PG `/tmp/pos-conversion-integration.log`; yangi lookup bilan4/4 focused `/tmp/pos-conversion-api-final.log`;6/6 classification/conversion Chromium/Firefox/WebKit `/tmp/pos-conversion-browser-final.log`. Typecheck/lint/worker build/webpack production build clean.90migration fresh va legacy `/tmp/pos-conversion-migrations-final.log`. Encrypted backup empty-db recovery `/tmp/pos-conversion-backup-final.log`:RTO22s fixture/RPO0, source migration records match, existing DB rejection. No real hardware/provider calls.

Versiya HEAD0bb58a44212068f8bfaeb592d7473e5cce94ed9d + uncommitted working tree.

Fresh volume measurementda birinchi97checkout/98search/1exhaustedSSI conflict topildi:OPS-04.03 hali qabul emas. Retry delay deterministik20/40ms o‘rniga bounded cryptographic jitter20–80/40–160ms; uchattempt/SERIALIZABLE/idempotency/authorization saqlanadi. SSI pg_locks probe20mustaqil till fulfilled; repeating workload verification davom etmoqda.
15c2e5a089998f01929f8a01fe0c3e6178da38906c6e1266a2516384c887bfd5  src/server/catalog/conversions.ts
264ad3a53417cb6f526e5e32621018dd5cbfba063ee25a62bcc8d7113b8d2ca0  src/server/catalog/conversion-math.ts
1a7999fcec044ab9ba4cb98bbcfdbe579573f98379fb53bf204ed329d33fb7ce  src/app/api/products/route.ts
83755df0fcdd87298cef1609d5da1069f89e2a8a68fbbbad52bfd82363a1a6b1  prisma/migrations/202610090088_unit_conversions/migration.sql
de78ae2b46ef360457f2428ebd25078db6b4b7bef26b6e91ecd4c7b074636d2e  tests/conversions.integration.test.ts


Yakuniy regressiya birinchi qayta runida198business testdan197pass,1count/checkout deadlock va cancelled cleanup hook xatosi ko‘rsatdi (199total/197pass/2fail). Bu run PASS sifatida qabul qilinmaydi. Count stock advisorylockni olganidan keyingi Product FK inserti checkout Product FORUPDATE→stocklock tartibiga teskari edi; startCount Productlarni deterministic id tartibida avval lock qiladi. InventoryBalance.productId FK indeksi yo‘qligi katta fixture cleanupni140sga cho‘zdi; faqat stalled isolated cleanup SELECT pg_cancel_backend bilan rollback qilindi.091 additive concurrent productId index applied, ready gate62markers, fresh/legacy91PASS. Qayta full/focused regression talab qilinadi. Yangi done hisob3/20 saqlanadi.


### +20 — 4/20 qabul: OPS-04.03

136 →140 original done. Fresh OPS-04.02 dataset bilan20parallel tills, owner sessions,1item/sale, normal cash core:100search/100checkout,0errors. Ketma-ket ikki run p95search388.871303/393.694858ms (target500), checkout132.229206/114.994945ms (target2000). Provider vaqtiga real chaqiruv yo‘q, cash internal only. Bu service-level isolated Node24/PostgreSQL synthetic, network/realpilot/device/katta basket SLA emas. Environment va sample/error/limit metadata versioned `tasks/evidence/volume-measure-{jitter,repeat}-20261009.json` ichida. Birinchi failed run va bottleneck yozuvlari yuqorida saqlangan.

Gates: full198/198 `/tmp/pos-inventory-index-regression.log`; Product-before-stock lock-order correctiondan keyin focused economic+conversion48/48 `/tmp/pos-count-lock-focused.log`; unit16/16; typecheck/lint/worker/webpack final build clean `/tmp/pos-count-lock-{unit,type,lint,worker,build}.log`. Fresh/legacy91migration PASS `/tmp/pos-inventory-index-fresh.log`. Encrypted empty DB recovery90migrationdagi RTO22s/RPO0;091 faqat index, oxirgi restore91bilan qayta bajarilmagan. Version HEAD0bb58a44212068f8bfaeb592d7473e5cce94ed9d + uncommitted tree.

+20 maqsad hali tugamagan:4qabul/16qolgan. OPS-04.04 katta worker export, OPS-04.06 15minstress/2hsoak haliqabul emas; index yoki kichik100sample bu parentlarni avtomatikdone qilmaydi. Tashqi integration/pilot/owner business approval cheklovlari saqlanadi.
6cc211409363a77bf9cd77634da397e5bc7b71e6e2e861b91a47edec8fa66f34  src/server/operations.ts
83a3462991f33e7fa7d665d32ada0897cc826efa8b9fcb7a61a34912ac6b9e94  src/server/inventory/counts.ts
6a1fc29718a94dcb4d2d1934b7b478b6536264b6555333f2b4496155ac4a8249  prisma/migrations/202610090091_inventory_product_index/migration.sql
835cd6dca3a57da48d98c5e0a895ad15ce643e7dcc09f68a45f4192a8a5aa4f7  tests/performance/core-measure.ts
2a5a5c158a8d52548f56e603a1dd638648a065da66d9351400bec1c4448eb2e8  tasks/evidence/volume-measure-jitter-20261009.json
396f9da5ba9cfc694a6b6284bc351fe0a140a15cb6b494679c79ef02cdcc56c2  tasks/evidence/volume-measure-repeat-20261009.json


### OPS-04.04 — fon katalog eksporti, hali done emas

PostgreSQL mavjud BackgroundJob/lease/owner authorization/Node worker kengaytirildi:catalog_export payload strict own filter, RepeatableRead cursor500,100000rows/16MiBfile/32MiBorg budget,24h download va expired bytes erasure. JobExport metadata/bytes SQL immutable guards; current owner+tenant download/hash verification/10permin/private no-store; expired410. List API artifact contentini chiqarmaydi. Owner jobs UI review/original-key recovery/download.092–093 additive applied; ready gate64markers. Applied088–092 tahrirlanmagan.

9focused job/export PG PASS `/tmp/pos-export-focused-expanded.log`:1001rows exactcost/formula-safe/oneartifact/currenttenant+role+session, revoke fails closed, lateaudit rollback, original source retry, expiredbyteprune+metadatahistory.93 fresh/legacy PASS `/tmp/pos-export-migrations-fresh.log`. Unit16PASS; typecheck/lint/build/worker old-source gates to‘liq qayta yakunlanadi.

Real synthetic50000product profile:206SQLqueries (500cursorpagesize),7150137bytes,3168.504686ms read+worker artifact total, exactrowcount/SHA256match. `tasks/evidence/catalog-export-profile-20261009.json`:querycount, heap before/after, EXPLAIN(ANALYZE,BUFFERS) sequential planner comparison va actualindexedplan. Sequential comparison actual historical old-schema evidence deb talqin qilinmaydi. No production/pilot/vendor/XLSX/PDF guarantee. Browser/fullregression/backup qabul tugamaguncha totaldone140/yangi4of20.


Export birinchi browser runi qabul emas:binary CSVendpointda withApi `{binary:true}` yoqilmagani JSONparse500 va downloadtimeoutni ko‘rsatdi. Tuzatish qo‘shildi, HTTP test200/content-type/attachment/exactbytes/no-store tekshiradi. Birinchi running keyingi WebKit bosqichi build davomida ishga tushgan serverdan foydalangani sabab ham yaroqsiz; corrected build uchun yangi server bilan6browser scenario qayta bajariladi. Birinchi4fail/2pass log `/tmp/pos-export-browser.log` saqlanadi.


Corrected binaryrun5/6 browser PASS, WebKit GET200/download event absent with response CSPsandbox:CSV UI now uses bounded authenticated fetch→Blob→existing downloadBlob helper, preserves BOM/exact bytes and shows errors in-page rather than navigating. Server attachment/nosniff/private/CSP remain. Actual CSV HTTP regression checks status200,content-type,attachment,exactBuffer/no-store. No test assertion relaxed. Blob browser rerun pending.

Full final PostgreSQL202/202 PASS `/tmp/pos-export-integration-final.log`,427094ms (large fixture cleanup included). Unit16/16, type/lint/worker/webpack clean. Source version now HEADf5fa8aabd692f814a0411b57ac2a6dad27fe61d0 (user commit step-31) + current export working tree; no AI commit.


93migration encrypted empty DB restore PASS `/tmp/pos-export-backup-final.log`:protected export bytes/size/SHA/erased-state fingerprint equal, recovered fixture app authenticated, RTO23s/RPO0, existing DB rejection. Final50000profile memorymetrics artefakt yangilandi:206queries/7150137bytes/3822.642722ms;beforeRSS98.8MB/after246.4MB (includes separate read+worker+artifact verification, not leak/soak proof).

Large download now native stream64KiB chunks with2active source buffers perprocess,5min transfer budget, abort/cancel/read failure/EOF releases slot once; busy429/Retry-After3. No new storage/queue. Direct stream unit2assertion casesPASS `/tmp/pos-export-stream-unit-assertions.log`;17unit file suitesPASS `/tmp/pos-export-stream-unit.log`;poststream9focusedPG including actualHTTPexactbytesPASS `/tmp/pos-export-stream-focused.log`. Core/worker/full202PASS remains; only readonly delivery changed after fullrun. Streamtype/lint/worker/webpack clean; final3browserstreamrunpending.


### +20 — 5/20 qabul: OPS-04.04

Original done136 →141; maqsad156, qolgan15. Yakuniy Chromium/Firefox/WebKit6/6 PASS `/tmp/pos-export-stream-browser.log`. Native64KiB streaming/2slot/5min budgetdan keyin unit17 file suite, stream2 named assertions, actual HTTP bilan9 focused PostgreSQL test PASS. Oldingi full202/202, fresh/legacy93 migration va encrypted empty recovery PASS; typecheck/lint/worker/webpack clean. Backup RTO23s/RPO0 fixture, protected export bytes/size/hash/erased-state aynan tiklangan.

Qayta ijro: `npm test`, `npm run typecheck`, `npm run lint`, `npm run worker:build`, `npm run build -- --webpack`; isolated DB bilan `npm run test:integration`; `POS_E2E_ALL_BROWSERS=1 npm run test:e2e -- --grep 'Catalogue export UI|Background jobs UI'`; `tests/performance/export-profile.ts` explicit isolated fixture guard. Version HEAD `f5fa8aabd692f814a0411b57ac2a6dad27fe61d0` + export working tree; AI commit/deployment yo‘q. Versioned profile `tasks/evidence/catalog-export-profile-20261009.json`:50000rows/7150137bytes/206queries/3822.642722ms. EXPLAIN comparison controlled planner comparison, historical old schema yoki public SLA dalili emas. Before/after process memory alohida read/worker/artifact verificationni ham o‘z ichiga oladi; soak testi deb hisoblanmaydi.

Qabul chegarasi: katalog CSV bounded background export va indeks/query evidence. XLSX/PDF/report export, 2hsoak, real pilot yoki tashqi provayder integratsiyalari shu band orqali yopilmaydi.
ccf8d4dbbec48285d160bb0e42ccf1228addba40927db37caec327cecc7be9b8  src/server/jobs/catalog-export.ts
6b424edd2efd2cb4781080961d6bb81e2615ca99b6573d78d9691c5f5f64cb38  src/server/jobs/download-stream.ts
9123d34478f3ef883db50c87d5a119c7b93ed9817cb9239b030324c93cce77da  tests/job-export.integration.test.ts
d8d2ce29166d908a5c5ea642f183367458bf0f9735753a82159e815d4541e2fd  tests/export-download.unit.test.ts
8c04aa54302a2f203d00a8684477360768740f722013c1e8a641d1177de54894  tasks/evidence/catalog-export-profile-20261009.json

### CRM-01.04 — Naqd avans core va UI, qabul jarayonida
Receive/explicit allocation/unused refund alohida immutable source-linked ledger bilan implementatsiya qilindi. Physical cash book bitta kirim/chiqim, allocation faqat DebtEntry; paid-by-advance sale return existing cash Payment.outdan foydalanadi. Owner/tenant/live-session, account/open-shift/currentfunds, exact Decimal/transaction/idempotency. SQL budget/source/tenant/debt/immutable guards, unused advance archive/merge denial. Statement va commercial CSV alohida avans va haqiqiy cash eventsni chiqaradi. Owner UI DurableMutation/PendingActions original-key recovery/review va bounded pagination. Real provider/bank/hardware integratsiyasi yozilmagan.
094isolated applied; birinchi test triggerdagi unassigned PL/pgSQL record/SQL alias ambiguityni topdi;095additive tuzatish, applied094unchanged. Corrected focused advance3+customer identity+financial regression71/71PASS `/tmp/pos-advance-focused-final.log`; unit17file suitePASS. Actual HTTP strict-input/commercial CSV uchun4-test qo‘shilgan; yangi full regression, production UI browser, migration/recovery gates yakunlanmaguncha CRM-01.04 done emas. +20hisob5/20originaldone141saqlanadi.


### +20 — 6/20 qabul: CRM-01.04

Original done136 →142, maqsad156, qolgan14. Partial cash/debt collection va explicit source allocation mavjud ishlashi saqlandi; ortiqcha pul alohida cash advance, qarz yashirin manfiy qilinmaydi. Receive120.25→sale debt100ni40.25+59.75ajratish→unused20.25refund→paid-by-advance sale100cashrefund = cashnet0/debt0/advance0. Original receive va unusedrefundning concurrent duplicate keys bittadan yoziladi; distinct raced7refunddan10.01availablega faqatbittasi commit, remaining3.01. Opening12.01/advance20→allocated12.01/remaining7.99. SQL journal/source immutability, over-allocation/refund/foreign/archived/admin/revoked session guards. Actual HTTP strict precision/unknownfields, repeatedoriginalkey and commercial CSV cash receive/refund tests.

Gates: full206/206 `/tmp/pos-advance-full.log`312963ms; focused71/71 `/tmp/pos-advance-focused-final.log` (new actualHTTP case included in finalfull); unit17file suites; type/lint/worker/webpack clean. Customer advance UI3/3 Chromium/Firefox/WebKit `/tmp/pos-advance-browser.log`:actualPOSTcommit+lostack→reloadoriginalreplay→openingdebt allocation→unusedrefund, single records/exactjournal. Fresh/legacy95migrationPASS `/tmp/pos-advance-migrations-fresh.log`; encrypted95restore `/tmp/pos-advance-backup.log`PASS, original13.25advance/1.25allocation/-1.25DebtEntry/2.01refund/9.99available recovered; cash/source journals preserved, recovered app authenticates, existingDBreject, fixtureRTO23s/RPO0. Historical failed094aliasrunnotPASS;095additivefix and correctedrunsaccepted,094notedited.

Version HEAD `f5fa8aabd692f814a0411b57ac2a6dad27fe61d0` + working tree; no AIcommit/liveDB/deploy. Reproducible source/tests/migrations094–095/UI/e2e and ADR057, APIcontract in api.md. Real provider/bank confirmation is not invented; unsupported advance channel fails closed. Existing manually confirmed non-cash sale/collection refund policy remains covered by fullregression. +20goalnotcomplete; original task/checklist counts6accepted,14remaining, subtasksnotcounted.
ae16a47f5374def765b60d17a5b18978fc3997c9f35c8633567c8fcb2724a57a  src/server/customers/advances.ts
7e155a52cd76fb431e30fe0b8aa5c08ab8c8332a6cd78cd61078fde0e51f7c62  src/server/returns/service.ts
003f7a4e0844dd4a8bf4a921115db02e44a819aa62ae8d593bdf41df1381657f  src/components/customers/CustomerAdvances.tsx
b8d4f950f961085797f667fad7a8f53dbf470374e1a777cd573c5c610b9134cd  tests/customer-advances.integration.test.ts
405f1064acecf029c0a8c89654c02c186d35180147363ccdd9251ec578d68183  prisma/migrations/202610090094_customer_advances/migration.sql
cab95a6711ce5e148392d6672b73eb73f115707ec32a103a4968c34ffefd406b  prisma/migrations/202610090095_advance_trigger_alias/migration.sql

### OPS-01.08 — maintenance core, qabul jarayonida
Operator-owned bounded/strict/read-only configfile, atomic publication CLI, authenticated no-store notice/status, durable runOperation admission after current-authorized committed replay, readiness503 va worker claimpause implementatsiya qilindi. In-flight operation finishes, newOperation503/RetryAfter30, existingkey result actor/hash/sessionchecked. Dashboard notice keeps basket/queue, releasechange informs user. Next16.3.8 local deploymentId/self-hosting guides read; NEXT_DEPLOYMENT_ID nativeversionprotection, hostrouting remainsoperator. Non-durable CRUD blanketguard deb claim qilinmaydi; rollout operator discipline/runbook `docs/operations/maintenance.md`da. Unit18filesPASS, focused5(includingadvance)PASS; centralguardfullregression/browserpending. Originaldone142/+20qabul6saqlanadi.

Maintenance firstfull206/207 (1route-boundary failure) and firstbrowser0/3 are not accepted. New deployment endpoint now common withApi/authenticated readonly for all live business roles; original route-boundary tests unchanged, correctedfocused6/6PASS. Correct browser3/3PASS `/tmp/pos-maintenance-browser-corrected.log`: readiness disables new checkout, basket persisted; operator toggles drain between successfulquote and actualwrite→503pending originalkey→reload→off→sync sameintent→cash complete, total2cash sales/stock1. Operator config/CLI direct2assertioncasesPASS,18unitfilesPASS. Correctedfinalfullinprogress. Additional cashadvance lock-order review identified Customer-before-Shift inversion risk againstreturns; receive/refund now Account→Shift→Customer→Advance, matchingfinance andreturns. Dedicated realShiftLock→waitingreceipt→Customer acquisition test added; no appliedmigration edited; focusedverification pending, no new originaldonecount.


### +20 — 7/20 qabul: OPS-01.08

Original done136 →143; target156, remaining13. Maintenance operatorflag admissionni nazorat qiladi, oldin admittedwork tugaydi, yangi durable work503/RetryAfter30 bilan hech qanday business/Operation posting yozmaydi. Current-authorized original actor/payload/key committedreplay ishlaydi, alteredkey/revokedSession rad etiladi. Worker nextcyclepause, readiness503/livenessseparate, authenticated withApi notice/currentrelease; local baskets/operation keys saqlanadi. Docker builder/runner bir xil NEXT_DEPLOYMENT_ID argumentini oladi; Compose POS_RELEASEbuildarg va optional read-only shared-directory overlay. Compose --env-file /dev/null --no-interpolate configPASS; real image build/deploy/hostrouting claimyo‘q. Runbook `docs/operations/maintenance.md` controlledwindow, backup/migration/drain/recovery tartibini va non-durableCRUD/operator cheklovini tushuntiradi.

Finalgates: correctedfull207/207 `/tmp/pos-maintenance-corrected-full.log`,309667ms **lastcash lock-order refinementdan oldin**. Postrefinement79/79 economic+identity+returns+maintenance+allrouteboundaries `/tmp/pos-final-economic-focused.log`:real Shiftlock ostida receipt kutganda Customer lock500ms budget ichida olish mumkinligi isbotlandi, source/cash/debt/return balances exact. Financial source semantics/schema unchanged; matching Account→Shift→Customer order added, sourceBudget/SQL guards preserved. Finalbuild `/tmp/pos-final-build.log`, finaltype/lint/worker clean. Unit18file suitesPASS `/tmp/pos-final-unit.log`; operator config/CLI2namedassertioncasesPASS.95fresh/legacy+encryptedrestore23s/RPO0previouslyPASS, maintenance adds no schema.

Finalbrowser12/12 `/tmp/pos-final-browser-confirmed.log`:4real scenarios×Chromium/Firefox/WebKit (backgroundjob retries, exactCSVexport, customeradvance, maintenance). Maintenance verifies committedcash replay duringdrain, disablednewcheckout, persisted basket, operator toggle **between successfulquote and actualwrite**, actualPOST503MAINTENANCE, IndexedDBsameoriginalkey inbothdraft+pendingoperation, reload, off, originalsynchronize, draftcashcompletiononce, total2payments/stock1. Previous11/12combinedrun failed because test reloaded at earlyReactpending display before actual503/persistence; acceptedtest waitsactualresponseandstoredoriginalkey, no arbitrarysleep/assertionrelaxation. Earlierfailedfull/publicstatus and incorrectenabledbutton assumptions remain recorded above; none countedPASS.

Sourceversion HEAD `f5fa8aabd692f814a0411b57ac2a6dad27fe61d0` + current workingtree, no AIcommit/deploy/livebusinessDB. Local secret scan585sourcefiles/0findings `/tmp/pos-final-secret-scan-approved.log`; initial sandbox subprocessfailedrun notaccepted. Scanner does notopen env/key stores, scanGitHistory/images or send dataexternally. This does not close QA-01.08/dependency audit. +20originalparentcount7accepted/13remaining; no scenario/subtask/check added to count. Original+20notcomplete.
152427e39024bcbef4f8bc1ecb5fcf795a4cfed8097134e4b21bb2cce050c61d  src/server/deployment/state.ts
9c19f492f9480fc51190b2e7fff15638eefb60257ac21cd466e11e4cbdae4f74  src/server/operations.ts
e63267ad38c9ac61ef5c19449aa8bdfe6e8ac9b5a676bb6a8aa34a4982d16de0  src/app/api/deployment/status/route.ts
7c2bc4163a55366ceedceeafebadc92fc73145b024cdcca6c5d9e3f04d4eacbb  src/components/operations/DeploymentNotice.tsx
e2bc37aa8ff0c785c70c78b658dac7d2b08b179f5d00d07479c7d4604c8396ca  scripts/ops/set-maintenance.mjs
94ca05c4a03455029a71aed6bab2c955de9fcb72c57cb5ad23aa3191dd4f0db7  tests/deployment.integration.test.ts
d074c317344f955893272caf1d3c4fc612d4fa84cefaae4723e0c3abf8867dd3  tests/deployment-state.unit.test.ts
4569830e404d55c274dae3f4341e6f2cfa9a852506b085ad2ab2bbbcce08c281  src/server/customers/advances.ts
a84874d9b9951520d668b0f58f3a1eab4f5a3c29aae2e8e8822643f44c60c61d  tests/customer-advances.integration.test.ts
de802130257de711b476ec0ad927096ba95b1e407c7e987401dbf19a0b4e8dc6  Dockerfile
99d35489041aa9f022ad55037c708b9e448b93e1038527e4e8cb6a95f5d2a1b6  docker-compose.yml
1bcbaf94bb28d5dcc6da0473850175285b61ff3f45194414c107b0b836802270  docker-compose.maintenance.yml

### PUR-01.05 — exact allocation foundation (2026-10-09)

Source version `02253115d6d7dcf97e195332015b877041e25e75` + working tree.
Existing moving-average purchase confirmation inspected; no original receipt or
SaleItem cost history was changed. `src/server/purchases/landed-cost.ts` adds a
strict, bounded pure allocation calculator using existing Zod/Decimal and native
BigInt, with no new dependency. Value, homogeneous-base-unit quantity and explicit
kg snapshot weight methods supported. Integer cents conserve total exactly;
canonical final positive row receives residual, zero-basis rows receive zero.
Six-place unit-cost rounding residual is returned separately, not silently lost.
No API/posting/production financial effect yet; contract and remaining integration
requirements are in `docs/operations/landed-cost.md`.

Evidence: `tests/landed-cost.unit.test.ts`, five named cases PASS
`/tmp/pos-landed-direct.log`; covers two-cent/three-line last-line residual,
permuted input, quantity/weight/value differences, missing weight/mixed units,
zero denominator, duplicate/empty/over-limit rows, invalid decimal precision,
near-limit BigInt ratios and 200 deterministic fractional conservation inputs.
`npm test` 19/19 file suites PASS `/tmp/pos-landed-unit.log`, typecheck PASS
`/tmp/pos-landed-type.log`, lint PASS `/tmp/pos-landed-lint.log`, diff check clean.
Initial compile rejected BigInt literals under repository ES target; fixed locally
with `BigInt()` constants, no global compiler-target change. Initial failed compile
is not acceptance evidence. No database migration, integration test or browser
run is claimed for this pure module.

PUR-01.05 remains `in_progress`; PLAN1 checkbox stays open. Receipt-source posting,
immutable cost-correction journal, sold-stock attribution/reporting, transactional
API/UI and corresponding acceptance tests remain. Original done stays143 and the
ongoing +20 goal stays7/20 (13 remaining); this foundation is not a new parent done.
No AI commit, live-business DB, secret access or real vendor integration.

### PUR-01.05 — receipt-backed preview API (2026-10-09)

Source base `02253115d6d7dcf97e195332015b877041e25e75` + working tree; preceding
allocation module preserved. Local Next route handler guide read before changes.
Added `src/server/purchases/landed-cost-preview.ts` and protected POST
`/api/stock-documents/[id]/landed-cost-preview`. Server loads confirmed original
purchase receipt, takes actual partial receipt quantity/cost and original order
unit snapshot; no client quantity/cost/unit accepted. Product current cost does
not replace original receipt cost. Manual receipt with no original unit snapshot
fails closed. Reversal, role/session/tenant/assigned-branch checks, bounded 201-row
read with 200-row acceptance, strict weight completeness and 30/minute rate limit.
Returns explicit previewOnly/no-store; no Operation, stock, debt or cash posting.

Tests `tests/landed-cost.integration.test.ts`: actual registration/order/partial
receive through services; original3×2 despite cataloguecost999; allocation0.03
conserved0.01+0.02; forgedquantity/precision/missing/zero/NaN/Infinity/non-numeric
weights400; non-receipt row400 INVALID_ITEMS; foreigntenant404; assignedadmin200,
unassignedadmin404, cashier403, revokedSession401. Existing SQL base-unit-history
guard stays active and is positively checked; no weakening of database triggers.
Final focused13/13 PASS `/tmp/pos-landed-api-integration-final.log`,19284ms,
including all route inventory/authorization checks and catalog/purchase regression.
Final unit19/19 file suites, typecheck/lint PASS at `/tmp/pos-landed-api-unit.log`,
`/tmp/pos-landed-api-type.log`, `/tmp/pos-landed-api-lint.log`.

Initial fixture omitted required barcode; corrected before acceptance. Initial
fixture tried changing a historical base unit and was correctly rejected by SQL;
test now explicitly verifies that guard and changes only cataloguecost. Initial
foreign row test expected404; contract actually returns400 INVALID_ITEMS for a
non-member receipt line, assertion now checks both status and exact code. Earlier
failed runs are not PASS evidence. Malformed Decimal refinement now produces Zod
validation errors rather than throwing constructor errors into HTTP500.

API contract in api.md and docs/operations/landed-cost.md updated. No migration,
real business database, deployment or vendor integration. PUR-01.05 checkbox
stays open: preview does not complete landed-cost journal/sold-stock corrections.
Original done143 and ongoing +20 7/20 remain unchanged (13 remaining).

Final production webpack build PASS `/tmp/pos-landed-api-build-final.log`;
new preview route included. `git diff --check` clean. No browser UI was changed,
and no browser acceptance is claimed for this API-only increment.

### PUR-01.05 — original receipt preview UI (2026-10-09)

Working tree above source base02253115. Existing capitalised expense/cash
documents and profit summary inspected before any financial change: current
moving-average architecture has no exact additional-value journal or historical
sold-stock attribution. Merely changing Product.costPrice would hide rounding
residuals and misstate late expense/profit; no such posting was introduced.
This increment connects the accepted receipt preview API to actual PurchaseOrders
original receipt panels through `LandedCostPreview.tsx`.

Value/quantity/weight selector, exact string amount and per-line kg/base-unit
inputs, original received quantity/unit, allocatedAmount, landedUnitCost and
signed roundingResidual shown. Explicit preview/no balance or financial document
posting notice. Editing input removes stale result immediately; synchronous
pending guard prevents double submit, inputs disabled in flight, 15s timeout,
error retains form and exposes retry. Unmounted panel does not accept late state
updates. Existing purchase/receipt DurableMutation paths unchanged.

Versioned browser scenario in tests/e2e/core.spec.ts: register real isolated
account→create original10×2order→partial receipt3×2→supplier UI→0.01expense
preview shows3dona/2.003333unitcost/0.000001residual→edit12 clears oldresult→weight
0.5→actualnetworkfailure→visibleerror→retry12/6.000000. Asserts no new Operation,
stock3/catalogcost2/invoice6 unchanged. Chromium/Firefox/WebKit3/3 PASS
`/tmp/pos-landed-ui-browser.log`,9.4s. Typecheck/lint/production webpack PASS
`/tmp/pos-landed-ui-type.log`, `/tmp/pos-landed-ui-lint.log`,
`/tmp/pos-landed-ui-build.log`; diff check clean. Local Next forms guide read.

No new migration/ledger posting or vendor implementation; UI usage documented
in docs/operations/landed-cost.md. PUR-01.05 remains in_progress, original done143,
ongoing +20 remains7/20. Full parent still requires immutable financial value
posting, sold-stock correction, profit/valuation integration and concurrency/SQL
acceptance. UI scenario is not counted as an additional original done.

Existing Purchase order original-key partial receive recovery and Supplier return
lost-credit/released-advance/no-cash-refund browser regressions6/6 PASS
`/tmp/pos-landed-ui-regression.log`,20.7s (both scenarios in all three browsers).
This increment total browser acceptance9/9 across new preview and existing flows;
no full end-to-end suite or real hardware/provider acceptance is claimed.

### PUR-01.05 — durable prepared allocation journal (2026-10-09)

Source base02253115 + working tree. Migration096 adds ReceiptCostPlan with
prepared/cancelled lifecycle, immutable original receipt allocation snapshot,
original paid capitalised expense FK, org/store/creator/cancellation metadata,
active-expense partial unique index, source/line/amount/rounding SQL guards.
097 additive constraint explicitly forbids null cancellation reasons because
SQL CHECK UNKNOWN otherwise passes; applied096 was not edited. Schema includes
all inverse relations with explicit NoAction matching SQL; client regenerated.
Migration test's pre-finance subset excludes both new migrations appropriately.

prepareReceiptCost consumes existing expense identity/amount, creates no second
cash debit/expense, derives original partial receipt allocation transactionally.
Expense→receipt→plan lock order, existing SERIALIZABLE runOperation/original key,
audit atomicity, tenant/store/role/current session, 30/min write limit. Source
amount cannot be changed; only unreversed capitalised expense in same store is
accepted. One expense only one active prepared plan. Cancel preserves snapshot,
adds actor/time/reason, frees preparation slot, does not reverse cash. Both SQL
and finance DAL reject source expense reversal until plan cancelled; raw SQL
stock reversal likewise guarded. Protected create/list/cancel routes, list20/page
with safe integer/32-bit offset bounds. Preview helper shared transactionally.

Acceptance tests: same original key concurrent twice→oneplan; two different keys
raced→oneactive assignment; cash/account book stays7.99 after original20−12.01,
catalogcost2/stock3 unchanged; reason mutation/delete/raw-null cancellation reject;
cancel replay once, reprepare allowed, cancel then real finance reversal restores20,
reversed source denied. Foreign tenant404, cashier403, malformed source amount409,
actual API duplicate409 EXPENSE_ALREADY_ASSIGNED; raw expense reversal reject.
Late AuditLog failure rolls back plan and Operation; original retry creates one.
SQL rejects altered original quantity999; high offset rejects400 before query.

Gates: after097 focused75/75 financial+routes+plan cases PASS
`/tmp/pos-cost-plan-focused-097.log`,24747ms. After final pagination guard,
all5 plan cases PASS `/tmp/pos-cost-plan-final-five.log`,3121ms; unit19/19 files
PASS `/tmp/pos-cost-plan-unit-final.log`. Type/lint PASS
`/tmp/pos-cost-plan-type-final.log`, `/tmp/pos-cost-plan-lint-final.log` after
the final pagination guard.
Worker build PASS `/tmp/pos-cost-plan-worker.log`. Fresh/legacy migrations through
097 PASS `/tmp/pos-cost-plan-migrations-097.log`. Existing preview three-browser
3/3 PASS `/tmp/pos-cost-plan-browser-regression.log`,8.9s after helper/schema changes;
no new plan UI/browser recovery is claimed. Initial compile used older generated
client and failed; corrected client+successful final compilation accepted.

This is durable preparation, NOT applied inventory valuation or historical COGS
correction. No fabricated capitalization/financial profit correction. Apply-stage
value journal/reporting, apply UI/recovery and backup fixture gate remain. Parent
PUR-01.05 stays in_progress, checklist open; original done143/+20 remains7/20.
Docs/api reflect prepared status explicitly. No live business DB/deploy/vendor
integration/AI commit. Applied096–097 immutable; diff check clean.

Final production webpack build after pagination guard PASS
`/tmp/pos-cost-plan-build-final.log`; prepared/cancel endpoints included.

## DATA core plus-2 2026-10-10

DATA-01.06 va DATA-01.07 original bandlari done:143→145. Oxirgi +2 so‘rov2/2 bajarildi; oldingi +20 hisobi9/20,11 qolgan. PUR-01.05 hali in_progress; uning prepared allocationi applied valuation deb hisoblanmaydi.

Versiya: HEAD9eada1c75240c00a3d98435f67490a61a654f9d7 + ishchi daraxt; AI commit/deploy/live biznes DB yo‘q. Mavjud koddagi Organization.currency maydoni haqiqiy currencyCodega tuzatildi. Prisma unique constraint nomi PostgreSQLdagi mavjud nomga explicit map qilindi; applied098–099 tahrirlanmadi.

Business Operation + immutable scoped ProviderIntent + outbox + audit atomic. Source FK va SQL business identity guard boshqa key/provider bilan active subjectga duplicate yuborishni rad qiladi. Worker qisqa claimdan keyin transportni DB tranzaksiyasidan tashqarida bajaradi; test transport kutayotganida boshqa transaction Outbox va Sale FOR UPDATE locklarini olishi bilan isbotlandi. Lease30s, timeout10s, token/generation fencing. Settlement/domain hook/audit bir transaction; late hook xatosidan keyin submit emas lookup orqali tiklanadi.

Timeout/lost ACK (external ID kelmagan holat ham), malformed/not-found, expired lease faqat original intent UUID lookupga o‘tadi. Bitta submit;8 lookupdan so‘ng review, owner idempotent sababli resume; lifetime32. Stale result va o‘zgargan external identity postingni bajarmaydi. Owner-approved full compensation immutable child/original proofga bog‘langan; original→compensating→compensated, muvaffaqiyatsiz child→needs_review. Current owner/org/store scope, strict input va bounded pagination; lookup10/min.

Restart testi test-only transport proof yozganidan keyin haqiqiy child processni to‘xtatadi; yangi process expired lease recovery+lookup bilan bir marta domain acknowledgment qiladi. Mock proof/test hooks haqiqiy payment/fiscal posting emas. Production configuredProviders registry bo‘sh va fail-closed; Click/fiskal/E-POS/hardware/SDK/request formatlari taxmin qilinmadi, mavjud cash oqimi o‘zgarmadi. Real vendor binding, authoritative status contract, domain posting, sandbox/pilot keyingi alohida integratsiya. Exactly-once remote execution yoki distributed transaction va’dasi yo‘q.

Qabul dalillari: unit19/19 `/tmp/pos-provider-unit-accepted.log`; to‘liq PG221/221,311226ms `/tmp/pos-provider-full-final.log`; qo‘shimcha changed identity testi bilan yakuniy core9/9,3996ms `/tmp/pos-provider-nine-accepted.log`. Lint `/tmp/pos-provider-lint-accepted.log`, typecheck `/tmp/pos-provider-type-final.log`, worker build `/tmp/pos-provider-worker-final.log`, webpack production build `/tmp/pos-provider-build-final.log` PASS. Fresh+legacy migratsiyalar099gacha `/tmp/pos-provider-migrations-final.log` PASS. Client regenerate PASS. Schema map faqat nom metadata o‘zgarishi; final unit compile+core9 bundan keyin bajarildi. Birinchi full regression to‘xtagan test DB sababli failed; konteyner qayta ishga tushgandan keyingi221/221 qabul qilindi. Oldingi currency compile xatosi ham yakuniy clean compilationdan oldingi failed run, qabul dalili emas.

Operator runbook `docs/operations/provider-outbox.md`, API contract `api.md`, reproducible evidence `tasks/evidence/provider-core-20261010.json`. Yangi browser UI yo‘q; real vendor/hardware sinovi yoki backup/PITR production acceptance da’vo qilinmaydi.

## Plus-20 SaaS/core 2026-10-10

Yangi so‘rov baseline145, target165. BIZ-01.01 owner-confirmed ADR-059 bilan done:146jami,1/20;19qolgan. Tarif/trial/grace tasdiqi haqiqiy suhbat javobi, uydirma emas. OPS-02.02 core monitoring ishlanmoqda; protected tenant counters/queue alert va alohida probe bor, host disk/external delivery hali acceptance emas. Billing bandlari kod yoki migrationning mavjudligi bilan avtomatik done qilinmaydi.

### SaaS core qabul — 2026-10-10

BIZ-01.02–BIZ-01.07 original bandlari done. Baseline145 → jami152; ushbu +20 so‘rov7/20,13qolgan. BIZ-01.01 oldin qabul qilingan. Model/SCENARIO/subtasklarni yangi done sifatida sanamadim.

Tasdiqlangan DB-versiyali Start/Business/Pro narxlar, Pro14kun one-time trial,7kun grace, existing organizations alohida enrollment. Past limit existing/arxivlangan data saqlaydi, org-wide SQL lock register/staff race va API bypassni rad qiladi. Invoice original price version + explicit manual_bank proof + subscription atomic; bu Click yoki POS cash posting emas. Proof reuse/audit rollback/current platform revocation/replay testlari o‘tdi. Expired real HTTP catalog CSV qoladi. Cost budget exact decimals, currency/period/source/estimated, partial periods excluded, unknown margin va full filtered CSV; source same vendor boshqa oyda qayta ishlaydi. Marketing DB pricing + accepted capabilities, shartli browser print/nonfiscal va unavailable integrations ochiq.

Billing checkpoint gates: unit22/22; PGfull232/232 (318352ms, auth challenge qo‘shilishidan oldin); final billing/cost/monitoring/routes15/15 (7114ms, replay-privilege callback va register/staff/export boundarydan keyin); final three-browser3/3 (8.5s), webpack build, lint, schema validate, worker build, fresh/legacy migrations105 PASS. Keyingi auth106–107 uchun alohida qabul sinovlari davom etmoqda. Hech qanday live biznes DB/deploy yoki AI commit yo‘q. Persistent evidence: tasks/evidence/saas-core-20261010.json.

### Provaydersiz auth va ichki support core — 2026-10-10

Ownerning ADR-060 qarori bajarildi: SMS/e-mail almashtiriladigan interface, encrypted queue/hash proof, expiry/one-use/attempt/resend/rate, atomic password reset va all-session/PIN revoke. Production mock failclosed, sozlanmagan yetkazish503, avtomatik contact verification yo‘q. Known/unknown reset javobi bir xil; akkauntga bog‘liq resend limiti ham accepted va yangi token yaratmaydi. Step-up primitive action/key/hash/sessionga bog‘langan, rollback/replay tekshirilgan; global critical-action enforcement va TOTP enrollment hali tugallanmagan.

Ichki ticket create/list/detail/reply/state/severity/assignment, tenant/platform scope, original-key lost-ACK recovery, immutable event/policy va late-audit rollback bor. Faqat haqiqiy operator javobi firstRespondedAtni belgilaydi; firstResolvedAt alohida va reopen tarixi saqlanadi. Du–Sh09–18 Asia/Tashkent/240ishminuti draft taklif, rasmiy SLA emas. Admin yangi DB versiyasini chiqaradi; old ticket maqsadi o‘zgarmaydi. Tasdiqlanmagan favqulodda kanal yoki uydirma mas’ul yo‘q.

Qabul: unit23/23; final focused auth6+support5+exhaustive route5=16/16 (9825ms); production HTTPS Chromium/Firefox/WebKit billing+support6/6 (15.9s), webpack build/lint/typecheck/worker/schema PASS; fresh+legacy migrations108 PASS; standalone probes2/2 PASS. Full regression243dan242 PASS/1FAIL (315103ms): yangi public reset endpointi eski test inventoryda protected deb tasniflangan. Exact publicPaths tuzatildi; barcha protected handler inventorysi final focused16da PASS. Bu full243 qayta run qilingan degani emas. Browserdagi dastlabki3FAIL Next route announcer bilan ambiguous test alert selector edi; final6PASS. Failed loglar yashirilmadi.

106–108 migrationlar va hash/log dalili: `tasks/evidence/auth-support-core-20261010.json`. Qo‘llangan migratsiya qayta yozilmadi;107 historical session proof lifecycle uchun additive fix.108 dastlab transaction rollback bo‘lgan syntax tuzatishidan keyin muvaffaqiyatli qo‘llandi. SEC-02.03/04 va BIZ-02.03 tashqi yakunlari blocked_external; SEC-02.06/OPS-02.02 in_progress. Original done hisobi152, so‘rov7/20,13qolgan; ushbu ichki subtasklar qo‘shimcha original done sifatida sanalmadi. Live biznes DB/deploy/real vendor/hardware/AI commit yo‘q.

### Auth expiry cleanup va to‘liq regressiya — 2026-10-10

Provayder yoki encryption key olib tashlanganida ham muddati tugagan navbat ciphertexti o‘chadi. Cleanup batch20 (caller1–100), SKIP LOCKED, metadata saqlanadi; delivery/verification yoki tashqi yuborish yaratmaydi. Oldin provider registry bo‘sh bo‘lsa worker erta qaytib expiry cleanupni o‘tkazib yuborardi. Yangi test haqiqiy1sekund TTLdan keyin providersiz/kalitsiz ciphertextNULL, failedAt mavjud, deliveredAt/usedAtNULL va VerifiedContact0 ni tekshiradi. Schema va migration o‘zgarmadi.

Yakuniy to‘liq isolated PostgreSQL integration244/244 PASS (322956.775004ms); oldingi public reset inventory failure ham aynan shu full run bilan yopildi. Unit23/23, lint, worker build va production webpack build PASS. Source/log SHA256 va HEAD+working-tree versiya: `tasks/evidence/auth-expiry-cleanup-20261010.json`. Oldingi failed dalil saqlanadi; yangi muvaffaqiyatli full run uni almashtiruvchi acceptance. UI o‘zgarmagani uchun oldingi uch browser6/6 dalili o‘z bosqichida qoladi, qayta sinov deb hisoblanmaydi. Original done152/7-of-20 o‘zgarmadi; tashqi integratsiya/live biznes DB/deploy/AI commit yo‘q.

### SEC-02.05 qabul — 2026-10-10

Oxirgi +1 original vazifa so‘rovi bajarildi:152→153,1/1. Faqat SEC-02.05 done; subtask/model/scenario qo‘shib sanalmadi.

Protected API243handlerda org+actor shared PostgreSQL read600/write300 per minute admission,429/Retry-After va boshqa tenant uchun200 tekshirildi. Counter expiry original retryga yo‘l beradi;12parallel request/limit3 aynan3success. Public auth writes1200/min: explicit trusted valid IP yoki unattributed bucket; forged forwarding header va invalid IP bypass bermaydi. Health/logout ishlaydi. Maxsus login/register/reset/import/report/CSV/finance/job budgets saqlanadi. Private reset issue/complete expiry/retry, import actual1001rows413 va noto‘g‘ri base64/file413, no stock/money posting qabul qilindi.

Haqiqiy header va stream1MiB413, body default10s408, final noto‘g‘ri timeout config503/no handler. Import parsing2workers/128MiB/10s, row/column/cell overflow413, malformed workbook400. Runtime/production config bounds, no new Redis/vendor. Uch production HTTPS browserda lost-ACK invoice→429→same original key saqlanishi→reload/retry bir invoice; unfinished JSON408 va yangi retry400normal validation; support oqimi saqlanadi.

Gates: full250/250 (325162.784215ms), keyingi final failclosed-config assertion va lint-only test variable rename uchun fresh compiled focused6/6 (3217ms), unit24/24; final Chromium/Firefox/WebKit9/9 (46.5s). Final webpack build, lint, typecheck va worker build exit0. Schema/migration o‘zgarmadi. `git diff --check` PASS. Dastlab o‘chiq isolated DB va yo‘q /tmp browser binaries tekshirilgan muhit xatolari, corrected successful gates bilan alohida qayd etildi. Hosting/TCP/header/flood/WAF deploymenti OPS doirasida qoladi; application admission tugashi ular bajarildi degani emas.

Persistent source/log hashes va HEAD+workingtree dalili: `tasks/evidence/request-limits-20261010.json`; operator contract `docs/operations/request-limits.md`. Live biznes DB, real tashqi servis/hardware, deploy yoki AI commit yo‘q.

## Yangi +20 band bosqichi — 2026-10-10

Boshlanishdagi asl PLAN1 `done`: **153**. Maqsad: **173**. MODEL/SCENARIO/STAGE yoki bir bandning subtasqlari alohida asl band sifatida sanalmaydi.

- SEC-01.04: 243 protected HTTP action uchun explicit role admission map; noma’lum endpoint/usul default403; barcha rolda allow/deny policy inventory, haqiqiy HTTP deny va production browser regression qabul jarayonida.
- POS-02.09 core: migration109 orqali atomik immutable historical receipt identity; eski posted tarixga taxminiy backfill yo‘q. Tokenli elektron receipt yetkazish SMS/e-mail vendor tanlanmaguncha qoladi; ushbu band hozir `done` deb sanalmaydi.
- BIZ-02.07: mahsulot egasining retention/yopish qarori ADR-062 da saqlandi. Core implementation uchun ruxsat bor; avtomatik qaytarib bo‘lmaydigan o‘chirish va yakuniy huquqiy toifalar `blocked_external`. Qaror implementation/done dalili emas.

Qabul dalillari yakuniy testlar tugagach shu bo‘limga qo‘shiladi. Ushbu yozuv +20 maqsad bajarilgani haqida da’vo qilmaydi.

### SEC-01.04 yakuniy qabul — 2026-10-10

Ushbu +20 bosqichda hozir **1/20** asl band qabul qilindi. Asl `done`: **153 → 154**; maqsad173 hali bajarilmagan. POS-02.09 snapshot core o‘zgarishi qo‘shimcha asl band sifatida sanalmaydi. BIZ-02.07 bo‘yicha ADR-062 — tasdiqlangan qaror, implementation emas.

Kirish: isolated PostgreSQL pos_test, owner/admin/cashier live sessions;243 protected exported HTTP actions, foreign organization/branch, revoked sessions, new/unreviewed URLs, original cash checkout/reprint and later identity edits. Kutilgan va haqiqiy: explicit roles admit; noma’lum rol/path/method403; denied HTTP handler yoki business operation ishlamaydi; foreign tenant/branch403/404; revocation401; live owner positive reads200; one paid sale/payment/stock effect remains unchanged on print/replay. Har declared action uchun policy allow/deny va unknown-role server assertion; sensitive independent role examples, complete negative HTTP inventory and production browser actual role flows. Matrix admission, final DAL authorization emas.

Tekshiruvlar: full integration253/253 (final HEAD fallback, duplicate policy removal and readiness109 fault injectiondan oldingi compilation); shu oxirgi source uchun focused16/16, unit25 files, Chromium/Firefox/WebKit12/12; production webpack build, lint, typecheck, worker build PASS.109 fresh/legacy migration PASS, legacy sale snapshotNULL/total2.99 saqlangan. Migration faqat isolated bazalarda; production ma’lumot o‘zgarmadi. Source/log SHA256 va source commit+working-tree evidence: `tasks/evidence/permission-receipt-20261010.json`. AI commit yaratilmagan.

Birinchi full suite249/250: old test unreviewed `/operations/boundary` orqali error mappingni chaqirgan; haqiqiy admitted `/operations/cancel` bilan test tuzatildi. Birinchi browser native-print lifecycle/dialog, keyingi browser80mm yangi iframe yozilishini kutmaslik sababli10/12; test-only native dialog stub va real srcdoc condition bilan yakuniy12/12. Fizik printer muvaffaqiyati da’vo qilinmaydi. Birinchi sandbox build/generate client hosil qilmagan; accepted generation/build escalation bilan qayta o‘tgan. Bu xatolar yashirilmagan.

Keyingi core ishlar: USR-01.06 custom-role matrix/UI, SEC-02.06 TOTP/global critical-action enforcement, inventory valuation/lot/serial, landed-cost apply, full export/UX hamda ADR-062 retention/read-only/yopish/bekor qilish. Vendor, pilot, staging/offsite/on-call va yakuniy huquqiy qabulga bog‘liq bandlar tegishli tashqi dalilsiz done emas.

### BIZ-02.07 retention konfiguratsiyasi qabul — 2026-10-10

ADR-062 asosidagi core konfiguratsiya tayyor: migration110 dastlabki90/30kun va proposed5yil, audit/technical/backup NULL; immutable policy versiyalari, actual platform-admin tahriri, live authorization, owner uchun ichki author/reasonsiz no-touch GET, haqiqiy obuna davridan review sanasi. Legacy tashkilot sanasi taxmin qilinmaydi; yangilangan obuna uchun qayta hisoblanadi. Review sanasi o‘chirish ruxsati emas. API automaticDeletionEnabled=false, legalPolicyStatus=review_required, closureAvailable=false.

Pointer row lock va Serializable retry bilan sakkiz parallel reviewed editdan bittasi qabul, yettitasi RETENTION_POLICY_CHANGED. Original-key replay bitta version/audit, changed payload409, revoked authority403; audit xatosida version/pointer/operation birga rollback. SQL tarix tahriri, pointer rollback/delete va forged authorni rad etadi. UI review/confirm va lost-ACK reload/replay uch brauzerda asl key bilan ishlaydi.

Gates: full PG258/258 (326635ms), oxirgi no-touch GET/row-lock hardeningdan oldingi compilation; final-source focused11/11 (6172ms), unit62/62 (26files), production HTTPS Chromium/Firefox/WebKit6/6 (14.4s), final webpack build va lint PASS. Fresh+legacy migration110 PASS. Worker build/typecheck oldingi bosqichda PASS; final production build ham typecheckni o‘tkazdi. Isolated bazadagi test sozlamalari yangi auditli versiya orqali dastlabki qiymatlarga qaytarildi; immutable history qayta yozilmadi. Evidence: `tasks/evidence/retention-policy-20261010.json`; contract: `docs/operations/retention-policy.md`.

BIZ-02.07 **in_progress**, yangi asl done yo‘q: jami154; joriy +20 so‘rov1/20,19qolgan. Full tenant export/manifest, owner reauthenticated yopish/bekor qilish va barcha faol business-write read-only cheklovi hali bajarilishi kerak. Huquqiy toifalar va irreversible deletion blocked_external. Ushbu konfiguratsiya mavjud purge oqimlarini avtomatik o‘zgartirmaydi; live biznes DB, deploy, real vendor/hardware yoki AI commit yo‘q.

### BIZ-02.07 tenant biznes eksporti core qabul — 2026-10-10

Mavjud fon navbati va workerga tenant_export turi qo‘shildi. Owner/password sessiyasi, original operation replay, tenant/all-branch scope, bitta RepeatableRead snapshot, JSON/manifest/row counts/dataset SHA256; Decimal string va binary base64.106 modelning85tasiga reviewed biznes scope,21tasiga ochiq omission. Schema fingerprint yangi model yoki scalar maydonni reviewisiz eksport qilishni rad etadi. Session/password/PIN/auth/invitation/worker/provider state va credential javobi saqlashi mumkin bo‘lgan Operation result chiqarilmaydi. Audit metadata qoladi; ichki JSON/proof/diagnostics omissionlari manifestda ko‘rsatiladi. Bu database restore/backupi emas.

Artifact va succeeded/audit bitta tranzaksiya; failed late audit artifact/successni rollback qiladi, original job keyingi urinishda bittagina artifact yaratadi. Worker boshida/yakunida authorization, downloadda actual owner/password/live tenant tekshiriladi. Jami100000qator/16MiB chegaradan oshsa qisman fayl berilmaydi; aniq dead EXPORT_TOO_LARGE, schema/corruption ham dead.25ta512KiB binary fixture bilan overflow/no artifact/no sale tekshirildi.24soat artifact va32MiB active organization kvotasi mavjud mexanizmda; biznes qatorlari o‘chirilmaydi. `/jobs` UI lost-ACK reload/replay va haqiqiy worker downloadni qo‘llaydi; mavjud CSV saqlangan.

Final gates: PGfull **262/262**,334705ms; unit **64/64** (27files),1379ms; production HTTPS Chromium/Firefox/WebKit JSON+CSV **6/6**,14.5s. Final webpack build, worker build, lint, typecheck va git diff check PASS. Fresh+legacy migrations **112** PASS. Migration111 isolated DBga applied bo‘lgach yangi error code historical SQL check tomonidan rad qilindi; additive112 bilan tuzatildi,111 qayta yozilmadi. Oldingi compile readonly-type va binary-fixture mime xatolari yakuniy acceptance emas; corrected final regression qabul qilindi. Evidence: `tasks/evidence/tenant-export-20261010.json`; contract: `docs/operations/tenant-export.md`.

Yangi original done **0**; jami **154**, joriy +20 **1/20**,19qolgan. BIZ-02.07 in_progress: owner reauthentication bilan yopish/bekor qilish, umumiy business-write read-only va huquqiy legal hold/toifa qabul qoladi; documented limitdan katta eksportga ham keyingi arxitektura kerak. Irreversible deletion blocked_external. Live biznes DB, real vendor/hardware, deploy yoki AI commit yo‘q.

### BIZ-02.07 subscription read-only core qabul — 2026-10-10

ADR-062 grace tugagach reviewed biznes yozuvlarini yopish talabi joriy qilindi:74 business-table SQL guard, root/child FK scope, eski/yangi tenant tekshiruvi; runOperation yangi workdan oldin va terminal Operation INSERTda entitlementni tekshiradi. Wall-clock UTC expiry ish davomida tugasa product/payment/stock va operation rollback. Original committed actor/hash result expiry paytida ham olinadi; revoked actor/hash mismatch/cancelled key chegaralari saqlanadi. GET billing businessWritesAllowed flagi va `/billing` aniq read-only xabari bor. Legacy enrollment yo‘q tashkilotlar avtomatik bloklanmagan.

Billing renewal/export/reconciliation/auth/security/support/platform recovery exact exceptions bilan qoladi. Exception operation ichidagi Product yozuvi DB guarddan o‘tolmaydi. Expired owner JSON eksport qiladi va auditli manual-bank SaaS renewal bilan biznes yozuvi tiklanadi; POS Payment0. Muddati tugagan manual rezerv faqat system expire/remaining0/status expired housekeepingga ochiq, physical quantity o‘zgarmaydi. Unposted sale.create uchun actor/hash-bound cancelled:true tombstone yaratish ochiq; boshqa type/completed state orqali posting bo‘lmaydi. Organization close/cancel emas.

Subscription FOR SHARE stale Serializable snapshotni rad qiladi. Sale quota obyekt emas:115 shared entitlement guard bilan tenant lock upgrade xavfini kamaytiradi; branch/register/staff quota locks va stock/shift/register concurrency saqlanadi.113 applied bo‘lgach polimorf record field scope114 orqali ajratildi;115 row-lock/capacity,116 unposted cancellation compatibility additive. Applied migrationlar qayta yozilmagan. Legacy product/category UnknownRequestErrorning umumiy500ga yutilishi to‘rt route faylida tuzatildi; readonly HTTP409 va SQL secret detail javobda yo‘q.

Gates: schema114 full267/267 (360105ms); schema115 full268/268 (357455ms),116 tor cancellation exceptiondan oldingi bosqich. **Final116 focused58/58** (21102ms: readonly/billing/reservations/economic), unit66/66 (28files), production HTTPS Chromium/Firefox/WebKit readonly+billing+tenant-export **9/9** (18.2s). Final webpack build, worker build, lint, typecheck, fresh+legacy migrations116 va git diff check PASS. Full269/269 final116 run da’vo qilinmaydi; yakuniy o‘zgarish alohida focused va browser bilan qabul qilindi. Birinchi focused11/12dagi HTTP500 failure final58dagi409 testi bilan yopildi. Evidence: `tasks/evidence/subscription-readonly-20261010.json`; contract: `docs/operations/subscription-read-only.md`.

Yangi original done0; jami154, joriy +20 so‘rov1/20,19qolgan. BIZ-02.07 in_progress: owner reauthentication bilan tashkilotni yopish/bekor qilish va closure lifecycle, legal hold/toifa qabul, katta eksport doirasi qoladi. Irreversible deletion blocked_external. Live biznes DB, real vendor/hardware, deploy yoki AI commit yo‘q.

### BIZ-02.07 closure lifecycle qoidalari — 2026-10-10

Yopish/bekor qilish uchun alohida sof core modul qo‘shildi: policy version/kuni va UTC deadline snapshoti, darhol closure business block talabi, deadlinegacha cancellation, deadline onidan review_required. Review hech qachon deletion ruxsati emas. Bekor qilish original event vaqtini saqlaydi va expired subscription imkoniyatini tiklamaydi. Noto‘g‘ri/kelajak snapshot va izchil bo‘lmagan deadline rad etiladi. Caller DB vaqtini, amaldagi owner/reauth vakolatini va transactionni alohida ta’minlashi shart.

Modul hali persistence/HTTP/UI/SQL write guardga ulanmagan; shu sababli **closureAvailable=false** saqlangan. Yangi yopish funksiyasi productionda ishlaydi degan da’vo yo‘q. Keyingi ish owner reauthentication, exported-data presentation, DB snapshot/audit/idempotency, posting race guard, cancellation/export recovery exceptions va acceptance testlaridir.

Tekshiruv: test TypeScript compilation va to‘liq unit **69/69** PASS, targeted ESLint va git diff check PASS. Log `/tmp/pos-closure-phase-unit.log`; contract `docs/operations/closure-lifecycle.md`. DB/migration/browser tekshiruvi yoki production build ushbu bosqichda bajarildi deb sanalmaydi. Asl done o‘zgarmadi:154; +20 bosqich1/20. BIZ-02.07 in_progress. Tashqi integratsiya, live DB o‘zgarishi, deletion, deploy va AI commit yo‘q.


## Yangi +20 so‘rov — 2026-10-10 (closure davomidan keyin)

So‘rov boshidagi asl PLAN1 done154; maqsad174. Ushbu yangi so‘rovda hozir0/20 original band done. Oldingi1/20 hisobi oldingi bosqichga tegishli. BIZ-02.07 closure core va test scenariolari alohida original band sifatida sanalmaydi.20ta done hali bajarilmagan; tashqi vendor/pilot/huquqiy qabulni uydirish yoki subtasqlarni20ga bo‘lish yo‘q.

BIZ-02.07 closure implementation qabul jarayonida:117–118 SQL, owner current password, downloaded tenant export, close/cancel snapshots, audit/idempotency, snapshot/tenant lock fence, HTTP/UI va billing allowance qo‘shildi. Yakuniy qabul testlar tugagach yoziladi. Real biznes DB, deploy, deletion yoki vendor implementatsiyasi yo‘q.


### BIZ-02.07 organization closure/cancellation core qabul — 2026-10-10

Owner/password session va fresh current password bilan close/cancel, faol downloaded tenant artifact/sha256 hamda owner download audit dalili, strict schemas, reauth5/15min, immutable policy/deadline/history, operation/audit atomikligi. Parol operation payload/hash/result/audit/storagega kirmaydi. Original replay live owner/current password/actor/hashni qayta tekshiradi. Ochiq shift/draft/unresolved provider/issued offline lease closure409; tarix yoki biznes yozuvlari yo‘qolmaydi. Bu password reauthentication, MFA emas.

117–118 SQL partial active unique, owner/source/reason/deadline guard va Organization.closureRevision tuple fence bilan close/cancelni shared business-write checksga tartiblaydi. Stale Serializable snapshot retryga boradi.74 business table va terminal operation closure holatini rad qiladi; exception type Product yozuvini ochmaydi. Cancel expired subscriptionni yangilamaydi. DB clock deadline tekshiruvi backdated cancellationni rad qiladi; review vaqtida retained Product qoladi va automaticDeletionEnabled=false. Late audit failure closure/revision/operationni birga rollback qiladi. OrganizationClosure metadata eksportga qo‘shildi, ichki revision omit;107 model explicit classifications/schema fingerprint review qilingan. Apply qilingan117 qayta yozilmadi, source/terminal/reason hardening additive118.

GET no-touch/read-only; password/session/membership locks faqat mutation/replayda. Dastlab browser reload parallel session touchesda GET500 topdi; readonly Session locki olib tashlandi va8parallel actual touch+HTTP GET regression qo‘shildi. Keyingi browser6/9 failure testning replay ACK tugamasidan storageNullni tekshirishidan bo‘ldi; actual ACK condition bilan yakuniy9/9. UI public intent/keyni saqlaydi, reload/retry fresh parol bilan; current billing allowance closure blokini ham hisoblaydi.

Gates: full PostgreSQL **275/275**,362108ms (qo‘shimcha4 case va GET-race tuzatishidan oldingi source); **final focused26/26**,11998ms (closure10 + read-only7 + retention5 + export4), **unit69/69**,1408ms. Production HTTPS Chromium/Firefox/WebKit closure+read-only+export **9/9**,21.2s. Final webpack build, lint, worker build, typecheck, fresh+legacy migrations118 va git diff check PASS. Full279/279 final source run da’vo qilinmaydi; final source focused va browser bilan qabul qilingan. Qo‘shimcha expired subscription testi birinchi urinishda actual trial history resetni to‘g‘ri rad qildi; production invariant o‘zgartirilmasdan isolated legacy enrollment fixture bilan tuzatildi.

Evidence `tasks/evidence/organization-closure-20261010.json`; contract `docs/operations/closure-lifecycle.md`, API `api.md`. Yangi original done0; jami154; ushbu yangi+20 so‘rov0/20, maqsad174 hali bajarilmagan. BIZ-02.07 in_progress: katta eksport va yakuniy legal hold/toifa qabul qoladi; irreversible deletion blocked_external. Real biznes DB/migration/deploy, vendor/hardware implementatsiyasi, avtomatik o‘chirish va AI commit yo‘q.

### 2026-10-10 — Audit matnli ID va credential response himoyasi

Audit entityId endi faqat UUID bilan cheklanmaydi: 1–200 belgili exact matn; whitespace-only/control/oversized qiymatlar400. ActorId UUID talabi saqlangan. Parametrli filtr, tenant isolation va permissionlar o‘zgarmagan. Recursive response sanitization secretHash/sealedSecret/deliveryLease/leaseToken, OTP/verification/recovery kodlari va TOTP secret/seedning case/snake/kebab shakllarini ham olib tashlaydi. Oddiy error code, cookie-session marker, challenge metadata va offline public signature/publicKey saqlanadi.

Qabul: unit **70/70**, focused PostgreSQL **22/22** (foundation/auth-challenges/offline-cash), targeted ESLint va git diff check PASS. Matnli entityId actual HTTP200; boshqa tashkilotga0qator; SQL ko‘rinishidagi matn filter scope’ni kengaytirmaydi; nested credential payload javobda yo‘q. Loglar `/tmp/pos-audit-credentials-unit.log`, `/tmp/pos-audit-credentials-integration.log`, `/tmp/pos-audit-credentials-lint.log`; evidence `tasks/evidence/audit-credentials-20261010.json`. Bu bosqichda production build/browser/full integration qayta bajarilgan deb da’vo qilinmaydi.

Yangi original done0; jami154; joriy +20 original maqsad0/20,174 hali erishilmagan. Bu mavjud xavfsizlik bandining regression tuzatishi, alohida original done emas. Real biznes DB, vendor/hardware, deploy va AI commit yo‘q.

### 2026-10-10 — yangi +20 so‘rov: TOTP xavfsiz core

Baseline154 original done; target174. Ushbu so‘rovda yangi original done0/20. SEC-02.06 in_progress: bu core qismini alohida original band qilib sanash yo‘q.

T07 cheklovi sabab OTPAuth9.5.2 MIT exact dependency qo‘shildi (transitive @noble/hashes2.4.0); install scripts/audit submission o‘chirilgan. RFC6238/SHA1 test vektorlari,2038dan keyingi vaqt,6raqam/30s/±1window, replaycounter, random160bitseed, user/factor-bound AESGCM/HKDF tekshirildi. Maintained library mustaqil auditdan o‘tganlik da’vosi emas. TotpFactor/Proof schema va immutable/counter/live-approval SQL119–120; DB read-only exemption va credential export omission/fingerprint yangilandi. Readiness120/91required migration names.

Fresh password/live password session enrollment; pending10min va5wrongattempt; per-user lock bilan one-code-one-proof; stepup action/key/hash/session/currentpassword binding;5min proof va samebinding replay. Parol/URI/secret auditga yozilmaydi; audit failure confirmation/counter/proofni rollback qiladi. Factor revoke va password change proofni bekor qiladi. `auth/delivery` hali totp:false; HTTP/UI/global MFA rollout qo‘shilmagan. Recovery/disable/key rotation va critical enforcement qoladi. Contract `docs/operations/totp-core.md`.

Qabul: unit73/73, final focused PostgreSQL24/24 (TOTP6+auth challenges7+tenant export4+subscription readonly7); production webpack build, worker build, targeted ESLint va git diff check PASS. Fresh/legacy120 migration PASS: `/tmp/pos-totp-migrations.log`. Birinchi fixture actual Session identityni tahrirlashga urindi, DBguard rad etdi; fixture revoked/current/secondpassword/actualPIN sessionlar bilan tuzatildi. Keyingi PIN fixture oddiy hash string bilan SQL format constraintni rad etdi; actual bcrypt ishlatildi. Production guardlar yumshatilmadi.

Evidence `tasks/evidence/totp-core-20261010.json`. Real biznes DB/migration/deploy, SMS/e-mail/hardware/vendor yoki AI commit yo‘q. Original +20 hali bajarilmagan.

### 2026-10-10 — TOTP recovery, HTTP/UI va umumiy step-up bridge

SEC-02.06 in_progress. Confirmation10random128bit365day backup kodni bir marta ko‘rsatadi; TotpRecoveryCode faqat purpose/factor-bound SHA256 saqlaydi, SQL121 source/expiry/one-use guard. Fresh password+new TOTP rotation eski amaldagi kodlarni invalid qilib10yangi kod beradi. Recovery current password+backup bilan factor/sealedSecret/code va barcha sessiyalarni atomik revoke qiladi, har faol tashkilotda safe audit; audit fault hammasini rollback. Password changed holatda yangi password session+backup bilan replacementga chiqish yo‘li bor. User→Session lock concurrent recoverydan bittagina success/audit/codeconsume beradi. Current password UTF8≤72bayt; bcrypt truncate ekvivalentlari rad.

Own-account no-touch status va6reviewed HTTPaction (jami254). Default AUTH_TOTP_ENABLED=false; flagtrue+private64hexkey bo‘lsa available, aks holda POST503. SMS/e-mail registry bo‘shligicha qolgan. Common response passwordDigest/provisioningUri/recoveryCodesni ham filtrlaydi; faqat explicit exact POST-success enroll URI va confirm/rotate10uniquevalidcode DTO bir martalik ko‘rsatishga ruxsat oladi. Hash/sealedsecret/unknown route/method/error/malformed credential hech qanday blanket bypass olmaydi.

`/security` React memory-only enrollment/recovery/rotation; secret/kod/parol local/sessionStorage/IndexedDBga yozilmaydi. Per-request password/input code clear, double submit synchronous latch, reloadda secret retrieval yo‘q, explicit save-ack backup clear. Lost confirmation ACK actual statusni ko‘rib seedni tozalaydi; codeslost holatda next fresh TOTP+password rotation. Recovery local pending offline intent bo‘lsa logoutdan oldin UI rad; server recovery business historyni o‘chirmaydi.

General assertStepUp opt-in TOTP proofni qo‘llaydi: actual runOperation authorizationda late audit failure proof approval/business Category/Operationni birga rollback; originalkey retry/replay1result/1category/1operation. Global critical-action/platform enforcement va encryption key rotation hali yo‘q; login MFA majburiy emas. Original done154, ushbu+20 bosqich **0/20**, target174 erishilmagan. Core scenariolarni alohida original done qilish yo‘q.

Qabul loglari final evidencega yoziladi: unit75/75; PostgreSQL45focused; HTTPS3browser6/6; production webpack, worker, targeted lint, fresh/legacy121, local secret scan va diff check. Fullintegration qayta bajarilmagan. Avvalgi120-core evidence tarixiy snapshot; yangi121 HTTP/UI/recovery dalili `tasks/evidence/totp-recovery-20261010.json`. Contract `docs/operations/totp-core.md`. Live biznes DB, deploy, vendor/hardware, irreversible deletion va AI commit yo‘q.

TOTP recovery outage exception: old enabled faktor uchun kalit/featureflag yo‘q bo‘lsa ham own safe metadata/recoveryAvailable va backup recovery ochiq. Actual HTTP test key/flagni olib tashlab enroll/proof503, recovery200 va all-session revoke dalilini tekshiradi. UI unavailable metadata fault injection bilan rotationdisabled/recoveryvisible, actual HTTP backup recovery saqlangan. Bu yangi factor/proof yoki fakeproduction delivery imkoniyatini ochmaydi.

### SEC-02.06 — TOTP kalit overlap primitive (2026-10-10)

Boshqariladigan ikki eski kalit bilan identity-bound o‘qish, faqat joriy kalit bilan yozish, noto‘g‘ri konfiguratsiya va missing-current-key fail-closed tekshiruvlari qo‘shildi. `npm test` PASS (31 unit test fayli, 0 failed), targeted ESLint PASS; log `/tmp/pos-totp-key-overlap-unit.log`. Unit regression eski faktor o‘qilishi, begona identity rad, yangi ciphertext eski kalitsiz o‘qilishi, eski ciphertext overlap olib tashlanganda rad va konfiguratsiya limitlarini tekshiradi. DB migration, live DB yoki production secret o‘zgarishi yo‘q.

Operator orqali atomik qayta shifrlash, rollout va global critical-action/platform MFA enforcement ochiq. SEC-02.06 done emas; original done154, +20 hisob0/20. Ushbu primitive alohida original vazifa sifatida hisoblanmaydi.

### SEC-02.06 — rotation configuration fail-closed qabul

Old key overlap konfiguratsiyasi endi yagona `totpKeyConfiguration` contract orqali status, seal va unseal uchun tekshiriladi. Noto‘g‘ri overlap mavjud deb ko‘rsatilmaydi, enrollment 503 qaytaradi va faktor yaratmaydi. Backup recovery availability guardga bog‘lanmagan holda saqlanadi. Unit31 test fayli PASS, TOTP PostgreSQL/API13/13 PASS, targeted ESLint va diff check PASS. Dalil: `tasks/evidence/totp-key-configuration-20261010.json`. Full suite/build/browser ushbu o‘zgarishda qayta bajarilmadi. Operator re-encryption va global critical/platform MFA ochiq. Original154done, yangi0/20; target174 hali bajarilmadi.

### +20 bosqich — birinchi original band qabul qilindi (2026-10-11)

BIZ-02.01 platforma boshqaruv paneli done. Mustaqil faol platform_admin + password session + majburiy action/key/hash/session-bound MFA; default critical flagdan mustaqil panel read. 20lik tenant search/page, DB-backed tariffs/subscription/read-only/closure holati, bounded20 incident metadata; no phone/email/evidence/secret/provider payload. Global read result Operationga saqlanmaydi; har read atomik audit. Akkaunt/tashkilot/rol almashsa UI snapshot reset; denied/revoked request eski ma’lumotni tozalaydi.

Final full PostgreSQL296/296 PASS,36538ms focused29/29 PASS,32 unit test fayli PASS, uch browser platform3/3 PASS; critical action/TOTP browser regressiyalari9/9 PASS. Production webpack, worker, ESLint, secret scan770files0findings va diff check PASS. Birinchi full run292/295 edi: source endpointni running inventoryga qo‘shish compile race2 va vaqt chegarasida yangi code generatsiyasi sabab1 fixture xatosi; tuzatilib final full qayta o‘tdi. Browserdagi WebKit strict-locator xatosi app main bilan cheklangan; final3browser qayta o‘tdi. Security guardlar yumshatilmadi.

SEC-02.06 markaziy12operation MFA va dashboard proof/retry oqimi endi bor; flag defaultfalse, outage/invalidconfig failclosed, proof platformpriv bermaydi, late rollback/replay tekshirildi. Global barcha dangerous mutation inventory, kalit operator rotation va restore credential invalidation ochiq; SEC hali done emas.

Boshlanish154 original done; hozir155; ushbu+20 **1/20**; target174 hali bajarilmadi. Core subtasklar alohida original band sifatida hisoblanmadi. Live biznes DB, productionsecret, deploy, vendor/hardware va AI commit o‘zgarishi yo‘q.


### +20 bosqich — ikkinchi original band qabul qilindi (2026-10-11)

USR-01.06 done. SQL122 CustomRole tenant composite FK, owner source/base-role/revision immutability, soft inactive history, read-only/closure va session-revocation trigger. Mavjud owner/admin/cashier saqlanadi; maxsus profil faqat asosiy rolga ruxsat etilgan reviewed endpoint subsetni ochadi. Owner egani profil orqali bermaydi; oxirgi owner himoyasi saqlangan. Shaxsiy auth va organization switch saqlanadi, branch/resource/extra platform approval davom etadi. Nofaol profil yangi sessiyani rad qiladi; rol o‘zgarsa eski session/context rad. Admin endpoint maydonlari field-level siyosat bilan cheklanayotgani da’vo qilinmaydi.

Owner `/roles` sahifasida 20lik qidiruv/page, aniq namunalar, permission editor, reason/expectedRevision/immutable baseRole va xodimga assignment bor. Mavjud xodimlarga avtomatik profil yo‘q; profilni olib tashlash huquq kengayishi ekanligi ko‘rsatiladi. Original-key create/update replay, concurrent edit one winner, late audit fault → role/session/Operation rollback, own/foreign tenant, assigned/unassigned branch, owner/cashier escalation deny va subscription read-only tekshirildi.

Qabul: final full PostgreSQL302/302 PASS (385660ms), unit33/33 test fayli PASS; oldingi focused20/20 va final full ichida role6/6 PASS. Chromium/Firefox/WebKit owner-create/assign→staff allow/deny→edit→logout/new-permission 3/3 PASS (10.3s). Production webpack, typecheck, worker, targeted lint, fresh/legacy122 migration acceptance, secret scan781source0findings va diff check PASS. Browser topgan create-body isActive ortiqcha maydoni va select accessible nomi tuzatildi; testdagi products organizationId majburiy filtri qo‘shildi. Birinchi role HTTP testi JSON sarlavhasini qo‘shib to‘g‘rilandi; expired fixture yangi14daytrialdan alohida eski tashkilot sifatida yaratiladi. Production guardlar yumshatilmadi.

Dalil `tasks/evidence/custom-roles-20261011.json`, contract `docs/operations/custom-roles.md`, ADR070. HEAD97ded93d1c62c4a4180607d6686bf82395701ee2 + source-hashlangan ishchi daraxt; AI commit yoki deploy yo‘q. Baseline154; original done156; joriy +20 **2/20**, target174 hali bajarilmagan. SEC-02.06 yangi profile create/edit ham markaziy MFA ro‘yxatiga kiritildi, jami14 type; ownership/member mutation inventory, operator rekey va restore credentials qabul ochiq.


### SEC-02.06 operator re-encryption core qabul (2026-10-11)

SQL123 immutable TotpKeyRotation provenance bilan sealedSecret-only transitionga ruxsat beradi; old/new envelope SHA256, target key fingerprint, actor/batch/reason; hech qanday plaintext key/ciphertext auditga yozilmaydi. Operator CLI no HTTP, inherited env, exact DB confirmation, active platform grant, default counts-only check, valid explicit maintenance apply. 100lik cursor va per-factor transaction/target+operator User locks, no counter/code/factor identity change. Interrupted/concurrent rerun already-current envelopega qayta yozmaydi. Old key yo‘q yoki audit fault bo‘lsa ciphertext saqlanadi/rollback, unauthorized actor yozmaydi.

Qabul: focused38/38 (32387ms), unit33test fayli PASS, uch browser TOTP+critical9/9 (22.5s), fresh/legacy123, webpack, worker, targeted lint, source scan787files0findings, diff check PASS. Yangi auth operational model uchun export omission va read-only exemption aniq ko‘rib chiqildi,112-model schema hash yangilandi. Birinchi unit inventory yangi modelni tasniflash talabini to‘g‘ri topdi; exemption/omission bilan qayta33/33 o‘tdi. CLI test unconfirmed DB/no maintenance rad, real test-DB apply→independent check0pending/0failedni tekshiradi. Full schema123 suite qayta bajarilgani da’vo qilinmaydi; oldingi schema122 full302 alohida qabul.

Dalil `tasks/evidence/totp-operator-rekey-20261011.json`, operator contract `docs/operations/totp-key-rotation.md`. SEC-02.06 in_progress: qolgan permissions/ownership critical inventory va restored credential invalidation qabul ochiq. Original done156, +20 **2/20**; yangi original band sifatida sanalmadi. Real .env/key/provider/hardware/deploy va AI commit yo‘q.

### SEC-02.06 xodim/egalik MFA core — 2026-10-11

Markaziy siyosat 20 actionga kengaydi: yangi xodim, member update, taklif create,
egalik request/accept/cancel ham UUID operation va exact session/action/payload
proof talab qiladi. Grant, session revoke va audit rollback atomik. Staff create
parolni private HMAC bilan bog‘laydi; raw parol/hash Operation resultga kirmaydi.
Invitation parallel replay bitta manba yaratadi, token faqat original commitda
beriladi; replay metadata orqali bekor qilib qayta chiqariladi. Egalik accept
session tokeni saqlangan operation natijasiga yozilmaydi.

Nested MFA dialog priority/inert/focus/Escape/scroll lock tuzatildi. Settings
va role assignment bir xil failed intent uchun operation UUIDni saqlaydi.
Focused 28/28, unit 33/33 test files, Chromium/Firefox/WebKit 9/9, production
webpack build, typecheck, full lint va secret scan789/zero o'tdi. To‘liq
integratsiya 311/311 o‘tdi. Dalil: `tasks/evidence/permission-grant-mfa-20261011.json`;
source va test log SHA256 bilan qabul qilindi.

SEC-02.06 hali in_progress: restored credential invalidation va qolgan xavfli
mutation inventory/qabul ochiq. Original done156, +20 hisob2/20 saqlanadi;
ushbu core bosqichni qo‘shimcha original done sifatida sanamadik. Tashqi
provider/hardware adapterlar, real .env/kalitlar, deploy va AI commit yo‘q.

### SEC-02.06 yakuniy core qabul — 2026-10-11

Yangi +20 so‘rov baseline156, target176. SEC-02.06 original done157, ushbu so‘rov **1/20**; 19 band qolgan. Ichki test yoki subtask alohida original vazifa sifatida sanalmadi.

Restore ikki transaction bilan ishlaydi: avval authentication quarantine commit, so‘ng eski session/factor/challenge/invitation revocation. Sweep xatosida gate yopiq qolishi va retry tekshirildi. Review eski credentiallar tugatilmaguncha DB guard orqali rad; owner/admin password change aniq payload MFA va audit fault rollback bilan tekshirildi. Password/PIN hamda access reconciliation operatorning mustaqil dalili bilan bajariladi; tiklangan tarixdagi eski vakolatni kod avtomatik to‘g‘ri deb qabul qilmaydi.

Dalil `tasks/evidence/critical-mfa-restore-20261011.json`: full313/313 (keyingi qo‘shimcha restore failure testdan oldingi snapshot), focused35/35, oxirgi CLI2/2, unit33, Chromium/Firefox/WebKit15/15, webpack/worker/typecheck/lint, fresh/legacy125, encrypted fixture backup/restore PASS. Haqiqiy production qabul yoki deployment yo‘q. Onboarding qo‘llanmasi `docs/operations/onboarding-guide.md` tayyor; real pilot talab qiladigan RELEASE-01.09 done emas.

### Tashqi muhitlar bo‘yicha foydalanuvchi qarori — 2026-10-11

Real staging/production serverlari, domen/TLS, off-site backup, monitoring provayderi va pilot tashkilotlar tasdiqlanmagan. Ularga bog‘liq yakuniy qabul `blocked_external`; texnik tayyorgarlik va izolatsiyalangan test alohida yoziladi. Docker/env ajratilishi, TLS konfiguratsiyasi, backup/restore/monitoring va deployment/rollback yo‘riqnomalari davom ettiriladi. Foydalanuvchining alohida tasdig‘isiz haqiqiy production deployment bajarilmaydi. Uydirma manzil, pilot yoki tashqi qabul dalili yaratilmaydi.

### Deployment texnik tayyorgarligi — 2026-10-11

Base Compose runtime auth/MFA/old-key/IP trust/API budgetni app, jobs va reconciliationga uzatadi. Release overlay majburiy TOTP/MFA va nonempty auth key; alohida staging/production project/database namunalari. Private0600/no-symlink uch-env checker bir xil DB/parol/active+overlap key, >2 old key, invalid MFA/loopback/immutable image konfiguratsiyasini rad etadi. DNS alias va haqiqiy host/network/secret-store izolatsiyasi operator tomonidan tekshiriladi.

`docs/operations/deployment-readiness.md`: deployment/rollback, TLS nginx template, restore quarantine, readiness/pilot checklist; `ops/systemd/`: encrypted backup va readiness/disk timers. Units o‘rnatilmagan, nginx actual syntax/TLS/host qabul hali tashqi. Off-site nusxa adapteri, SLA yoki avtomatik delete taxmin qilinmadi.

Qabul: environment checker6/6, barcha profillar bilan synthetic Compose render, missing-key rad, ESLint/diff PASS. Render secretlar faqat subprocess xotirasida; haqiqiy `.env` ochilmadi va konteyner ishga tushirilmadi. Dalil `tasks/evidence/deployment-preparation-20261011.json`. Original done157, joriy so‘rov1/20 saqlanadi: tashqi acceptance kerak bo‘lgan OPS/PILOT/RELEASE bandlari faqat config/hujjat bilan done qilinmadi.

Production startup invalid MFA flag, missing enabled key, required-MFA/TOTP mismatch, malformed/>2/duplicate overlap keyni safe error bilan rad etadi. Legacy defaultfalse yoqilmagan funksiyalarni o‘zgartirmaydi; release overlay ikkala flagni true beradi. CIga `npm run test:ops` qo‘shildi; restore CLI integration service konteynerini `POS_TEST_PSQL_CONTAINER` orqali tanlaydi (mahalliy default isolated konteyner). Yakuniy portable restore2/2, ops8/8, unit33fayl va focused lint/worker PASS; actual CI run emas.

Yakuniy deployment-prep qayta qabul: URL-encoded bir xil DB target ham rad; isolation7/7, ops9/9, unit33fayl, portable restore2/2, production webpack/worker/typecheck/focused ESLint PASS. Read-only secret scan815fayl/0findings (git history/images/credential store scopega kirmaydi). Bu image build yoki haqiqiy deployment emas. Dalilning current source/log SHA256lari yangilandi. Original157, so‘rov1/20; qolgan19 avtomatik yopilmadi.

### Hisobot/hodisalar pagination va filial scope regressiyasi — 2026-10-11

Replenishment va incidents umumiy `paging` validatoriga ulandi: positive safe integer page, limit1–200, offset≤2147483647, invalid400. Replenishment optionalUUID storeIdni shu transactiondagi live context va tenant/assigned filial bilan tekshiradi; foreign/hidden404, invalidUUID400. Rows va total bir xil filial filter/snapshotda. Incidents limit haqiqiy take/offset va javob paginationiga tatbiq qilinadi, default20 saqlanadi.

Qabul: reports-finance66/66; keyingi qo‘shimcha assertions bilan focused1/1 (admin limit1 ikki alohida sahifa, total2, hidden incident tashqarida, revoked cookie401), unit33fayl, focused lint/diff PASS. Dalil `tasks/evidence/report-pagination-20261011.json`. Database migration, vendor adapter yoki haqiqiy deploy yo‘q. REP-01.07 hali expiry/slow-moving sabab in_progress; ushbu fix alohida original band hisoblanmadi. Original157, joriy +20 1/20 saqlanadi.

Ushbu checkpointning yakuniy typecheck va worker build tekshiruvi ham PASS; log hashlar report-pagination daliliga qo‘shildi.

### REP-01.07 savdosiz qoldiq core qabuli — 2026-10-11

Mavjud balances APIga inactiveDays1–3650 filtri; UI30/60/90 tanlovi va aynan shu CSV filter qo‘shildi. Musbat joriy qoldiq, branch/product bo‘yicha completed/partially_returned/returned aktivlik, N×24soat rolling oyna. Draft/held aktivlik emas; 31kun oldingi sale30kunlik oynadan tashqarida: mahsulot natijaga kiradi;60kunlik oynada esa shu sale aktivlik bo‘lib mahsulot natijadan chiqadi. NULL/future completion timestamp konservativ ravishda savdosizlikdan chiqariladi. Bu physical stock age, reservation available, tarixiy stock rekonstruksiyasi yoki FEFO emas; yangi kirim hali sotilmagan mahsulot ham chiqishi mumkin.

Counts, rows va CSV bir xil RepeatableRead scope/filter; normal balans ro‘yxati unchanged, default meta current_stock_snapshot. Qoldiq/tannarx Decimal string, CSV formula escape va10000cap saqlangan. Read-only report: posting, migratsiya yoki vendor integration yo‘q. Contract `docs/operations/inventory-inactivity.md`.

Qabul: finance67/67 (yakuniy metadata label/60kun assertdan oldingi snapshot), oxirgi focused1/1 metadata+30/60oyna, unit33file, Chromium/Firefox/WebKit3/3 UI/CSV, production webpack/worker PASS; dalil `tasks/evidence/inactive-stock-20261011.json`. UI request sequence/filial scope/filter reset saqlandi. REP-01.07 hali expiry qismi uchun in_progress; original157, joriy +20 1/20 o‘zgarmadi. Haqiqiy production deployment/pilot yo‘q.

Yakuniy typecheck/lint/diff PASS; read-only secret scan819fayl/0findings. Scope working-tree source; credential store/history/images ochilmadi. Log SHA256lar inactive-stock daliliga kiritildi.

### Yangi +20 original vazifa so‘rovi — 2026-10-11

Baseline157, target177; oldingi 1/20 hisob tarixiy checkpoint bo‘lib qoldi. Faqat yangi original checkbox done hisoblanadi. Tasdiqlanmagan vendor, hosting, huquqiy yoki pilot qabul blocked_external; core tayyorgarlik original qabul talabini almashtirmaydi. Tenant isolated recovery plan OPS-03.05 birinchi ishlanadigan band.


## OPS-03.05 — isolated tenant recovery rejasining qabuli (2026-10-11)

Yangi +20 hisob **1/20**, jami original **158**, target177. OPS-03.05ning mavjud mezoni isolated cloneda rejalash va boshqa tenant hashlarini saqlash; avtomatik restore/apply yoki production recovery deb talqin qilinmaydi.

- Kirish: faqat local disposable PostgreSQL; ikki tashkilot, shared user, original product va source-only category. Haqiqiy pg_dump→yangi pg_restore clone→auth quarantine.
- Kutilgan/haqiqiy: ikkala snapshot READ ONLY; missing/changed/current-only va FKlar ajraladi, target edit/yangi yozuv saqlanadi, foreign tenant portable-business manifest hashlar oldin/keyin teng. Secret/security datasetlar chiqarilmaydi.
- Migration checksum tampering hamda unfinished migration rad. Wrong DB confirmation/same DB/missing tenant/existing output/unsafe parent rad; private0600 output va stdout SHA binding tekshirildi. Source/target snapshotlar ketma-ket, atomic distributed snapshot emas.
- Qabul: recovery+tenant-export integration **5/5**, unit **33/33 files**, worker/webpack build, typecheck, focused lint va diff-check PASS. Testlar faqat isolated bazada; clone/private dump va scoped fixtures cleanup. Yangi schema migration yo‘q.
- Versiya: HEAD97ded93d1c62c4a4180607d6686bf82395701ee2 + uncommitted worktree; source/log SHA256lar `tasks/evidence/tenant-recovery-20261011.json`da. Full integration suite yoki real server/pilot shu checkpointda bajarildi deb da’vo qilinmaydi.
- Operator qo‘llanmasi: `docs/operations/tenant-recovery.md`; CLI `npm run worker:tenant-recovery-plan`. Reja private casega hash bilan bog‘lanadi, public download emas. Missing tenant raw import, credential/permission rollback, financial journal overwrite, vendor status inference yo‘q.

Qolgan19 bandning barchasi tashqi to‘siq emas: INV-01.07, INV-02.06/07, PUR-01.05, REP-01.07/09 va UX-01.02/03/05 kabi core ishlar ochiq. Server/provayder/pilotga bog‘liq qabul bandlari foydalanuvchi tasdiqlaguncha `blocked_external`; kichik test/subtask alohida original done hisoblanmaydi.


## Navbatdagi +20 so‘rov — baseline158 (2026-10-11)

Target178, hozir0/20. OPS-03.06 core ichida restored provider outboxning eski queued submitni qayta bajarish xavfi tekshirilyapti; real providerda DBdan tashqari qolgan amallarni solishtirish tashqi adapter/dalilga bog‘liq. Original done hisobiga test yoki subtask qo‘shilmaydi.
