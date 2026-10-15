# PLAN1 — Shuni POSni productionga olib chiqishning texnologik rejasi

Sana: **2026-yil 5-oktabr**. Asosiy talablar: [FULL_PROJECT_PLAN.md](./FULL_PROJECT_PLAN.md). Loyiha haqida qo‘llanma: [PROJECT.md](./PROJECT.md).

Bu hujjat **har bir talabni qaysi texnologiyada, qanday tartibda va qanday natijagacha bajarishni** belgilaydi. AIga ushbu rejani amalga oshirish topshirilganda, AI tegishli ilova kodi, test, migratsiya va texnik hujjatlarni yozadi; dependency qo‘shishda quyidagi texnologiya tanlash qoidalariga amal qiladi. Hozirgi tahrir faqat rejani aniqlashtiradi, ilova implementatsiyasini bajarmaydi. Dastlabki texnologik reja loyiha qo‘llanmasi, paketlar va mahalliy Next.js yo‘riqnomalariga asoslangan; tarixiy xatolar ish boshlashda qayta tekshiriladi.

## AI uchun bajarish shartnomasi

Bu bo‘lim bajarish tartibi, status va chiqarish chegaralari bo‘yicha quyidagi tavsiflarni aniqlashtiradi. Talablar o‘chirib tashlanmaydi. Keyingi aniq foydalanuvchi topshirig‘i va repozitoriydagi amaldagi xavfsizlik ko‘rsatmalari ustun. Bu hujjatning o‘zi productionni o‘zgartirish, tashqi xabar yuborish, xizmat sotib olish yoki shartnoma imzolash ruxsati emas.

### Ish boshlash va davom ettirish

1. Amaldagi `AGENTS.md`, ushbu reja va tegishli modulni o‘qi. Next.js kodi oldidan o‘rnatilgan `node_modules/next/dist/docs/`dagi tegishli qo‘llanmani o‘qi. Butun repozitoriyni har vazifa uchun boshidan audit qilish shart emas.
2. Git holatini tekshir; foydalanuvchining o‘zgarishlarini saqla. `.env`/backup credential qiymatlarini javob, log yoki hujjatga chiqarmaslik; konfiguratsiya nomlari va validatsiya natijasini qayd etish kifoya.
3. Implementatsiya boshlanganida `tasks/EXECUTION_STATUS.md` yarat yoki mavjudini davom ettir. Unda har task ID, release, status, kerakli contract, tashqi to‘siq, dalil, commit va keyingi amal bo‘lsin. `tasks/RELEASE_SCOPE.md`da doira, `tasks/DECISIONS.md`da ADRlar yuritilsin. Bu fayllar hozirgi reja tahririda yaratilishi shart emas.
4. Birinchi checkpoint: fresh install/build/typecheck holati, eski xatolar mavjud/yopilganligi va release scope manifesti. Oldindan tuzatilgan bandni qayta yozma; ayni release’da tekshirilgan dalil bilan yop.
5. Bir ish paketida 1–3 o‘zaro bog‘liq bandni bajar: contract/schema → migratsiya → service/API → UI → test → hujjat. Hajmi katta band ichki subtasklarga bo‘linadi; ota band barcha qismlari tugamaguncha ochiq qoladi.
6. Har band oldidan uning foydalanadigan API/DB/UI contracti va expected test natijalarini status yozuvida aniqlashtir. Endpoint nomi, model yoki papka yo‘li mavjud yaxshi tuzilishga mos tanlanadi; maydon nomini o‘zgartirish business talabni o‘zgartirmaydi. Pul/ruxsat/compliance semanticsini o‘zboshimcha o‘zgartirish mumkin emas.
7. Kerakli tekshiruvlarni bajar. Tekshiruv yurmasa sababini yoz; bajarilmagan testni o‘tgan deb ko‘rsatma. Mock/local simulator tashqi sandbox, haqiqiy qurilma yoki real pilot dalilini almashtirmaydi.
8. Paketdan keyin status/dalil/qarorlarni yangila, natija va keyingi bandni yoz. Context yoki vaqt tugasa qayta boshlash uchun ochiq task, o‘zgarishlar, testlar, to‘siqlar va keyingi aniq qadamni saqla. Barcha rejani bir urinishda tugatishni taxmin qilma.
9. Tashqi to‘siqdagi bandni ajrat, bog‘liq bo‘lmagan authorized ishlarni davom ettir. Deploy/migratsiya uchun dry-run va staging natijalarini tayyorla; real productionga o‘tish foydalanuvchining tegishli ruxsati bilan.

### Status va umumiy tugallanish qoidasi

| Status | Aniq ma’nosi | Checkbox |
| --- | --- | --- |
| `todo` | Hali bajarilmagan | Ochiq |
| `in_progress` | Implementatsiya yoki tekshiruv davom etmoqda | Ochiq |
| `blocked_external` | Credential, real uskuna, tashqi tasdiq yoki biznes qarori yetishmaydi | Ochiq; mas’ul va yetishmayotgan dalil yoziladi |
| `blocked_dependency` | Nomlangan contract/invariant tayyor emas | Ochiq; task ID va kerakli natija yoziladi |
| `deferred` | Keyingi release doirasida, yo‘qolmagan talab | Ochiq; sabab va maqsad release yoziladi |
| `not_applicable` | Tasdiqlangan release/mijoz doirasida qo‘llanmaydi | Ochiq; sabab, qaror va qayta ko‘rish sharti yoziladi |
| `done` | Bandning mezoni, umumiy mezon va tegishli tashqi dalillari bajarilgan | Faqat bunda `[x]` |

Kod vazifasining `done` sharti: kerakli UI/API/service/DB/audit qatlamlari ishlaydi; success, invalid input, permission va tegishli retry/concurrency/error holatlari tekshirilgan; ta’sirlangan turlar/build/testlar o‘tgan; migratsiya bo‘lsa eski data clone va fresh database tekshirilgan; contract va foydalanuvchi yo‘riqnomasi yangilangan. DB/pul/ruxsat/xavfsizlik invariantlari uchun test majburiy; oddiy matn/dizayn tahriri uchun maqsadli ko‘rik kifoya. `API/DB/UI` qatlamlaridan biri tegishli bo‘lmasa, sabab qayd etiladi, keraksiz kod yaratilmaydi.

Tashqi vazifaning `done` sharti: original talabdagi son, muddat va real sharoit saqlanadi; sanali protokol, manba va tegishli inson/provayder tasdig‘i bor. AI intervyu javobi, shartnoma, huquqiy xulosa, provider sandbox muvaffaqiyati yoki 14 kunlik pilotni uydirib yozmaydi. Texnik qismi tugab, tashqi sinov qolsa umumiy band hali `blocked_external`.

### Bog‘liqlikni talqin qilish

Har banddagi **Boshlash sharti** minimal oldingi guruhlarni bildiradi, ularning barcha optional/P2 ishlarini tugatish sharti emas. AI status yozuvida shu bandga zarur aniq task ID va contractni yozadi. Masalan, POS checkout uchun CATning identity/unit/price contracti kerak; barcode label yoki Excel eksportining tugashi talab qilinmaydi. Auth va tenant schema contractlari DATA/SEC ish paketida birga loyihalanadi; foundation contract uchun keyingi feature implementatsiyasini kutib sun’iy sikl yaratilmaydi.

Bir guruhda raqamlar tavsiya etilgan tartib; qaram bo‘lmagan bandlar oldin bajarilishi mumkin. Har taskning haqiqiy dependency graphida sikl aniqlansa, umumiy contract/migratsiya alohida subtaskka olinadi va graph yangilanadi. `QA-01` test infratuzilmasi boshidan yuritiladi, tegishli ssenariyning yakuniy testi o‘sha feature’dan keyin o‘tadi. OPS/staging/backup tayyorlash biznes kodidan oldin boshlanishi mumkin; yakuniy release sinovi yakuniy schema/image’da takrorlanadi.

Pilotga kirish uchun tanlangan doiradagi core savdo/return/debt/stock/purchase/shift/report, security, applicable fiskal/marking, qurilma, restore va kuzatish tekshiruvlari tayyor bo‘lishi shart. Qonuniy talabdagi fiskal xizmatni “pilot” deb chetlab o‘tish mumkin emas. Release barcha required band va real pilotdan keyin; foundational guruhni `done` deyish keyinchalik yangi endpointlarni tekshirmaslikka asos emas.

### Release doirasi va qarorlar

Standart asosiy mahsulot — O‘zbekistonda umumiy chakana savdo uchun SaaS-first POS. **Barcha P0 va shartsiz P1 asosiy production release uchun required.** Aralash P1/P2 guruhlar band matniga qarab ajratiladi. Har bandga manifestda aynan bitta scope qiymati beriladi: `required`, `conditional`, `later`. FIX bandlari required. Pilot/release checklistlari required.

P2 va sakkiz maxsus segment keyingi release’lar backlogidir; ular tashlab yuborilmaydi. Har biri alohida release, mijoz, scope va acceptance bilan bajariladi. `Conditional` band uchun applicability qarori pilotdan oldin bo‘lishi shart: fiskal — qonun/activityga ko‘ra, markirovka — mahsulot guruhiga ko‘ra, to‘liq offline — tasdiqlangan mijoz talabi, partiya/FEFO — oziq-ovqat, serial/kafolat — elektronika, native qurilma agenti — brauzer/driver yetmagan dalil asosida. Tegishli bo‘lib qolgan band `required`ga o‘tadi. AI shunchaki qiyinligi yoki credential yo‘qligi uchun uni `not_applicable` qilmaydi.

Business owner boshqa yo‘nalish tanlamaguncha baseline texnik ishlar quyidagi defaultlarda bajariladi. Moliyaviy, huquqiy va tijoriy siyosatlar pilot/productiondan oldin owner va zarur mutaxassis tomonidan tasdiqlanadi; AI test qiymatini haqiqiy tarif yoki qonun deb e’lon qilmaydi.

| Qaror | Boshlang‘ich default va chegarasi |
| --- | --- |
| Currency/time | Bitta tenant uchun UZS; saqlash UTC, hisobot `Asia/Tashkent`, davr `[start, end)`; multi-currency keyingi alohida scope |
| Pul/miqdor | PostgreSQL NUMERIC va Decimal; amount 2 decimal, quantity 6 decimal; ichki cost 6 decimal; half-up va receipt discount largest-remainder, tie-break stable line ID. Yagona formula moduli; provider boshqa rounding talab qilsa adapter va solishtirish qoidasi ADRda |
| Soliq | Inclusive/exclusive/exemption sozlanadi; real stavka huquqiy tekshiruvdan olinadi. Demo stavka production defaulti emas; required tax config bo‘lmasa fiskal checkout blok |
| Tannarx/stock | Weighted average; manfiy available stock default taqiqlangan; finalized ledger immutable; FIFO faqat segment talabi bilan |
| Refund | Original snapshotdan; qarzga tegishli qism qarzni kamaytiradi, paid qismi original cash/provider kanaliga qaytadi; allocation original qolgan ulushga proporsional, rounding qoldig‘i oxirgi qismda. Boshqa kanal manager approval va huquqiy/provider mosligi bilan |
| Debt | Tasdiqlangan customer credit limit majburiy; default limit 0; collection eng eski due debtga FIFO, manager explicit allocation mumkin; overpayment alohida customer credit |
| Count/shift | Stock count cut-off snapshot+subsequent movements; closed shift immutable; unresolved money/payment bo‘lsa close blok, egasi auditli istisno yo‘riqnomasi tasdiqlasa alohida oqim |
| Auth | Random opaque database session, cookie HttpOnly/Secure/SameSite=Lax, idle 8h/absolute 24h; mutatsiyada origin+CSRF tekshiruv; live membership/revoke. PIN sessiya o‘rnini bosmaydi. Rate limit/OTP/staleness chegaralari env config va boundary test bilan |
| Offline | OFF-01 hamma uchun. OFF-02 faqat applicability qaroridan keyin; default offline checkout o‘chiq. Yoqilganda device-bound short lease, oldindan stock rezervi va miqdor/pul/time limit majburiy; limitlar egasi tasdiqlamaguncha yoqilmaydi. Nasiya/card/marking/fiskal offline default blok |
| Offline ruxsat | Uzilgan qurilmada darhol revoke kafolati yo‘q; qisqa lease va amal cheklovi buni chegaralaydi. Reconnectda yangi vakolat tekshiriladi, offline nizoli iqtisodiy amal o‘chirilmaydi, conflict queuega tushadi |
| Draft/durability | Local unsynced draft boshqa deviceda avtomatik mavjud emas; server-saved draftgina davom ettiriladi. Local storage eviction/device loss xavfi aniq; unsynced queue bo‘lsa logout/destructive clear blok |
| Integratsiya | Birinchi relizda rasmiy fiskal provider adapteri, mustaqil virtual kassa emas. To‘lov/SMS/e-mail provider nomi va contracti tashqi qaror; buning o‘rniga AI taxminiy production API yozmaydi |
| Hosting/ingress | SaaS-first Docker web+Node worker+PG; region LEG xulosasidan keyin. Mavjud managed ingress/backup/monitoring bo‘lsa undan foydalanish; bo‘lmasa T01/T10/T11/T12. Git hostingning mavjud CIidan foydalanish |
| Backup/tezlik | Dastlabki maqsad RPO≤15min, RTO≤4h; daily base backup+continuous WAL yoki managed PITR; encrypted off-host 30 kun texnik retention. Moliyaviy data retention boshqa, LEG tasdiqlaydi. p95 limitlari OPS-04da; maqsadlar staging o‘lchovida tasdiqlanadi |
| Tarif/support | Trial/narx/grace/SLA shartlari egasi tomonidan; test konfiguratsiyasi bilan kodlash mumkin. Production sotuv/to‘lov yoqish uchun tasdiqlangan narx va shartlar kerak |

### Umumiy texnik contractlar

Quyidagilar boshlang‘ich texnik defaultlar; o‘zgarsa sabab va ta’sirlangan testlar ADRda yoziladi. Xavfsizlik/compliance chegaralarini kamaytirish uchun tasdiqlangan talab kerak.

- Mutatsiyalar serverda Zod bilan tekshiriladi. Standart error envelope: `{error: {code, message, fieldErrors?}, requestId}`. Validation `400`, sessiyasiz `401`, vakolatsiz `403`, topilmagan/yashirilgan resurs `404`, business conflict `409`, payload size `413`, rate limit `429`, ichki xato `500`. Exception stack va sirlar clientga chiqmaydi. Existing API bilan compatibility kerak bo‘lsa versiyalangan contract/migratsiya yo‘li yoziladi.
- List default 50, maximum 200; sort allowlist va stable ID tie-break. Sana/miqdor/pul JSONda aniq ISO/decimal string; enum state va optional/null farqi contractda. Katta import/export bounded chunk yoki worker orqali; server va proxy payload cheklovlari bir-biriga mos sozlanadi.
- Har iqtisodiy mutatsiyada client yaratgan operation UUID bor. Unique scope `(tenant, operation type, operationId)`; normalized payload hash saqlanadi. Ayni key+payload original natijani, boshqa payload `409`ni beradi. Biznes postingning unique source keysi hujjat saqlash muddati davomida o‘chirilmaydi. Pending/unknown operatsiyada yangi charge yaratish o‘rniga status/reconciliation qilinadi.
- DB deadlock/serialization retry maximum 3, jitter bilan; validation/permission/insufficient stock qayta bajarilmaydi. Navbat uchun boshlang‘ich 5 attempt, exponential 5s→30s→2min→10min→30min; lease 60s, heartbeat 20s. Provider timeout default 15s, rasmiy contract ustun. Unknown monetary resultda avval status query; provider idempotency yoki ishonchli status lookup bo‘lmasa charge/fiscal resend avtomatik yoqilmaydi, manual reconciliation talab qilinadi.
- OTP boshlang‘ich 6 raqam/10min/5 attempt; resend minimum 60s. Login boshlang‘ich account uchun 15min ichida 5 failed attempt, IP uchun 15min ichida 30; limit atomik va multi-instancega mos. Rate-limit bypass, account enumeration va legitimate recovery ssenariylari testlanadi. SMS/e-mail OTP ikki faktorning avtomatik huquqiy/xavfsizlik tasdig‘i emas; owner/admin MFA uchun tahdid modeli va auditlangan protokol tanlovi ADRda.
- Auditda tenant/actor/action/entity/source/requestId/time/reason va xavfsiz diff; raw secret/token/karta rekviziti yo‘q. Narx/soliq/tannarx snapshoti oldingi hujjatni yangi config bilan qayta hisoblashdan himoyalaydi. Quantity/discount/tax rounding yagona server modulida; hisob testi client va report bilan mosligini tekshiradi.
- Provider state transition matritsasi va DB constraintlari implementatsiya oldidan yoziladi. Callback signatures real provider contractiga mos; signed timestamp/replay tekshiruvi mavjud protokol imkoniyatiga qarab. Haqiqiy holat noma’lum bo‘lsa `pending/unknown`; stale callback confirmed iqtisodiy natijani qayta post qilmaydi.
- Destructive migration odatiy rollback emas. Expand/backfill/validate/contract; old image mosligi stagingda. DB restore butun tizimni eski holatga qaytarishdan oldin provider/offline ledger oqibatlari tekshiriladi. Real biznes yozuvlari bor paytda avtomatik `db reset`/`db push` yoki finalized ledger delete ishlatilmaydi.

### Tashqi kirishlar va to‘xtash chegaralari

| Kerakli dalil/kirish | Mas’ul | AI tayyorlaydigan natija | Kelmaguncha bajarilmaydigan qism |
| --- | --- | --- | --- |
| Intervyu/pilot bizneslar | Mahsulot egasi va pilot mijoz | Savollar, anonim qayd andozasi, tahlil va pilot protokoli | Haqiqiy suhbat, kelishuv va 14 kunlik dalil |
| Soliq/marking/data-location/retention xulosasi | Tegishli huquqiy/soliq mutaxassisi va egasi | Manba/sana/toifa matritsasi va tekshiriladigan savollar | Huquqiy tasdiq, moslik e’loni va tasdiqsiz production hosting |
| Fiskal/payment/SMS/e-mail API, shartnoma, sandbox credential | Egasi va provider | Contractga mos adapter, fixture, simulator, secrets konfiguratsiyasi | Real sandbox/pilot sinovi va production payment/fiscal yoqish |
| OS/real printer/scanner/scale modellari | Pilot mijoz/qurilma mas’uli | Device test andozasi, UI/agent va moslik qaydi | Real moslik tasdig‘i; browser testi real print dalili emas |
| Hosting/DNS/storage/CI/alert kanali va kirish | Egasi/operatsion mas’ul | Config, staging/dry-run, restore/rollout runbook | Ruxsat va kirishsiz tashqi o‘zgartirish; alert yuborishning tegishli ruxsatsiz sinovi |
| Tarif/shartnoma/support javobgari | Egasi va xizmat mas’uli | Billing/onboarding/support flow va hujjat drafti | Narx/shartnoma tasdig‘i, haqiqiy on-call majburiyati |

Credential kerak bo‘lsa nomi va xavfsiz ulash usulini so‘ra; secretni Markdown/statusga yozma. Qonun/provider o‘zgarsa implementatsiya paytida rasmiy hujjatni qayta tekshir va sanali ADR qil. Yo‘q dalilni `done` qilish o‘rniga `blocked_external` yozish rejani muvaffaqiyatsiz qiladi degani emas; aynan shu release uchun yetishmayotgan qismni ko‘rsatadi.

### Jadvallardagi qo‘shimcha ishlarni ham bajarish

259 checklistdan tashqari ma’lumot modellari, 12 majburiy biznes sinovi, 8 bosqich va 8 segment talabdir. Implementatsiya trackerida modellar `MODEL-01..14`, biznes sinovlari `SCENARIO-01..12`, bosqichlar `STAGE-00..07`, segmentlar `SEGMENT-01..08` sifatida jadval qatorlari tartibida qayd etiladi; ular 259 soniga qo‘shilmaydi. Model bandi tegishli feature IDlariga FK/contract/migration dalili bilan bog‘lanadi; yangi dublikat model majburiy emas. Scenario faqat ayni release’da kutilgan invariant testi o‘tganda yopiladi; stage o‘z required tasklari bilan yopiladi.

Har SEGMENT uchun AI avval jadvaldagi har funksiya nomini subtaskka ajratadi, existing core service bilan bog‘laydi va success/error/permission/accounting mezonini yozadi. Masalan, restoran uchun stol/zal → order → kitchen → ingredient movement → service fee → split payment to‘liq oqimi; ishlab chiqarish uchun BOM → consumption → waste/output → cost conservation. Dorixona compliance tasdig‘isiz chiqarilmaydi; serial/warranty, wholesale reserve/shipment, online order/shared stock, chain branch permissions alohida sinovlanadi; analyticsda baseline va held-out dataset metrikasi talab qilinadi. Segment doirasi owner bilan belgilanmaguncha kodlashni shunchaki jadvaldagi bitta umumiy satrdan “to‘liq tugadi” deb yopma.


## Qamrov va hujjatdan foydalanish

- Manbadagi **259 ta checklist bandi** alohida raqamlanadi. Masalan, `POS-01.04` — manbadagi POS-01 guruhining to‘rtinchi vazifasi.
- Pilot va yakuniy checklistlar `PILOT-01` va `RELEASE-01` deb raqamlanadi; ular ham texnologik usul bilan qoplangan.
- Har bandda original talab, **texnologiya**, **bajarish usuli**, **boshlash sharti**, **mas’ul**, **individual qabul mezoni** va **dalil talabi** bor. Guruhning qabul mezoni va manbadagi ustuvorlik ham saqlanadi.
- Checklistdan tashqaridagi ma’lumot modellari, maxsus segmentlar, sinov jadvallari, bosqichlar va task yuritish qoidalari ham kiritilgan.
- Bozor intervyusi, shartnoma, qonuniy tekshiruv va jismoniy qurilma sinovi inson/tashqi hamkor ishidir; unga kutubxona o‘rnatish shart emas.
- P0/P1/P2 ma’nosi asosiy rejadagidek. Shartli segment vazifasi bajarilmasa, sabab va chiqarish doirasi yoziladi; vazifa e’tiborsiz qoldirilmaydi.

`PROJECT.md` eski holat suratidir. Hozirgi `package.json`da `build` allaqachon `next build`; rejadagi `db push`ni chiqarish vazifasi shu tuzatishni saqlash va boshqa deploy/Docker yo‘llarida qolmaganini tekshirish deb bajariladi. Boshqa oldingi xatolarni ham ish boshlashda mavjud/yopilgan deb ajratish kerak.

## Texnologiya tanlashning asosiy qoidasi

**Mavjud texnologiyadan maksimal foydalanish** — uning xavfsiz va foydali imkoniyatlarini to‘liq ishlatish. Barcha featurelarni yoqish, hamma narsani cache qilish yoki standart fayl/kripto protokolini qo‘lda qayta yozish kerak degani emas.

Tanlov tartibi:

1. Mavjud Next.js/React/TypeScript/Prisma/PostgreSQL yoki brauzer/Node standart API bilan talabni bajarish.
2. O‘lchash: to‘g‘rilik, xavfsizlik, p95, ulanish soni, navbat kechikishi, xotira va ishlab chiqish/support xarajati.
3. Cheklovni yozish: qaysi majburiy talab yopilmayapti yoki kelishilgan ko‘rsatkich bajarilmayapti?
4. Kichik, shu vazifa uchun mos kutubxona yoki mavjud provayder xizmatini tanlash. Yangi kutubxona o‘rnatish butun frameworkni almashtirishdan oldin turadi.
5. Alohida servis/DB/broker faqat oldingi yo‘l optimallashtirilgandan keyin o‘lchangan ehtiyoj bo‘lsa.
6. Qarorda sabab, sinov, litsenziya, xavfsizlik, compatibility, xarajat, monitoring va chiqish/migratsiya rejasi bo‘lishi.

Standartni to‘g‘ri bajarish mavjud stackning imkoniyati bo‘lmasa, “maksimal foydalanish” bahonasida xavfli o‘zboshimcha parser/kripto/driver yozilmaydi. Kerakli auditlangan vosita o‘sha payt qo‘shiladi.

## Mavjud stackdan qanday foydalanamiz?

| Texnologiya | Ishlatiladigan imkoniyatlar | Qayerda chegara bor? |
| --- | --- | --- |
| Next.js App Router | Route Handlers, Server Components, async cookies, loading/error, metadata, manifest, instrumentation, Node runtime, standalone deployment | O‘zi durable worker, fiskal xizmat, DB yoki universal printer driver emas |
| React 19 | Mavjud komponentlar, Context, useReducer, refs, form/error/optimistic holatlar; interaktiv POS clientda | Brauzer state pul/qoldiq/vakolatning yakuniy manbasi emas |
| TypeScript | Strict types, DTO, discriminated union holatlar, umumiy contract va pure business services | Runtime tekshiruv o‘rnini bosmaydi; Zod ham ishlatiladi |
| Zod 4 | Input/env/query/form schemas, refine, business-error mapping, issues | FK, parallel so‘rov va noyoblikni bazaning o‘zi ham himoyalaydi |
| Prisma | Select/include, nested writes, transaction, Decimal, aggregate/groupBy, Migrate, parametrlangan raw SQL | Ayrim PG check/partial index/lock/reportlar uchun custom SQL migratsiyasi kerak; boshqa ORMga o‘tish shart emas |
| PostgreSQL 15 | NUMERIC, FK/unique/check, partial/B-tree/GIN/trigram, transaction/locks, ledger, outbox/jobs, timestamptz, views, EXPLAIN, backup/WAL | Uzoq yoki katta analytics yuklamasi alohida o‘lchanadi; offline qurilmalar o‘rtasida internet yo‘q paytda global qoldiqni kafolatlamaydi |
| Node.js | Crypto, fetch, AbortController, streams, fs, HTTP, AsyncLocalStorage, performance, test/assert; web va worker uchun bitta til | OS driver, SMS tarmog‘i, XLSX formati, brauzer automation va tashqi monitoringni o‘zi tayyor modul qilib bermaydi |
| Tailwind/HTML/CSS | Responsive ekran, print media, focus/contrast, jadval va oddiy SVG grafik | Rich document eksporti yoki murakkab chart real ehtiyoj bo‘lsa kichik vosita qo‘shiladi |
| bcryptjs/jsonwebtoken | Parol/PIN xeshi; kerak bo‘lsa signed integration yoki muddatli claim | JWTning o‘zi logout/revoke/RBAC bermaydi; jonli database session/permission kerak |
| ZXing Browser | Kamera orqali barcode/QR/Data Matrixni o‘qish | Dekoder barcode yaratadigan encoder yoki tarozi driveri emas |
| Browser standartlari | IndexedDB, Service Worker, Cache API, Web Crypto, keyboard/print va feature detection | Kvota/eviction, API qo‘llovi va jismoniy driver cheklovi bor; local ma’lumot avtomatik cloud backup emas |
| Docker Compose va Linux vositalari | Web/worker/DB alohida jarayon, private network, volume, health, timer, logs, reproducible image | Bitta host yuqori mavjudlik yoki off-host backupni avtomatik bermaydi |

### Versiyalar bo‘yicha yo‘l

Next.js 16.3.4, React 19.2.4, Prisma 5.22.0 va Zod 4.5.4 — boshlang‘ich paketlar. API yozishdan oldin o‘rnatilgan versiyaning yo‘riqnomasi/typesi tekshiriladi. “Eng yangi versiya” deb bir vaqtning o‘zida barcha major paketlarni almashtirish rejalashtirilmaydi.

Node.js 20 ishlab chiqarish uchun qo‘llab-quvvatlanmaydigan qatorga o‘tgan; Node.jsning qo‘llab-quvvatlanadigan LTSiga o‘tish kerak. Dastlab Node 22 LTS compatibility sinovi, keyin imkon bo‘lsa Node 24 LTS. Bu yangi til/framework emas, mavjud runtime xavfsizlik yangilanishi. Prisma 5ning tanlangan Node bilan mosligi stagingda tasdiqlanadi; kerak bo‘lsa Prisma/client birgalikda qo‘llab-quvvatlanadigan versiyaga yangilanadi. [Node.js rasmiy versiyalar ro‘yxati](https://nodejs.org/en/about/previous-releases).

PostgreSQLning mavjud qo‘llab-quvvatlanadigan 15 qatori avval tuning va xavfsizlik patchlari bilan ishlatiladi. Yangi major DB yoki ORM migratsiyasi faqat support, compatibility yoki talab asosida.

## Tavsiya etilgan arxitektura

```text
Brauzer/PWA — React + Tailwind + IndexedDB
       ↓ HTTPS, sessiya, operationId
Next.js Route Handlers / Server Components
       ↓ authorized context + Zod + DTO
TypeScript biznes xizmatlari
       ↓ Prisma / kerak joyda parametrlangan SQL
PostgreSQL — hujjatlar + pul/ombor jurnali + audit + outbox/jobs
       ↑                        ↓
Vakolatli hisobotlar       Node.js worker (shu repozitoriy)
                                ↓ native fetch/rasmiy adapter
                       Fiskal/to‘lov/SMS xizmatlari
```

- `src/app` UI va API kirish nuqtasi; pul/qoldiq formulalari sahifa komponentiga tarqatilmaydi.
- Taklif etilgan xizmat qatlamlari: `src/server/auth`, `permissions`, `sales`, `returns`, `inventory`, `purchases`, `finance`, `reports`, `integrations`, `jobs`.
- DTO/schemas/formulalar uchun kerakli umumiy modul; client server credential yoki Prisma importini olmaydi.
- Worker shu Node/TypeScript/Prisma stackini ishlatadi, lekin Next.js HTTP jarayonidan alohida Docker service bo‘ladi. HTTP so‘rovi ichidagi `setTimeout` yoki fire-and-forget ish navbat o‘rnini bosmaydi.
- Oddiy yangilanish statusi avval chegaralangan polling orqali; WebSocket/SSE faqat haqiqiy latency/yuklama ehtiyoji o‘lchanganda.
- Server Components read sahifalar/marketing uchun; POS va skaner interaktiv Client Components. Butun dasturni birdan qayta yozish talab qilinmaydi.
- Cache faqat ruxsatli scope va to‘g‘ri invalidatsiya bilan; pul, qoldiq va vakolat checksni uzoq umumiy cachega qo‘yish mumkin emas.

### PostgreSQL navbati — boshqa broker qo‘shishdan oldingi yo‘l

`Job/Outbox` yozuvi: tenant, type, payload version, operation key, state, attempt, nextRunAt, leaseUntil, owner, lastError va timestamps. Worker navbatni `FOR UPDATE SKIP LOCKED` bilan qisqa transactionda claim qiladi; commitdan so‘ng tarmoqqa chiqadi. Natijani operation/lease tekshiruvi bilan yozadi, uzoq ish heartbeat qiladi. Crash bo‘lsa lease tugab qayta bajariladi; handler dublikatni qabul qila oladi. Attempts tugasa ko‘rib chiqish ro‘yxatiga o‘tadi.

Bu arxitektura loyiha uchun taklif: o‘zining testlari va monitoringi shart. Tayyor PostgreSQL job kutubxonasi zarur bo‘lsa alohida DB/broker qo‘shishdan oldin baholanadi. SQL locks imkoniyati uchun manba: [PostgreSQL 15 locking](https://www.postgresql.org/docs/15/explicit-locking.html).

### Muhim hisob va ruxsat qoidalari

Ichki pul amallari Prisma.Decimal/PostgreSQL NUMERIC orqali, APIda aniq decimal strings bilan. Narx/soliq/cost snapshoti, returns va debt/cash alohida jurnalga yoziladi. Ruxsat — har service amali jonli sessiya/a’zolik/do‘kon bilan. RLS optional ikkinchi qatlam; owner/superuser bypass, Prisma pool va transaction-local tenant noto‘g‘ri sozlansa himoya buzilishi mumkin. [PostgreSQL 15 RLS](https://www.postgresql.org/docs/15/ddl-rowsecurity.html).

Provider bilan bir DB transaction bo‘lmaydi: outbox, status, idempotency va reconciliation ishlatiladi. “Bir marta biznes natijasi”ga unique keys va dalil bilan erishamiz; tarmoqda “exactly once” transport deb faraz qilmaymiz.

## Yangi texnologiyani qo‘shish shartlari — T01–T14

Quyidagilar **hozir o‘rnatilgan deb hisoblanmaydi**. Banddagi T-raqam shu jadvaldagi sabab/shartga havola. Har birini alohida ADR va kichik sinov bilan tanlaymiz.

| ID | Vosita | Mavjud stack nimani yopmaydi? | Qachon kiritiladi va birinchi tanlov |
| --- | --- | --- | --- |
| T01 | TLS/reverse proxy | Next web serverining o‘zi cert lifecycle, ingress himoyasi va tashqi trafik boshqaruvining to‘liq mahsuloti emas | Production tashqi kirishda hostingning mavjud ingressi; bo‘lmasa Caddy yoki Nginx+sertifikat avtomatizatsiyasi. Ikki ingress bir vazifa uchun birga qo‘shilmaydi |
| T02 | Barcode/QR encoder | ZXing o‘qiydi, standart kod yaratish kerak | Etiketka/QR chiqarishda `bwip-js` kabi encoder; provider QR rasmini bersa qayta encoder ishlatmaslik |
| T03 | Excel/CSV kutubxonasi | XLSX/robust CSV parser va streaming workbook mavjud emas | XLSX talabi uchun `ExcelJS`; import/export/preview bir vositada. Qo‘shimcha CSV parser faqat actual format/test cheklovi bo‘lsa |
| T04 | Browser automation | Node test/assert DOM, brauzer, offline yoki PDF renderer emas | Majburiy E2E uchun `Playwright`; shu vosita bilan browser/viewport/offline test. Avtomatik PDF kerak bo‘lsa alohida sandboxed Chromium worker; oddiy print-to-PDFga yangi vosita yo‘q |
| T05 | Qurilma transporti | Raw USB/serial/ESC-POS yoki OS service brauzerda universal emas | Avval driver/keyboard/print; yetmasa Node local agent va actual protokol uchun `serialport` yoki vendor binding. Electron/Tauri faqat native lifecycle talabiga dalil bo‘lsa |
| T06 | CI runner | Repo kodining o‘zi build/release avtomatik tashqi bajarish xizmatini bermaydi | Git hostingdagi mavjud CI; yo‘q bo‘lsa GitHub Actions kabi bitta pipeline. Sirlar protected environmentda |
| T07 | Murakkab auth protokoli | TOTP/WebAuthn/OIDC/SAML kabi tayyor auditlangan protokol yo‘q | Baseline database session+bcrypt+OTP; murakkab auth zarur bo‘lsa mos maintaned kutubxona/IdP. Login/sessionni o‘zboshimcha kriptografiya bilan almashtirmaslik |
| T08 | Fiskal/to‘lov/SMS/e-mail/ERI provayderi | Pul/fiskal/aloqa tarmog‘i dastur ichidan o‘zimiz yaratilmaydi | Talabga mos rasmiy tashqi xizmat; native fetch+crypto adapter bilan boshlash. Transport/imzo ERI protokoli yopilmasa rasmiy SDK/bridge |
| T09 | Hajmga bog‘liq qo‘shimcha | O‘lchangan limit/latency/dastur murakkabligi mavjud vosita bilan yopilmaydi | Redis/BullMQ faqat PG queue/limit tuningdan keyingi throughput yoki distributed talab; PgBouncer pool limiti; k6 distributed load; Pino/OTel log/trace; next-intl murakkab i18n; chart/search/analytics DB faqat dalil bilan |
| T10 | Mustaqil backup/object storage | Bitta server diski umumiy failure domainda; ko‘p instance umumiy faylga muhtoj | Off-host shifrlangan backup productiondan oldin; fayl ombori multi-instance/durability talabida S3-compatible yoki hostingdagi mavjud storage. Region va retention LEG-01ga mos |
| T11 | Tashqi kuzatish/status | O‘chgan app o‘zining mavjudligini tekshira olmaydi | Mustaqil uptime+alert va status joyi productiondan oldin. Mavjud hosting metricsdan boshlash; chuqur metricsda Prometheus/Grafana yoki managed monitoring |
| T12 | Backup lifecycle avtomatizatsiyasi | PG native backup/WAL bor, ammo shifrlash/off-host retention/restore job boshqaruvi to‘liq emas | Mavjud managed PITR bo‘lsa shu; self-hostda talab yopilmasa `pgBackRest` va off-host store. RPO uchun faqat pg_dump yetarli emas |
| T13 | Native mobil qobiq | PWA app-store/OS background/deep device integration talabini yopmaydi | Avval responsive PWA; talab tasdiqlansa Capacitor yoki mos native stack PoC. Backend/services saqlanadi, parallel ikkinchi biznes kodi yaratilmaydi |
| T14 | Maxsus xavfsizlik vositasi | Paket auditidan tashqari secret/image scan, zararli binary/rich HTML tekshiruvi kerak | Hostingning scanneri; bo‘lmasa gitleaks/Trivy kabi vosita. Upload ehtiyojida ClamAV, rich HTMLda audited sanitizer; hammasi birinchi kuni majburiy dependency emas |

Redis, Kafka, RabbitMQ, Elasticsearch, Kubernetes, NestJS, alohida frontend state/form framework va AI/ML platforma boshlang‘ich production stackiga avtomatik qo‘shilmaydi. Muammo borligi dalil, “kelajakda katta bo‘ladi” taxmini esa yolg‘iz sabab bo‘lolmaydi. Zarur tashqi xizmat/qurilma/test vositasini qo‘shish uchun esa DBni ataylab haddan tashqari yuklash shart emas.

## Dalil va qabul mezoni qanday saqlanadi?

Individual mezon har bandda berilgan; guruh mezoni uni to‘ldiradi, almashtirmaydi. Har bandning bajarilganini tasdiqlovchi dalil: task ID, commit/release versiyasi, test yoki manual qabul natijasi, schema migratsiyasi, kerak bo‘lsa provider/qurilma tasdig‘i. Bitta umumiy qoida ko‘p bandga xizmat qilsa takror servis yaratilmaydi; band o‘sha service va o‘ziga tegishli testga bog‘lanadi.

Tekshirish yo‘li: hisoblash — Node test/assert; DB/permission/parallel — haqiqiy PostgreSQL integration; UI/offline — Playwright; printer/tarozi/fiskal — sandbox va real qurilma; backup — toza muhitga restore. Quyidagi guruh qabul mezonlari saqlanadi, checklisti bo‘lmagan modullarga ham shu yo‘l bilan alohida qabul dalili yoziladi.

## Barcha talablarning bandma-band texnologik xaritasi

Quyidagi bo‘limlarda asosiy rejaning talab va izohlari saqlangan; checklistlar texnologik bajarish usuli bilan kengaytirilgan. Manbada keltirilgan eski holat va bozor farazlari qayta audit xulosasi emas.


### 1. “To‘liq loyiha” deganda nimaga erishamiz?

Maqsad: do‘kon o‘zining kundalik savdosi, pul, qarz va ombor hisobini Shuni POS orqali yurita olishi; tizimda xatolik yoki internet uzilishi bo‘lsa ma’lumotni yo‘qotmasligi; egasi hisobotlarga ishonishi; xizmatni o‘rnatish, yangilash va qo‘llab-quvvatlash mumkin bo‘lishi.

Production — faqat serverga joylash degani emas. Quyidagilar birga tayyor bo‘lishi kerak:

- Savdo, qaytarish, qarz va ombor amallari yakunigacha ishlashi.
- Tashkilotlar ma’lumotlari va xodim vakolatlari to‘liq ajratilishi.
- Pul va mahsulot hisoblari o‘zaro mos bo‘lishi.
- Kerakli mahalliy fiskal va to‘lov jarayonlari bilan ishlash.
- Zaxira, tiklash, monitoring, test va yangilash tartibi mavjudligi.
- Kassirga qulay interfeys, import va o‘rgatish yo‘riqnomalari.
- Sotish usuli, tarif, mijozni ishga tushirish va yordam xizmati.

“To‘liq” tushunchasi tanlangan bozor doirasiga bog‘liq. Birinchi mahsulotni umumiy chakana savdo uchun tugatamiz. Restoran, dorixona, ishlab chiqarish va to‘liq buxgalteriyani alohida kengaytma sifatida rejalashtiramiz. Tegishli segment tanlansa, uning maxsus talablari chiqarish shartiga aylanadi.

### 2. Bozor yo‘nalishi va tekshirilishi kerak bo‘lgan talab

#### Boshlang‘ich mijozlar

Tavsiya etilgan birinchi yo‘nalish: O‘zbekistondagi 1–10 ta savdo nuqtasi bo‘lgan kichik va o‘rta chakana bizneslar. Bu son bozor statistikasi emas, mahsulotni rejalash uchun boshlang‘ich faraz.

| Mijoz | Asosiy muammo | Shuni POS beradigan natija |
| --- | --- | --- |
| Mahalla do‘koni/minimarket | Navbat, qoldiq va nasiya daftarini yuritish | Tez savdo, aniq qoldiq, mijoz qarzi |
| Kiyim/poyabzal do‘koni | O‘lcham/rang kesimida hisob | Variantlar va har variant uchun qoldiq |
| Xo‘jalik/qurilish mollari | Dona, quti, metr, kg; ulgurji narx | Birlik almashtirish va narx darajalari |
| Bir nechta filialli biznes | Do‘konlar o‘rtasida nazorat yo‘qligi | Filial hisobi, transfer, umumiy analitika |
| Egasi do‘konda bo‘lmagan biznes | Kassadagi pul va xodim amallariga ishonchsizlik | Audit, smena farqi, masofadan ko‘rsatkichlar |

Raqobatchilar kataloglarida offline POS, ko‘p do‘konli hisob, mijoz va sodiqlik imkoniyatlari uchraydi. Bu Shuni POS uchun solishtirish nuqtasi, ammo mahalliy xaridor qaysi funksiyaga pul to‘lashini intervyu bilan tekshirish kerak. Manbalar: [Odoo POS funksiyalari](https://www.odoo.com/app/point-of-sale-features), [Loyverse funksiyalari](https://loyverse.com/features).

#### MKT-01 — mijozlar bilan talabni tasdiqlash [P0]

- [ ] **MKT-01.01** — 10–15 ta biznes egasi va 5–10 ta kassir bilan suhbat o‘tkazish.

  **Texnologiya:** Markdown/CSV, mavjud brauzer va jadval vositasi.

  **Bajarish:** Savollar andozasi bilan suhbat o‘tkaziladi; anonim javoblar, kuzatilgan muammo va ustuvorlik CSVga yoziladi. Dastur sotib olish talab qilinmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 41-satr; vazifa №1 (MKT-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Anonim intervyu qaydlari 10–15 egasi va 5–10 kassirni qamraydi; savollar, sana va muammo dalillari bor.

  **Dalil:** `MKT-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **MKT-01.02** — Amaldagi kassada bir ish kunining asosiy amallarini kuzatish.

  **Texnologiya:** Markdown, vaqt o‘lchovi va rozilikli kuzatuv.

  **Bajarish:** Kassir qidiruv, savdo, qaytarish va smena vaqtini kuzatish varag‘iga yozish; har bosqichdagi qiyinchilikni belgilash.

  **Manba:** FULL_PROJECT_PLAN.md, 42-satr; vazifa №2 (MKT-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Bir to‘liq ish kuni kuzatuv qaydi, jarayonlar ketma-ketligi va sarflangan vaqtlar mavjud.

  **Dalil:** `MKT-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **MKT-01.03** — Qaysi qurilmalar, internet, printer, tarozi va fiskal provayder ishlatilishini yozib olish.

  **Texnologiya:** CSV qurilma reyestri.

  **Bajarish:** OS, brauzer, model, port/protokol, printer kengligi, internet sifati va fiskal xizmatni bitta moslik jadvaliga yig‘ish; HW-01 uchun kirish ma’lumoti.

  **Manba:** FULL_PROJECT_PLAN.md, 43-satr; vazifa №3 (MKT-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Har pilot uchun OS/brauzer/model/protokol/internet/provayder ustunlari to‘ldirilgan qurilma reyestri bor.

  **Dalil:** `MKT-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **MKT-01.04** — Hozirgi dasturdan ko‘chishdagi qiyinchiliklar va to‘lashga tayyor narxni tekshirish.

  **Texnologiya:** CSV va import andozasi.

  **Bajarish:** Eski dasturdan olinadigan format, qoldiq/qarz sifati, ko‘chirish va xizmat xarajatini o‘lchash; tarif farazlarini mijoz bilan tekshirish.

  **Manba:** FULL_PROJECT_PLAN.md, 44-satr; vazifa №4 (MKT-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Import namunalari, ko‘chish xarajatlari va to‘lashga tayyor narx javoblari taxminlardan ajratilgan.

  **Dalil:** `MKT-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **MKT-01.05** — Eng ko‘p talab qilingan besh muammo va mahsulotning ustunligini belgilash.

  **Texnologiya:** Markdown qaror jurnali.

  **Bajarish:** Muammolarni takrorlanish, pulga ta’sir va bajarish hajmi bo‘yicha tartiblash; dastlabki beshta qiymat taklifini dalil bilan yozish.

  **Manba:** FULL_PROJECT_PLAN.md, 45-satr; vazifa №5 (MKT-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Beshta ustuvor muammo dalil soni, yechim va o‘lchanadigan foyda bilan tartiblangan.

  **Dalil:** `MKT-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **MKT-01.06** — Kamida uchta pilot biznes, ularning sinov doirasi va muvaffaqiyat mezonini kelishish.

  **Texnologiya:** Markdown pilot kelishuvi.

  **Bajarish:** Har biznes uchun doira, qurilmalar, sinov holatlari, mas’ul, qaytish tartibi va muvaffaqiyat mezonini kelishish; CRMga yangi servis kerak emas.

  **Manba:** FULL_PROJECT_PLAN.md, 46-satr; vazifa №6 (MKT-01).

**Natija:** taxminiy funksiyalar ro‘yxati o‘rniga kuzatilgan muammolar, qurilmalar ro‘yxati, pilotlar va ustuvor talablar hujjati.

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Kamida uch biznesning kelishilgan doirasi, mas’uli va muvaffaqiyat mezonlari yozma qayd etilgan.

  **Dalil:** `MKT-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

#### Ustuvorlik belgisi

| Belgi | Ma’nosi |
| --- | --- |
| P0 | Productionga yoki tegishli pilotga chiqishni to‘sadigan ish; chiqarishdan oldin tugatiladi |
| P1 | Birinchi to‘liq chakana mahsulot uchun kerak; tegishli foydalanish ssenariysida chiqarish sharti |
| P2 | Mijoz talabi bilan kengaytiriladigan imkoniyat; asosiy productionni to‘xtatmaydi |

Qonuniy yoki shartnomaviy talab bo‘lsa, P1/P2 vazifa o‘sha mijoz uchun P0ga ko‘tariladi. Pastroq ustuvorlik vazifani umuman kerak emas degani emas.

### 3. Avval mavjud poydevorni tuzatish [P0]

#### FIX-01 — qo‘llanmada qayd etilgan xatolarni yopish

- [x] **FIX-01.01** — TypeScript, Prisma konfiguratsiyasi, Zod va JWT turlari bo‘yicha xatolarni tuzatish.

  **Texnologiya:** TypeScript strict, Zod, Prisma, jsonwebtoken.

  **Bajarish:** Kutubxonalarning o‘rnatilgan APIlariga mos turlarni tuzatish; Zod issues, JWT options va Prisma konfiguratsiyasini tekshirish. ORMni almashtirmasdan qo‘llab-quvvatlanadigan versiya uchun moslik matritsasi tuziladi.

  **Manba:** FULL_PROJECT_PLAN.md, 64-satr; vazifa №1 (FIX-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Typecheck va tegishli build o‘tadi; Prisma/Zod/JWT xatolari yashirilmaydi.

  **Dalil:** `FIX-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIX-01.02** — Savdo hisobotidagi yuklanmagan `items`ga murojaatni tuzatish.

  **Texnologiya:** Prisma select/include va PostgreSQL aggregate.

  **Bajarish:** Kerakli sale itemsni aniq olish yoki ularning sonini bazada hisoblash; yig‘indini barcha filtrlangan yozuvlardan olish. Bo‘sh va to‘ldirilgan hisobot test qilinadi.

  **Manba:** FULL_PROJECT_PLAN.md, 65-satr; vazifa №2 (FIX-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Itemsli va itemssiz test ma’lumotida hisobot exceptionsiz, qo‘lda hisoblangan summaga teng.

  **Dalil:** `FIX-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIX-01.03** — Transfer yaratishda bog‘langan mahsulot qatorlarini to‘g‘ri saqlash.

  **Texnologiya:** Prisma nested writes va transaction.

  **Bajarish:** Transfer sarlavhasi va qatorlarini bog‘langan create orqali atomik saqlash; qatorlar va do‘konlar egaligi tekshiriladi.

  **Manba:** FULL_PROJECT_PLAN.md, 66-satr; vazifa №3 (FIX-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Ikki mahsulotli transfer bazada ikki to‘g‘ri bog‘langan qator bilan saqlanadi; noto‘g‘ri ID rollback qiladi.

  **Dalil:** `FIX-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIX-01.04** — Qoralamada faqat izoh/mijoz o‘zgarsa mahsulot qatorlari saqlanishini ta’minlash.

  **Texnologiya:** TypeScript patch DTO, Prisma transaction.

  **Bajarish:** Faqat kelgan maydonlar o‘zgartiriladi; items bo‘lmasa delete qilinmaydi. Izoh yoki mijoz yangilash qatorlarni saqlashi tekshiriladi.

  **Manba:** FULL_PROJECT_PLAN.md, 67-satr; vazifa №4 (FIX-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Faqat izoh yoki mijoz PATCHida qator IDlari, miqdor va jami o‘zgarmaydi.

  **Dalil:** `FIX-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIX-01.05** — Chegirma alohida o‘zgarsa summalarni qayta hisoblash; nol qiymatni to‘g‘ri qabul qilish.

  **Texnologiya:** Prisma.Decimal va Zod.

  **Bajarish:** Chegirma borligi undefined orqali ajratiladi; nol qiymat saqlanadi. Bir xil hisoblash xizmati barcha summalarni qayta hisoblaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 68-satr; vazifa №5 (FIX-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Chegirma nolga tushirilganda eski chegirma qolmaydi; jami qayta hisoblanadi.

  **Dalil:** `FIX-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIX-01.06** — Ro‘yxatdan o‘tish javobini frontend ehtiyoji bilan moslashtirish; birlamchi yaratishni tranzaksiyaga olish.

  **Texnologiya:** Prisma transaction, TypeScript DTO, React Context.

  **Bajarish:** Tashkilot, egasi, do‘kon va kassa atomik yaratiladi; rol va organizationUserId javobda beriladi. Xato holatda yarim yaratilgan biznes qolmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 69-satr; vazifa №6 (FIX-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Frontend ishlatadigan registration contract tasdiqlangan; yaratish o‘rtasidagi xato qisman tashkilot qoldirmaydi.

  **Dalil:** `FIX-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIX-01.07** — SKU va barkod noyobligini tashkilot doirasiga o‘tkazish; mavjud bazaga xavfsiz migratsiya tayyorlash.

  **Texnologiya:** Prisma Migrate va PostgreSQL composite unique.

  **Bajarish:** Tashkilot+SKU/barkod noyobligi; eski indeksni almashtirishdan oldin dublikatlar tekshiriladi. Migratsiya staging nusxasida va qaytish rejasi bilan bajariladi.

  **Manba:** FULL_PROJECT_PLAN.md, 70-satr; vazifa №7 (FIX-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Bir tenantdagi dublikat SKU/barkod rad, ikki tenantdagi bir xil qiymat ruxsat; eski data migratsiya bilan saqlangan.

  **Dalil:** `FIX-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul holati (2026-10-11): done.** Tenant SKU/primary/alias uniqueness, parallel single winner, invalid legacy duplicate preflight rejection va actual dump-clone/fresh/rollback preservation PASS.132 migrationli isolated synthetic rehearsal; real customer/staging rollout OPS gate’larida ochiq. [163 qabul protokoli](EXECUTION_STATUS.md#original-160163--fix-0107-data-0104-rep-0109-qabuli-2026-10-11). `tasks/evidence/core-163-20261011.json`.

- [x] **FIX-01.08** — `ignoreBuildErrors`ni olib tashlash; paketlar mosligini va Prisma client yaratishni majburiy tekshirish.

  **Texnologiya:** Next.js, TypeScript, ESLint, npm lockfile.

  **Bajarish:** Tur xatosi bo‘lsa build to‘xtaydi; paketlar va Prisma client yaratish CI tekshiruviga kiradi. Build xatolarini yashiradigan sozlama chiqariladi.

  **Manba:** FULL_PROJECT_PLAN.md, 71-satr; vazifa №8 (FIX-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Build xatolari bypasssiz tekshiriladi; toza install/generate/typecheck/build muvaffaqiyatli.

  **Dalil:** `FIX-01.08` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIX-01.09** — Docker build, standalone chiqishi va bazaga ulanish tartibini tuzatish.

  **Texnologiya:** Docker multi-stage, Next.js standalone, Node.js qo‘llab-quvvatlanadigan LTS.

  **Bajarish:** Bazasiz build, to‘g‘ri standalone nusxalash va alohida migratsiya bosqichi; Node versiyasi Prisma/Next bilan stagingda tekshiriladi.

  **Manba:** FULL_PROJECT_PLAN.md, 72-satr; vazifa №9 (FIX-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Toza image standalone serverni ishga tushiradi; readiness DB mavjudligini to‘g‘ri aks ettiradi.

  **Dalil:** `FIX-01.09` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIX-01.10** — Maxfiy muhit fayllari image yoki build kontekstiga kirishini to‘xtatish.

  **Texnologiya:** Docker .dockerignore va secret mount.

  **Bajarish:** .env, backup, kalit va credentiallar kontekstdan chiqariladi; sirlar runtime orqali beriladi. Image qatlamlari va build loglari maxfiy qiymatlarga tekshiriladi.

  **Manba:** FULL_PROJECT_PLAN.md, 73-satr; vazifa №10 (FIX-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Image qatlamlari/build contextida haqiqiy env kalitlari yo‘q; faqat nomsiz test kalitlari bilan tekshirish dalili bor.

  **Dalil:** `FIX-01.10` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

**Qabul mezoni:** lint, TypeScript, build va asosiy integratsion testlar o‘tadi; qoralama tahririda ma’lumot yo‘qolmaydi; transfer oxirigacha ishlaydi; birinchi ro‘yxatdan o‘tishdan keyin qayta yuklamasdan smena ochish mumkin.

### 4. Xavfsizlik, foydalanuvchi va ruxsatlar

#### SEC-01 — tashkilot va do‘kon chegaralari [P0]

- [x] **SEC-01.01** — Tashkilotni faqat so‘rov tanasidan emas, haqiqiy sessiya va faol a’zolikdan aniqlash.

  **Texnologiya:** Next.js server DAL, PostgreSQL Session/OrganizationUser, Prisma.

  **Bajarish:** Har so‘rovda sessiya, faol foydalanuvchi va tanlangan tashkilot a’zoligi tekshiriladi; frontend yuborgan organizationId faqat tekshiriladigan tanlov.

  **Manba:** FULL_PROJECT_PLAN.md, 81-satr; vazifa №1 (SEC-01).

  **Boshlash sharti:** SEC-02, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Body/query tenantini almashtirish boshqa tenantga kirish bermaydi; sessiyasiz so‘rov rad etiladi.

  **Qabul holati (2026-10-06):** `done`. Individual natija, test va versiya dalili [EXECUTION_STATUS.md — +50 checkpoint](EXECUTION_STATUS.md#50-sorovi--1-checkpoint-2026-10-06) bo‘limida.

  **Dalil:** `SEC-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **SEC-01.02** — Har bir ro‘yxat, tafsilot, o‘zgartirish, eksport, fayl va fon ishida tashkilot chegarasini tekshirish.

  **Texnologiya:** TypeScript DAL va Prisma tenant filtrlari.

  **Bajarish:** Ro‘yxat/ID/eksport/fayl/worker uchun yagona authorized-context talab qilish. SQL hisobot va fon ishlarida ham organizationId majburiy; RLS faqat alohida sinovdan keyin ikkinchi himoya.

  **Manba:** FULL_PROJECT_PLAN.md, 82-satr; vazifa №2 (SEC-01).

  **Boshlash sharti:** SEC-02, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** API/eksport/fayl/worker reyestridagi har kirish nuqtasi A/B tenant testidan o‘tgan; yashirin maydon sizib chiqmaydi.

  **Dalil:** `SEC-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul (2026-10-08):** `done`. Yakuniy individual dalil EXECUTION_STATUS.md dagi “Soliq, refund, scope va backup — yakuniy qabul” protokolida.

- [x] **SEC-01.03** — Do‘kon, kassa, smena, mahsulot, mijoz va to‘lov bir tashkilotga tegishli ekanini tekshirish.

  **Texnologiya:** Prisma relational filters, PostgreSQL composite FK.

  **Bajarish:** Barcha bog‘langan IDlar bir tashkilotga tegishli ekanini servisda tekshirish, mumkin joyda composite FK bilan bazada mustahkamlash; to‘g‘ridan-to‘g‘ri ID yozish cheklanadi.

  **Manba:** FULL_PROJECT_PLAN.md, 83-satr; vazifa №3 (SEC-01).

  **Boshlash sharti:** SEC-02, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Boshqa tenantning bog‘langan IDsi create/updatega berilganda butun amal rad, yozuv yaratilmaydi.

  **Qabul:** `done`, 2026-10-06. [Yana 15 ta bandning test va versiya dalili](EXECUTION_STATUS.md#yana-15-ta-plan1-bandi--yakuniy-qabul-2026-10-06).

  **Dalil:** `SEC-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **SEC-01.04** — Egasi/admin/kassir uchun amallar jadvalini yozish va serverda qo‘llash.

  **Texnologiya:** TypeScript permission map va server services.

  **Bajarish:** Rol→amal vakolat jadvali yaratiladi; har service amali tekshiradi. React faqat shu imkoniyatlarni ko‘rsatadi; serverda mustaqil tekshiruv bor.

  **Manba:** FULL_PROJECT_PLAN.md, 84-satr; vazifa №4 (SEC-01).

  **Boshlash sharti:** SEC-02, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Owner/admin/cashier matritsasi bor; har amal uchun allow va deny server testi o‘tadi.

  **Qabul (2026-10-10):** `done`. 243 explicit protected action role map, unknown-action failclosed, har amal owner/admin/cashier/unknown role policy testlari, real HTTP deny va revoked-session tranzaksiya/brauzer sinovlari. Dalil: `tasks/evidence/permission-receipt-20261010.json`; permission-matrix.md.

  **Dalil:** `SEC-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **SEC-01.05** — Kassir boshqa kassir smenasida ruxsatsiz savdo qilmasligi; tannarx va foydani vakolatsiz ko‘rmasligi.

  **Texnologiya:** Prisma select DTO va Shift ownership.

  **Bajarish:** Kassir/smena bog‘liqligini tekshirish; tannarx/foyda maydonlarini vakolatsiz DTOga kiritmaslik. Menyuni yashirish bilan cheklanilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 85-satr; vazifa №5 (SEC-01).

  **Boshlash sharti:** SEC-02, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Begona smenada sotish va vakolatsiz cost/profit o‘qish rad; UI yashirishdan tashqari API ham tekshiradi.

  **Qabul:** `done`, 2026-10-06. [Yana 15 ta bandning test va versiya dalili](EXECUTION_STATUS.md#yana-15-ta-plan1-bandi--yakuniy-qabul-2026-10-06).

  **Dalil:** `SEC-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **SEC-01.06** — Ruxsatlar bekor bo‘lganda eski sessiya ham bu amallarni bajara olmasligi.

  **Texnologiya:** PostgreSQL sessiya bekor qilish va membership tekshiruvi.

  **Bajarish:** Bloklashda sessiyalar revoke qilinadi; muhim har amal jonli a’zolikni tekshiradi. Uzoq yashaydigan JWT yoki umumiy kesh ruxsat uchun yagona manba bo‘lmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 86-satr; vazifa №6 (SEC-01).

  **Boshlash sharti:** SEC-02, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Vakolat bekor qilingach, oldingi sessiyaning keyingi mutatsiyasi rad etiladi.

  **Qabul:** `done`, 2026-10-06. [Yana 15 ta bandning test va versiya dalili](EXECUTION_STATUS.md#yana-15-ta-plan1-bandi--yakuniy-qabul-2026-10-06).

  **Dalil:** `SEC-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **SEC-01.07** — Admin panel va yordam xizmati kirishlarini ham shu nazoratga olish.

  **Texnologiya:** Next.js platforma DAL, PostgreSQL support grants va AuditLog.

  **Bajarish:** Platforma xodimi biznes egasi vakolatini avtomatik olmaydi; support kirishi doira, muddat, sabab va mijoz tasdig‘i bilan beriladi.

  **Manba:** FULL_PROJECT_PLAN.md, 87-satr; vazifa №7 (SEC-01).

  **Boshlash sharti:** SEC-02, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Platforma/support kirishi scope va audit bilan; ruxsatsiz business data o‘qish rad etiladi.

  **Qabul:** `done`, 2026-10-08. [Support yakuniy qabul](EXECUTION_STATUS.md#support-yakuniy-qabul-2026-10-08).

  **Dalil:** `SEC-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

**Qabul mezoni:** A tashkilot foydalanuvchisi B tashkilotning IDsi ma’lum bo‘lsa ham hech bir API, eksport yoki fayl orqali uning ma’lumotini ololmaydi/o‘zgartirolmaydi. Bu avtomatik testlar bilan tekshiriladi.

#### SEC-02 — sessiya va hisob himoyasi [P0]

- [ ] **SEC-02.01** — HTTPS; productionda kuchli kalit majburiy, standart kalit bilan ishga tushmaslik.

  **Texnologiya:** Zod env validation, Node crypto, HTTPS ingress.

  **Bajarish:** Runtime sozlamalari server startida tekshiriladi; production standart yoki yo‘q kalit bilan ishga tushmaydi. TLS uchun T01 ingress qo‘shiladi, kalitlar image ichida emas.

  **Manba:** FULL_PROJECT_PLAN.md, 93-satr; vazifa №1 (SEC-02).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Production konfiguratsiyasi bo‘sh/kuchsiz kalitda fail-fast; HTTPS va secure cookie stagingda tekshirilgan.

  **Dalil:** `SEC-02.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **SEC-02.02** — Brauzer uchun xavfsiz sessiya yechimi: HttpOnly/Secure cookie, muddat, serverda bekor qilish; cookie ishlatilsa CSRF himoyasi.

  **Texnologiya:** Next.js cookies, Node crypto, Prisma database sessions.

  **Bajarish:** Tasodifiy opaque sessiya tokeni Secure/HttpOnly/SameSite cookiega yoziladi, bazada xeshi saqlanadi. Mutatsiyalarda exact Origin, Sec-Fetch-Site va JSON-only tekshiruvi SameSite cookie bilan CSRF chegarasini beradi; muddat/rotation/revoke bazada tekshiriladi. ADR025 bo‘yicha alohida double-submit token kiritilmaydi: mavjud same-origin JSON transport ishlatiladi, boshqa transport qo‘shilsa CSRF contract qayta baholanadi. Tayyor auth kutubxonasi faqat protokol doirasi kengaysa T07.

  **Manba:** FULL_PROJECT_PLAN.md, 94-satr; vazifa №2 (SEC-02).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Cookie flaglari/muddat/revoke tekshirilgan; cross-origin CSRF mutatsiyasi rad, qonuniy so‘rov ishlaydi.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `SEC-02.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **SEC-02.03** — Chiqish, barcha qurilmalardan chiqish, parol almashtirish va parol tiklash.

  **Texnologiya:** Next.js Route Handlers, bcryptjs, PostgreSQL.

  **Bajarish:** Logout/all logout va password reset sessiyalarini bekor qiladi; tiklash tokeni xeshlangan, bir martalik va muddatli. Parol almashishda joriy parol yoki tasdiq talab qilinadi.

  **Manba:** FULL_PROJECT_PLAN.md, 95-satr; vazifa №3 (SEC-02).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Logout/global logout/password change eski sessiyalarni bekor qiladi; reset token bir marta ishlaydi.

  **Dalil:** `SEC-02.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **SEC-02.04** — Telefon/e-mail tasdiqlash, bir martalik kod muddati va urinishlar chegarasi.

  **Texnologiya:** Node crypto, Prisma token/attempt records, aloqa provayderi T08.

  **Bajarish:** Xavfsiz tasodifiy OTP, expiry va urinish limiti; kod logga tushmaydi. SMS/e-mail yetkazish uchun tashqi xizmat zarur; o‘zimiz aloqa transportini yozmaymiz.

  **Manba:** FULL_PROJECT_PLAN.md, 96-satr; vazifa №4 (SEC-02).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** OTP muvaffaqiyat, expiry, replay va attempts limit testlaridan o‘tadi; kodlar logga chiqmaydi.

  **Dalil:** `SEC-02.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **SEC-02.05** — Kirish, tiklash, import va qimmat so‘rovlarda tezlik/hajm cheklovlari.

  **Texnologiya:** PostgreSQL atomik rate-limit counters va ingress.

  **Bajarish:** Bir nechta instance uchun umumiy DB limit, ingressda hajm/timeout, import uchun satr/fayl chegarasi. Redis faqat o‘lchangan DB contention limitga yetganda T09.

  **Manba:** FULL_PROJECT_PLAN.md, 97-satr; vazifa №5 (SEC-02).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Har cheklangan endpoint uchun limit testi 429/413 va retry yo‘lini ko‘rsatadi; tenantlar limiti izolyatsiyalangan.

  **Qabul:** `done`,2026-10-10. Barcha243protected HTTP handler umumiy DB budget bilan429/Retry-After; public auth admission/IP spoofing, parallel counter, tenant isolation, expiry/retry, login/register/reset/import limitlari, streamed1MiB413/slow-body408 va original-key browser recovery. Full250/250; final configuration focused6/6; unit24/24; three-browser9/9; production build/lint/typecheck/worker PASS. [Dalil va qabul chegarasi](EXECUTION_STATUS.md#sec-0205-qabul--2026-10-10); `tasks/evidence/request-limits-20261010.json`. Actual hosting/TCP firewall/WAF deploymenti ushbu application limit acceptance bilan yopilmaydi.

  **Dalil:** `SEC-02.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **SEC-02.06** — Owner, platforma admini va muhim amallar uchun ikki bosqichli tasdiq.

  **Texnologiya:** Mavjud sessiya + OTP challenge, PostgreSQL approval.

  **Bajarish:** Owner/admin uchun OTP step-up va bir martalik recovery jarayoni; kod amal va sessiyaga bog‘lanadi. TOTP/WebAuthn talab qilinsa audited auth integratsiyasi T07; o‘z TOTP kriptografiyasi yozilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 98-satr; vazifa №6 (SEC-02).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Owner/adminning belgilangan xavfli amali ikkinchi faktorsiz rad; tasdiq muddati/replay nazorati o‘tadi.

  **Dalil:** `SEC-02.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Joriy holat (2026-10-11): done (core qabul).** OTPAuth9.5.2, SQL119–125, 21 action uchun sessiya/amal/payloadga bog‘langan bir martalik MFA, recovery, operator rekey va restore quarantine qabuldan o‘tdi. 313/313 full integration, 35/35 focused, yakuniy restore CLI 2/2, 33 unit fayl, uch brauzerda 15/15; production build/worker/lint/typecheck va fresh/legacy migration PASS. Dalil: `tasks/evidence/critical-mfa-restore-20261011.json`; inventory: `docs/operations/critical-action-inventory.md`. Standart rollout flag o‘chiq; haqiqiy production rollout va operatorning credential/access reconciliation tasdig‘i alohida tashqi ish. SMS/e-mail provider integratsiyasi bundan done hisoblanmaydi.

- [x] **SEC-02.07** — API javobi va loglardan parol xeshi, token, maxfiy kalit va keraksiz shaxsiy maydonlarni chiqarish.

  **Texnologiya:** Prisma select, TypeScript DTO, log redaction.

  **Bajarish:** Faqat ruxsatli maydonlarni olish; umumiy user obyektini javobga bermaslik. Logdagi headers/body uchun allowlist, token/parol/telefonni niqoblash.

  **Manba:** FULL_PROJECT_PLAN.md, 99-satr; vazifa №7 (SEC-02).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** API/eksport/log testlarida passwordHash/raw token/secret yo‘q; DTO maydonlari allowlist bilan.

  **Qabul (2026-10-07):** `done`. Individual natija va versiya dalili [joriy checkpointda](EXECUTION_STATUS.md#plus-20-2026-10-07-b--davom-etayotgan-qabul).

  **Dalil:** `SEC-02.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **SEC-02.08** — XSS, fayl yuklash, zararli CSV va noto‘g‘ri parametrlar himoyasi.

  **Texnologiya:** React escaping, Zod, Node file checks, CSV xavfsizligi.

  **Bajarish:** HTMLni xom qo‘shmaslik, CSP va upload MIME/signature/hajm cheklovi; CSV formulalarini zararsizlantirish. Rich HTML yoki ishonchsiz fayl zarur bo‘lsa T14 sanitizer/antivirus.

  **Manba:** FULL_PROJECT_PLAN.md, 100-satr; vazifa №8 (SEC-02).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** XSS payload, zararli fayl/CSV va noto‘g‘ri parametr xavfsiz rad yoki zararsiz ko‘rsatiladi.

  **Qabul:** `done`, 2026-10-08. Protected files/katalog/CSP qabul protokoli EXECUTION_STATUS.md oxirida.

  **Dalil:** `SEC-02.08` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **SEC-02.09** — Sessiyalar va xavfsizlik hodisalari tarixi; shubhali kirish haqida bildirishnoma.

  **Texnologiya:** Prisma SecurityEvent/Session, worker outbox.

  **Bajarish:** Kirish, revoke va muhim amallar tarixini saqlash; shubhali hodisaga T08 orqali xabar. Loglar saqlash muddati va maskalash siyosatiga bo‘ysunadi.

  **Manba:** FULL_PROJECT_PLAN.md, 101-satr; vazifa №9 (SEC-02).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Xavfsizlik hodisasi auditda qayd; test shubhali kirish tegishli mas’ulga maxfiy ma’lumotsiz yetkaziladi.

  **Dalil:** `SEC-02.09` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

**Qabul mezoni:** bloklangan xodim yangi va eski sessiyadan ishlay olmaydi; parol tiklash kodi qayta ishlatilmaydi; hech bir javobda `passwordHash` yo‘q.

#### USR-01 — xodimlar hayot sikli [P1]

- [x] **USR-01.01** — Taklif qilish, rol/do‘kon berish, tahrirlash, vaqtincha bloklash va arxivlash.

  **Texnologiya:** React forms, Zod, Next.js services, Prisma.

  **Bajarish:** Taklif tokeni, a’zolik va do‘kon biriktirish oqimi; bloklash/arxivlash tarixiy savdoni o‘chirmaydi. Amallar auditga yoziladi.

  **Manba:** FULL_PROJECT_PLAN.md, 107-satr; vazifa №1 (USR-01).

  **Boshlash sharti:** SEC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Invite/role/store/edit/block/archive oqimlari ishlaydi; expiry va begona tenant holatlari rad.

  **Dalil:** `USR-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul: 2026-10-06.** Taklif single-use/expiry/revoke va yangi/mavjud hisob himoyasi; rol/filial edit, block/reactivate, explicit archive/restore API va UI. Migration026 archive→inactive, organization lock/last-owner, session revoke va audit. Savdo/payment/stock tarixi o‘zgarmaydi; restore blocked, old cookie yaroqsiz. `tasks/EXECUTION_STATUS.md` “+1: xodimlar hayot sikli” protokoli va version SHA.

- [x] **USR-01.02** — Oxirgi egani o‘chirish/bloklashga yo‘l qo‘ymaslik; egalikni topshirish jarayoni.

  **Texnologiya:** PostgreSQL transaction va row lock, Prisma.

  **Bajarish:** Egalar sonini va amaldagi ownerni tranzaksiyada bloklab tekshirish; oxirgi egani olib tashlash taqiqlanadi. Topshirish ikkinchi tomon tasdig‘i bilan.

  **Manba:** FULL_PROJECT_PLAN.md, 108-satr; vazifa №2 (USR-01).

  **Boshlash sharti:** SEC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Oxirgi owner bloklash/o‘chirish parallel so‘rovda ham rad; ownership transfer atomik.

  **Qabul holati (2026-10-06):** `done`. Individual natija, test va versiya dalili [EXECUTION_STATUS.md — +50 checkpoint](EXECUTION_STATUS.md#50-sorovi--1-checkpoint-2026-10-06) bo‘limida.

  **Dalil:** `USR-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **USR-01.03** — Bir foydalanuvchining bir nechta biznesi orasida vakolat bilan almashish.

  **Texnologiya:** React Context, Next.js session DAL, Prisma membership.

  **Bajarish:** Tashkilotni almashtirishda jonli vakolat tekshiriladi; faol do‘kon/smena/savat holati yangilanadi. Bir biznesning kesh yoki savati boshqasiga o‘tmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 109-satr; vazifa №3 (USR-01).

  **Boshlash sharti:** SEC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Biznes almashtirish faqat faol membership bilan; oldingi tenant state va cache ko‘rinmaydi.

  **Qabul holati (2026-10-06):** `done`. Individual natija, test va versiya dalili [EXECUTION_STATUS.md — +50 checkpoint](EXECUTION_STATUS.md#50-sorovi--1-checkpoint-2026-10-06) bo‘limida.

  **Dalil:** `USR-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **USR-01.04** — Tez kassir almashish uchun PIN; PIN yuqori vakolat o‘rnini bosmasligi.

  **Texnologiya:** bcryptjs, PostgreSQL PIN attempts, React modal.

  **Bajarish:** PINni xeshlash, urinish limiti va qurilma doirasi; tez almashishdan keyin kassir sessiyasi yangilanadi. Qaytarish kabi yuqori vakolat PINga ishonib avtomatik berilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 110-satr; vazifa №4 (USR-01).

  **Boshlash sharti:** SEC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** PIN almashinuvi kassirni to‘g‘ri belgilaydi; PIN owner/admin vakolatini bermaydi va attempts cheklangan.

  **Qabul:** `done`, 2026-10-08. ADR-036 va EXECUTION_STATUS.md cashier PIN qabul protokoli.

  **Dalil:** `USR-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **USR-01.05** — Qaytarish, narx o‘zgartirish, katta chegirma va inventar farqiga manager tasdig‘i.

  **Texnologiya:** TypeScript approval service, Prisma Approval, manager session.

  **Bajarish:** Tasdiq amal turi, summa, hujjat versiyasi va muddatga bog‘lanadi; boshqa amal uchun ishlatilmaydi. Tasdiqlovchi o‘z vakolati bilan auditga tushadi.

  **Manba:** FULL_PROJECT_PLAN.md, 111-satr; vazifa №5 (USR-01).

  **Boshlash sharti:** SEC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Tasdiq aniq amal/miqdor/hujjat versiyasiga bog‘langan; boshqa hujjat yoki takror amal uchun ishlamaydi.

  **Dalil:** `USR-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul (2026-10-08):** `done`. Individual dalil EXECUTION_STATUS.md dagi “PWA va manager tasdig‘i” protokolida.

- [x] **USR-01.06** — Kelgusida omborchi/buxgalter/kuzatuvchi roli va moslashtiriladigan vakolatlar.

  **Texnologiya:** PostgreSQL role/permission tables va TypeScript policies.

  **Bajarish:** Asosiy rol xaritasini kengaytirish, maxsus vakolatni boshqarish ekrani; o‘zgartirishdan keyin sessiya huquqi yangilanadi. Alohida RBAC SaaS talab qilinmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 112-satr; vazifa №6 (USR-01).

  **Boshlash sharti:** SEC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Omborchi/buxgalter/kuzatuvchi matritsasi implementatsiya qilingan; allow/deny va role edit testlari bor.

  **Dalil:** `USR-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul (2026-10-11): done.** Owner boshqaradigan admin/cashier subset matritsasi, Omborchi/Buxgalter/Kuzatuvchi namunasi, API/UI, scoped revision va sessiya revocation; allow/deny, tenant/branch, replay/concurrency, rollback va read-only qabul. Dalil: `evidence/custom-roles-20261011.json`; qo‘llanma `../docs/operations/custom-roles.md`.

### 5. Savdo, qaytarish va narxlar

#### POS-01 — ishonchli savdo yakunlash [P0]

- [x] **POS-01.01** — Narx, tannarx, birlik, kassir va vakolatlarni serverda ishonchli manbadan olish.

  **Texnologiya:** Next.js sale service, Prisma va Decimal.

  **Bajarish:** Client productId/miqdor tanlovini yuboradi; server katalog/narx siyosati, tarixiy tannarx va sessiyadagi kassirni oladi. Vakolatli narx override alohida tasdiq bilan.

  **Manba:** FULL_PROJECT_PLAN.md, 118-satr; vazifa №1 (POS-01).

  **Boshlash sharti:** SEC-01, CAT-01, INV-01, FIN-01, CRM-01, FIN-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Client soxta price/cost/cashier yuborsa server ishonchli qiymatlarni ishlatadi yoki konfliktni rad etadi.

  **Qabul holati (2026-10-06):** `done`. Individual kirish/natija/test/versiya dalili [EXECUTION_STATUS.md — Yana 10 ta PLAN1 bandi](EXECUTION_STATUS.md#yana-10-ta-plan1-bandi--yakuniy-qabul-2026-10-06) bo‘limida.

  **Dalil:** `POS-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **POS-01.02** — Bo‘sh savat, manfiy/yaroqsiz son, ortiqcha chegirma va noto‘g‘ri IDlarni rad etish.

  **Texnologiya:** Zod schemas va TypeScript business rules.

  **Bajarish:** Miqdor finite/positive, savat nonempty, birlik aniqligi va chegirma chegarasini tekshirish; summalarni clientdan qabul qilib ishonmaslik.

  **Manba:** FULL_PROJECT_PLAN.md, 119-satr; vazifa №2 (POS-01).

  **Boshlash sharti:** SEC-01, CAT-01, INV-01, FIN-01, CRM-01, FIN-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Bo‘sh savat, nol/manfiy/NaN miqdor, ortiqcha chegirma va begona ID rad; DB o‘zgarmaydi.

  **Qabul holati (2026-10-06):** `done`. Individual kirish/natija/test/versiya dalili [EXECUTION_STATUS.md — Yana 10 ta PLAN1 bandi](EXECUTION_STATUS.md#yana-10-ta-plan1-bandi--yakuniy-qabul-2026-10-06) bo‘limida.

  **Dalil:** `POS-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **POS-01.03** — Savdo, to‘lov, ombor va auditni bitta nazorat qilinadigan amalda yakunlash.

  **Texnologiya:** Prisma interactive transaction, PostgreSQL.

  **Bajarish:** Ichki sale/payment/ledger/stock/audit bir transactionda; tashqi provayder uchun outbox va holat oqimi. Tashqi muvaffaqiyatni DB transaction bilan atomik deb hisoblamaslik.

  **Manba:** FULL_PROJECT_PLAN.md, 120-satr; vazifa №3 (POS-01).

  **Boshlash sharti:** SEC-01, CAT-01, INV-01, FIN-01, CRM-01, FIN-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Muvaffaqiyatda sale/payment/stock/audit mos; sun’iy o‘rta xatoda hammasi rollback.

  **Qabul holati (2026-10-06):** `done`. Individual kirish/natija/test/versiya dalili [EXECUTION_STATUS.md — Yana 10 ta PLAN1 bandi](EXECUTION_STATUS.md#yana-10-ta-plan1-bandi--yakuniy-qabul-2026-10-06) bo‘limida.

  **Dalil:** `POS-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **POS-01.04** — Takror so‘rov bir savdoni ikki marta yozmasligi uchun yagona amal kaliti qo‘shish — idempotency.

  **Texnologiya:** PostgreSQL unique operation key, Prisma.

  **Bajarish:** organization+operationId uchun unique constraint, payload hash va saqlangan natija. Bir xil kalit/bir xil payload natijani qaytaradi; boshqa payload konflikt beradi; tabiiy biznes FK ham noyob.

  **Manba:** FULL_PROJECT_PLAN.md, 121-satr; vazifa №4 (POS-01).

  **Boshlash sharti:** SEC-01, CAT-01, INV-01, FIN-01, CRM-01, FIN-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Bir operationIdning parallel/retry so‘rovi bitta sale/ledger yaratadi; boshqa payload 409 beradi.

  **Qabul holati (2026-10-06):** `done`. Individual kirish/natija/test/versiya dalili [EXECUTION_STATUS.md — Yana 10 ta PLAN1 bandi](EXECUTION_STATUS.md#yana-10-ta-plan1-bandi--yakuniy-qabul-2026-10-06) bo‘limida.

  **Dalil:** `POS-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **POS-01.05** — Ochiq smena, qoldiq, limit va holatni tranzaksiya ichida tekshirish; parallel amallardan himoya.

  **Texnologiya:** PostgreSQL conditional update/row locks, Prisma Serializable.

  **Bajarish:** Qoldiqni quantity>=kerak shartida atomik kamaytirish; smena/limit/holatni qisqa tranzaksiyada tekshirish. Bir xil tartibda lock, cheklangan P2034 retry va duplicate itemlarni birlashtirish.

  **Manba:** FULL_PROJECT_PLAN.md, 122-satr; vazifa №5 (POS-01).

  **Boshlash sharti:** SEC-01, CAT-01, INV-01, FIN-01, CRM-01, FIN-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Oxirgi dona uchun ikki parallel savdoda faqat ruxsatli bittasi o‘tadi; yopiq smena va limit rad.

  **Qabul holati (2026-10-06):** `done`. Individual kirish/natija/test/versiya dalili [EXECUTION_STATUS.md — Yana 10 ta PLAN1 bandi](EXECUTION_STATUS.md#yana-10-ta-plan1-bandi--yakuniy-qabul-2026-10-06) bo‘limida.

  **Dalil:** `POS-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **POS-01.06** — Chek raqamini yozuvlar soniga bog‘lamasdan noyob ajratish; fiskal raqamni alohida saqlash.

  **Texnologiya:** PostgreSQL counter/sequence va unique index.

  **Bajarish:** Ichki UUID va ko‘rinadigan chek raqami alohida; kassa counterini atomik ajratish. Raqam uzluksizligi qonuniy talab bo‘lsa gap siyosati tekshiriladi; fiskal raqam providerda qoladi.

  **Manba:** FULL_PROJECT_PLAN.md, 123-satr; vazifa №6 (POS-01).

  **Boshlash sharti:** SEC-01, CAT-01, INV-01, FIN-01, CRM-01, FIN-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Parallel savdolarning chek raqamlari noyob; fiskal raqam ichki raqamdan alohida.

  **Dalil:** `POS-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **POS-01.07** — Timeoutdan keyin “sotildimi?” holatini tekshirib, xavfsiz davom ettirish.

  **Texnologiya:** React retry UI, Next.js operation status API, Prisma.

  **Bajarish:** OperationId bilan mavjud natijani topish; unknown holatda yangi savdo yubormaslik. Xatoga mos retry va kassir uchun aniq davom ettirish amali.

  **Manba:** FULL_PROJECT_PLAN.md, 124-satr; vazifa №7 (POS-01).

  **Boshlash sharti:** SEC-01, CAT-01, INV-01, FIN-01, CRM-01, FIN-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Commitdan keyin javob uzilganda operation status original sale IDni qaytaradi; retry dublikat yaratmaydi.

  **Qabul holati (2026-10-06):** `done`. Individual kirish/natija/test/versiya dalili [EXECUTION_STATUS.md — Yana 10 ta PLAN1 bandi](EXECUTION_STATUS.md#yana-10-ta-plan1-bandi--yakuniy-qabul-2026-10-06) bo‘limida.

  **Dalil:** `POS-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **POS-01.08** — Yakunlangan savdoni yashirin tahrirlash/o‘chirishni taqiqlash; tuzatishni qarshi hujjat bilan yuritish.

  **Texnologiya:** TypeScript status transitions, Prisma permissions, SQL constraints.

  **Bajarish:** Completed hujjat o‘zgarmaydi; void draft uchun, moliyaviy tuzatish esa originalga bog‘langan reversal/return hujjati bilan. Bazadagi yozish vakolati va audit bilan himoya.

  **Manba:** FULL_PROJECT_PLAN.md, 125-satr; vazifa №8 (POS-01).

  **Boshlash sharti:** SEC-01, CAT-01, INV-01, FIN-01, CRM-01, FIN-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Yakunlangan savdo edit/delete orqali o‘zgarmaydi; reversal original bilan bog‘lanib auditlanadi.

  **Qabul holati (2026-10-06):** `done`. Individual kirish/natija/test/versiya dalili [EXECUTION_STATUS.md — Yana 10 ta PLAN1 bandi](EXECUTION_STATUS.md#yana-10-ta-plan1-bandi--yakuniy-qabul-2026-10-06) bo‘limida.

  **Dalil:** `POS-01.08` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

**Qabul mezoni:** tugma ikki marta bosilsa yoki so‘rov qayta yuborilsa bitta savdo/to‘lov/chiqim yoziladi. Oxirgi mahsulotni ikki kassa parallel sotganda siyosatga zid manfiy qoldiq yuz bermaydi.

#### POS-02 — kassir uchun to‘liq ekran [P1]

- [x] **POS-02.01** — Qoralamani saqlash, vaqtincha chetga qo‘yish, qayta ochish va bekor qilish.

  **Texnologiya:** React useReducer/Context, Next.js drafts, Prisma.

  **Bajarish:** Draft status va versiyasi; hold/resume/void amallari, optimistic concurrency. Bir draft ikki kassir tomonidan yashirin almashtirilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 131-satr; vazifa №1 (POS-02).

  **Boshlash sharti:** POS-01, RET-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Draft save/park/reopen/cancel holatlari server va UIga mos; bekor draft sotilmaydi.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `POS-02.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **POS-02.02** — Savatni brauzer yopilishi/yangilanishidan tiklash; qurilma va foydalanuvchi chegarasi.

  **Texnologiya:** Browser IndexedDB va React.

  **Bajarish:** Savatni user+organization+device bilan saqlash; qayta ochishda versiya va katalog yangiligi tekshiriladi. Tasdiqlangan savat tozalanadi, sinxronlanmagan amal alohida saqlanadi.

  **Manba:** FULL_PROJECT_PLAN.md, 132-satr; vazifa №2 (POS-02).

  **Boshlash sharti:** POS-01, RET-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Refresh/browser reopen o‘z savatini tiklaydi; boshqa user/device savati sizib chiqmaydi.

  **Qabul:** `done`, 2026-10-06. [Keyingi 10 ta bandning test va versiya dalili](EXECUTION_STATUS.md#keyingi-10-ta-plan1-bandi--savat-va-tolov-qabul-protokoli-2026-10-06).

  **Dalil:** `POS-02.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **POS-02.03** — Aralash to‘lov: masalan, 60 000 naqd + 40 000 karta; qisman nasiya.

  **Texnologiya:** React payment rows, Zod, Prisma.Decimal.

  **Bajarish:** Bir nechta usul qatori, nasiya mijozga bog‘lanadi; server yig‘indi savdo summasiga tengligini tekshiradi. Providerdagi pending kartani paid deb olish yo‘q.

  **Manba:** FULL_PROJECT_PLAN.md, 133-satr; vazifa №3 (POS-02).

  **Boshlash sharti:** POS-01, RET-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** 100000 chek uchun 60000 cash+40000 card va cash+debt variantlarida summa/pul/qarz mos.

  **Qabul:** `done`, 2026-10-06. [Keyingi 10 ta bandning test va versiya dalili](EXECUTION_STATUS.md#keyingi-10-ta-plan1-bandi--savat-va-tolov-qabul-protokoli-2026-10-06).

  **Dalil:** `POS-02.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **POS-02.04** — Qaytimni haqiqiy naqd berilgan summa bilan ko‘rsatish, tushumga faqat tegishli summani yozish.

  **Texnologiya:** React UI, Decimal server calculator, Payment DTO.

  **Bajarish:** tendered, applied va change alohida; naqd puldan haqiqiy qaytim ayriladi. Hisobotga faqat to‘langan savdo yoki ledger qiymati kiradi.

  **Manba:** FULL_PROJECT_PLAN.md, 134-satr; vazifa №4 (POS-02).

  **Boshlash sharti:** POS-01, RET-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** 100000 chekka 120000 berilganda qaytim 20000, cash tushum 100000 bo‘ladi.

  **Qabul:** `done`, 2026-10-06. [Keyingi 10 ta bandning test va versiya dalili](EXECUTION_STATUS.md#keyingi-10-ta-plan1-bandi--savat-va-tolov-qabul-protokoli-2026-10-06).

  **Dalil:** `POS-02.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **POS-02.05** — Klaviatura tezkor tugmalari, USB skaner, tezkor mahsulotlar, qulay qidiruv.

  **Texnologiya:** Browser keyboard events, React refs, PostgreSQL indexed search, ZXing.

  **Bajarish:** USB keyboard-wedge skaner oqimini inputga olish; debounce va fokus. Avval tenantli B-tree/trigram bilan qidiruv; tashqi search T09 faqat o‘lchangan ehtiyojda.

  **Manba:** FULL_PROJECT_PLAN.md, 135-satr; vazifa №5 (POS-02).

  **Boshlash sharti:** POS-01, RET-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Klaviatura/skaner/qidiruv orqali mouse talab qilmasdan savdo tugaydi; qo‘llangan tugmalar hujjatlashtirilgan.

  **Qabul (2026-10-07):** `done`. Individual natija va versiya dalili [joriy checkpointda](EXECUTION_STATUS.md#plus-20-2026-10-07-b--davom-etayotgan-qabul).

  **Dalil:** `POS-02.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **POS-02.06** — Har qator/butun chek chegirmasi; foiz/summa; sabab va tasdiq.

  **Texnologiya:** React discount controls, Zod, Decimal va Approval.

  **Bajarish:** Qator va chek foiz/summa modeli, bir xil taqsimlash/yaxlitlash; chegirma sababi va vakolat transactionda tekshiriladi.

  **Manba:** FULL_PROJECT_PLAN.md, 136-satr; vazifa №6 (POS-02).

  **Boshlash sharti:** POS-01, RET-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Line va receipt chegirmalari uchun foiz/summa/zero/boundary testlari; approval va sabab saqlanadi.

  **Dalil:** `POS-02.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul (2026-10-08):** `done`. Yakuniy individual dalil EXECUTION_STATUS.md dagi “Soliq, refund, scope va backup — yakuniy qabul” protokolida.

- [x] **POS-02.07** — Qoldiq va narx o‘zgarganini savat yakunida tushunarli ko‘rsatish.

  **Texnologiya:** Next.js validation response, React conflict modal.

  **Bajarish:** Yakunlashda narx versiyasi va qoldiqni qayta tekshirish; farqni ko‘rsatib qayta tasdiq olish. Stale client narxi server narxini almashtirmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 137-satr; vazifa №7 (POS-02).

  **Boshlash sharti:** POS-01, RET-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Draftdan keyingi narx/qoldiq o‘zgarishi checkoutda qayta tekshiriladi va kassirga aniq konflikt ko‘rsatiladi.

  **Dalil:** `POS-02.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **POS-02.08** — Mijoz tanlash, chek izohi, sotuvchi/xizmat turi kerak bo‘lsa belgilash.

  **Texnologiya:** React Select/Input, Prisma sale metadata.

  **Bajarish:** Mijoz, izoh va kerakli sotuvchi/xizmat ma’lumoti bitta draftga saqlanadi; tanlangan IDlar vakolat/tenant bilan tekshiriladi.

  **Manba:** FULL_PROJECT_PLAN.md, 138-satr; vazifa №8 (POS-02).

  **Boshlash sharti:** POS-01, RET-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Mijoz/izoh/sotuvchi/xizmat qiymatlari saqlanadi; optional maydonsiz savdo ham o‘tadi.

  **Qabul:** `done`, 2026-10-06. [Keyingi 10 ta bandning test va versiya dalili](EXECUTION_STATUS.md#keyingi-10-ta-plan1-bandi--savat-va-tolov-qabul-protokoli-2026-10-06).

  **Dalil:** `POS-02.08` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **POS-02.09** — Chekni qayta chiqarish, elektron chek, 58/80 mm andozalari; qayta chiqarishni belgilash.

  **Texnologiya:** HTML/CSS print, Next.js protected receipt, T02 barcode/QR, T08.

  **Bajarish:** 58/80 mm print media, original sale/fiscal snapshotdan qayta chek; reprint audit. Elektron chek tokenli muddatli havola orqali, tasdiqlangan aloqa kanaliga.

  **Manba:** FULL_PROJECT_PLAN.md, 139-satr; vazifa №9 (POS-02).

  **Boshlash sharti:** POS-01, RET-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** 58/80 mm bosma va elektron chek summalari originalga teng; reprint yangi savdo yaratmaydi va nusxa belgili.

  **Dalil:** `POS-02.09` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

**Qabul mezoni:** yangi kassir o‘rgatilgandan keyin qidiruv → savat → aralash to‘lov → chek jarayonini yordamchisiz bajara oladi.

#### RET-01 — qaytarish va pul qaytarish [P0]

- [x] **RET-01.01** — Original chek bo‘yicha to‘liq va qisman qaytarish.

  **Texnologiya:** React return screen, Next.js return service, Prisma.

  **Bajarish:** Original sale va saleItemga bog‘langan qisman/to‘liq qaytarish; satr miqdori, sabab va hujjat holati saqlanadi.

  **Manba:** FULL_PROJECT_PLAN.md, 145-satr; vazifa №1 (RET-01).

  **Boshlash sharti:** POS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Original chekdan full/partial return bajariladi; begona tenant cheki rad.

  **Qabul:** `done`, 2026-10-06. [Yana 15 ta bandning test va versiya dalili](EXECUTION_STATUS.md#yana-15-ta-plan1-bandi--yakuniy-qabul-2026-10-06).

  **Dalil:** `RET-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **RET-01.02** — Oldingi qaytarishlarni hisobga olish; sotilganidan ko‘p qaytarishni taqiqlash.

  **Texnologiya:** PostgreSQL row locks/conditional updates, Prisma Decimal.

  **Bajarish:** Original qator va returned quantityni transactionda tekshirish; parallel qaytarishlarda available-return miqdori atomik kamayadi.

  **Manba:** FULL_PROJECT_PLAN.md, 146-satr; vazifa №2 (RET-01).

  **Boshlash sharti:** POS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Parallel returns jami original miqdordan oshmaydi; oldingi returns ayiriladi.

  **Qabul:** `done`, 2026-10-06. [Yana 15 ta bandning test va versiya dalili](EXECUTION_STATUS.md#yana-15-ta-plan1-bandi--yakuniy-qabul-2026-10-06).

  **Dalil:** `RET-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **RET-01.03** — Chegirma va soliqni qaytarilayotgan qatorga to‘g‘ri taqsimlash.

  **Texnologiya:** Prisma.Decimal, original sale snapshots.

  **Bajarish:** Qaytarishga original chegirma/soliq qiymatini proporsional ajratish; oxirgi qismda rounding qoldig‘ini yopish. Joriy narx/soliq ishlatilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 147-satr; vazifa №3 (RET-01).

  **Boshlash sharti:** POS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Chegirmali/soliqli partial returns jami original to‘langan summadan oshmaydi; oxirgi rounding qoldig‘i yopiladi.

  **Dalil:** `RET-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul (2026-10-08):** `done`. Yakuniy individual dalil EXECUTION_STATUS.md dagi “Soliq, refund, scope va backup — yakuniy qabul” protokolida.

- [x] **RET-01.04** — Tovar omborga qaytadimi, brak omborigami yoki hisobdan chiqadimi — aniq tanlash.

  **Texnologiya:** Prisma warehouse/location + InventoryMovement.

  **Bajarish:** Sellable, defect va write-off yo‘nalishi; omborga qaytmagan tovar sotiladigan qoldiqni oshirmaydi. Hujjat va jurnal birga.

  **Manba:** FULL_PROJECT_PLAN.md, 148-satr; vazifa №4 (RET-01).

  **Boshlash sharti:** POS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Sellable/brak/write-off tanlovi mos movement yaratadi; sellable bo‘lmagan tovar mavjud qoldiqqa qo‘shilmaydi.

  **Dalil:** `RET-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **RET-01.05** — Naqd/karta/nasiya aralash savdoda pul va qarzning qaytarish tartibini belgilash.

  **Texnologiya:** TypeScript refund policy, PostgreSQL debt/cash ledgers.

  **Bajarish:** Naqd/karta qaytimi va nasiya kamayishi alohida ajratiladi; original to‘lov va avvalgi undirish hisobga olinadi. Mijozga qaytadigan pul operatorga aniq ko‘rsatiladi.

  **Manba:** FULL_PROJECT_PLAN.md, 149-satr; vazifa №5 (RET-01).

  **Boshlash sharti:** POS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Mixed cash/card/debt return allocation qarz va haqiqiy pulni alohida yangilaydi; original ulushlar oshmaydi.

  **Qabul (2026-10-07):** `done`. Individual natija va versiya dalili [joriy checkpointda](EXECUTION_STATUS.md#plus-20-2026-10-07-b--davom-etayotgan-qabul).

  **Dalil:** `RET-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **RET-01.06** — Provayder orqali refund, uning kutish/xato holati va takror so‘rovdan himoya.

  **Texnologiya:** Node fetch, Next.js callbacks, PostgreSQL outbox T08.

  **Bajarish:** Provider refundId, timeout/status polling va payloadga bog‘langan idempotency; qayta callback ledgerni takror yaratmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 150-satr; vazifa №6 (RET-01).

  **Boshlash sharti:** POS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Refund pending/error/confirmed alohida; timeout/retry/callback bitta iqtisodiy refund yaratadi.

  **Dalil:** `RET-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **RET-01.07** — Sabab, vakolat, tasdiqlovchi, qaytarma chek va audit.

  **Texnologiya:** Zod, Approval, AuditLog, HTML receipt.

  **Bajarish:** Sabab majburiyligi, vakolat va bir martalik tasdiq; original chekga qaytarma bog‘lanadi. Ichki audit shu transactionda.

  **Manba:** FULL_PROJECT_PLAN.md, 151-satr; vazifa №7 (RET-01).

  **Boshlash sharti:** POS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Sabab/actor/approval/original link/audit saqlangan; vakolatsiz refund rad.

  **Qabul:** `done`, 2026-10-06. [Yana 15 ta bandning test va versiya dalili](EXECUTION_STATUS.md#yana-15-ta-plan1-bandi--yakuniy-qabul-2026-10-06).

  **Dalil:** `RET-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **RET-01.08** — Tovar almashtirishni original qaytarish + yangi savdo sifatida bog‘lash.

  **Texnologiya:** Prisma relation va TypeScript exchange workflow.

  **Bajarish:** Return va yangi sale alohida hujjat, exchangeId bilan bog‘lanadi; farq pul/nasiya sifatida hisoblanadi. Yangi savdo muvaffaqiyatsiz bo‘lsa qaytarish holati yashirin qolmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 152-satr; vazifa №8 (RET-01).

  **Boshlash sharti:** POS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Exchange original return va yangi sale bilan bog‘langan; farq pul/qarz hisobida mos.

  **Dalil:** `RET-01.08` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

**Qabul mezoni:** 5 dona sotuvdan 2 dona qaytsa faqat 2 dona qoldiq va ularga tegishli pul/qarz qaytadi; ayni qaytarish takror yozilmaydi.

#### CAT-01 — savdoga tayyor katalog [P1]

- [x] **CAT-01.01** — Kategoriya daraxti, brend, rasm, tavsif va faol/arxiv holati.

  **Texnologiya:** Prisma relational models, React/Tailwind, Node file storage.

  **Bajarish:** Category parentId bilan daraxt, Brand va metadata; rasm vakolatli fayl omboriga. Arxiv tarixdagi product FKni o‘chirmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 158-satr; vazifa №1 (CAT-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Category cycle rad; brand/image/status CRUD ishlaydi; archived mahsulot yangi savdoda tanlanmaydi.

  **Qabul:** `done`, 2026-10-08. Protected files/katalog/CSP qabul protokoli EXECUTION_STATUS.md oxirida.

  **Dalil:** `CAT-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **CAT-01.02** — Bir mahsulot uchun bir nechta barkod; barkod yaratish va etiketka chiqarish.

  **Texnologiya:** Prisma ProductBarcode, ZXing decode, T02 bwip-js encode.

  **Bajarish:** Tenant ichida barcode unique; encode uchun mavjud ZXing decoder yetmaydi, standart generator T02. Etiketka HTML/CSS va printer andozasi.

  **Manba:** FULL_PROJECT_PLAN.md, 159-satr; vazifa №2 (CAT-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Bitta variantning ko‘p kodi qidiriladi; tenant duplicate rad; bosma kod skanerda originalga teng.

  **Qabul holati (2026-10-06):** `done`. Individual natija, test va versiya dalili [EXECUTION_STATUS.md — +50 checkpoint](EXECUTION_STATUS.md#50-sorovi--1-checkpoint-2026-10-06) bo‘limida.

  **Dalil:** `CAT-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **CAT-01.03** — Rang/o‘lcham kabi variantlar; har variantning alohida qoldig‘i va barkodi.

  **Texnologiya:** Prisma ProductVariant/Option, PostgreSQL unique.

  **Bajarish:** Variant kombinatsiyasi noyob, barcode va stockKey variantga bog‘lanadi; eski mahsulotlarga default variant migratsiyasi. React variant tanlash ekrani.

  **Manba:** FULL_PROJECT_PLAN.md, 160-satr; vazifa №3 (CAT-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Ikki rang/o‘lcham variantining stock va barcode mustaqil; umumiy mahsulotga noto‘g‘ri yig‘ilmaydi.

  **Dalil:** `CAT-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **CAT-01.04** — Birlik konvertatsiyasi: 1 quti = 12 dona; asosiy birlikda qoldiq, hujjatda savdo birligi.

  **Texnologiya:** Prisma Decimal conversion, TypeScript unit service.

  **Bajarish:** Base unit va conversion ratio; hujjatda asl miqdor/birlik ham saqlanadi. 1 quti=12 dona kirim/savdoda bir xil bazaviy miqdorga aylanadi.

  **Manba:** FULL_PROJECT_PLAN.md, 161-satr; vazifa №4 (CAT-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Bir quti savdosi 12 dona base stockni kamaytiradi; return va kasr conversion ayni nisbatda.

  **Dalil:** `CAT-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **CAT-01.05** — Kasr bilan sotish, birlik aniqligi, tarozi barkodidan vazn/narx ajratish.

  **Texnologiya:** Zod, Decimal, ZXing/keyboard scanner.

  **Bajarish:** Birlik uchun kasr aniqligi; scale barcode prefiksi/uzunligi/checksum bo‘yicha qoidalar. To‘g‘ridan-to‘g‘ri tarozi uchun HW-01 protokoli.

  **Manba:** FULL_PROJECT_PLAN.md, 162-satr; vazifa №5 (CAT-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Kg/metr kasr precisioni tekshirilgan; konfiguratsiyalangan weight barcode checksum/format xatosi rad.

  **Dalil:** `CAT-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Yangilanish (2026-10-13): in_progress; real scale blocked_external.** Foydalanuvchi tasdiqlangan model/format yo‘qligini bildirdi. Configurable approved-profile parser/checksum interface va4 sintetik test tayyor; vendor format/prefix/positions/checksum taxmin qilinmagan va checkoutga ulanmagan. Oddiy barcode/fractional sales o‘zgarmadi. `docs/operations/scale-barcode-boundary.md`; bu original band done yoki real hardware acceptance emas.

- [x] **CAT-01.06** — Chakana/ulgurji/mijoz narxlari; filial narxi va sanadan kuchga kiradigan narx.

  **Texnologiya:** Prisma price lists, PostgreSQL validity intervals.

  **Bajarish:** Retail/wholesale/customer/store narx ustuvorligi va effectiveAt; bir vaqtda zid narx qoidalarini tekshirish. Tarixiy sale snapshot o‘zgarmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 163-satr; vazifa №6 (CAT-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Retail/wholesale/customer/store/date precedence deterministic; effective date chegarasi testlangan.

  **Qabul:** `done`, 2026-10-08. [Narx va mijoz yakuniy qabul](EXECUTION_STATUS.md#narx-va-mijoz-yakuniy-qabul-2026-10-08).

  **Dalil:** `CAT-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **CAT-01.07** — Narx tarixi va ommaviy o‘zgartirish; tannarx uchun alohida ruxsat.

  **Texnologiya:** Prisma ProductPriceHistory, PostgreSQL trigger va 1–100 qatorli atomic transaction batch, Operation/IndexedDB, RBAC. Shu bounded sig‘imda qo‘shimcha worker kerak emas (ADR-029); katta katalog alohida tasdiqlanadigan batchlarga bo‘linadi.

  **Bajarish:** Ommaviy o‘zgarishni preview, batch, audit va tasdiq bilan; yangi narx katalogni yangilaydi, eski chekni emas. Tannarx eksporti ham alohida vakolat.

  **Manba:** FULL_PROJECT_PLAN.md, 164-satr; vazifa №7 (CAT-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Price bulk change tarix/audit yaratadi; vakolatsiz cost access rad.

  **Dalil:** `CAT-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **CAT-01.08** — Excel/CSV import, oldindan ko‘rish, dublikat/xato qatorlar hisoboti, eksport.

  **Texnologiya:** T03 ExcelJS, Zod, PostgreSQL import staging, Node streams.

  **Bajarish:** Mavjud stackda XLSX parser yo‘q; bitta kutubxona Excel/CSV uchun. Preview→validatsiya→import; fayl hash/row key, formula xavfsizligi, limit va xato fayli.

  **Manba:** FULL_PROJECT_PLAN.md, 165-satr; vazifa №8 (CAT-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Preview hech narsa yozmaydi; tasdiq importida xato/dublikatlar qaydi bor; export-import nazorat datasetida mos.

  **Dalil:** `CAT-01.08` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **CAT-01.09** — Soliq turi, MXIK va markirovka xususiyatlari tegishli tovar uchun.

  **Texnologiya:** Prisma tax/classification fields, Zod, provider adapter.

  **Bajarish:** MXIK, tax category va markirovka required flag; tegishli tovarni kerakli kodsiz savdoga qo‘ymaslik. Katalog manbasi LOC-01da tasdiqlanadi.

  **Manba:** FULL_PROJECT_PLAN.md, 166-satr; vazifa №9 (CAT-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Tegishli tovarning zarur tax/MXIK/marking maydonisiz checkout blok; oddiy tovar uchun ortiqcha shart yo‘q.

  **Dalil:** `CAT-01.09` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

**Qabul mezoni:** importni qayta yuborish yashirin dublikat yaratmaydi; quti bilan kirim va dona bilan savdo qoldiqni bir xil birlikda o‘zgartiradi.

### 6. Ombor, xarid va yetkazib beruvchi

#### INV-01 — qoldiq va harakatlarning yaxlitligi [P0]

- [x] **INV-01.01** — Har bir o‘zgarish uchun hujjat va ombor harakati; bevosita qoldiqni almashtirishni taqiqlash.

  **Texnologiya:** Prisma stock service, PostgreSQL ledger.

  **Bajarish:** Balance faqat InventoryMovement bilan bir transactionda o‘zgaradi; oddiy CRUD orqali balans patch yopiladi. Har harakat source document va actorga bog‘langan.

  **Manba:** FULL_PROJECT_PLAN.md, 174-satr; vazifa №1 (INV-01).

  **Boshlash sharti:** CAT-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Har stock o‘zgarishi source movementga ega; to‘g‘ridan quantity edit API orqali rad.

  **Qabul holati (2026-10-06):** `done`. Individual natija, test va versiya dalili [EXECUTION_STATUS.md — +50 checkpoint](EXECUTION_STATUS.md#50-sorovi--1-checkpoint-2026-10-06) bo‘limida.

  **Dalil:** `INV-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **INV-01.02** — Boshlang‘ich qoldiqni hujjat bilan kiritish; musbat/manfiy tuzatish, sabab va tasdiq.

  **Texnologiya:** React stock forms, Zod signed adjustment, Prisma transaction.

  **Bajarish:** Opening/adjustment turi, signed quantity, sabab va tasdiq; musbat kirim bilan manfiy kamomad aniq ajratiladi.

  **Manba:** FULL_PROJECT_PLAN.md, 175-satr; vazifa №2 (INV-01).

  **Boshlash sharti:** CAT-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Opening/positive/negative adjustment source/sabab/approval bilan; journal va balance mos.

  **Qabul holati (2026-10-06):** `done`. Individual natija, test va versiya dalili [EXECUTION_STATUS.md — +50 checkpoint](EXECUTION_STATUS.md#50-sorovi--1-checkpoint-2026-10-06) bo‘limida.

  **Dalil:** `INV-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **INV-01.03** — Tasdiqlangan hujjat o‘zgarmasligi; xatoni bekor qiluvchi yoki qarshi hujjat.

  **Texnologiya:** TypeScript document state machine, PostgreSQL.

  **Bajarish:** Draftgina tahrirlanadi; confirmedni reversal hujjat qaytaradi. Source/reversal noyob bog‘lanishi ikki marta bekor qilishni to‘xtatadi.

  **Manba:** FULL_PROJECT_PLAN.md, 176-satr; vazifa №3 (INV-01).

  **Boshlash sharti:** CAT-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Posted hujjatni edit/delete rad; reversal yangi yozuv va original link bilan.

  **Dalil:** `INV-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **INV-01.04** — Jo‘natishda yetarli qoldiq, yo‘ldagi mahsulot, qisman qabul, kamomad/brak hisobini yuritish.

  **Texnologiya:** Prisma transfer shipment/receipt items, SQL conditional stock.

  **Bajarish:** Jo‘natishda qoldiq atomik kamayadi, in-transit yozuvi; har qabul qatori qisman qabul/defect/difference bilan. Qabul qilinganidan ko‘p qabul rad etiladi.

  **Manba:** FULL_PROJECT_PLAN.md, 177-satr; vazifa №4 (INV-01).

  **Boshlash sharti:** CAT-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Send/partial receive/shortage/brak oqimida sent=received+in-transit+tasdiqlangan farq; stok ikki marta kirmaydi.

  **Dalil:** `INV-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul (2026-10-08):** `done`. Individual transfer conservation va qabul dalili EXECUTION_STATUS.md oxirida.

- [x] **INV-01.05** — Transferni jo‘natishdan oldin bekor qilish; jo‘natilgandan keyingi qaytarish qoidasi.

  **Texnologiya:** TypeScript transitions, Prisma return shipment.

  **Bajarish:** Draft cancel qoldiqni o‘zgartirmaydi; sentdan keyin jo‘natma qaytarish yoki qabul bilan yopiladi. Yo‘ldagi qoldiq tasdiqsiz yo‘qolmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 178-satr; vazifa №5 (INV-01).

  **Boshlash sharti:** CAT-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Draft cancel stockni o‘zgartirmaydi; sent transfer qaytarish hujjatisiz bekor qilinmaydi.

  **Dalil:** `INV-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **INV-01.06** — Qoldiq jurnaliga mosligini tekshiradigan avtomatik solishtirish va farq ogohlantirishi.

  **Texnologiya:** PostgreSQL aggregate SQL va Node worker.

  **Bajarish:** Ledger yig‘indisini balance bilan tenant/product/location bo‘yicha solishtirish; farqni Incidentga yozish. Worker o‘zicha balansni tuzatmaydi, tasdiqlangan adjustment kerak.

  **Manba:** FULL_PROJECT_PLAN.md, 179-satr; vazifa №6 (INV-01).

  **Boshlash sharti:** CAT-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Sun’iy balance farqi reconciliationda topiladi; ogohlantirish dalili va mos datasetda nol farq.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `INV-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **INV-01.07** — Manfiy qoldiq siyosatini aniq belgilash; yoqilsa foyda/tannarx ta’sirini hisoblash.

  **Tasdiqlangan scope (2026-10-13, ADR-083):** Foydalanuvchi manfiy qoldiqni butunlay taqiqladi; yoqish va negative valuation keyinga qoldirildi. API, UI, shared stock writer va native SQL taqiqi; parallel sale/replay/legacy recovery qabuli `tasks/evidence/negative-stock-disabled-20261013.json`da. Quyidagi conditional yoqish talabi hozir faol emas; bu imkoniyat tayyor deb da’vo qilinmaydi.

  **Texnologiya:** Prisma organization policy, Decimal valuation.

  **Bajarish:** Manfiyga ruxsat kim/nega berilganini auditlash; noma’lum cost uchun vaqtinchalik valuation va kelgan kirimdan keyingi correction. Yalpi foyda holati hisobotda belgilanadi.

  **Manba:** FULL_PROJECT_PLAN.md, 180-satr; vazifa №7 (INV-01).

  **Boshlash sharti:** CAT-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Default negative stock rad; yoqish approval/audit va cost policy talab qiladi; parallel test siyosatni saqlaydi.

  **Dalil:** `INV-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

**Qabul mezoni:** har do‘kon/mahsulot uchun boshlang‘ich qoldiq + harakatlar yig‘indisi joriy qoldiqqa teng. Takror tasdiqlash qoldiqni ikkinchi marta o‘zgartirmaydi.

#### INV-02 — inventarizatsiya va ombor boshqaruvi [P1]

- [x] **INV-02.01** — To‘liq/qisman sanash; kutilgan qoldiqni yashirib sanash imkoniyati.

  **Texnologiya:** React counting screen, Prisma CountSession/CountLine.

  **Bajarish:** Full/partial scope, sanovchi va sanash vaqti; blind count DTOda kutilgan sonni bermaslik. Birinchi va qayta sanash natijalari alohida.

  **Manba:** FULL_PROJECT_PLAN.md, 186-satr; vazifa №1 (INV-02).

  **Boshlash sharti:** INV-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Full/partial count va blind countda server/UI kutilgan sonni vakolatsiz oshkor qilmaydi.

  **Dalil:** `INV-02.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **INV-02.02** — Sanash davridagi savdolarni hisobga olish yoki vaqtinchalik bloklash siyosati.

  **Texnologiya:** PostgreSQL snapshot/version, Prisma movements.

  **Bajarish:** Sanash checkpointi va o‘rtadagi harakatlar bilan cut-off hisob; yoki tanlangan SKUga qisqa freeze. Uzoq baza lock bilan butun do‘konni ushlab turmaslik.

  **Manba:** FULL_PROJECT_PLAN.md, 187-satr; vazifa №2 (INV-02).

  **Boshlash sharti:** INV-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Count cut-off va keyingi movements hisobga olinadi; parallel savdo count farqiga ikki marta kirmaydi.

  **Dalil:** `INV-02.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **INV-02.03** — Farq hujjati, qayta sanash va tasdiqlovchi.

  **Texnologiya:** Prisma adjustment + Approval/AuditLog.

  **Bajarish:** Tasdiqlovchi qayta sanash farqini tekshiradi; final signed adjustment idempotent yaratiladi. Jurnal va sanash hujjati bog‘lanadi.

  **Manba:** FULL_PROJECT_PLAN.md, 188-satr; vazifa №3 (INV-02).

  **Boshlash sharti:** INV-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Recount/approvaldan keyin bitta adjustment; tasdiqsiz stock o‘zgarmaydi.

  **Dalil:** `INV-02.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **INV-02.04** — Minimal/maksimal qoldiq, tugayotgan mahsulot va qayta buyurtma tavsiyasi.

  **Texnologiya:** Prisma min/max policy, PostgreSQL aggregate, worker.

  **Bajarish:** Available stock, sotuv tezligi va lead time asosida tavsiya; avtomatik xaridni birinchi bosqichda tasdiqsiz jo‘natmaslik. Xabar outboxga.

  **Manba:** FULL_PROJECT_PLAN.md, 189-satr; vazifa №4 (INV-02).

  **Boshlash sharti:** INV-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Min/max chegaralarida alert/reorder miqdori aniq; takror worker keraksiz dublikat xabar yaratmaydi.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `INV-02.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **INV-02.05** — Ombor manzili/zonasi, brak va rezerv qoldiq kerak bo‘lsa alohida yuritish.

  **Texnologiya:** Prisma location/reservation models, SQL conditional reserve.

  **Bajarish:** Stockni ombor/zonaga ajratish; onHand, reserved va available formulasi yagona. Rezerv expiry workeri rezervni bir marta bo‘shatadi.

  **Manba:** FULL_PROJECT_PLAN.md, 190-satr; vazifa №5 (INV-02).

  **Boshlash sharti:** INV-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Location/brak/reserved/on-hand/available alohida; reserve release/sale testlari balansni saqlaydi.

  **Dalil:** `INV-02.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **INV-02.06** — Partiya, yaroqlilik muddati, FEFO tanlash va muddati yaqin ogohlantirish — oziq-ovqat segmentida P1.

  **Texnologiya:** Prisma Batch, PostgreSQL expiry index, Decimal.

  **Bajarish:** Kirim/sale batch bog‘lanishi; FEFO = muddati eng yaqin yaroqli partiya. Muddati o‘tgan tovar siyosati va worker ogohlantirishi.

  **Manba:** FULL_PROJECT_PLAN.md, 191-satr; vazifa №6 (INV-02).

  **Boshlash sharti:** INV-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Expiry/FEFO tanlash, muddati yaqin alert va muddati o‘tgan mahsulotni bloklash testlari o‘tadi.

  **Dalil:** `INV-02.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul (2026-10-13): done.** Native batch/entry/disposition, original FEFO/expiry va scoped report API/UI/CSV/worker; 95 PG regression,25 tenant/valuation,5 final batch assertions,3 final batch browsers va12 shared UI regression. 148 fresh/upgrade/repeat + native batch dump/restore,114 unit,type/lint/worker/build PASS. `tasks/evidence/inventory-batches-20261013.json`; `docs/operations/inventory-batches.md`. Real pilot/deploy alohida; chegaralar hujjatda.


  **Joriy holat (2026-10-12): in_progress.** Sof FEFO/expiry/business-day hisoblash moduli va6 unit gate tayyor; caller-authoritative stock/reservation/transaction, batch schema/journal, all writer coverage va alert/API/UI hali ochiq. Hech qanday stock posting yozilmadi. Original done emas; dalil `tasks/evidence/target170-core-20261012.json`.

- [x] **INV-02.07** — Seriya raqami/kafolat — elektronika segmentida P1.

  **Texnologiya:** Prisma SerialNumber/Warranty, PostgreSQL unique.

  **Bajarish:** Har birlik seriali va sotuvga bog‘lanishi; kafolat boshlanishi/shartlari snapshot. Takror serial sotish va qaytarish tekshiriladi.

  **Manba:** FULL_PROJECT_PLAN.md, 192-satr; vazifa №7 (INV-02).

  **Boshlash sharti:** INV-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Serial unique; sale-return-service kafolat izi original birlikka bog‘langan.

  **Dalil:** `INV-02.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Yakuniy holat (2026-10-13): done.** ADR088, SQL160–166: unused integer SKU owner/MFA policy; organization-unique serial, immutable native ordinal unit events, stock conservation, original receipt/sale/return/transfer/supplier/loss reversal va atomic exchange; configured sale warranty snapshot va original-unit service trace. Owner/admin paged history, cashier minimal DTO, durable policy/POS original-status recovery va branch/actor workspace reset mavjud.128unit/113PG (9serial,18landed-cost)/uch-browser9, type/lint/worker/build/scan PASS;166fresh/133upgrade/repeat va actual serial/warranty/service dump-restore PASS. Dalil `tasks/evidence/serials-warranty-20261013.json`; qo‘llanma `docs/operations/serials-warranty.md`. Original hisob169→170/259; migration/model/test/subtask sanalmadi. Serialized offline lease va aggregate quantity-only count fail-closed; aniq original unit oqimlari ishlaydi. Vendor/hardware va real production/pilot qabuli yo‘q.

#### PUR-01 — xarid va ta’minot [P1]

- [x] **PUR-01.01** — Yetkazib beruvchi kartasi, kontaktlar, rekvizitlar, shartlar va tarix.

  **Texnologiya:** React supplier card, Prisma Supplier/terms.

  **Bajarish:** Kontakt/rekvizit/shartlarni tenant bilan yuritish; hujjatlar, narxlar va to‘lov tarixini vakolatli tablarda ko‘rsatish.

  **Manba:** FULL_PROJECT_PLAN.md, 196-satr; vazifa №1 (PUR-01).

  **Boshlash sharti:** INV-01, FIN-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Supplier card/history tenantga tegishli; rekvizit/contact validatsiyasi va arxiv ishlaydi.

  **Dalil:** `PUR-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **PUR-01.02** — Buyurtma → qisman/to‘liq qabul → xarid hisoboti → to‘lov zanjiri.

  **Texnologiya:** Prisma PurchaseOrder/Receipt/Payable, TypeScript workflow.

  **Bajarish:** Buyurtma satri→qabul satri→qarz→to‘lov allocation bog‘lanadi; qisman qabul remaining quantityni saqlaydi. Qoldiq faqat qabul tasdiqlanganda.

  **Manba:** FULL_PROJECT_PLAN.md, 197-satr; vazifa №2 (PUR-01).

  **Boshlash sharti:** INV-01, FIN-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Order ikki qismda qabul qilinadi; order/receipt/stock/debt/payment jami mos va ortiqcha qabul nazoratlangan.

  **Dalil:** `PUR-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **PUR-01.03** — Yetkazib beruvchiga qaytarish, narx/miqdor farqi va qarzni yangilash.

  **Texnologiya:** Prisma PurchaseReturn, SQL locks, debt ledger.

  **Bajarish:** Original qabulga bog‘langan return, narx/miqdor correction; stock va supplier qarzi bir transactionda. Kamomad va refund alohida.

  **Manba:** FULL_PROJECT_PLAN.md, 198-satr; vazifa №3 (PUR-01).

  **Boshlash sharti:** INV-01, FIN-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Supplier return stock va supplier debtni original quantity/price chegarasida yangilaydi.

  **Dalil:** `PUR-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **PUR-01.04** — Yetkazib beruvchi qarzi, oldindan to‘lov va qisman to‘lash.

  **Texnologiya:** PostgreSQL supplier debt/cash journals, Prisma allocation.

  **Bajarish:** Avans, invoice va payment ajratiladi; qisman to‘lov qaysi invoicega berilgani yoziladi. Qarzni haqiqiy cash ledger bilan chalkashtirmaslik.

  **Manba:** FULL_PROJECT_PLAN.md, 199-satr; vazifa №4 (PUR-01).

  **Boshlash sharti:** INV-01, FIN-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Advance/partial payment qarzdan alohida ledgerda; qayta so‘rov to‘lovni takrorlamaydi.

  **Dalil:** `PUR-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **PUR-01.05** — Yetkazish/xarid xarajatlarini tannarxga taqsimlash siyosati.

  **Texnologiya:** Prisma.Decimal landed-cost service.

  **Bajarish:** Xarajatni qiymat/miqdor/vazn bo‘yicha belgilangan usulda qatorlarga tarqatish; rounding qoldig‘ini yopish. Oldin sotilgan stock uchun alohida cost correction.

  **Manba:** FULL_PROJECT_PLAN.md, 200-satr; vazifa №5 (PUR-01).

  **Boshlash sharti:** INV-01, FIN-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Landed cost allocation jami xarajatga teng; last-line rounding va nol denominator testlari bor.

  **Dalil:** `PUR-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Yakuniy holat (2026-10-13): done.** ADR081/085/086/087 bo‘yicha actual receipt/paid expense allocation, immutable application/reversal va future source-linked continuation journals bajarildi. Owner public API, durable preview/MFA/original-key lost-ACK/reload recovery, tenant-scoped history, dated profit/product/breakdown corrections ishlaydi. Original hujjatlar va cash qayta yozilmaydi. 128unit,115PG (17landed-cost), uch-brauzer15, type/lint/worker/build/scanner PASS. SQL149–159 fresh/133clone upgrade/repeat va actual application/continuation dump-restore PASS. Dalil: `tasks/evidence/receipt-cost-applications-complete-20261013.json`; qo‘llanma: `docs/operations/receipt-cost-applications.md`. Original hisob168→169/259; migration/test/subtask alohida sanalmadi. Production/vendor/hardware/pilot qabuliga da’vo yo‘q.

- [x] **PUR-01.06** — Xarid narxi tarixi, mahsulot/yetkazib beruvchi bo‘yicha tahlil.

  **Texnologiya:** PostgreSQL indexed history/aggregate, React report.

  **Bajarish:** Qabul qatorlari snapshotidan xarid narxi tarixi; supplier/product/date filtrlar, umumiy yig‘indi va eksport. Hozirgi katalog tannarxiga tayanmaslik.

  **Manba:** FULL_PROJECT_PLAN.md, 201-satr; vazifa №6 (PUR-01).

Xarid, inventarizatsiya va filial ombori amallari shakllangan POS mahsulotlarida ham mavjud. Shuni POS uchun bu vazifalar mahsulot rejasining tavsiyasidir. Manba: [Loyverse advanced inventory](https://loyverse.com/en-us/advanced-inventory).

  **Boshlash sharti:** INV-01, FIN-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Price history original receipt snapshotdan; supplier/product/date filtrli jami nazorat ma’lumotiga teng.

  **Qabul holati (2026-10-06):** `done`. Individual natija/test/versiya [EXECUTION_STATUS.md — +50 checkpoint 2](EXECUTION_STATUS.md#50-sorovi--2-checkpoint-xarid-narxlari-va-nasiya-2026-10-06) bo‘limida.

  **Dalil:** `PUR-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

### 7. Mijozlar, nasiya, sodiqlik va marketing

#### CRM-01 — to‘g‘ri qarz hisobi [P0]

- [x] **CRM-01.01** — Nasiya uchun mijoz, vakolat va limitni serverda majburiy tekshirish.

  **Texnologiya:** Prisma customer/permission, SQL lock, Decimal.

  **Bajarish:** Mijoz faol/tenant/limit va yangi qarzni transactionda tekshirish; bir vaqtdagi nasiya uchun customer debt aggregate atomik nazorat. Override approval bilan.

  **Manba:** FULL_PROJECT_PLAN.md, 209-satr; vazifa №1 (CRM-01).

  **Boshlash sharti:** FIN-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Mijozsiz/vakolatsiz/limitdan yuqori debt serverda rad; parallel checkout limitni buzmaydi.

  **Qabul holati (2026-10-06):** `done`. Individual natija/test/versiya [EXECUTION_STATUS.md — +50 checkpoint 2](EXECUTION_STATUS.md#50-sorovi--2-checkpoint-xarid-narxlari-va-nasiya-2026-10-06) bo‘limida.

  **Dalil:** `CRM-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **CRM-01.02** — Qarz yozuvini haqiqiy pul to‘lovidan ajratish: nasiya naqd tushum deb olinmasligi.

  **Texnologiya:** PostgreSQL DebtEntry va CashEntry, TypeScript ledger service.

  **Bajarish:** Credit sale qarz yaratadi, naqd pul yozuvi yaratmaydi; tashqi payment va debt settlement alohida tip. Eski credit in/out modelidan tekshirilgan migratsiya.

  **Manba:** FULL_PROJECT_PLAN.md, 210-satr; vazifa №2 (CRM-01).

  **Boshlash sharti:** FIN-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** 100000 debt sale cashni oshirmaydi; debt ledger +100000, revenue siyosatga mos.

  **Qabul holati (2026-10-06):** `done`. Individual natija/test/versiya [EXECUTION_STATUS.md — +50 checkpoint 2](EXECUTION_STATUS.md#50-sorovi--2-checkpoint-xarid-narxlari-va-nasiya-2026-10-06) bo‘limida.

  **Dalil:** `CRM-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **CRM-01.03** — Qarzni naqd/karta/o‘tkazma bilan undirish; pulni haqiqiy smena yoki hisobga yozish.

  **Texnologiya:** React collect form, Prisma payment/debt allocations.

  **Bajarish:** Haqiqiy to‘lov usuli, hisob/smena va qabul qiluvchini yozish; naqd undiruv cash ledgerni oshiradi, debt allocation qarzni kamaytiradi.

  **Manba:** FULL_PROJECT_PLAN.md, 211-satr; vazifa №3 (CRM-01).

  **Boshlash sharti:** FIN-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** 30000 collection debtni 30000 kamaytiradi va tanlangan real cash/bank hisobini shuncha oshiradi.

  **Qabul (2026-10-07):** `done`, manual core kanallari. Provider API alohida deferred. Individual natija/test/versiya EXECUTION_STATUS.md dagi `plus-20-c` bo‘limida.

  **Dalil:** `CRM-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **CRM-01.04** — Qisman undirish, oldindan to‘lov, ortiqcha to‘lov va qaytarish qoidalari.

  **Texnologiya:** Prisma allocation rules, Decimal.

  **Bajarish:** Avans/unallocated credit va qisman qarz yopish; ortiqcha to‘lovni yashirin manfiy qarzga emas alohida avansga yozish. Refund asosiy paymentga bog‘lanadi.

  **Manba:** FULL_PROJECT_PLAN.md, 212-satr; vazifa №4 (CRM-01).

  **Boshlash sharti:** FIN-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Partial/advance/overpayment/refund ledgerlari net balancega mos; ortiqcha undirish yashirilmaydi.

  **Dalil:** `CRM-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **CRM-01.05** — To‘lovni qaysi qarz/savdoga ajratishni yuritish; boshlang‘ich qarzni alohida hujjat bilan kiritish.

  **Texnologiya:** PostgreSQL settlement relations, Prisma opening document.

  **Bajarish:** FIFO debt settlement yoki explicit selection; opening debt tarixiy savdo soxtalashtirmasdan alohida hujjat. Har allocationning manbasi bor.

  **Manba:** FULL_PROJECT_PLAN.md, 213-satr; vazifa №5 (CRM-01).

  **Boshlash sharti:** FIN-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Allocation summa paymentdan oshmaydi; opening debt alohida source; FIFO va explicit allocation testlari bor.

  **Dalil:** `CRM-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **CRM-01.06** — Qarzni o‘chirish/tuzatish faqat sabab, vakolat va audit bilan.

  **Texnologiya:** Approval, Prisma reversal/audit transaction.

  **Bajarish:** Qarzni write-off qilish limit/ruxsat bilan va sababga bog‘lanadi; jurnalni delete qilmasdan correction entry. Qarshi yozuvning yagona manbasi saqlanadi.

  **Manba:** FULL_PROJECT_PLAN.md, 214-satr; vazifa №6 (CRM-01).

  **Boshlash sharti:** FIN-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Debt write-off/adjust sabab va approval bilan; history o‘chirilmaydi, vakolatsiz so‘rov rad.

  **Dalil:** `CRM-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **CRM-01.07** — Mijoz ko‘chirmasi: savdo, qaytarish, to‘lov, qarz qoldig‘i va muddat.

  **Texnologiya:** PostgreSQL tenant aggregate, React statement, HTML/PDF.

  **Bajarish:** Sana bo‘yicha opening, debit, settlement va closing; dueAt bo‘yicha qoldiq. Export ayni hisobdan, telefon/qarz faqat vakolatli foydalanuvchiga.

  **Manba:** FULL_PROJECT_PLAN.md, 215-satr; vazifa №7 (CRM-01).

  **Boshlash sharti:** FIN-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Statement sales/returns/payments/opening balance yakuni debt ledgerga teng; sana/tenant filtri mos.

  **Dalil:** `CRM-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

**Qabul mezoni:** 100 000 nasiya savdosidan keyin 30 000 naqd undirilib, qarz 70 000ga tushadi va kassaning naqd puli 30 000ga oshadi. Keyingi qaytarish ikkalasini buzmaydi.

#### CRM-02 — mijoz bilan ishlash [P1/P2]

- [x] **CRM-02.01** — P1: mijoz qidirish, dublikatlarni nazorat qilish, xarid tarixi, guruhlar va narx darajasi.

  **Texnologiya:** Prisma customer group/pricelist, PostgreSQL search.

  **Bajarish:** Telefonni normallashtirish va tenant dublikat nazorati; mijoz merge zarur bo‘lsa tarixiy allocationlar transactionda ko‘chiriladi.

  **Manba:** FULL_PROJECT_PLAN.md, 221-satr; vazifa №1 (CRM-02).

  **Boshlash sharti:** CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Search/history/group/pricing tenant scope bilan; duplicate merge original tarixni saqlaydi.

  **Qabul:** `done`, 2026-10-08. [Narx va mijoz yakuniy qabul](EXECUTION_STATUS.md#narx-va-mijoz-yakuniy-qabul-2026-10-08).

  **Dalil:** `CRM-02.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **CRM-02.02** — P1: qarz muddati/kechikish hisoboti, mijozga ko‘chirma va rozilik asosida eslatma.

  **Texnologiya:** PostgreSQL dueAt aggregates, Node worker, T08 notification.

  **Bajarish:** Aging bucket va kechikish; rozilik/kanal/preference tekshirilgan reminder. Qayta worker bir eslatmani qayta-qayta jo‘natmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 222-satr; vazifa №2 (CRM-02).

  **Boshlash sharti:** CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Due/overdue boundary to‘g‘ri; consent yo‘q/revoked mijozga eslatma yuborilmaydi.

  **Dalil:** `CRM-02.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **CRM-02.03** — P2: bonus ballari, chegirma kartasi, promo-kod va sovg‘a sertifikati.

  **Texnologiya:** Prisma loyalty/gift ledgers, TypeScript rule engine.

  **Bajarish:** Points/promo validity, limit va gift liability; sarflash transactionda. Sovg‘a sertifikatini sotish va undan foydalanishni ikki marta revenue deb olmaslik.

  **Manba:** FULL_PROJECT_PLAN.md, 223-satr; vazifa №3 (CRM-02).

  **Boshlash sharti:** CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Bonus/card/promo/certificate rules va liability yozuvlari ishlaydi; redemption duplicate/expiry/limit rad.

  **Qabul:** `done`, 2026-10-15. [Local core qabul dalili](evidence/loyalty-marketing-20261015.json): karta/promo/gift/points, transactional usage/expiry/liability, native source/restore va owner/cashier UI. Vendor/pilot qabul alohida.

  **Dalil:** `CRM-02.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **CRM-02.04** — P2: bonusning qaytarishda bekor bo‘lishi, muddati va suiiste’moldan himoya.

  **Texnologiya:** PostgreSQL original/reversal relation, SQL locks.

  **Bajarish:** Ball original salega bog‘lanadi, return uchun proporsional reversal; expiry va redemption audit. Bir amal kaliti ikkinchi bonus bermaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 224-satr; vazifa №4 (CRM-02).

  **Boshlash sharti:** CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Partial refund bonusni proporsional bekor qiladi; expiry/replay/parallel redemption manfiy qoldiq yaratmaydi.

  **Dalil:** `CRM-02.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **CRM-02.05** — P2: marketing SMS/Telegram; xizmat xabari va reklama roziligini alohida boshqarish.

  **Texnologiya:** Prisma Consent, outbox worker, T08 SMS/Telegram.

  **Bajarish:** Service va marketing consent alohida; unsubscribe, chastota limiti va delivery status. Provider API native fetch orqali, roziliksiz reklama yuborilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 225-satr; vazifa №5 (CRM-02).

  **Boshlash sharti:** CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Marketing va service consent alohida; opt-out keyingi jo‘natishni bloklaydi; delivery/retry dalili bor.

  **Dalil:** `CRM-02.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

### 8. Pul, smena, soliq va hisobotlar

#### FIN-01 — kassa va pul hisobi [P0]

- [x] **FIN-01.01** — Har kassada bir ochiq smena qoidasi bazada ham himoyalangan bo‘lishi.

  **Texnologiya:** PostgreSQL partial unique index, Prisma migration.

  **Bajarish:** status=open bo‘lgan registerId uchun unique indeks; mavjud dublikatlar avval ko‘rib chiqiladi. Index Prisma sxemasida ifodalanmasa custom migration SQL ishlatiladi.

  **Manba:** FULL_PROJECT_PLAN.md, 231-satr; vazifa №1 (FIN-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Ikki parallel open shift so‘rovida bazada faqat bitta active shift qoladi.

  **Qabul holati (2026-10-06):** `done`. Individual kirish/natija/test/versiya dalili [EXECUTION_STATUS.md — Yana 10 ta PLAN1 bandi](EXECUTION_STATUS.md#yana-10-ta-plan1-bandi--yakuniy-qabul-2026-10-06) bo‘limida.

  **Dalil:** `FIN-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIN-01.02** — Smenani ochish, yopish va topshirish; ochiq savdolar/integratsiya kutishlari uchun siyosat.

  **Texnologiya:** Prisma shift transaction, TypeScript state machine.

  **Bajarish:** Close/hand-overda ochiq drafts va pending provider amallari tekshiriladi; ownership lock. Savdo parallel kelganda yopilgan smenaga pul yozilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 232-satr; vazifa №2 (FIN-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Open/close/handover oqimi auditli; unresolved payment/integration bo‘lsa close siyosatga ko‘ra blok.

  **Dalil:** `FIN-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIN-01.03** — Savdo, qarz undirish, refund, naqd kirim/chiqim va inkassatsiyani alohida hisoblash.

  **Texnologiya:** PostgreSQL typed cash journal, Prisma.

  **Bajarish:** Sale receipt, debt collection, refund, cash in/out va bank deposit alohida source/direction; bittasi boshqasining daromadi hisoblanmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 233-satr; vazifa №3 (FIN-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Sale/collection/refund/deposit/withdrawal/inkassatsiya alohida; opening+net=cash expected.

  **Qabul:** `done`, 2026-10-06. [Yana 15 ta bandning test va versiya dalili](EXECUTION_STATUS.md#yana-15-ta-plan1-bandi--yakuniy-qabul-2026-10-06).

  **Dalil:** `FIN-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIN-01.04** — Sanalgan pul, kutilgan pul, farq, sabab va rahbar tasdig‘i.

  **Texnologiya:** Prisma.Decimal aggregate, React close form, Approval.

  **Bajarish:** Expected/count/difference transactionda hisoblanadi; farq limiti oshsa manager tasdiq. Son/sabab va kim sanagani auditga.

  **Manba:** FULL_PROJECT_PLAN.md, 234-satr; vazifa №4 (FIN-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Counted-expected farqi to‘g‘ri; nol va nonzero misollar, sabab va manager approval saqlangan.

  **Dalil:** `FIN-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIN-01.05** — Naqd savdoda berilgan pul/qaytimni tushum bilan chalkashtirmaslik.

  **Texnologiya:** Decimal money service, PostgreSQL tender/change fields.

  **Bajarish:** tendered minus change = applied cash; sale revenue va kassa puli turli ko‘rsatkich. Testda 100 000 berib 80 000 sale uchun 20 000 change.

  **Manba:** FULL_PROJECT_PLAN.md, 235-satr; vazifa №5 (FIN-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** 120000 tender/20000 change misolida cash revenue 100000; tender tushum deb hisoblanmaydi.

  **Qabul:** `done`, 2026-10-06. [Keyingi 10 ta bandning test va versiya dalili](EXECUTION_STATUS.md#keyingi-10-ta-plan1-bandi--savat-va-tolov-qabul-protokoli-2026-10-06).

  **Dalil:** `FIN-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **FIN-01.06** — Karta/QR/o‘tkazma bo‘yicha provayder tushumi, komissiya va bank tushumini solishtirish.

  **Texnologiya:** Node provider adapter, PostgreSQL reconciliation, T03 import.

  **Bajarish:** Provider gross, commission va bank netni externalId bo‘yicha moslash; unmatched yozuvlar ro‘yxati. CSV/XLSX bank importi preview va auditli.

  **Manba:** FULL_PROJECT_PLAN.md, 236-satr; vazifa №6 (FIN-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Provider gross/fee/net/bank match hisoblangan; mismatch aniqlanadi va noma’lum tushum confirmed emas.

  **Dalil:** `FIN-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIN-01.07** — Yopilgan smenani yashirin tahrirlamaslik; tuzatish hujjati.

  **Texnologiya:** Prisma immutable shift, correction journal.

  **Bajarish:** Closed smena o‘zgarmaydi; keyingi vakolatli correction hujjat original smenaga havola qiladi. Qayta close idempotent natija beradi.

  **Manba:** FULL_PROJECT_PLAN.md, 237-satr; vazifa №7 (FIN-01).

  **Boshlash sharti:** SEC-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Closed shift edit/delete rad; correction yangi hujjatda original bilan bog‘langan.

  **Qabul:** `done`, 2026-10-06. [Yana 15 ta bandning test va versiya dalili](EXECUTION_STATUS.md#yana-15-ta-plan1-bandi--yakuniy-qabul-2026-10-06).

  **Dalil:** `FIN-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

#### FIN-02 — foyda va xarajatlar [P1]

- [x] **FIN-02.01** — Tannarx usulini belgilash: dastlab vaznli o‘rtacha; FIFO/partiya ehtiyoji bo‘lsa kengaytirish.

  **Texnologiya:** Prisma.Decimal, PostgreSQL stock valuation.

  **Bajarish:** Weighted average kirim transactionida: old value+purchase value / new quantity. FIFO uchun BatchCostLayers; manfiy stock va return original cost siyosati alohida.

  **Manba:** FULL_PROJECT_PLAN.md, 241-satr; vazifa №1 (FIN-02).

  **Boshlash sharti:** CAT-01, INV-01, FIN-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Weighted average opening+receipt misoli qo‘lda hisobga teng; zero/return holatlari testlangan.

  **Qabul:** `done`, 2026-10-06. [Yana 15 ta bandning test va versiya dalili](EXECUTION_STATUS.md#yana-15-ta-plan1-bandi--yakuniy-qabul-2026-10-06).

  **Dalil:** `FIN-02.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIN-02.02** — Har savdo qatorining tarixiy tannarxi, chegirmasi, solig‘i va yaxlitlanishini saqlash.

  **Texnologiya:** Prisma SaleItem snapshot, Decimal rounding policy.

  **Bajarish:** Sale qatori nom/narx/cost/tax/discount/rounding versiyasini saqlaydi; hisob browser Numberga bog‘liq emas. API decimalni aniq string ko‘rinishida beradi.

  **Manba:** FULL_PROJECT_PLAN.md, 242-satr; vazifa №2 (FIN-02).

  **Boshlash sharti:** CAT-01, INV-01, FIN-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Keyingi price/cost/tax o‘zgarishi oldingi sale snapshot va profitni o‘zgartirmaydi.

  **Dalil:** `FIN-02.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul (2026-10-08):** `done`. Yakuniy individual dalil EXECUTION_STATUS.md dagi “Soliq, refund, scope va backup — yakuniy qabul” protokolida.

- [x] **FIN-02.03** — Chek chegirmasini qatorlarga taqsimlash; qaytarishni shu qiymatlardan hisoblash.

  **Texnologiya:** TypeScript Decimal allocation.

  **Bajarish:** Chek chegirmasini qatorlarga proporsional va deterministik taqsimlash; minor-unit qoldig‘ini belgilangan qatorlarga ajratish. Return aynan shu snapshotdan.

  **Manba:** FULL_PROJECT_PLAN.md, 243-satr; vazifa №3 (FIN-02).

  **Boshlash sharti:** CAT-01, INV-01, FIN-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Receipt discount allocation yig‘indisi aynan discountga teng; partial returns original taqsimotni ishlatadi.

  **Qabul holati (2026-10-06):** `done`. Individual kirish/natija/test/versiya dalili [EXECUTION_STATUS.md — Yana 10 ta PLAN1 bandi](EXECUTION_STATUS.md#yana-10-ta-plan1-bandi--yakuniy-qabul-2026-10-06) bo‘limida.

  **Dalil:** `FIN-02.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIN-02.04** — Biznes xarajatlari, toifalari va to‘lov hisoblari.

  **Texnologiya:** React expense screens, Prisma Expense/Category/Account.

  **Bajarish:** Xarajat hujjati, to‘lov hisobi va sabab; approval va cash posting birga. Expense bilan stock purchase tannarxini ikki marta kiritmaslik.

  **Manba:** FULL_PROJECT_PLAN.md, 244-satr; vazifa №4 (FIN-02).

  **Boshlash sharti:** CAT-01, INV-01, FIN-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Expense category/account/vakolat/audit va reversal ishlaydi; expense revenuega qo‘shilmaydi.

  **Dalil:** `FIN-02.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIN-02.05** — Yalpi foyda va operatsion foydani aniq ajratish; to‘liq buxgalteriya hisobi bilan teng deb ko‘rsatmaslik.

  **Texnologiya:** PostgreSQL views/aggregate, React labeled reports.

  **Bajarish:** Net sales minus COGS = gross profit; belgilangan operating expensesdan keyin operating profit. Hisobot nomlari soliq/buxgalteriya natijasi deb va’da qilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 245-satr; vazifa №5 (FIN-02).

  **Boshlash sharti:** CAT-01, INV-01, FIN-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Gross=net sales-COGS; operating=gross-expenses; ikkalasi alohida nomlanib datasetda mos.

  **Dalil:** `FIN-02.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIN-02.06** — Naqd, bank va provayder hisoblari orasidagi pul o‘tkazmalarini ikki marta tushum deb hisoblamaslik.

  **Texnologiya:** Prisma account transfers, PostgreSQL balanced postings.

  **Bajarish:** From/to bir transferIdga bog‘lanadi; ikkalasi atomik yoziladi. Filial/kassa/bank orasidagi ko‘chish revenuega kirmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 246-satr; vazifa №6 (FIN-02).

  **Boshlash sharti:** CAT-01, INV-01, FIN-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Cash-to-bank transfer ikki ledger tomonida teng; revenue va jami aktiv qiymatini oshirmaydi.

  **Dalil:** `FIN-02.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **FIN-02.07** — Soliq stavkasi, imtiyoz, narx ichida/tashqarisida soliq siyosatini sozlash; stavka tarixini saqlash.

  **Texnologiya:** Prisma tax profiles/history, Decimal tax service.

  **Bajarish:** Included/excluded tax, exemption va effective dates; savdo paytidagi qoidaning versiyasini snapshotlash. Amaldagi talablar LOC/LEGda tasdiqlanadi.

  **Manba:** FULL_PROJECT_PLAN.md, 247-satr; vazifa №7 (FIN-02).

  **Boshlash sharti:** CAT-01, INV-01, FIN-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Tax-inclusive/exclusive/exemption/effective-date misollari aniq; eski savdo tax snapshoti saqlanadi.

  **Dalil:** `FIN-02.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

#### REP-01 — ishonchli hisobotlar [P0/P1]

  **Qabul (2026-10-08):** `done`. Yakuniy individual dalil EXECUTION_STATUS.md dagi “Soliq, refund, scope va backup — yakuniy qabul” protokolida.

- [x] **REP-01.01** — P0: tashkilot va do‘kon filtri hamma ko‘rsatkichga tatbiq etilishi.

  **Texnologiya:** Next.js DAL, Prisma relational filters, PostgreSQL SQL.

  **Bajarish:** Har report builder authorized organization/store scope oladi; raw SQL ham parametrlangan va tenantli. Count, total va grafik shu scope bilan.

  **Manba:** FULL_PROJECT_PLAN.md, 251-satr; vazifa №1 (REP-01).

  **Boshlash sharti:** POS-01, RET-01, PUR-01, FIN-01, CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Barcha reportlar A/B tenant va store allow/deny testidan o‘tadi.

  **Qabul:** `done`, 2026-10-06. [Yana 15 ta bandning test va versiya dalili](EXECUTION_STATUS.md#yana-15-ta-plan1-bandi--yakuniy-qabul-2026-10-06).

  **Dalil:** `REP-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **REP-01.02** — P0: vaqt zonasi, davr boshi/oxiri; oxirgi kun to‘liq kirishi.

  **Texnologiya:** PostgreSQL timestamptz/AT TIME ZONE, Intl display.

  **Bajarish:** Biznes mahalliy kunidan UTC start va next-day exclusive end olish; bir kunni 24 soat deb faraz qilmaslik. Date-only bilan locale/timezone tekshiriladi.

  **Manba:** FULL_PROJECT_PLAN.md, 252-satr; vazifa №2 (REP-01).

  **Boshlash sharti:** POS-01, RET-01, PUR-01, FIN-01, CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Asia/Tashkent yarim ochiq davr va UTC conversion testlari oxirgi kunni to‘liq qamraydi.

  **Qabul:** `done`, 2026-10-06. [Yana 15 ta bandning test va versiya dalili](EXECUTION_STATUS.md#yana-15-ta-plan1-bandi--yakuniy-qabul-2026-10-06).

  **Dalil:** `REP-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **REP-01.03** — P0: yig‘indilar joriy sahifadan emas, barcha mos yozuvlardan olinishi.

  **Texnologiya:** Prisma aggregate/groupBy yoki parameterized SQL.

  **Bajarish:** Yig‘indi limit/offset qo‘yilmagan filtrga, satrlar sahifaga; count va total bir xil filter factorydan. Dataset o‘zgarsa snapshot/cut-off belgilash.

  **Manba:** FULL_PROJECT_PLAN.md, 253-satr; vazifa №3 (REP-01).

  **Boshlash sharti:** POS-01, RET-01, PUR-01, FIN-01, CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Paginationdan qat’i nazar totals barcha matching rowsga teng; 1000 yozuvda tekshirilgan.

  **Qabul:** `done`, 2026-10-06. [Yana 15 ta bandning test va versiya dalili](EXECUTION_STATUS.md#yana-15-ta-plan1-bandi--yakuniy-qabul-2026-10-06).

  **Dalil:** `REP-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **REP-01.04** — P0: sotuv, refund, nasiya va haqiqiy pul tushumi bir-biridan ajratilishi.

  **Texnologiya:** PostgreSQL sale/return/debt/cash views.

  **Bajarish:** Revenue, collection, receivable va refund alohida formulalar; status va original correctionga mos. Bir reportda nasiya tushumga aralashmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 254-satr; vazifa №4 (REP-01).

  **Boshlash sharti:** POS-01, RET-01, PUR-01, FIN-01, CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Sale/refund/debt/cash collection ko‘rsatkichlari alohida va ledger datasetiga teng.

  **Qabul:** `done`, 2026-10-06. [Yana 15 ta bandning test va versiya dalili](EXECUTION_STATUS.md#yana-15-ta-plan1-bandi--yakuniy-qabul-2026-10-06).

  **Dalil:** `REP-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **REP-01.05** — P0: tannarx har qator `miqdor × tarixiy tannarx`dan hisoblanishi.

  **Texnologiya:** PostgreSQL SUM(quantity*historicalCost), Decimal.

  **Bajarish:** Har qator COGS va qaytarma reversal yig‘indisi; avg(cost)*sum(quantity) usuli ishlatilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 255-satr; vazifa №5 (REP-01).

  **Boshlash sharti:** POS-01, RET-01, PUR-01, FIN-01, CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** COGS har satr qty×historical costdan; quantity 1dan katta misolda mos.

  **Qabul:** `done`, 2026-10-06. [Yana 15 ta bandning test va versiya dalili](EXECUTION_STATUS.md#yana-15-ta-plan1-bandi--yakuniy-qabul-2026-10-06).

  **Dalil:** `REP-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **REP-01.06** — P1: savdo, mahsulot, kategoriya, kassir, filial va to‘lov turi kesimidagi tahlil.

  **Texnologiya:** Prisma groupBy, indexed PostgreSQL, React SVG/tables.

  **Bajarish:** Filial/kassir/category/paytype bo‘yicha aggregate; grafiklarni dastlab SVG/CSS bilan. Faqat murakkab interaktiv chart ehtiyojida T09 chart kutubxonasi.

  **Manba:** FULL_PROJECT_PLAN.md, 256-satr; vazifa №6 (REP-01).

  **Boshlash sharti:** POS-01, RET-01, PUR-01, FIN-01, CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Product/category/cashier/store/payment kesimlari jami bir davr overall totalga teng.

  **Dalil:** `REP-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **REP-01.07** — P1: qoldiq qiymati, ombor harakati, kam qoldiq, yaroqlilik va sekin sotiladigan tovarlar.

  **Texnologiya:** PostgreSQL stock/batch/valuation aggregates.

  **Bajarish:** Qoldiq, rezerv/available, expiry va so‘nggi sale davri; low-stockni LIMITdan oldin SQLda filtrlash. Balance bo‘lmagan zero SKU ham siyosatga ko‘ra hisobga olinadi.

  **Manba:** FULL_PROJECT_PLAN.md, 257-satr; vazifa №7 (REP-01).

  **Boshlash sharti:** POS-01, RET-01, PUR-01, FIN-01, CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Stock valuation/movement/low-stock/expiry/slow-item natijalari oldindan hisoblangan datasetga teng.

  **Dalil:** `REP-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul (2026-10-13): done.** Native batch/entry/disposition, original FEFO/expiry va scoped report API/UI/CSV/worker; 95 PG regression,25 tenant/valuation,5 final batch assertions,3 final batch browsers va12 shared UI regression. 148 fresh/upgrade/repeat + native batch dump/restore,114 unit,type/lint/worker/build PASS. `tasks/evidence/inventory-batches-20261013.json`; `docs/operations/inventory-batches.md`. Real pilot/deploy alohida; chegaralar hujjatda.


  **Oldingi checkpoint (2026-10-11): in_progress edi.** Qoldiq qiymati/jurnal/kam qoldiq va filialdagi N×24soat completed-sale inactivity tahlili API/UI/CSVda qabuldan o‘tdi (30/60/90 UI,1–3650 API). Omborda turish yoshi emas. Finance67/focused1/unit33/browser3, production build PASS. `tasks/evidence/inactive-stock-20261011.json`; `docs/operations/inventory-inactivity.md`. Partiya/yaroqlilik muddati INV-02.06 va expiry report ochiq; original done hisoblanmaydi.

- [x] **REP-01.08** — P1: smena, pul farqi, mijoz qarzi muddati, yetkazib beruvchi qarzi va xarid hisoboti.

  **Texnologiya:** Prisma report queries, shared Decimal definitions.

  **Bajarish:** Shift/debt/supplier/purchase hisobotlari bir xil ledger va dueAtdan; vaqt zonasi va scope umumiy. Cross-report reconciliation test.

  **Manba:** FULL_PROJECT_PLAN.md, 258-satr; vazifa №8 (REP-01).

  **Boshlash sharti:** POS-01, RET-01, PUR-01, FIN-01, CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Shift/cash variance/customer due/supplier debt/purchase reportlari mos ledger bilan reconcile qilinadi.

  **Dalil:** `REP-01.08` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **REP-01.09** — P1: to‘liq filtrlangan CSV/XLSX/PDF eksport; katta eksportni fon ishida bajarish.

  **Texnologiya:** Node streams, T03 ExcelJS, HTML print/T04 Playwright PDF, worker.

  **Bajarish:** CSV streaming; XLSX uchun ExcelJS; user PDF uchun print-to-PDF, avtomatik downloadable PDF zarur bo‘lsa Playwright Chromium worker. To‘liq dataset cursor bilan, huquqi qayta tekshiriladi.

  **Manba:** FULL_PROJECT_PLAN.md, 259-satr; vazifa №9 (REP-01).

  **Boshlash sharti:** POS-01, RET-01, PUR-01, FIN-01, CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** 1000+ filtered rows CSV/XLSX/PDFga to‘liq kiradi; async export tenant authorization va expiry bilan.

  **Dalil:** `REP-01.09` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul holati (2026-10-11): done.** 18 shared query, cursor/snapshot full CSV/XLSX/browser print-to-PDF, background live authorization/lease/audit/hash/expiry.1001 filtered sale rows va1011.01 total CSV/XLSX/actual29-page PDFda to‘liq; UI1001 product rows Chromium/Firefox/WebKitda PASS. PDF — original rejadagi user print-to-PDF varianti; downloadable automatic server PDF emas. [163 qabul protokoli](EXECUTION_STATUS.md#original-160163--fix-0107-data-0104-rep-0109-qabuli-2026-10-11). `tasks/evidence/core-163-20261011.json`.

- [x] **REP-01.10** — P1: jadvaldagi umumiy son, eksport va dashboard bir davr uchun mos kelishi.

  **Texnologiya:** TypeScript shared report filter/DTO, PostgreSQL repeatable snapshot.

  **Bajarish:** Dashboard/jadval/eksport bir xil formulas va cut-offdan; katta eksport boshlanish holatini saqlaydi. Har xil vaqtdagi natija farqi timestamp bilan tushuntiriladi.

  **Manba:** FULL_PROJECT_PLAN.md, 260-satr; vazifa №10 (REP-01).

  **Boshlash sharti:** POS-01, RET-01, PUR-01, FIN-01, CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Dashboard/table/export ayni timezone/filter/cut-offda count va jami bo‘yicha teng.

  **Qabul:** `done`, 2026-10-06. [Yana 15 ta bandning test va versiya dalili](EXECUTION_STATUS.md#yana-15-ta-plan1-bandi--yakuniy-qabul-2026-10-06).

  **Dalil:** `REP-01.10` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **REP-01.11** — P2: rejalashtirilgan hisobot, filial taqqoslash, KPI va talab prognozi.

  **Texnologiya:** PostgreSQL scheduled jobs, Node worker, React.

  **Bajarish:** Rejalangan export va KPI aggregate; dastlab moving-average/seasonal baseline TypeScriptda. Prognoz xatosi o‘lchanmasdan ML platforma qo‘shilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 261-satr; vazifa №11 (REP-01).

  **Boshlash sharti:** POS-01, RET-01, PUR-01, FIN-01, CRM-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Schedule duplicate yubormaydi; branch KPI formula va forecast baseline sifati o‘lchanib hujjatlashtirilgan.

  **Dalil:** `REP-01.11` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

**Qabul mezoni:** oldindan natijasi hisoblangan savdo/nasiya/refund/xarid sinov ma’lumotlarida barcha ko‘rsatkichlar kutilgan natijaga teng. 50 dan ko‘p yozuvli hisobot to‘liq eksport qilinadi.

### 9. O‘zbekiston uchun fiskal va mahalliy integratsiyalar

#### LOC-01 — fiskal ishlash doirasini aniqlash [P0, tegishli savdo uchun]

Mahalliy talabga mos fiskal chek va ro‘yxatdan o‘tgan kassa bilan ishlash masalasi chiqarishdan oldin hal qilinishi kerak. Brauzerdan oddiy chek chiqarishning o‘zi fiskallashtirishni ta’minlamaydi. [Adliya maslahat portalining kassa bo‘yicha tushuntirishi](https://advice.adliya.uz/oz/document/1341) bu ikki jarayonni farqlash uchun manba sifatida olindi.

- [ ] **LOC-01.01** — Mijoz faoliyati, soliq rejimi va savdo turiga tatbiq etiladigan amaldagi talablarni tekshirish.

  **Texnologiya:** Markdown compliance matrix va rasmiy hujjatlar.

  **Bajarish:** Faoliyat/soliq rejimi/tovar guruhi uchun talab, manba sana, provider va qabul holatini yozish. Dastur kutubxonasi qonuniy moslikni avtomatik ta’minlamaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 271-satr; vazifa №1 (LOC-01).

  **Boshlash sharti:** POS-01, RET-01, CAT-01, LEG-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Amaldagi rasmiy manba/sana/activity/tax/sale scope bo‘yicha huquqiy xulosa mas’ul tomonidan tasdiqlangan.

  **Dalil:** `LOC-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-01.02** — Shuni POS fiskal provayderga ulanadimi yoki mustaqil virtual kassa maqomini oladimi — qaror.

  **Texnologiya:** TypeScript provider boundary va arxitektura qarori.

  **Bajarish:** Dastlab tegishli tayyor fiskal providerga adapter; mustaqil virtual kassa alohida sertifikat/protokol loyihasi. Qaror xarajat, muddat va qonuniy shart bilan.

  **Manba:** FULL_PROJECT_PLAN.md, 272-satr; vazifa №2 (LOC-01).

  **Boshlash sharti:** POS-01, RET-01, CAT-01, LEG-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Fiskal provayder yo‘li bo‘yicha ADR va compliance doirasi bor; mustaqil virtual kassa faqat alohida tasdiq bilan.

  **Dalil:** `LOC-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-01.03** — Birinchi chiqarish uchun tegishli reestr/talablarga mos provayderni tanlash; shartnoma va test muhiti.

  **Texnologiya:** Markdown provider checklist, Node fetch sandbox T08.

  **Bajarish:** Reestr/shartnoma/API/kalit/test holatlarini olish; actual endpoint/rekvizitni tanlashdan oldin faraz qilmaslik. Sirlar runtime va faqat serverda.

  **Manba:** FULL_PROJECT_PLAN.md, 273-satr; vazifa №3 (LOC-01).

  **Boshlash sharti:** POS-01, RET-01, CAT-01, LEG-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Tanlangan provayderning maqomi/shartnoma/sandbox kirishi tasdiqlangan; credential hujjatda ochiq emas.

  **Dalil:** `LOC-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-01.04** — Savdo, qaytarish, bekor qilish, aralash to‘lov va smena bo‘yicha provider oqimlarini xaritalash.

  **Texnologiya:** TypeScript discriminated-union states, PostgreSQL events.

  **Bajarish:** Sale/return/void/mixed-payment/shift uchun provider holat xaritasi; ichki holatga o‘tish shartlari va kompensatsiya yoziladi.

  **Manba:** FULL_PROJECT_PLAN.md, 274-satr; vazifa №4 (LOC-01).

  **Boshlash sharti:** POS-01, RET-01, CAT-01, LEG-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Sale/return/cancel/mixed payment/shift provider contract va state transition xaritasi tasdiqlangan.

  **Dalil:** `LOC-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-01.05** — Fiskal ID, raqam, vaqt, QR va holatni saqlash; qayta chiqarishda original fiskal ma’lumotni ishlatish.

  **Texnologiya:** Prisma FiscalDocument, provider QR payload, T02 zarur bo‘lsa.

  **Bajarish:** Provider receiptId/raqam/time/signature va original response saqlanadi; QRni qayta yaratishda original payload. Chek reprint yangi fiskallashtirish emas.

  **Manba:** FULL_PROJECT_PLAN.md, 275-satr; vazifa №5 (LOC-01).

  **Boshlash sharti:** POS-01, RET-01, CAT-01, LEG-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** ID/number/time/QR/status saqlangan; reprint original fiskal natijani ishlatadi.

  **Dalil:** `LOC-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-01.06** — MXIK, birlik, soliq va zarur chek rekvizitlarini mahsulot/hujjatga qo‘shish va validatsiya qilish.

  **Texnologiya:** Prisma classification/unit/tax snapshots, Zod.

  **Bajarish:** Majburiy rekvizitlar schema va catalog mappingga kiritiladi; providerga yuborishdan oldin tekshirish. Original hujjatning tarixiy klassifikatsiyasi saqlanadi.

  **Manba:** FULL_PROJECT_PLAN.md, 276-satr; vazifa №6 (LOC-01).

  **Boshlash sharti:** POS-01, RET-01, CAT-01, LEG-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Sandbox required fields/units/MXIK/tax validatsiyasi o‘tadi; invalid rekvizit fiskal yuborilmaydi.

  **Dalil:** `LOC-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-01.07** — Timeoutda provayder holatini tekshirish; takror fiskal chek yaratmaslik.

  **Texnologiya:** Node fetch/AbortController, PostgreSQL outbox/idempotency.

  **Bajarish:** Timeout unknown holat; avval provider status, keyin ruxsatli retry. Provider idempotency imkoniyati tekshiriladi; requestId doimiy.

  **Manba:** FULL_PROJECT_PLAN.md, 277-satr; vazifa №7 (LOC-01).

  **Boshlash sharti:** POS-01, RET-01, CAT-01, LEG-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Timeoutdan keyin status lookup bilan original natija topiladi; duplicate fiskal hujjat yaratilmaydi.

  **Dalil:** `LOC-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-01.08** — Fiskal yuborish xatosini kassir va egaga ko‘rsatish; qo‘lda hal qilish/audit jarayoni.

  **Texnologiya:** React integration status, Prisma Incident/Audit, worker.

  **Bajarish:** Pending/failed/unknown holatini alohida ko‘rsatish, retry yoki vakolatli manual resolution. Operator fiskal muvaffaqiyatni dalilsiz belgilay olmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 278-satr; vazifa №8 (LOC-01).

  **Boshlash sharti:** POS-01, RET-01, CAT-01, LEG-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Fiscal error kassir/ownerga ko‘rinadi; retry/manual-resolution sabab/actor/audit bilan.

  **Dalil:** `LOC-01.08` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-01.09** — Fiskal va savdo summalarini kunlik solishtirish.

  **Texnologiya:** PostgreSQL reconciliation aggregates va scheduled worker.

  **Bajarish:** Sale ↔ FiscalDocument summa/status/ID mosligi; farq incident va egaga T08 xabar. Auditli tuzatishdan keyin qayta solishtirish.

  **Manba:** FULL_PROJECT_PLAN.md, 279-satr; vazifa №9 (LOC-01).

  **Boshlash sharti:** POS-01, RET-01, CAT-01, LEG-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Daily sale-fiscal totals reconciliation mos va mismatch testlaridan o‘tadi; farq ochiq qoladi.

  **Dalil:** `LOC-01.09` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

**Qabul mezoni:** tanlangan provayder talab qilgan test holatlari o‘tadi; bir savdo uchun bitta fiskal natija; qonuniy ish tartibi va nosozlik holati bo‘yicha yozma yo‘riqnoma bor. Aniq rekvizitlar va offline fiskallashtirish shartlari amalga oshirish paytida amaldagi normativ/provayder hujjatidan olinadi.

#### LOC-02 — markirovka [P0, markirovkalanadigan tovarlar uchun]

Markirovkalangan mahsulotlar bilan ishlashda oddiy mahsulot barkodi va har bir birlikning Data Matrix kodi alohida tushunchalar. Tegishli savdo uchun qabul qilish va muomaladan chiqarish jarayonini moslashtirish kerak. Manba: [Asl Belgisi chakana savdo yo‘riqnomasi](https://help.crpt-turon.uz/hc/uz/articles/4459895684625-Ishni-boshlash-Chakana-savdo-uchun-markirovkalashni-amalga-oshirish-bosqichlari).

- [ ] **LOC-02.01** — 2D skaner va Data Matrix o‘qish; kodni mahsulot va birlik bilan bog‘lash.

  **Texnologiya:** Mavjud ZXing/browser camera va 2D keyboard-wedge scanner.

  **Bajarish:** Data Matrixni raw bytes/string va mahsulot birligiga saqlash; separator/GS1 kodlarini buzmaslik. Real skaner bilan belgi va checksum sinovi.

  **Manba:** FULL_PROJECT_PLAN.md, 287-satr; vazifa №1 (LOC-02).

  **Boshlash sharti:** LOC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Real 2D scanner Data Matrixni o‘qiydi; exact kod mahsulot va birlikka bog‘langan.

  **Dalil:** `LOC-02.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-02.02** — Takror, yaroqsiz yoki allaqachon sotilgan kodni nazorat qilish.

  **Texnologiya:** Zod syntax validation, PostgreSQL unique code/state lock.

  **Bajarish:** Code identifikatori va holati atomik tekshiriladi; duplicate qayta sotilmaydi. Tashqi haqiqiylik uchun tegishli provider API javobi zarur.

  **Manba:** FULL_PROJECT_PLAN.md, 288-satr; vazifa №2 (LOC-02).

  **Boshlash sharti:** LOC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Duplicate/invalid/sold-code rad; parallel ikki kassada bir kod ikki marta sotilmaydi.

  **Dalil:** `LOC-02.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-02.03** — Qabul qilish, savdo, qaytarish va hisobdan chiqarish uchun tegishli integratsiya.

  **Texnologiya:** TypeScript marking adapter, Node fetch, PostgreSQL outbox.

  **Bajarish:** Receive/sale/return/write-off uchun alohida operatsiya, externalId va status; kodlar bilan tranzaksion bog‘lanish. SDK faqat protokol native transport bilan yopilmasa T08.

  **Manba:** FULL_PROJECT_PLAN.md, 289-satr; vazifa №3 (LOC-02).

  **Boshlash sharti:** LOC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Provider talabidagi receive/sale/return/write-off sandbox oqimlari original kod izini saqlaydi.

  **Dalil:** `LOC-02.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-02.04** — Markirovka kodini fiskal jarayon bilan bog‘lash va holatlar tarixini saqlash.

  **Texnologiya:** Prisma MarkingEvent/FiscalItem relation.

  **Bajarish:** Har sotilgan birlik kodi fiscal itemga bog‘lanadi; qabuldan chiqishgacha immutable holat tarixi. Partial return aniq birlikka tegishli.

  **Manba:** FULL_PROJECT_PLAN.md, 290-satr; vazifa №4 (LOC-02).

  **Boshlash sharti:** LOC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Marking event va fiscal receipt original sale bilan bog‘langan; callback/retry tarixni takrorlamaydi.

  **Dalil:** `LOC-02.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-02.05** — Pilotdagi aniq mahsulot guruhlari bo‘yicha moslikni tasdiqlash.

  **Texnologiya:** Markdown guruh/qurilma matritsasi, provider sandbox va real pilot.

  **Bajarish:** Har actual tovar guruhi uchun kirim/sale/return/uzilish tekshiruvi; tasdiqlanmagan guruh uchun umumiy moslik va’da qilinmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 291-satr; vazifa №5 (LOC-02).

  **Boshlash sharti:** LOC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Pilot mahsulot guruhlari uchun real moslik protokoli va tegishli tashqi tasdiq bor.

  **Dalil:** `LOC-02.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

#### LOC-03 — to‘lov va hisob integratsiyalari [P1/P2]

- [ ] **LOC-03.01** — P1: tanlangan terminal/QR/to‘lov provayderi bilan pilot uchun integratsiya.

  **Texnologiya:** Node fetch, Next.js callback Route Handlers, Prisma PaymentAttempt.

  **Bajarish:** Pilotdagi terminal/QR providerning rasmiy API adapteri; browser secret olmaydi. Hosted payment yoki terminal protokoli bilan boshlash.

  **Manba:** FULL_PROJECT_PLAN.md, 295-satr; vazifa №1 (LOC-03).

  **Boshlash sharti:** POS-01, RET-01, FIN-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Tanlangan real terminal/QR providerda create/status/cancel/refund sandbox va pilot payment oqimi o‘tadi.

  **Dalil:** `LOC-03.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-03.02** — Click/Payme yoki boshqa provayderlar — mijoz ehtiyoji, API va shartnoma imkoniyatiga qarab.

  **Texnologiya:** TypeScript PaymentProvider interface va T08 actual API.

  **Bajarish:** Click/Payme va boshqalar uchun ichki create/status/refund contract; har providerdagi auth/methodlar rasmiy hujjat bilan. Har ehtimoliy providerga paket o‘rnatilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 296-satr; vazifa №2 (LOC-03).

  **Boshlash sharti:** POS-01, RET-01, FIN-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Talab tanlagan har provider uchun adapter/test/contract bor; tanlanmaganlari asosli deferred.

  **Dalil:** `LOC-03.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-03.03** — Imzolangan callback, serverdan holat tekshirish, dublikatdan himoya va kunlik solishtirish.

  **Texnologiya:** Node crypto verification, PostgreSQL unique ProviderEvent, worker.

  **Bajarish:** Callback xom payload/protokoliga muvofiq imzo tekshiriladi; externalId va summa serverdan moslanadi. Dublikat/kechikkan hodisa current statusga zid o‘zgartirmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 297-satr; vazifa №3 (LOC-03).

  **Boshlash sharti:** POS-01, RET-01, FIN-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Invalid signature rad; duplicate/late callback bitta posting; daily reconciliation mismatchni topadi.

  **Dalil:** `LOC-03.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-03.04** — “Kutilmoqda”, “tasdiqlandi”, “bekor bo‘ldi”, “qaytarildi” holatlari; noma’lum to‘lovni muvaffaqiyatli deb olmaslik.

  **Texnologiya:** TypeScript state machine, Prisma status history.

  **Bajarish:** Pending/confirmed/canceled/refunded/unknown; final holat ishonchli provider dalili bilan. Operator retry natija noma’lum bo‘lsa avval statusni tekshiradi.

  **Manba:** FULL_PROJECT_PLAN.md, 298-satr; vazifa №4 (LOC-03).

  **Boshlash sharti:** POS-01, RET-01, FIN-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Pending/confirmed/cancelled/refunded transitionlar tekshirilgan; unknown payment success emas.

  **Dalil:** `LOC-03.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-03.05** — Karta ma’lumotlarini POS bazasida saqlamaslik; to‘lovni provayder tomonida bajarish.

  **Texnologiya:** Provider hosted UI/token, DTO allowlist, log redaction.

  **Bajarish:** PAN/CVVni schema, log yoki storagega kiritmaslik; faqat provider token/reference. To‘lov transporti va talablar provider tomonida.

  **Manba:** FULL_PROJECT_PLAN.md, 299-satr; vazifa №5 (LOC-03).

  **Boshlash sharti:** POS-01, RET-01, FIN-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** PAN/CVV/track data schema/log/network payload reyestrida saqlanmaydi; hosted provider oqimi ishlaydi.

  **Dalil:** `LOC-03.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LOC-03.06** — P2: buxgalteriya/1C eksporti, EHF va bank bilan ulanish; tanlangan integratsiyaning ikki tomonlama mosligi.

  **Texnologiya:** Node native fetch, T03 file export, provider 1C/EHF/bank adapter.

  **Bajarish:** Rasmiy contractdagi JSON/XML/CSV/XLSX mapping, externalId va ikki tomonlama reconciliation. XML/ERI/serial protokol maxsus bo‘lsa T08ning audited SDKsi.

  **Manba:** FULL_PROJECT_PLAN.md, 300-satr; vazifa №6 (LOC-03).

  **Boshlash sharti:** POS-01, RET-01, FIN-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Tanlangan 1C/EHF/bank integrationning export-import va identifier/date/summa mosligi ikki tomonda tasdiqlangan.

  **Dalil:** `LOC-03.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

### 10. Internet uzilishi, qurilmalar va mobil foydalanish

#### OFF-01 — uzilishdan tiklanish [P0]

- [x] **OFF-01.01** — Tarmoq holatini ko‘rsatish, savatni xavfsiz saqlash va muvaffaqiyatsiz so‘rovni nazoratli takrorlash.

  **Texnologiya:** React network UI, Browser IndexedDB, fetch/AbortController.

  **Bajarish:** navigator holati yordamchi, haqiqiy API health probe asosiy; savat persist, retry backoff va operationId. Har POSTni ko‘r-ko‘rona qayta yubormaslik.

  **Manba:** FULL_PROJECT_PLAN.md, 306-satr; vazifa №1 (OFF-01).

  **Boshlash sharti:** POS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Disconnect banner va saved basket bor; reconnect bounded retry bilan, duplicate sale yo‘q.

  **Qabul:** `done`, 2026-10-06. [Keyingi 10 ta bandning test va versiya dalili](EXECUTION_STATUS.md#keyingi-10-ta-plan1-bandi--savat-va-tolov-qabul-protokoli-2026-10-06).

  **Dalil:** `OFF-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OFF-01.02** — Savdo yozilgan, ammo javob kelmagan holatda serverdagi natijani topish.

  **Texnologiya:** Next.js operation-status API va PostgreSQL operation record.

  **Bajarish:** Response uzilganda organization+operationId bilan natijani so‘rash; accepted/unknown/failed holatlariga mos UI. Sotuv mavjud bo‘lsa original chek.

  **Manba:** FULL_PROJECT_PLAN.md, 307-satr; vazifa №2 (OFF-01).

  **Boshlash sharti:** POS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Server commitdan keyingi response-lossda original operation topiladi; yangi sale yaratilmaydi.

  **Qabul:** `done`, 2026-10-06. [Keyingi 10 ta bandning test va versiya dalili](EXECUTION_STATUS.md#keyingi-10-ta-plan1-bandi--savat-va-tolov-qabul-protokoli-2026-10-06).

  **Dalil:** `OFF-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OFF-01.03** — Printer ishlamasa savdoni ikkinchi marta yaratmasdan chekni qayta chiqarish.

  **Texnologiya:** HTML/CSS print, Prisma original receipt, print attempt history.

  **Bajarish:** Qayta print original sale/fiscal snapshotdan; yangi sale/stock/payment yaratilmaydi. Native print browserda muvaffaqiyat kafolati bermasligi ko‘rsatiladi.

  **Manba:** FULL_PROJECT_PLAN.md, 308-satr; vazifa №3 (OFF-01).

  **Boshlash sharti:** POS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Print failuredan keyin reprint bir chekni chiqaradi; sale/payment/movement count o‘zgarmaydi.

  **Dalil:** `OFF-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OFF-01.04** — Qurilma ishdan chiqsa boshqa qurilmadan vakolatli davom ettirish.

  **Texnologiya:** Prisma server drafts, Next.js DAL, device records.

  **Bajarish:** Serverda saqlangan draft/operation boshqa qurilmadan vakolat bilan ochiladi. Faqat lokal, hali serverga yetmagan ma’lumotni buzilgan qurilmadan tiklash kafolatlanmaydi; eksport/backup siyosati.

  **Manba:** FULL_PROJECT_PLAN.md, 309-satr; vazifa №4 (OFF-01).

  **Boshlash sharti:** POS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Serverga saqlangan draft/result boshqa authorized deviceda ochiladi; faqat lokal draftni cloudda bor deb ko‘rsatmaydi.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `OFF-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OFF-01.05** — Integratsiya xatosi, savdo xatosi va faqat chek chop etish xatosini alohida ko‘rsatish.

  **Texnologiya:** TypeScript tagged errors, React status panels.

  **Bajarish:** Sale, payment/fiscal va printer holatlari turli error code bilan; har biri uchun mos amal. PRINT_FAILED bo‘lsa sale bekor qilinmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 310-satr; vazifa №5 (OFF-01).

  **Boshlash sharti:** POS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** UI sale/provider/print xatolarini alohida state va keyingi amal bilan ko‘rsatadi.

  **Dalil:** `OFF-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

#### OFF-02 — to‘liq offline savdo [P1, talab etilgan mijoz uchun]

- [x] **OFF-02.01** — PWA va lokal saqlash; mahsulot/narxlar uchun yangilanish chegarasi.

  **Texnologiya:** Next.js manifest, Browser Service Worker/Cache API/IndexedDB.

  **Bajarish:** PWA shell, katalog/narx versiyasi va expiry; private API/chekni umumiy cachega joylamaslik. PWA o‘rnatishning o‘zi offline sale emas.

  **Manba:** FULL_PROJECT_PLAN.md, 314-satr; vazifa №1 (OFF-02).

  **Boshlash sharti:** OFF-01, SEC-02, INV-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** PWA install/cache/update ishlaydi; tenant scoped catalog version/TTL eskirganda offline checkout blok.

  **Dalil:** `OFF-02.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul (2026-10-08):** `done`. Individual dalil EXECUTION_STATUS.md dagi “PWA va manager tasdig‘i” protokolida.

- [x] **OFF-02.02** — Lokal savdo navbati, qurilma identifikatori va server bilan bir martalik sinxronlash.

  **Texnologiya:** IndexedDB transactions, crypto.randomUUID, PostgreSQL idempotency.

  **Bajarish:** Har qurilma/amalga doimiy ID, lokal atomic queue; reconnect/foreground sync bilan yuborish, server acknowledgementdan keyin archive. Worker lease va retry dublikatni bartaraf qiladi.

  **Manba:** FULL_PROJECT_PLAN.md, 315-satr; vazifa №2 (OFF-02).

  **Boshlash sharti:** OFF-01, SEC-02, INV-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Browser restartdan keyin queue saqlanadi; repeated sync bitta operation posting yaratadi.

  **Qabul:** `done`, 2026-10-06. [Keyingi 10 ta bandning test va versiya dalili](EXECUTION_STATUS.md#keyingi-10-ta-plan1-bandi--savat-va-tolov-qabul-protokoli-2026-10-06).

  **Dalil:** `OFF-02.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OFF-02.03** — Offline qoldiqni bir nechta kassada mutlaq kafolatlab bo‘lmasligini siyosat bilan hal qilish: rezerv, limit yoki ruxsatli manfiy qoldiq.

  **Texnologiya:** Prisma reservations, PostgreSQL stock policy, local limits.

  **Bajarish:** Kassa uchun serverdan rezerv/kvota yoki aniq manfiy stock siyosati; rezerv tugasa offline savdo rad/cheklanadi. PWA yoki Redis global offline kafolat bera olmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 316-satr; vazifa №3 (OFF-02).

  **Boshlash sharti:** OFF-01, SEC-02, INV-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Device reservation/limit chegarasida offline savdo o‘tadi; limitdan oshish blok, conflictlar alohida qayd.

  **Dalil:** `OFF-02.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OFF-02.04** — Eskirgan narx, nasiya limiti, bloklangan xodim va smena uchun alohida cheklov.

  **Texnologiya:** PostgreSQL signed offline lease, IndexedDB snapshots, Node crypto.

  **Bajarish:** Offline vakolat/narx/limit/smena lease muddatli va tekshiriladigan; expirydan keyin savdo to‘xtaydi. Offline qurilmaga darhol revoke yetmasligi limit bilan boshqariladi.

  **Manba:** FULL_PROJECT_PLAN.md, 317-satr; vazifa №4 (OFF-02).

  **Boshlash sharti:** OFF-01, SEC-02, INV-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Stale price/session lease/debt/shift qoidalari expiry va revoke reconnect testlarida tekshirilgan.

  **Dalil:** `OFF-02.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OFF-02.05** — Lokal ma’lumot xavfsizligi, chiqishda tozalash va sinxronlanmagan savdoni yo‘qotishdan himoya.

  **Texnologiya:** IndexedDB, Web Crypto, browser storage persistence.

  **Bajarish:** Lokal sezgir ma’lumotni minimum qilish; shifrlash kaliti access policyga bog‘liq, XSSdan mutlaq himoya deb olinmaydi. Unsynced queue bor logoutda avval sync/export; tozalash tasdiq bilan.

  **Manba:** FULL_PROJECT_PLAN.md, 318-satr; vazifa №5 (OFF-02).

  **Boshlash sharti:** OFF-01, SEC-02, INV-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Unsynced queue borida logout/clear blok yoki xavfsiz eksport bilan; boshqa user queuega kira olmaydi.

  **Qabul:** `done`, 2026-10-06. [Keyingi 10 ta bandning test va versiya dalili](EXECUTION_STATUS.md#keyingi-10-ta-plan1-bandi--savat-va-tolov-qabul-protokoli-2026-10-06).

  **Dalil:** `OFF-02.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **OFF-02.06** — Kartali to‘lov, markirovka va fiskal amallar offline rejimda faqat provayder/qoidalar ruxsat bergan tartibda.

  **Texnologiya:** TypeScript provider capability rules, Next.js sync service.

  **Bajarish:** Ruxsat etilgan cash/offline flowlargina; karta/markirovka/fiscal online talab qilsa block. Keyin yuborish qonuniy/provider tomonidan ruxsat etilgan bo‘lsagina outbox.

  **Manba:** FULL_PROJECT_PLAN.md, 319-satr; vazifa №6 (OFF-02).

  **Boshlash sharti:** OFF-01, SEC-02, INV-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Card/marking/fiscal offline default rad; faqat yozma provider/legal ruxsatli oqim real sinovda yoqiladi.

  **Dalil:** `OFF-02.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OFF-02.07** — Navbat holati, xato savdolarni qo‘lda hal qilish, egaga ogohlantirish.

  **Texnologiya:** React queue dashboard, IndexedDB states, Prisma SyncConflict/Incident.

  **Bajarish:** Synced/pending/failed/needs-review; xavfsiz manual resolution va egaga xabar. Reject bo‘lgan sale o‘chirib yashirilmaydi, asl lokal payload auditli saqlanadi.

  **Manba:** FULL_PROJECT_PLAN.md, 320-satr; vazifa №7 (OFF-02).

  **Boshlash sharti:** OFF-01, SEC-02, INV-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Pending/failed/conflict/synced statuslari bor; manager resolution auditli va duplicate posting yo‘q.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `OFF-02.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

**Qabul mezoni:** kelishilgan offline limit ichidagi savdolar qayta ulanishda yo‘qolmasdan va dublikatlarsiz yoziladi; hal qilinmagan nizolar yashirin qolmaydi. To‘liq offline bitmaguncha mahsulot offline ishlaydi deb reklama qilinmaydi.

#### HW-01 — qurilma mosligi [P1]

- [ ] **HW-01.01** — USB/2D skaner, 58/80 mm printer, pul tortmasi va tanlangan elektron tarozi.

  **Texnologiya:** Browser keyboard/print, ZXing, qurilma transporti T05.

  **Bajarish:** Skanner keyboard-wedge bilan; printer CSS andoza. Tarozi serial yoki printer ESC/POS/drawer raw command talab qilsa vendor driver yoki Node local agent transport.

  **Manba:** FULL_PROJECT_PLAN.md, 326-satr; vazifa №1 (HW-01).

  **Boshlash sharti:** POS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Tanlangan scanner/printer/drawer/scale modeli real qurilmada barcode/print/open/weight ssenariysidan o‘tgan.

  **Dalil:** `HW-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **HW-01.02** — Qurilmalar ro‘yxati, OS/brauzer, ulanish usuli va ishlaydigan modellar jadvali.

  **Texnologiya:** Markdown/CSV hardware matrix.

  **Bajarish:** Har model uchun OS/brauzer/protokol, firmware va sinov sanasi; ishlaydi/qisman/ishlamaydi belgilari. Modelni ko‘rmasdan universal driver va’da qilinmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 327-satr; vazifa №2 (HW-01).

  **Boshlash sharti:** POS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Model/OS/browser/transport/version/test date jadvali haqiqiy dalilga bog‘langan.

  **Dalil:** `HW-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **HW-01.03** — Zarur bo‘lsa xavfsiz lokal printer/tarozi agenti; uni o‘rnatish va yangilash.

  **Texnologiya:** Node.js local agent, OS service, T05 protocol packages.

  **Bajarish:** Faqat browser API/driver yetmagan qurilmaga; localhostga bog‘lash, origin allowlist, pairing/auth, TLS siyosati va signed updates. Serialport/USB binding faqat actual protocol uchun.

  **Manba:** FULL_PROJECT_PLAN.md, 328-satr; vazifa №3 (HW-01).

  **Boshlash sharti:** POS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Agent zarurati ADRda isbotlangan; pairing/auth/origin/update/uninstall va port access testlari o‘tadi.

  **Dalil:** `HW-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **HW-01.04** — Windows kassasi, planshet va mobil ekranlarda real sinov.

  **Texnologiya:** Real Windows/Android/iOS qurilmalar, Playwright T04.

  **Bajarish:** Avtomatik viewport/browser sinovi ustiga real permission/driver/print/scale sinovi. Emulyatsiya qurilma bilan amaliy testning o‘rnini bosmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 329-satr; vazifa №4 (HW-01).

  **Boshlash sharti:** POS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Tanlangan Windows/tablet/mobile matritsasida checkout/print/reconnect amaliy protokoli bor.

  **Dalil:** `HW-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **HW-01.05** — Kassir ekrani uchun katta tugmalar; egaga telefon orqali dashboard.

  **Texnologiya:** React/Tailwind responsive layout, Server Components.

  **Bajarish:** Kassirga touch targets/fokus, ownerga mobile KPI; kerakli widgetlar client, qolgan read view serverda. Shared komponentlar saqlanadi.

  **Manba:** FULL_PROJECT_PLAN.md, 330-satr; vazifa №5 (HW-01).

  **Boshlash sharti:** POS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Kassir touch UI va owner mobile dashboard 360/768/1280pxda ishlaydi; asosiy amallar yashirilmaydi.

  **Dalil:** `HW-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **HW-01.06** — P2: mijoz displeyi, alohida mobil ilova va ombor terminali.

  **Texnologiya:** Next.js PWA va protected display Route, T05.

  **Bajarish:** Customer/kitchen display dastlab PWA polling bilan; ombor terminali barcode input. App-store/OS background talabi PWAda yopilmasa T13 native shell, barcha UI qayta yozilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 331-satr; vazifa №6 (HW-01).

  **Boshlash sharti:** POS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Har tanlangan customer-display/mobile/terminal uchun mustaqil scope va real qurilma acceptance bor.

  **Dalil:** `HW-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

### 11. Interfeys, til va yordam

#### UX-01 — mahsulotdan foydalanish sifati [P1]

- [x] **UX-01.01** — Birlamchi sozlash: tashkilot → filial/kassa → import → boshlang‘ich qoldiq → sinov savdo.

  **Texnologiya:** React wizard, Prisma onboarding progress, Zod.

  **Bajarish:** Har bosqich qayta davom ettiriladigan; organization/store/import/opening/sale bir-biriga bog‘liq. Qoldiq importi tasdiqsiz real jurnalga yozilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 337-satr; vazifa №1 (UX-01).

  **Boshlash sharti:** POS-02, CAT-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Onboarding create/store/import/opening stock/user/test sale ketma-ketligini yangi foydalanuvchi yakunlaydi.

  **Dalil:** `UX-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **UX-01.02** — O‘zbek lotin va rus tili; barcha ishchi matnlarni yagona tarjima tizimiga olish.

  **Texnologiya:** Mavjud JSON dictionaries, TypeScript typed keys, Intl.

  **Bajarish:** uz/ru matnlarni umumiy dictionaryga ko‘chirish; datetime/number Intl bilan. Faqat plural/routing/translation workflow murakkablashsa T09 next-intl.

  **Manba:** FULL_PROJECT_PLAN.md, 338-satr; vazifa №2 (UX-01).

  **Boshlash sharti:** POS-02, CAT-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Uz-Latn/Ru barcha ishchi ekran/xato/chekda; locale almashtirish hisob va sana semantikasini buzmaydi.

  **Dalil:** `UX-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul — 2026-10-15:** `tasks/evidence/localization-20261015.json`, `docs/operations/localization.md`. 3937 ta ikki tilli typed kalit,39 ta owned label jadvali, static offline shell, xato chegaralari, sale/return chek va Intl exact display ulandi. 155/155 unit (53 fayl),88/88 PostgreSQL (4 fayl), bitta yakuniy native run72/72 (har Chromium/Firefox/WebKitda24) PASS. Type/worker,0-warning lint, offline/webpack build,953 canonical/table/static key check va zero-finding source scan PASS. Locale savat, telefon/parol qoralamasi,0.125 miqdor, ISO sana, original pending body/key, encrypted ticket va original ism/chek snapshotini o‘zgartirmaydi. Lost ACKdan keyin bitta sale/payment/movement va exact qaytim DB bilan tekshirildi. Oldingi failed/overlap cohortlar qo‘shib sanalmaydi; loglar, screenshots, source SHA va `a2de5a8` ustidagi uncommitted patch manifestda. Bu local core qabul; real hosting/vendor/hardware/pilot isboti emas.

- [x] **UX-01.03** — Bir xil jadval/formalar, qidiruv, filtr, saralash, sahifalash va bo‘sh holatlar.

  **Texnologiya:** Mavjud React UI va Tailwind, URLSearchParams, Prisma.

  **Bajarish:** Shared Table/Form/Filter, safe sort allowlist va sahifalash; loading/empty/error variantlari. Dastlab table/form framework qo‘shilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 339-satr; vazifa №3 (UX-01).

  **Boshlash sharti:** POS-02, CAT-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Search/filter/sort/page/empty-state URL va API bilan mos; zero/large datasetda ishlaydi.

  **Dalil:** `UX-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul — 2026-10-15:** `tasks/evidence/list-journals-20261015.json`, `docs/operations/list-query-coverage.md`.139 distinct PG case (92+31+16),147 unit case/52 fayl; uch brauzer cohortlari42/42/18 va oxirgi kuchaytirilgan6/6 PASS. Cohortlar overlap qiladi,108 distinct yoki yagona run deb sanalmaydi. Type/worker/build,0warning lint va1473source/0finding PASS. URL va safe query, zero/large/source paging, Decimal sort/filtered CSV/cutoff, read errors/stale responses, immutable chronological journals va moliyaviy draft/source selection saqlanishi qabul qilindi. Version `d8a9226`+uncommitted tree, source/log SHA manifestda. Only local core; provider/hardware/production/pilot isboti emas. UX-01.02 mazkur qabulga kirmagan.

- [x] **UX-01.04** — Xatolarni odam tushunadigan qilib yozish; foydalanuvchi keyin nima qilishi ko‘rsatilishi.

  **Texnologiya:** TypeScript error codes, Zod field errors, JSON translations.

  **Bajarish:** Domain xato→tushunarli matn→amal mapping; raw stackni foydalanuvchiga bermaslik. Field error formaga, unknown xato requestIdga.

  **Manba:** FULL_PROJECT_PLAN.md, 340-satr; vazifa №4 (UX-01).

  **Boshlash sharti:** POS-02, CAT-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Validation/network/permission/conflict xatolari tushunarli matn va xavfsiz keyingi amal beradi.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `UX-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **UX-01.05** — Loading, qayta urinish, saqlanmagan o‘zgarishlar va amaliy holatning aniq belgisi.

  **Texnologiya:** React state machine/useReducer, Next.js loading/error boundaries.

  **Bajarish:** Saving/saved/failed holati, unsaved guard va retry; optimistic UI pul yakunlashda server tasdig‘ini almashtirmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 341-satr; vazifa №5 (UX-01).

  **Boshlash sharti:** POS-02, CAT-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Loading/retry/dirty/pending/saved belgisi haqiqiy holatga mos; double submit dublikat yaratmaydi.

  **Qabul:** `done`, 2026-10-12. [Yakuniy input, kutilgan/haqiqiy natija va versiya](EXECUTION_STATUS.md#ux-0105-yakuniy-qabul-20261012). Dalil: `tasks/evidence/ux-final-20261012.json`.

  **Dalil:** `UX-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **UX-01.06** — Klaviatura bilan boshqarish, kontrast, label va fokus; kassa uchun katta o‘qiladigan matn.

  **Texnologiya:** Semantic HTML, React refs, Tailwind focus/contrast, T04.

  **Bajarish:** Label, tab order, escape/modal focus va touch hajmi; klaviatura va qo‘l bilan tekshirish. Accessibility analyzer T04ga qo‘shimcha faqat audit zarur bo‘lsa.

  **Manba:** FULL_PROJECT_PLAN.md, 342-satr; vazifa №6 (UX-01).

  **Boshlash sharti:** POS-02, CAT-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Keyboard-only asosiy oqim, focus va label mavjud; touch target ≥44px, text contrast ≥4.5:1.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `UX-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **UX-01.07** — Rolga mos boshlang‘ich ekran va muhim ogohlantirishlar.

  **Texnologiya:** Next.js DAL capabilities, React navigation/notifications.

  **Bajarish:** Rolega mos route va alert; UIga faqat kerakli vakolatli DTO. Ochiq smena/kam stock/fiscal incident status alohida.

  **Manba:** FULL_PROJECT_PLAN.md, 343-satr; vazifa №7 (UX-01).

  **Boshlash sharti:** POS-02, CAT-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Rolega mos home va alertlar bor; hidden feature serverda ham vakolat bilan himoyalangan.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `UX-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **UX-01.08** — Qisqa video/yo‘riqnoma, demo ma’lumotlar, yangi kassirni o‘rgatish.

  **Texnologiya:** Next.js help pages, Markdown docs, organization/user-scoped React mashqi, BigInt pul arifmetikasi.

  **Bajarish:** Matnli yo‘riqnoma actual ish oqimini ko‘rsatadi; React demo holati organization/userga bog‘langan va hisob/biznes almashganda reset qilinadi. ADR025 tanlovi iqtisodiy PostgreSQL demo seed yoki video o‘rniga xavfsiz lokal mashqdan foydalanadi. Tutorial real pul/savdoni yashirin yaratmaydi; yangi cashier mashqdan keyin isolated test POSda checkout bajaradi.

  **Manba:** FULL_PROJECT_PLAN.md, 344-satr; vazifa №8 (UX-01).

  **Boshlash sharti:** POS-02, CAT-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Demo data tenant-scoped; yo‘riqnoma/video orqali yangi kassir test checkoutni bajargan dalil bor.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `UX-01.08` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **UX-01.09** — Import xatolari va printer/internet sozlash bo‘yicha yordam sahifalari.

  **Texnologiya:** React help screens, Markdown runbooks, import row errors.

  **Bajarish:** Scanner/permission/printer/internet diagnostikasi va import error code yo‘riqnomasi. Yordam kontenti versiyalangan, tegishli ekrandan havola.

  **Manba:** FULL_PROJECT_PLAN.md, 345-satr; vazifa №9 (UX-01).

  **Boshlash sharti:** POS-02, CAT-01, USR-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Import/printer/internet helpdagi har yo‘l real yoki boshqariladigan xatoda tekshirilgan.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `UX-01.09` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

**Qabul mezoni:** pilot egasi katalog import qilib, qoldiq kiritib, kassirni qo‘shib, birinchi savdoni yo‘riqnoma asosida bajara oladi.

### 12. Baza va backendga qo‘shiladigan tuzilmalar

Bu jadval tayyor sxema emas; funksiyalarni amalga oshirishda ma’lumot modelini loyihalash uchun ro‘yxat. Mavjud qaytarish/audit modellari qayta ishlatiladi, dublikat tuzilma yaratilmaydi.

| Tuzilma | Nima uchun kerak? | Texnologik yo‘l |
| --- | --- | --- |
| Sessiya, taklif, tiklash/tasdiq tokenlari | Hisob va kirishning to‘liq hayot sikli | Prisma Session/Invitation/ResetToken, PostgreSQL expiry+unique, Node crypto hash; SEC/USR. Tokenning ochiq qiymati bazada saqlanmaydi. |
| Vakolat/tasdiq yozuvlari | Rol, do‘kon chegarasi va manager tasdig‘i | Prisma Permission/Approval/SupportGrant, TypeScript policy; SEC/USR. Approval hujjat versiyasi va muddatiga bog‘lanadi. |
| Mahsulot variantlari, barkodlar, birliklar | Rang/o‘lcham, bir nechta kod, quti/dona | Prisma ProductVariant/ProductBarcode/UnitConversion, PostgreSQL tenant unique, Decimal; CAT. Eski stock uchun default variant backfill. |
| Narx va soliq tarixi | Savdo paytidagi qiymatni ishonchli qayta hisoblash | Prisma PriceVersion/TaxVersion, effective dates va immutable sale snapshots; CAT/FIN. Interval konflikti serverda tekshiriladi. |
| Partiya, seriya, yaroqlilik, rezerv | Segmentga mos ombor hisobi | Prisma Batch/Serial/Reservation/Location, indexed expiry va conditional reserve; INV. Available va on-hand ajratiladi. |
| Xarid buyurtmasi/qabul/qaytarish | Yetkazib beruvchidan mahsulot olish zanjiri | Prisma PurchaseOrder/Receipt/PurchaseReturn/SupplierAllocation; PUR. Order/qabul/qarz/to‘lov satrlari FK bilan bog‘lanadi. |
| Inventarizatsiya va tuzatish hujjatlari | Sanash farqini tasdiqlash va audit | Prisma CountSession/CountLine/Adjustment, approval/audit va cut-off checkpoint; INV. Original sanoq o‘zgarmaydi. |
| Pul hisoblari va mijoz/ta’minotchi qarz jurnali | Haqiqiy pul va majburiyatlarni ajratish | Prisma CashAccount/CashEntry/DebtEntry/Settlement; CRM/FIN. Nasiya, haqiqiy pul va transferni alohida hisoblash. |
| To‘lov urinishlari va provider hodisalari | Callback, refund, komissiya va solishtirish | Prisma PaymentAttempt/ProviderEvent/Reconciliation; LOC/RET. ExternalId unique, imzo tekshirish va takror callback himoyasi. |
| Fiskal hujjat, markirovka holati | Savdo va mahalliy tashqi tizim orasidagi bog‘lanish | Prisma FiscalDocument/MarkingCode/MarkingEvent; LOC. Provider va original hujjat natijasi o‘zgarmas snapshot. |
| Qurilma/offline amal/sinxronlash yozuvi | Offline savdo va qayta tiklash | Prisma Device/Operation/SyncConflict + IndexedDB queue; OFF/HW. Client UUID va server unique orqali qayta sync. |
| Yagona amal kaliti va yuborish navbati | Dublikatdan himoya, tashqi xizmatga ishonchli yuborish | Prisma OperationKey/Outbox/Job va PostgreSQL SKIP LOCKED; DATA/POS. Payload hash, lease va bounded retries. |
| Tarif/obuna/limit/to‘lov yozuvlari | SaaS sifatida xizmatni sotish tanlansa | Prisma Plan/Subscription/Invoice/Entitlement/Usage; BIZ. Limits va expiration backendda, payment adapter tashqi. |
| Bildirishnoma, rozilik va yetkazish tarixi | Xizmat xabarlari va marketing | Prisma Notification/ConsentEvent/DeliveryAttempt, Node worker va T08; CRM/LEG. Har maqsad/kanal uchun alohida consent. |

#### DATA-01 — barcha modullar uchun qoidalar [P0]

- [x] **DATA-01.01** — Moliyaviy hisobni aniq decimal bilan bajarish; pulni turli joyda turlicha yaxlitlamaslik.

  **Texnologiya:** Prisma.Decimal, PostgreSQL NUMERIC, TypeScript money service.

  **Bajarish:** Aniq stringdan Decimal yaratish, rounding/minor-unit siyosati; browser Number moliyaviy haqiqat manbasi emas. Alohida decimal paket Prisma imkoniyati yetganda qo‘shilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 372-satr; vazifa №1 (DATA-01).

  **Boshlash sharti:** FIX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Decimal string contract va yagona rounding misollari API/DB/reportlarda ayni natija beradi.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `DATA-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **DATA-01.02** — Foreign key, noyob indeks, son/holat cheklovi va kerakli qidiruv indekslari.

  **Texnologiya:** Prisma schema/Migrate va PostgreSQL SQL migrations.

  **Bajarish:** FK/composite unique/check/partial/B-tree/GIN index; Prisma ifodalamagan SQL shu ORM orqali boshqariladi. Raw SQL yangi DB texnologiyasi hisoblanmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 373-satr; vazifa №2 (DATA-01).

  **Boshlash sharti:** FIX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** FK/unique/check/index migratsiyalari invalid data va parallel duplicate yozishni bazada rad etadi.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `DATA-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **DATA-01.03** — Qoldiq/savdo/smena holatini atomik o‘zgartirish; deadlock/konfliktni nazoratli qayta urinish.

  **Texnologiya:** Prisma interactive transactions, PostgreSQL locks.

  **Bajarish:** Statusga shartli UPDATE, unique guard va barqaror lock tartibi; conflict/deadlock uchun bounded retry. Retry tashqi providerga takror to‘lov yubormaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 374-satr; vazifa №3 (DATA-01).

  **Boshlash sharti:** FIX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Concurrent checkout/stock/shift va deadlock bounded retry testlari yakuniy invariantlarni saqlaydi.

  **Qabul:** `done`, 2026-10-06. [Keyingi 10 ta bandning test va versiya dalili](EXECUTION_STATUS.md#keyingi-10-ta-plan1-bandi--savat-va-tolov-qabul-protokoli-2026-10-06).

  **Dalil:** `DATA-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **DATA-01.04** — Tashkilot kaliti va bog‘langan resurs egaligini butun modelda izchil qo‘llash.

  **Texnologiya:** TypeScript AuthorizedContext, Prisma relations, SQL tenant keys.

  **Bajarish:** Majburiy scope DAL/service/worker/fayl/report bo‘ylab; tenant-cross FK mumkin joyda bazada. RLS qo‘shilsa transaction-local tenant, non-owner DB role va pool reset testlari.

  **Manba:** FULL_PROJECT_PLAN.md, 375-satr; vazifa №4 (DATA-01).

  **Boshlash sharti:** FIX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Cross-tenant relation schema/service testlari rad; tenant scope backfillda bo‘sh qolmagan.

  **Dalil:** `DATA-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul holati (2026-10-11): done.** 113 model explicit root/global classification, scoped insert/child branch/cashier filters,97 scoped table edge+ownership guards va Organization identity guard, native SQL-only FK inventory/preflight, cross-parent/native/create rejection; clone backfill roots preserved. RLS qo‘shilmadi. [163 qabul protokoli](EXECUTION_STATUS.md#original-160163--fix-0107-data-0104-rep-0109-qabuli-2026-10-11). `tasks/evidence/core-163-20261011.json`.

- [x] **DATA-01.05** — Audit yozuvini biznes o‘zgarishi bilan bir tranzaksiyada saqlash.

  **Texnologiya:** Prisma AuditLog, PostgreSQL transaction.

  **Bajarish:** Old/new qiymatlar, actor/action/entity/request/approval va vaqt bir business transactionda. Sirlarni audit JSONga ko‘chirmaslik; audit update/delete app roliga yopiq.

  **Manba:** FULL_PROJECT_PLAN.md, 376-satr; vazifa №5 (DATA-01).

  **Boshlash sharti:** FIX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Audit failure business transactionni rollback qiladi; muvaffaqiyatli amal actor/source bilan qayd.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `DATA-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **DATA-01.06** — Tashqi provayder chaqirig‘ini uzoq baza tranzaksiyasi ichida ushlamaslik; navbat va kompensatsiya jarayoni.

  **Texnologiya:** PostgreSQL outbox + Node worker.

  **Bajarish:** Biznes amal outbox yozuvi bilan commit; worker qisqa claimdan so‘ng tashqi chaqiriq qiladi. Failed/unknown/compensating status; sale transaction tarmoqni kutib lock ushlamaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 377-satr; vazifa №6 (DATA-01).

  **Boshlash sharti:** FIX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Provider call DB lockni ushlab turmaydi; committed outbox restartdan keyin qayta ishlanadi.

  **Qabul:** `done`, 2026-10-10; vendor-neutral core. [Test va cheklovlar](EXECUTION_STATUS.md#data-core-plus-2-2026-10-10).

  **Dalil:** `DATA-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **DATA-01.07** — Tashqi chaqiriq natijasi noma’lum bo‘lsa tekshirish va solishtirish; “ikki tizimda bitta tranzaksiya” deb faraz qilmaslik.

  **Texnologiya:** Node fetch status adapter, Prisma reconciliation.

  **Bajarish:** Provider bilan DB orasida distributed transaction faraz qilinmaydi; callback/status/reconcile orqali yakunlash. At-least-once yetkazish + idempotent biznes, exactly-once deb va’da yo‘q.

  **Manba:** FULL_PROJECT_PLAN.md, 378-satr; vazifa №7 (DATA-01).

  **Boshlash sharti:** FIX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Unknown provider result lookup/reconcile orqali hal qilinadi; avtomatik duplicate charge yaratilmaydi.

  **Qabul:** `done`, 2026-10-10; vendor-neutral core. [Test va cheklovlar](EXECUTION_STATUS.md#data-core-plus-2-2026-10-10).

  **Dalil:** `DATA-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **DATA-01.08** — Standart xato formati, so‘rov identifikatori, pagination/hajm cheklovi va API shartnomasi.

  **Texnologiya:** Zod runtime schemas, TypeScript DTO, Next.js Response.

  **Bajarish:** Yagona xato envelope/requestId, page/limit/sort validatsiya; API contract hujjati. OpenAPI generator faqat clientlar/mapping hajmi katta bo‘lsa T09.

  **Manba:** FULL_PROJECT_PLAN.md, 379-satr; vazifa №8 (DATA-01).

  **Boshlash sharti:** FIX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** API contract/error/requestId/pagination/max-size hujjati va success/invalid/forbidden testlari mos.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `DATA-01.08` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **DATA-01.09** — Fayllar uchun vakolatli saqlash, yuklash cheklovi va o‘chirish siyosati.

  **Texnologiya:** Mavjud PostgreSQL durable volume/Bytes, Prisma, Next.js protected binary download, existing sharp image decoder.

  **Bajarish:** Static PNG/JPEG/WebPni512KiB bilan cheklab WebPga sanitizatsiya qilish; bytes/metadata/tenant link/auditni bitta DB transaction va encrypted backupda saqlash. Default100MiB tenant quota, expiry/access/tombstone delete. PostgreSQL mavjud durable volume yetarli; katta fayl ehtiyoji tasdiqlanganda T10 storage. Public papkaga mijoz hujjati qo‘yilmaydi. ADR-035.

  **Manba:** FULL_PROJECT_PLAN.md, 380-satr; vazifa №9 (DATA-01).

  **Boshlash sharti:** FIX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Upload size/type/access/expiry/delete testlari; begona tenant faylni o‘qiy olmaydi.

  **Qabul:** `done`, 2026-10-08. Protected files/katalog/CSP qabul protokoli EXECUTION_STATUS.md oxirida.

  **Dalil:** `DATA-01.09` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **DATA-01.10** — Migratsiya, ma’lumot ko‘chirish va mavjud hisobni tekshirish uchun skript/reja.

  **Texnologiya:** Prisma Migrate, Node batches, PostgreSQL checks.

  **Bajarish:** Expand→backfill→verify→contract; opening/ledger sum va row counts tasdiqlanadi. Dry-run va backup/restore; script qayta ishlatilsa dublikat qilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 381-satr; vazifa №10 (DATA-01).

Hozirgi Next.js loyihasini saqlab, biznes hisob-kitoblarini sahifalardan ajratilgan xizmat qatlamiga yig‘ish tavsiya etiladi. Fon ishlariga alohida worker qo‘shiladi. Mikroservislarga bo‘lish faqat o‘lchangan ehtiyoj bo‘lsa; production uchun majburiy talab emas. Keyinchalik kod yozishda mahalliy Next.js yo‘riqnomalari o‘qilishi shart.

  **Boshlash sharti:** FIX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Old dataset clone migration/backfill/reconcile testida saqlangan; fresh install va rollback rejasi tekshirilgan.

  **Qabul holati (2026-10-11): done.** Read-only snapshot/ledger CLI, real pg_dump/pg_restore orqali synthetic eski dataset clone,128 migration, original25table/4040row preservation, repeated113table/4067row backfill idempotency, fresh install, clone constraint validation, offline backup rollback va previous committed app compatibility PASS. Bu real customer/staging/production migration dalili emas; ular OPS/pilot gate’larida ochiq. [DATA-01.10 protokoli](EXECUTION_STATUS.md#data-0110--160-original-bandning-qabuli-2026-10-11); `tasks/evidence/migration-dataset-20261011.json`.

  **Dalil:** `DATA-01.10` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

### 13. Server, monitoring va tiklash

#### OPS-01 — xavfsiz chiqarish [P0]

- [ ] **OPS-01.01** — Development, staging va production alohida baza/kalit bilan.

  **Texnologiya:** Docker Compose/env, PostgreSQL separate DB/roles.

  **Bajarish:** Dev/staging/prod baza, fayl volume va provider keylari alohida; real shaxsiy ma’lumot stagingga niqobsiz ko‘chirilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 389-satr; vazifa №1 (OPS-01).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Dev/staging/prod DB va secrets ajratilgan; test prodga yozolmaydi.

  **Dalil:** `OPS-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OPS-01.02** — Builddan `db push`ni chiqarish; versiyalangan migratsiyani alohida chiqarish bosqichida bajarish.

  **Texnologiya:** Prisma Migrate, Next.js build, Docker deploy job.

  **Bajarish:** package build hozir next build ekanini saqlash; qolgan deploy/Docker yo‘lida db push bo‘lsa olib tashlash. migrate deploy versioned bosqich, bazasiz build va runtime health.

  **Manba:** FULL_PROJECT_PLAN.md, 390-satr; vazifa №2 (OPS-01).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Build DBga schema mutatsiyasi qilmaydi; deploy faqat versioned migrationni alohida qadamda bajaradi.

  **Qabul holati (2026-10-06):** `done`. Individual natija, test va versiya dalili [EXECUTION_STATUS.md — +50 checkpoint](EXECUTION_STATUS.md#50-sorovi--1-checkpoint-2026-10-06) bo‘limida.

  **Dalil:** `OPS-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **OPS-01.03** — Yangi/avvalgi ilova bilan mos migratsiya, ma’lumot backfilli va qaytish rejasi.

  **Texnologiya:** PostgreSQL expand-contract migrations, Prisma, Docker version rollback.

  **Bajarish:** Avval yangi nullable schema, keyin backfill, so‘ng eski kodni olib tashlash. Ilova rollback data loss migrationni avtomatik qaytarmaydi; PITR favqulodda va reconcile bilan.

  **Manba:** FULL_PROJECT_PLAN.md, 391-satr; vazifa №3 (OPS-01).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Expand/backfill/contract rollout eski/yangi app bilan stagingda; rollback data-losssiz yoki forward-fix bilan.

  **Dalil:** `OPS-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **OPS-01.04** — CI: lint → turlar → test → build → staging → qabul tekshiruvi → production.

  **Texnologiya:** Mavjud npm/TypeScript/ESLint, Node test, Playwright, Docker; CI T06.

  **Bajarish:** Repo hostingida native pipeline bo‘lsa shu; bo‘lmasa GitHub Actions kabi runner. Staging smoke va release artefakt tasdig‘i bilan promotion.

  **Manba:** FULL_PROJECT_PLAN.md, 392-satr; vazifa №4 (OPS-01).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** CI lint/type/test/build/staging gate failda release qilmaydi; prod release uchun aniq ruxsat bor.

  **Dalil:** `OPS-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **OPS-01.05** — Image versiyasi, minimal vakolatli jarayon, xavfsiz secret saqlash va kalit aylantirish.

  **Texnologiya:** Docker image digest/non-root, secret mounts, Node config.

  **Bajarish:** Immutable image, read-only qatlam va write volume; sirlarni log/imagega bermaslik. Key rotationda sessiya/provider muddatli almashuv tartibi.

  **Manba:** FULL_PROJECT_PLAN.md, 393-satr; vazifa №5 (OPS-01).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Image pinned va non-root; secrets image/logda yo‘q; key rotation eski kalitni bekor qiladi.

  **Dalil:** `OPS-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **OPS-01.06** — TLS, domen, firewall; bazani umumiy internetga ochmaslik.

  **Texnologiya:** TLS ingress T01, Linux firewall, Docker private network.

  **Bajarish:** Next server oldida reverse proxy; faqat zarur portlar. DB private, actual DB remote access TLS/VPN/vakolat bilan.

  **Manba:** FULL_PROJECT_PLAN.md, 394-satr; vazifa №6 (OPS-01).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** TLS/domen/firewall real stagingda; DB public port ochiq emas.

  **Dalil:** `OPS-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OPS-01.07** — Health/readiness endpoint, nazoratli restart, ulanish pooli va graceful shutdown.

  **Texnologiya:** Next.js health routes, Prisma pool, Docker/OS supervisor.

  **Bajarish:** Liveness va DB readiness ajratish; SIGTERMda worker claimni bo‘shatish va server drain. PgBouncer faqat instance×pool ulanish limiti o‘lchab yetmaganda T09.

  **Manba:** FULL_PROJECT_PLAN.md, 395-satr; vazifa №7 (OPS-01).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Readiness DB/queue dependencyga mos; restart/shutdownda completed va pending operations yo‘qolmaydi.

  **Qabul (2026-10-07):** `done`. Individual natija va versiya dalili [joriy checkpointda](EXECUTION_STATUS.md#plus-20-2026-10-07-b--davom-etayotgan-qabul).

  **Dalil:** `OPS-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OPS-01.08** — Yangilash vaqtida savdoni yo‘qotmaslik; texnik xizmat oynasi va xabar berish.

  **Texnologiya:** Next.js deploy version, Docker drain, outbox/idempotency.

  **Bajarish:** Blue-green yoki boshqariladigan rolling/downtime oynasi; old instance savdoni tugatadi. PWA client/server version mosligi, maintenance xabari va pending queue himoyasi.

  **Manba:** FULL_PROJECT_PLAN.md, 396-satr; vazifa №8 (OPS-01).

  **Boshlash sharti:** FIX-01, DATA-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Maintenance/deploy paytida basket/committed sale saqlanadi; notice va restore yo‘li sinovlangan.

  **Dalil:** `OPS-01.08` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

#### OPS-02 — kuzatish va hodisalarni boshqarish [P0]

- [x] **OPS-02.01** — Tuzilgan loglar, request ID, tashkilot ID; maxfiy/shaxsiy ma’lumotlarni niqoblash.

  **Texnologiya:** Node JSON stdout, AsyncLocalStorage, Prisma.

  **Bajarish:** Request/organization/operation correlation; redaction allowlist. Dastlab console JSON yetarli, hajm/transport ehtiyoji isbotlansa T09 Pino.

  **Manba:** FULL_PROJECT_PLAN.md, 400-satr; vazifa №1 (OPS-02).

  **Boshlash sharti:** OPS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Structured log requestId/tenant correlation bilan; secret/PII mask testi o‘tadi.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `OPS-02.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **OPS-02.02** — API xatolari, sekin so‘rov, baza, disk, navbat, fiskal/to‘lov xatolari monitoringi.

  **Texnologiya:** Node performance hooks, PostgreSQL stats, Docker host metrics, T11.

  **Bajarish:** App counters/histograms va provider latency; tashqi uptime probe shart, ilova o‘zining o‘chganini xabar qila olmaydi. Minimal external monitoring, hajm oshsa Prometheus/Grafana/OTel.

  **Manba:** FULL_PROJECT_PLAN.md, 401-satr; vazifa №2 (OPS-02).

  **Boshlash sharti:** OPS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Sun’iy API/slow DB/disk/queue/provider failure belgilangan alertni hosil qiladi.

  **Dalil:** `OPS-02.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OPS-02.03** — Savdo/to‘lov/qoldiq solishtirish farqi uchun biznes ogohlantirishlari.

  **Texnologiya:** PostgreSQL reconcile jobs, Prisma Incident.

  **Bajarish:** Ledger/sale/payment/fiscal mismatch bo‘lsa severity, entity va dalil; T08 alarm. Farqga avtomatik yashirin tuzatish emas operator jarayoni.

  **Manba:** FULL_PROJECT_PLAN.md, 402-satr; vazifa №3 (OPS-02).

  **Boshlash sharti:** OPS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Sun’iy sale-payment-stock mismatch mas’ulga alert; resolved event auditli.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `OPS-02.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OPS-02.04** — Navbatdagi ishlarni takrorlash va yechilmagan ishlar ro‘yxati.

  **Texnologiya:** PostgreSQL Job/outbox, Node worker, React admin.

  **Bajarish:** Attempt, nextRunAt, lease, heartbeat, dead-letter holatlari; bounded retry. Admin replay ham idempotency va vakolatdan o‘tadi.

  **Manba:** FULL_PROJECT_PLAN.md, 403-satr; vazifa №4 (OPS-02).

  **Boshlash sharti:** OPS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Retry bounded/lease-safe; exhausted job ko‘rinadi va qo‘lda retry duplicate effect yaratmaydi.

  **Dalil:** `OPS-02.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **OPS-02.05** — Xatoni mas’ul xodimga yuborish va eskalatsiya; kim javob berishi aniq bo‘lishi.

  **Texnologiya:** PostgreSQL OnCall/Escalation, Node worker, T08/T11.

  **Bajarish:** Mas’ul va backup mas’ul, acknowledgment va deadline; eskalatsiya tarixi. Alarm kanali asosiy appdan tashqarida ham ishlay olishi.

  **Manba:** FULL_PROJECT_PLAN.md, 404-satr; vazifa №5 (OPS-02).

  **Boshlash sharti:** OPS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Test alert haqiqiy on-call kanaliga yetkazilgan; escalation/ack mas’uli yozma.

  **Dalil:** `OPS-02.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **OPS-02.06** — Status sahifasi, hodisa jurnali va jiddiy hodisadan keyingi tahlil.

  **Texnologiya:** Mustaqil hostingda static status + Markdown incident docs T11.

  **Bajarish:** Status sahifa asosiy app bilan bir serverda qolmaydi; incident vaqt chizig‘i, sabab va prevention yoziladi. Ticket eksporti mijoz sirlarini yashiradi.

  **Manba:** FULL_PROJECT_PLAN.md, 405-satr; vazifa №6 (OPS-02).

  **Boshlash sharti:** OPS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Status sahifasi appdan mustaqil; incident timeline va postmortem andozasi amaliy mashqda to‘ldirilgan.

  **Dalil:** `OPS-02.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

#### OPS-03 — backup va tiklash [P0]

- [ ] **OPS-03.01** — Shifrlangan avtomatik backup; bazaning asosiy serveridan boshqa saqlash joyi.

  **Texnologiya:** PostgreSQL backup tools, OS timer, off-host encrypted storage T10/T12.

  **Bajarish:** Avtomatik backup, shifrlash va ikkinchi failure domain; key alohida. Backup checksum, yakun holati va kechikish uchun tashqi alert.

  **Manba:** FULL_PROJECT_PLAN.md, 409-satr; vazifa №1 (OPS-03).

  **Boshlash sharti:** OPS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Encrypted off-host backup job ishlaydi; host yo‘qolganda backup ochiladi, unauthorized access rad.

  **Dalil:** `OPS-03.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OPS-03.02** — Baza bilan birga mahsulot rasmlari, hujjatlar va zarur konfiguratsiya zaxirasi.

  **Texnologiya:** Durable file volumes/object store, PostgreSQL metadata, backup manifest.

  **Bajarish:** Rasmlar/hujjatlar va zarur konfiguratsiya DB cut-off bilan bog‘lanadi. Secretlar alohida xavfsiz backup, butun envni hujjat eksportiga qo‘shmaslik.

  **Manba:** FULL_PROJECT_PLAN.md, 410-satr; vazifa №2 (OPS-03).

  **Boshlash sharti:** OPS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** DB/file/config manifest restoreda mos; secret nusxasi alohida himoyalangan.

  **Dalil:** `OPS-03.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul (2026-10-08):** `done`. Yakuniy individual dalil EXECUTION_STATUS.md dagi “Soliq, refund, scope va backup — yakuniy qabul” protokolida.

- [ ] **OPS-03.03** — Nuqtaga tiklash imkoniyati, backup muddati va kirish vakolati.

  **Texnologiya:** PostgreSQL base backup/WAL archive T12.

  **Bajarish:** PITR uchun pg_dump yetmaydi; base backup va uzluksiz WAL, retention/access/restore target. pgBackRest agar qo‘l lifecycle avtomatizatsiyasi talabini yopmasa audited backup vositasi sifatida.

  **Manba:** FULL_PROJECT_PLAN.md, 411-satr; vazifa №3 (OPS-03).

  **Boshlash sharti:** OPS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** WAL/PITR retention/access sozlangan; target timestampga restore dalili bor.

  **Dalil:** `OPS-03.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OPS-03.04** — Alohida muhitga amaliy tiklash sinovi; faqat “backup olindi” xabari yetarli emas.

  **Texnologiya:** Docker isolated restore, PostgreSQL utilities, Node verification.

  **Bajarish:** Toza muhitga tiklash, vaqt/RPO o‘lchash, row/ledger/fayl mosligini tekshirish; tashqi payment jo‘natish restore testda o‘chiq.

  **Manba:** FULL_PROJECT_PLAN.md, 412-satr; vazifa №4 (OPS-03).

  **Boshlash sharti:** OPS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Toza isolated restore RPO≤15min/RTO≤4hga mos; app va ledger tekshiruvi o‘tadi.

  **Qabul (2026-10-07):** `done`. Individual natija va versiya dalili [joriy checkpointda](EXECUTION_STATUS.md#plus-20-2026-10-07-b--davom-etayotgan-qabul).

  **Dalil:** `OPS-03.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OPS-03.05** — Tashkilotga tegishli yozuvni tiklashda boshqa tashkilot ma’lumotiga ta’sirni tekshirish.

  **Texnologiya:** Isolated PostgreSQL recovery copy va tenant-scoped import.

  **Bajarish:** Butun prod bazani bitta mijoz uchun ortga qaytarmaslik; recovered copydan kerakli records/FKni auditli tanlash. Boshqa tashkilotga ta’sir testda nol.

  **Manba:** FULL_PROJECT_PLAN.md, 413-satr; vazifa №5 (OPS-03).

  **Boshlash sharti:** OPS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Tenant restore isolated cloneda rejalangan; boshqa tenant snapshot/hashlari o‘zgarmaydi.

  **Qabul (2026-10-11):** `done` — isolated recovered clone bilan read-only reja, boshqa tenant business snapshot/hashlari teng. Apply/import yoki real production recovery bajarilmagan. [Qabul dalili](evidence/tenant-recovery-20261011.json), [operator tartibi](../docs/operations/tenant-recovery.md).

  **Dalil:** `OPS-03.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **OPS-03.06** — Tiklashdan keyin provider, offline navbat va savdo holatlarini solishtirish.

  **Texnologiya:** Prisma reconciliation, provider status adapter, offline IDs.

  **Bajarish:** Restoredan keyin providerda bajarilgan ammo DBda yo‘q amallarni topish; replay oldin status/IDlarni tekshirish. Offline queue qayta yozishni unique key to‘xtatadi.

  **Manba:** FULL_PROJECT_PLAN.md, 414-satr; vazifa №6 (OPS-03).

Boshlang‘ich muhandislik maqsadlari: oylik mavjudlik **99,9%**, backupdagi ruxsat etilgan yo‘qotish oralig‘i (RPO) **15 daqiqagacha**, tiklanish vaqti (RTO) **2 soatgacha**. Bular hozirgi kafolat yoki bozor fakti emas; infratuzilma narxi va pilot sinovi bilan tasdiqlanadi. Yakunlangan savdo normal retry jarayonida yo‘qolmasligi alohida majburiy shart.

  **Boshlash sharti:** OPS-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Restored DB provider/offline/outbox bilan reconcile; old job replay duplicate iqtisodiy natija yaratmaydi.

  **Dalil:** `OPS-03.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

#### OPS-04 — tezlik va hajm [P1]

- [ ] **OPS-04.01** — Pilotdan katalog, savdo hajmi, kassalar va parallel so‘rovlar profilini olish.

  **Texnologiya:** Markdown workload profile, PostgreSQL anonymized counts.

  **Bajarish:** Pilot katalog/savdo/peak kassalar, query pattern va tarmoqni o‘lchash; sun’iy test realga o‘xshashi yoziladi.

  **Manba:** FULL_PROJECT_PLAN.md, 420-satr; vazifa №1 (OPS-04).

  **Boshlash sharti:** POS-01, REP-01, OPS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Pilot hajmi/kassa/request/peak o‘lchovi va test profile yozilgan; taxmin va real son ajratilgan.

  **Dalil:** `OPS-04.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OPS-04.02** — Dastlabki test profili: bir tashkilotda 50 000 mahsulot, 1 million savdo qatori, 20 parallel faol kassa.

  **Texnologiya:** Node seed generator, PostgreSQL, Docker test environment.

  **Bajarish:** 50k mahsulot/1m qator/20 kassa profilini deterministik test tenantda yaratish; productionga test savdolar yuborilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 421-satr; vazifa №2 (OPS-04).

  **Boshlash sharti:** POS-01, REP-01, OPS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** 50000 product/1million sale line/20 active till dataset va generator reproducible.

  **Dalil:** `OPS-04.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OPS-04.03** — Namuna yuklamada qidiruv p95 ≤ 500 ms, ichki savdo yakunlash p95 ≤ 2 s; provider vaqti alohida o‘lchanadi.

  **Texnologiya:** Node performance/HTTP harness, PostgreSQL EXPLAIN, T09 k6 zarur bo‘lsa.

  **Bajarish:** p95 qidiruv/yakunlash alohida histogram; provider network alohida. Avval Node load runner, distributed load yoki chuqur reporting yetishmasa k6.

  **Manba:** FULL_PROJECT_PLAN.md, 422-satr; vazifa №3 (OPS-04).

  **Boshlash sharti:** POS-01, REP-01, OPS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Qidiruv p95≤500ms, internal checkout p95≤2s; environment/sample/error rate qaydi va provider time alohida.

  **Dalil:** `OPS-04.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OPS-04.04** — N+1 so‘rovlarni kamaytirish, indekslar, cheklangan pagination va katta eksport uchun worker.

  **Texnologiya:** Prisma select/include/batching, PostgreSQL indexes/keyset, Node worker.

  **Bajarish:** N+1ni query countdan topish; cursor export va indexed search. JSON snapshot yoki tashqi cache bilan hisobot yaxlitligini yo‘qotmaslik.

  **Manba:** FULL_PROJECT_PLAN.md, 423-satr; vazifa №4 (OPS-04).

  **Boshlash sharti:** POS-01, REP-01, OPS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Query count/EXPLAIN before-after bor; bounded page va worker export correctnessni saqlaydi.

  **Dalil:** `OPS-04.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OPS-04.05** — Hisob/ruxsat ma’lumotini eskirgan keshdan olish xavfini boshqarish.

  **Texnologiya:** Next.js scoped cache, Prisma version fields.

  **Bajarish:** Pul/qoldiq/vakolat jonli serverda; katalog cache tenant+store+priceVersion bilan invalidatsiya. Umumiy public cachega private natija yo‘q.

  **Manba:** FULL_PROJECT_PLAN.md, 424-satr; vazifa №5 (OPS-04).

  **Boshlash sharti:** POS-01, REP-01, OPS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Price/stock/permission changes cache invalidation yoki bypassdan keyin darhol amalda tekshiriladi.

  **Qabul holati (2026-10-06):** `done`. Individual natija, test va versiya dalili [EXECUTION_STATUS.md — +50 checkpoint](EXECUTION_STATUS.md#50-sorovi--1-checkpoint-2026-10-06) bo‘limida.

  **Dalil:** `OPS-04.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **OPS-04.06** — Stress, uzoq davomli yuklama va tiklanish sinovlari.

  **Texnologiya:** Node load harness, Docker restart/network scenarios, PostgreSQL stats.

  **Bajarish:** Stress va soakda memory/pool/queue/disk trend; restartdan keyin idempotent tiklanish. Test protokoli va hardware birga saqlanadi.

  **Manba:** FULL_PROJECT_PLAN.md, 425-satr; vazifa №6 (OPS-04).

Bu sonlar kelishish uchun taklif qilingan mezonlar. Test muhiti va o‘lchash shartlari yozilmaguncha tezlik kafolati sifatida ishlatilmaydi.

  **Boshlash sharti:** POS-01, REP-01, OPS-02. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Peakning 2× stressi 15min va normal load 2h soak; restartdan keyin data-loss/duplicate yo‘q, bottleneck qaydi bor.

  **Qabul:** `done`, 2026-10-12 (Asia/Tashkent). [15min stress, 2h soak, restart va ledger dalillari](EXECUTION_STATUS.md#original-163164--ops-0406-yuklama-va-tiklanish-qabuli-2026-10-12). Mahalliy sintetik profil; haqiqiy pilot/SLO/deployment qabuli emas.

  **Dalil:** `OPS-04.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

### 14. Test va qabul tekshiruvlari

#### QA-01 — avtomatik tekshiruvlar [P0]

- [x] **QA-01.01** — Pul/chegirma/soliq/tannarx/nasiya formulalari uchun birlik testlari.

  **Texnologiya:** Node built-in test/assert, TypeScript test build, Prisma.Decimal.

  **Bajarish:** Pure hisoblash modulini izolyatsiyalash; decimal strings, boundary/rounding/tax/return cases. TSni mavjud tsc bilan vaqtinchalik JSga compile; Vitest majburiy emas.

  **Manba:** FULL_PROJECT_PLAN.md, 433-satr; vazifa №1 (QA-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Hisob formula testlari zero/boundary/rounding/partial-return va oldindan hisoblangan expected values bilan o‘tadi.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `QA-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **QA-01.02** — Haqiqiy PostgreSQL bilan savdo, qoldiq, qaytarish va migratsiya integratsion testlari.

  **Texnologiya:** Node test runner, Docker PostgreSQL, Prisma Migrate.

  **Bajarish:** Haqiqiy transaction/FK/locksni test DBda; har suite izolyatsiyasi va ledger assertions. Production connection bilan test boshlashga guard.

  **Manba:** FULL_PROJECT_PLAN.md, 434-satr; vazifa №2 (QA-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Real PG isolated integration suite sale/stock/return/migrationni tekshiradi; mock DB dalil o‘rnini bosmaydi.

  **Qabul holati (2026-10-06):** `done`. Individual kirish/natija/test/versiya dalili [EXECUTION_STATUS.md — Yana 10 ta PLAN1 bandi](EXECUTION_STATUS.md#yana-10-ta-plan1-bandi--yakuniy-qabul-2026-10-06) bo‘limida.

  **Dalil:** `QA-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **QA-01.03** — Kassirning boshidan oxirigacha jarayonlari uchun brauzer testlari.

  **Texnologiya:** Playwright T04, Next.js test server.

  **Bajarish:** Mavjud stack browser automation bermaydi; bitta Playwright framework bilan Chromium/Firefox/WebKit va kassir end-to-end oqimi. Auth fixtures va screenshot trace.

  **Manba:** FULL_PROJECT_PLAN.md, 435-satr; vazifa №3 (QA-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Browser suite checkout/mixed pay/refund/shift/tenant boundary uchun success va failure assertions bilan o‘tadi.

  **Dalil:** `QA-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **QA-01.04** — Tashkilot/rol/do‘kon chegaralarining barcha API guruhlari bo‘yicha testlari.

  **Texnologiya:** Node API integration + Playwright T04.

  **Bajarish:** A/B tenant va role/store kombinatsiyalari; list/detail/mutation/export/file/job route inventory. UI yashirishdan tashqari API deny tekshirish.

  **Manba:** FULL_PROJECT_PLAN.md, 436-satr; vazifa №4 (QA-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Har API guruhining tenant/store/role endpoint coverage reyestri va allow/deny testlari bor.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `QA-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **QA-01.05** — Parallel so‘rov va takror amal testlari.

  **Texnologiya:** Node Promise.all concurrent requests, PostgreSQL real constraints.

  **Bajarish:** Parallel last-stock/shift/return/duplicate keys; baza yakunidagi sale/payment/ledger soni tekshiriladi. Tashqi side-effect mocki aniq ID bilan.

  **Manba:** FULL_PROJECT_PLAN.md, 437-satr; vazifa №5 (QA-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Parallel last-stock/last-owner/shift/replay testlari deterministic invariant assertions bilan o‘tadi.

  **Qabul holati (2026-10-06):** `done`. Individual natija, test va versiya dalili [EXECUTION_STATUS.md — +50 checkpoint](EXECUTION_STATUS.md#50-sorovi--1-checkpoint-2026-10-06) bo‘limida.

  **Dalil:** `QA-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **QA-01.06** — Provider sandbox, timeout, noto‘g‘ri imzo, takror/kechikkan callback testlari.

  **Texnologiya:** Node HTTP provider stub, crypto fixtures, actual sandbox.

  **Bajarish:** Timeout, wrong signature, duplicated/delayed event va refund; contract fixtures provider versiyasi bilan. Haqiqiy sandbox yakuniy sertifikat ssenariylari.

  **Manba:** FULL_PROJECT_PLAN.md, 438-satr; vazifa №6 (QA-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Sandbox timeout/bad signature/duplicate/late callback natijalari ledger bilan mos; real sandbox yo‘q bo‘lsa blocked.

  **Dalil:** `QA-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **QA-01.07** — Offline/reconnect, printer uzilishi, brauzer yopilishi va server restart sinovlari.

  **Texnologiya:** Playwright offline/interception, IndexedDB, Docker restarts, real devices.

  **Bajarish:** Offline queue/crash/reconnectda sale number va ledger mosligi; printer physical failure actual hardwareda. Browser mocking hammasini qoplamaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 439-satr; vazifa №7 (QA-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Offline/reconnect/print failure/browser close/server restart suite lost/duplicate operations yo‘qligini tekshiradi.

  **Dalil:** `QA-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **QA-01.08** — Paket xavfsizligi, secret scanning va stagingda xavfsizlik tekshiruvi.

  **Texnologiya:** npm audit, Git platform secret scanning yoki T14 scanner, staging security tests.

  **Bajarish:** Lockfile/CVE va image scanning; credential chiqsa rotation ham qilinadi. DAST/import/XSS/rate-limit testlar vakolatli stagingda.

  **Manba:** FULL_PROJECT_PLAN.md, 440-satr; vazifa №8 (QA-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Dependency/secret/image/staging scan dalili; unresolved critical/high real findings release gate bloklaydi.

  **Dalil:** `QA-01.08` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **QA-01.09** — Backup restore, migratsiya va chiqarishdan qaytish mashqi.

  **Texnologiya:** Docker/PG restore, Prisma migrations, CI release drills.

  **Bajarish:** Old schema snapshot→migrate→rollback-compatible app→restore/reconcile mashqi. Dalilda vaqt, backup target va hisob mosligi.

  **Manba:** FULL_PROJECT_PLAN.md, 441-satr; vazifa №9 (QA-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI.

  **Bandning qabul mezoni:** Restore/migration/rollback mashqi isolated stagingda RPO/RTO va reconciliation dalili bilan o‘tadi.

  **Qabul:** `done`, 2026-10-07. [Kirish, kutilgan/haqiqiy natija, test va versiya](EXECUTION_STATUS.md#plus-20-2026-10-07).

  **Dalil:** `QA-01.09` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

#### Majburiy biznes ssenariylari

| Sinov | Kutilgan natija | Texnologik yo‘l |
| --- | --- | --- |
| A tashkilot B ma’lumotini so‘raydi | Ruxsat yo‘q; javobda ham ma’lumot chiqmaydi | Node API integration: barcha yo‘llarda A/B sessiya va cross-tenant ID; DTO/export/fayl bo‘yicha ham deny assertion. |
| Oxirgi dona ikki kassada sotiladi | Belgilangan qoldiq siyosati saqlanadi | Node Promise.all + haqiqiy PostgreSQL transaction/locks; yakuniy quantity va sale count siyosatga mos. |
| Savdo tugmasi ikki marta bosiladi | Bitta savdo/to‘lov/chiqim | Node API duplicate operationId + Playwright double-click; sale/payment/movement bittadan. |
| Savdo yozildi, javob uzildi | Natija topiladi, yangi savdo yaratilmaydi | Playwright network interception: server commitdan keyingi response uzilishi; status API original operationni topadi. |
| Qoralamada faqat izoh o‘zgaradi | Mahsulot qatorlari va jami saqlanadi | Node integration va Playwright form patch; items IDs/count va summa oldingidek qoladi. |
| Nasiya qisman naqd undiriladi | Qarz kamayadi, naqd kassa oshadi | Node Decimal/ledger integration: 100k debt, 30k collection → 70k debt va +30k cash. |
| Chegirmali savdo qisman qaytariladi | Original summaga mos refund va qoldiq | Node original-snapshot/rounding/return integration; miqdor, refund, tax va stock mos. |
| Transfer qisman qabul qilinadi | Qabul qilingan va yo‘ldagi qoldiq ajraladi | Node PG transaction: bir nechta receipt; total received + remaining in-transit = sent quantity. |
| Sana chegarasi va 1 000 yozuv eksporti | Oxirgi kun to‘liq va barcha mos yozuvlar | Node timezone boundary + T03 export rows; 1000 mos yozuv/count/totals va oxirgi kun. |
| Fiskal/to‘lov callbacki qayta keladi | Takror chek yoki tushum yo‘q | Node crypto fixture va callback replay; providerEvent/ledger/fiscal business source noyob. |
| Xodim bloklanadi | Faol sessiyada ham amallar rad etiladi | Node session integration + Playwright ochiq browser; revoke/membership change keyingi amallarni rad qiladi. |
| Backupdan tiklanadi | Kelishilgan vaqtda mos hisob bilan ishlash tiklanadi | Docker isolated restore + PostgreSQL ledger/fayl manifest tekshiruvi; RPO/RTO va provider reconcile dalili. |

### 15. Xizmatni sotish va mijozga yetkazish

#### BIZ-01 — tijoriy model [P1, SaaS bo‘lsa]

- [x] **BIZ-01.01** — SaaS obuna, lokal o‘rnatish yoki ikkalasini qo‘llash modelini tanlash.

  **Texnologiya:** Docker bir xil artefakt, Next.js deployment profiles, Markdown ADR.

  **Bajarish:** Cloud/local/hybridning support/upgrade/backup xarajati va mijoz talabi; bir xil codebase. Offline litsenziya talabi bo‘lsa muddatli signed entitlement, alohida fork yo‘q.

  **Manba:** FULL_PROJECT_PLAN.md, 464-satr; vazifa №1 (BIZ-01).

  **Boshlash sharti:** SEC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** SaaS-first ADR va support doirasi owner tomonidan tasdiqlangan; local deployment alohida release.

  **Qabul:** `done`,2026-10-10; mahsulot egasi SaaS-first va support doirasini tasdiqladi, ADR-059.

  **Dalil:** `BIZ-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **BIZ-01.02** — Tarifni filial/kassa/xodim yoki funksiyalar bo‘yicha tushunarli belgilash.

  **Texnologiya:** Prisma Plan/Entitlement va React pricing.

  **Bajarish:** Filial/kassa/xodim/function limitlari versiyalangan; tenant real consumption bilan. Marketing matni va backend entitlements bir manba.

  **Manba:** FULL_PROJECT_PLAN.md, 465-satr; vazifa №2 (BIZ-01).

  **Boshlash sharti:** SEC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Tarif birligi/limit/feature va narx/currency owner tasdiqli; UI/backend entitlement bir xil.

  **Qabul:** `done`, 2026-10-10; tasdiqlangan SaaS/Pro-trial siyosati, SQL/API/race/replay va browser dalillari: `tasks/evidence/saas-core-20261010.json`. Real Click/fiscal/hardware yoki production hosting qabul qilinmadi.

  **Dalil:** `BIZ-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **BIZ-01.03** — Sinov davri, obuna, hisob/invoice, to‘lov tarixi, yangilash va bekor qilish.

  **Texnologiya:** Prisma Subscription/Invoice, Node worker, T08 payment.

  **Bajarish:** Trial/renewal/cancel state machine; webhook idempotent, to‘lov tarixi va hisob hujjati. Provider avtomatik subscription qo‘llamasa qo‘lda renewal aniq ko‘rsatiladi.

  **Manba:** FULL_PROJECT_PLAN.md, 466-satr; vazifa №3 (BIZ-01).

  **Boshlash sharti:** SEC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Trial/subscription/invoice/payment/renew/cancel state testlari duplicate billing yaratmaydi.

  **Qabul:** `done`, 2026-10-10; tasdiqlangan SaaS/Pro-trial siyosati, SQL/API/race/replay va browser dalillari: `tasks/evidence/saas-core-20261010.json`. Real Click/fiscal/hardware yoki production hosting qabul qilinmadi.

  **Dalil:** `BIZ-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **BIZ-01.04** — Tarif limitlarini backendda tekshirish; mavjud ma’lumotni limitdan oshganda yo‘qotmaslik.

  **Texnologiya:** Next.js entitlement service, PostgreSQL transaction.

  **Bajarish:** Yangi store/user/feature yaratish backend limit bilan; parallel create limitdan oshmaydi. Eski yozuvlar delete qilinmaydi, read/export qoladi.

  **Manba:** FULL_PROJECT_PLAN.md, 467-satr; vazifa №4 (BIZ-01).

  **Boshlash sharti:** SEC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Limit bypass API orqali rad; limit kamayganda existing data o‘chmaydi va eksport mumkin.

  **Qabul:** `done`, 2026-10-10; tasdiqlangan SaaS/Pro-trial siyosati, SQL/API/race/replay va browser dalillari: `tasks/evidence/saas-core-20261010.json`. Real Click/fiscal/hardware yoki production hosting qabul qilinmadi.

  **Dalil:** `BIZ-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **BIZ-01.05** — Obuna tugaganda xabar, imtiyozli muddat, eksport va xavfsiz o‘qish rejimi siyosati.

  **Texnologiya:** Prisma billing dates, scheduled worker, React banner.

  **Bajarish:** Grace period va xavfsiz read-only; provider pending sale/refundni invoice lock sabab yo‘qotmaslik. Export huquqi va xizmatdan chiqish tartibi.

  **Manba:** FULL_PROJECT_PLAN.md, 468-satr; vazifa №5 (BIZ-01).

  **Boshlash sharti:** SEC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Expiry notice/grace/read-only/export policy konfiguratsiyasi boundary testlaridan o‘tadi.

  **Qabul:** `done`, 2026-10-10; tasdiqlangan SaaS/Pro-trial siyosati, SQL/API/race/replay va browser dalillari: `tasks/evidence/saas-core-20261010.json`. Real Click/fiscal/hardware yoki production hosting qabul qilinmadi.

  **Dalil:** `BIZ-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **BIZ-01.06** — Fiskal provayder, SMS, printer agenti va integratsiya xarajatlarini alohida hisoblash.

  **Texnologiya:** PostgreSQL usage/cost aggregates, CSV budget.

  **Bajarish:** Fiscal/SMS/agent/hosting/backup xarajatini tenant consumption bo‘yicha; tarif marjasi o‘lchanadi. Buxgalteriya accounting bilan chalkashtirmaslik.

  **Manba:** FULL_PROJECT_PLAN.md, 469-satr; vazifa №6 (BIZ-01).

  **Boshlash sharti:** SEC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Provider/SMS/agent/integration xarajat jadvali valyuta/davr/manba bilan; taxminlar belgili.

  **Qabul:** `done`, 2026-10-10; tasdiqlangan SaaS/Pro-trial siyosati, SQL/API/race/replay va browser dalillari: `tasks/evidence/saas-core-20261010.json`. Real Click/fiscal/hardware yoki production hosting qabul qilinmadi.

  **Dalil:** `BIZ-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **BIZ-01.07** — Marketing sahifasida haqiqatda ishlaydigan funksiyalar, narx, mos qurilmalar va yordam tartibi.

  **Texnologiya:** Next.js Server Components/metadata, Tailwind, Prisma/public config.

  **Bajarish:** Faqat tasdiqlangan release capabilities, narx va qurilma jadvali; SEO metadata va demo CTA. Sinovdan o‘tmagan offline/integration reklamasi yo‘q.

  **Manba:** FULL_PROJECT_PLAN.md, 470-satr; vazifa №7 (BIZ-01).

  **Boshlash sharti:** SEC-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Marketingdagi har feature release capability va acceptance daliliga bog‘langan; conditional xususiyatlar aniq.

  **Qabul:** `done`, 2026-10-10; tasdiqlangan SaaS/Pro-trial siyosati, SQL/API/race/replay va browser dalillari: `tasks/evidence/saas-core-20261010.json`. Real Click/fiscal/hardware yoki production hosting qabul qilinmadi.

  **Dalil:** `BIZ-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

#### BIZ-02 — platforma boshqaruvi va support [P1]

- [x] **BIZ-02.01** — Tashkilotlar, tarif, xizmat holati, integratsiyalar va hodisalar uchun platforma admin paneli.

  **Texnologiya:** Next.js admin routes, React, Prisma, separate platform permissions.

  **Bajarish:** Tenant/service/subscription/integration/incident view; service secretlarni UI ko‘rsatmaydi. Platform roliga maxsus MFA va audit.

  **Manba:** FULL_PROJECT_PLAN.md, 474-satr; vazifa №1 (BIZ-02).

  **Boshlash sharti:** BIZ-01, USR-01, UX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Admin tashkilot/tarif/health/integration/incidentni ko‘radi; oddiy tenant user platformaga kira olmaydi.

  **Qabul:** `done`, 2026-10-11. Majburiy action-bound MFA bilan platforma overview/panel, live mustaqil operator vakolati, tenant/tarif/xizmat/incident metadata va rost integration-boundary holatlari. Oddiy owner deny, revoke deny, safe DTO/audit/no-store va pagination tekshirildi. Real deploy/vendor/hardware alohida tashqi bandlarda. Contract: `docs/operations/platform-admin.md`; dalil: `tasks/evidence/platform-admin-20261011.json`.

  **Dalil:** `BIZ-02.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **BIZ-02.02** — Support biznes ma’lumotiga faqat vaqtli, ruxsatli va auditli kira olishi.

  **Texnologiya:** Prisma SupportGrant, server DAL, AuditLog.

  **Bajarish:** Mijoz tasdig‘i, muddat, amal scope va operator identity; ko‘rish ham auditli. Grant tugasa ochiq sessiya bilan kirish to‘xtaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 475-satr; vazifa №2 (BIZ-02).

  **Boshlash sharti:** BIZ-01, USR-01, UX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Support grant tenant/actor/reason/expiry scope bilan; revoke/expiry darhol deny va audit yaratadi.

  **Qabul:** `done`, 2026-10-08. [Support yakuniy qabul](EXECUTION_STATUS.md#support-yakuniy-qabul-2026-10-08).

  **Dalil:** `BIZ-02.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **BIZ-02.03** — Kassir/egasi uchun murojaat, diagnostika, javob muddati va favqulodda aloqa.

  **Texnologiya:** React support form, Prisma Ticket, T08 notification.

  **Bajarish:** RequestId/diagnosticni niqoblangan attach; severity, SLA, on-call va escalation. Support SaaS ticket hajmi ichki panelda yetmagandagina T09.

  **Manba:** FULL_PROJECT_PLAN.md, 476-satr; vazifa №3 (BIZ-02).

  **Boshlash sharti:** BIZ-01, USR-01, UX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Ticket/diagnostic/SLA/emergency contact mavjud; demo murojaat javob/eskalatsiya oqimidan o‘tadi.

  **Dalil:** `BIZ-02.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **BIZ-02.04** — Mijozni o‘rnatish: import, boshlang‘ich qoldiq/qarz, qurilmalar, trening va ishga tushirish.

  **Texnologiya:** React onboarding wizard, T03 importer, Prisma opening docs.

  **Bajarish:** Import/draft stock/debt → preview → approval → equipment test → training → go-live. Boshlang‘ich yozuvlar audit va operationId bilan.

  **Manba:** FULL_PROJECT_PLAN.md, 477-satr; vazifa №4 (BIZ-02).

  **Boshlash sharti:** BIZ-01, USR-01, UX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Har pilot import/opening balance/device/training/cutover checklistni real yakunlagan.

  **Dalil:** `BIZ-02.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **BIZ-02.05** — Ishga tushirishdan oldingi hisobni imzolangan/kelishilgan solishtirish bilan tasdiqlash.

  **Texnologiya:** PostgreSQL reconciliation, HTML report/T04 PDF, document metadata.

  **Bajarish:** Egasi tasdiqlaydigan opening stock/debt/cash ro‘yxati; fayl hash, approval timestamp va mas’ul. Huquqiy ERI zarur bo‘lsa T08 rasmiy SDK.

  **Manba:** FULL_PROJECT_PLAN.md, 478-satr; vazifa №5 (BIZ-02).

  **Boshlash sharti:** BIZ-01, USR-01, UX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Opening stock/debt/cash totals mijoz bilan solishtirilgan va tasdiqlangan; farqlar hal etilgan.

  **Dalil:** `BIZ-02.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **BIZ-02.06** — Mavjud dasturdan ko‘chirishda ikki marta savdo yuritmaslik va o‘tish sanasini belgilash.

  **Texnologiya:** Markdown cut-over plan, versioned import, PostgreSQL snapshots.

  **Bajarish:** Eski tizim stop/freeze sanasi, final delta import va tekshiruv; rollback oynasi. Bir biznes real savdoni ikki tizimda mustaqil to‘liq hisoblamaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 479-satr; vazifa №6 (BIZ-02).

  **Boshlash sharti:** BIZ-01, USR-01, UX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Cutover time va eski tizim write-stop qaydi; bir davrda ikki tizimdan duplicate posting yo‘q.

  **Dalil:** `BIZ-02.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **BIZ-02.07** — Xizmatdan chiqishda to‘liq ma’lumot eksporti va saqlash/o‘chirish tartibi.

  **Joriy holat (2026-10-10): in_progress.** ADR-062 asosida migration110, DBda immutable retention versiyalari, platform-admin tahriri, owner uchun xavfsiz ko‘rish, haqiqiy obuna sanasidan review muddatini hisoblash, transaction/audit/idempotency va lost-ACK UI tayyor. Bir xil versiyaga sakkiz parallel tahrirdan faqat bittasi qabul qilinadi. Bu sozlamalar o‘chirishni boshlamaydi. Migration111–112 bilan mavjud fon navbatida barcha filiallarning reviewed biznes JSON eksporti, manifest/row counts/hashlar, credential omissions va bounded artifact core qo‘shildi; qabul dalili `tasks/evidence/tenant-export-20261010.json`. Migration113–116 bilan obuna read-only SQL/operation guardlari, original committed replay, wall-clock expiry rollback, subscription snapshot lock, billing/export/auth/support recovery va tor manual expiry/draft tombstone istisnolari qo‘shildi; dalil `tasks/evidence/subscription-readonly-20261010.json`. Migration117–118 bilan owner/password reauthentication, downloaded-export prerequisite, immutable closure/cancel snapshot, DB tuple fence va API/UI core qo‘shildi; qabul dalillari EXECUTION_STATUSda. Closure review deletion emas. Katta eksport arxitekturasi va yakuniy huquqiy toifalar qoladi. Huquqiy toifalar va irreversible deletion `blocked_external`; band `done` emas. Contract: `docs/operations/retention-policy.md`; dalil: `tasks/evidence/retention-policy-20261010.json`.

  **Texnologiya:** Node worker export/retention, T03 ExcelJS, Prisma audit.

  **Bajarish:** Tenant to‘liq export manifest/row counts va fayllar; qonuniy holdlar bilan retention. O‘chirish dry-run, approval va backup muddati siyosati.

  **Manba:** FULL_PROJECT_PLAN.md, 480-satr; vazifa №7 (BIZ-02).

  **Boshlash sharti:** BIZ-01, USR-01, UX-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Authorized full export mashqi o‘tadi; retention/legal hold/delete tartibi tasdiqli va tenant isolation saqlanadi.

  **Dalil:** `BIZ-02.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

#### LEG-01 — huquqiy va ma’lumot siyosati [P0/P1]

- [ ] **LEG-01.01** — Mijoz/xodim telefonlari, savdo va qarz tarixining maqsadi, kirishlari va saqlash muddatini belgilash.

  **Texnologiya:** Markdown data inventory, Prisma metadata/permissions.

  **Bajarish:** Har field uchun maqsad, sezgirlik, kim ko‘radi va retention; log/export/provider ham inventarga kiradi. Keraksiz telefon/qarz nusxalari minimallashtiriladi.

  **Manba:** FULL_PROJECT_PLAN.md, 484-satr; vazifa №1 (LEG-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Data inventory purpose/access/retention/controller bilan; business owner va huquqiy mas’ul tasdiqlagan.

  **Dalil:** `LEG-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LEG-01.02** — Amaldagi shaxsga doir ma’lumotlar, saqlash joyi va reestr talablarini tegishli ma’lumot toifasi uchun tekshirish; hostingni shu tekshiruvdan keyin tanlash.

  **Texnologiya:** Rasmiy hujjatlar, Markdown compliance review, deployment ADR.

  **Bajarish:** Ma’lumot toifalari va bazalar bo‘yicha amaldagi talabni vakolatli mutaxassis bilan tekshirish; hosting region/contract shu natijaga bog‘lanadi. Kod yangi qonun yaratmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 485-satr; vazifa №2 (LEG-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Current official law/source/date/category/region/register xulosasi bor; production hosting shunga mos tanlangan.

  **Dalil:** `LEG-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LEG-01.03** — Maxfiylik siyosati, foydalanish shartlari, xizmat shartnomasi va javobgarlik chegarasi.

  **Texnologiya:** Next.js policy pages, Git Markdown, Prisma acceptance/version.

  **Bajarish:** Shartnoma/maxfiylik versiyasi va qabul sanasi; eski versiya tarixda. Yuridik matnni tasdiqlash inson vazifasi, avtomatik generator emas.

  **Manba:** FULL_PROJECT_PLAN.md, 486-satr; vazifa №3 (LEG-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Privacy/terms/service contract/javobgarlik hujjatlari huquqiy tekshiruvdan o‘tgan; draftni final deb belgilamaslik.

  **Dalil:** `LEG-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LEG-01.04** — Qonun talab qiladigan moliyaviy yozuvlarni saqlash bilan shaxsiy ma’lumotni o‘chirish talabini moslashtirish.

  **Texnologiya:** Prisma retention/legal-hold, PostgreSQL pseudonymization, worker.

  **Bajarish:** Moliyaviy yozuvni saqlab, qonun ruxsat etgan shaxsiy fieldni anonymize/delete; FK tarixni buzmaydi. Backupdagi muddati va restoreda qayta maskalash.

  **Manba:** FULL_PROJECT_PLAN.md, 487-satr; vazifa №4 (LEG-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Retention/legal hold/delete/anonymize policy moliyaviy tarixni saqlaydi; sinov tenantda amaliy tekshiruv bor.

  **Dalil:** `LEG-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LEG-01.05** — Elektron chek, xizmat eslatmasi va reklama roziligini alohida qayd etish.

  **Texnologiya:** Prisma ConsentEvent, Next.js UI, notification service.

  **Bajarish:** Chek/xizmat/marketing uchun kanal va maqsad alohida; withdraw va dalil. Eslatma worker jo‘natish paytida joriy consentni qayta tekshiradi.

  **Manba:** FULL_PROJECT_PLAN.md, 488-satr; vazifa №5 (LEG-01).

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Electronic receipt/service/marketing consent alohida timestamp/source/withdrawal bilan saqlanadi.

  **Dalil:** `LEG-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **LEG-01.06** — Integratsiya, xosting va aloqa provayderlariga uzatiladigan ma’lumotlarni hujjatlashtirish.

  **Texnologiya:** Markdown processor registry, Prisma integration config audit.

  **Bajarish:** Provayderga qaysi field, nima uchun va qaysi regionga uzatilishi; least-data DTO. Shartnoma/retention va secret rotation egasi yoziladi.

  **Manba:** FULL_PROJECT_PLAN.md, 489-satr; vazifa №6 (LEG-01).

Bu bo‘limda ma’lumot lokalizatsiyasining barcha holatlar uchun bitta umumiy talabi taxmin qilinmaydi. Aniq huquqiy doira chiqarishdan oldin amaldagi rasmiy hujjatlar bilan tekshiriladigan vazifa sifatida qo‘yilgan.

  **Boshlash sharti:** Boshlang‘ich ish; boshqa guruhning to‘liq tugashini kutmaydi. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Har external providerga uzatiladigan fields/purpose/region/retention/contract data-flow reyestrida.

  **Dalil:** `LEG-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

### 16. Keyingi segmentlar uchun kengaytmalar [P2]

| Yo‘nalish | Qo‘shilishi kerak bo‘lgan ishlar | Texnologik yo‘l |
| --- | --- | --- |
| Restoran/kafe | Stol, zal, buyurtma, oshxona displeyi, retseptura, ingredient qoldig‘i, xizmat haqi va bo‘lib to‘lash | Mavjud React/Next.js + Prisma Table/Zone/Order/KitchenTicket/Recipe + Decimal ingredient ledger. Oshxona displeyi avval PWA polling; xizmat haqi va split payment FIN qoidalaridan. Live push faqat latency ehtiyoji bo‘lsa T09. |
| Dorixona | Partiya/yaroqlilik, tegishli markirovka, maxsus katalog va ruxsat talablari, guruhga mos qoidalar | Prisma Batch/Expiry/MarkingCode/SpecialCatalog, Zod, LOC adapterlari va role checks. Maxsus ruxsat/retsept talabi tasdiqlansa alohida hujjat; dorixona compliance inson/provider bilan tekshiriladi. |
| Elektronika | Seriya raqami, kafolat, servis va bo‘lib to‘lash shartlari | Prisma SerialNumber/Warranty/ServiceOrder/InstallmentSchedule, CRM debt ledger. Kafolat/servis holati React ekran; bo‘lib to‘lashning huquqiy shartlari LEGda. Yangi framework yo‘q. |
| Ulgurji savdo | Tijoriy taklif, buyurtma, rezerv, yetkazish hujjati va korporativ narx | Prisma Quote/SalesOrder/Reservation/Delivery va customer PriceList, SQL locks, HTML hujjat. Reserve/partial shipment/due debt umumiy INV/CRM xizmatlarini qayta ishlatadi. |
| Onlayn savdo | Internet-do‘kon/marketplace, buyurtma, rezerv, yetkazish va bir xil qoldiq | Next.js storefront, Prisma Order/Reservation, native fetch marketplace/webhook adapter. Bir xil stock source, callback idempotency va payment/fiscal pipeline. Alohida commerce platforma faqat talab yopilmasa. |
| Ishlab chiqarish | Retsept/BOM, xomashyo, ishlab chiqarish hujjati, chiqit va tayyor mahsulot tannarxi | Prisma BOM/ProductionOrder/Consumption/Output/Waste, Decimal cost allocation va stock movements. Har ishlab chiqarish batchi xomashyo chiqimi/tayyor mahsulot kirimini transactionda; MES alohida zarurat bo‘lsa. |
| Katta tarmoq | Markaziy xarid, murakkab ombor, filial KPI, API integratsiya va kengaytirilgan vakolat | Prisma central purchase/warehouse/permission, PostgreSQL tuning/views va existing worker. Replica/partition/analytics store yoki orchestrator faqat o‘lchangan DB/yuklama/HA talabida T09/T10. |
| Analitika | Talab prognozi, qayta buyurtma, anomaliya va tavsiya; ma’lumot sifati yaxshilangandan keyin | PostgreSQL aggregates va TypeScript statistik baseline (moving average, seasonal, anomaly thresholds). MAE/WAPE va biznes foydasi baholanadi; murakkab model baseline yetmagani isbotlansa alohida ML vositasi. |

Bu yo‘nalishlarning hammasini birinchi chiqarishga majburiy qo‘shish ish hajmini cheksiz kengaytiradi. Har biri mijoz segmenti va mustaqil qabul mezoni bilan alohida release bo‘ladi.

### 17. Amalga oshirish bosqichlari va bog‘liqliklar

| Bosqich | Vazifalar | Tugaganini qanday bilamiz? | Texnologik yo‘l |
| --- | --- | --- | --- |
| 0. Bozor va chegaralar | MKT-01, fiskal yo‘l, qurilmalar, tarif modeli, boshlang‘ich yuklama | Pilotlar va yozma talablar; chiqarish doirasi aniq | Markdown/CSV mijoz tadqiqoti, provider/qurilma matritsasi, ADR; MKT/LOC/HW/BIZ. |
| 1. Ishonchli poydevor | FIX-01, SEC-01/02, DATA-01, OPSning boshlang‘ich qismi | Xavfsizlik/tur/build xatolari yopilgan, ma’lumot chegaralari testdan o‘tgan | Next.js DAL, TypeScript/Zod, Prisma schema/Migrate, PostgreSQL constraints, Docker/CI; FIX/SEC/DATA. |
| 2. Asosiy biznes hisobi | POS-01, RET-01, INV-01, CRM-01, FIN-01, REP-01 P0 | Savdo → qaytarish → qoldiq → pul → hisobot sonlari mos | Prisma.Decimal, PostgreSQL transactions/ledgers/idempotency, Node tests; POS/RET/INV/CRM/FIN/REP. |
| 3. Bozorga tayyor modullar | POS-02, CAT-01, INV-02, PUR-01, UX-01, LOC/HW | Pilot talabidagi funksiyalar va real qurilmalar ishlaydi | React/Tailwind, Prisma katalog/xarid, T02/T03, provider adapter T08, qurilma transporti T05 zarur bo‘lsa. |
| 4. Uzilish va ekspluatatsiya | OFF, to‘liq OPS, QA, LEG, support/onboarding | Yuklama, restore, uzilish va provider sinovlari o‘tgan | IndexedDB/PWA, Node worker/PG jobs, Docker, backup T10/T12, Playwright T04, tashqi monitoring T11. |
| 5. Cheklangan pilot | Real mijozlar, kunlik solishtirish, feedback va tuzatish | Kelishilgan pilot mezonlari bajarilgan | Real qurilmalar/providerlar, PostgreSQL reconciliation, support tickets, rollback runbook. |
| 6. Ommaviy production | Tijoriy paket, yordam, monitoring, chiqarish tartibi | Quyidagi yakuniy checklist to‘liq | Release artefakt, CI dalillari, monitoring/on-call, billing/onboarding va policy versiyalari. |
| 7. Kengaytirish | CRM P2, maxsus segment, qo‘shimcha provider/API | Mijoz talabi va alohida qabul sinovi bilan chiqariladi | Mavjud servicesni qayta ishlatish; yangi vosita faqat T01–T14 qaror qoidasi va segment talabi bilan. |

Asosiy bog‘liqliklar:

- Ruxsat va ma’lumot yaxlitligi → savdo/ombor → qaytarish/qarz → ishonchli hisobot.
- Katalog va soliq modeli → fiskal/markirovka integratsiyasi.
- Yagona amal kaliti va qayta tiklash → provider integratsiyasi → to‘liq offline.
- Versiyalangan migratsiya va backup → pilot bazasini xavfsiz yangilash.
- Mijoz jarayonlari tasdiqlanishi → segment funksiyalari → tijoriy paket.

Aniq muddat jamoa, provayderga kirish va pilot talablaridan keyin belgilanadi. Har bosqichni vaqt tugagani uchun emas, qabul mezoni bajarilgani uchun yopish kerak.

### 18. Pilot va productionga chiqish shartlari

#### Pilot tavsiyasi

- [ ] **PILOT-01.01** — Kamida uchta biznesda kelishilgan savdo hajmi va qurilmalar bilan sinash.

  **Texnologiya:** Markdown pilot registry, PostgreSQL real tenant scope.

  **Bajarish:** Uch biznesning qurilma/savdo doirasi va mas’ullari; texnik testdan keyin nazoratli go-live. Rozilik va fallback jarayoni tayyor.

  **Manba:** FULL_PROJECT_PLAN.md, 535-satr; vazifa №1 (PILOT-01).

  **Boshlash sharti:** MKT-01, OFF-01, HW-01, UX-01, OPS-02, OPS-03, OPS-04, QA-01, BIZ-02, LEG-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Kamida 3 real biznes uchun scope/hajm/qurilma/mas’ul/test boshlanishi va kelishuv dalili bor.

  **Dalil:** `PILOT-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **PILOT-01.02** — Kamida ikki hafta odatiy savdo; oy/davr yopilishi ssenariysini ham alohida tekshirish.

  **Texnologiya:** Pilot calendar/runbook, Next.js reports.

  **Bajarish:** Ikki hafta normal oqim va davr yopilishi; faqat sana o‘tganiga emas, barcha majburiy ssenariylar bajarilganiga qarab yakunlash.

  **Manba:** FULL_PROJECT_PLAN.md, 536-satr; vazifa №2 (PILOT-01).

  **Boshlash sharti:** MKT-01, OFF-01, HW-01, UX-01, OPS-02, OPS-03, OPS-04, QA-01, BIZ-02, LEG-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Kamida 14 kun real kundalik savdo jurnali va alohida month-end/period-close sinovi mavjud.

  **Dalil:** `PILOT-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **PILOT-01.03** — Har kuni savdo, pul, qarz, qoldiq va fiskal/to‘lov natijalarini solishtirish.

  **Texnologiya:** PostgreSQL reconciliation jobs, React pilot dashboard.

  **Bajarish:** Har kuni cash/debt/stock/fiscal/payment mismatches tekshirish; farq dalili va resolution audit. Owner bilan kunlik tasdiq.

  **Manba:** FULL_PROJECT_PLAN.md, 537-satr; vazifa №3 (PILOT-01).

  **Boshlash sharti:** MKT-01, OFF-01, HW-01, UX-01, OPS-02, OPS-03, OPS-04, QA-01, BIZ-02, LEG-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Har pilot kunida sale/cash/debt/stock/fiscal/payment reconcile dalili; farqlar sabab va resolution bilan.

  **Dalil:** `PILOT-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **PILOT-01.04** — Qaytarish, nasiya undirish, transfer, internet/printer uzilishi real yoki boshqariladigan sinovda bajarilishi.

  **Texnologiya:** Playwright, provider sandbox, actual hardware va uzilish runbook.

  **Bajarish:** Refund/debt/transfer/network/print ssenariylarini pilot xavfsiz doirada; test savdosini real tushumga aralashtirmaslik.

  **Manba:** FULL_PROJECT_PLAN.md, 538-satr; vazifa №4 (PILOT-01).

  **Boshlash sharti:** MKT-01, OFF-01, HW-01, UX-01, OPS-02, OPS-03, OPS-04, QA-01, BIZ-02, LEG-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Return/collection/transfer/network/print failure har biri real yoki boshqariladigan pilot protokolida o‘tgan.

  **Dalil:** `PILOT-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **PILOT-01.05** — Kassir va egasi fikri, yordam murojaatlari va sarflangan vaqtni qayd qilish.

  **Texnologiya:** Prisma Ticket yoki CSV feedback, performance timings.

  **Bajarish:** Kassir/egasi murojaatlari, yechish va amaliy vaqtni yig‘ish; muammo→task→retest bog‘lanishi.

  **Manba:** FULL_PROJECT_PLAN.md, 539-satr; vazifa №5 (PILOT-01).

  **Boshlash sharti:** MKT-01, OFF-01, HW-01, UX-01, OPS-02, OPS-03, OPS-04, QA-01, BIZ-02, LEG-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Cashier/owner feedback, tickets va time metrics yig‘ilgan; ustuvor tuzatishlar trackerga bog‘langan.

  **Dalil:** `PILOT-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **PILOT-01.06** — Ma’lumot yo‘qolishi, ruxsatsiz kirish va hal qilinmagan pul farqi bo‘lmasligi.

  **Texnologiya:** Automated tenant/ledger tests, incident review, backup verification.

  **Bajarish:** Data loss/access breach/unresolved money difference bo‘lsa release to‘xtaydi; sabab va qayta test dalili. Nol incidentni kuzatilgan muddat bilan ifodalash.

  **Manba:** FULL_PROJECT_PLAN.md, 540-satr; vazifa №6 (PILOT-01).

  **Boshlash sharti:** MKT-01, OFF-01, HW-01, UX-01, OPS-02, OPS-03, OPS-04, QA-01, BIZ-02, LEG-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + mahsulot egasi/tashqi mas’ul.

  **Bandning qabul mezoni:** Pilot bo‘yicha data-loss/unauthorized access/unresolved money mismatch nol; incident dalillari ko‘rib chiqilgan.

  **Dalil:** `PILOT-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

#### Yakuniy chiqarish checklisti

- [ ] **RELEASE-01.01** — Chiqarish doirasidagi barcha P0 va zarur P1 vazifalar yopilgan.

  **Texnologiya:** Markdown task ledger, CI release manifest.

  **Bajarish:** P0 va shu release uchun zarur P1larga task ID/dalil; conditional vazifaga scope va sabab yozish. Belgisiz tashlab ketish yo‘q.

  **Manba:** FULL_PROJECT_PLAN.md, 544-satr; vazifa №1 (RELEASE-01).

  **Boshlash sharti:** PILOT-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Scope manifestdagi barcha required P0/P1 done; blocked/in-progress required task yo‘q; deferred alohida.

  **Dalil:** `RELEASE-01.01` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **RELEASE-01.02** — Muhim hisob/ruxsat ssenariylari avtomatik va amaliy sinovdan o‘tgan.

  **Texnologiya:** Node test + Playwright + real device evidence.

  **Bajarish:** CI pass, actual biznes qabul natijalari va version/digest; barcha critical suite release branch uchun.

  **Manba:** FULL_PROJECT_PLAN.md, 545-satr; vazifa №2 (RELEASE-01).

  **Boshlash sharti:** PILOT-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Business/security avtomatik va amaliy test dalillari aynan release commitiga bog‘langan.

  **Dalil:** `RELEASE-01.02` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **RELEASE-01.03** — Qaytarish, nasiya, xarid va smena hisoblari bir-biriga mos.

  **Texnologiya:** PostgreSQL cross-ledger reconciliation.

  **Bajarish:** Refund/debt/purchase/shift testlarining pul/qoldiq/summa farqi nol; snapshot va formulas versiyasi dalili.

  **Manba:** FULL_PROJECT_PLAN.md, 546-satr; vazifa №3 (RELEASE-01).

  **Boshlash sharti:** PILOT-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Return/debt/purchase/shift ledger/report reconciliation nol tushuntirilmagan farq bilan.

  **Qabul (2026-10-11):** `done` — ichki cross-ledger mezoni isolated actual business-service ssenariysi va68moliyaviy regressiya bilan tekshirildi. Real PILOT/production va butun RELEASE qabuli ochiq. [Dalil](evidence/release-ledger-20261011.json).

  **Dalil:** `RELEASE-01.03` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **RELEASE-01.04** — Fiscal/markirovka talabi tegishli mijozlar uchun bajarilgan.

  **Texnologiya:** Provider certification/sandbox/real fiscal proof T08.

  **Bajarish:** Shu segment uchun fiscal/marking talablari va uzilish yo‘riqnomasi tasdiqlangan; actual provider evidence.

  **Manba:** FULL_PROJECT_PLAN.md, 547-satr; vazifa №4 (RELEASE-01).

  **Boshlash sharti:** PILOT-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Applicable fiscal/marking compliance va provider real tasdiqlari bor; sandbox-only final emas.

  **Dalil:** `RELEASE-01.04` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **RELEASE-01.05** — Tanlangan qurilmalar sinovdan o‘tgan va moslik ro‘yxati e’lon qilingan.

  **Texnologiya:** Markdown hardware matrix, physical QA.

  **Bajarish:** Model/OS/driver/firmware/sana va test natijasi e’lon; ishlamaydigan device qo‘llab-quvvatlanadi deb yozilmaydi.

  **Manba:** FULL_PROJECT_PLAN.md, 548-satr; vazifa №5 (RELEASE-01).

  **Boshlash sharti:** PILOT-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Tanlangan real device matritsasi acceptance dalili bilan e’lon qilingan.

  **Dalil:** `RELEASE-01.05` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **RELEASE-01.06** — Real backup tiklash, migratsiya va qaytish mashqi muvaffaqiyatli.

  **Texnologiya:** PostgreSQL restore, Prisma migration, Docker rollback drills.

  **Bajarish:** Qayta ishlatiladigan runbook, vaqt va ledger natijasi; backup fayli mavjudligi emas amaliy restore.

  **Manba:** FULL_PROJECT_PLAN.md, 549-satr; vazifa №6 (RELEASE-01).

  **Boshlash sharti:** PILOT-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Restore/migration/rollback mashqi release schema/image uchun o‘tgan va RPO/RTO yozilgan.

  **Dalil:** `RELEASE-01.06` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **RELEASE-01.07** — Kuzatish, ogohlantirish va javobgar yordam xodimi mavjud.

  **Texnologiya:** External monitoring T11, outbox alerts, on-call registry.

  **Bajarish:** Alarm kanali sinov xatoda yetib boradi va mas’ul acknowledgment qiladi; status sahifa mustaqil.

  **Manba:** FULL_PROJECT_PLAN.md, 550-satr; vazifa №7 (RELEASE-01).

  **Boshlash sharti:** PILOT-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** External monitoring/test alert/on-call mas’uli tayyor va real kanal tekshirilgan.

  **Dalil:** `RELEASE-01.07` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **RELEASE-01.08** — Yuklama natijalari va xizmat ko‘rsatish maqsadlari hujjatlashtirilgan.

  **Texnologiya:** Node load report va deployment service targets.

  **Bajarish:** p95/RPO/RTO/uptime shartlari, yuklama va hardware; sinov bilan tasdiqlanmagan kafolatni contractga yozmaslik.

  **Manba:** FULL_PROJECT_PLAN.md, 551-satr; vazifa №8 (RELEASE-01).

  **Boshlash sharti:** PILOT-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Load profile/p95/error rate/RPO/RTO/support targetlari dalil bilan hujjatlashtirilgan.

  **Dalil:** `RELEASE-01.08` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **RELEASE-01.09** — Import, boshlang‘ich hisob, trening va onboarding qo‘llanmasi tayyor.

  **Texnologiya:** Next.js help/wizard, Markdown training, T03 import.

  **Bajarish:** Import/opening/training qo‘llanmalari actual release bilan mos; yangi kassir mustaqil sinov jarayonidan o‘tgan.

  **Manba:** FULL_PROJECT_PLAN.md, 552-satr; vazifa №9 (RELEASE-01).

  **Boshlash sharti:** PILOT-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Import/opening account/training/onboarding qo‘llanmasi pilot foydalanuvchida tekshirilgan.

  **Dalil:** `RELEASE-01.09` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **RELEASE-01.10** — Xizmat shartlari, maxfiylik, tarif va eksport/o‘chirish siyosati tayyor.

  **Texnologiya:** Versioned policy docs, billing model, tenant export/retention.

  **Bajarish:** LEG/BIZ tasdiqlari, tarif va export sinovi; shartnoma biznes modeli bilan mos.

  **Manba:** FULL_PROJECT_PLAN.md, 553-satr; vazifa №10 (RELEASE-01).

  **Boshlash sharti:** PILOT-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Huquqiy tasdiqli terms/privacy/tarif/export/delete policy amaldagi versiya bilan.

  **Dalil:** `RELEASE-01.10` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [ ] **RELEASE-01.11** — Pilotta ochiq kritik yoki yuqori darajadagi xatolar qolmagan.

  **Texnologiya:** Prisma Incident yoki task register, regression suites.

  **Bajarish:** Ochiq severity high/critical qolmagan; har yopilgan xato reproduction va retest daliliga ega.

  **Manba:** FULL_PROJECT_PLAN.md, 554-satr; vazifa №11 (RELEASE-01).

  **Boshlash sharti:** PILOT-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Pilotdagi unresolved critical/high findings nol; severity va resolution qaydlari bor.

  **Dalil:** `RELEASE-01.11` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

- [x] **RELEASE-01.12** — Bozorga va’da qilinadigan har funksiya haqiqatan shu release’da ishlaydi.

  **Texnologiya:** Release capability registry va Next.js marketing.

  **Bajarish:** Har va’da→feature→acceptance proof mapping; conditional integrations va offline chegaralari foydalanuvchiga aniq.

  **Manba:** FULL_PROJECT_PLAN.md, 555-satr; vazifa №12 (RELEASE-01).

  **Boshlash sharti:** PILOT-01. “Bog‘liqlikni talqin qilish” qoidasiga ko‘ra faqat shu band ishlatadigan contract/invariantlar tayyor bo‘lishi talab etiladi.

  **Mas’ul:** AI + zarur tashqi kirish/tasdiq uchun mahsulot egasi.

  **Bandning qabul mezoni:** Har market claim release feature/acceptance proofga mos; deferred/unavailable imkoniyat reklama qilinmaydi.

  **Dalil:** `RELEASE-01.12` task yozuvida tekshirilgan kirish, kutilgan/haqiqiy natija, test buyrug‘i yoki amaliy protokol, artefakt yo‘li va commit/versiya ko‘rsatiladi. “Status va umumiy tugallanish qoidasi” ham majburiy.

  **Qabul (2026-10-15):**44 typed public matn va ikki tarjima7 capability/9 immutable dalilga xaritalandi;5 render va4 display runtime fingerprinti CI’da fail-closed. Faol bo‘lmagan integratsiya/hardware/offline chegaralari ko‘rinadi. Tarif/trial faqat joriy DBdan; unavailable/no-trial CTA narx yoki sinovni uydirmaydi.161 unit,100 native PostgreSQL holati,33 core browser holati va alohida fresh-server3 timeout holati PASS; header joylashuvidan keyin6 public holat360/1280pxda qayta PASS (takror6 alohida original yoki unique case hisoblanmaydi). ICU grouping va public-only PWA v4 regressiyasi tekshirildi. Build/lint/worker/i18n/source scan o‘tdi. Dalil: `tasks/evidence/public-claims-release-20261015.json`, source `047c49e`+hashed accepted-source.patch, ADR095. API/schema/migration o‘zgarmadi. Bu band shu local candidate ommaviy va’dalari haqidagi acceptance; real pilot/deployment/vendor/hardware gate’lari ochiq. Original hisob175→176.

### 19. Har bir vazifani qanday yuritamiz?

Yuqoridagi har bir ID alohida task/issuega ajratiladi. Unda quyidagilar yoziladi:

1. Muammo va foydalanuvchi uchun natija.
2. P0/P1/P2, qaysi segment/release uchun majburiyligi.
3. Ekran, API, ma’lumot modeli va hisobga ta’siri.
4. Bog‘liq vazifalar va tashqi provayder talablari.
5. Normal, xato, parallel va qayta urinish holatlari.
6. Qabul mezoni, test, migratsiya va chiqarishdan qaytish tartibi.
7. Mas’ul, baholangan ish hajmi, holat va bajarilganini tasdiqlovchi dalil.

Tavsiya etilgan holatlar: **rejalashtirilgan → tayyor → bajarilmoqda → tekshiruvda → pilotda → tugallangan**. Kod yozilgani vazifa tugallanganini bildirmaydi; qabul mezoni, hisob mosligi va ishlatish yo‘riqnomasi ham bajarilishi kerak.

### 20. Manbalar va xulosalarning chegarasi

Loyiha holati [PROJECT.md](./PROJECT.md)dan olindi; yangi to‘liq kod auditi bajarilmadi. Bozor yo‘nalishi, ustuvorliklar, pilot sonlari va texnik maqsadlar ushbu loyiha uchun tavsiyalardir, tadqiqot bilan tasdiqlangan bozor statistikasi emas.

Tashqi manbalar 2026-yil 5-oktabrda ko‘rib chiqildi:

- [Odoo POS funksiyalari](https://www.odoo.com/app/point-of-sale-features) — POS imkoniyatlari uchun solishtirish nuqtasi.
- [Loyverse funksiyalari](https://loyverse.com/features) — chakana POS modullari uchun solishtirish nuqtasi.
- [Loyverse xodim boshqaruvi](https://loyverse.com/en-us/employee-management) — xodim/do‘kon ruxsatlari haqida mahsulot manbasi.
- [Loyverse advanced inventory](https://loyverse.com/en-us/advanced-inventory) — ombor va xarid imkoniyatlari haqida mahsulot manbasi.
- [Kassa texnikasidan foydalanish bo‘yicha Adliya maslahat portali](https://advice.adliya.uz/oz/document/1341) — mahalliy fiskal ish doirasini aniqlash uchun tushuntirish.
- [Asl Belgisi chakana savdo yo‘riqnomasi](https://help.crpt-turon.uz/hc/uz/articles/4459895684625-Ishni-boshlash-Chakana-savdo-uchun-markirovkalashni-amalga-oshirish-bosqichlari) — tegishli tovarlar uchun markirovka jarayoni.

Provayder APIlari, mahsulot guruhlariga tatbiq etiladigan talablar va huquqiy shartlar amalga oshirish/chiqarish vaqtida qayta tekshiriladi. Bu reja productionga yetishish ishlarini belgilaydi; barcha integratsiyalar mavjud yoki kelishilgan deb hisoblamaydi.

## Ishlarni texnik jihatdan tartiblash

Avval AuthorizedContext/DTO, Decimal hisoblash, ledger, operationId, transactional outbox, Job va test fixture kabi umumiy poydevorlar bajariladi. Keyingi modullar shu xizmatlarni qayta ishlatadi. Bitta amal uchun UI, API, DB constraints, audit va qabul testi bir vertikal vazifa sifatida yuritiladi.

Migratsiya → ma’lumot backfill/solishtirish → server xizmatlari → UI → parallel/retry sinovi → staging → pilot tartibi. Providerga ulanish uchun API/shartnoma va device test uchun actual uskuna kelishini dependency sifatida yozish kerak.

Manbadagi task andozasiga qo‘shimcha majburiy maydonlar: mavjud texnologiya bilan yechim; yangi dependency kerak bo‘lsa T-ID va cheklov dalili; tanlangan versiya/litsenziya; API/DB/UI/audit ta’siri; test; migratsiya va rollback; runtime xarajati va kuzatish. Texnologiya tanlanganini implementatsiya bajarilgan deb belgilamaslik.

## Qamrovni tekshirish natijasi

AIga moslashtirish tahririda **259/259 original band saqlandi**; har biriga boshlash sharti, mas’ul, individual qabul mezoni va dalil talabi qo‘shildi. 35 guruhning minimal dependency xaritasida sikl yo‘q; barcha Markdown jadvallari ustun/separator bo‘yicha tekshirildi. Bu hujjat yaxlitligi tekshiruvi, ilova funksiyalari bajarilgani haqidagi dalil emas. Tashqi qaror/kirish/tasdiqlar ochiq kutish holati bilan boshqariladi.

Manbadagi **259 ta checklist bandining barchasiga texnologiya va bajarish usuli berildi**. Jami **35 guruh**; har original matn shu hujjatda saqlangan. Model/segment/test/bosqich jadvallari ham texnologik ustun bilan kengaytirildi.

| Guruh | Manbadagi bandlar | Texnologik bandlar |
| --- | ---: | ---: |
| MKT-01 | 6 | 6 |
| FIX-01 | 10 | 10 |
| SEC-01 | 7 | 7 |
| SEC-02 | 9 | 9 |
| USR-01 | 6 | 6 |
| POS-01 | 8 | 8 |
| POS-02 | 9 | 9 |
| RET-01 | 8 | 8 |
| CAT-01 | 9 | 9 |
| INV-01 | 7 | 7 |
| INV-02 | 7 | 7 |
| PUR-01 | 6 | 6 |
| CRM-01 | 7 | 7 |
| CRM-02 | 5 | 5 |
| FIN-01 | 7 | 7 |
| FIN-02 | 7 | 7 |
| REP-01 | 11 | 11 |
| LOC-01 | 9 | 9 |
| LOC-02 | 5 | 5 |
| LOC-03 | 6 | 6 |
| OFF-01 | 5 | 5 |
| OFF-02 | 7 | 7 |
| HW-01 | 6 | 6 |
| UX-01 | 9 | 9 |
| DATA-01 | 10 | 10 |
| OPS-01 | 8 | 8 |
| OPS-02 | 6 | 6 |
| OPS-03 | 6 | 6 |
| OPS-04 | 6 | 6 |
| QA-01 | 9 | 9 |
| BIZ-01 | 7 | 7 |
| BIZ-02 | 7 | 7 |
| LEG-01 | 6 | 6 |
| PILOT-01 | 6 | 6 |
| RELEASE-01 | 12 | 12 |
| **Jami** | **259** | **259** |

Qo‘shimcha jadval qamrovi: ma’lumot tuzilmalari **14**, maxsus segmentlar **8**, majburiy biznes sinovlari **12**, amalga oshirish bosqichlari **8**. Umumiy mahsulot maqsadlari, bog‘liqliklar, task yuritish talablari va chiqarish shartlari manbadan saqlandi.

Manba snapshoti SHA-256: `45e124bcc666e463ed6a3e74124c50d0be5732b3e63be8efe06f71e8c797e915`. Manba bandlari keyin qo‘shilsa/o‘zgarsa ushbu raqamlar va mapping qayta tekshiriladi; eski raqamlar avtomatik yangi rejaning to‘liqligini bildirmaydi.

## Texnik tanlovlar uchun tekshirilgan manbalar

Next.js bo‘yicha o‘rnatilgan versiyaning mahalliy yo‘riqnomalari o‘qildi:

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — API kirish nuqtalari va cache xulqi.
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md` — DAL, DTO va serverdagi vakolat nazorati.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` — async cookie o‘qish/yozish.
- `node_modules/next/dist/docs/01-app/02-guides/server-and-client-boundary.md` — server/client chegarasi.
- `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` — manifest/PWA.
- `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md` — self-host va ingress.
- `node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md` — browser test.
- `node_modules/next/dist/docs/01-app/02-guides/instrumentation.md` — startup/instrumentation.

Quyidagi rasmiy/loyiha egasining manbalari texnologik imkoniyatlarni tekshirish uchun; ularning yangi versiya misollari o‘rnatilgan paket APIlarini avtomatik almashtirmaydi:

- [PostgreSQL 15 locking](https://www.postgresql.org/docs/15/explicit-locking.html) — lock imkoniyatlari; biznes lock tartibi ushbu loyiha uchun alohida dizayn.
- [PostgreSQL 15 row security](https://www.postgresql.org/docs/15/ddl-rowsecurity.html) — RLS imkoniyatlari va owner/bypass chegarasi.
- [PostgreSQL 15 indekslar](https://www.postgresql.org/docs/15/indexes.html) — mavjud DBni optimallashtirish yo‘li.
- [PostgreSQL 15 PITR](https://www.postgresql.org/docs/15/continuous-archiving.html) — base backup+WAL; pg_dump continuous recovery o‘rnini bosmaydi.
- [Node.js LTS qatorlari](https://nodejs.org/en/about/previous-releases) — qo‘llab-quvvatlanadigan runtime tanlovi.
- [Node.js test runner](https://nodejs.org/download/release/v20.19.0/docs/api/test.html) — mavjud runtime test/assert yo‘li; ishda tanlangan LTS yo‘riqnomasi tekshiriladi.
- [Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext) — browser va offline test imkoniyati.
- [ExcelJS loyiha manbasi](https://github.com/exceljs/exceljs) — XLSX/CSV vazifasiga maxsus kutubxona.

Prisma transaction/Decimal imkoniyatlari mahalliy `@prisma/client` typesida ham tekshirildi. Qo‘shimcha kutubxona/providerga oid aniq patch, API, litsenziya va xavfsizlik holati implementatsiya oldidan qayta tekshiriladi. Hech bir T-ID texnologiya allaqachon o‘rnatilganini, hisob ochilganini yoki tashqi xizmat sotib olinganini bildirmaydi; implementatsiya statusi alohida dalil bilan yuritiladi.

## +10 qabul dalili — 2026-10-06

POS-01.06, POS-02.07, OFF-01.03, OFF-01.05, FIN-01.02, FIN-01.04, CRM-01.05, CRM-01.07, HW-01.05 va QA-01.03 qabul qilindi:63→73 done. Har bir bandning kirishi, kutilgan/haqiqiy natijasi, versioned test/migration, test buyrug‘i va source versiyasi [EXECUTION_STATUS.md](EXECUTION_STATUS.md) ichidagi “+10: checkout, smena, qarz va brauzer qabul” checkpointida. Real vendor/hardware va pilot qabul qilinmagan; legacy debt provenance yetishmasa reconciliation zarur.
