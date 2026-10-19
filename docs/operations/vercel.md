# Vercel’da web ilovani ishga tushirish

## Aniqlangan holat

2026-10-19 tekshiruvida ishchi `.env` Docker ichidagi `db` va localhost origin uchun sozlangan. Bu manzillar Vercel konteyneridan foydalanuvchining kompyuterini anglatmaydi. Foydalanuvchi Vercel loginni brauzerda tasdiqlagach, haqiqiy runtime logi `Production requires DATABASE_URL and APP_ORIGIN` xatosini ko‘rsatdi: `APP_ORIGIN` faqat Development muhitida mavjud edi.

Production origin sozlangach, sahifalar ochildi, ammo readiness503 va bo‘sh registration500 qaytdi. Cloud builddagi read-only probe Vercelning oldingi bazasida migratsiya tarixi yo‘qligini aniqladi (`MIGRATION_HISTORY_MISSING`, expected190). Foydalanuvchi avval tayyorlangan Neon bazasiga ulashni alohida tasdiqladi. Eski sensitive DATABASE_URL variable faqat Preview scope’da saqlandi; alohida production DATABASE_URL Neon uchun yaratildi. Eski baza o‘chirilmadi, ma’lumotlar bazalar orasida ko‘chirilmadi.

Production `APP_ORIGIN` haqiqiy doimiy domenga sozlandi: **https://pos-backup-sooty.vercel.app**. Staff credential binding uchun yetishmayotgan `AUTH_CHALLENGE_SECRET` alohida generatsiya qilinib, productionga sensitive variable sifatida saqlandi. Private recovery nusxasi `.local/vercel/production-auth-key`da; Git va deploy uploadiga kirmaydi. MFA siyosati yoki CSRF guardi o‘chirilmadi.

Yakuniy versiya shu doimiy domenga e’lon qilindi. Eski `pos-backup-qq11zephj-xushnudd.vercel.app` — oldingi immutable Preview deploymenti; yangi sozlamalar uni qayta yozmaydi. Production uchun yuqoridagi doimiy manzildan foydalaning. `develop`ning keyingi alohida Preview sozlamasi quyida berilgan; boshqa Preview branchlari avtomatik tayyor deb hisoblanmaydi.

Repozitoriyda `vercel.json` qo‘shildi. U Next.js frameworkini, `npm ci` installni va `node scripts/vercel/build.cjs` buildni tanlaydi. Build skripti avval private environmentni tekshiradi, keyin `prisma generate` va `npm run build -- --webpack`ni bajaradi. Mavjud offline/PWA prebuild ham ishlaydi. Lokal Turbopack build OS `EPERM`ga uchradi; webpack bilan build o‘tdi. Bu lokal xato Vercel’dagi build ham aynan shu sababdan yiqilganini isbotlamaydi.

Build bazani migrate, reset, seed yoki baseline qilmaydi. Vercel muhitida Prisma generate’dan keyin `check-database.cjs` faqat o‘qish transactionida ulanish, barcha migratsiyalar/checksumlar, UTC va auth-restore holatini tekshiradi. Bu tekshiruvdan o‘tmagan build e’lon qilinmaydi. Xatoda raw URL yoki DB exception o‘rniga xavfsiz kod beriladi. Bu guard biznes/E2E qabul sinovi o‘rnini bosmaydi.

## Dashboard sozlamalari

### `develop` uchun alohida Preview

Foydalanuvchi tanloviga ko‘ra **`main` Production branch bo‘lib qoladi**, **`develop` esa Preview** sifatida deploy qilinadi. Production branch almashtirilmagan. `git push origin develop` Git integratsiyasi orqali Preview buildni boshlaydi.

`develop` uchun branch manzili Vercel deployment metadata’sidan olindi: **https://pos-backup-git-develop-xushnudd.vercel.app**. Saytni va formalarni shu doimiy branch manzilida oching; tasodifiy deployment URLi uchun alohida Origin ruxsati qo‘shilmaydi.

`DATABASE_URL`, `APP_ORIGIN` va `AUTH_CHALLENGE_SECRET` faqat `target=preview`, `gitBranch=develop` scope’da sozlandi. Branchga xos DATABASE_URL umumiy eski Preview qiymatidan ustun keladi. Production environment o‘zgarmaydi, uning bazasi yoki auth kaliti Preview’ga ko‘chirilmaydi.

Mavjud Neon compute ichida yangi bo‘sh `pos_preview_develop` bazasi va alohida cheklangan SQL login yaratildi. Preview login superuser emas, database/role yaratish yoki production roli huquqlarini meros olish imkoniga ega emas. Faqat yangi Preview bazasining schema huquqlari berilgan; production biznes jadvaliga `LIMIT 0` o‘qish sinovi `42501` bilan rad etildi. Production ma’lumotlari nusxalanmagan. Bu alohida baza/credential izolyatsiyasi; compute, tarmoq yoki billing bo‘yicha alohida Neon project/branch yaratilgani da’vo qilinmaydi.

Private Preview URL/parol/auth kaliti `.local/vercel/develop-preview/state.json`da saqlanadi. Bu fayl Git, secret scanner inventari va Vercel uploadidan chiqarilgan; ulashmang. Migratsiyalar faqat shu yangi bazaga alohida operator amali sifatida qo‘llanadi; keyingi web buildlar ularni avtomatik bajarmaydi va 190 migratsiya/checksum readinessni faqat o‘qib tekshiradi.

Tayyorlash tekshiruvi: **190/190** migratsiya va checksum readiness o‘tdi. Mavjud production binary yangi Preview bazasi va kaliti bilan localhostda sinovdan o‘tdi: sahifalar/live/ready200, sessiyasiz me401, bo‘sh registration400, production Origin’dan so‘rov403. Production readiness ham200 saqlandi. Bu lokal runtime tekshiruvi; Git orqali cloud deploymentning holati Vercel Deployments’da `develop` branch va aynan push qilingan commit bo‘yicha tekshiriladi. Tayyorlash/izolyatsiya dalili: [develop-preview-config-20261019.json](../../tasks/evidence/develop-preview-config-20261019.json).

Vercel Authentication himoyasi saqlanadi: Preview’ni ochish uchun Vercel akkauntiga kirish talab qilinishi mumkin. Anonim 302 login redirecti ilovaning 500 xatosi bilan teng emas. Avtomatik test uchun loyiha himoyasini o‘chirmang yoki yangi protection-bypass kalitini tasdiqsiz yaratmang. Boshqa Preview branchlari o‘z bazasi/origin/kaliti bilan alohida tayyorlanadi.

1. Mavjud Vercel loyihasini tanlang va repository root katalogini belgilang. Framework **Next.js**, Node.js **24.x** bo‘lsin. Docker build yoki static export tanlanmaydi. Output Directory uchun maxsus `out`/`standalone` qiymati kiritmang; framework defaultini qoldiring. [Rasmiy Node versiyalari](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
2. Settings → Environment Variables’da quyidagilarni tegishli **Production** yoki **Preview** muhitiga kiriting. Lokal `.env` faylini to‘liq import qilmang.

| Kalit | Qiymat / qoida |
| --- | --- |
| `DATABASE_URL` | Tegishli muhitning haqiqiy, private hosted PostgreSQL URLi. Neon uchun rasmiy pooled connection string, `sslmode=require` va mavjud `channel_binding` parametrlari saqlanadi. `db`, localhost yoki lokal port ishlatilmaydi. |
| `APP_ORIGIN` | Ochiladigan saytning **aynan HTTPS origini**, oxirida `/`siz. Faqat domen bo‘lsa yetmaydi: `https://` ham kerak. localhost va sahifa pathi kiritilmaydi. |
| `AUTH_CHALLENGE_SECRET` | Staff password proof va kelgusidagi auth challenge uchun alohida private 32-byte kalitning 64-hex ifodasi. Mavjud kalit bo‘lsa saqlang; uni logga, Gitga yoki chatga chiqarmang. |
| `AUTH_TOTP_ENABLED` / `AUTH_CRITICAL_MFA_REQUIRED` | Mavjud, tasdiqlangan MFA siyosatiga mos qiymatlar. Hostingni ishga tushirish uchun amaldagi MFA talabini o‘chirmang. |

`POSTGRES_*`, `LOCAL_UID`, `LOCAL_GID`, `NODE_ENV=development` va lokal `NEXT_PUBLIC_API_URL` Vercelga ko‘chirilmaydi. Frontend mavjud `/api/...` nisbiy manzillaridan foydalanadi. DB yoki auth kaliti `NEXT_PUBLIC_*` nomi bilan berilmaydi. `TRUST_PROXY_IP` faqat platformaning ishonchli header overwrite qoidasi alohida tekshirilganda yoqiladi; bu o‘zgarish uni avtomatik yoqmaydi.

3. Preview uchun alohida baza va shu previewning aniq origini kerak. Production bazasini previewlarga avtomatik ulash xavfsiz izolyatsiya hisoblanmaydi. Originni o‘zgartirishdan keyin redeploy qiling; faqat environmentni saqlash eski deploymentni yangilamaydi. [Vercel environments](https://vercel.com/docs/environment-variables).
4. Redeploy qiling. Build logida `Vercel configuration:` chiqsa, xabarda aytilgan parametrni dashboardda tuzating; maxfiy qiymat diagnostikada chiqarilmaydi.

## CLI orqali deploy

CLI akkauntiga kirish va to‘g‘ri project/scope tanlanishi zarur. Login uchun parol/token chatga yuborilmaydi:

```bash
npx vercel login
npx vercel link
```

Dashboardda muhit qiymatlari tayyor bo‘lgach, avval tasdiqlangan preview muhitiga `npx vercel` bilan deploy qilib tekshiring. Productionga foydalanuvchi ruxsati va shu muhit uchun tekshiruv bilan `npx vercel --prod` orqali chiqariladi. `.vercelignore` private `.env*`, `.env_backup`, `.local` backup/kalitlar va boshqa mahalliy maxfiy kataloglarni CLI uploadidan chiqaradi. Production va preview kalitlarini bir-biriga ko‘chirmang.

## Deploydan keyingi tekshiruv

- `/` va `/login` ochilishi kerak; `/api/health/live` 200, `/api/health/ready` 200 bo‘lishi kerak. Readiness 503 bo‘lsa, connection, migratsiya contracti, UTC va restore checkpoint tekshiriladi; reset qilinmaydi.
- To‘g‘ri `Origin` bilan bo‘sh registration JSONi boshqarilgan 400 validation javobini berishi kerak. Begona Origin 403 bo‘lishi kerak. Normal login/register oqimi faqat sinov uchun ajratilgan muhitda test hisob bilan tekshiriladi.
- Login cookie `HttpOnly` va productionda `Secure`; foydalanuvchi sessiyasi bilan mahsulot, filial/kassa va savdo oqimlari tekshiriladi. 403 `CSRF_REJECTED` ko‘pincha `APP_ORIGIN` bilan ochilgan manzil farq qilganini bildiradi; origin guardi o‘chirilmaydi.
- 503 yoki 500da request ID bilan **runtime logs** ko‘riladi. Build muvaffaqiyatli bo‘lishi runtime DB ulanishi ishlaganini bildirmaydi.

## Fon ishlarining chegarasi

Hozirgi `scripts/workers/jobs.ts` va `reconcile.ts` alohida worker processlaridir. Faqat web deployment ularni ishga tushirmaydi. Katalog/tenant eksporti, mijoz eslatmasi va rejalashtirilgan hisobot navbatlari worker bo‘lmasa bajarilmaydi. Ularni mavjud Node/Docker worker sifatida doimiy muhitda, ayni baza va tasdiqlangan auth konfiguratsiyasi bilan ishga tushirish yoki platformaga mos worker schedulingni alohida ishlab chiqish kerak. Ushbu patch cron endpoint, tashqi servis yoki fake job completion yaratmaydi.

Katta eksportlar va uzoq davom etuvchi ishlar uchun real tarifning function duration/payload chegaralari bilan qabul sinovi zarur. Vercel cron ham function limitlariga bog‘liq; uni cheksiz worker deb hisoblamang. [Function limitlari](https://vercel.com/docs/functions/limitations), [cron tarif cheklovlari](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## Mahalliy qabul va tashqi to‘siq

Yangi environment/diagnostika testlari va webpack production build lokal bajarildi. Dastlab CLI login yo‘q edi; foydalanuvchi device login orqali tasdiqladi. Mahalliy production runtime Neon bilan `/`, `/login`, `/register`, live va readiness GETlari200 qaytardi. Mahalliy `.env` va ishlayotgan Docker bazasi o‘zgarmadi. Yakuniy cloud deployment/smoke natijalari `tasks/evidence/vercel-preparation-20261019.json`da; original PLAN1 done sanog‘i o‘zgarmaydi.

Haqiqiy Vercel builddagi read-only probe190/190 va checksumlar mosligini tasdiqladi. E’lon qilingan productionda `/`, `/login`, `/register`, live/readiness200, session bo‘lmagan `/api/auth/me`401, to‘g‘ri Origin bilan bo‘sh registration400 `VALIDATION_ERROR`, begona Origin403 `CSRF_REJECTED`, static asset200 qaytdi.5ta environment/diagnostika regressiya testi, lint, source secret scanner, release claim va mavjud source freshness gate o‘tdi. Sinov uchun real akkaunt, tashkilot yoki savdo yaratilmagan; account creation happy-path va to‘liq POS biznes/E2E/pilot qabuli da’vo qilinmaydi. Fon workerlar ushbu web deployment bilan ishga tushirilmagan.
