# DATA-01.10 — eski ma’lumotni migratsiyaga tayyorlash

Bu qo‘llanma MVPning `20260907100516_init` schemasidan joriy additive schemaga o‘tish uchun. Skriptlar mavjud PostgreSQL, Prisma Migrate va Node vositalarini ishlatadi; yangi dependency yo‘q. Haqiqiy mijoz bazasining migratsiyasi yoki production deployment uchun alohida operator qabul dalili va egasining tasdig‘i kerak. Lokal test buni almashtirmaydi.

## Ma’lumotni saqlash tekshiruvi

`scripts/ops/migration-dataset.mjs` bazaga yozmaydi. Libpq ulanishi environment orqali uzatiladi; connection URL/parol argumentlarga yoki logga chiqarilmaydi. `READ ONLY` va `REPEATABLE READ`, connection/query/lock timeout ishlatiladi. Manba va nusxada web/worker/import/offline sync yozuvchilari to‘xtatilgan bo‘lishi shart. `MIGRATION_SOURCE_QUIESCED=true` — operatorning shu shart bajarilganini bildirishi; skript bu flagni mustaqil ravishda tekshirilgan texnik holat deb qabul daliliga aylantirmaydi.

Baseline barcha public base tablelarni (`_prisma_migrations`dan tashqari), original ustunlari va primary keylarini qayd qiladi. PostgreSQL `COPY` oqimi Node SHA256 hisobiga uzatiladi: butun jadval client xotirasiga yig‘ilmaydi. Primary key bo‘lmagan eski `UserStore` kabi jadval to‘liq canonical qator bo‘yicha saralanadi. DECIMAL scale kengayishi qiymatni o‘zgartirish deb sanalmasligi uchun PostgreSQL `trim_scale` ishlatiladi; pul/miqdor JS `Number`ga aylantirilmaydi. Encoding, collation, ctype va PostgreSQL major ham mos bo‘lishi shart.

Private JSON faylda schema, qatorlar soni, jadval hash’lari va nazorat yig‘indilari bor; raw qator, telefon, password hash yoki token yozilmaydi. Chiqish fayli yangi, 0600 bo‘lishi shart; mavjud faylni almashtirish va final path symlinkiga yozish rad etiladi. Baseline ham private regular file sifatida o‘qiladi. Bir xil qatorlar soni bilan ma’lumot o‘zgarsa ham tekshiruv rad etiladi. Qo‘shilgan yangi ustunlar original projectionga kirmaydi; drop/type/key o‘zgarishi moslik xatosi bo‘ladi.

`migration-reconcile.sql` eski financial profile uchun qoldiqni har filial/mahsulot bo‘yicha movement summasi bilan, savdo headerini qator va original payment bilan, returnni original line va refund bilan, closed shiftni opening/cash/payment/count bilan tekshiradi. Tenant zanjirlari ham tekshiriladi. Migratsiyadan so‘ng receipt discount, legacy credit debt, primary barcode, unit va received transfer backfill tekshiriladi. Tafovut bo‘lsa avtomatik opening balance, financial correction yoki history rewrite yaratilmaydi.

Bu SQL **legacy import profilidir**: yangi exclusive-tax, boshqa debt attribution yoki keyingi schema transformlariga universal validator sifatida ishlatilmaydi. Keyingi migratsiyada intentional transform bo‘lsa, original projection/transform ADR va alohida expected-result testi bilan kengaytiriladi; original farqni yashirish uchun baseline qayta olinmaydi. Ayniqsa yangi credit paymentni `legacy_payment` deb taxmin qilish mumkin emas.

Tasdiqlangan offline clone ulanishi `DATABASE_URL` environmentida beriladi. Credentialni hujjatga yoki shell historyga yozmang. Native `psql` kerak.

```bash
export MIGRATION_SOURCE_QUIESCED=true
node scripts/ops/migration-dataset.mjs capture /private-case/before.json
# Faqat tasdiqlangan clone uchun alohida mavjud migration runbook orqali deploy.
node scripts/ops/migration-dataset.mjs verify /private-case/before.json /private-case/after.json
```

Yo‘llar operator tanlaydigan private directory namunalari; bu directory yoki real ulanish mavjudligi taxmin qilinmaydi. Har capture/report uchun yangi fayl nomi tanlang. `DATASET_CHANGED`, schema/platform incompatibility yoki query xatosi — release gate muvaffaqiyatsiz. Stdout faqat status/sonlarni beradi. Native errorlar data/credential chiqarishi mumkinligi uchun skript ularni logga uzatmaydi; mas’ul operator private clone ichida cheklangan diagnostika bilan sababini aniqlaydi.

## Expand → backfill → verify → contract

1. Qaysi release/image va migrationlar o‘tishini checksum bilan yozing. Dry-run bazasi haqiqiy manba/live targetdan ajratilganini tekshiring. Yozuvchilarni to‘xtating, in-flight va offline amallarni ro‘yxatlang. Eski ilovani qayta yoqishdan oldin session/MFA/provider reconciliation talablarini hisobga oling.
2. Amaldagi encrypted backup runbook bilan backup va uning nazorat hashini oling. Restore sinovini alohida bazada bajaring. Plaintext backup production saqlash joyiga olib chiqilmaydi; test fixture dumpi ham faqat private vaqtinchalik directoryda.
3. Eski source baselineini oling; dumpdan restored clone baselinega tengligini tekshiring. Sourcega migratsiya qo‘llamang.
4. Clonega faqat immutable existing migrationlarni `prisma migrate deploy` bilan qo‘llang. Mavjud SQL backfilllar original source snapshotlariga tayanadi; tarixiy payment, sale yoki movementni qayta post qilish shart emas. `db push`, `migrate reset`, finalized row delete ishlatilmaydi.
5. Original projection va ledger tekshiruvlarini qaytaring. Yangi backfill qatorlari uchun joriy to‘liq baseline oling; deployni qayta bajarib, shu expanded baseline ham o‘zgarmaganini tasdiqlang. Bu dublikat/backfill idempotency darvozasi.
6. `NOT VALID` constraintlarni **clone**da validate qiling. Eski qator rad bo‘lsa uni o‘chirib sinovni o‘tkazmang: aniq operator reconciliation/forward-fix talab qilinadi. Applied migrationlarni tahrirlamang. Production validation alohida tasdiqlangan rolloutning qismi.
7. Fresh empty databasega barcha migrationlar o‘tishini va oldingi ilova kodi additive schema bilan ishlashini tekshiring. Natija, schema/version, baseline/report hash va test komandalarini qabul protokoliga kiriting.
8. Real staging/pilot/production gate va approval alohida. Ular bo‘lmaganda lokal protokolni haqiqiy deployment yoki real customer clone dalili deb yozmang.

## Rollback va ma’lumot ko‘chirish chegarasi

Schema down migration avtomatik bajarilmaydi. Additive o‘zgarishda avvalgi imagega qaytish/forward-fix yo‘li tanlanadi; nusxadagi eski kod bilan kompatibilitet tekshiriladi. Destructive contract faqat barcha eski image ishlatilmayotgani, backfill/reconciliation va restore mashqi tasdiqlangandan keyin alohida migration bo‘ladi.

Pre-upgrade backupdan tiklash ushbu testda offline nusxa ustida bajariladi. Bu keyingi real payment, fiscal provider yoki qurilmadagi offline amallarni yo‘q deb hisoblash huquqini bermaydi. Live muhitda upgrade’dan keyin yozilgan amallar bo‘lsa eski backupni shunchaki live baza o‘rniga qo‘yish mumkin emas; OPS-03.06/provider/offline review va RPO/RTO bo‘yicha operator qarori kerak. Financial tarix avtomatik ko‘chirilmaydi yoki o‘chirilmaydi.

## Takrorlanadigan lokal qabul

```bash
bash scripts/ops/test-migration-dataset.sh
npm run test:ops
npm test
```

Drill faqat `pos-plan-test-db` konteynerida o‘zi yaratgan UUID database nomlariga yozadi; caller supplied target URL/container/database olinmaydi. `pos_test` yoki real bazani reset/drop qilmaydi. Besh vaqtinchalik baza va private dump/manifests cleanup qilinadi. Docker va isolated container uchun mahalliy ruxsat kerak.

Synthetic eski dataset: 1002 savdo (1001 cash + discounted credit), 1004 sale item, credit refund/return, closed shift/opening/cash in-out, kasr kg qoldig‘i, ikki filial va received transfer. Oldingi qatorlar, stock/financial yig‘indilar, default/backfill manbalari saqlanishi tekshiriladi. Same-count changed product va stock/ledger mismatch salbiy sinovlari release’ni rad etadi. Bu haqiqiy mijoz yoki pilot ma’lumoti emas.

Application UI/API/service/schema o‘zgarishi ushbu bandga tegishli emas: operator uchun mavjud DB contractlariga ishlaydigan CLI/protokol tayyorlandi. Oldingi app regression alohida `rollback-acceptance.ts`ni previous committed source checkoutda joriy isolated DBga qarshi bajarish bilan qabul qilinadi.
