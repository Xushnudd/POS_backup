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
