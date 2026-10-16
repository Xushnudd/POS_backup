# Owner uchun katta operator eksporti

`src/server/jobs/tenant-export-file.ts` — egasi vakolat bergan operatorning lokal
fayl eksporti. U browserdagi JobExport/download yoki tashkilotni yopish eksporti
prerequisite’ini almashtirmaydi. Web eksportning16MiB chegarasi saqlanadi;
BIZ-02.07ning katta web eksport va yakuniy legal/retention qabuli ochiq.

Avval `npm run worker:build`, so‘ng repository ildizida:

```sh
node --require ./scripts/worker-resolver.cjs .worker-build/scripts/workers/tenant-export-file.js
```

Runtime environment: `DATABASE_URL`, amaldagi password-owner sessioni uchun
`TENANT_EXPORT_OWNER_SESSION`, absolut output fayli uchun `TENANT_EXPORT_FILE`,
3–2000 belgili audit sababi uchun `TENANT_EXPORT_REASON`. Session/tokenni argv,
shell history, log, umumiy environment fayli yoki bu hujjatga yozmang. Ularni
operatorning mavjud himoyalangan runtime secret mexanizmi bilan taqdim eting.

Output katalogi joriy Unix UIDga tegishli0700, canonical/symlinksiz bo‘lishi,
output fayli esa oldindan mavjud bo‘lmasligi kerak. Yakuniy fayl0600. Tool
mavjud faylni almashtirmaydi. Bir martalik RepeatableRead read-only snapshot,
joriy migration checksum/schema coverage, aniq decimal, binary checksum va
tenant manifest tekshiriladi. Limitlar1GiB/10million row/10min; limitga sig‘magan
arxiv truncation qilinmaydi, amal xato bilan tugaydi.

Owner/password sessioni boshida va publication oldidan qayta tekshiriladi.
Xatoda partial fayl tozalanadi. `operator_export_prepared` audit yozuvi va
`deliveryConfirmed:false` natijasi mijozga yetkazilganlik dalili emas.
Fayl shaxsiy/moliyaviy ma’lumotni o‘z ichiga olishi mumkin; uni faqat vakolatli
oluvchiga tasdiqlangan xavfsiz kanal orqali berish operator zimmasida. Tool
aloqa transporti, avtomatik o‘chirish, haqiqiy backup restore yoki legal tasdiq
haqida da’vo qilmaydi.

Regressiya `tests/tenant-export-stream.integration.test.ts`da va standart
`npm run test:integration` ichida bajariladi. Test faqat guarded
`127.0.0.1:55439/pos_test`/`pos_test` muhitini qabul qiladi.
