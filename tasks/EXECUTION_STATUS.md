# Bajarish statusi

Sana: 2026-10-05. Barcha PLAN1 bandlari quyida kuzatiladi. Kod mavjudligi yakuniy qabul dalili emas. Commit ustuni hozircha ishchi daraxt; avtomatik commit yaratilmaydi.

## Checkpoint

- Boshlang‘ich Git holati toza.
- Node 24.18.0, Prisma 5.22 mavjud.
- Baseline typecheck: muvaffaqiyatsiz (Prisma config, Zod4, Decimal, report items, transfer, JWT).
- Docker standart sandboxda yopiq; faqat alohida test konteyneri uchun escalation tekshiruvi muvaffaqiyatli. Haqiqiy bazaga tegilmaydi.
- Baseline build davom etmoqda.
- MKT/LEG/PILOT: haqiqiy intervyu, tasdiqlar va 14 kunlik pilot tashqi dalillari yo‘q.

| ID | Release | Status | Natija / kerakli contract | Dalil / to‘siq | Keyingi amal |
| --- | --- | --- | --- | --- | --- |
| MKT-01.01 | CORE-1 | blocked_external | 10–15 ta biznes egasi va 5–10 ta kassir bilan suhbat o‘tkazish. | — | — |
| MKT-01.02 | CORE-1 | blocked_external | Amaldagi kassada bir ish kunining asosiy amallarini kuzatish. | — | — |
| MKT-01.03 | CORE-1 | blocked_external | Qaysi qurilmalar, internet, printer, tarozi va fiskal provayder ishlatilishini yozib olish. | — | — |
| MKT-01.04 | CORE-1 | blocked_external | Hozirgi dasturdan ko‘chishdagi qiyinchiliklar va to‘lashga tayyor narxni tekshirish. | — | — |
| MKT-01.05 | CORE-1 | blocked_external | Eng ko‘p talab qilingan besh muammo va mahsulotning ustunligini belgilash. | — | — |
| MKT-01.06 | CORE-1 | blocked_external | Kamida uchta pilot biznes, ularning sinov doirasi va muvaffaqiyat mezonini kelishish. | — | — |
| FIX-01.01 | CORE-1 | todo | TypeScript, Prisma konfiguratsiyasi, Zod va JWT turlari bo‘yicha xatolarni tuzatish. | — | — |
| FIX-01.02 | CORE-1 | todo | Savdo hisobotidagi yuklanmagan `items`ga murojaatni tuzatish. | — | — |
| FIX-01.03 | CORE-1 | todo | Transfer yaratishda bog‘langan mahsulot qatorlarini to‘g‘ri saqlash. | — | — |
| FIX-01.04 | CORE-1 | todo | Qoralamada faqat izoh/mijoz o‘zgarsa mahsulot qatorlari saqlanishini ta’minlash. | — | — |
| FIX-01.05 | CORE-1 | todo | Chegirma alohida o‘zgarsa summalarni qayta hisoblash; nol qiymatni to‘g‘ri qabul qilish. | — | — |
| FIX-01.06 | CORE-1 | todo | Ro‘yxatdan o‘tish javobini frontend ehtiyoji bilan moslashtirish; birlamchi yaratishni tranzaksiyaga olish. | — | — |
| FIX-01.07 | CORE-1 | todo | SKU va barkod noyobligini tashkilot doirasiga o‘tkazish; mavjud bazaga xavfsiz migratsiya tayyorlash. | — | — |
| FIX-01.08 | CORE-1 | todo | `ignoreBuildErrors`ni olib tashlash; paketlar mosligini va Prisma client yaratishni majburiy tekshirish. | — | — |
| FIX-01.09 | CORE-1 | todo | Docker build, standalone chiqishi va bazaga ulanish tartibini tuzatish. | — | — |
| FIX-01.10 | CORE-1 | todo | Maxfiy muhit fayllari image yoki build kontekstiga kirishini to‘xtatish. | — | — |
| SEC-01.01 | CORE-1 | todo | Tashkilotni faqat so‘rov tanasidan emas, haqiqiy sessiya va faol a’zolikdan aniqlash. | — | — |
| SEC-01.02 | CORE-1 | todo | Har bir ro‘yxat, tafsilot, o‘zgartirish, eksport, fayl va fon ishida tashkilot chegarasini tekshirish. | — | — |
| SEC-01.03 | CORE-1 | todo | Do‘kon, kassa, smena, mahsulot, mijoz va to‘lov bir tashkilotga tegishli ekanini tekshirish. | — | — |
| SEC-01.04 | CORE-1 | todo | Egasi/admin/kassir uchun amallar jadvalini yozish va serverda qo‘llash. | — | — |
| SEC-01.05 | CORE-1 | todo | Kassir boshqa kassir smenasida ruxsatsiz savdo qilmasligi; tannarx va foydani vakolatsiz ko‘rmasligi. | — | — |
| SEC-01.06 | CORE-1 | todo | Ruxsatlar bekor bo‘lganda eski sessiya ham bu amallarni bajara olmasligi. | — | — |
| SEC-01.07 | CORE-1 | todo | Admin panel va yordam xizmati kirishlarini ham shu nazoratga olish. | — | — |
| SEC-02.01 | CORE-1 | todo | HTTPS; productionda kuchli kalit majburiy, standart kalit bilan ishga tushmaslik. | — | — |
| SEC-02.02 | CORE-1 | todo | Brauzer uchun xavfsiz sessiya yechimi: HttpOnly/Secure cookie, muddat, serverda bekor qilish; cookie ishlatilsa CSRF himoyasi. | — | — |
| SEC-02.03 | CORE-1 | todo | Chiqish, barcha qurilmalardan chiqish, parol almashtirish va parol tiklash. | — | — |
| SEC-02.04 | CORE-1 | todo | Telefon/e-mail tasdiqlash, bir martalik kod muddati va urinishlar chegarasi. | — | — |
| SEC-02.05 | CORE-1 | todo | Kirish, tiklash, import va qimmat so‘rovlarda tezlik/hajm cheklovlari. | — | — |
| SEC-02.06 | CORE-1 | todo | Owner, platforma admini va muhim amallar uchun ikki bosqichli tasdiq. | — | — |
| SEC-02.07 | CORE-1 | todo | API javobi va loglardan parol xeshi, token, maxfiy kalit va keraksiz shaxsiy maydonlarni chiqarish. | — | — |
| SEC-02.08 | CORE-1 | todo | XSS, fayl yuklash, zararli CSV va noto‘g‘ri parametrlar himoyasi. | — | — |
| SEC-02.09 | CORE-1 | todo | Sessiyalar va xavfsizlik hodisalari tarixi; shubhali kirish haqida bildirishnoma. | — | — |
| USR-01.01 | CORE-1 | todo | Taklif qilish, rol/do‘kon berish, tahrirlash, vaqtincha bloklash va arxivlash. | — | — |
| USR-01.02 | CORE-1 | todo | Oxirgi egani o‘chirish/bloklashga yo‘l qo‘ymaslik; egalikni topshirish jarayoni. | — | — |
| USR-01.03 | CORE-1 | todo | Bir foydalanuvchining bir nechta biznesi orasida vakolat bilan almashish. | — | — |
| USR-01.04 | CORE-1 | todo | Tez kassir almashish uchun PIN; PIN yuqori vakolat o‘rnini bosmasligi. | — | — |
| USR-01.05 | CORE-1 | todo | Qaytarish, narx o‘zgartirish, katta chegirma va inventar farqiga manager tasdig‘i. | — | — |
| USR-01.06 | CORE-1 | todo | Kelgusida omborchi/buxgalter/kuzatuvchi roli va moslashtiriladigan vakolatlar. | — | — |
| POS-01.01 | CORE-1 | todo | Narx, tannarx, birlik, kassir va vakolatlarni serverda ishonchli manbadan olish. | — | — |
| POS-01.02 | CORE-1 | todo | Bo‘sh savat, manfiy/yaroqsiz son, ortiqcha chegirma va noto‘g‘ri IDlarni rad etish. | — | — |
| POS-01.03 | CORE-1 | todo | Savdo, to‘lov, ombor va auditni bitta nazorat qilinadigan amalda yakunlash. | — | — |
| POS-01.04 | CORE-1 | todo | Takror so‘rov bir savdoni ikki marta yozmasligi uchun yagona amal kaliti qo‘shish — idempotency. | — | — |
| POS-01.05 | CORE-1 | todo | Ochiq smena, qoldiq, limit va holatni tranzaksiya ichida tekshirish; parallel amallardan himoya. | — | — |
| POS-01.06 | CORE-1 | todo | Chek raqamini yozuvlar soniga bog‘lamasdan noyob ajratish; fiskal raqamni alohida saqlash. | — | — |
| POS-01.07 | CORE-1 | todo | Timeoutdan keyin “sotildimi?” holatini tekshirib, xavfsiz davom ettirish. | — | — |
| POS-01.08 | CORE-1 | todo | Yakunlangan savdoni yashirin tahrirlash/o‘chirishni taqiqlash; tuzatishni qarshi hujjat bilan yuritish. | — | — |
| POS-02.01 | CORE-1 | todo | Qoralamani saqlash, vaqtincha chetga qo‘yish, qayta ochish va bekor qilish. | — | — |
| POS-02.02 | CORE-1 | todo | Savatni brauzer yopilishi/yangilanishidan tiklash; qurilma va foydalanuvchi chegarasi. | — | — |
| POS-02.03 | CORE-1 | todo | Aralash to‘lov: masalan, 60 000 naqd + 40 000 karta; qisman nasiya. | — | — |
| POS-02.04 | CORE-1 | todo | Qaytimni haqiqiy naqd berilgan summa bilan ko‘rsatish, tushumga faqat tegishli summani yozish. | — | — |
| POS-02.05 | CORE-1 | todo | Klaviatura tezkor tugmalari, USB skaner, tezkor mahsulotlar, qulay qidiruv. | — | — |
| POS-02.06 | CORE-1 | todo | Har qator/butun chek chegirmasi; foiz/summa; sabab va tasdiq. | — | — |
| POS-02.07 | CORE-1 | todo | Qoldiq va narx o‘zgarganini savat yakunida tushunarli ko‘rsatish. | — | — |
| POS-02.08 | CORE-1 | todo | Mijoz tanlash, chek izohi, sotuvchi/xizmat turi kerak bo‘lsa belgilash. | — | — |
| POS-02.09 | CORE-1 | todo | Chekni qayta chiqarish, elektron chek, 58/80 mm andozalari; qayta chiqarishni belgilash. | — | — |
| RET-01.01 | CORE-1 | todo | Original chek bo‘yicha to‘liq va qisman qaytarish. | — | — |
| RET-01.02 | CORE-1 | todo | Oldingi qaytarishlarni hisobga olish; sotilganidan ko‘p qaytarishni taqiqlash. | — | — |
| RET-01.03 | CORE-1 | todo | Chegirma va soliqni qaytarilayotgan qatorga to‘g‘ri taqsimlash. | — | — |
| RET-01.04 | CORE-1 | todo | Tovar omborga qaytadimi, brak omborigami yoki hisobdan chiqadimi — aniq tanlash. | — | — |
| RET-01.05 | CORE-1 | todo | Naqd/karta/nasiya aralash savdoda pul va qarzning qaytarish tartibini belgilash. | — | — |
| RET-01.06 | CORE-1 | todo | Provayder orqali refund, uning kutish/xato holati va takror so‘rovdan himoya. | — | — |
| RET-01.07 | CORE-1 | todo | Sabab, vakolat, tasdiqlovchi, qaytarma chek va audit. | — | — |
| RET-01.08 | CORE-1 | todo | Tovar almashtirishni original qaytarish + yangi savdo sifatida bog‘lash. | — | — |
| CAT-01.01 | CORE-1 | todo | Kategoriya daraxti, brend, rasm, tavsif va faol/arxiv holati. | — | — |
| CAT-01.02 | CORE-1 | todo | Bir mahsulot uchun bir nechta barkod; barkod yaratish va etiketka chiqarish. | — | — |
| CAT-01.03 | CORE-1 | todo | Rang/o‘lcham kabi variantlar; har variantning alohida qoldig‘i va barkodi. | — | — |
| CAT-01.04 | CORE-1 | todo | Birlik konvertatsiyasi: 1 quti = 12 dona; asosiy birlikda qoldiq, hujjatda savdo birligi. | — | — |
| CAT-01.05 | CORE-1 | todo | Kasr bilan sotish, birlik aniqligi, tarozi barkodidan vazn/narx ajratish. | — | — |
| CAT-01.06 | CORE-1 | todo | Chakana/ulgurji/mijoz narxlari; filial narxi va sanadan kuchga kiradigan narx. | — | — |
| CAT-01.07 | CORE-1 | todo | Narx tarixi va ommaviy o‘zgartirish; tannarx uchun alohida ruxsat. | — | — |
| CAT-01.08 | CORE-1 | todo | Excel/CSV import, oldindan ko‘rish, dublikat/xato qatorlar hisoboti, eksport. | — | — |
| CAT-01.09 | CORE-1 | todo | Soliq turi, MXIK va markirovka xususiyatlari tegishli tovar uchun. | — | — |
| INV-01.01 | CORE-1 | todo | Har bir o‘zgarish uchun hujjat va ombor harakati; bevosita qoldiqni almashtirishni taqiqlash. | — | — |
| INV-01.02 | CORE-1 | todo | Boshlang‘ich qoldiqni hujjat bilan kiritish; musbat/manfiy tuzatish, sabab va tasdiq. | — | — |
| INV-01.03 | CORE-1 | todo | Tasdiqlangan hujjat o‘zgarmasligi; xatoni bekor qiluvchi yoki qarshi hujjat. | — | — |
| INV-01.04 | CORE-1 | todo | Jo‘natishda yetarli qoldiq, yo‘ldagi mahsulot, qisman qabul, kamomad/brak hisobini yuritish. | — | — |
| INV-01.05 | CORE-1 | todo | Transferni jo‘natishdan oldin bekor qilish; jo‘natilgandan keyingi qaytarish qoidasi. | — | — |
| INV-01.06 | CORE-1 | todo | Qoldiq jurnaliga mosligini tekshiradigan avtomatik solishtirish va farq ogohlantirishi. | — | — |
| INV-01.07 | CORE-1 | todo | Manfiy qoldiq siyosatini aniq belgilash; yoqilsa foyda/tannarx ta’sirini hisoblash. | — | — |
| INV-02.01 | CORE-1 | todo | To‘liq/qisman sanash; kutilgan qoldiqni yashirib sanash imkoniyati. | — | — |
| INV-02.02 | CORE-1 | todo | Sanash davridagi savdolarni hisobga olish yoki vaqtinchalik bloklash siyosati. | — | — |
| INV-02.03 | CORE-1 | todo | Farq hujjati, qayta sanash va tasdiqlovchi. | — | — |
| INV-02.04 | CORE-1 | todo | Minimal/maksimal qoldiq, tugayotgan mahsulot va qayta buyurtma tavsiyasi. | — | — |
| INV-02.05 | CORE-1 | todo | Ombor manzili/zonasi, brak va rezerv qoldiq kerak bo‘lsa alohida yuritish. | — | — |
| INV-02.06 | CORE-1 | todo | Partiya, yaroqlilik muddati, FEFO tanlash va muddati yaqin ogohlantirish — oziq-ovqat segmentida P1. | — | — |
| INV-02.07 | CORE-1 | todo | Seriya raqami/kafolat — elektronika segmentida P1. | — | — |
| PUR-01.01 | CORE-1 | todo | Yetkazib beruvchi kartasi, kontaktlar, rekvizitlar, shartlar va tarix. | — | — |
| PUR-01.02 | CORE-1 | todo | Buyurtma → qisman/to‘liq qabul → xarid hisoboti → to‘lov zanjiri. | — | — |
| PUR-01.03 | CORE-1 | todo | Yetkazib beruvchiga qaytarish, narx/miqdor farqi va qarzni yangilash. | — | — |
| PUR-01.04 | CORE-1 | todo | Yetkazib beruvchi qarzi, oldindan to‘lov va qisman to‘lash. | — | — |
| PUR-01.05 | CORE-1 | todo | Yetkazish/xarid xarajatlarini tannarxga taqsimlash siyosati. | — | — |
| PUR-01.06 | CORE-1 | todo | Xarid narxi tarixi, mahsulot/yetkazib beruvchi bo‘yicha tahlil. | — | — |
| CRM-01.01 | CORE-1 | todo | Nasiya uchun mijoz, vakolat va limitni serverda majburiy tekshirish. | — | — |
| CRM-01.02 | CORE-1 | todo | Qarz yozuvini haqiqiy pul to‘lovidan ajratish: nasiya naqd tushum deb olinmasligi. | — | — |
| CRM-01.03 | CORE-1 | todo | Qarzni naqd/karta/o‘tkazma bilan undirish; pulni haqiqiy smena yoki hisobga yozish. | — | — |
| CRM-01.04 | CORE-1 | todo | Qisman undirish, oldindan to‘lov, ortiqcha to‘lov va qaytarish qoidalari. | — | — |
| CRM-01.05 | CORE-1 | todo | To‘lovni qaysi qarz/savdoga ajratishni yuritish; boshlang‘ich qarzni alohida hujjat bilan kiritish. | — | — |
| CRM-01.06 | CORE-1 | todo | Qarzni o‘chirish/tuzatish faqat sabab, vakolat va audit bilan. | — | — |
| CRM-01.07 | CORE-1 | todo | Mijoz ko‘chirmasi: savdo, qaytarish, to‘lov, qarz qoldig‘i va muddat. | — | — |
| CRM-02.01 | CORE-1 | todo | P1: mijoz qidirish, dublikatlarni nazorat qilish, xarid tarixi, guruhlar va narx darajasi. | — | — |
| CRM-02.02 | CORE-1 | todo | P1: qarz muddati/kechikish hisoboti, mijozga ko‘chirma va rozilik asosida eslatma. | — | — |
| CRM-02.03 | EXTENSIONS | deferred | P2: bonus ballari, chegirma kartasi, promo-kod va sovg‘a sertifikati. | — | — |
| CRM-02.04 | EXTENSIONS | deferred | P2: bonusning qaytarishda bekor bo‘lishi, muddati va suiiste’moldan himoya. | — | — |
| CRM-02.05 | EXTENSIONS | deferred | P2: marketing SMS/Telegram; xizmat xabari va reklama roziligini alohida boshqarish. | — | — |
| FIN-01.01 | CORE-1 | todo | Har kassada bir ochiq smena qoidasi bazada ham himoyalangan bo‘lishi. | — | — |
| FIN-01.02 | CORE-1 | todo | Smenani ochish, yopish va topshirish; ochiq savdolar/integratsiya kutishlari uchun siyosat. | — | — |
| FIN-01.03 | CORE-1 | todo | Savdo, qarz undirish, refund, naqd kirim/chiqim va inkassatsiyani alohida hisoblash. | — | — |
| FIN-01.04 | CORE-1 | todo | Sanalgan pul, kutilgan pul, farq, sabab va rahbar tasdig‘i. | — | — |
| FIN-01.05 | CORE-1 | todo | Naqd savdoda berilgan pul/qaytimni tushum bilan chalkashtirmaslik. | — | — |
| FIN-01.06 | CORE-1 | todo | Karta/QR/o‘tkazma bo‘yicha provayder tushumi, komissiya va bank tushumini solishtirish. | — | — |
| FIN-01.07 | CORE-1 | todo | Yopilgan smenani yashirin tahrirlamaslik; tuzatish hujjati. | — | — |
| FIN-02.01 | CORE-1 | todo | Tannarx usulini belgilash: dastlab vaznli o‘rtacha; FIFO/partiya ehtiyoji bo‘lsa kengaytirish. | — | — |
| FIN-02.02 | CORE-1 | todo | Har savdo qatorining tarixiy tannarxi, chegirmasi, solig‘i va yaxlitlanishini saqlash. | — | — |
| FIN-02.03 | CORE-1 | todo | Chek chegirmasini qatorlarga taqsimlash; qaytarishni shu qiymatlardan hisoblash. | — | — |
| FIN-02.04 | CORE-1 | todo | Biznes xarajatlari, toifalari va to‘lov hisoblari. | — | — |
| FIN-02.05 | CORE-1 | todo | Yalpi foyda va operatsion foydani aniq ajratish; to‘liq buxgalteriya hisobi bilan teng deb ko‘rsatmaslik. | — | — |
| FIN-02.06 | CORE-1 | todo | Naqd, bank va provayder hisoblari orasidagi pul o‘tkazmalarini ikki marta tushum deb hisoblamaslik. | — | — |
| FIN-02.07 | CORE-1 | todo | Soliq stavkasi, imtiyoz, narx ichida/tashqarisida soliq siyosatini sozlash; stavka tarixini saqlash. | — | — |
| REP-01.01 | CORE-1 | todo | P0: tashkilot va do‘kon filtri hamma ko‘rsatkichga tatbiq etilishi. | — | — |
| REP-01.02 | CORE-1 | todo | P0: vaqt zonasi, davr boshi/oxiri; oxirgi kun to‘liq kirishi. | — | — |
| REP-01.03 | CORE-1 | todo | P0: yig‘indilar joriy sahifadan emas, barcha mos yozuvlardan olinishi. | — | — |
| REP-01.04 | CORE-1 | todo | P0: sotuv, refund, nasiya va haqiqiy pul tushumi bir-biridan ajratilishi. | — | — |
| REP-01.05 | CORE-1 | todo | P0: tannarx har qator `miqdor × tarixiy tannarx`dan hisoblanishi. | — | — |
| REP-01.06 | CORE-1 | todo | P1: savdo, mahsulot, kategoriya, kassir, filial va to‘lov turi kesimidagi tahlil. | — | — |
| REP-01.07 | CORE-1 | todo | P1: qoldiq qiymati, ombor harakati, kam qoldiq, yaroqlilik va sekin sotiladigan tovarlar. | — | — |
| REP-01.08 | CORE-1 | todo | P1: smena, pul farqi, mijoz qarzi muddati, yetkazib beruvchi qarzi va xarid hisoboti. | — | — |
| REP-01.09 | CORE-1 | todo | P1: to‘liq filtrlangan CSV/XLSX/PDF eksport; katta eksportni fon ishida bajarish. | — | — |
| REP-01.10 | CORE-1 | todo | P1: jadvaldagi umumiy son, eksport va dashboard bir davr uchun mos kelishi. | — | — |
| REP-01.11 | EXTENSIONS | deferred | P2: rejalashtirilgan hisobot, filial taqqoslash, KPI va talab prognozi. | — | — |
| LOC-01.01 | CORE-1 | todo | Mijoz faoliyati, soliq rejimi va savdo turiga tatbiq etiladigan amaldagi talablarni tekshirish. | — | — |
| LOC-01.02 | CORE-1 | todo | Shuni POS fiskal provayderga ulanadimi yoki mustaqil virtual kassa maqomini oladimi — qaror. | — | — |
| LOC-01.03 | CORE-1 | todo | Birinchi chiqarish uchun tegishli reestr/talablarga mos provayderni tanlash; shartnoma va test muhiti. | — | — |
| LOC-01.04 | CORE-1 | todo | Savdo, qaytarish, bekor qilish, aralash to‘lov va smena bo‘yicha provider oqimlarini xaritalash. | — | — |
| LOC-01.05 | CORE-1 | todo | Fiskal ID, raqam, vaqt, QR va holatni saqlash; qayta chiqarishda original fiskal ma’lumotni ishlatish. | — | — |
| LOC-01.06 | CORE-1 | todo | MXIK, birlik, soliq va zarur chek rekvizitlarini mahsulot/hujjatga qo‘shish va validatsiya qilish. | — | — |
| LOC-01.07 | CORE-1 | todo | Timeoutda provayder holatini tekshirish; takror fiskal chek yaratmaslik. | — | — |
| LOC-01.08 | CORE-1 | todo | Fiskal yuborish xatosini kassir va egaga ko‘rsatish; qo‘lda hal qilish/audit jarayoni. | — | — |
| LOC-01.09 | CORE-1 | todo | Fiskal va savdo summalarini kunlik solishtirish. | — | — |
| LOC-02.01 | CORE-1 | todo | 2D skaner va Data Matrix o‘qish; kodni mahsulot va birlik bilan bog‘lash. | — | — |
| LOC-02.02 | CORE-1 | todo | Takror, yaroqsiz yoki allaqachon sotilgan kodni nazorat qilish. | — | — |
| LOC-02.03 | CORE-1 | todo | Qabul qilish, savdo, qaytarish va hisobdan chiqarish uchun tegishli integratsiya. | — | — |
| LOC-02.04 | CORE-1 | todo | Markirovka kodini fiskal jarayon bilan bog‘lash va holatlar tarixini saqlash. | — | — |
| LOC-02.05 | CORE-1 | todo | Pilotdagi aniq mahsulot guruhlari bo‘yicha moslikni tasdiqlash. | — | — |
| LOC-03.01 | CORE-1 | todo | P1: tanlangan terminal/QR/to‘lov provayderi bilan pilot uchun integratsiya. | — | — |
| LOC-03.02 | CORE-1 | todo | Click/Payme yoki boshqa provayderlar — mijoz ehtiyoji, API va shartnoma imkoniyatiga qarab. | — | — |
| LOC-03.03 | CORE-1 | todo | Imzolangan callback, serverdan holat tekshirish, dublikatdan himoya va kunlik solishtirish. | — | — |
| LOC-03.04 | CORE-1 | todo | “Kutilmoqda”, “tasdiqlandi”, “bekor bo‘ldi”, “qaytarildi” holatlari; noma’lum to‘lovni muvaffaqiyatli deb olmaslik. | — | — |
| LOC-03.05 | CORE-1 | todo | Karta ma’lumotlarini POS bazasida saqlamaslik; to‘lovni provayder tomonida bajarish. | — | — |
| LOC-03.06 | EXTENSIONS | deferred | P2: buxgalteriya/1C eksporti, EHF va bank bilan ulanish; tanlangan integratsiyaning ikki tomonlama mosligi. | — | — |
| OFF-01.01 | CORE-1 | todo | Tarmoq holatini ko‘rsatish, savatni xavfsiz saqlash va muvaffaqiyatsiz so‘rovni nazoratli takrorlash. | — | — |
| OFF-01.02 | CORE-1 | todo | Savdo yozilgan, ammo javob kelmagan holatda serverdagi natijani topish. | — | — |
| OFF-01.03 | CORE-1 | todo | Printer ishlamasa savdoni ikkinchi marta yaratmasdan chekni qayta chiqarish. | — | — |
| OFF-01.04 | CORE-1 | todo | Qurilma ishdan chiqsa boshqa qurilmadan vakolatli davom ettirish. | — | — |
| OFF-01.05 | CORE-1 | todo | Integratsiya xatosi, savdo xatosi va faqat chek chop etish xatosini alohida ko‘rsatish. | — | — |
| OFF-02.01 | CORE-1 | todo | PWA va lokal saqlash; mahsulot/narxlar uchun yangilanish chegarasi. | — | — |
| OFF-02.02 | CORE-1 | todo | Lokal savdo navbati, qurilma identifikatori va server bilan bir martalik sinxronlash. | — | — |
| OFF-02.03 | CORE-1 | todo | Offline qoldiqni bir nechta kassada mutlaq kafolatlab bo‘lmasligini siyosat bilan hal qilish: rezerv, limit yoki ruxsatli manfiy qoldiq. | — | — |
| OFF-02.04 | CORE-1 | todo | Eskirgan narx, nasiya limiti, bloklangan xodim va smena uchun alohida cheklov. | — | — |
| OFF-02.05 | CORE-1 | todo | Lokal ma’lumot xavfsizligi, chiqishda tozalash va sinxronlanmagan savdoni yo‘qotishdan himoya. | — | — |
| OFF-02.06 | CORE-1 | todo | Kartali to‘lov, markirovka va fiskal amallar offline rejimda faqat provayder/qoidalar ruxsat bergan tartibda. | — | — |
| OFF-02.07 | CORE-1 | todo | Navbat holati, xato savdolarni qo‘lda hal qilish, egaga ogohlantirish. | — | — |
| HW-01.01 | CORE-1 | todo | USB/2D skaner, 58/80 mm printer, pul tortmasi va tanlangan elektron tarozi. | — | — |
| HW-01.02 | CORE-1 | todo | Qurilmalar ro‘yxati, OS/brauzer, ulanish usuli va ishlaydigan modellar jadvali. | — | — |
| HW-01.03 | CORE-1 | todo | Zarur bo‘lsa xavfsiz lokal printer/tarozi agenti; uni o‘rnatish va yangilash. | — | — |
| HW-01.04 | CORE-1 | todo | Windows kassasi, planshet va mobil ekranlarda real sinov. | — | — |
| HW-01.05 | CORE-1 | todo | Kassir ekrani uchun katta tugmalar; egaga telefon orqali dashboard. | — | — |
| HW-01.06 | EXTENSIONS | deferred | P2: mijoz displeyi, alohida mobil ilova va ombor terminali. | — | — |
| UX-01.01 | CORE-1 | todo | Birlamchi sozlash: tashkilot → filial/kassa → import → boshlang‘ich qoldiq → sinov savdo. | — | — |
| UX-01.02 | CORE-1 | todo | O‘zbek lotin va rus tili; barcha ishchi matnlarni yagona tarjima tizimiga olish. | — | — |
| UX-01.03 | CORE-1 | todo | Bir xil jadval/formalar, qidiruv, filtr, saralash, sahifalash va bo‘sh holatlar. | — | — |
| UX-01.04 | CORE-1 | todo | Xatolarni odam tushunadigan qilib yozish; foydalanuvchi keyin nima qilishi ko‘rsatilishi. | — | — |
| UX-01.05 | CORE-1 | todo | Loading, qayta urinish, saqlanmagan o‘zgarishlar va amaliy holatning aniq belgisi. | — | — |
| UX-01.06 | CORE-1 | todo | Klaviatura bilan boshqarish, kontrast, label va fokus; kassa uchun katta o‘qiladigan matn. | — | — |
| UX-01.07 | CORE-1 | todo | Rolga mos boshlang‘ich ekran va muhim ogohlantirishlar. | — | — |
| UX-01.08 | CORE-1 | todo | Qisqa video/yo‘riqnoma, demo ma’lumotlar, yangi kassirni o‘rgatish. | — | — |
| UX-01.09 | CORE-1 | todo | Import xatolari va printer/internet sozlash bo‘yicha yordam sahifalari. | — | — |
| DATA-01.01 | CORE-1 | todo | Moliyaviy hisobni aniq decimal bilan bajarish; pulni turli joyda turlicha yaxlitlamaslik. | — | — |
| DATA-01.02 | CORE-1 | todo | Foreign key, noyob indeks, son/holat cheklovi va kerakli qidiruv indekslari. | — | — |
| DATA-01.03 | CORE-1 | todo | Qoldiq/savdo/smena holatini atomik o‘zgartirish; deadlock/konfliktni nazoratli qayta urinish. | — | — |
| DATA-01.04 | CORE-1 | todo | Tashkilot kaliti va bog‘langan resurs egaligini butun modelda izchil qo‘llash. | — | — |
| DATA-01.05 | CORE-1 | todo | Audit yozuvini biznes o‘zgarishi bilan bir tranzaksiyada saqlash. | — | — |
| DATA-01.06 | CORE-1 | todo | Tashqi provayder chaqirig‘ini uzoq baza tranzaksiyasi ichida ushlamaslik; navbat va kompensatsiya jarayoni. | — | — |
| DATA-01.07 | CORE-1 | todo | Tashqi chaqiriq natijasi noma’lum bo‘lsa tekshirish va solishtirish; “ikki tizimda bitta tranzaksiya” deb faraz qilmaslik. | — | — |
| DATA-01.08 | CORE-1 | todo | Standart xato formati, so‘rov identifikatori, pagination/hajm cheklovi va API shartnomasi. | — | — |
| DATA-01.09 | CORE-1 | todo | Fayllar uchun vakolatli saqlash, yuklash cheklovi va o‘chirish siyosati. | — | — |
| DATA-01.10 | CORE-1 | todo | Migratsiya, ma’lumot ko‘chirish va mavjud hisobni tekshirish uchun skript/reja. | — | — |
| OPS-01.01 | CORE-1 | todo | Development, staging va production alohida baza/kalit bilan. | — | — |
| OPS-01.02 | CORE-1 | todo | Builddan `db push`ni chiqarish; versiyalangan migratsiyani alohida chiqarish bosqichida bajarish. | — | — |
| OPS-01.03 | CORE-1 | todo | Yangi/avvalgi ilova bilan mos migratsiya, ma’lumot backfilli va qaytish rejasi. | — | — |
| OPS-01.04 | CORE-1 | todo | CI: lint → turlar → test → build → staging → qabul tekshiruvi → production. | — | — |
| OPS-01.05 | CORE-1 | todo | Image versiyasi, minimal vakolatli jarayon, xavfsiz secret saqlash va kalit aylantirish. | — | — |
| OPS-01.06 | CORE-1 | todo | TLS, domen, firewall; bazani umumiy internetga ochmaslik. | — | — |
| OPS-01.07 | CORE-1 | todo | Health/readiness endpoint, nazoratli restart, ulanish pooli va graceful shutdown. | — | — |
| OPS-01.08 | CORE-1 | todo | Yangilash vaqtida savdoni yo‘qotmaslik; texnik xizmat oynasi va xabar berish. | — | — |
| OPS-02.01 | CORE-1 | todo | Tuzilgan loglar, request ID, tashkilot ID; maxfiy/shaxsiy ma’lumotlarni niqoblash. | — | — |
| OPS-02.02 | CORE-1 | todo | API xatolari, sekin so‘rov, baza, disk, navbat, fiskal/to‘lov xatolari monitoringi. | — | — |
| OPS-02.03 | CORE-1 | todo | Savdo/to‘lov/qoldiq solishtirish farqi uchun biznes ogohlantirishlari. | — | — |
| OPS-02.04 | CORE-1 | todo | Navbatdagi ishlarni takrorlash va yechilmagan ishlar ro‘yxati. | — | — |
| OPS-02.05 | CORE-1 | todo | Xatoni mas’ul xodimga yuborish va eskalatsiya; kim javob berishi aniq bo‘lishi. | — | — |
| OPS-02.06 | CORE-1 | todo | Status sahifasi, hodisa jurnali va jiddiy hodisadan keyingi tahlil. | — | — |
| OPS-03.01 | CORE-1 | todo | Shifrlangan avtomatik backup; bazaning asosiy serveridan boshqa saqlash joyi. | — | — |
| OPS-03.02 | CORE-1 | todo | Baza bilan birga mahsulot rasmlari, hujjatlar va zarur konfiguratsiya zaxirasi. | — | — |
| OPS-03.03 | CORE-1 | todo | Nuqtaga tiklash imkoniyati, backup muddati va kirish vakolati. | — | — |
| OPS-03.04 | CORE-1 | todo | Alohida muhitga amaliy tiklash sinovi; faqat “backup olindi” xabari yetarli emas. | — | — |
| OPS-03.05 | CORE-1 | todo | Tashkilotga tegishli yozuvni tiklashda boshqa tashkilot ma’lumotiga ta’sirni tekshirish. | — | — |
| OPS-03.06 | CORE-1 | todo | Tiklashdan keyin provider, offline navbat va savdo holatlarini solishtirish. | — | — |
| OPS-04.01 | CORE-1 | todo | Pilotdan katalog, savdo hajmi, kassalar va parallel so‘rovlar profilini olish. | — | — |
| OPS-04.02 | CORE-1 | todo | Dastlabki test profili: bir tashkilotda 50 000 mahsulot, 1 million savdo qatori, 20 parallel faol kassa. | — | — |
| OPS-04.03 | CORE-1 | todo | Namuna yuklamada qidiruv p95 ≤ 500 ms, ichki savdo yakunlash p95 ≤ 2 s; provider vaqti alohida o‘lchanadi. | — | — |
| OPS-04.04 | CORE-1 | todo | N+1 so‘rovlarni kamaytirish, indekslar, cheklangan pagination va katta eksport uchun worker. | — | — |
| OPS-04.05 | CORE-1 | todo | Hisob/ruxsat ma’lumotini eskirgan keshdan olish xavfini boshqarish. | — | — |
| OPS-04.06 | CORE-1 | todo | Stress, uzoq davomli yuklama va tiklanish sinovlari. | — | — |
| QA-01.01 | CORE-1 | todo | Pul/chegirma/soliq/tannarx/nasiya formulalari uchun birlik testlari. | — | — |
| QA-01.02 | CORE-1 | todo | Haqiqiy PostgreSQL bilan savdo, qoldiq, qaytarish va migratsiya integratsion testlari. | — | — |
| QA-01.03 | CORE-1 | todo | Kassirning boshidan oxirigacha jarayonlari uchun brauzer testlari. | — | — |
| QA-01.04 | CORE-1 | todo | Tashkilot/rol/do‘kon chegaralarining barcha API guruhlari bo‘yicha testlari. | — | — |
| QA-01.05 | CORE-1 | todo | Parallel so‘rov va takror amal testlari. | — | — |
| QA-01.06 | CORE-1 | todo | Provider sandbox, timeout, noto‘g‘ri imzo, takror/kechikkan callback testlari. | — | — |
| QA-01.07 | CORE-1 | todo | Offline/reconnect, printer uzilishi, brauzer yopilishi va server restart sinovlari. | — | — |
| QA-01.08 | CORE-1 | todo | Paket xavfsizligi, secret scanning va stagingda xavfsizlik tekshiruvi. | — | — |
| QA-01.09 | CORE-1 | todo | Backup restore, migratsiya va chiqarishdan qaytish mashqi. | — | — |
| BIZ-01.01 | CORE-1 | todo | SaaS obuna, lokal o‘rnatish yoki ikkalasini qo‘llash modelini tanlash. | — | — |
| BIZ-01.02 | CORE-1 | todo | Tarifni filial/kassa/xodim yoki funksiyalar bo‘yicha tushunarli belgilash. | — | — |
| BIZ-01.03 | CORE-1 | todo | Sinov davri, obuna, hisob/invoice, to‘lov tarixi, yangilash va bekor qilish. | — | — |
| BIZ-01.04 | CORE-1 | todo | Tarif limitlarini backendda tekshirish; mavjud ma’lumotni limitdan oshganda yo‘qotmaslik. | — | — |
| BIZ-01.05 | CORE-1 | todo | Obuna tugaganda xabar, imtiyozli muddat, eksport va xavfsiz o‘qish rejimi siyosati. | — | — |
| BIZ-01.06 | CORE-1 | todo | Fiskal provayder, SMS, printer agenti va integratsiya xarajatlarini alohida hisoblash. | — | — |
| BIZ-01.07 | CORE-1 | todo | Marketing sahifasida haqiqatda ishlaydigan funksiyalar, narx, mos qurilmalar va yordam tartibi. | — | — |
| BIZ-02.01 | CORE-1 | todo | Tashkilotlar, tarif, xizmat holati, integratsiyalar va hodisalar uchun platforma admin paneli. | — | — |
| BIZ-02.02 | CORE-1 | todo | Support biznes ma’lumotiga faqat vaqtli, ruxsatli va auditli kira olishi. | — | — |
| BIZ-02.03 | CORE-1 | todo | Kassir/egasi uchun murojaat, diagnostika, javob muddati va favqulodda aloqa. | — | — |
| BIZ-02.04 | CORE-1 | todo | Mijozni o‘rnatish: import, boshlang‘ich qoldiq/qarz, qurilmalar, trening va ishga tushirish. | — | — |
| BIZ-02.05 | CORE-1 | todo | Ishga tushirishdan oldingi hisobni imzolangan/kelishilgan solishtirish bilan tasdiqlash. | — | — |
| BIZ-02.06 | CORE-1 | todo | Mavjud dasturdan ko‘chirishda ikki marta savdo yuritmaslik va o‘tish sanasini belgilash. | — | — |
| BIZ-02.07 | CORE-1 | todo | Xizmatdan chiqishda to‘liq ma’lumot eksporti va saqlash/o‘chirish tartibi. | — | — |
| LEG-01.01 | CORE-1 | blocked_external | Mijoz/xodim telefonlari, savdo va qarz tarixining maqsadi, kirishlari va saqlash muddatini belgilash. | — | — |
| LEG-01.02 | CORE-1 | blocked_external | Amaldagi shaxsga doir ma’lumotlar, saqlash joyi va reestr talablarini tegishli ma’lumot toifasi uchun tekshirish; hostingni shu tekshiruvdan keyin tanlash. | — | — |
| LEG-01.03 | CORE-1 | blocked_external | Maxfiylik siyosati, foydalanish shartlari, xizmat shartnomasi va javobgarlik chegarasi. | — | — |
| LEG-01.04 | CORE-1 | blocked_external | Qonun talab qiladigan moliyaviy yozuvlarni saqlash bilan shaxsiy ma’lumotni o‘chirish talabini moslashtirish. | — | — |
| LEG-01.05 | CORE-1 | blocked_external | Elektron chek, xizmat eslatmasi va reklama roziligini alohida qayd etish. | — | — |
| LEG-01.06 | CORE-1 | blocked_external | Integratsiya, xosting va aloqa provayderlariga uzatiladigan ma’lumotlarni hujjatlashtirish. | — | — |
| PILOT-01.01 | CORE-1 | blocked_external | Kamida uchta biznesda kelishilgan savdo hajmi va qurilmalar bilan sinash. | — | — |
| PILOT-01.02 | CORE-1 | blocked_external | Kamida ikki hafta odatiy savdo; oy/davr yopilishi ssenariysini ham alohida tekshirish. | — | — |
| PILOT-01.03 | CORE-1 | blocked_external | Har kuni savdo, pul, qarz, qoldiq va fiskal/to‘lov natijalarini solishtirish. | — | — |
| PILOT-01.04 | CORE-1 | blocked_external | Qaytarish, nasiya undirish, transfer, internet/printer uzilishi real yoki boshqariladigan sinovda bajarilishi. | — | — |
| PILOT-01.05 | CORE-1 | blocked_external | Kassir va egasi fikri, yordam murojaatlari va sarflangan vaqtni qayd qilish. | — | — |
| PILOT-01.06 | CORE-1 | blocked_external | Ma’lumot yo‘qolishi, ruxsatsiz kirish va hal qilinmagan pul farqi bo‘lmasligi. | — | — |
| RELEASE-01.01 | CORE-1 | todo | Chiqarish doirasidagi barcha P0 va zarur P1 vazifalar yopilgan. | — | — |
| RELEASE-01.02 | CORE-1 | todo | Muhim hisob/ruxsat ssenariylari avtomatik va amaliy sinovdan o‘tgan. | — | — |
| RELEASE-01.03 | CORE-1 | todo | Qaytarish, nasiya, xarid va smena hisoblari bir-biriga mos. | — | — |
| RELEASE-01.04 | CORE-1 | todo | Fiscal/markirovka talabi tegishli mijozlar uchun bajarilgan. | — | — |
| RELEASE-01.05 | CORE-1 | todo | Tanlangan qurilmalar sinovdan o‘tgan va moslik ro‘yxati e’lon qilingan. | — | — |
| RELEASE-01.06 | CORE-1 | todo | Real backup tiklash, migratsiya va qaytish mashqi muvaffaqiyatli. | — | — |
| RELEASE-01.07 | CORE-1 | todo | Kuzatish, ogohlantirish va javobgar yordam xodimi mavjud. | — | — |
| RELEASE-01.08 | CORE-1 | todo | Yuklama natijalari va xizmat ko‘rsatish maqsadlari hujjatlashtirilgan. | — | — |
| RELEASE-01.09 | CORE-1 | todo | Import, boshlang‘ich hisob, trening va onboarding qo‘llanmasi tayyor. | — | — |
| RELEASE-01.10 | CORE-1 | todo | Xizmat shartlari, maxfiylik, tarif va eksport/o‘chirish siyosati tayyor. | — | — |
| RELEASE-01.11 | CORE-1 | todo | Pilotta ochiq kritik yoki yuqori darajadagi xatolar qolmagan. | — | — |
| RELEASE-01.12 | CORE-1 | todo | Bozorga va’da qilinadigan har funksiya haqiqatan shu release’da ishlaydi. | — | — |
| MODEL-01 | CORE-1 | todo | PLAN1 jadvali, 1-qator/bosqich | — | — |
| MODEL-02 | CORE-1 | todo | PLAN1 jadvali, 2-qator/bosqich | — | — |
| MODEL-03 | CORE-1 | todo | PLAN1 jadvali, 3-qator/bosqich | — | — |
| MODEL-04 | CORE-1 | todo | PLAN1 jadvali, 4-qator/bosqich | — | — |
| MODEL-05 | CORE-1 | todo | PLAN1 jadvali, 5-qator/bosqich | — | — |
| MODEL-06 | CORE-1 | todo | PLAN1 jadvali, 6-qator/bosqich | — | — |
| MODEL-07 | CORE-1 | todo | PLAN1 jadvali, 7-qator/bosqich | — | — |
| MODEL-08 | CORE-1 | todo | PLAN1 jadvali, 8-qator/bosqich | — | — |
| MODEL-09 | CORE-1 | todo | PLAN1 jadvali, 9-qator/bosqich | — | — |
| MODEL-10 | CORE-1 | todo | PLAN1 jadvali, 10-qator/bosqich | — | — |
| MODEL-11 | CORE-1 | todo | PLAN1 jadvali, 11-qator/bosqich | — | — |
| MODEL-12 | CORE-1 | todo | PLAN1 jadvali, 12-qator/bosqich | — | — |
| MODEL-13 | CORE-1 | todo | PLAN1 jadvali, 13-qator/bosqich | — | — |
| MODEL-14 | CORE-1 | todo | PLAN1 jadvali, 14-qator/bosqich | — | — |
| SCENARIO-01 | CORE-1 | todo | PLAN1 jadvali, 1-qator/bosqich | — | — |
| SCENARIO-02 | CORE-1 | todo | PLAN1 jadvali, 2-qator/bosqich | — | — |
| SCENARIO-03 | CORE-1 | todo | PLAN1 jadvali, 3-qator/bosqich | — | — |
| SCENARIO-04 | CORE-1 | todo | PLAN1 jadvali, 4-qator/bosqich | — | — |
| SCENARIO-05 | CORE-1 | todo | PLAN1 jadvali, 5-qator/bosqich | — | — |
| SCENARIO-06 | CORE-1 | todo | PLAN1 jadvali, 6-qator/bosqich | — | — |
| SCENARIO-07 | CORE-1 | todo | PLAN1 jadvali, 7-qator/bosqich | — | — |
| SCENARIO-08 | CORE-1 | todo | PLAN1 jadvali, 8-qator/bosqich | — | — |
| SCENARIO-09 | CORE-1 | todo | PLAN1 jadvali, 9-qator/bosqich | — | — |
| SCENARIO-10 | CORE-1 | todo | PLAN1 jadvali, 10-qator/bosqich | — | — |
| SCENARIO-11 | CORE-1 | todo | PLAN1 jadvali, 11-qator/bosqich | — | — |
| SCENARIO-12 | CORE-1 | todo | PLAN1 jadvali, 12-qator/bosqich | — | — |
| STAGE-00 | CORE-1 | todo | PLAN1 jadvali, 0-qator/bosqich | — | — |
| STAGE-01 | CORE-1 | todo | PLAN1 jadvali, 1-qator/bosqich | — | — |
| STAGE-02 | CORE-1 | todo | PLAN1 jadvali, 2-qator/bosqich | — | — |
| STAGE-03 | CORE-1 | todo | PLAN1 jadvali, 3-qator/bosqich | — | — |
| STAGE-04 | CORE-1 | todo | PLAN1 jadvali, 4-qator/bosqich | — | — |
| STAGE-05 | CORE-1 | todo | PLAN1 jadvali, 5-qator/bosqich | — | — |
| STAGE-06 | CORE-1 | todo | PLAN1 jadvali, 6-qator/bosqich | — | — |
| STAGE-07 | EXTENSIONS | deferred | PLAN1 jadvali, 7-qator/bosqich | — | — |
| SEGMENT-01 | EXTENSIONS | deferred | PLAN1 jadvali, 1-qator/bosqich | — | — |
| SEGMENT-02 | EXTENSIONS | deferred | PLAN1 jadvali, 2-qator/bosqich | — | — |
| SEGMENT-03 | EXTENSIONS | deferred | PLAN1 jadvali, 3-qator/bosqich | — | — |
| SEGMENT-04 | EXTENSIONS | deferred | PLAN1 jadvali, 4-qator/bosqich | — | — |
| SEGMENT-05 | EXTENSIONS | deferred | PLAN1 jadvali, 5-qator/bosqich | — | — |
| SEGMENT-06 | EXTENSIONS | deferred | PLAN1 jadvali, 6-qator/bosqich | — | — |
| SEGMENT-07 | EXTENSIONS | deferred | PLAN1 jadvali, 7-qator/bosqich | — | — |
| SEGMENT-08 | EXTENSIONS | deferred | PLAN1 jadvali, 8-qator/bosqich | — | — |
