# Production ishga tushirish va tiklash

Bu yo‘riqnoma real hostingni yaratmaydi. Domen, TLS reverse proxy, secret boshqaruvi, off-site saqlash va navbatchi hali tanlanishi kerak. Fiskal/Click/hardware adapterlari ishga tushirilmaydi.

## Release tartibi

1. `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` va alohida `pos_test` PostgreSQL bazasida `npm run db:migrate`, `npm run test:integration`, so‘ng `npm run build`. CI ham shu tekshiruvlarni bajaradi; productionga avtomatik deploy yo‘q.
2. `.env.example` asosida private konfiguratsiya yarating. Database URL ichida `db` internal hostname, kerakli foydalanuvchi/parol va bazani ko‘rsating. URLdagi maxsus parol belgilarini URL-encode qiling. Production `APP_ORIGIN` aniq HTTPS origin bo‘lishi shart. Secretlarni Gitga kiritmang.
3. Mavjud `postgres_data` volume bo‘lsa POSTGRES_USER/PASSWORD/DB qiymatlarini o‘zgartirish u yerdagi haqiqiy akkauntni almashtirmaydi. Avval operator amaldagi credentiallarni tekshiradi; volume o‘chirilmaydi. Ilova va migration uchun alohida DB vakolatlari production secret store orqali berilishi mumkin.
4. Versiyalangan `POS_IMAGE` bilan image yarating. Compose DB portini hostga chiqarmaydi. App default faqat localhostga ochiladi; TLS reverse proxy oldida ishlaydi. Proxy haqiqiy HTTPS Host/Originni saqlasin. `TRUST_PROXY_IP=true` faqat proxy foydalanuvchi bergan IP headerlarni almashtirsa qo‘yiladi.
5. Yangilashdan oldin operator backup oladi, staging nusxada migrate va restore mashqini bajaradi. Concurrent eski app mavjud bo‘lsa backfill vaqtida savdo yozuvlarini to‘xtatish kerak: 002 receipt-discount/debt backfilllari oldingi app bilan parallel yozishga mo‘ljallanmagan.
6. `docker compose --profile migration run --rm migrate` faqat tekshirilgan release va backupdan keyin. App startup `db push` qilmaydi. Migratsiya muvaffaqiyatsiz bo‘lsa webni yangilamang, xatoni tuzating; migration historyni taxmin bilan resolve qilmang.
7. `docker compose up -d app`, `/api/health/live` 200, `/api/health/ready` 200, test tashkilotida kirish/smena/savdo/qaytarish smoke sinovi. Readiness bazadagi Operation.actorId contractini tekshiradi; jadvallar/credentiallar tashqariga chiqarilmaydi.
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
