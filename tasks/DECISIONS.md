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
