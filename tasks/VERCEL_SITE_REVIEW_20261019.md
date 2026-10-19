# Vercel saytini tekshirish va tuzatish

Sana: 2026-10-19. Manzil: https://pos-backup-sooty.vercel.app. Tekshiruv boshlangan Production commit: `88101ef`. Tasdiqlangan tuzatishlar `main`dagi `00a8888` commit bilan Production’ga chiqarildi.

## Internal Server Error holati

Oldin aytilgan `Internal Server Error` qayta kuzatilmadi. Production bosh sahifa, login, ro‘yxatdan o‘tish va live/ready endpointlari `200` qaytardi. Tekshirilgan 15 daqiqalik Vercel runtime va CDN loglarida error/5xx yozuvi topilmadi. Tarixiy xatoning sababi isbotlanmadi.

Foydalanuvchining aniq ruxsati bilan **TECHNICAL REVIEW 2026-10-19 — NO SALES** nomli test tashkiloti yaratildi. Ro‘yxatdan o‘tish, sessiya, qayta login va logout `200`, logoutdan keyingi sessiya tekshiruvi `401` qaytardi. Test sessiyalari yopildi. Hisob va tashkilot saqlanadi; parol va sessiya ma’lumotlari Git/hisobotga kiritilmadi.

Production’da 58 statik sahifa ochildi: `500`, render yoki JavaScript exception topilmadi. Asosiy ekranlar 360 va 1280 px da tekshirildi: gorizontal chiqib ketish topilmadi. UZ/RU va haqiqiy service worker tekshirildi. Production’da savdo, to‘lov yoki ombor harakati yaratilmadi.

## Topilgan kamchiliklar va tuzatishlar

1. **Dastlabki kassa tanlovi saqlanmas edi.** Tizim birinchi filial/kassani avtomatik tanlar, lekin bu tanlovni lokal xotiraga yozmas edi. Keyingi server javobida ro‘yxat tartibi o‘zgarsa, reload boshqa kassani tanlashi mumkin edi. Endi serverdan tekshirilgan filial/kassa saqlanadi. Arxivlangan yoki ruxsatdan chiqqan IDni server ro‘yxatidan tekshirish saqlangan. Regressiya testi kassalar tartibini teskari qilib, tanlov saqlanishini tekshiradi.
2. **Kasr miqdor testining sharti noaniq edi.** Test ochiq smenasi bo‘lgan kassani tanlamasdan, API qaytargan birinchi kassaga tayanar edi. Fixture endi aynan o‘z ochiq smenasining kassasini tanlaydi. Smenasiz amallarni cheklaydigan ilova himoyasi yumshatilmadi.
3. **CI autentifikatsiya muhiti to‘liq emas edi.** Integration origin’i lokal so‘rovlarga moslashtirildi. CI har safar alohida tasodifiy auth kaliti yaratadi; testlarga tegishli TOTP/MFA flaglari beriladi. Production kalitlari va sozlamalari o‘zgarmadi. Maintenance ssenariysi uchun faqat CI/testga tegishli yopiq `/tmp` fixture tayyorlanadi.
4. **Merge’dan qolgan metadata gate’ni buzardi.** npm ishlatiladigan loyihadagi qo‘shimcha `onlyBuiltDependencies` maydoni olib tashlanib, avval o‘lchangan `package.json` holati tiklandi. Dependency va lockfile o‘zgarmadi. Service-target gate yana o‘tdi; avvalgi yuklama natijalari yoki checksum dalillari qayta yozilmadi.

## Sinov natijalari

| Tekshiruv | Natija va chegarasi |
| --- | --- |
| Production brauzer | 58 statik sahifa; auth, mobil/desktop, UZ/RU, service worker; 0 server/render xatosi |
| Lokal backend integration | 473 noyob ssenariyning oxirgi natijasi PASS; dastlab 463/473, qolganlari to‘g‘ri test konfiguratsiyasi bilan qayta tekshirildi |
| Lokal Chromium | 157 noyob ssenariyning oxirgi natijasi PASS; bitta to‘liq yashil run deb hisoblanmaydi |
| Keng brauzer baseline | 154 PASS, 1 FAIL, 1 SKIP: kassa testi yiqilgan, maintenance fixture talab qilgan |
| Tuzatilgan builddagi qayta run | 7/7: kassa konteksti, kasr birliklar, sozlamalar/logout, maintenance va barcha 69 sahifa; qo‘shimcha tarif timeout testi 1/1 |
| Unit / ops / Vercel config | 174/174, 42/42, 5/5 |
| Build, lint, TypeScript, worker build | PASS |
| Source security / i18n | 0 topilma; 979 tarjima kaliti, yetishmayotgani 0 |

69 sahifaning 11 tasi dinamik sahifa: mahsulot, mijoz, savdo, yetkazib beruvchi va ticket tafsilotlari. Ular haqiqiy sintetik yozuvlar bilan ajratilgan lokal bazada tekshirildi. Yangi builddagi 69 sahifa sinovi API `500` va brauzer render exceptionlarini ham kuzatdi.

Mashina dalili: [validation.json](evidence/vercel-site-review-20261019/validation.json). Production marshrutlari va asosiy oqimlar shu papkada alohida JSON fayllarda. Birinchi muvaffaqiyatsiz runlar va keyingi qayta runlar hisoblari saqlangan.

## Production’ga chiqarish natijasi

Foydalanuvchi tasdig‘idan keyin `main` push qilindi. Vercel Git deploymenti `dpl_7V56jqwooJNSk7bAcG2iq1FqPAC2` **READY** bo‘ldi; `pos-backup-sooty.vercel.app` aynan shu deploymentga bog‘langani tekshirildi. Production branch `main` bo‘lib qoldi. Builddagi bazani tekshirish faqat o‘qish bilan 190/190 migration mosligini tasdiqladi.

Yangi Production’da 9 sahifa `200` qaytardi. Test hisobida login/logout `200`, logoutdan keyingi sessiya `401`; dastlabki filial/kassa tanlovi saqlandi va reload’dan keyin tiklandi. Server/render/JavaScript xatosi topilmadi. Dastlabki smoke skriptida `/reports/sales` API yo‘li sahifa deb ochilib 404 olingan; haqiqiy `/reports` sahifasi bilan qayta tekshiruv o‘tdi. Bu tekshiruv input xatosi edi, ilovaga yangi route qo‘shilmadi.

Chiqarish dalili: [production-release.json](evidence/vercel-site-review-20261019/production-release.json). Bu fayl tekshirilgan kod deploymentini qayd qiladi; undan keyingi hujjat commitlari shu runtime kodini o‘zgartirmaydi.

## Chegaralar va chiqarish holati

Haqiqiy biznes tashkilotlarining hisoblari va ma’lumotlari bilan test qilinmadi. Platforma/supportning maxsus vakolatli oqimlari lokal testda tekshirildi; Production test egasiga platforma vakolati berilmadi. Firefox/WebKit ushbu tekshiruvda ishga tushirilmadi.

SMS/e-mail, Click, fiskal va hardware adapterlari avvalgi qarorlarga muvofiq ulanmagan. Fon worker, real backup/monitoring, staging va pilot qabuli web sahifalar ochilgani bilan bajarilgan hisoblanmaydi.

Foydalanuvchi 2026-10-19 kuni tuzatishlarni `main` va Vercel Production’ga chiqarishni aniq tasdiqladi. Chiqarish va undan keyingi brauzer tekshiruvi yuqoridagi dalilda qayd etildi. Baza migratsiyasi yoki Production environment o‘zgarishi bu tuzatishlar uchun talab qilinmaydi. Original PLAN1 hisobi **185/259**, yangi original done **+0**.
