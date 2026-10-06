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
