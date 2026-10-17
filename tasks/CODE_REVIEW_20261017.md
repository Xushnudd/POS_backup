# Frontend va backend tekshiruvi — 2026-10-17

Asosiy commit: `a456a5185fdaea6ba34082b5b3dac6c02f6c5f51`. Tuzatishlar ishchi daraxtda; avtomatik commit yaratilmagan.

## Nimalar tekshirildi

Next.js sahifalari, umumiy frontend komponentlari, sessiya va tashkilot konteksti, API handlerlari, validation, lokal savat/katalog, pul va miqdor hisoblari tekshirildi. Barcha TypeScript manbalari kompilyatsiya va lint orqali, backend mavjud integratsiya testlari orqali, frontend Chromium ssenariylari orqali tekshirildi. Bu har bir mumkin bo‘lgan biznes holati yoki har bir kod satri qo‘lda isbotlangan degani emas.

Sinovlar haqiqiy biznes bazasidan ajratilgan, vaqtinchalik PostgreSQL bazasida bajarildi. `.env` va `.env_backup` mazmuni hisobotga chiqarilmadi. Yangi migration talab qilinmadi; mavjud 188 migration saqlandi. Sinovdan keyin faqat o‘zimiz yaratgan vaqtinchalik PostgreSQL konteyneri olib tashlandi; moliyaviy guard sabab saqlangan sintetik fixturelar ham shu bilan tozalandi. Haqiqiy biznes bazasi o‘chirilmagan yoki test bilan o‘zgartirilmagan.

## Topilgan va tuzatilgan nuqsonlar

| Muammo | Hozirgi natija |
| --- | --- |
| Egasi administrator yaratgan, unga alohida biriktirilmagan filialni ko‘rmasligi | Egasi tashkilotning barcha faol filiallarini ko‘radi. Admin/kassirning filial doirasi kengaytirilmagan; boshqa tenant va bekor qilingan sessiya rad etiladi. |
| Umumiy filial/kassa tanlash boshqaruvi yo‘qligi | Bir nechta ruxsatli filial/kassa bo‘lsa headerda tanlov bor. Tanlashdan oldin serverdagi ruxsat qayta tekshiriladi. Bo‘sh bo‘lmagan savat, saqlanayotgan holat, pending/konflikt va hal qilinmagan offline naqd ruxsat bilan almashtirish bloklanadi. Server qoralamasi original filial/kassada qoladi. |
| Sozlamalarda STIR va chek footerini tozalab saqlab bo‘lmasligi | `tin: null` va `receiptFooter: ""` yuboriladi; qayta yuklanganda ham bo‘sh qoladi. Bo‘sh STIR noyob bo‘sh string sifatida saqlanmaydi. |
| Tashkilot sozlamalaridagi takroriy STIR umumiy500ga aylanishi | `409 TIN_EXISTS`, tushunarli ko‘rsatma va requestId qaytadi. Mavjud tashkilot oshkor qilinmaydi; muvaffaqiyatsiz yangilash va audit rollback bo‘ladi. |
| Noma’lum vaqt zonasi keyinchalik hisobotlarni buzishi | Yaratish/yangilashda vaqt zonasi Intl orqali, valyuta kodi 3 katta lotin harfi sifatida tekshiriladi. Yaroqsiz qiymat yozilishidan oldin400 bilan rad etiladi. Bu valyutalarni avtomatik konvertatsiya qilish funksiyasi emas. |
| Eski handlerlarda haqiqiy konflikt/yo‘q resurs xatolari umumiy500ga aylanishi | 24 fayldagi 38 umumiy fallback shared `withApi` handlerga uzatildi.409/404, requestId va xavfsiz loglash saqlanadi; noma’lum xato500 bo‘lib qoladi, raw DB diagnostikasi chiqmaydi. |
| Kasr miqdorning `+/-` va takror qo‘shishda floating-point qoldig‘i | Mavjud fixed-point yordamchisidan foydalaniladi; masalan `2.3 − 1 = 1.3` bo‘lib qoladi. Server miqdor, narx va stockni tekshirishda davom etadi. |
| Reload/offline katalog nusxasi birlik konversiyalarini yo‘qotishi | Savdo uchun kerakli konversiya IDsi, birlik, nisbat, aniqlik va faol holat saqlanadi. Tannarx, balans, rasm URLsi va boshqa yopiq maydonlar lokal katalogga qo‘shilmagan. |
| Savat reloadidan keyin serial tanlash maydoni yo‘qolishi | `serialTracking` belgisi saqlanadi; serial bilan checkout va original lost-ACK tiklash sinovi reloadni ham qamrab oladi. |
| Logout so‘rovi ishlamasa ham lokal savat oldindan o‘chirilishi | Avval faqat o‘qish orqali pending tekshiriladi. Server logoutni tasdiqlagandan keyin scope tozalanadi. Tasdiqsiz/tarmoq xatosida savat saqlanadi; bir paytdagi takroriy logout jo‘natilmaydi. |
| Deployment ID yo‘q production buildda doimiy yolg‘on texnik xizmat xabari | Next.js inline qilgan boolean `false` string sifatida qabul qilinmaydi; status API `release: "unversioned"` qaytaradi. Haqiqiy maintenance holati va fail-closed konfiguratsiya saqlanadi. |
| Ayrim boshqariladigan biznes xatolarining sababi UI’da yo‘qolishi | Qayta sanash, rol versiyasi, noto‘g‘ri kassir PINi, qolgan tafovut, noaniq original natija va tannarx vakolati uchun xavfsiz UZ/RU ko‘rsatmalari qo‘shildi. Noma’lum server diagnostikasi ochib berilmaydi. |
| Kategoriya/birlik refresh xatosida “ro‘yxat saqlangan” deyilib, ro‘yxat yashirilishi | Ayni queryning oxirgi nusxasi xato belgisi bilan o‘qiladi; yangi yozishlar bloklanadi. Boshqa query yuklanmasa oldingi natijalar yangi filtr natijasi qilib ko‘rsatilmaydi. |
| Savdo va mahsulot tafsilotlariga kirish qiyinligi | Savdo ro‘yxatida `Tafsilotlar`, mahsulot nomida detail havolasi, sozlamalarda soliq siyosati havolasi bor. Kassirga rahbarning qoralama bekor qilish tugmasi ko‘rsatilmaydi. |
| Mahsulot birliklaridan katalogga o‘tishda 404 | `/settings/units` havolasi mavjud `/products/units` sahifasiga tuzatildi. 101 statik ichki JSX havolasi qayta tekshirildi; topilmagan sahifa qolmadi. Dinamik havolalar uchun alohida brauzer ssenariylari ishlatildi. |
| Statik Online belgisi va mobil ustma-ust matnlar | Sidebar holati readiness so‘rovi bilan yangilanadi. Header va POS aloqa satri kichik ekranda qatorga o‘raladi; mobil screenshot va elementlar to‘qnashmasligi tekshiriladi. |

## Tekshiruv dalillari

- PostgreSQL: to‘liq 470/470; oxirgi backend o‘zgarishidan keyingi tanlangan regressiya 10/10.
- Unit: 171/171. Operatsion tekshiruvlar: 42/42. Lokal HTTPS/security/status tekshiruvlari: 14/14.
- Chromium asosiy suite: 156 noyob ssenariy to‘liq va qayta runlar bo‘yicha qabul qilindi. Bitta toza full run deb ko‘rsatilmaydi: full run149 pass/7 fail; focused run6 pass/1 fail; oxirgi smoke/refund run3/3. Oxirgi qolgan smoke testi bir akkaunt bilan61 sahifani26 soniyada qayta yuklagani uchun haqiqiy429 limitga tushgan; test odatiy tezlikka moslandi, rate limiting o‘chirilmadi yoki qayta sozlanmadi.
- Alohida yangi serverda pricing timeout:1/1; haqiqiy DB lock ostida UZ/RU interfeys uydirma narx yoki trial ko‘rsatmadi.
- Sahifalar: 61 dashboard va8 public sahifa haqiqiy response bilan ochildi; render exception va API500 kuzatilmadi. Bu har bir sahifadagi barcha biznes kombinatsiyalari tekshirildi degani emas.
- Next production build, worker build, TypeScript, ESLint,979 tarjima, public claims, data-flow va service-target gates o‘tdi.101 statik ichki havola tekshirildi.
- Mahalliy Docker development app yangilandi. HTTP3000 orqali/register va readiness200; HTTP redirect yo‘q. HTTPS3443 readiness200 transport sinovi `rejectUnauthorized:false` bilan; brauzerning sertifikatga ishonchi tasdiqlanmadi, CA o‘rnatilmadi.
- Yuklama qayta o‘lchandi: qidiruv p95290.817ms, checkout630.048ms, yakuniy xato0/200; jismoniy22/322 nazoratli konflikt original-key bilan tiklandi. Avvalgi muvaffaqiyatsiz run ham saqlandi; production barqarorligi kafolatlanmaydi. Batafsil `docs/operations/release-service-targets.md`da.

Mashina o‘qiydigan yakuniy natija: `tasks/evidence/code-review-20261017/validation.json`. Manba inventari va hashlar shu papkada. Dastlabki muvaffaqiyatsiz brauzer runi yashirilmagan: u real deployment/UI nuqsonlari, eski tarjima matnlari, eski jadval selektorlari, query parametrlarini tanimagan URL tekshiruvlari va yetishmagan haqiqiy MFA tayyorgarligini ajratishga ishlatildi. Tuzatilgan testlarda iqtisodiy natija, original key/body, rollback, tenant va vakolat tekshiruvlari olib tashlanmagan.

Asosiy loglar: `integration-final.log`, `unit-final.log`, `browser-full-final.log`, `browser-focused-final.log`, `browser-smoke-final.log`, `browser-pricing-final.log`, `build-final.log`, `worker-final.log`, `lint-final.log`, `typecheck-final.log`, `ops-final.log`. Yuklama manifesti: `tasks/evidence/release-service-targets-20261017-code-review.json`; tezlik sonlari eski natijadan yangi hashga ko‘chirilmaydi, harness haqiqatan qayta bajariladi.

## Qabul chegarasi

Bu bugfixlar original PLAN1 done hisobiga yangi vazifa sifatida qo‘shilmaydi. Haqiqiy staging/production, pilot biznes, fiskal/E-POS, Click, SMS/e-mail va real hardware sinovlari bajarilgan deb belgilanmagan. Production deployment amalga oshirilmagan. Dasturdagi tuzatilgan oqimlarni qo‘lda qayta tekshirish uchun yangilangan `tasks/PAGES_TEST_GUIDE.md`dan foydalaning.
