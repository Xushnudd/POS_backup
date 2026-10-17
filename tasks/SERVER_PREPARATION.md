# Real serversiz tayyorgarlik — 2026-10-17

Hozir server/domen/TLS, off-site backup va monitoring/pilot tasdiqlanmagan. Ushbu bosqich mavjud PCda mustaqil core kodini va serverga ko‘chirish tartibini tayyorlaydi. Kompyuter o‘chsa lokal servis ishlamaydi. Qayta yoqilganda saqlangan PostgreSQL bazasidan navbat tiklanishi mumkin; diskning o‘zi buzilsa mustaqil backup kerak. Lokal sinov haqiqiy hosting, elektr uzilishi yoki off-site nusxa dalili emas.

## Shu bosqichdagi texnik ish

BIZ-02.07 katta web eksporti PostgreSQL bo‘laklariga o‘tkazildi. Yangi texnologiya, cloud storage yoki broker kiritilmadi.189/190 migration yangi JobExportChunk, checksum/tenant/lease/immutability va yopish prerequisite mosligini qo‘shadi. Legacy kichik eksport, katalog/report limitlari va operator fayli saqlanadi. 1GiBdan katta yoki10million qatordan ko‘p arxiv qisman berilmaydi; bu cheklov olib tashlangan deb hisoblanmaydi.

- Tenant worker:10million row/1GiB/10min snapshot;256KiB private bo‘lak,2download/process,5min stream,24h artifact.
- Har bo‘lakda joriy lease va owner/password authority, publicationda atomik artifact/success/audit. Yarim fayl ko‘rinmaydi.
- Worker SIGKILLdan so‘ng lease expiry/recovery yangi snapshotni boshidan yaratadi; stale attempt yozish yoki publish qila olmaydi. Qisman snapshotni ayni holatdan davom ettirish da’vo qilinmaydi.
- Browser butun katta faylni blobga yig‘maydi. Server body EOFgacha yetgach download auditi; cancel/revoke/corruption muvaffaqiyat deb yozilmaydi. Bu browser diskka saqlaganini isbotlamaydi.
- Katta eksport yopish talabiga ham mos; parol bilan qayta tasdiq, faol ishlar blokirovkasi, read-only va bekor qilish saqlanadi. Moliyaviy hujjat va asl fayllar o‘chirilmaydi.

Production dependency auditidagi UUID ogohlantirishi ExcelJSga tegishli tor override bilan patched11.1.1ga ko‘tarildi; final audit0finding. Tafsilotlar `tasks/evidence/server-preparation-20261017/dependency-review.md`da. ExcelJS va mavjud texnologiyalar saqlandi.

Aniq limit, kvota, xavfsizlik va tiklanish: [tenant eksport](../docs/operations/tenant-export.md). Sinov natijalari `tasks/evidence/server-preparation-20261017/validation.json`da qayd qilinadi; bajarilmagan sinov passed deb yozilmaydi.

## Lokal Docker image mosligi

`docker-compose.local.yml` app/migrate/jobs/reconciliation uchun bir xil `POS_LOCAL_IMAGE` va `local-development` targetini ishlatadi. Local Docker target worker TypeScriptini ham compile qiladi. Shuning uchun yangi app bilan eski migration yoki worker image qolib ketmaydi. HTTP3000 development rejimi saqlanadi; release overlayga ushbu lokal target qo‘llanmaydi. Sintetik env rendering to‘rt servis image/target tengligini tekshiradi; alohida test image compiled worker/migration190 va non-root1001ni o‘z ichiga oladi, `.env`/`.env_backup`ni olmaydi. Mavjud biznes konteyneri yoki bazasi bu sinov uchun qayta yaratilmagan.

## Server kelganda bajariladigan tartib

1. Shu source revision uchun CI va immutable release image tayyorlang. Staging va productionning alohida DB/user/key/volume/private env fayllari kerak. Development `.env` ko‘chirilmaydi. [Environment isolation](../docs/operations/environment-isolation.md) va release image tekshiruvlarini bajaring.
2. Owner-approved host, haqiqiy domen/TLS va firewallni sozlang. Ilova porti loopback, DB public porti yo‘q. Server image read-only/non-root bo‘lsin. Namunalardagi bo‘sh qiymatlarni haqiqiy tasdiqlangan qiymat bilan almashtiring.
3. Backup/restore, quarantine va old/new schema compatibility tayyor bo‘lgach migration189/190ni alohida migration job bilan qo‘llang. App ishga tushishi migrationni yashirin bajarmaydi. Eski migrationlar tahrirlanmaydi; yangi schema bilan eski image mosligi sinovsiz rollback qilinmaydi.
4. Release Composega maintenance overlayni qo‘shing. `jobs` va `monitoring` profillarini ham ishga tushiring — oddiy app start fon navbatini avtomatik yoqmaydi. App/jobs/reconciliation ayni image va runtime configuration ishlatsin. Buyruqlar: [deployment-readiness](../docs/operations/deployment-readiness.md).
5. Cash sale → replay → refund, stock/shift/ledger solishtirish, ikki parallel kassa, offline queue, katta tenant eksport va closure cancelni stagingda tekshiring. Worker kill/restart sinovini ham shu hostda qaytaring. Worker30s lease/5s heartbeat bilan tiklanadi; muvaffaqiyatli eksportdan keyin qayta download yangi job yaratmaydi.
6. Encrypted DB+secret backup, checksum, fresh isolated restore va auth quarantine reviewni tekshiring. Off-site nusxa va recovery keyni mustaqil vakolat ostida tashkil qiling. Export PostgreSQL backup o‘rnini bosmaydi.
7. Disk, failed/late backup, readiness, dead job va unresolved sync uchun real monitoring va mas’ul tayinlang. POSdan alohida status hostini ham o‘sha PCda joylashgan deb hisoblamang.
8. Real pilot xodimlari bilan qabul qiling. Production deployment uchun egadan avval belgilangan alohida tasdiq oling. Ushbu runbook deployni avtomatik bajarmaydi.

## Bajarilgan sinovlar

- Unit174/174, operatsion42/42, lokal wrapper/HTTPS3/3.
- Keng backend run473test:468pass/5fail. To‘rt failure test konteyneri nomi berilmagan backup/restore harnessidan; biri yangi modelga umumiy native tenant triggerlari kerakligini ko‘rsatgan.190additive migration va aniq test-container parametri bilan yakuniy45/45targeted run barcha besh holatni qayta qamradi. Bitta toza full run deb yozilmaydi; source o‘zgargan eksport/tenant/restore/XLSX holatlari yakuniy kodda tekshirildi.
- Production standalone + haqiqiy worker bilan3/3Chromium:>16MiB native yuklash/lost-ACK replay, close/cancel MFA,1001qator XLSX/PDF.
- WorkerSIGKILLda partial ko‘rinmagan; lease recovery bitta artifact chiqargan. PostgreSQL ham o‘z persistent test volume’idaSIGKILL/start qilindi:17 509 861bayt/67bo‘lak eksport ayniSHA256bilan saqlandi. Bu fizik elektr uzilishi yoki haqiqiy server/off-site testi emas.
- Production build/worker/typecheck/lint va local image/four-service Compose build o‘tdi. Credential fayllari test imagega kirmagan. Production npm dependency audit0finding; bu OS-image/pentest natijasi emas.
-50kproduct/1mdraft/20kassa sintetik profil: birinchi run1/194finalerror va2044.200mscheckoutp95 bilan o‘tmadi. Boshqa100coldSKU bilan takror0/200final/raw0/300,search306.352ms/checkout231.034ms p95. Original requestId audit tuzatishidan keyin yana boshqa100coldSKU bilan yakuniy current source qayta o‘lchandi:search326.490ms/checkout268.605ms p95,final0/200,raw0/300. Failed natija saqlandi; barcha cold sharoitlar tuzalgan degan da’vo yo‘q. [Xizmat maqsadlari](../docs/operations/release-service-targets.md) va raw dalillar batafsil chegarani ko‘rsatadi.

## Holatlar

| Bandlar | Hozir bajariladigan qism | Tashqi qabul |
| --- | --- | --- |
| BIZ-02.07 | Katta web eksport, read-only, yopish/bekor qilish core va sinovlari | Yakuniy retention/legal-hold/delete tasdig‘i ochiq; irreversible deletion yo‘q |
| OPS-01.01/03/04/06, SEC-02.01 | Compose, environment, TLS template, migration/rollback yo‘riqnomasi | Real host/operator/domain/TLS va muhit izolatsiyasi qabuli ochiq |
| OPS-03.01/06 | Backup/restore/quarantine konfiguratsiyasi va lokal sinov | Off-site custody, real provider/offline reconciliation ochiq |
| OPS-02.05/06, RELEASE-01.07 | Probe/status/monitoring core, restart siyosati va operatsion testlar | Alohida host, real alert channel va mas’ul ochiq |
| Payment/fiscal/hardware/SMS/e-mail | Mavjud interfeys va xavfsiz unavailable chegaralari | Rasmiy vendor contract/sandbox/qurilma bo‘lmaguncha implementatsiya yo‘q |
| MKT/PILOT/BIZ onboarding/LEG | Qo‘llanma, ssenariy va qabul shakllari | Haqiqiy ishtirokchilar va vakolatli tasdiqlar ochiq |

Original PLAN1 hisob185/259 bo‘lib qoladi. Texnik subtaskni tugatish, konfiguratsiya yoki sintetik test original tashqi qabul o‘rnini bosmaydi. Bu bosqichda real biznes DB, `.env`, production deployment va yangi vendor integratsiyalariga tegilmaydi.

Sinov tugagach faqat `pos-preparation-20261017` konteyneri va unga tegishli sintetik volume olib tashlandi. Lokal tekshirish image’i `pos-preparation:20261017` saqlandi; bu production registry approval yoki deploy emas. Real app/DB va `.env` o‘zgartirilmagan. Buyruqlar va loglar evidence papkasida, source va deployment fayllari SHA256lari yakuniyvalidationda.
