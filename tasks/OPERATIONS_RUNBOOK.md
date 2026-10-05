# Production ishga tushirish va tiklash

Bu yo‘riqnoma real hostingni yaratmaydi. Domen, TLS reverse proxy, secret boshqaruvi, off-site saqlash va navbatchi hali tanlanishi kerak. Fiskal/Click/hardware adapterlari ishga tushirilmaydi.

## Release tartibi

1. Node24 ishlating. `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` va alohida `pos_test` PostgreSQL bazasida `npm run db:migrate`, `npm run test:integration`, so‘ng `npm run build`. `npm audit --omit=dev --audit-level=high`, `npx playwright install --with-deps chromium` va shu izolyatsiyalangan bazada `npm run test:e2e` ham bajariladi. Browser test production buildni vaqtinchalik localhost HTTPS proxy orqali tekshiradi. CI shu tekshiruvlarga sozlangan; productionga avtomatik deploy yo‘q.
2. `.env.example` asosida private konfiguratsiya yarating. Database URL ichida `db` internal hostname, kerakli foydalanuvchi/parol va bazani ko‘rsating. URLdagi maxsus parol belgilarini URL-encode qiling. Production `APP_ORIGIN` aniq HTTPS origin bo‘lishi shart. Secretlarni Gitga kiritmang.
3. Mavjud `postgres_data` volume bo‘lsa POSTGRES_USER/PASSWORD/DB qiymatlarini o‘zgartirish u yerdagi haqiqiy akkauntni almashtirmaydi. Avval operator amaldagi credentiallarni tekshiradi; volume o‘chirilmaydi. Ilova va migration uchun alohida DB vakolatlari production secret store orqali berilishi mumkin.
4. Versiyalangan `POS_IMAGE` bilan image yarating. Compose DB portini hostga chiqarmaydi. App default faqat localhostga ochiladi; TLS reverse proxy oldida ishlaydi. Proxy haqiqiy HTTPS Host/Originni saqlasin. `TRUST_PROXY_IP=true` faqat proxy foydalanuvchi bergan IP headerlarni almashtirsa qo‘yiladi.
5. Yangilashdan oldin operator backup oladi, staging nusxada migrate va restore mashqini bajaradi. Concurrent eski app mavjud bo‘lsa backfill vaqtida savdo yozuvlarini to‘xtatish kerak: 002 receipt-discount/debt backfilllari oldingi app bilan parallel yozishga mo‘ljallanmagan.
6. `docker compose --profile migration run --rm migrate` faqat tekshirilgan release va backupdan keyin. App startup `db push` qilmaydi. Migratsiya muvaffaqiyatsiz bo‘lsa webni yangilamang, xatoni tuzating; migration historyni taxmin bilan resolve qilmang.
7. `docker compose up -d app`, `/api/health/live` 200, `/api/health/ready` 200, test tashkilotida kirish/smena/savdo/qaytarish smoke sinovi. Readiness bazadagi Operation.actorId va yakunlangan 015 customer_ledger_documents migration contractini tekshiradi; jadvallar/credentiallar tashqariga chiqarilmaydi.
8. Savdo, payment, debt va inventory journal reconciliation tekshirilgach trafikni oching. Lokal pending sync operatsiyalarini o‘chirmang; bir xil kalit bilan server statusini tekshiring.

## Backup

`scripts/ops/backup.sh` uchun PostgreSQL 15 `pg_dump`, GnuPG va Node kerak. `DATABASE_URL`, `BACKUP_DIRECTORY` va operatorning public key fingerprinti `BACKUP_RECIPIENT` private muhitda beriladi. Parol process argumentlariga uzatilmaydi. Script consistent custom-format snapshot oladi, public key bilan shifrlaydi, faqat encrypted fayl va SHA256 yozadi; temporary plaintext exitda tozalanadi. Disk crashda temporary plaintext qolishi mumkin: host diski shifrlangan va private bo‘lsin.

Scheduler operator tomonidan o‘rnatiladi; backupni boshqa server/storagega nusxalash va muvaffaqiyat/eskirish alertlari shart. Public keyni import qilish, private decrypt keyni alohida xavfsiz saqlash, retention va RPO/RTO biznes bilan tasdiqlanadi. Key yo‘qolganda backup ochilmaydi. Katalog rasmlari/attachmentlar tashqi storagega o‘tganda ularni alohida versiyali backupga kiriting. Ushbu script PITR emas; WAL archiving uchun tanlangan PostgreSQL hosting/backup yechimi alohida sozlanadi.

## Restore mashqi

`RESTORE_DATABASE_URL` faqat alohida **bo‘sh** bazaga ishora qiladi; `RESTORE_CONFIRM_DATABASE` uning aynan nomidir. `scripts/ops/restore.sh /secure/path/backup.dump.gpg` checksum va GPG integrityni tekshiradi, mavjud jadvallarga restore qilishni rad etadi, bitta transactionda tiklaydi. Decrypt private key operator keyringida mavjud bo‘lishi kerak. Target URLni terminal tarixiga yozmang.

Tiklangan nusxada migration history, tenantlar, sale/items/payment/debt/stock jurnallari, summalar va active shiftlar solishtiriladi. Ilova nusxasini tashqi provayderlardan izolyatsiya qiling. Restore eski sessiyalarni ham tiklaydi: trafikdan oldin `Session.revokedAt` orqali hammasini bekor qilib, qayta login talab qiling. Backupdan keyingi offline operatsiyalar qayta yuborilishi mumkin: mavjud Operation kalitlari va server natijalarini solishtiring. Real providerlar ulanganidan keyin ularning statuslari alohida reconciliation talab qiladi.

Tenantning ayrim yozuvlarini productionga to‘g‘ridan-to‘g‘ri restore qilmang. Avval izolyatsiyalangan nusxa, tashkilot chegaralari va FKlari tekshiriladi; qaytariladigan yozuvlar ko‘rib chiqilgan alohida migration orqali kiritiladi.

## Rollback va hodisa

App rollback faqat schema bilan mos imagega bajariladi. Monetary schema/ledger migratsiyalarini teskari SQL bilan avtomatik o‘chirmang. DB restore zarur bo‘lsa yozuvlarni to‘xtating, recovery pointdan keyingi operatsiyalarni saqlang va solishtiring; restore uchun yuqoridagi bo‘sh-baza talabini saqlang. Monitoring request ID va error code bilan ishlasin, parol/token/bodyni loglamasin. Navbatchi, alert destination, status sahifasi va amaldagi RPO/RTO hali tashqi operatsion qarorlar sifatida ochiq.

## Izolyatsiyalangan qabul sinovlari

2026-10-05: 6 unit, 14 PostgreSQL integration va 1 Chromium HTTPS checkout/recovery scenario o‘tdi. `scripts/ops/test-migrations.sh` fresh schema hamda oldingi discounted-credit receipt fixturega barcha 11 migrationni qo‘lladi. `scripts/ops/test-backup.sh` GPG/checksum, transaction restore va mavjud jadvalli DBni rad etish holatini tasdiqladi. Ular faqat `pos-plan-test-db`dagi vaqtinchalik bazalarda ishlaydi; real biznes bazasi va providerga tegmaydi. Bu dalillar pilot, load, to‘liq PLAN1 va production infratuzilma qabulining o‘rnini bosmaydi.

Ombor yangilanishi: migration011 tasdiqlangan hujjat/satrlarni DB darajasida o‘zgarmas qiladi. Xato kirim uchun Inventory → Hujjatlar → Qarshi hujjat, sabab va manager tasdig‘i ishlatiladi. Migration012 transferda qabul/qaytarish miqdorini ajratadi; yo‘ldagi qism faqat jismonan manba omborga qaytgach qaytarish komandasi bilan yoziladi. Qabul qilingan tovar uchun yangi teskari transfer yarating. Readiness migration012 tugallanishini talab qiladi. Qaytarish yo‘ldagi qoldiqni yo‘qotmaydi va original hujjatni o‘chirmaydi.

## Inventarizatsiya

Inventory → Inventarizatsiya: full (2000 SKUgacha) yoki qisman scope, blind count tanlang. Tanlangan store/SKU savdo/kirim/transfer uchun vaqtincha bloklanadi; boshqa SKU/filiallar ishlaydi. Ochiq DB transaction UI davomida saqlanmaydi. Sanash raqamlarini saqlang, reviewga yuboring; farqli SKUlarni qayta sanang, manager sabab bilan tasdiqlaydi. Bitta confirmed farq hujjati stock journalga yoziladi; original readings o‘zgarmaydi. Farqsiz count hujjatsiz yopiladi.

Sanash to‘xtab qolsa boshqa manager aktiv sanashlar ro‘yxatidan ochib, tugatadi yoki sabab bilan bekor qiladi. Raw balance yoki StockFreeze yozuvini qo‘lda o‘chirmang. Avtomatik freeze timeout yo‘q; physical checkpoint buzilmasligi uchun operator nazorati kerak. Readiness migration014ni talab qiladi.

Backup/restore active freeze va readinglarni ham saqlaydi; restore nusxasida aktiv countlar operator bilan solishtirilib, keyin savdo ochiladi. `test-backup.sh` izolyatsiyalangan active-count fixture bilan reading/expected/current balance va freeze aynan tiklanganini tekshiradi.

## Mijoz qarzini tuzatish va ko‘chirma

Owner mijoz kartasida qarz ko‘chirmasi va alohida qarz hujjatini ko‘radi. Opening uchun manba hujjat summasi/sana/muddat/sabab; decrease/write-off mavjud guruh qarzidan oshmaydi. Savdo write-offida tegishli chek tanlanadi. Oddiy naqd undirish ochiq smenada o‘z Payment/collection oqimi orqali bajariladi; manual qarz tuzatishi pul tushumi yoki refund emas.

Original DebtEntry edit/delete qilinmaydi; yangi audited correction hujjati yoziladi. Written-off liability qaytarilganda real cash tushumi deb talqin qilinmaydi. Payment/reference bilan tasdiqlangan collectionlar o‘z kanali bo‘yicha saqlanadi; bank/card settlement chegaralari o‘zgarmaydi. Ledger source operation result noaniq bo‘lsa original key/payloadni saqlab qayta tekshiring.

Ko‘chirma timezone bo‘yicha davr boshidagi/oxiridagi/running/current qarzni, source/receipt/actor/reason va ma’lum due dateni ko‘rsatadi. Eski noma’lum actor/muddat taxmin qilinmagan. Customer due-date aging/export/advance va full purchase activity hali alohida CRM ishlaridir. Migration015 effectiveAtni eski createdAtdan oladi, append-only guard va deferred customer FKni qo‘shadi. `test-backup.sh` original actor/effective/due ledger fixture ham aynan tiklanganini tekshiradi.
