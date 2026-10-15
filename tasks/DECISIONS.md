# Implementatsiya qarorlari

## ADR-001 — mavjud stack va izolyatsiyalangan testlar

2026-10-05. Next16/React19/Prisma5/PostgreSQL15 saqlanadi. Node24 mahalliy runtime mavjud; Docker Node22 bilan boshlanadi va compatibility testlanadi. Node test/assert ishlatiladi; TypeScript testlar uchun mavjud tsc orqali CommonJS test chiqishi yaratiladi. PostgreSQL testlari alohida konteyner/baza: production/dev bazadan nusxa olinmaydi. Migratsiyalar ilova startupidan alohida deploy bosqichi.

## Ochiq tashqi qarorlar

- Fiskal/payment/SMS/e-mail providerlari va rasmiy sandbox contractlari.
- Data-location/retention va tegishli compliance tasdig‘i.
- Real device matritsasi va pilot bizneslar.
- Tarif/SLA/on-call mas’uli.

## ADR-002 — foydalanuvchi belgilagan integratsiya chegarasi

2026-10-05. Click tanlangan, real API keyingi alohida topshiriqda. Fiskalizatsiya/E-POS, Click, real printer/tarozi/maxsus scanner/cash drawer vendor implementatsiyasi hozir scope tashqarisida. Mavjud brauzer print/keyboard skaner funksiyasi saqlanadi. PaymentProvider/FiscalProvider/ReceiptPrinter/Scale/BarcodeScanner/CashDrawer faqat aniq interface; vendor endpoint, SDK va payload taxmin qilinmaydi. Tashqi qarorlar core kodlashni to‘xtatmaydi.

## ADR-003 — manual ledger va deploy/recovery chegaralari

2026-10-05. `/api/payments` POST faqat managerning ochiq smenadagi izohli manual yozuvi: UUID idempotency, transaction, audit. Sale/customer/credit bog‘lash bu endpointda taqiqlanadi; sale completion, debt collection va return o‘z iqtisodiy xizmatlari orqali yuradi. `recorded` provider settlement degani emas.

Checkout tannarxni yakunlanish paytida snapshot qiladi. Serializable snapshot advisory lockdan oldin olingan bo‘lishi mumkin: faqat Operation(organizationId,type,key) unique conflict butun transaction rollbackidan keyin qayta urinadi; boshqa business duplicate retry qilinmaydi.

Compose DB portini tashqariga chiqarmaydi; private secret env, non-root app, alohida migration job. Production HTTPS APP_ORIGIN majburiy. GPG public key orqali backup, bo‘sh tasdiqlangan DBga transaction restore; real off-site scheduler/PITR hali infrastructure qarori. Core release hali productionga tayyor deb belgilanmagan.

## ADR-004 — Node 24 runtime

2026-10-05. Dockerning haqiqiy install bosqichi mavjud lockfiledagi `@zxing/library@0.23.0` Node >=24 talab qilishini ko‘rsatdi. Browser skanerni sababsiz almashtirmasdan mavjud stackni saqlash uchun Docker/CI/local engines Node24ga birlashtirildi; `.npmrc` engine-strict install vaqtida mos kelmaslikni rad etadi. ADR-001 dagi dastlabki Node22 tanlovi shu dalil bilan yangilandi.

## ADR-005 — browser E2E

2026-10-05. Moliyaviy va PostgreSQL testlari mavjud Node test/assert bilan saqlanadi. Haqiqiy browser cookie, IndexedDB basket recovery va UI oqimlarini Node assert tekshira olmaydi; PLAN1 T04dagi Playwright faqat dev dependency sifatida qo‘shiladi. Nextning lokal Playwright qo‘llanmasi va [rasmiy konfiguratsiya](https://playwright.dev/docs/test-configuration)/[webServer](https://playwright.dev/docs/test-webserver) hujjatlari o‘qildi. Faqat localhost `pos_test` bazasi ishlatiladi; real hisob/credential/browser profili testga kiritilmaydi.

## ADR-006 — dependency patch va audit chegarasi

2026-10-05. Next16.3.4 →16.3.8 va eslint-config-next16.3.8; semver-compatible transitiv patchlar `npm audit fix` orqali, `--force` ishlatilmagan. [Rasmiy advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) Next16.3.6 patchini ko‘rsatadi; loyiha Node ImageResponse ishlatmaydi, lekin package patchlanadi.

Auditda ESLintning development glob zanjiridagi [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) qolishi mumkin: registrydagi braces3.0.3 uchun hozir patch yo‘q. Next16 ESLintni14 versiyaga majburan tushirish API/regressiya xavfi sabab qilinmaydi. Bu topilma yashirilmaydi; runtime `--omit=dev` audit alohida tekshiriladi, CI timeout bilan cheklanadi. ESLint production standalone runnerda ishlatilmaydi. Upstream patch chiqqanda dev zanjiri qayta yangilanadi.

## ADR-007 — yuborilmagan savdo urinishini bekor qilish

2026-10-05. `Operation.state=cancelled` aynan original sale.create idempotency slotini band qiladi. Kechikkan serializable posting shu unique slot bilan to‘qnashib, yangi transactionda terminal bekor holatini ko‘radi; savdo/stock/payment yaratmaydi. Original actor va payload hash mos bo‘lishi shart. Allaqachon yaratilgan draftni bu xizmat o‘zgartirmaydi: mavjud manager-only void ruxsati saqlanadi. Parallel cancellation/posting PostgreSQL sinovi o‘tdi. Browser E2E haqiqiy commitdan keyin HTTP javobni uzib, reload va operation recovery orqali aynan bitta sale/payment/stock effektini tasdiqladi.

## ADR-008 — ombor reversal va transferni qaytarish

2026-10-05. Tasdiqlangan StockDocument va uning satrlari DB trigger bilan edit/delete/adddan himoyalanadi; tashkilotni to‘liq o‘chirishdagi FK cascade bundan alohida. Reversal originalga unique linkli yangi confirmed hujjat, manfiy original quantitylar va alohida movement/audit bilan yaratiladi. Xarid reversalida moving-average inverse qo‘llanadi; saqlangan checkout tannarxi o‘zgarmaydi. Yetarli qoldiq yoki nonnegative cost qiymati bo‘lmasa butun transaction rad etiladi; negative-stock policy reversal orqali yangi kamomad yaratmaydi.

Transfer: draft cancellation stockni o‘zgartirmaydi. Sentdan keyin faqat unreceived transit qismi manba omborga operator tasdig‘i bilan qaytariladi; receivedQuantity + returnedQuantity ≤ quantity DB constraint. Barcha miqdor qabul/qaytarilganida holat closed; qabul qilingan mahsulotlar uchun yangi teskari transfer ishlatiladi. Return operationning idempotent yozuvi, stock journal va reason/actorli audit qaytarish dalilini saqlaydi. Parallel receive/return aynan bitta iqtisodiy effekt beradi. Vendor/hardware implementatsiyasi kiritilmagan.

## ADR-009 — inventarizatsiya checkpointi va tanlangan SKU freeze

2026-10-05. Mavjud Prisma/PostgreSQL/React stack: StockCount, StockCountLine, append-only StockCountReading va StockFreeze. To‘liq sanash boshlanish paytidagi active katalog + nonzero inactive stock snapshotini oladi; qisman sanash tanlangan mahsulotlarni oladi. Bir sessiya 1–2000 SKU; kattaroq katalog qismlarga bo‘linadi, limit UI/APIda aniq ko‘rsatiladi.

Tanlangan store/product logical freeze counting/review davomida amal qiladi; UI vaqtida ochiq DB transaction/row lock saqlanmaydi. Common movement service qisqa advisory lock va freeze tekshiradi; count boshlanishidagi balance version write eski serializable posting snapshotini retry qilishga majbur qiladi. DB trigger frozen balance insert/update/deletega yo‘l qo‘ymaydi. Unselected SKUlar savdosi davom etadi. Full count boshqa do‘konlarni bloklamaydi; boshlanishdan keyingi yangi SKUlar checkpointga kirmaydi.

Blind counting DTO expectedQuantity/unitCostni counting statusida bermaydi; reviewda manager farqni ko‘radi. Har reading round, actor, quantity va timestamp bilan alohida saqlanadi. Nonzero farq kamida ikki reading talab qiladi. Manager reason bilan tasdiqlaganda bitta linked confirmed adjustment + stock journal + audit yaratiladi; zero farqda adjustment yaratilmaydi. Cancel quantityni o‘zgartirmasdan freeze olib tashlaydi. Freeze avtomatik muddati tugab ochilmaydi: boshqa manager aktiv ro‘yxatdan countni tugatadi yoki sabab bilan bekor qiladi.

Migration013/014 scope/history/quantity/actor cheklovlari va terminal decision guard beradi. Completed countga yangi reading ham DBda rad. Full/partial, blind, recount, approval replay, parallel checkout va unselected SKU savdosi integrationda; UI butun oqimi HTTPS Chromiumda tekshirildi. Backup smoke endi active count, reading va freeze holatini ham qayta tiklaydi.

## ADR-010 — mijoz qarz hujjati va write-off refund hisobi

2026-10-05. Mavjud DebtEntry append-only ledger saqlanadi; opening_debt, debt_adjustment, write_off va write_off_reversal source turlari. Sabab/UUID, actor, effectiveAt va ixtiyoriy dueAt saqlanadi; eski effectiveAt createdAtdan backfill, eski actor/dueAt taxmin qilinmaydi. Customer ledger account tashkilot bo‘yicha umumiy: to‘liq ko‘chirma va manual tuzatishlar ownerga beriladi, branch bilan cheklangan admin vakolati kengaytirilmaydi. Oddiy debt collection avvalgi route/shift ruxsatlarini saqlaydi.

Opening/increase umumiy (saleId=null) qarzga; decrease shu guruh mavjud qoldig‘idan oshmaydi. Write-off original sale yoki umumiy guruh mavjud qarzini kamaytiradi; cash/bank Payment yaratilmaydi. Eski yozuv edit/delete qilinmaydi, yangi hujjat + transaction audit ishlatiladi. Customer FK NO ACTION deferred: alohida mijoz qarz tarixi bilan o‘chirilmaydi, organization cascade esa append-only guardni chetlab tarixni boshqa tashkilotga ta’sir qilmasdan olib tashlay oladi.

Refund uch komponentga ajratiladi: haqiqiy paid cash, outstanding credit va yozib chiqarilgan liability. Written-off qismdan cash refund yo‘q; return debt credit va write_off_reversal bir transactionda yozilib, qolgan write-off va customer debt to‘g‘ri saqlanadi. Oldingi checkout tannarxi/stock/refund idempotency oqimlari o‘zgarmaydi. Card/bank refund uchun mavjud tashqi settlement chegarasi saqlanadi.

Deterministic ledger source unique conflict Operation insertdan oldin chiqishi mumkin. runOperation faqat aynan organization/type/key uchun committed terminal Operation mavjudligini isbotlaganida fresh transaction bilan retry qiladi; live auth/actor/payload yana tekshiriladi. Business duplicate uchun bunday record bo‘lmasa conflict saqlanadi. Parallel opening va no-operation duplicate alohida sinovlardan o‘tdi.

Ko‘chirma PostgreSQL repeatable-read, Decimal aggregate va window running balance bilan filtr/davrdan mustaqil hisoblanadi; summa oddiy joriy sahifadan olinmaydi. UI opening/write-off va cash collection javobi commitdan keyin uzilganda shu immutable payload/key bilan qayta olishni tekshiradi. Kredit dueAt API optional; belgilamagan eski/current debt uchun muddat noma’lum. To‘liq customer purchase activity/advance/aging/export va opening hujjatlariga individual collection allocation keyingi CRM ishlarida qoladi.

## ADR-011: mavjud stackda bounded CSV va audit tarixining o‘zgarmasligi

2026-10-06. Catalog/customer/sales report/product report eksportlari yangi paket yoki worker qo‘shmasdan Prisma/PostgreSQL repeatable-read va browser Blob bilan bajariladi. Filtrlangan to‘liq natija count orqali10000 bilan chegaralanadi; limit oshsa413, qisman fayl yo‘q. Text quote/newline/formula himoyasi mavjud CSV helperdan, moliyaviy numeric cells Decimaldan; floating-point hisob yo‘q. Report eksportlari umumiy10/min budget; oddiy report60/min budget ham saqlangan. XLSX va katta background eksport ehtiyoji alohida implementatsiyada baholanadi.

AuditLog runtime UPDATE/DELETE migratsiya016 triggeri bilan taqiqlanadi. Haqiqiy actor User o‘chirilganda FKning actorId→null anonimlashtirishi va butun Organization cascade cleanup saqlanadi; oddiy actor edit yoki hujjat delete taqiqlanadi. Organization/time/id index query scopega mos. Readiness016ni talab qiladi; production rolloutda migrate deploy oldin bajariladi. Table owner/superuser vakolatlarini cheklash hosting/DB role siyosatiga tegishli; trigger uning o‘rnini bosmaydi.

Chek58/80mm browser print/PDF uchun DOMdan alohida iframe hujjati yaratiladi. UI printer muvaffaqiyatini da’vo qilmaydi; detail reprint CHEK NUSXASI/FISKAL EMAS deb belgilanadi va Sale/Paymentga yangi posting qilmaydi. Vendor protokoli/SDK yozilmaydi. POS keyboard shortcuts ham faqat UI holatini boshqaradi, automatic payment yubormaydi.

## ADR-012: soft archive, scoped journal exports va print-request audit

2026-10-06. Mavjud `isActive` holati mahsulot/mijoz/kategoriya/supplier arxivi uchun ishlatiladi; yangi arxiv jadvali yoki o‘chirish mexanizmi qo‘shilmaydi. Default active list kontrakti saqlanadi, manager explicit archived/all ko‘radi. Arxivlash savdo, qarz, xarid va ombor tarixini o‘chirmaydi; kategoriya arxivi mahsulotlarni o‘zgartirmaydi. Customer archiving `FOR UPDATE` va ledger net balansini bir tranzaksiyada tekshiradi, shuning uchun mavjud shu lockdan foydalanuvchi debt posting bilan arxivlash bir-birini bosib ketmaydi. Net qarz yoki avans nol bo‘lmasa arxivlash bloklanadi.

Supplier, stock movement, shift va owner-only minimal audit eksportlari ADR-011dagi mavjud CSV/Prisma/Blob imkoniyatlarini kengaytiradi. Har biri filtrlangan to‘liq snapshot, cap10000, atomic rate budget bilan. Movement nomi/birligi joriy katalogdan, delta/cost tarixiy journal qiymatlaridan; shift yopilish summalari frozen Shift qiymatlaridan olinadi. Ochiq smenaga yopilish natijasi taxminan hisoblanmaydi. Audit eksportida payload/IP yo‘q. Yangi dependency, schema/migration yoki vendor API kerak emas.

Receipt print-request moliyaviy operatsiya emas, lekin uning auditi ham existing `runOperation` orqali Serializable/idempotent bo‘ladi. Original request key width/copy/sale bilan bog‘langan; ayni urinish takrorlansa audit bir marta. UI captured receipt markup va keyni in-memory retry uchun saqlaydi; moliyaviy offline navbatga kiritmaydi. Reload yangi explicit print-requestga ruxsat beradi. Browser print/PDF faqat so‘rov; fizik chop etish yoki fiskal settlement tasdig‘i da’vo qilinmaydi.

## ADR-013: katalogni sahifalash, supplier xarid tarixi va aniq eksport qiymatlari

2026-10-06. Mavjud Category/Unit/ProductBarcode va StockDocument/StockTransfer/InventoryBalance modellari kengaytiriladi; yangi schema yoki dependency yo‘q. Unit/barcode eski default200 readlari compatibility uchun qoladi, lekin yangi management UI explicit20/50 page, search va snapshot count orqali 200 dan keyingi qatorlarga yetadi. Kategoriya legacy active array ham saqlanadi. Bu kategoriya daraxti, unit conversion, label encoder yoki hardware scanner implementatsiyasi emas.

Supplier kartasi va xarid hujjatlari tarixi umumiy StockDocument manbasidan. History createdAt bo‘yicha filtrlanadi; tegishli branch scope saqlanadi. Supplier history CSV umumiy stock-document eksportini shu supplierId/filtrlar bilan qayta ishlatadi. Qayta ko‘paytirilgan hisobot hisoblash kodi yoki tashqi settlement jadvali kerak emas. Supplier qiymat yig‘indisi faqat confirmed purchase va ularga tegishli confirmed reversal hujjatlarini qamraydi; har event o‘z createdAt davrida. Draft va boshqa adjustmentlar bu subtotalga kirmaydi. Bu pul/debt ledgeri emas; tijorat shartlari/to‘lov/qarz keyingi PUR ishlari. History va summary alohida request snapshotlar, UI bir vaqtda olingan degan da’vo qilmaydi.

Hujjat va transfer CSV bir itemga bir row. Rows cap10000 parent soni bilan birga children+empty-parent count bo‘yicha qo‘llanadi;21 hujjat×500 qator max10000dan oshsa eksport413 bilan tugaydi. Default UI paging eksportni qisqartirmaydi; text formula himoyasi, original/reversal link, UTC time label, qty/cost6 va Decimal value2 saqlanadi. Draft/cancelled transfer “unallocated” miqdori avtomatik transit stock deb yozilmaydi.

Supplier value SQLda har line quantity×cost2 kasrga ROUND qilib yig‘iladi, CSV row valuation ham xuddi shunday. Displayed gross−reversed=net har bir sentgacha mos. NUMERIC(20,6) operandsning ko‘paytmasi default Decimal20 precisiondan oshishi mumkin; eksport valuation/shortage lokal50-digit clone bilan aniq, global Decimal config o‘zgarmaydi. Balance SQL count/keys/ORM details bitta repeatable-read transactionda,500-key batch va linear Map; boshqa transactiondagi details race olib tashlandi. Real DB/deploy/vendor APIga tegilmaydi.

## ADR-014: posted receipt DB himoyasi, qayta vakolat tekshiruvi va isolated test guard

2026-10-06. Existing Next.js/Prisma/PostgreSQL/Zod/Decimal stack saqlanadi. `sale_history` va `sale_item_lock` yangi versioned migratsiyalar bo‘lib, oldingi applied SQL o‘zgartirilmaydi. Completed/partially_returned/returned Sale va SaleItem tarixini DB trigger himoyalaydi; child guard parentni lock qilib, concurrent checkoutdan keyingi statusni qayta tekshiradi. Qaytarish original snapshotga bog‘langan yangi hujjat; faqat mos return status transition ruxsatli. Product/store/register/shift cascade tarixni o‘chira olmaydi; existing organization cascade cleanup saqlanadi. Bu append-only ledgerlarda qo‘llangan arxivlash va tenant lifecycle chegarasini receiptga tatbiq etadi.

Duplicate product inputlar bitta SKU snapshotiga birlashtiriladi; original quantity precision tekshirilgandan keyingina qo‘shiladi. Quantity va item discount yig‘indisi schema chegarasi bilan tekshiriladi. Bir SKU uchun bitta rounding/snapshot/stock posting ishlatiladi, eski completed cheklar qayta hisoblanmaydi. Receipt allocation oldingi stable line-ID largest-remainder siyosatida qoladi. Checkout live role bilan discount policy qayta tekshiradi. Authorized price override yangi oqimi qo‘shilmagan; client price/cost/unit totals ishonchli manba bo‘la olmaydi.

Zod dirty union refinementda Decimal exception chiqarmasligi uchun amount/quantity va sale payment refinements invalid numericni false qaytaradi. API excessive discount/amountni 409 business conflict sifatida chiqaradi, schema invalid400 saqlanadi. Audit oxirgi yozuvini atayin rad etuvchi faqat test DB trigger bilan sale/payment/stock/operation rollback tekshiriladi; test function/trigger finallyda o‘chiriladi. Production fault-injection endpoint qo‘shilmaydi.

Integration runner compilation va ulanishdan oldin protocol/host/port/database/user allowlistni tekshiradi; URL/credential log qilinmaydi. Fayl-level guardlar saqlanadi. Fresh va legacy migration fixture, parallel stock/credit/shift, audit rollback, return rounding, child-lock race hamda HTTPS checkout recovery existing test vositalari bilan tekshiriladi. Yangi dependency yoki tashqi vendor implementatsiyasi yo‘q. Real biznes ma’lumoti clone sinovi, vendor/fiskal/hardware va real pilot ushbu lokal dalilning o‘rniga da’vo qilinmaydi.

## ADR-015: moliyaviy shared filter, append-only smena tuzatishi va qaytarma qiymati

2026-10-06. Next.js/React/Prisma/PostgreSQL/Zod/Decimal/IndexedDB/Playwright stack yetarli; yangi dependency/vendor SDK qo‘shilmadi. Report summary DB aggregate/parameterized SQL orqali hisoblanadi; dashboard barcha sale/item/paymentni application xotirasiga yuklamaydi. Sales/dashboard/CSV shared filter/formulalarni oladi, product report original sale/return line summalaridan; global count/totals UI pagingdan mustaqil. Biznes timezone sanalari yarim ochiq UTC interval, DSTda23/25 soat. Har request repeatable-read, cross-request asOf event+createdAt cutoff; in-flight commit racega durable reporting snapshot kafolati berilmaydi. Joriy katalog sarlavhasi, stock/open-shift sonlari tarixiy nusxa emas. Product top ranking gross; net returnli analysis alohida product report. Report/valuation arifmetikasi local50-digit clone, global Decimal sozlamasi o‘zgarmagan.

Closed shift va cash/payment journal DB trigger bilan immutable. Xato keyingi shu filialdagi open shiftga signed ShiftCorrection va unique correction CashMovement bilan tushadi; original hisob qayta yozilmaydi. Deferred constraint orphan correction movementni rad etadi; linked cash/doc ham open posting shift paytida immutable. Owner/admin live session, sorted row locks, Serializable operation+idempotency, audit transactioni saqlanadi. Bankdeposit/collection cash custody withdrawal, tashqi bank settlement emas. UI cash/correctionni requestdan oldin IndexedDBga persist qiladi; unknown request frozen, reload/manual same-payload retry; fresh definitive rejection bilan unknown replayning rejectioni farqlanadi. Autosync vendor yoki yangi cash effectni taxmin qilmaydi.

Return managerning hujjatga bir martalik tasdig‘ini reason/actor/role/time bilan saqlaydi; legacy approver NULL, fake backfill yo‘q. Approval CHECK PostgreSQL NULL semanticsini explicit IS NOT NULL bilan mustahkamlaydi. Return va item history DBda immutable, child faqat parent yaratilgan transactionda qo‘shiladi. HTML escaped/CSPli nonfiscal nusxa, real printer emas. Sellable return weighted averagega original unitCost bilan kiradi; available quantity nol bo‘lsa original costni tiklaydi, negative stock reconciliation talab qiladi. Product cost global bo‘lgani sabab barcha branch stocki aggregate qilinadi; FIFO/partiya faqat alohida ehtiyoj bo‘lsa keyin. Existing purchase/reversal transactionlari va tarix saqlanadi.

Test doirasi: real PostgreSQL cross-tenant linked refs (create/update/direct payment), cashier cost/shift scope, live revoke, parallel returns, immutable histories, cash formula, correction replay, original-cost return,1000receipt totals/cutoff/CSV, local dates/DST va HTTPS recovery. Firefox/WebKit to‘liq acceptance olinmagan; QA-01.03 done deb sanalmaydi. Applied migrations tahrirlanmaydi:019/020/021 yangi versioned migratsiyalar. Fresh/legacy va encrypted restore protokoli alohida test bazalarida; production release/pilot da’vosi yo‘q.

## ADR-016: tender snapshot, atomik lokal navbat va GET-only connection recovery

2026-10-06. Existing Next/React/Prisma/PostgreSQL/BigInt/IndexedDB/Web Locks stack yetarli; yangi paket yoki vendor implementation yo‘q. Sale cashTendered/cashChange nullable: missing/legacy tarix taxmin qilinmaydi. Server Decimal applied cashdan change hisoblaydi; Payment applied summasini saqlaydi, return va shift/report hisoblari tenderni income deb olmaydi. Tender idempotency payloadga yuborilgandagina kiradi; historical operation hashlar mosligi saqlanadi. Immutable posted sale guard yangi snapshot maydonlarni ham himoyalaydi. Seller optional faol membership, operator session identitydan alohida; serviceType optional trim100, DB scope/length guards. POS current user seller, customer/note/service savat va receiptda.

IndexedDB enqueue/ack/cancel single readwrite transaction; terminal record resurrect qilinmaydi. clearScope ikki store uchun bitta transaction, pending/conflict bo‘lsa draft ham o‘chmaydi. Scope org/user/device, stable operation UUID, Web Locks orqali foreground batch yuborish; server idempotency final guard. Old versionless draft upgrade-compatible, unknown envelope version saqlanib checkout bloklanadi. Yangi scope hydration old cartni tozalaydi, localReady writing/checkoutni gate qiladi. Draft minimal customer/product projection; session secret yo‘q. Local browser data account encryption/XSS-proof deb talqin qilinmaydi.

Connection navigator hint+real DB readiness GET probe, timeout5s va max30s backoff. Economic POST avtomatik probe recovery bilan yuborilmaydi; operator original persisted queue/statusni tekshiradi. Existing offline completion policy online-only qoladi; signed lease/reservations talab qiladigan OFF-02.03/.04 bu batchda done emas. Foreground sync max25, acknowledgement batch IDs/count/state validation; vendor/manual correction autosync yo‘q.

`runOperation`3 attemptdan keyin retryable DB conflict409 CONCURRENT_CONFLICT beradi; business permission/validation retry qilinmaydi. Unit injected Prisma serialization/deadlock codes bilan retry sonini tekshiradi; real PG explicit concurrent checkout/return/shift/stock tests invariantlarni tekshiradi. Suite fayllari umumiy isolated DB/DDLni bo‘lishgani uchun integration runner fayl concurrency1, test ichidagi Promise.all concurrency o‘zgarishsiz. Old parallel-files run82dan1 transient P2034 berdi; ketma-ket files explicit concurrency bilan final suite o‘tdi. Fake business effect yoki production fault endpoint yaratilmagan.

## ADR-017: opening hujjat, Code128 etiketka, ikki tomonli egalik tasdig‘i

2026-10-06. Opening/adjustment mavjud StockDocument/InventoryMovement, Decimal va runOperationni qayta ishlatadi; alohida stock engine yo‘q. Opening faqat filial+mahsulotda harakatsiz/nol balans, sabab va manager approval bilan. Purchase weighted-average algoritmi qayta ishlatiladi; reversal existing hujjatga ulanadi. 025 jurnal UPDATE/DELETE himoyasi va yangi postingning source/cost/nonzero constraintini qo‘shadi. Legacy invalid postinglarga avtomatik data repair qilinmaydi; NOT VALID constraint yangi yozuvlarni himoyalaydi. Organization cascade faqat organization o‘chirilganidan keyin jurnal cleanupga ruxsat beradi.

ZXing mavjud decoder bo‘lib qoladi. Standart encoding uchun PLAN1 T02 `bwip-js` 4.11.4 qo‘shildi (lockfile); qo‘lda encoder/pattern jadvali productionga kiritilmadi. Node adapter explicit import, test runner eski Node resolutioni uchun faqat shu paketning Node declarations pathi ko‘rsatildi. HTML escaped matn/CSP, bounded copies/rate limit; internal INT kodi GS1 assignment emas. Browser print/PDF real hardware integratsiyasi hisoblanmaydi.

024 OwnershipTransfer persistent pending/accepted/cancelled/expired holatlari, bitta pending per organization, expiry va tenant/terminal guards. Owner request yaratadi; faqat boshqa authenticated recipient qabul qiladi. Organization row lock membership update bilan bir xil tartib; promote va demote, revokes, audit hamda yangi recipient session bitta transactionda. Secret token faqat response cookiega; JSON/audit/operation resultga kirmaydi. Eski cookie bilan response-loss recovery qayta login talab qiladi; fresh-session replay accepted requestni takror role change qilmaydi. Kassirga faqat o‘z ownership requestlarini ko‘rish/response endpointi ochiladi, umumiy owner/admin matritsasi o‘zgarmaydi.

Business switch organization locksni sorted ID tartibida oladi, live target membership, cookie rotation va audit. React context bo‘sh branch/register uchun null holatga qaytadi, request generation kechikkan store/shift javoblarini rad etadi. Full page switch va existing scoped IndexedDB savatlar qayta ishlatiladi. Real vendor/provider implementation yoki taxminiy protokol qo‘shilmadi.

## ADR-018: original xarid snapshotidan narx tarixi va taqqoslash

2026-10-06. PUR-01.06 mavjud StockDocument/Item/reversal, PostgreSQL aggregate, Prisma SQL, React/Tailwind va shared CSV xizmatini ishlatadi; yangi model yoki paket kerak emas. Report narxni Product.costPricedan olmaydi. Purchase va purchase reversal original quantity/unitCost qiymatlariga asoslanadi; current product/supplier nomlari metadata bilan ochiq belgilanadi. Confirmation event asosiy sana, legacy null confirmedAt uchun createdAt fallback alohida legacyDate bilan. Missing confirmation va tarixiy nomlar taxminiy backfill qilinmaydi.

RepeatableRead ichida count/list/global summary, bounded pagination va full CSV cap. Product/supplier juftlik bo‘yicha min/max/first/latest/quantity-weighted average; reversal signed netni kamaytiradi, avg trendga aralashmaydi. Miqdorlar turli birlik/mahsulot orasida qo‘shilmaydi. Value har line 2 decimal rounding, price average6; PostgreSQL NUMERIC exact. Existing supplier card summary createdAt basis o‘zgartirilmadi; yangi report confirmation basisni aniq ko‘rsatadi. asOf event cutoff, durable snapshot emas.

Role/tenant/assigned branch, live context, shared report rate limit, formula-safe CSV va output sanitization existing withApidan. Operator filterda UUID yozmaydi: nom bo‘yicha sahifalangan supplier/product tanlovi; archive history ham tanlanadi. Nasiya kodiga refactor yoki ruxsat bypass qo‘shilmagan; CRM-01.01/.02 acceptance existing SQL customer lock, debt ledger, session va cash summaryga aniq negative/100000 fixture test bilan olinadi. Yangi provider/hardware implementatsiyasi yo‘q.

## ADR-019: xodim arxivi membership doirasida

2026-10-06. USR-01.01: OrganizationUser.archivedAt nullable; mavjud isActive vaqtincha blok holati bo‘lib qoladi. User global hisobini yoki tarixiy FKlarni o‘chirish kerak emas. Archive inactive bilan bitta transactionda va DB CHECK bilan; owner organization lock, live context, last-owner guard, tenant/store validation va session revocation mavjud xizmatda ishlatiladi. Restore avtomatik kirishni ochmaydi: blocked holat, old sessionlar revoked, role/store saqlangan. Action va edit maydonlari HTTP Zod strict contractda aralashtirilmaydi. Audit membership_archived/restored. Qo‘shimcha paket, vendor yoki katta refactor yo‘q. Additive026 legacy blocked yozuvlar uchun archive sanasini taxmin qilmaydi.

## ADR-020: chek counteri va qayta tasdiqlanadigan checkout konflikti

2026-10-06. Register NUMERIC(20,0) counter UPDATE…RETURNING transaction ichida, receipt POS-N, ichki Sale UUID o‘zgarmaydi. Decimal counter JSONda string; BigInt serialization muammosi yo‘q. Eski raqamlar saqlangan, POS-N legacy maksimumidan counter seed; gaps huquqiy kafolat deb aytilmaydi. Fiscal reference nullable, vendor API/SDK yo‘q, posted-sale history guard zaiflashtirilmagan. expectedUnitPrice ishonch manbasi emas, stale-price check; qoldiq condition/update+journal davom etadi. Error.details faqat scoped mahsulot/narx/miqdor, Decimal JSON normalize va sanitizer; qiymat logga tushmaydi.

Konflikt operatorning explicit cancel-with-proof → live price refresh → discounts reset → reapprove oqimi. Cashier void manager-only siyosati saqlangan. Sale/print/integration tagged states: browser print request audit faqat request, fizik muvaffaqiyat emas. Print exceptiondan keyin original receipt qayta chiqadi, iqtisodiy repost yo‘q. Provider failure browser fixture route-interceptda, production fake implementation emas.

## ADR-021: cash count approval va counted handover

Approval threshold0; zero farq odatiy close, nonzero cashier request persistent pendingClose. Shift lock/repeatable transaction va fingerprint, requireOpenShift pending gate, manager role/branch/live session. Manager requestni tasdiqlaydi yoki auditli rad etadi; eski counted/approved actor/date/reason yo‘q bo‘lsa tarix to‘ldirib taxmin qilinmaydi. Closed guard/correction journal o‘zgarmaydi. Yangi close key UUID+shift payload binding, legacy shift-id contract replay saqlangan. Handover original ownershipni tahrirlash emas: authenticated recipient old closed countdan yangi own shift ochadi. Same register/latest closed/count equality, register lock+unique link, audit; revenuega yozilmaydi.

## ADR-022: individual debt origin va conservative legacy aging

DebtEntry mavjud journalini qayta ishlatish: nullable debtOriginId self FK + source/customer/organization trigger. Sale debtlar existing saleId guruhida, new positive nonsale hujjatlar individual origin; FIFO/explicit reduction bir sourcega proven bog‘lanadi. Eski unlinked negative general reductiondan qaysi hujjat yopilganini taxmin qilmaymiz — general legacy bucket+requiresReconciliation. Current debt va statement closing exact, aging provenance yetmasa unallocated. Due-bearing openinglar endi overdue/upcomingga kiradi, noDueDate barcha proven hujjatlar uchun. Owner read/exports va cash posting vakolatlari saqlangan. Yangi kutubxona kerak bo‘lmadi.

QA browser regressiyasi: Next16.3.8 local Link qo‘llanmasiga binoan authenticated Sidebar/Header havolalarida prefetch=false. Sessiya almashishi yoki bekor qilinishida ortiqcha RSC fon so‘rovlari qilinmaydi; normal client navigation va serverdagi live authorization saqlangan. WebKit pageerror assertion o‘chirilmagan yoki filtrlab yumshatilmagan.

## ADR-023: persistent core alerts va exact replenishment

2026-10-06. Incident mavjud scoped reconciliation SQLdan yaratiladi; severity/state/entity/store/evidence va unique organization+kind+entity. Numeric evidence JSON numberga aylanmaydi, SQLda stringga normalizatsiya qilinadi. Scanner faqat incident va audit yozadi, balans/savdo/paymentni tuzatmaydi. Owner/assigned-store manager discrepancy yo‘qolganini qayta tekshirib reason/actor bilan yopadi. Reappearing mismatch qayta open; previous closure AuditLogda qoladi. Worker explicit org SQL context bilan ishlaydi, Session/membership yoki provider yasamaydi; organization transaction+advisory lock, paged org list, graceful stop va sanitized failures. Default5min,min60s. StockThreshold perbranch+product mavjud Product.minStockni fallback sifatida saqlaydi, max≥min. Recommendation exact max−quantity; demand/lead time/buyurtma taxmin qilinmaydi. Additive028/029 FK, state/range/source immutability va actor tenant triggerlari; Prisma relations SQL FKga mos.

## ADR-024: original server draft va auditli sync conflict resolution

POS save creates only existing draft using original durable intent/key, not payment/stock posting. Authorized same cashier selects same live terminal/shift on other device; original frozen cart loaded explicitly. Completion posts same Sale, current server price/stock/customer/permission guards remain. Pending basket controls immutable until original outcome is resolved. Manager-only void policy stays. Local-only broken device data is not advertised as recoverable from cloud.

SyncReview preserves original command source/hash/actor and reject code; secret/PII fields not copied. Payload/key/actor cannot be changed by review. Owner resolution references committed Operation result or authorized void; it never replays as a different actor or generates new business posting. If a conflicting payload references an already used key, both source hashes are retained as reviewed proof, not declared equivalent. Acknowledged local state rejected with manager proof; persistent source remains server-side. Missing proof remains conflict. Retryable unknown stays pending. Local terminal acknowledgements survive restart and never overwrite payload.

## ADR-025: API guidance, correlation, accessibility va controlled recovery

Existing withApi pipeline now wraps AsyncLocalStorage; allowlisted JSON stdout request/tenant/operation correlation and durations, no new logging package. Error guidance adds human next action and request ID. Client network failure marks unknown result, never suggests creating another operation key. Audit helper uses requestId and recursive sensitive field filtering in source transaction; audit insertion failure rollback is tested on PostgreSQL. Gateway/exhaustive API inventory remains supplemented by service-role policies and positive scoped reads.

Shared Decimal clone precision50 avoids truncating large fractional arithmetic; pure tax helper is arithmetic only, no legal rate/default tax/fiscal vendor assumed. Partial-return helper conserves last cent and is reused in posting. UI keeps semantic touch controls≥44px, unique input/select IDs, associated errors, focus trap/restore and stronger foreground contrasts. Owner/admin dashboard versus cashier home uses current authenticated role; data/alerts remain server scoped. Training is explicitly local exercise with zero financial APIs. Help states actual import/hardware limitations.

Release drill archives RELEASE_BASE (default HEAD^) application source without env/secrets, compiles against unchanged dependency versions and tests actual old API create/complete/replay against additive new schema. Fresh/legacy migrations and encrypted empty DB restore are separate. Measured local elapsed/rollback/RPO fixture results do not claim actual hosting SLA, legal acceptance, vendor integration or pilot readiness. No rollback schema drop or real business DB overwrite.

SEC-02.02 CSRF tanlovi: existing exact Origin + Sec-Fetch-Site + JSON-only + SameSite=Lax browser boundary saqlangan. Alohida double-submit CSRF token kiritilmadi: browser cross-origin JSON preflight/CORS va Origin tekshiruvi bilan rad, form content-type rad. Origin yo‘q automation so‘rovi kuchli opaque session cookie talab qiladi. Testlar foreign/null Origin, cookie flags, idle/absolute expiry, revoke va bearer fallback radini tekshiradi; bu transport qoidasi api.md bilan mos.

2026-10-07 qabul aniqligi: cashier training matnli yo‘riqnoma va organization/user-scoped React mashqi orqali bajariladi. BigInt qaytim arifmetikasi real sale/payment/inventory yozmaydi; iqtisodiy demo tenant seed o‘rniga mashq holati hisob/biznes o‘zgarganda reset qilinadi. Automated browser fixtureda yangi cashier mashqdan so‘ng isolated haqiqiy POS checkoutni bajaradi; human pilot yoki video yaratilgan deb ko‘rsatilmaydi. Packaged non-root worker qabulini `node scripts/ops/test-worker.mjs` qayta bajaradi (`docker build -t pos-app:twenty-test .` va isolated test DB talab qilinadi).


## ADR-026 — qo‘lda bank settlement qayd etilishi va scoped quick presets (2026-10-07)

Qo‘lda recorded payment qaytarmasi original payment/collection kanalida yuritiladi. Naqd, karta, transfer, outstanding debt va written-off liability alohida exact buckets; oldingi refundlar ayriladi, oxirgi cent qoldig‘i conservation bilan yopiladi. Operator noncash uchun oldindan server preview, aynan shu expectedSettlement va haqiqiy hujjat raqamini beradi. Bank/provider API chaqirilmaydi, recorded holat provider confirmation hisoblanmaydi. Boshqa provider statusi shu yo‘ldan o‘tolmaydi. Proofsiz/stale/duplicate-reference holat butun transactionni rad etadi; original Operation key replay saqlanadi. Migration031 duplicate reference + status/proof invariantini bazada ham himoya qiladi.

Quick presets faqat ID; organization/user/register local key,12 ta limit; narx/ruxsat har tanlashda serverda qayta olinadi. Keyboard Enter debounce qidiruviga ishonmaydi. Auth response uchun case/snake-case credential deny defense qo‘shildi, financial operator DTO faqat id/fullName, tashkilot nested stores assigned branch bilan; xodimlar owner-only.

Supplier bank rekvizitlari va tijoriy shartlar opaque foydalanuvchi metadata sifatida qo‘shildi (nullable migration032); bank format/protokoli taxmin qilinmadi. Bu supplier payment/debt ledgerning o‘rnini bosmaydi.


### ADR-027 — To‘lov manbasi operator tasdig‘idan mustaqil

Migration033 `Payment.sourceType`ni `manual/provider` bilan chegaralaydi. Hozirgi to‘rtta ichki payment constructor manbani serverda explicit `manual` belgilaydi. Kelajakdagi trusted provider posting alohida implementatsiya talab qiladi; `status=recorded` yoki operator hujjati provider refund uchun yetarli emas. Provider kelib chiqishidagi original/qarz-undirish to‘lovi qo‘lda refund boundaryda rad etiladi. Bu o‘zgarish Click API yoki taxminiy vendor protokolini qo‘shmaydi.


### ADR-028 — Manual collection kanalini saqlash va hujjatni qayta ishlatmaslik

Debt collection naqd/karta/o‘tkazma journalini explicit tanlaydi. Card uchun operatorning haqiqatda bajarilgan to‘lov tasdig‘i va original hujjat talab qilinadi; bank API taxmin qilinmaydi. Existing transfer API callers buzilmaydi, lekin UI bank/karta tasdiq/hujjat bilan ishlaydi. Organization/channel/document lock va migration034 unique index disjoint customer parallel so‘rovlarini ham himoyalaydi. Card/transfer cash drawer totaliga qo‘shilmaydi. Original payment/debt allocation/smena/receiver va Operation payload saqlanadi. Full FinancialAccount/transfer/expense funksiyalari FIN-02 bandlarida ochiq; bu implementatsiya alohida bank statement reconciliation yoki provider callback o‘rnini bosmaydi.

### ADR-029 — Avtomatik narx tarixi va bounded reviewed batch

2026-10-08. Prisma ProductPriceHistory + PG trigger qo‘lda va tizim hisoblagan barcha haqiqiy narx o‘zgarishlarini qamraydi. Baseline sanasi migration vaqti; tarix taxmin qilinmaydi. Manual catalog cost edit/history/export owner-only, admin sotuv narxini o‘zgartiradi; mavjud admin financial read vakolati saqlanadi. Transaction-local actor/source individual va bulk editni ajratadi; tizim cost hisobiga uydirma actor qo‘yilmaydi.

Bulk 100 unique rowgacha atomic batch: sorted product locks, expected price, preview hash, sabab, explicit confirmation, serializable Operation replay va bitta audit. Mavjud PostgreSQL va IndexedDB yetarli: worker/queue yoki yangi texnologiya qo‘shilmadi. Katta ro‘yxat alohida ko‘rib tasdiqlangan batchlarga bo‘linadi, global all-or-nothing deb ko‘rsatilmaydi. Lokal reviewed intent avtomatik syncdan chiqarilgan; unknown response original key/payload bilan tekshiriladi. Cashier history endpointini o‘qiy olmaydi; history qiymatlari umumiy credential sanitizerga tayanib himoyalanmaydi.

### ADR-030 — Brak fizik joylashuvi va disposal journal

2026-10-08. Har filialga bitta DamageLocation; nonsellable qaytarma original return item bilan unique immutable ReturnDispositionEntryga bog‘lanadi. Damaged entrylar yig‘indisi alohida brak qoldig‘i; write_off location yo‘q, sotiladigan stock emas. Parent refund transaction ichida location/journal/refund/audit/Operation birga bajariladi. SQL original return/product/store/quantity/cost/actorni tekshiradi; location tenant/store identity o‘zgarmaydi. Backfill frozen original nom/SKU/unit/cost/date bilan, hozirgi katalogdan emas.

Read API assigned branch bilan chegaralangan. Yig‘ma response faqat sahifadagi product/store juftliklariga tegishli va shu scope explicit; shu juftliklarning barcha entrylari hisoblanadi. Butun catalog groupBy responsega yuklanmaydi. Repair/release/reservation INV-02 doirasida alohida, bu task boshqa ochiq bandni avtomatik yopmaydi.

### ADR-031 — Supplier invoice, avans va allocation

2026-10-08. Mavjud Prisma/PostgreSQL/FinancialDocument/AccountEntry/CashMovement va IndexedDB yetarli; yangi servis yoki SDK qo‘shilmadi. SupplierInvoice original confirmed purchase qiymatiga bog‘langan immutable payable; SupplierPayment original financial documentga, SupplierAllocation ikkalasiga FK bilan bog‘langan. Qarzdorlik va avans alohida nonnegative yig‘indilar. Eski receiptning to‘langanligi taxmin qilinmaydi: tekshirilgan invoice explicit register qilinadi. Receipt qiymati satr bo‘yicha exact2 rounding.

Supplier, invoice, payment va account locklari parallel postingni seriallashtiradi; SQL triggerlar amount/scope/immutable/overallocate invariantlarini ham tekshiradi. Cash account existing shift bookka bir marta yoziladi, allocation money movement yaratmaydi. Manual bank/provider posting haqiqiy tashqi to‘lov tasdig‘i va hujjat talab qiladi, provider confirmed degan da’vo yo‘q. Filiallararo allocation hozir rad; bir filial ichida explicit invoice bog‘lanishi.

Yangi tracked receiptni oddiy reverse qilib qarzni orphan qilish rad etiladi; original-bound supplier return alohida PUR-01.03. Legacy reverse saqlanadi. Global supplier archive debt yoki advance bo‘lsa rad. Ledger response bounded; sahifadagi allocation aggregate to‘liq, tafsilotlar alohida pagination. DurableMutation/PendingActions supplier returnPath bilan actor-scope original key/payloadni saqlaydi, automatic syncga bermaydi. Applied042 xato trigger forward043 bilan tuzatildi, applied checksum o‘zgartirilmadi;044 noncash proof va stock reversal lockni mustahkamlaydi.

### ADR-032 — Purchase order, atomic partial receipt va reconciliation

2026-10-08. PurchaseOrder/Item original quantity/unit/name/cost snapshot, PurchaseReceipt/Line existing StockDocument/Item va SupplierInvoicega FK bilan ulanadi. Existing confirmStockDocument va registerSupplierInvoice transaction funksiyalari ajratildi: original public wrapper Operation kontrakti saqlanadi, order receipt bitta outer Serializable transactionda ikkisini chaqiradi. Supplier/order va sorted product locklar; remaining receipt aggregate SQLdan, cheksiz child collection yuklanmaydi. Derived status, immutable history; qty correction original-bound supplier return doirasida.

045 immediate constraints,046 deferred complete-line coverage va nonempty order,047 deferred NO ACTION cross-links: org cascade child tartibiga bog‘liq xato tuzatildi, business history oddiy delete qilinmaydi.048 invoice0 uchun complimentary goods receipt yo‘qotilmaydi; positive allocations saqlanadi. Unit o‘zgarishi yoki archive qabulni rad qiladi. UI parent reload supplier kartasini unmount qilmaydi, order tanlovi saqlanadi; scope o‘zgarsa outer actor key yangi component yaratadi.

Supplier balance report immutable invoice/payment/allocation createdAt cutoffdan qayta hisoblanadi. Bir scoped RepeatableRead ichida pagination/globalsummary/fullCSV; aging dueAtdan, null alohida. Revenue, cashflow va payable aralashtirilmaydi. Existing customer due, frozen shift expected/count/difference va original purchase report bilan exact cross-reconciliation test bor; bu actual bank/provider confirmation yoki vendor integration o‘rnini bosmaydi.


### ADR-033 — Supplier credit, allocation release va acknowledgement validation

2026-10-08. Mavjud Prisma/PostgreSQL va IndexedDB ishlatiladi; yangi vendor SDK yo‘q. SupplierCredit/Item original SupplierInvoice va StockDocumentItemga bog‘langan immutable correction. Physical return va price credit alohida kind; original quantity/value limitlari SQL va service qatlamida saqlanadi. Qolgan payable qolgan quantityga taqsimlanadi, final remainder exact; price credit tarixiy SaleItem costni o‘zgartirmaydi (landed-cost alohida).

To‘langan invoice kamayishi actual cash refund emas. Original SupplierAllocation immutable qoladi, SupplierAllocationRelease ortiqcha summani aynan o‘sha paymentning advance balansiga qaytaradi. Effective balance SQL view, historical asOf credit/release createdAtdan hisoblanadi. No guessed bank/provider confirmation. Supplier/product/invoice locks va Serializable transaction stock/cost/payable/release/audit/Operationni birga boshqaradi.

049 forward migration immutable/scope/original limits va deferred complete credit/stock-movement invariantlarini beradi. runOperation barcha deferred constraintsni transaction callback tugashidan oldin IMMEDIATE qilib tekshiradi: invalid journal uchun muvaffaqiyatli acknowledgement berilmaydi. Barcha existing financial operationlar shu guarddan o‘tadi; full integration regressiyasi talab etiladi. UI server preview, explicit confirm va lost-response original durable intentni tiklaydi; avtomatik offline posting yo‘q. Tashqi fiscal/Click/hardware integratsiyasi yozilmaydi.

Supplier ledger refresh mavjud credit formasini unmount qilmaydi; actor/supplier tashqi key scope o‘zgarsa yangi forma yaratadi. Ayni invoice value qayta tanlanganda existing detail tozalanmaydi. Server transaction preview baribir joriy qoldiqni qayta tekshiradi.


### ADR-034 — Variantlar mavjud SKU stock key orqali

2026-10-08. Rang/o‘lcham variantlari uchun mavjud Product, ProductBarcode, InventoryBalance/Movement va SaleItem/Purchase/Return productId contractlari saqlanadi. ProductVariant rootProductId/productId va 1..8 canonical JSONB options bilan oilani bog‘laydi; generated SQL combinationKey variant kombinatsiyasini noyob qiladi. Alohida Option xizmati yoki yangi texnologiya kerak emas. Eski SKU default variant, original barcode/qoldiq/historical foreign keys o‘zgarmaydi. Root oilaning real default SKUidir, alohida umumiy stock emas.

050 backfill va default trigger;051 composite tenant FKs SQL orqali root/child organization o‘zgarishida ham scope invariantini saqlaydi. Applied050 checksumiga tegilmaydi. Family unit bir xil va active oila ichida mustaqil o‘zgartirilmaydi. Variant metadata assignmentdan so‘ng immutable; archive existing Product lifecycle orqali. Oilada1000 cap, GET stable pagination va faqat assigned store stock aggregate. New variant root current costdan boshlanadi, keyingi cost/price/inventory bir-biriga bog‘lanmaydi. Harakatlar aynan child SKUga; real physical barcode scanner uchun yangi SDK yo‘q.

Create original Operation, root row lock, unique combination, barcode/price history/audit bilan atomic. UI explicit confirmation/durable original retry; no automatic sync. Cashier scoped read/cost-hidden, manager create. Sifat qabulida original/default backfill, ikki rang/o‘lcham stock/barcode independence, original SKU sale/return, duplicate parallel command, late audit rollback va browser lost acknowledgement talab qilinadi.

### ADR-035 — Cheklangan himoyalangan rasmlar va nonce CSP

2026-10-08. Fayllarning hozirgi allowlisti static PNG/JPEG/WebP; HTML/SVG/PDF yoki arbitrary hujjat qabul qilinmaydi. Mavjud PostgreSQL durable volume kichik rasmning bytes, tenant metadata, Product link, audit va original Operationni bitta transaction hamda backup ichida saqlaydi. Node fs uchun alohida volume/object storage qo‘shish hozir zarur emas. Input/output512KiB, normalized image2048px, decoder16Mp/5s, default tenant quota100MiB. `sharp` Nextning mavjud dependency versiyasidan direct exact dependencyga ko‘tarildi; decoder qayta encode qilib metadata va active contentni saqlamaydi. Katta hujjat/video ehtiyoji o‘lchanganida alohida storage qarori talab etiladi.

Own tenant live-session protected binary GET cashierga ham ruxsat; list/upload/delete manager-only. Upload/deletion original idempotency, org quota lock, atomic image link/audit; deletion bytesni tozalaydi va barcha linklarni uzadi, immutable metadata/tombstone qoladi. Expired bytes explicit deletiongacha quota/backupda qoladi; expiry GET410. Automatic retention purge yoki objectstorage implemented deb da’vo qilinmaydi. Terminal IndexedDB intentdan raw base64 olib tashlanadi, unknown outcome original payloadni saqlaydi.

052..055 forward migrationlar image type/size/dimensions/tenant, immutable content va category graph invariantlarini SQLda tekshiradi. 053 graph lockdagi yo‘q field 055 forward migration bilan tuzatildi; applied checksum o‘zgartirilmadi. Category graph org row write bilan seriallashtiriladi va deferred SQL check helperdan tashqari raw parallel cyclelarni ham rad qiladi. Product brand/description mavjud SKU identity/historyni o‘zgartirmaydi; archive history retained.

Next16 proxy per-request nonce/strict-dynamic bilan script CSP beradi; layout dynamic headers orqali nonce renderingni yoqadi. Existing styles unsafe-inlinega ruxsat (scriptga emas), dev-only unsafe-eval; authenticated image `unoptimized` ishlaydi. Receipt blob/iframe va offline worker existing flows regressiya testidan o‘tishi shart. Auth tekshiruvi proxyga ko‘chirilmaydi, existing server boundary qoladi.

### ADR-036 — Kassir PIN autentifikatsiyasi chegarasi

2026-10-08. PIN oddiy parol loginining o‘rnini barcha rollarda bosmaydi. 6 raqamli PIN faqat cashier membershipda bcrypt12 hash bilan, o‘z parolini qayta tasdiqlab sozlanadi; yuqori rollar uchun PIN sozlash/almashish rad. PIN-switch faqat live authenticated source session va shu actor ko‘ra oladigan active branch ichida target active cashier/assigned branchga ishlaydi. Source session lock, target membership lock, PIN verify, scoped new session, source revoke va audit bitta transaction. Parallel ikki switchdan faqatbitta; audit failureda yangi session yoki source revoke qolmaydi.

PIN session max8soat va bitta filial; har requestda target hali cashier/PIN-enabled/assigned-active branch ekanligi qayta tekshiriladi. Role promotion PINga yangi vakolat bermaydi, eski session invalid; organization switch PINdan taqiqlangan, password login kerak. PIN change/disable PIN sessionsni, password rotation barcha sessions va barcha membership PINlarni bekor qiladi. Hash/PIN response/audit/logda yo‘q. Target5 wrong attempts/15min hamda source20 throttles, successful switch budjetni transaction ichida reset qiladi.

UI pending/conflict amallar borida switchingni bloklaydi; eski actor drafti actor-scope IndexedDBda saqlanadi. Full reload eski actorning in-memory register/catalog holatini tozalaydi. Boshqa kassir smenasi o‘zgartirilmaydi; mavjud requireOpenShift/permission/stock/operation checks davom etadi. Lost switch response uchun economic retry yaratilmaydi; parol login fallback mavjud. PINni unknown vendor terminal/hardware unlock protokoli deb talqin qilinmaydi.

### ADR-037 — Versiyalangan ichki soliq siyosati va tarixiy pul snapshoti

2026-10-08. Existing Prisma/PostgreSQL/Decimal/Zod/IndexedDB bilan TaxProfile va immutable TaxProfileVersion ishlaydi; fiskal provayderga tegilmaydi. Owner mode(included/excluded/exempt), exact rate0..100%, exemption reason va UTC effective date kiritadi. Stavka dasturga qonuniy default sifatida tikilmaydi. Birinchi versiya boshlang‘ich configured date, keyingi versiya oldingi effective datedan keyin/hozir yoki kelajak; retroactive correction rad. Product explicit profilega bog‘lanadi. Archived yoki hali kuchga kirmagan assigned policy savdoni bloklaydi; tarix saqlanadi.

Legacy sale taxni taxmin qilib backfill qilmaymiz: null taxBase/payable/legacy-unspecified rounding belgisi qoladi. Yangi qatorlar tax version/mode/rate, after-line-and-receipt-discount base, tax, gross payable, rounding money-half-up-2-v1ni Decimalda snapshotlaydi. Receipt discount SKU identityga ko‘ra deterministic cents allocation; UI preview bilan create/random row ID orasida rounding siljimaydi. Mavjud posted sale/item immutability yangi maydonlarni ham himoya qiladi. Completion current policy/price/unit/stock/sessionni qayta tekshiradi, staledraft409; stock/debt/payment/tax/audit/Operation atomic.

POST sales/preview iqtisodiy posting qilmaydi; live assigned shift bilan exact totals/fingerprint. POS to‘lov oynasini shundan keyin ochadi va checkout expected total/fingerprintni tekshiradi. Browser Number ko‘rsatish uchun qolgan bo‘lsa ham server real money calculation/tax policyga authority. Original durable retry payload/expected quote saqlanadi; unknown acknowledgement yangi keyga aylantirilmaydi.

Qisman qaytarishda gross refund existing original quantity/value remainderdan olinadi; tax cumulative gross-refund ratio bo‘yicha integer centlarda qaytadi. Mustaqil quantity tax rounding zero-cent refundga positive tax chiqarishi mumkin, shuning uchun ishlatilmaydi. Discount cumulative physical-quantity ratio bo‘yicha, oxirgi qism barcha qoldiqni oladi. Forward057/058 SQL arithmetic/reference/deferred total/cumulative tax-discount invariantlarini tekshiradi; applied checksums o‘zgarmaydi.

Gross sales/payment reconciliation configured taxni o‘z ichiga oladi; management profit taxsiz base minus historical cost. Products/breakdowns tax alohida, gross revenue saqlanadi va profit undan tax/costni ayiradi. Payment dimension tax/costni attribution qilmaydi (null), gross settlement channelsni solishtiradi; tax per-channel tasdiqlangandek ko‘rsatilmaydi. Tax configuration qonuniy rejim/fiskal acceptance o‘rnini bosmaydi.

PIN follow-up: targetMembershipId source identitydan alohida scoped reference. Cashier→boshqa assigned cashier almashish common organizationUserId self-only guardni chetlab o‘tish emas, explicit target contract va service role/branch check bilan ishlaydi. PIN identity DTO userStores ham active tenantScope bilan cheklanadi; password cashier barcha assigned stores, PIN faqat bitta. Qabul soni bu tuzatishlar uchun qayta oshirilmaydi.

### ADR-038 — Chegirma foizi va manager review (2026-10-08)
Mavjud Decimal/BigInt, Sale/SaleItem, DiscountPolicy, Session va AuditLogdan foydalanamiz. Yangi tashqi authorization servisi kiritilmaydi. Qator foizi money-rounded grossdan, chek foizi line-discountdan keyingi subtotaldan; ≤2 kasr, half-up cents. Har SKU foizli qator bir dona, oddiy amount qatorlarining eski birlashishi saqlanadi. Sabab configured thresholdda, no-policy fallback10%; cashier/admin limiti current policy orqali create va complete transactionda tekshiriladi.

Tasdiq rahbarning o‘z faol sessiyasida aniq qoralama bilan beriladi; receiptga actor/role/vaqt/policy saqlanadi, completionda qayta tekshiriladi. Boshqa actor IDsi, umumiy ko‘chiriladigan approval tokeni yoki kassir parol almashtirib rahbar roliga chiqishi yo‘q. Limitga sig‘adigan kassir chegirmasi cashier authorization sifatida belgilanadi, manager approval deb nomlanmaydi. Katta chegirma uchun rahbar o‘z hisobida savdoni ko‘rib chiqadi. Eski qoralamalarda yo‘q sabab to‘qilmaydi: o‘zgarmagan legacy chegirma current limit va yangi actor review bilan yakunlanadi; yangi/tahrirlangan chegirma sabab talabini bajaradi. 059 additive, deployed057/058 checksum o‘zgarmaydi.

### ADR-039 — DB/file/config recovery manifest va alohida secrets (2026-10-08)
Protected FileAsset bytes va business hujjatlar PostgreSQL snapshotda saqlangani sabab boshqa object storage yoki alohida file cut-off protokoli kiritilmaydi. Native pg_dump custom dump + GPG recipient encryption saqlanadi, formatv1 uchun dump SHA256iga bog‘langan encrypted manifest qo‘shiladi. Hash streaming (katta dump RAMga yuklanmaydi). Explicit app release, uchta nonsecret configuration allowlist va separate secret recovery locator; hech qachon butun env/credential JSONga kiritilmaydi. Empty target/filename format/checksum/GPG/hash guardlari oldin, restore single transaction; manifest runtimega avtomatik apply qilinmaydi. Old dump formatining mosligi saqlanadi, uning yo‘q configini to‘qib tiklash mumkin emas.

Secrets explicit own private filedan no-follow descriptor bilan pipe orqali alohida GPGga beriladi; plaintext backup fayli/log yo‘q. Script kalitni yaratuvchi/saqlovchi tashqi vaultni taxmin qilmaydi. Isolated fixture alohida shifrlangan nusxa, exact decrypt/cmp, permissions rad, config values, hash mismatch rad, bytes/SHA/link/due/count restore va RPO0/RTO5sni tekshiradi. Real offsite transport/scheduler/hosting/key custody acceptance OPS-03.01/.03 doirasida qoladi.

### ADR-040 — Manager tasdig‘i o‘z sessiyasida aniq amalni bajarish orqali
Owner/admin qaytarish, narx va inventar farqini o‘zining live sessiyasida tranzaksiya ichida tasdiqlaydi. Kassirga ko‘chiriladigan umumiy tasdiq tokeni berilmaydi. Operation actor/type/key/payloadHash, hujjat row-lock va immutable posted journal boshqa hujjat, boshqa summa yoki yangi payloadga tasdiqni ko‘chirishni rad etadi. Narx batch preview confirmationHash aynan mahsulot/old-new qiymat/sababga bog‘langan; count approval oxirgi readingId/round/quantity/expected/unit/cost va submittedAtni auditga oladi. Sale chegirmasida current policy/actor/role/timestamp snapshot va final postingda qayta tekshiruv bor. Sessiya muddati va live membership approvalning amal muddatidir; alohida uzoq yashovchi ruxsat yaratilmaydi. Decimal va Date auditda mos ravishda aniq decimal string va ISO timestamp bo‘lib saqlanadi, maxfiy kalitlar nested filteringdan o‘tadi. Existing Prisma financial/count/Operation/audit yozuvlari yetarli; ishlatilmaydigan Approval jadvali qo‘shilmaydi.

### ADR-041 — PWA public fallback va muddatli lokal katalog
Next16 metadata manifest va native Service Worker/Cache API ishlatiladi; qo‘shimcha PWA SDK yo‘q. Cache API faqat generic offline HTML va192/512 iconlar uchun; private HTML/API/files/receipt yoki framework chunk cache yo‘q. IndexedDBv2 backward-compatible store qo‘shadi, operations/draftsni saqlaydi, versionchange eski connectionni yopadi. Lokal catalog actor/register/query bo‘yicha scoped; bitta oxirgi50-row page va5min server vaqt TTL. Price/unit content SHA version, expiry/clock rollback/tenant mismatch/invalid format reject. Offline katalog vakolat emas va checkoutni yoqmaydi; eski cart server quote/current price bilan qayta tekshiriladi. Update default waiting lifecycle orqali: skipWaiting/clients.claim/auto-reload yo‘q. Worker lifecycle/allowlist unit va Chromium/Firefox/WebKit real isolated transport-outage sinovlari bor. Chromiumda generated test TLS cert faqat test launch flag bilan qabul qilinadi; production TLS/security guard yumshatilmagan.

### ADR-042 — Transfer qabulida soz, brak va tasdiqlangan kamomad
060/061 append-only migratsiyalar original transfer snapshotni saqlaydi. Qabulda soz miqdor InventoryBalancega kiradi; brak/kamomad immutable TransferDispositionEntryda original cost, actor, reason va vaqt bilan yoziladi. Counter sum journalga deferred constraint orqali teng, sent=received+returned+damaged+shortage+in-transit. Zero/non-base-precision/excess/duplicate item va sababsiz farq rad. Parent/item row lock+Serializable Operation atomic posting/retry/late audit rollback; posted snapshot va kamaytirilgan counters SQLda rad. Partial receipt durable original intent/review bilan; legacy empty-body receive all remaining sellable oqimi saqlangan. Brakni avtomatik yaroqli stock deb qabul qilish yoki yo‘qolgan miqdorni taxminiy backfill qilish yo‘q. Transfer farq jurnali va return farq jurnali ikki alohida source; umumiy zona/reservation boshqaruvi INV-02.05ning keyingi qismi.

### ADR-043 — Platforma identity biznes vakolati emas
PlatformOperator ro‘yxati explicit infratuzilma provisioning orqali belgilanadi; biznes registratsiyasi/owner/admin rolidan avtomatik hosil bo‘lmaydi. `support` va `platform_admin` biznesni o‘qishda ham owner-consented SupportGrant talab qiladi. Grant target org/operator/branch allowlist/read scope/reason/approver/time bilan immutable;1–60min. Existing live password session operator identityni beradi, target tashkilotga user/session switch yoki soxta owner context yaratilmaydi. Source business role operator vakolati o‘rnini bosmaydi; PIN session support uchun yetarli emas. Read-only DAL bounded DTO va50-row paging, katalogda cost/description/credentials yo‘q, savdoda customer/cashier PII yo‘q. Target data har safar grant row lock+current expiry/operator/status/scope/active branch bilan o‘qiladi; revoke shu lockda linearize bo‘ladi. Read audit failureda javob data bermaydi. Known actorning revoked/expired/out-of-scope readi committed deny audit bilan403; unknown actor/grant404. Owner grants/revokes durable operation actor/hash/replay bilan; operator hech qanday business mutation capability olmaydi. Haqiqiy staff/provision/deploy bu implementatsiya bilan bajarildi deb hisoblanmaydi, platforma boshqaruvining qolgan BIZ-02.01 doirasi ochiq.

### ADR044 — Narx darajasi original chekdan ajratiladi

Mavjud Prisma.Decimal/PostgreSQL bilan append-only PriceRule ishlatiladi; yangi narx texnologiyasi qo‘shilmaydi. Ustuvorlik: customer > active customer group > wholesale > retail > Product.salePrice. Har darajada aynan filial qoidasi umumiydan oldin, keyin eligible eng katta minimumQuantity tanlanadi. Har identik product/kind/store/customer/group/threshold key uchun `[startsAt,endsAt)` oralig‘i overlap bo‘lmaydi; advisory lock + SQL guard parallel qoidalarni serializatsiya qiladi. Boshlanish inclusive, tugash exclusive. Arxiv yangi tanlashni to‘xtatadi, posted SaleItem canonical price snapshot va rule reference o‘zgarmaydi. Bir xil qiymatdagi boshqa qoida ham yangi qoralama completionda review talab qiladi; tarixiy qaytarma original price/cost/taxni oladi. POS katalog asosiy price bo‘lib qoladi, boshqacha eligible narx uchun cashier conflict dialog orqali server quote bilan savatni yangilab to‘lovni qayta tasdiqlaydi. Qoralamada mijoz almashsa qatorlar transaction ichida qayta narxlanadi. Shared barcha-filial qoidasi owner, assigned filial qoidasi owner/admin; cashier faqat scoped quote. Kelajakdagi fiskal/Click protokoli yo‘q.

### ADR045 — Mijoz dublikatini moliyaviy tarixni qayta yozmasdan birlashtirish

Telefonning ruxsatli punctuationi olib tashlanadi; 9 raqamli local format `998` bilan, explicit international formatning raqamlari9–15 chegarada saqlanadi. Bu routing yoki telefon egaligini tasdiqlash emas. Aktiv kartada tenantga tegishli canonical phone DB lock/index bilan noyob. Legacy invalid telefonlar avtomatik o‘chirilmaydi; bir xil canonical phonega ega legacy kartalarga g‘olib tanlanmaydi, original ID/telefon/faollik saqlanadi va canonical key unresolved null qoladi. Yangi valid duplicate rad; noto‘g‘ri legacy kontaktni tahrirlash yangi valid format talab qiladi.

Ownerning reviewed, idempotent merge’i faqat source qoralamalari/target bo‘yicha qarzlari yopilganda qilinadi. Active yoki taqsimlanmagan majburiyatni taxmin qilib targetga ko‘chirish o‘rniga original ledgerda yakunlash talab qilinadi. Source immutable inactive aliasga aylanadi; barcha Sale/Payment/DebtEntry/Return foreign IDs original kartada qoladi. Asosiy kartaning historysi root+original alias receiptlarini tenant/store/cashier scope va pagination bilan ko‘rsatadi, partial/full returnlar yashirilmaydi. Root boshqa kartaga ko‘chirilmaydi, chained/cyclic merge yo‘q; rootda max99alias. Yangi savdo/credit faqat active rootda; yangi narx darajasi rootning guruhidan, original refund esa original receipt/card/paymentdan olinadi. Oddiy archive va legacy invalid phone reactivation backward compatibility saqlanadi; merge identity qayta ochilmaydi. Tashqi bildirishnoma yoki verification provider taxmin qilinmadi.

## ADR046 — Fizik stock, zona va rezervlarning bitta hisoblash qoidasi (2026-10-09)

InventoryBalance fizik sellable qoldiq bo‘lib qoladi. LocationBalance fizik qoldiqning ichki taqsimoti, yangi LocationEntry immutable harakat jurnali. Legacy qoldiq avtomatik boshqa omborga ko‘chirilmaydi: onHand − zonalar yig‘indisi unassigned. Active rezervlar alohida ReservationItem/Entry bilan; available = onHand − reserved. Bir SKU/filial uchun barcha operatsiyalar mavjud stock advisory-lock va transactionni ishlatadi. PostgreSQL deferred constraints balans/jurnal/rezerv yig‘indilari va tenant referencesni tekshiradi. Stock freeze sanashdagi amallarni himoya qiladi; asl unit/precision rezerv/zona qoldig‘i borida o‘zgarmaydi. Brak sellable stockka qo‘shilmaydi, old ReturnDispositionEntry/TransferDispositionEntry jurnallarida qoladi.

Manual reserve ≤24h, release yoki exact-basket manager sale consume; expiry worker org-scope100/SKIPLOCKED/system audit, qayta ishga tushirish ta’siri0. Cash-ticket holdning expiry qoidasi ADR047da boshqacha: authorizationning tugashi noma’lum fizik tovarni avtomatik mavjud stockka aylantirmaydi. Zona limiti100/filial, rezerv100SKU; summa/quantity Decimal, frontend receipt cents BigInt.

## ADR047 — Oldindan tasdiqlangan exact basket uchun offline naqd ruxsat (2026-10-09)

Owner explicit yoqmaguncha offline cash o‘chiq. Filial bo‘yicha jami issued/unresolved ticket summasi owner maxAmount limiti ichida,30–300s authorization source sessiyaning idle/absolute expiryidan uzoq emas. Expired-but-unresolved ticket ham risk summasiga va stock holdga kiradi. Native PostgreSQL/Prisma advisory lock+stock reservation, Node Ed25519 va browser WebCrypto/IndexedDB yetarli; Redis yoki yangi vendor SDK kiritilmadi.

Source userning serverda saqlangan aniq drafti, mavjud kassa/filial/smena va deviceUUIDga lease beriladi. Bir lease uchun server belgilagan yagona cashOperationId. Qoralama va itemlar lease issued holatida o‘zgarmaydi; server/client idempotency oqimlari asl kalitni saqlaydi. Canonical JSON Ed25519 imzosi JSONB maydon tartibiga bog‘liq emas; per-ticket transient private key saqlanmaydi. DB canonical source payload/public key/signature authoritative; browser HTTPS orqali olingan original ticket hashini saqlaydi. Yangi self-signed client key server authorizationini almashtirmaydi.

Qurilmadagi ticket AES-GCM/PBKDF2 bilan userning12–200belgili iborasi orqali shifrlanadi; ibora serverga yuborilmaydi/saqlanmaydi. Static `/pwa/cash.html` va uch public JS module worker cachega kiradi; decrypted contents/API/private HTML/Next chunks/receipts kirmaydi. `prebuild` mavjud TypeScript compiler bilan uch aniq allowlisted client sourceni transpile qiladi, yangi bundler yo‘q. Static CSP faqat own-origin script/connectga ruxsat beradi; Next sahifalar nonce/strict-dynamicni saqlaydi. IndexedDB leases/actions bitta transactionda unused→pending, ikkita tab bitta ticketdan ikkita naqd amal yozmaydi. Asl server natijasi unknown bo‘lsa original action o‘chmaydi.

Offline faqat aniq SKU/quantity/total uchun cash; debt/card/transfer/provider calls/hardware yo‘q. Price/discount/tax quote serverda tayyorlangan; offline boshqa basket yoki narxga o‘zgartirish mumkin emas. Server-current time yakuniy authority; browser clock rollback fail-closed, source clock trusted audit/backdate deb olinmaydi. Offline revoke qurilmaga darhol yetmaydi: explicit amount/stock quota va qisqa TTL chegaralaydi. Reconnectda source user/session/role/register/store/shift/customer/current price/rule/tax/stock/expiry/policy tekshiriladi. Stale yoki revoked operatsiya automatik posting emas, original sync conflict. Savdo, cash payment, reservation consume, stock movement va audit bitta runOperation transactionda.

Cash lease expiry paytida tovar offline berilgan bo‘lishi mumkin. Shu sabab hold actual synchronized sale, ownerning dalil bilan tekshirilgan original savdoni qayd etishi yoki tovar qaytarilgan/berilmagan va sof cash refunded/never received physical proof orqali bo‘shaydi. No guessed provider outcome. Owner reconciliation original draftni void qiladi: eski queued payment qayta post bo‘la olmaydi. Committed sale yashirin bekor qilinmaydi, odatiy refund ishlatiladi. Unresolved lease borida shiftclose va local logout/scopeclear blok. Source-level terminal proof boshqa actorni impersonation qilmasdan local original ticketni ack qiladi. Local completed acknowledgement faqat minimal receipt IDs/total/change, customer PII/cost emas.

### ADR047 qo‘shimchasi — egasi tekshirgan asl offline savdo

Mijoz tovar bilan ketgan, ammo expiry yoki bloklangan original sessiya sabab oddiy sync rad bo‘lgan holat uchun live ownerning alohida `/settle` amali bor. U original signed davr ichidagi kuzatilgan savdo vaqti, haqiqiy goods+netcash, tender, yozma dalil raqami va sababni tasdiqlaydi. Original immutable basket/narx/soliq/tannarx saqlanadi; hisob yozuvi hozirgi server vaqtida. Bu taxminiy clock asosida backdate yoki original cashier impersonation emas. Actual owner payment.receivedBy/audit actor, source cashier/source operation IDs historyda qoladi. Original shift ochiq bo‘lishi shart, oddiy refund keyin ishlaydi. Expired hold shu verified settlement yoki haqiqiy goods/cash qaytarish proofidan keyingina bo‘shaydi. Source public proof original device navbatini duplicate payment qilmasdan ack qiladi; sync-review alohida owner evidencega tayangan holda resolve bo‘ladi.

Cash holdli SKU stock-count/opening/adjustmentdan himoyalanadi. Filialda100unresolved ticket technical cap va existing PostgreSQL per-actor rate limits(30write/120read/min) qo‘llanadi.080..081 evidence shape/owner/source IDs/server-scope constraints; applied migrationlar tahrirlanmaydi. Native Prisma/PostgreSQL, Node crypto va browser WebCrypto yetarli; yangi servis/SDK qo‘shilmadi.

## ADR048 — Katalog CSV/XLSX importida exact qiymatlar va alohida parser (2026-10-09)

Native stackda XLSX parser/writer bo‘lmagani uchun PLAN1 T03dagi ExcelJS4.4.0 qo‘shildi; rasmiy qo‘llanma https://github.com/exceljs/exceljs va npm metadata tekshirildi. PostgreSQL/Prisma/Zod va mavjud runOperation/audit/priceActor ishlatiladi, yangi import serveri yoki queue servisi yo‘q. Preview read-only; file hash va tenant-scoped validation natijasining confirmationHash'i exact yaratiladi. Commit original operationId bilan qayta live tekshiradi va butun valid-qatorlar guruhini transactionda qo‘shadi. PostgreSQL Operation natijasida line/product IDs, skipped/error rows, fileHash va audit qoladi; source file/token logga kirmaydi. Preview davrida persistent business/staging yozuvi yo‘q, shuning uchun modeldagi “preview hech narsa yozmasin” talabi saqlanadi.

Import faqat live owner, existing item update/stock/payment yo‘q. Existing SKU/primary/alias barcode va fayldagi takrorlar xatoli; kategoriyalar/birliklar existing own-tenant active konfiguratsiyaga bog‘lanadi. Noma’lum category/unit avtomatik taxmin qilinmaydi.512KB/1000qator/30ustun/4000belgi cell; parser2parallel native Worker,128MB heap,10s deadline, xatoda terminate. Workbook formula/hyperlink/date/object/multiple sheets rad; CSV map numeric coercion qilmaydi, narx/tannarx XLSXda matn sifatida yoziladi. Katta decimal/barkoddagi nol yo‘qolmaydi. Original uncertain confirmation IndexedDB durable intent bilan tiklanadi; fresh changed preview explicit qayta ko‘riladi. Native package serverExternalPackages standalonega traced bo‘lishi build/browser bilan tekshiriladi.

Dependency audit9findingdan mavjud sharp high uchun0.35.5 va source-map-js uchun1.2.2 kompatibil patch ishlatildi. Force downgrade ishlatilmadi. Braces eng yangi npm3.0.3 ham yangi advisory range ichida: tasdiqlanmagan versiya yoki fake fix yozilmadi; ESLint dependency findinglar va ExcelJS transitive uuid moderate holati ochiq audit dalilida kuzatiladi. QA-01.08 yoki production release security gate auditning o‘zi bilan avtomatik yopilmaydi.

### ADR048 runtime qo‘shimchasi

Webpack ham oddiy createRequire.resolve chaqirig‘ini numeric module IDga optimizatsiya qilishi aniqlangan. Node24 engine contractdagi `process.getBuiltinModule('module')` orqali native createRequire runtime olinadi; paket importi standalone tracing uchun saqlanadi. Workerga faqat haqiqiy module fayl yo‘li beriladi. Bu parser cheklovlarini kamaytirmaydi. Turbopack lokal port chekloviga duch kelgan muhitda Next rasmiy `next build --webpack` tekshiruvi ishlatiladi; asosiy npm build konfiguratsiyasi o‘zgartirilmagan.

## ADR049 — Filial onboardingida haqiqiy source va immutable tasdiq (2026-10-09)

React wizard, Zod va mavjud Prisma/PostgreSQL yetarli. Har filialning organization/register/import/opening/staff/sale tasdiqlari OnboardingCheckpoint82da original source proof, actual owner va server vaqti bilan saqlanadi. Checkpoint va audit runOperation transactionida, source hash stale bo‘lsa tasdiq rad. Keyin source bloklansa tarixiy tasdiq o‘zgarmaydi, joriy progress incomplete bo‘ladi. Yangi SKU yoki sale avtomatik taxmin qilinmaydi. Qoldiq faqat mavjud stock-document approval orqali, savdo faqat odatiy POS orqali yaratiladi; lokal /training actual savdo deb sanalmaydi.

Original unknown HTTP javob IndexedDB durable intentdan qayta tekshiriladi. Bir xil `/onboarding` pathidagi keyingi bosqich oldingi local intentni ushlab qolmasligi uchun status revision o‘zgarganda mutation remount qilinadi. Organization/user/store almashganda wizard scope ham remount. UI foydalanuvchiga bosqich, filial, source count/receipt va sababni ko‘rsatadi; ichki proof JSONni mahsulot oqimiga chiqarish shart emas. Hardware/fiskal/Click integratsiyasiz actual core onboarding tekshiriladi.

## ADR050 — Tovar almashtirishda atomik original qaytarish va yangi savdo

Mavjud createDraft, completeSale va returnSale financial engine saqlanadi; transaction ichida qayta ishlatiladigan Tx funksiyalari ajratildi. SaleExchange83 original Sale/SaleReturn/replacement Sale bilan foreign keys va immutable source/actor/net amount proofni bog‘laydi. Manager explicit quote/hash/reasonni tasdiqlaydi; return→draft→complete→exchange/audit bir runOperation transactionida. Stock/credit/audit failure original returnni ham rollback qiladi. Keyin oddiy refund original payment/tax/cost snapshotlarini ishlatadi, almashgan tarix yashirin qayta yozilmaydi.

Ichki cash/credit qo‘llanadi. External/card/transfer refund bu oqimda taxmin qilinmaydi. New credit yoki outstanding credit qaytsa original customer shart. Naqd farq = yangi cash gross − original cash refund; qarz farq = yangi credit − actual old debt reduction (waived liability qarzga qayta qo‘shilmaydi). Gross payment journals offset qilib net smena puliga mos keladi. Actual physical tender/change/refundDue alohida Exchange proofda; yangi sale fullgross cashTendered NULL. UI ikkala savdoda farq va physical tenderni ko‘rsatadi. Native money Decimal, vendor API/hardware yo‘q.

Previewda tasodifiy SaleItem ID va qiymatga ta’sir qilmaydigan priceSnapshot.asOf hashga kirmaydi; actual rule/version/price/tax/qty/cost/settlement kiradi. Rule davri tugashi yoki source narx/qarz o‘zgarishi stale reviewga olib keladi. Hash bu permission o‘rnini bosmaydi: har commit actual live manager/branch/open shift tekshiruvi saqlanadi. Original lost response faqat saqlangan operationId/body bilan qayta tekshiriladi.

## ADR051 — Ichki fon ishlarida PostgreSQL lease va immutable authorization

PostgreSQLning SKIP LOCKED, conditional UPDATE, transactions va mavjud Node worker runtime yetarli. Redis/BullMQ yoki broker qo‘shilmadi. BackgroundJob84 immutable tenant/type/payload, attempts/nextRunAt/state/lease/heartbeat/result; JobAuthorization har original/manual retry generation uchun actual owner/user/session/reason proof; JobEvent immutable lifecycle.20activejob/tenant, source4KB,30slease/5sheartbeat,3attempt/generation va jami10generation/30attempt. Texnik cap exhaustion ko‘rinadi; original operation replay capacitydan keyin ham yangi job yaratmaydi.

Worker DBdan original source’ni qayta oladi: in-memory payload scope’ni almashtirmaydi. Current session/owner va active selected branch boshlash hamda commitda tekshiriladi; final user/session/membership share lock qisqa commit oralig‘ida revoke race’ni yopadi. Clock_timestamp haqiqiy expiry tekshiruvi uchun, old transaction NOW vaqtiga suyanilmaydi. Incident/result/system audit va lease-fenced success bir transactionda. Eski lease callbacki natija yozmaydi; acknowledgement yo‘qolsa actual terminal state old failure callback tomonidan qayta queued qilinmaydi. Source grant revoked bo‘lsa dead; owner retry yangi authorization, original source/history o‘zgarmaydi. Worker actual actor null, callerni impersonation qilmaydi.

Birinchi allowlisted handler ichki reconciliation; HTTP endpoint, raw SQL, vendor request yoki fabricated payload executor yo‘q. Tashqi integratsiya kelganda source idempotency/provenance alohida contract bilan qo‘shiladi. Job va authorization/eventlar encrypted PostgreSQL backupda saqlanadi; actual dead-state/history restore tekshiriladi. Ilk filial yuklanishi typed reasonni yo‘qotmasligi uchun owner wizard org/user scope’da qoladi; explicit review stored branch name bilan, original pending action body esa durable saqlanadi.

## ADR-052 — Hisob xavfsizligi tarixi va ilova ichidagi bildirishnomalar

SEC-02.09 mavjud PostgreSQL/Prisma, Node worker va React bilan bajariladi. Tashqi xabar provayderi kerak emas: mas’ul qabul qiluvchi — kirish urinishi tegishli bo‘lgan foydalanuvchining o‘zi. Ilova uning boshqa bizneslardagi sessiyalarini ham ko‘rsatadi; boshqa foydalanuvchi yoki barcha xodimlarning xavfsizlik tarixini bu endpoint ochmaydi. Biznesdagi membership keyin arxivlansa ham faol global hisob o‘z tarixini ko‘radi. Global bloklangan hisobga worker xabar yetkazmaydi.

085 migration SecurityEvent, SecurityNoticeOutbox, SecurityNotice yaratadi. Session INSERT va birinchi revoke SQL triggerlari registration/login/biznes switch/PIN/ownership/logout/password/member revoke yo‘llarini qamrab oladi. Sessiya identifikatori immutable snapshot; Sessionga yangi FK qo‘yilmaydi va moliyaviy/offline/job proof uchun saqlanayotgan Session o‘chirilmaydi. Mavjud auditning parol/PIN/membership/ownership amallari faqat type/id/time bilan xavfsizlik tarixiga o‘tadi. Audit afterData yoki token bu tarixga nusxalanmaydi.

Parol orqali kirishda hisob row locki ostida joriy active user, passwordHash va membership qayta tekshiriladi; session + muvaffaqiyatli kirish hodisasi + audit + lastLoginAt + limitni tozalash bitta transactionda. Javobdagi rol shu transactiondagi membershipdan olinadi. Noto‘g‘ri parol 401 javobini saqlaydi va known active account hodisasini alohida commit qiladi; auditor actor=null, chunki noto‘g‘ri parol egasining shaxsi tasdiqlanmagan. Unknown account uchun persistent user hodisasi yaratilmaydi.

Birinchi parol kirishi brauzer belgisi uchun baseline. Keyingi avval ko‘rilmagan SHA-256(deviceUUID + bounded User-Agent) belgisi suspicious; deviceUUID optional, eski API foydalanuvchilari UA hint bilan ishlaydi. Bu autentifikatsiya omili yoki qurilma/joylashuvning isboti emas; browser storage tozalanishi/UA yangilanishi ham ogohlantirish chiqarishi mumkin. Raw UUID/UA, telefon, IP, parol, PIN, token va hash DTO/audit/message/logga chiqmaydi. Oxirgi15min ichidagi uchinchi noto‘g‘ri paroldan boshlab suspicious. Bir hisob/type uchun UTC15min bucketda bitta outbox — chegara oshsa yangi bucketda yangi ogohlantirish mumkin. Mavjud5/15min login rate-limit va uniform credential xatosi saqlanadi.

Node jobs worker DB-only outboxni SKIP LOCKED bilan oladi, actual faol qabul qiluvchi userni tekshiradi va inbox + system audit(actor=null) + delivered holatini atomik commit qiladi. Old login sessiyasi revoked bo‘lishi xabarni to‘smasligi kerak. Uniq eventId takroriy inboxni rad qiladi; transaction xatosi inbox/auditni rollback qiladi, bounded backoff60s. Applied085 o‘zgarmaydi;086 additive maxAttempts guard bilan dead xabarni hisobning o‘zi yangi operationId bilan qayta tasdiqlaydi: +3budget, old attempts saqlanadi, jami30. Revoke/foreign/expired source/not-dead/cap30 rad; retry actual actor bilan audit va Operationda saqlanadi. Eski muvaffaqiyatsiz worker yangi retry budgetini demote qila olmaydi.

History va inbox90kun. Worker ko‘pi100expired security events/batchni tozalaydi; pending/dead xabar muddati tugaganda system audit yoziladi. Event bilan faqat uning notice/outbox metadata-si cascade o‘chadi. Audit va moliyaviy/offline Session identities purge qilinmaydi; session history API90kunlik safe metadata qaytaradi. Umumiy AuditLogning alohida retention siyosati bu vazifa bilan o‘zgarmaydi. Header polling ko‘rinadigan oynada60s; security GET gateway va handler no-touch auth qiladi, idle expiry uzaymaydi. Read/retry esa foydalanuvchining aniq amali bo‘lib default touch va live transaction tekshiruvini saqlaydi.

Worker ishga tushirilishi production operatorining release tartibiga kiritiladi. In-app delivery ishlaydi; SMS/e-mail/Click/fiskal/hardware integratsiyasi, MFA yoki password reset shu qaror bilan implementatsiya qilinmaydi.

## ADR-053 — Mahsulot tasnifi va tashqi markirovka chegarasi

CAT-01.09 mavjud Prisma/PostgreSQL, Zod va React orqali bajariladi. Owner mahsulotning MXIK kodi, tekshirilgan manba qaydi hamda MXIK/soliq/markirovka majburiyligini sabab bilan belgilaydi. Ushbu qayd rasmiy katalog yoki huquqiy tasdiq o‘rnini bosmaydi; kod formatlari taxmin qilinmaydi.

Majburiy MXIK va manba yo‘q bo‘lsa yoki kuchga kirgan soliq versiyasi yo‘q bo‘lsa checkout atomik bekor qilinadi. Markirovka majburiy mahsulot uchun haqiqiy integratsiya tayyor bo‘lmaguncha 503 qaytariladi. Bunday savatga offline naqd ruxsat ham berilmaydi. Oddiy mahsulotlar uchun yangi majburiy shart yo‘q. Real fiskal/Click/hardware implementatsiyasi qo‘shilmadi.

Tasnif checkout paytida mahsulot row locki ostida qayta tekshiriladi va SaleItem.complianceSnapshot ichida muzlatiladi. Keyingi katalog tahriri original chekni o‘zgartirmaydi. 087 migration completion uchun deferred DB guard va matn uzunligi cheklovlarini qo‘shadi. Owner-only tahrir mavjud serializable runOperation, original operationId, audit va IndexedDB orqali natija noma’lum bo‘lgandagi tiklash oqimidan foydalanadi.

## ADR-054 — Savdo birligi va asosiy ombor birligi

Mahsulotning Product.unit maydoni asosiy birlik bo‘lib qoladi. ProductUnitConversion owner tasdiqlagan tradeUnit/baseUnit/ratio aloqasini saqlaydi; ratio Decimal(14,6). Bir savdo birligi asosiy birlik aniqligiga to‘liq sig‘ishi shart: qoldiq yashirin yaxlitlanmaydi. Birlik o‘zgartirish va nisbat tahriri original operationId bilan audited runOperation orqali bajariladi. Konvertatsiyasi mavjud SKUning asosiy birligini o‘zgartirish uchun yangi mahsulot kerak.

SaleItem va StockDocumentItem original tradeQuantity/tradeUnit/baseUnit/ratio JSON snapshotini saqlaydi; quantity, unitPrice va unitCost asosiy birlikda qoladi. Shu sabab mavjud stock/payment/profit/tax/discount/allocation hisoblari o‘zgarmaydi. Bir SKUning bitta hujjatdagi aralash birliklari rad etiladi; ayni birlikdagi takror qatorlar bazaviy miqdorda birlashtiriladi. Current conversion checkout, stock confirmation va offline ticket chiqarishda qayta tekshiriladi; o‘zgargan nisbat uchun ochiq savat qayta ko‘rib chiqiladi.

Kirim tannarxi asosiy birlik uchun kiritiladi, UI buni ochiq yozadi. Savdoda qaytarish uchun default quantity asosiy birlikda; original tradeUnit ko‘rsatilsa faqat original chekning muzlatilgan ratio si ishlatiladi. Keyingi katalog nisbati original pul va stockni qayta yozmaydi. Reversal original snapshotning manfiy tradeQuantity qiymatini saqlaydi. POS barcha hisoblarni base quantity bilan bajaradi; trade unit tanlash miqdorni1 va chegirmani0 ga qaytarishi UI da yozilgan. Konfliktni yangilash trade tanlovini asosiy birlikka qaytaradi va qayta tasdiq talab qiladi.

088 additive migration, ratio/unit FK va snapshot quantity DB guards. Unit va Product kompozit relationlari Prisma schemada SQL FKlariga mos NoAction bilan ifodalangan. Unit catalog aniqligi/active holatini in-use trade unitda o‘zgartirish bloklangan. Real hardware/fiskal/Click qo‘shilmadi.

## ADR-055 — PostgreSQL SSI: mustaqil kassalar uchun tor o‘qish

50k mahsulot/1m draft qator/20 kassa testida dastlab concurrent conflict ko‘p bo‘ldi. Real pg_locks probe kichik Register/Shift jadvallari sequential readida relation-wide SIReadLock va Operation missing-key unique-index gaplarini ko‘rsatdi. Isolation SERIALIZABLE qoladi. runOperation ichida enable_seqscan=off va jit=off faqat transaction-local: tor indexed predicate reads tanlanadi, indekssiz scanlar imkoniyati qoladi. Read/report so‘rovlarining global planner konfiguratsiyasi o‘zgarmaydi.

Operation identity select(id) transaction ochilishidan avval tekshiriladi; bu authorization yoki result emas. Transaction joriy session/user/membership/branchni tekshiradi, original key advisory lockini oladi va mavjud recordni PK bo‘yicha qayta o‘qib tenant/type/key/actor/hash/cancellationni tasdiqlaydi. Probe va lock orasida shu key commit bo‘lsa unique conflict yoki stale409dan keyin faqat exact committed key mavjudligida fresh transactionga retry qilinadi. Business work + Operation + deferred constraints commit atomik; uch urinish chegarasi saqlanadi.

Checkout Payment.saleId FK indekssiz edi va receipt include/journal tekshiruvi relation-wide predicate lock olib boshqa kassa insertlari bilan to‘qnashdi. 089 saleId,090 shiftId/paymentType/status concurrent indexes. Har migrationda bitta concurrent statement; failed test089 recordi rolled-back bo‘lib, hali qo‘llanmagan fayl tuzatildi. Applied migrationlar tahrirlanmadi. 20 parallel owner kassa, bir itemli100 cash checkout,100 search:0 error; p95 search304.75ms/checkout140.56ms. Bu isolated service-level synthetic dalil, public network/real pilot/katta savat yoki vendor SLA kafolati emas.


ADR-055 qo‘shimcha qabul (2026-10-09): fresh profildagi birinchi qayta o‘lchov97checkout/98search/1exhaustedSSI conflict bilan muvaffaqiyatsiz bo‘ldi. Deterministik retry delay parallel transactionsni bir vaqtda qayta to‘qnashtirayotgan edi; Node crypto.randomInt orqali bounded20–80/40–160ms jitter, unchanged3attempt va SERIALIZABLE. Fresh profile ketma-ket ikki run:100/100search,100/100checkout,0errors; p95 search388.87/393.69ms, checkout132.23/114.99ms. Failed run saqlanadi, yashirilmaydi.

Katta regressiya fixture cleanupi InventoryBalance.productId FK scanini aniqladi:091 concurrentindex qo‘shildi, Product FK uchun source index Prisma bilan mos. Count/checkout deadlock uchun startCount Productlarni id tartibida stock advisorylockdan oldin lock qiladi; FK insert keyshare va checkout FORUPDATE orasidagi inversion yo‘qoladi. Applied088–090 tahrirlanmagan.


## ADR-056 — Katta katalog eksporti mavjud worker navbatida

Owner tasdiqlagan catalog_export mavjud source authorization, lease fencing,heartbeat,retry/deadletter orqali bajariladi. Product/category/barcode batch query, cursor500 va RepeatableRead snapshot;UI pagination qo‘llanmaydi.100000rows/16MiB perfile/32MiB activeorg artifactbudget. CSVexactDecimaltext/formula protection. DBJobExport bytes sourcejob+tenant FK bilan; historyimmutable,24hexpired bytes null orqali erasure. Fayl publicdisk/URLga chiqmaydi;GETowner livecontext,tenant,state,expiry,size/SHA256 va bounded download budgetni tekshiradi, audit/no-store/nosniff.

Queued/retry sourceexpiry1h, artifactexpiry24h alohida. Revoke/lease loss/lateaudit finalpublicationni rollback qiladi; claim/worker retry bittaartifactni publish qiladi. Natija/audit faqat filename/mime/size/SHA/rowcount/asOf/path metadata; CSV content listAPI/auditlogda yo‘q. Artifactquota lock orgbo‘yicha, old expiredbytes worker tomonidan prune qilinadi. Vendor yoki yangi queue/storage technology qo‘shilmagan.


ADR-056 delivery qo‘shimchasi: authenticated owner export native64KiB copied chunksda beriladi; jarayon bo‘yicha2active source buffer,5min transfer deadline, EOF/cancel/abort/error slotni bir marta bo‘shatadi. Band slotda429 va Retry-After3. UI authenticated bounded fetch→Blob download ishlatadi; WebKit binary CSP attachment navigation muammosi uch browserda tekshirilgan. 16MiB artifact va32MiB organization quota saqlanadi.

### ADR-057 — Mijozning alohida naqd avansi
Mavjud FinancialDocument/AccountEntry/CashMovement va DebtEntry ustiga immutable CustomerAdvance/Allocation/Refund jurnallari qo‘shiladi. Receive haqiqiy cash bookga bir kirim; allocate cash payment yaratmaydi, exact sale/opening debtni kamaytiradi; unused refund original advance va yangi haqiqiy cash-out hujjatiga bog‘lanadi. Money Decimal(14,2), org/customer/source/amount/budget SQL guards; original operation key va SERIALIZABLE. Allocation Sale→Customer→Advance tartibida lock oladi, return bilan teskari tartib qilmaydi. Avansdan to‘langan savdo qaytarmasi mavjud cash Payment.out orqali yoziladi, walletga avtomatik credit qilinmaydi; cash-outni ikki jurnalga takror yozmaydi. Faqat cash supported, bank/provider/fiscal vendor specific yo‘q. Mavjud collectDebt implicit overpayment reject saqlanadi. Advance available qarzdan alohida; original identity/history o‘zgarmaydi.094applied alias conflict095additive bilan tuzatilgan,094tahrirlanmagan.

### ADR-058 — Operator maintenance admission va queue saqlash
Existing Nodefs va PostgreSQL runOperation ishlatiladi, yangi vendor/cache/queue texnologiyasi yo‘q. Operator-owned ≤4KiB strict flagfile safe regular/O_NOFOLLOW/no group-world-write, failure503; atomic fsynced renameCLI. Allinstancelar directorymount orqali holatni ko‘radi. Durable mutationguard original-authorized committedreplaydan **keyin**, yangi workdan **oldin**; transactionadmittedworkni rollback qilmaydi. Worker nextcycle claimpause; existingcycle finish/gracefulSIGTERM. Readiness503 va no-store authenticated notice; client basket/pendingkeyni o‘chirmaydi yoki avtomatik resubmitqilmaydi. Next16.3.8 local deploymentIddocsga ko‘ra native NEXT_DEPLOYMENT_ID; host/CDN release routing alohida. Generic/non-durable metadataCRUD universalblock debclaimyo‘q, controlledwindowoperatorrunbook bor.

ADR-057 lock-order refinement: receive/refund cashAccount locks Account→Shift **before** Customer; originalAdvance lock follows Customer. This matches existing finance Account→Shift and return Shift→Customer ordering. Allocation still Sale→Customer→Advance. Controlled real-PostgreSQL blockedShift test verifies Customer remains acquirable while a receipt waits, with no economic posting duplicates.

## ADR-059 — Tasdiqlangan SaaS-first biznes modeli (2026-10-10)

Mahsulot egasi ushbu suhbatda SaaS-first oylik obunani tasdiqladi. UZS: Start99000/oy (1filial/1kassa/3xodim), Business249000/oy (3/5/15), Pro499000/oy (10/20/50). Limitlar tashkilot bo‘yicha jami. Trial yangi tashkilotga bir marta14kun, Pro limitlarida; expiry/trialdan keyin7kun grace amaldagi imkoniyatlar bilan. Keyin yangi savdolar bloklanadi, read/export saqlanadi, avtomatik delete yo‘q. To‘lov tasdiqlanganda imkoniyatlar tiklanadi. Narx/limit bazada administrator tahrirlaydigan versiyalangan konfiguratsiya; eski ma’lumot limit pasayganda o‘chmaydi. Hozirgi tashkilotlar avtomatik enrollment/block emas: administrator alohida tasdiqlangan ko‘chirish qiladi.

Bir codebase va Docker artefakt; asosiy support doirasi hosted SaaS. Lokal deployment/offline litsenziya alohida release va support contracti, hozir tijoriy va’da yo‘q. Operator: hosting/TLS/backup/monitoring/migratsiya; biznes egasi: xodim/filial vakolati, physical cash/stock va haqiqiy hujjatlar. Real Click yoki taxminiy vendor billing yo‘q. Ushbu tasdiq BIZ-01.01 qarorini yopadi; qolgan billing bandlari implementatsiya va gate yakunlanguncha ochiq.

## ADR-060 — Yetkazish provaydersiz xavfsiz auth core va support taklifi

Egasi SMS/e-mail provayderi tanlanmaguncha real yetkazishni kechiktirdi. Almashtiriladigan interfeys, muddati cheklangan bir martalik kod/token, urinish/resend/rate chegarasi va production mockni rad qilish talab qilindi. Core PostgreSQL tranzaksiyalari va mavjud Node crypto bilan ishlaydi: HMAC OTP, hash reset token, HKDF ajratilgan AES-GCM encrypted outbox. Maxfiy kod bazada plaintext yoki logda yo‘q. Private AUTH_CHALLENGE_SECRET konfiguratsiyasi kerak; default kalit yo‘q. Yetkazilmagan challenge tasdiqlanmaydi. Provider registry bo‘sh, real yetkazish endpointlari xavfsiz503 beradi. TOTP interfeysi tayyor, enrollment va global muhim amallar MFA enforcementi hali bajarilmagan; bu mavjud to‘liq MFA sifatida reklama qilinmaydi.

Egasi support ticket core yaratishni tasdiqladi. Du–Sh09–18 Asia/Tashkent, birinchi javob4ishsoati — dastlabki ichki taklif, rasmiy kafolat emas. Administrator versiyalangan DB konfiguratsiyani o‘zgartiradi. Faol haqiqiy platforma operatoriga biriktirish, oddiy/muhim/kritik, alohida first-response/first-resolution, original-key replay va o‘zgarmas tarix mavjud. Telefon/e-mail/Telegram yoki favqulodda mas’ul uydirilmaydi. Real kanal, rasmiy SLA va insonning bajarish tartibi tasdiqlanmaguncha tegishli band blocked_external; ichki core tugashi original bandni avtomatik done qilmaydi.

## ADR-061 — Barcha APIlar uchun umumiy admission himoyasi

Mavjud PostgreSQL RateLimit va withApi saqlanadi; Redis, tashqi WAF yoki yangi servis qo‘shilmaydi. Protected requestlar tashkilot+actor bo‘yicha default600read/300write per minute, mavjud tor limitlar bilan birga. Public auth writes default1200/minute: faqat aniq TRUST_PROXY_IP va valid IPga ishoniladi, aks holda shared unattributed bucket; health/logout ushbu generic limitdan mustasno. Qiymatlar bounded environment konfiguratsiyasi, tijoriy throughput/SLA va’dasi emas. Productionda xato konfiguratsiya failclosed.

Body≤1MiB va default10s stream deadline, moliyaviy handler/tranzaksiyani yo‘lda abort qilish yo‘q. Import overflow413 va parser workerning bounded memory/concurrency/deadline chegarasi. Original economic key429da pending qoladi, browser lost-ACK→429→reload→same-key committed replay bir invoice bilan isbotlanadi. Reverse proxy TCP/header/flood va actual hosting deployi bu application acceptance bilan avtomatik bajarilgan deb hisoblanmaydi.

## ADR-062 — Xizmatdan chiqish va retention bo‘yicha dastlabki biznes qarori (2026-10-10)

Mahsulot egasi tasdiqladi: obuna tugaganda mavjud 7 kun grace, undan keyin read-only; obuna tugagan sanadan 90 kunlik saqlash rejasi. Shu davrda owner eksport va qayta faollashtirishni bajara oladi. Yopish faqat faol vakolatli ownerning qayta tasdiqlangan autentifikatsiyasi bilan; 30 kun ichida bekor qilish imkoniyati, qonuniy majburiyatlar ustuvor. Yopilgan tashkilotda yangi savdo va faol business operatsiyalari to‘xtatiladi; xavfsiz eksport yopishdan oldin mavjud bo‘ladi.

Retention administrator konfiguratsiyasida boshqariladi. Moliyaviy hujjat, audit, shaxsiy ma’lumot, texnik log va backup alohida toifalar: barchasiga avtomatik 5 yil berilmaydi. Mahsulot egasi tegishli buxgalteriya toifalari uchun hisobot yilidan keyingi kamida 5 yil talabini tekshirishni belgiladi; bu yozuv mustaqil huquqiy xulosa emas. Yakuniy qonuniy toifalar va o‘chirish muddatlari alohida tasdiqlanadi. Avtomatik qaytarib bo‘lmaydigan o‘chirish hozir implementatsiya qilinmaydi; ushbu qism `blocked_external`. Eksport, read-only, yopish/bekor qilish va retention konfiguratsiyasi core ishlari ruxsat etilgan. Bu qaror implementation yoki BIZ-02.07 `done` dalili emas.

## ADR-063 — Aniq API admission matritsasi va tarixiy chek rekvizitlari (2026-10-10)

243 himoyalangan route/method juftligi `route-permissions.ts` da explicit ko‘rsatiladi. Noma’lum path/method/role default403; mavjud owner/admin/cashier admission imkoniyatlari saqlanadi. Matritsa DAL vakolati o‘rnini bosmaydi: tenant/filial/shift/private DTO, manager tasdig‘i, platform operator va support grant tekshiruvlari davom etadi. Yangi endpoint tests inventory va matritsa reviewisiz ochilmaydi. HEAD faqat explicit HEAD bo‘lmasa GET vakolatiga tushadi.

Migration109 `Sale.receiptSnapshot`ni yakunlash tranzaksiyasida haqiqiy organization/store/register/cashier ma’lumotlaridan yaratadi. Posted snapshot immutable; draftda client taqdim etgan snapshot o‘chiriladi. Eski posted tarixga taxminiy backfill qilinmaydi. 58/80 mm nusxalar tarixiy rekvizitdan chiqariladi; eski cheklar metadata yetishmasligini aniq bildiradi. Bu real printer, fiskal yoki SMS/e-mail yetkazish implementatsiyasi emas. Retention ADR-062 mustaqil keyingi core ish sifatida qoladi.

## ADR-064 — Retention rejasi va o‘chirish vakolati ajratiladi (2026-10-10)

ADR-062 dagi90/30 kun va moliyaviy toifalar uchun5yillik dastlabki biznes taklifi migration110 immutable policy versiyasida saqlanadi. Audit/technical/backup muddatlari alohida nullable — tasdiqlanmagan holatni boshqa muddat bilan to‘ldirmaymiz. Platforma administratori reason/expectedVersion/original key bilan yangi versiya chiqaradi; oddiy owner faqat xavfsiz rejani ko‘radi. Ichki author/reason ownerga berilmaydi. SQL tarix/creator/current pointer guardlari va fresh operator authorization replayga ham qo‘llanadi.

Grace tugagach hisoblangan plannedReviewAt actual subscription/trial period end+configured days; deadline yetishi faqat reviewDue, avtomatik purge authorization emas. Legacy tashkilotga sun’iy tugash sanasi yo‘q. Global konfiguratsiyani o‘zgartirish ma’lumot o‘chirmaydi, legacy purge workerlarni yashirin almashtirmaydi va organization close funksiyasini yoqmaydi. Full export/close/cancel/read-only enforcement core qolgan; huquqiy toifalar va irreversible deletion blocked_external. BIZ-02.07 hali done emas.

## ADR-065 — Ko‘chma tenant eksporti va credential xavfsizligi (2026-10-10)

BIZ-02.07 eksport core mavjud PostgreSQL background job/worker, Prisma RepeatableRead va bounded16MiB artifact orqali bajariladi; yangi storage/vendor/SDK qo‘shilmaydi. Barcha filiallarning reviewed biznes datasetlari bitta JSON+manifestga, Decimal string va fayllar base64 sifatida chiqariladi. Har model uchun explicit scope/omission va schema fingerprint yangi maydonni reviewisiz ochmaydi. Session/auth/invitation/worker/provider credentials va credential qaytarishi mumkin bo‘lgan Operation result eksport qilinmaydi; ichki audit/proof/diagnostics payloadlarining chiqarilmagani manifestda aniq ko‘rsatiladi. Bu PostgreSQL backup/restore emas.

Current owner/password authorization original enqueue/retry replaydan oldin, worker boshida/yakunida va download paytida tekshiriladi. Artifact, job success va audit atomik; original key recovery bitta job. Oversize/unreviewed/corrupt export qisman nashrsiz dead state, owner sababni tuzatgach alohida retry; temporary failure bounded retry. Migration111 applied bo‘lgach lastError SQL cheklovi sinovda topildi va additive112 bilan tuzatildi;111 qayta yozilmadi. Eksport core BIZ-02.07ni avtomatik done qilmaydi: close/cancel/read-only va yakuniy huquqiy qabul qoladi.

## ADR-066 — Subscription read-only DB va original intent himoyasi (2026-10-10)

Grace tugagach yangi biznes work to‘xtaydi:74 reviewed business table root/parent tenant SQL guard, runOperation yangi work tekshiruvi va terminal Operation INSERT wall-clock check. Original committed actor/hash result expiry paytida ham qaytariladi; revocation/cancellation/hash mismatch authorization chegaralari saqlanadi. Business-write allowance subscriptionPhase/API flag orqali ko‘rsatiladi. Legacy enrollment yo‘q tashkilotlar avtomatik bloklanmaydi. Billing renewal, eksport/reconciliation jobs, auth/security/support/platform recovery exact exceptions; exception nomi orqali Product/Payment/Stock yozuvini yashirib o‘tkazish DB guardda rad etiladi.

Organization shared lock va subscription FOR SHARE stale Serializable snapshotni retry qiladi. Sale quota obyekt emas: yangi capacity guard shared entitlement bilan Sale uchun oldingi tenant-wide lock upgrade xavfini olib tashlaydi; branch/register/staff quotas va stock/shift/register fencing saqlanadi. Muddati tugagan manual reservation faqat system expiry ledger/remaining0/status expired housekeepingga ochiq; physical stock o‘zgarmaydi. Sale.create uchun actor/hash-bound cancelled:true unposted tombstone iqtisodiy posting bo‘lmagani uchun tor SQL istisnoga ega; completed state/boshqa type foydalanmaydi.

113 applied bo‘lgach polimorf trigger record fieldlari jadvalga ajratish114 bilan tuzatildi;115 snapshot/shared-sale lock,116 unposted cancellation compatibility additive. Applied migrationlar qayta yozilmadi. Product/category legacy UnknownRequestError shared API mapperga uzatiladi; read-only failure HTTP409, secret SQL details yashiriladi. Close/cancel owner reauthentication va closure lifecycle boshqa core ish, legal hold/irreversible deletion tashqi tasdiqda qoladi. BIZ-02.07 done emas; bu qabul yangi original band sifatida sanalmaydi.


## ADR-067 — Owner reauthenticated organization closure (2026-10-10)

Mavjud Prisma/PostgreSQL, bcrypt, operation journal, tenant export/worker va React UI qayta ishlatiladi; yangi vendor/SDK yo‘q. Owner password sessiyasi va joriy parol close/cancel hamda original replayda transaction ichida qayta tekshiriladi. Bu MFA emas. Credential operation/hash/result/audit/browser storagega kirmaydi; rate5/15min. Real downloaded tenant artifact va owner download audit dalili; faol smena/draft/provider/offline ish bo‘lsa closure rad etiladi.

Policy version/kuni va deadline immutable snapshot. Tenant FOR UPDATE/FOR SHARE hamda ichki closureRevision tuple fence stale Serializable snapshotni retryga majbur qiladi. Revision faqat nested closure trigger orqali increment; yangi scalar eksportdan omit; OrganizationClosure reviewed metadata eksport qilinadi.74 biznes table va terminal Operation guard closurega ham qaraydi. Cancel obunani yangilamaydi; deadline review_required, deletion yo‘q.117 applieddan keyin terminal state/source/reason guards additive118 orqali kuchaytirildi. Huquqiy/legal hold toifalari, irreversible deletion va limitdan katta tenant eksporti asl BIZ-02.07 qabulida ochiq qoladi.

## ADR-068 — TOTP maintained kutubxona va ichki faktor/proof core (2026-10-10)

T07 baselinega TOTP algoritmini beradi deb hisoblamaydi va o‘z OTP protokolini yozishni taqiqlaydi. OTPAuth9.5.2 MIT exact, maintainer API/RFC vektorlari asosida; mustaqil security audit da’vosi yo‘q. Secret160bit, SHA1/6digits/30s/±1step; user/factor AAD bilan AESGCM, AUTH_CHALLENGE_SECRETdan purpose-separated HKDF. Faktor/stepup proof credential sifatida tenant eksportdan butunlay omit. Yangi persistence/guardlar119–120 additive. User→Session lock tartibi password-change/reset bilan mos; wrongattempt commit, counter/proof/audit atomik; proof action/key/hash/sessionga bog‘langan, revoke/passwordchange yopadi. Qabul contract: `docs/operations/totp-core.md`. HTTP/UI/recovery/global enforcement tayyor bo‘lmaguncha totp availabilityfalse va SEC02.06 in_progress; mavjud biznes funksiyalariga rollout yo‘q. Kalit rotation/deployment uchun production credential/operator qarorlari alohida; eski ciphertextni plaintextga aylantirish yo‘q.

### ADR-068 qo‘shimcha — opt-in HTTP/UI va recovery121

Hashed recovery10×128bit/365day, fresh password+new TOTP rotation, current password+backup recovery/all-session revocation va immutable expiry/one-use SQL121. Own-account metadata va6HTTPaction explicit role matrix; default flagfalse, configured privatekey+flagtrue bo‘lsa availabilitytrue. Exact reviewed credential presentation (enroll URI/confirm+rotate10codes) generic sanitizationdan faqat shu successDTO uchun chiqadi; generic row/hash/unknown/malformed/error credentials filtrlanadi. React memory-only UI va double-submit latch, lostACK status/rotation recovery; no storage secret. General step-up helper TOTPni qo‘llaydi, runOperation originalkey transaction rollback/replay bilan qabul qilingan; global critical-action/platform enforcement bo‘lmaguncha SEC02.06 done emas. Backup/recovery DTO ciphertext/keyrotation oxirgi qabul ochiq, realSMS/email/vendor yo‘q.

## ADR-069 — Muhim operationlar uchun opt-in markaziy MFA (2026-10-11)

Mavjud runOperation authorization bosqichi va action/key/hash/session-bound proof ishlatiladi. AUTH_CRITICAL_MFA_REQUIRED availabilitydan mustaqil: TOTP outage talabni chetlab o‘tmaydi; noto‘g‘ri konfiguratsiya fail-closed. 12 reviewed kritik operation turi, asl javob replays ham tekshiriladi, platform vakolati alohida saqlanadi. Default false bilan mavjud biznes oqimlari saqlanadi; production rollout hali amalga oshirilmagan. Dashboard React modal + mavjud API client; credential memory-only, original serialized body/key bir marta retry, cancel/timeout/unmount/account switch xavfsiz bekor qilish. Yangi kutubxona/vendor yoki schema yo‘q. Barcha dangerous mutationlar to‘liq inventory qilinmaguncha SEC-02.06 done qilinmaydi. Contract: docs/operations/totp-core.md.

## ADR-070 — Maxsus rollar mavjud asosiy rolni cheklaydi (2026-10-11)

USR-01.06 uchun alohida RBAC SaaS qo‘shilmaydi. PostgreSQL CustomRole tashkilotga tegishli, owner tomonidan boshqariladi; asosiy rol admin yoki cashier. Profil faqat reviewed route/method admission xaritasidagi asosiy rolga ruxsat etilgan subsetni beradi. Shaxsiy account/auth va tashkilot tanlash saqlanadi; tenant/branch/resource/approval va mustaqil platform/support DAL nazorati davom etadi. Owner profil orqali yaratilmaydi. Omborchi, Buxgalter, Kuzatuvchi — owner uchun aniq, tahrirlanadigan namunalar; mavjud xodimlar o‘zgarmaydi.

Profil tahriri expectedRevision + original operation identity bilan; source/base-role/author immutable. Vakolat yoki faol holat o‘zgarishi barcha tegishli sessiyalarni SQL orqali bekor qiladi; har requestda yangi profil o‘qiladi, eski kontekst ID/revision tekshiruvidan o‘tmaydi. Profilni olib tashlash asosiy rol huquqlarini qaytarishi UI da ochiq aytiladi. Nofaol profil tarixda qoladi; yangi login/switch rad etiladi. Source, audit va session revoke bir tranzaksiyada; read-only/closure guard mavjud. Bu yangi field-level permission siyosati emas: owner admin endpoint ko‘rinadigan maydonlarini ongli ravishda tanlaydi.

API/UI contract va operator ko‘rsatmasi: `docs/operations/custom-roles.md`. Qabul dalili yakuniy regressiyadan keyin yoziladi; ADR mavjudligi vazifani o‘zi done qilmaydi.

## ADR-071 — Restore authentication quarantine va tashqi deployment chegarasi (2026-10-11)

Restore target offline qoladi; gate sweepdan oldin alohida commit qilinadi. Eski session/TOTP/challenge/invitation revocation va operatorning password/PIN/access reconciliation dalilidan keyingina bir martalik review mumkin. Eski backupdagi vakolatlar avtomatik tasdiqlanmaydi. Foydalanuvchi real staging/production, TLS/domen, off-site monitoring/backup va pilot hali tayyor emasligini tasdiqladi: core texnik tayyorgarlik davom etadi, real qabul blocked_external, production deployment uchun alohida tasdiq kerak.


## ADR-072 — Tenant recovery readonly reja chegarasi (2026-10-11)

Mavjud Prisma/PG, reviewed tenant export va Node crypto ishlatiladi; yangi kutubxona yoki provider protokoli yo‘q. Recovered isolated copy va target exact migration/checksum bilan tekshiriladi; unfinished migration rad. RepeatableRead READ ONLY snapshots ketma-ket; private0600 exclusive artifact row key/digest/FK va current-only preservationni bildiradi. Portable export credential/security omissions saqlanadi. CLI database nomlari explicit confirmation, operator-owned0700 katalog va mustaqil case SHA binding talab qiladi.

OPS-03.05 planning mezoni real disposable pg_dump/restore clone hamda foreign tenant hash invarianti bilan qabul qilindi. Apply/import, credential restore, shared user/role rollback yoki moliyaviy journal overwrite qo‘shilmaydi. Kelajakdagi correction mavjud audited posting/reversal contractlari bilan operator review va target drain/recheckdan keyin; haqiqiy production recovery alohida vakolat va tashqi dalil talab qiladi.

## ADR-073 — Restored provider intent lookup va ichki ledger qabul chegarasi (2026-10-11)

Restore source offline va workers drained bo‘lishi shart. Pending auth checkpoint claim/transport/settlementni bloklaydi; review eski queued intentga submit huquqini qaytarmaydi. Mavjud original ID lookup, not_found manual review, old running lease fencing qayta ishlatiladi. SQL126 transition,127 zero-submit restore counter proof,128 fixed-schema/search_path helper additive; applied fayllar rewrite qilinmagan. Normal post-checkpoint yangi intent submit oqimi sinovda saqlangan. Registry bo‘sh, vendor API taxmin qilinmagan. OPS-03.06 tashqi orphan/terminal/offline acceptance tugamasdan done emas.

RELEASE-01.03 individual mezoni ichki cross-ledger/report coherence; dependency talqin qoidasidagi ishlatilgan core invariantlar isolated production business services bilan tekshirildi. Shu individual mezon done; real PILOT va qolgan release bandlari yoki production approvalni almashtirmaydi. Combined scenario hamda68financial regression dalili release-ledger-20261011.json. Kichik guard, SQL correction yoki test original+20 hisobiga alohida qo‘shilmaydi.


## ADR-074 — Saqlanmagan katalog tahriri va sessiya almashtirish (2026-10-11)

Mavjud React hook/native browser eventlari ishlatiladi; yangi kutubxona, router patch yoki brauzerga forma payloadini saqlash yo‘q. Dirty/saving page guard kategoriya, birlik, brend, mijoz va yetkazib beruvchi uchun scoped editorlarda qo‘llanadi. Logout va biznes almashtirish server sessiyasiga tegishdan oldin cancellationni tekshiradi; muvaffaqiyatli switch commit eventi keyingi reload tasdig‘ini takrorlamaydi. Mijoz kredit limiti decimal satr bilan yuboriladi. Kod bo‘lmagan HTTP xatosi transport xatosiga aylantirilmaydi; status/requestId saqlanadi.

34 unit fayli,3 browser va build/typecheck/lint/835-source scanner PASS. Dalil: catalog-unsaved-20261011.json. UX-01.05 butun sahifalar/retry/back-forward mezonlari tugamagani sababli in_progress; original done159 o‘zgarmadi. Qo‘shimcha core ishlari original+20 hisobiga sun’iy ravishda qo‘shilmaydi.


## ADR-075 — Product draft va kechikkan query javobi (2026-10-11)

Mavjud React state/ref, shared unsaved hook va scoped editor kalitlari ishlatiladi. ProductBarcodes dirty/busy state callback orqali parent page guardga qo‘shiladi; main product saved bo‘lishi boshqa barcode draftni bekor qilishga vakolat bermaydi. Asosiy save barcode dirty bo‘lsa shu sahifada qoladi. API schema va SQL unchanged; cost/minStock6 va price2 decimal string. Product/category/barcode flight latch synchronous event retrylarni cheklaydi. Katalog list generation latest-query-only qoidasi bilan stale result/error/loadingni rad etadi; credential yoki forma payloadi browser storagega yangi yozilmaydi.

34 unit,12 browser va build/typecheck/lint/scanner838 PASS. UX-01.05 partial acceptance, original done159/target179/0of20. Boshqa editor/nav/recovery coverage tugamaguncha original task yopilmaydi. `product-editor-state-20261011.json` qabul dalili; `ux-editor-state-inventory-20261011.json` faqat source inventory.

## ADR-076 — Mustaqil rol va profil request recovery (2026-10-11)

Bitta shared pending ref o‘rniga ikki mustaqil immutable snapshot ishlatiladi. Unknown response original path/method/body/keyni qulflaydi; known validation/revision conflict editable draftni saqlaydi. Native confirm helper har bir forma resetini faqat tegishli draft bilan tekshiradi; umumiy page guard ikkala draft va pending amalni hisobga oladi. Backend siyosati unchanged: unexpired MFA proof faqat exact session/action/key/hash replay uchun qayta ishlatiladi. Browser test takroriy dialogni kutish o‘rniga real bound replay va DBda bitta posting/auditni tekshiradi.

21 browser,34 unit, build/type/lint/scan PASS. Komponent-memory recovery reloadga chidamli emas; UX-01.05 partial, original done159/0of20 unchanged. Yangi dependency, migration, vendor API yoki production deployment yo‘q.


## ADR-077 — Original dataset migratsiya darvozasi va rollback rehearsal (2026-10-11)

Mavjud PostgreSQL/Prisma/Node yetarli: source offline, read-only baseline, actual private dump/restore clone, additive migrate, legacy source-backed backfill, original projection va ledger compare, repeated expanded snapshot, clone constraint validation, fresh install va previous app compatible rollback. Native COPY oqimi row payloadni client dataset arrayga yig‘maydi; Decimal PostgreSQLda normalize qilinadi, JS Number emas. No-PK jadval canonical record bo‘yicha saralanadi. Yangi ustunlar original hashni o‘zgartirmaydi; original column/type/key yoki encoding/collation farqi failclosed. Private artifact/no-overwrite; native SQL/credential errors logga uzatilmaydi.

Sourcega avtomatik migrate/import/repair/down migration yo‘q. Pre-upgrade backup restore faqat offline cloned environmentda; post-upgrade provider/offline iqtisodiy amallarni review qilmasdan live restore mumkin emas. Synthetic fixture ochiq belgilangan, actual customer/staging acceptance uydirilmagan. DATA-01.10 individual script/reja + clone/fresh/rollback qabul mezoni done; tashqi rollout gate va boshqa original scope bandlari ochiq. Original done160/259, latest target160 achieved. Qabul: migration-dataset-20261011.json va migration-dataset-readiness.md.

## ADR-078 — Explicit tenant roots va native FK edge defense (2026-10-11)

113 Prisma model bitta reviewed root/global classification oladi; unknown/global scoped ORM operatsiyasi implicit tashkilot scope olmaydi. Parent root branch/cashier scope’ni uzatadi, scoped insert root yoki authorized parentni talab qiladi. Native SQL129/131/132 barcha97tenant table FK-edge/immutable owner defense beradi; Organization root identity immutable. Native composite tenant FK mavjud bo‘lsa qo‘shimcha lookup shart emas; boshqa FKlar current final row bo‘yicha deferred tekshiriladi, narrow key-share lock bilan. RLS va yangi texnologiya kiritilmadi. Legacy set-based preflight invalid data’ni o‘zgartirmaydi. Acceptance fresh/actual synthetic dump clone/rollback va full324/focused16; real rollout OPS/pilotga tegishli.

## ADR-079 — Shared full-report worker eksporti va native browser PDF (2026-10-11)

18 mavjud filtered query response/calculationni saqlagan holda server service’ga ajratildi; HTTP authentication route wrapperda, worker esa immutable source generationdan live context oladi. Arbitrary URL yoki browser secret payloadga olinmaydi. Original background worker CSV/XLSX/PDF-ready artifactni scoped hash/audit/expiry contractida yaratadi. Exact XLSX cells plain string; PDF originalPLAN1dagi user browser print-to-PDF orqali, server Chromium production dependency qo‘shilmaydi.1001filtered row actual29-page PDF va uch-browser UI acceptance PASS. Automatic printer/Click/fiscal integratsiya yoki mavjud bo‘lmagan expiry/serial hisobotni bu vazifaga qo‘shib fake done yaratilmadi. Report overflow10000result/16MiBda partial faylsiz.

## ADR-080 — Sintetik stress/soak va haqiqiy restart qabul chegarasi (2026-10-12)

Original OPS-04.06 Node/Prisma/PostgreSQL/standalone stack bilan bajariladi; yangi dependency/provayder yo‘q. Production manzilni qabul qilmaydigan harness20terminal/bittaowner,40parallel stress15min va20parallel normal2hni real davomiylikda bajaradi; original-key replay, SIGKILL/SIGTERM va individual stock/exact cash invariants majburiy. Smoke qabul emas. Closed-loop target interval30s; backpressure/retry achievable throughputni kamaytirishi alohida qayd qilinadi, rate limitni chetlab o‘tilmaydi.

Read-only observer active requests paytidagi pool/lock/RSSni o‘z haqiqiy coverage timestampidan o‘lchaydi; one-snapshot ledger helper final qabulni almashtirmaydi. Shared DB/disk statistikasi barcha foydalanish shu runniki degan xulosani bermaydi. Lokal texnik qabul OPS-04.06ni yopadi; haqiqiy pilot peak,20mustaqilcashier/SLO, staging/production, TLS, tashqi monitoring/provider/hardware qabulini yopmaydi. Boshqa original bandlar holati va259band hisob qoidasi saqlanadi.


## ADR-081 — Kech kelgan xarajat uchun moving-average correction siyosati (2026-10-12)

Foydalanuvchi PUR-01.05 uchun moving-average tarixini qayta hisoblash, qolgan zaxira qiymati va sotilgan qism tannarxini alohida tuzatish jurnaliga yozish, eski hujjatlarni o‘zgartirmaslik variantini tasdiqladi. ReceiptCostPlan prepared/cancelled jurnali kapitalizatsiya emas. Original kirimdan aynan qaysi fizik dona sotilganini taxminiy FIFO bilan bog‘lashga ushbu qaror ruxsat bermaydi. Hisob serverdagi haqiqiy harakatlar va mavjud moving-average qoidalarini qayta ijro qilishi kerak; yetishmayotgan yoki qarama-qarshi tarixda posting xavfsiz rad etilishi kerak.

Qo‘llash hali implementatsiya qilinmagan. Keyingi qabulda ko‘p filialdagi global product cost, transfer/in-transit, sale/return, stock reversal, adjustment, kech va takror xarajat, yaxlitlash qoldig‘i, tarixdagi manfiy qoldiq, parallel writer va original-key replay alohida tekshiriladi. Tuzatish miqdori inventory valuation/COGS/return hisobotlarida bir marta hisoblanishi kerak; mavjud cash expense qayta to‘lanmaydi. Bu qaror hisoblash siyosatini tanlaydi, production qabul dalili o‘rnini bosmaydi.

## ADR-082 — Mavjud MFA action nomlari uchun bir xil cheklov (2026-10-12)

`offline-cash.policy` mavjud kritik amal bo‘lsa-da, brauzer binding validator, TOTP proof schema va SQL119 native check defisni rad etgan. Action nomini almashtirish eski original-key/hash/session identityni buzishi mumkin. Shu sabab action nomi saqlanadi; lowercase harf bilan boshlanadigan3–81belgili harf/raqam/underscore/nuqta/defis nomiga uch qatlam bir xil ruxsat beradi. Yo‘l, query, whitespace, newline va script sintaksisi rad. Bu nom validatsiyasi vakolat bermaydi: kritik registry, tirik sessiya, user/factor, original action/key/payload hash va bir martalik counter shartlari o‘zgarmaydi.

SQL133 yangi native checkni avval NOT VALID yaratib, mavjud yozuvlarga VALIDATE qiladi, so‘ng eski checkni shu transactionda olib tashlaydi. Eski proof va approved operation yozuvlari o‘zgarmaydi. Migration appdan oldin qo‘llanadi; eski app qo‘shimcha ruxsat etilgan nomni hali tushunmaydi, ammo mavjud nomlar va yozuvlar mos. Down migration yoki proof tarixini o‘chirish rollback talabi emas. Qabul faqat izolatsiyalangan lokal bazada; production deploy qilinmagan.

## ADR-083 — Manfiy qoldiqni butunlay taqiqlash (2026-10-13)

Foydalanuvchi: “Manfiy qoldiqni hozircha butunlay taqiqlang; yoqish imkoniyatini keyinga qoldiring”. INV-01.07 uchun amaldagi qabul shu qarorga mos: default va explicit override bilan ham negative stock rad; organization flag true API/SQLda rad, UI yoqmaydi. Negative cost/provisional profit/correction feature implementatsiya qilingan deb hisoblanmaydi, u faqat keyingi alohida tasdiqlangan scope bo‘ladi. ADR-081 kech kelgan xarajat siyosati o‘z kuchida, negative stock yoqishga ruxsat emas.

SQL139 oldingi true flaglarni audit yozuvi bilan false qiladi, balans/harakat/savdo/tannarxni o‘zgartirmaydi. Legacy negative qoldiqni yangi yoki chuqurroq negativega olib borish va boshqa branch/productga ko‘chirish rad. Nol tomonga tuzatish mumkin; mavjud vakolat, hujjat, stock-freeze, unit va journal talablari saqlanadi. Legacy noma’lum tannarxdan soxta foyda/correction chiqarilmaydi. Real deploy, haqiqiy mijoz upgrade va tashqi qabul bajarilmagan.

## ADR-084 — Original partiya jurnali va expiry siyosati (2026-10-13)

INV-02.06: nazorat unused SKUda owner/MFA bilan yoqiladi, disable yo‘q. Haqiqiy kirim kodi/sanalari immutable; organization-business expiry kuni inclusive. Sale/transfer-out yaroqli FEFO, muddati o‘tgan qoldiq savdoda bloklanadi. Return/transfer receipt/loss/reversal original issue/receiptga bog‘langan; qisman multi-batchda explicit entry quantities. Eski qoldiq taxminiy partiyalarga ajratilmaydi. Batch count aynan ma’lum partiyalar va cost snapshot bo‘yicha; umumiy StockCount tracked SKU uchun rad.

Ogohlantirish ichki audit va expiry report, tashqi delivery yo‘q. Offline tracked cash lease fail-closed; online FEFO ishlaydi. Manual holds umumiy miqdor, lot reservation kafolati emas; final valid stock qayta tekshiriladi. Native triggerlar physical projection, source conservation, immutable ownership va read-only admissionni tekshiradi. 10000 candidate/export,500 count va100000 worker branch-batch caplar aniq xato bilan; real pilot profiling alohida. Batafsil `docs/operations/inventory-batches.md`.

## ADR-085 — Kech kelgan xarajatning alohida zaxira qiymati farqi (2026-10-13)

Foydalanuvchi PUR-01.05 uchun «Alohida farq jurnalini tasdiqlayman» deb javob berdi. Transfer/in-transit, qo‘lda tannarx o‘zgarishi yoki yo‘qotishlar sabab correctionning qolgan inventory va sold COGSdan tashqari qismi alohida «zaxira qiymati farqi» immutable jurnalida ko‘rsatiladi. Oldingi receipt/sale/return hujjatlari qayta yozilmaydi, mavjud cash expense qayta to‘lanmaydi. Bu biznes siyosati tasdig‘i; posting, report va reconciliation acceptance hali tugamagan. ADR-081 authoritative moving-average replay va ADR-083 negative stock taqiqi saqlanadi; noma’lum legacy tarix uchun soxta qiymat yaratilmaydi.


## ADR-086 — Correction filial va sana siyosati (2026-10-13)

Foydalanuvchi qolgan global zaxira qiymati farqi va rounding correctionni kirim/xarajat filialiga, qo‘llangan sana bilan yozishni tasdiqladi. Inventory correction haqiqiy zaxira joylariga, COGS correction asl sale/return filiallariga bog‘lanadi; eski davrdagi hujjatlar o‘zgarmaydi va original manba havolalari saqlanadi. Bu qaror posting va hisobot qabulini almashtirmaydi.

## ADR-087 — Kech xarajatdan keyingi operatsiyalar va transfer snapshoti (2026-10-13)

ADR081/085/086ni bajarish: old application va hujjatlarni o‘zgartirmasdan, keyingi actual source operatsiyasining Serializable tranzaksiyasida immutable ReceiptCostContinuation yoziladi. Actual actor sessiya/rol tekshiruvi saqlanadi; ichki typed capability faqat shu tenantning projection o‘qishini ochadi. COGS actual sale/return filialiga, variance/rounding original expense filialiga operation sanasi bilan yoziladi. Corrected issue-costli write-off freightni allaqachon xarajat qilgan bo‘lsa, variancega qayta qo‘shilmaydi. Native source/transaction/sequence, live session va cost-change anchor tekshiruvlari majburiy.

Faol net fee bor transfer actual jo‘natish paytida current costni additive issueUnitCostSnapshotda saqlaydi; eski draft unitCost o‘zgarmaydi. Nofee/legacy transfer original frozen-cost qoidasini saqlaydi. Bu vendor yoki yangi biznes tarifi emas, tasdiqlangan freightning qiymatini keyingi harakatlarda yo‘qotmaslik chorasi. SKU/fact/work caplarda qisman jurnal yoki taxminiy hisob o‘rniga aniq xato qaytadi. SQL155–159 qo‘shiladi, applied migration qayta yozilmaydi. Real production deployment/pilot qabul qilinmagan.

## ADR-088 — Original serial birligi va sotuv kafolati (2026-10-13)

INV-02.07 existing PostgreSQL/Prisma/Next/Zod/durable-MFA stack bilan bajariladi. Unused precision0 SKUda owner/MFA, native owner audit proof bilan yoqiladi; tracked mode o‘chirilmaydi, tarixiy qoldiqqa taxminiy serial yozilmaydi. Organization-global trim/upper-case ASCII serial identity unique; bu ichki admission siyosati, vendor format yoki hardware contracti emas. Bir SKUda expiry batch va serial tracking aralashtirilmaydi. Serial source posting max500unit; katta purchase/return explicit partial operations bilan bajariladi.

Immutable SerialEvent va native SerialNumber projection available/sold/transit/damaged/retired holatlarini original physical sourcega bog‘laydi. Warranty actual sale event/start time, configured days/terms snapshotidir; keyingi policy/resale eski kafolatni o‘zgartirmaydi. Service opened/in_progress/resolved/rejected immutable, operator izohli actual qaroridir; avtomatik qoplash, repair vendor yoki stock/payment effecti emas. Expiry eligibility auditda ajratiladi. Generic quantity-only count va serialized offline lease fail-closed; original unit receipt/loss/reversal va online selection ishlaydi.

SQL166 native serial/service ordinal bir transaction sanasi teng bo‘lgan exchange return/resaleni aniq ajratadi. Hali shipped bo‘lmagan feature uchun intermediate journal bo‘sh bo‘lishi shart; mavjud unproven serial orderni timestamp/UUIDdan backfill qilmaydi va avtomatik data erase yo‘q. All migrations appdan oldin qo‘llanadi. Owner/assigned manager full paged trace, cashier minimal availability DTO; actor/org/role/branch workspace reset va original durable recovery scope saqlanadi. Actual local dump-restore code qabulini beradi, real production/pilot/hardware qabulini bermaydi.

## ADR-089 — Ro‘yxatning URL va server contracti (2026-10-13)

UX-01.03 birinchi ikki paketida sales/products/customers/categories/units uchun qidiruv, qo‘llangan filter, sort va page URLdan olinadi; Next16 ning o‘rnatilgan Native History API/Suspense qo‘llanmasi ishlatiladi. React/Tailwind `ListFilter`, native `DataTable`, mavjud Input/Select/Pagination yetarli; yangi table/form framework yo‘q. Sort ustunlari faqat endpoint allowlistidan, summalar/narxlar database Decimal bo‘yicha; bir xil qiymat id bilan ajratiladi. Count va satrlar bitta RepeatableRead snapshotdan. Turli HTTP sahifalar orasida butun dataset muzlatilgan deb hisoblanmaydi.

Default va oldingi endpoint shakllari saqlanadi: kategoriya parametrsiz all-active, birlik default200; boshqaruv UIlari aniq20lik sahifalar. Xato bo‘sh natija sifatida ko‘rsatilmaydi; kechikkan javob yangi query natijasini almashtirmaydi. Tahrirlash drafti filtr o‘zgarishida saqlanadi. Bu partial UX qabul, original `done` hisobini oshirmaydi. Original UX-01.02/03 ning boshqa ekranlari va barcha tashqi integratsiya/release gate’lari ochiq.

## ADR-090 — Administrator sozlaydigan hisobot va doimiy owner granti (2026-10-13)

Foydalanuvchi original P2 bandlarni boshlash va biznes qoidalarini administrator sozlashini tasdiqladi. REP-01.11 mavjud PostgreSQL/Prisma/Node worker/React/export stackida. Yangi cron/ML/SMS/e-mail texnologiyasi qo‘shilmaydi. UI inactive draft beradi; owner jadval va KPI/forecast/retention/missed-period siyosatini review+MFA bilan yoqadi. Grant actual faol unrestricted owner a’zoligiga bog‘lanadi, fake Session yaratilmaydi; logoutdan keyin davom etadi, grant revoke nashr transactionida qayta tekshiriladi. Fresh FOR SHARE bilan concurrent membership/role/user/org change natija chiqarishdan oldin ko‘riladi. Old sessionga bog‘liq existing BackgroundJob authorization o‘zgartirilmaydi.

Run immutable original occurrence/revision snapshotidir. Native unique/guard, lease nonce va audit transactioni duplicate nashrni to‘sadi. Late retry hisob davri original scheduledFor cutoffida qoladi; haqiqiy tarixiy DB snapshot qayta yaratilgan deb hisoblanmaydi. Missing historyga ML yoki nol prognoz uydirilmaydi; exact moving-average/weekday baseline bir kunlik rolling holdout bilan o‘lchanadi. Multi-day forecast sifat kafolati emas. Kvota JobExport bilan umumiy32MiB mutexda; snapshot4MiB,20branch/20product/100series. Expired derived baytlar prune qilinadi, original source/audit saqlanadi. Migration167 faqat lokal testda; qo‘llangan migration tahrirlanmaydi. Production/pilot/delivery isboti berilmaydi.

## ADR-091 — Bonus original loti va qaytarishdan keyingi recovery (2026-10-14)

User-approved administrator rule policy PostgreSQL immutable versiyada: positive UZS money/point ratio, max redemption%, expiry yoki explicit unlimited, discounted/credit earning eligibility. Faol default rate yo‘q. Inactive gift/card/promo defaults qiymat va’da qilmaydi; ularning haqiqiy xizmati CRM-02.03 tugamaguncha activation HTTPda rad. Points normal receipt discount sifatida mavjud tax/cash/refund contractga kiradi; boshqa payment/vendor channel qo‘shilmaydi. Operatorning mijoz roziligi attestasiyasi SMS/e-mail identity verification sifatida talqin qilinmaydi.

Native source completed sale bitta integer grant loti beradi. FIFO spending boshqa oldingi lotlardan; joriy receipt o‘z kelajakdagi grantini sarflamaydi. User-store/own-sale, live session, policy revision, actual server expiry, role discount limit va immutable cart snapshot qayta tekshiriladi. Source quote recovery original operation/actor/org/return path bilan; extra secret browserga ko‘chirilmaydi.

Receipt-level refund weight original pre-receipt-discount item value bo‘yicha; cumulative ceiling earned grantni bekor qiladi, cumulative floor redeemed original lotni tiklaydi. Final whole refund exactly original. Monetary refundning existing nonfinal rounding/final remainder algoritmi o‘zgarmaydi. Spent grant clawback negative recovery position yaratishi mumkin, ammo spendable wallet≥0. Active credit bilan paired transfer debtni settlement qiladi; oldingi qarz credit expiry sabab qayta undirilmaydi. New grant va final refund settlement actual journalga yoziladi. Alias merge original IDsni o‘zgartirmaydi; canonical wallet max100 customer alias,10000 active/debt source bound.

Offline cash v1 reward snapshotni saqlamaydi; inferred award qo‘shilmaydi va point quote offline leasega kirmaydi. Existing offline/owner reconciliation source preserved. UZS rules boshqa currencyga konvertatsiya qilinmaydi. Source/audit/transfer immutable, restore/replay/vendor acceptance alohida; secret/session identifiers public point DTO va tenant JSONdan chiqariladi. Existing Prisma/Node/React/SQL stack yetarli; yangi platforma yo‘q. Applied168–173 migration tahrirlanmaydi; local-only evidence production/pilot proof emas.

## ADR-092 — Original karta/promo va haqiqiy cash-backed gift (2026-10-15)

CRM-02.03 existing PostgreSQL/Prisma/TypeScript/React stackida qabul qilindi. Immutable registry va actual sale benefit selection original policy/customer/card/campaign/cart/source actor bilan bog‘lanadi. Owner sozlagan whole-receipt card→promo→optional points ketma-ketligi existing server discount permission, tax, cash/refund snapshotidan foydalanadi. Current policy, expiry/revocation, native active customer va global/canonical customer usage checkout tranzaksiyasida qayta tekshiriladi. Prepare slot sarflamaydi; refunded original campaign usage saqlanadi. SKU-specific promo uchun line-level tax contract uydirilmaydi va nonempty productIds rad.

Gift actual cash advance liabilityning source-linked subsetidir: issuance revenue emas, goods checkout revenue bitta; exact allocation ayni transactionda original fundsni qarzga taqsimlaydi. Fully prepaid credit zero-limitga borrowing emas; unfunded borrowing existing limitda. Original expiry/refund terms saqlanadi; expiry liabilityni erase qilmaydi. Goods refund original cash contractdan, qo‘shimcha gift restoration yo‘q. Current points credit-exemption faqat native proof bilan actual gift funded creditga.

Registry owner MFA, actual cashier scoped minimal choices, durable original lost-ACK recovery completed cheklarda ham bor. Session proofs public DTO/tenant exportdan chiqariladi. Readiness133–179 explicit review; native source clocks UTC. Applied174–179 tahrirlanmaydi. 179 fresh/legacy/actual restore va6 real local browser cases core dalildir, real hosting/vendor/pilot qabul emas. ADR091dagi old activation-blocked holati tarixiy: endi administrator joriy real core xizmatlarini sozlay oladi. UX01.02/03 hali original qabul qilinmagan.

## ADR-093 — URL read contract va original moliyaviy editor chegarasi (2026-10-15)

UX-01.03 mavjud React/Tailwind, Next native history, URLSearchParams va Prisma/PostgreSQL bilan qabul qilindi. Query/sort faqat allowlistdan; count va rows snapshotda. Financial reports cutoff va to‘liq filtrlangan CSVni saqlaydi. Journal running balance/ordinal tartibi optional name/amount sortga ko‘r-ko‘rona aylantirilmaydi: faqat asl tartib va fixed, scoped read sahifasi. Unsupported URL qiymati xato va reset beradi, yashirin broad query emas.

Read filter va financial form boshqa state: tanlangan original invoice/advance, body, amount/reason, pending/review va idempotency kaliti query navigation orqali almashtirilmaydi. Original selection joriy read sahifasida bo‘lmasa uning identitysi ochiq qoladi; server fresh scope/source/amountni mutatsiyada qayta tekshiradi. Ruxsat so‘raydigan platforma/budjet ko‘rinishlari URL sabab avtomatik muhim amal yubormaydi. Legacy unpaged staff/shift consumers va statement default50 saqlanadi; yangi UI explicitlimit beradi. Native139/unit147/browsercohort dalillari localcore uchun, production/pilot/vendor emas. Tarjima UX-01.02 alohida davom etadi.


## ADR-094 — Display locale va original moliyaviy manba (2026-10-15)

UX-01.02 mavjud typed JSON dictionaries, React Context va Intl bilan bajariladi; yangi tarjima kutubxonasi kerak emas. SSR locale har requestning ruxsatli `pos_locale` cookiesidan olinadi. Render translatorlari React Compiler uchun localega bog‘langan pure closure; client eventlarda browser locale faqat display uchun o‘qiladi. Navigatsiya, workspace remount yoki API mutation til almashtirishga bog‘lanmaydi.

Typed owned yorliqlar, ro‘yxatdan o‘tgan static jadvallar va error guidance tarjima qilinadi. User/entity/original document matni, request code/Decimal/ISO/date cutoff, permission, key va payload tarjima qilinmaydi. BigInt minor-unit + Intl display Number safe-integer limitini chetlab o‘tadi; branch timezone va Gregorian sana semantikasi saqlanadi. Frozen original review va noaniq print urinishining markup/body/key snapshoti original turadi. Bu foydalanuvchi ma’lumotini avtomatik qayta yozish siyosati emas.

Offline public shell ayni dictionary/formatter modullarini build qiladi. Explicit static annotatsiyalar va locale event faqat ko‘rinishni yangilaydi; encrypted cash ticket, unlock/tender va pending original operation saqlanadi. Public-only cache v3 explicit12 assetdan iborat; private HTML/API/receipt kiritilmaydi, faol kassani majburiy takeover yo‘q. Unknown browser/API diagnostikasi reviewed UI guidance bilan ko‘rsatiladi, original ApiError metadata o‘zgarmaydi. Katalogning CI tekshiruvi va source-owned tables registry keyingi qo‘shimchalarda qamrovni saqlaydi. Qabul dalili va test chegaralari `tasks/evidence/localization-20261015.json`da; real vendor/hosting/hardware/pilot bundan alohida.
