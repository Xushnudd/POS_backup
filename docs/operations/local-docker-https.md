# Lokal Docker: HTTP va ixtiyoriy HTTPS

Foydalanuvchi lokal CA o‘rnatishni rad etdi va HTTPSga redirect qilmaslikni tanladi. Asosiy lokal ish manzili **http://localhost:3000**; **http://localhost:3443** ham shu ilovani redirectsiz ochadi. Backend `/api` nisbiy manzili bilan ayni HTTP origindan olinadi. Sertifikat istisnosi, CA yoki TLS bypass talab qilinmaydi.

## Ishga tushirish

1. Private `.env`da POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DBni saqlang. Lokal wrapper app/migrate/jobs/reconciliation uchun URLni ayni qiymatlardan db:5432ga percent-encode qiladi. Host development DATABASE_URLi localhost bo‘lishi mumkin va konteyner bazasini tanlamaydi. Mavjud volume paroli envni almashtirish bilan avtomatik yangilanmaydi.
2. `bash scripts/local/setup-https.sh` private optional TLS fayllari va ignored `docker-compose.override.yml` symlinkni tayyorlaydi. System/browser trust o‘zgartirilmaydi. LOCAL_UID/LOCAL_GIDni script chiqishiga moslang; private keyni ulashmang.
3. `docker compose config --quiet`, so‘ng `docker compose up --build`ni bajaring. Migratsiya tugagach app va proxy ishga tushadi.
4. **http://localhost:3000/** yoki **http://localhost:3443/**ni oching. Manzil HTTP bo‘lib qoladi. Oldingi HTTPS tab o‘rniga yangi HTTP manzilni oching.

Lokal app Dockerfile’ning alohida local-development targetida `next dev --webpack` bilan ishlaydi; image pos-app:development. Portlar faqat127.0.0.1ga publish qilinadi, dev server/DB tashqi tarmoqqa ochilmaydi. Container source snapshotidir; kodni yangilash uchun qayta build qiling. Node proxy HMR WebSocket ulanishini ham uzatadi. DB wrapper haqiqiy childga SIGTERM/SIGINTni yetkazadi; diagnostik DB komandalarini ham wrapper orqali bajaring.

## Xavfsizlik chegarasi

Production/staging explicit `-f docker-compose.yml -f docker-compose.release.yml ...` fayllari va default final runner bilan ishlaydi: NODE_ENV=production, qat’iy HTTPS origin va Secure cookie talablari saqlanadi. Lokal HTTP uchun production validator yoki Secure cookie guardi o‘chirilmadi; haqiqiy development rejimi tanlandi.

Development API faqat configured origin va uchta fixed local interfeysni qabul qiladi: http://localhost:3000, http://localhost:3443, https://localhost:3443. Begona hostname/port/suffix rad, Sec-Fetch-Site cross-site tekshiruvi saqlanadi. Developmentda HTTP cookie HttpOnly/SameSite bilan, Secure=false ishlaydi; productionda Secure=true o‘zgarmaydi. Request body, haqiqiy Origin va response cookie proxyda qayta yozilmaydi; mutatsiyalar retry/cache qilinmaydi.

## Ixtiyoriy HTTPS

https://localhost:3443 texnik endpointi qoldi; TLS sertifikati hozircha self-signed. Unda ERR_CERT_AUTHORITY_INVALID chiqishi mumkin. Bu HTTP oqimiga ta’sir qilmaydi va HTTPni HTTPSga yo‘naltirmaydi. User tanloviga ko‘ra mkcert/CA/trust o‘rnatilmadi. Tayyor setup-trusted-https.sh faqat kelajakdagi alohida operator opt-in uchun; joriy workflow uni chaqirmaydi. `--cacert` yoki testdagi ignoreHTTPSErrors browser trust isboti emas.

## Eski baza va tekshiruv

Tarixsiz eski db-push bazasini reset qilmang: private backup, restored clone, initial-schema diff, original-data/ledger tekshiruvi va baseline/upgrade tartibi talab etiladi. Setup script avtomatik baseline yoki drop qilmaydi; `down -v` ma’lumot o‘chirish usuli sifatida ishlatilmaydi. Private backup/keylar .local ichida ignored va image contextdan chiqarilgan.

`npm run test:local-https` transport/DB-wrapper testlarini yuritadi. HTTP home/readiness200, valid Origin bo‘sh registration400 VALIDATION_ERROR, wrong Origin403 CSRF_REJECTED kutiladi. Browser smoke default sertifikat tekshiruvi bilan HTTP3000/3443da URL o‘zgarmasligi va forma ochilishini tekshiradi. Registration/session happy-path faqat disposable bazada sinov qilinadi; asosiy bazaga test hisob yozilmaydi.
