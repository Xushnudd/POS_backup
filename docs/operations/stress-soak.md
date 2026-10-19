# Stress, soak va restart qabuli

`scripts/ops/test-soak.mjs` faqat `127.0.0.1:55439/pos_test`, `pos_test` foydalanuvchisi va lokal standalone server bilan ishlaydi. Production manzil yoki boshqa bazani qabul qilmaydi. Barcha fixturelar run UUID bilan ajratiladi; faqat shu test yaratgan tashkilot va foydalanuvchi yakunda o‘chiriladi. Mavjud test ma’lumotlari, tariflar va migratsiyalar o‘zgarmaydi.

## Profil

PLAN1ning dastlabki 20 faol kassa profili asosida sintetik reference peak: har 30 soniyada 20 parallel checkout. Stress: shu 20 kassada 40 parallel checkout, kamida 15 daqiqa. Normal load: 20 parallel checkout har 30 soniyada, kamida 2 soat. Bir checkout — server draft yaratish, `1.01` naqd savdoni yakunlash va original yakunlash kaliti bilan qayta yuborish. Har bir kassada alohida mahsulot, ochiq smena va 100000 dona test qoldig‘i mavjud. Stress vaqtida bir kassaga ikki parallel checkout to‘g‘ri keladi.

Profil bir owner akkaunti va 20 terminalni ishlatadi; bu 20 alohida kassir akkaunti throughputi deb talqin qilinmaydi. Harness closed-loop: avvalgi wave tugamaguncha cheksiz backlog yaratmaydi. 30 soniya target interval, retry/backpressure bo‘lsa haqiqiy interval uzayadi. 2× stress — parallel checkout soni 20→40; erishilgan throughput ikki baravar bo‘ldi degan da’vo emas. Haqiqiy wave soni va faza davomiyligidan erishilgan throughput alohida hisoblanadi.

Bu real pilot peak o‘lchovi emas. `OPS-04.01` pilotga bog‘liq bo‘lib ochiq qoladi. Shared local bazadagi avvalgi katta dataset test muhitining bir qismi; u ushbu tashkilotning 50k/1m fixturei deb ko‘rsatilmaydi. Natija faqat qayd etilgan lokal hardware va shu profilga tatbiq etiladi. HTTPS terminatsiyasi, WAN, tashqi provider yoki real hardware throughputi o‘lchanmaydi.

## Ishga tushirish

Avval worker/app build va barcha migratsiyalar tayyor bo‘lsin. Alohida shell orqali tasdiqlangan mahalliy test `DATABASE_URL` qiymatini taqdim eting; secretlarni repo yoki logga yozmang.

```sh
npm run build -- --webpack
node scripts/ops/test-soak.mjs --smoke
node scripts/ops/test-soak.mjs
```

`--smoke` qisqa texnik tekshiruv; uning artefaktida `accepted: false` bo‘ladi. U 15min/2h qabulni almashtirmaydi. To‘liq test davomida `.next/standalone` qayta build qilinmasin. Bir vaqtda boshqa stress harness boshlamang. Test mahalliy portni o‘zi ajratadi, runtime uchun yangi vaqtinchalik kalitlar yaratadi; cookie/token/kalitlar JSON artefaktga kiritilmaydi.

Wave yakunidagi namunalarga qo‘shimcha ravishda quyidagi read-only skriptlar mavjud. `RUN_UUID`ni harness chiqargan haqiqiy UUID bilan almashtiring:

```sh
node scripts/ops/observe-soak.mjs tasks/evidence/soak-RUN_UUID.json
node scripts/ops/verify-soak-live.mjs tasks/evidence/soak-RUN_UUID.json
```

Observer har soniyada faqat shu run application_name bo‘yicha faol ulanish, lock kutishi va RSSni o‘qiydi. Observerning bitta DB ulanishi asosiy pool hisobiga kirmaydi. `coverage` va `startedAt` uning amalda kuzatgan davrini belgilaydi; oldingi davr kuzatildi deb yozilmaydi. Qo‘shimcha overhead — taxminan bir read-only SQL/s. PostgreSQL qaytargan `lockwaiting`/`idleintransaction` kalitlari JSONda shu nomlar bilan saqlanadi. Live tekshiruv bitta SQL snapshotida completed sale/payment/item/movement va boshlang‘ich qoldiqdan qolgan miqdorni solishtiradi; u yakuniy 2h/restart qabulini almashtirmaydi.

## O‘lchov va qat’iy qabul

- Har wave uchun real HTTP latency; faza bo‘yicha p50/p95/p99/max, retryable javob va noma’lum tarmoq natijalari. `409 CONCURRENT_CONFLICT`, `429`, `503` bounded retryga o‘tadi; original payload/key saqlanadi. Boshqa xato yoki retry budget tugashi testni yiqitadi.
- Har wave tugaganda owned server PID, RSS/virtual memory, CPU ticks, fizik I/O bytes, filesystem bo‘sh joyi, DB hajmi, shu run application_name connection/wait soni va shu tashkilot background-job holatlari olinadi. DB size/deadlock statistikasi shared bazaga tegishli; uni aynan shu run hissasi deb talqin qilmang. Job navbati bo‘sh bo‘lsa zero yoziladi, worker throughputi da’vo qilinmaydi.
- Stressdan keyin haqiqiy owned standalone `SIGKILL`, soakdan keyin `SIGTERM`. Server qayta boshlanib readinessdan o‘tadi; committed draft va completion original kalitlari bilan qayta olinadi.
- Har bir tan olingan command uchun bittadan completed Sale, SaleItem, Payment va sale InventoryMovement. Cash jami `saleCount × 1.01` aniq decimal/BigInt bilan solishtiriladi. Har kassadagi qoldiq `initialStock − uniqueCompletedCommands`; journal chiqimi `−uniqueCompletedCommands`. Ortiqcha draft, duplicate yoki yo‘qolgan command testni yiqitadi.
- Ikkala fazaning haqiqiy davomiyligi kamida 900000/7200000ms va ikki restart qabuli bajarilgandagina `accepted: true` bo‘ladi. Failure bo‘lsa artefakt `failure` bilan saqlanadi, done belgilanmaydi.

## Artefakt va tahlil

Natija `tasks/evidence/soak-<runUUID>.json`da. Source HEAD va dirty fayl SHA256lari checkpoint evidence bilan birga qayd etiladi. Yakuniy protokolda memory/pool/queue/disk trendlar, eng sekin faza, kontrolli contention/retry va kuzatilgan bottleneck yozilsin. RSSning allocator/cache warm-up sabab o‘sishi bilan doimiy leak farqlansin; qabul faqat kuzatilgan ikki soatga tatbiq etiladi. Real pilot profiling, monitoring provayderi va production release qabuli alohida ochiq bandlardir.
