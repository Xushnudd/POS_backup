# Shuni POS: MVPdan productionga chiqish uchun to‘liq reja

Sana: **2026-yil 5-oktabr**.

Loyihaning boshlang‘ich holati uchun manba: [PROJECT.md](./PROJECT.md). Butun loyiha kodi qayta tekshirilmadi. Bu hujjat mavjud qo‘llanmadagi kamchiliklarni yopish, yetishmayotgan imkoniyatlarni qo‘shish va mahsulotni bozorda ishlatishga tayyorlash rejasidir. Qo‘llanma yozilgandan keyin tuzatilgan vazifalar ish boshlashda yopilgan deb belgilanishi kerak.

## 1. “To‘liq loyiha” deganda nimaga erishamiz?

Maqsad: do‘kon o‘zining kundalik savdosi, pul, qarz va ombor hisobini Shuni POS orqali yurita olishi; tizimda xatolik yoki internet uzilishi bo‘lsa ma’lumotni yo‘qotmasligi; egasi hisobotlarga ishonishi; xizmatni o‘rnatish, yangilash va qo‘llab-quvvatlash mumkin bo‘lishi.

Production — faqat serverga joylash degani emas. Quyidagilar birga tayyor bo‘lishi kerak:

- Savdo, qaytarish, qarz va ombor amallari yakunigacha ishlashi.
- Tashkilotlar ma’lumotlari va xodim vakolatlari to‘liq ajratilishi.
- Pul va mahsulot hisoblari o‘zaro mos bo‘lishi.
- Kerakli mahalliy fiskal va to‘lov jarayonlari bilan ishlash.
- Zaxira, tiklash, monitoring, test va yangilash tartibi mavjudligi.
- Kassirga qulay interfeys, import va o‘rgatish yo‘riqnomalari.
- Sotish usuli, tarif, mijozni ishga tushirish va yordam xizmati.

“To‘liq” tushunchasi tanlangan bozor doirasiga bog‘liq. Birinchi mahsulotni umumiy chakana savdo uchun tugatamiz. Restoran, dorixona, ishlab chiqarish va to‘liq buxgalteriyani alohida kengaytma sifatida rejalashtiramiz. Tegishli segment tanlansa, uning maxsus talablari chiqarish shartiga aylanadi.

## 2. Bozor yo‘nalishi va tekshirilishi kerak bo‘lgan talab

### Boshlang‘ich mijozlar

Tavsiya etilgan birinchi yo‘nalish: O‘zbekistondagi 1–10 ta savdo nuqtasi bo‘lgan kichik va o‘rta chakana bizneslar. Bu son bozor statistikasi emas, mahsulotni rejalash uchun boshlang‘ich faraz.

| Mijoz | Asosiy muammo | Shuni POS beradigan natija |
| --- | --- | --- |
| Mahalla do‘koni/minimarket | Navbat, qoldiq va nasiya daftarini yuritish | Tez savdo, aniq qoldiq, mijoz qarzi |
| Kiyim/poyabzal do‘koni | O‘lcham/rang kesimida hisob | Variantlar va har variant uchun qoldiq |
| Xo‘jalik/qurilish mollari | Dona, quti, metr, kg; ulgurji narx | Birlik almashtirish va narx darajalari |
| Bir nechta filialli biznes | Do‘konlar o‘rtasida nazorat yo‘qligi | Filial hisobi, transfer, umumiy analitika |
| Egasi do‘konda bo‘lmagan biznes | Kassadagi pul va xodim amallariga ishonchsizlik | Audit, smena farqi, masofadan ko‘rsatkichlar |

Raqobatchilar kataloglarida offline POS, ko‘p do‘konli hisob, mijoz va sodiqlik imkoniyatlari uchraydi. Bu Shuni POS uchun solishtirish nuqtasi, ammo mahalliy xaridor qaysi funksiyaga pul to‘lashini intervyu bilan tekshirish kerak. Manbalar: [Odoo POS funksiyalari](https://www.odoo.com/app/point-of-sale-features), [Loyverse funksiyalari](https://loyverse.com/features).

### MKT-01 — mijozlar bilan talabni tasdiqlash [P0]

- [ ] 10–15 ta biznes egasi va 5–10 ta kassir bilan suhbat o‘tkazish.
- [ ] Amaldagi kassada bir ish kunining asosiy amallarini kuzatish.
- [ ] Qaysi qurilmalar, internet, printer, tarozi va fiskal provayder ishlatilishini yozib olish.
- [ ] Hozirgi dasturdan ko‘chishdagi qiyinchiliklar va to‘lashga tayyor narxni tekshirish.
- [ ] Eng ko‘p talab qilingan besh muammo va mahsulotning ustunligini belgilash.
- [ ] Kamida uchta pilot biznes, ularning sinov doirasi va muvaffaqiyat mezonini kelishish.

**Natija:** taxminiy funksiyalar ro‘yxati o‘rniga kuzatilgan muammolar, qurilmalar ro‘yxati, pilotlar va ustuvor talablar hujjati.

### Ustuvorlik belgisi

| Belgi | Ma’nosi |
| --- | --- |
| P0 | Productionga yoki tegishli pilotga chiqishni to‘sadigan ish; chiqarishdan oldin tugatiladi |
| P1 | Birinchi to‘liq chakana mahsulot uchun kerak; tegishli foydalanish ssenariysida chiqarish sharti |
| P2 | Mijoz talabi bilan kengaytiriladigan imkoniyat; asosiy productionni to‘xtatmaydi |

Qonuniy yoki shartnomaviy talab bo‘lsa, P1/P2 vazifa o‘sha mijoz uchun P0ga ko‘tariladi. Pastroq ustuvorlik vazifani umuman kerak emas degani emas.

## 3. Avval mavjud poydevorni tuzatish [P0]

### FIX-01 — qo‘llanmada qayd etilgan xatolarni yopish

- [ ] TypeScript, Prisma konfiguratsiyasi, Zod va JWT turlari bo‘yicha xatolarni tuzatish.
- [ ] Savdo hisobotidagi yuklanmagan `items`ga murojaatni tuzatish.
- [ ] Transfer yaratishda bog‘langan mahsulot qatorlarini to‘g‘ri saqlash.
- [ ] Qoralamada faqat izoh/mijoz o‘zgarsa mahsulot qatorlari saqlanishini ta’minlash.
- [ ] Chegirma alohida o‘zgarsa summalarni qayta hisoblash; nol qiymatni to‘g‘ri qabul qilish.
- [ ] Ro‘yxatdan o‘tish javobini frontend ehtiyoji bilan moslashtirish; birlamchi yaratishni tranzaksiyaga olish.
- [ ] SKU va barkod noyobligini tashkilot doirasiga o‘tkazish; mavjud bazaga xavfsiz migratsiya tayyorlash.
- [ ] `ignoreBuildErrors`ni olib tashlash; paketlar mosligini va Prisma client yaratishni majburiy tekshirish.
- [ ] Docker build, standalone chiqishi va bazaga ulanish tartibini tuzatish.
- [ ] Maxfiy muhit fayllari image yoki build kontekstiga kirishini to‘xtatish.

**Qabul mezoni:** lint, TypeScript, build va asosiy integratsion testlar o‘tadi; qoralama tahririda ma’lumot yo‘qolmaydi; transfer oxirigacha ishlaydi; birinchi ro‘yxatdan o‘tishdan keyin qayta yuklamasdan smena ochish mumkin.

## 4. Xavfsizlik, foydalanuvchi va ruxsatlar

### SEC-01 — tashkilot va do‘kon chegaralari [P0]

- [ ] Tashkilotni faqat so‘rov tanasidan emas, haqiqiy sessiya va faol a’zolikdan aniqlash.
- [ ] Har bir ro‘yxat, tafsilot, o‘zgartirish, eksport, fayl va fon ishida tashkilot chegarasini tekshirish.
- [ ] Do‘kon, kassa, smena, mahsulot, mijoz va to‘lov bir tashkilotga tegishli ekanini tekshirish.
- [ ] Egasi/admin/kassir uchun amallar jadvalini yozish va serverda qo‘llash.
- [ ] Kassir boshqa kassir smenasida ruxsatsiz savdo qilmasligi; tannarx va foydani vakolatsiz ko‘rmasligi.
- [ ] Ruxsatlar bekor bo‘lganda eski sessiya ham bu amallarni bajara olmasligi.
- [ ] Admin panel va yordam xizmati kirishlarini ham shu nazoratga olish.

**Qabul mezoni:** A tashkilot foydalanuvchisi B tashkilotning IDsi ma’lum bo‘lsa ham hech bir API, eksport yoki fayl orqali uning ma’lumotini ololmaydi/o‘zgartirolmaydi. Bu avtomatik testlar bilan tekshiriladi.

### SEC-02 — sessiya va hisob himoyasi [P0]

- [ ] HTTPS; productionda kuchli kalit majburiy, standart kalit bilan ishga tushmaslik.
- [ ] Brauzer uchun xavfsiz sessiya yechimi: HttpOnly/Secure cookie, muddat, serverda bekor qilish; cookie ishlatilsa CSRF himoyasi.
- [ ] Chiqish, barcha qurilmalardan chiqish, parol almashtirish va parol tiklash.
- [ ] Telefon/e-mail tasdiqlash, bir martalik kod muddati va urinishlar chegarasi.
- [ ] Kirish, tiklash, import va qimmat so‘rovlarda tezlik/hajm cheklovlari.
- [ ] Owner, platforma admini va muhim amallar uchun ikki bosqichli tasdiq.
- [ ] API javobi va loglardan parol xeshi, token, maxfiy kalit va keraksiz shaxsiy maydonlarni chiqarish.
- [ ] XSS, fayl yuklash, zararli CSV va noto‘g‘ri parametrlar himoyasi.
- [ ] Sessiyalar va xavfsizlik hodisalari tarixi; shubhali kirish haqida bildirishnoma.

**Qabul mezoni:** bloklangan xodim yangi va eski sessiyadan ishlay olmaydi; parol tiklash kodi qayta ishlatilmaydi; hech bir javobda `passwordHash` yo‘q.

### USR-01 — xodimlar hayot sikli [P1]

- [ ] Taklif qilish, rol/do‘kon berish, tahrirlash, vaqtincha bloklash va arxivlash.
- [ ] Oxirgi egani o‘chirish/bloklashga yo‘l qo‘ymaslik; egalikni topshirish jarayoni.
- [ ] Bir foydalanuvchining bir nechta biznesi orasida vakolat bilan almashish.
- [ ] Tez kassir almashish uchun PIN; PIN yuqori vakolat o‘rnini bosmasligi.
- [ ] Qaytarish, narx o‘zgartirish, katta chegirma va inventar farqiga manager tasdig‘i.
- [ ] Kelgusida omborchi/buxgalter/kuzatuvchi roli va moslashtiriladigan vakolatlar.

## 5. Savdo, qaytarish va narxlar

### POS-01 — ishonchli savdo yakunlash [P0]

- [ ] Narx, tannarx, birlik, kassir va vakolatlarni serverda ishonchli manbadan olish.
- [ ] Bo‘sh savat, manfiy/yaroqsiz son, ortiqcha chegirma va noto‘g‘ri IDlarni rad etish.
- [ ] Savdo, to‘lov, ombor va auditni bitta nazorat qilinadigan amalda yakunlash.
- [ ] Takror so‘rov bir savdoni ikki marta yozmasligi uchun yagona amal kaliti qo‘shish — idempotency.
- [ ] Ochiq smena, qoldiq, limit va holatni tranzaksiya ichida tekshirish; parallel amallardan himoya.
- [ ] Chek raqamini yozuvlar soniga bog‘lamasdan noyob ajratish; fiskal raqamni alohida saqlash.
- [ ] Timeoutdan keyin “sotildimi?” holatini tekshirib, xavfsiz davom ettirish.
- [ ] Yakunlangan savdoni yashirin tahrirlash/o‘chirishni taqiqlash; tuzatishni qarshi hujjat bilan yuritish.

**Qabul mezoni:** tugma ikki marta bosilsa yoki so‘rov qayta yuborilsa bitta savdo/to‘lov/chiqim yoziladi. Oxirgi mahsulotni ikki kassa parallel sotganda siyosatga zid manfiy qoldiq yuz bermaydi.

### POS-02 — kassir uchun to‘liq ekran [P1]

- [ ] Qoralamani saqlash, vaqtincha chetga qo‘yish, qayta ochish va bekor qilish.
- [ ] Savatni brauzer yopilishi/yangilanishidan tiklash; qurilma va foydalanuvchi chegarasi.
- [ ] Aralash to‘lov: masalan, 60 000 naqd + 40 000 karta; qisman nasiya.
- [ ] Qaytimni haqiqiy naqd berilgan summa bilan ko‘rsatish, tushumga faqat tegishli summani yozish.
- [ ] Klaviatura tezkor tugmalari, USB skaner, tezkor mahsulotlar, qulay qidiruv.
- [ ] Har qator/butun chek chegirmasi; foiz/summa; sabab va tasdiq.
- [ ] Qoldiq va narx o‘zgarganini savat yakunida tushunarli ko‘rsatish.
- [ ] Mijoz tanlash, chek izohi, sotuvchi/xizmat turi kerak bo‘lsa belgilash.
- [ ] Chekni qayta chiqarish, elektron chek, 58/80 mm andozalari; qayta chiqarishni belgilash.

**Qabul mezoni:** yangi kassir o‘rgatilgandan keyin qidiruv → savat → aralash to‘lov → chek jarayonini yordamchisiz bajara oladi.

### RET-01 — qaytarish va pul qaytarish [P0]

- [ ] Original chek bo‘yicha to‘liq va qisman qaytarish.
- [ ] Oldingi qaytarishlarni hisobga olish; sotilganidan ko‘p qaytarishni taqiqlash.
- [ ] Chegirma va soliqni qaytarilayotgan qatorga to‘g‘ri taqsimlash.
- [ ] Tovar omborga qaytadimi, brak omborigami yoki hisobdan chiqadimi — aniq tanlash.
- [ ] Naqd/karta/nasiya aralash savdoda pul va qarzning qaytarish tartibini belgilash.
- [ ] Provayder orqali refund, uning kutish/xato holati va takror so‘rovdan himoya.
- [ ] Sabab, vakolat, tasdiqlovchi, qaytarma chek va audit.
- [ ] Tovar almashtirishni original qaytarish + yangi savdo sifatida bog‘lash.

**Qabul mezoni:** 5 dona sotuvdan 2 dona qaytsa faqat 2 dona qoldiq va ularga tegishli pul/qarz qaytadi; ayni qaytarish takror yozilmaydi.

### CAT-01 — savdoga tayyor katalog [P1]

- [ ] Kategoriya daraxti, brend, rasm, tavsif va faol/arxiv holati.
- [ ] Bir mahsulot uchun bir nechta barkod; barkod yaratish va etiketka chiqarish.
- [ ] Rang/o‘lcham kabi variantlar; har variantning alohida qoldig‘i va barkodi.
- [ ] Birlik konvertatsiyasi: 1 quti = 12 dona; asosiy birlikda qoldiq, hujjatda savdo birligi.
- [ ] Kasr bilan sotish, birlik aniqligi, tarozi barkodidan vazn/narx ajratish.
- [ ] Chakana/ulgurji/mijoz narxlari; filial narxi va sanadan kuchga kiradigan narx.
- [ ] Narx tarixi va ommaviy o‘zgartirish; tannarx uchun alohida ruxsat.
- [ ] Excel/CSV import, oldindan ko‘rish, dublikat/xato qatorlar hisoboti, eksport.
- [ ] Soliq turi, MXIK va markirovka xususiyatlari tegishli tovar uchun.

**Qabul mezoni:** importni qayta yuborish yashirin dublikat yaratmaydi; quti bilan kirim va dona bilan savdo qoldiqni bir xil birlikda o‘zgartiradi.

## 6. Ombor, xarid va yetkazib beruvchi

### INV-01 — qoldiq va harakatlarning yaxlitligi [P0]

- [ ] Har bir o‘zgarish uchun hujjat va ombor harakati; bevosita qoldiqni almashtirishni taqiqlash.
- [ ] Boshlang‘ich qoldiqni hujjat bilan kiritish; musbat/manfiy tuzatish, sabab va tasdiq.
- [ ] Tasdiqlangan hujjat o‘zgarmasligi; xatoni bekor qiluvchi yoki qarshi hujjat.
- [ ] Jo‘natishda yetarli qoldiq, yo‘ldagi mahsulot, qisman qabul, kamomad/brak hisobini yuritish.
- [ ] Transferni jo‘natishdan oldin bekor qilish; jo‘natilgandan keyingi qaytarish qoidasi.
- [ ] Qoldiq jurnaliga mosligini tekshiradigan avtomatik solishtirish va farq ogohlantirishi.
- [ ] Manfiy qoldiq siyosatini aniq belgilash; yoqilsa foyda/tannarx ta’sirini hisoblash.

**Qabul mezoni:** har do‘kon/mahsulot uchun boshlang‘ich qoldiq + harakatlar yig‘indisi joriy qoldiqqa teng. Takror tasdiqlash qoldiqni ikkinchi marta o‘zgartirmaydi.

### INV-02 — inventarizatsiya va ombor boshqaruvi [P1]

- [ ] To‘liq/qisman sanash; kutilgan qoldiqni yashirib sanash imkoniyati.
- [ ] Sanash davridagi savdolarni hisobga olish yoki vaqtinchalik bloklash siyosati.
- [ ] Farq hujjati, qayta sanash va tasdiqlovchi.
- [ ] Minimal/maksimal qoldiq, tugayotgan mahsulot va qayta buyurtma tavsiyasi.
- [ ] Ombor manzili/zonasi, brak va rezerv qoldiq kerak bo‘lsa alohida yuritish.
- [ ] Partiya, yaroqlilik muddati, FEFO tanlash va muddati yaqin ogohlantirish — oziq-ovqat segmentida P1.
- [ ] Seriya raqami/kafolat — elektronika segmentida P1.

### PUR-01 — xarid va ta’minot [P1]

- [ ] Yetkazib beruvchi kartasi, kontaktlar, rekvizitlar, shartlar va tarix.
- [ ] Buyurtma → qisman/to‘liq qabul → xarid hisoboti → to‘lov zanjiri.
- [ ] Yetkazib beruvchiga qaytarish, narx/miqdor farqi va qarzni yangilash.
- [ ] Yetkazib beruvchi qarzi, oldindan to‘lov va qisman to‘lash.
- [ ] Yetkazish/xarid xarajatlarini tannarxga taqsimlash siyosati.
- [ ] Xarid narxi tarixi, mahsulot/yetkazib beruvchi bo‘yicha tahlil.

Xarid, inventarizatsiya va filial ombori amallari shakllangan POS mahsulotlarida ham mavjud. Shuni POS uchun bu vazifalar mahsulot rejasining tavsiyasidir. Manba: [Loyverse advanced inventory](https://loyverse.com/en-us/advanced-inventory).

## 7. Mijozlar, nasiya, sodiqlik va marketing

### CRM-01 — to‘g‘ri qarz hisobi [P0]

- [ ] Nasiya uchun mijoz, vakolat va limitni serverda majburiy tekshirish.
- [ ] Qarz yozuvini haqiqiy pul to‘lovidan ajratish: nasiya naqd tushum deb olinmasligi.
- [ ] Qarzni naqd/karta/o‘tkazma bilan undirish; pulni haqiqiy smena yoki hisobga yozish.
- [ ] Qisman undirish, oldindan to‘lov, ortiqcha to‘lov va qaytarish qoidalari.
- [ ] To‘lovni qaysi qarz/savdoga ajratishni yuritish; boshlang‘ich qarzni alohida hujjat bilan kiritish.
- [ ] Qarzni o‘chirish/tuzatish faqat sabab, vakolat va audit bilan.
- [ ] Mijoz ko‘chirmasi: savdo, qaytarish, to‘lov, qarz qoldig‘i va muddat.

**Qabul mezoni:** 100 000 nasiya savdosidan keyin 30 000 naqd undirilib, qarz 70 000ga tushadi va kassaning naqd puli 30 000ga oshadi. Keyingi qaytarish ikkalasini buzmaydi.

### CRM-02 — mijoz bilan ishlash [P1/P2]

- [ ] P1: mijoz qidirish, dublikatlarni nazorat qilish, xarid tarixi, guruhlar va narx darajasi.
- [ ] P1: qarz muddati/kechikish hisoboti, mijozga ko‘chirma va rozilik asosida eslatma.
- [ ] P2: bonus ballari, chegirma kartasi, promo-kod va sovg‘a sertifikati.
- [ ] P2: bonusning qaytarishda bekor bo‘lishi, muddati va suiiste’moldan himoya.
- [ ] P2: marketing SMS/Telegram; xizmat xabari va reklama roziligini alohida boshqarish.

## 8. Pul, smena, soliq va hisobotlar

### FIN-01 — kassa va pul hisobi [P0]

- [ ] Har kassada bir ochiq smena qoidasi bazada ham himoyalangan bo‘lishi.
- [ ] Smenani ochish, yopish va topshirish; ochiq savdolar/integratsiya kutishlari uchun siyosat.
- [ ] Savdo, qarz undirish, refund, naqd kirim/chiqim va inkassatsiyani alohida hisoblash.
- [ ] Sanalgan pul, kutilgan pul, farq, sabab va rahbar tasdig‘i.
- [ ] Naqd savdoda berilgan pul/qaytimni tushum bilan chalkashtirmaslik.
- [ ] Karta/QR/o‘tkazma bo‘yicha provayder tushumi, komissiya va bank tushumini solishtirish.
- [ ] Yopilgan smenani yashirin tahrirlamaslik; tuzatish hujjati.

### FIN-02 — foyda va xarajatlar [P1]

- [ ] Tannarx usulini belgilash: dastlab vaznli o‘rtacha; FIFO/partiya ehtiyoji bo‘lsa kengaytirish.
- [ ] Har savdo qatorining tarixiy tannarxi, chegirmasi, solig‘i va yaxlitlanishini saqlash.
- [ ] Chek chegirmasini qatorlarga taqsimlash; qaytarishni shu qiymatlardan hisoblash.
- [ ] Biznes xarajatlari, toifalari va to‘lov hisoblari.
- [ ] Yalpi foyda va operatsion foydani aniq ajratish; to‘liq buxgalteriya hisobi bilan teng deb ko‘rsatmaslik.
- [ ] Naqd, bank va provayder hisoblari orasidagi pul o‘tkazmalarini ikki marta tushum deb hisoblamaslik.
- [ ] Soliq stavkasi, imtiyoz, narx ichida/tashqarisida soliq siyosatini sozlash; stavka tarixini saqlash.

### REP-01 — ishonchli hisobotlar [P0/P1]

- [ ] P0: tashkilot va do‘kon filtri hamma ko‘rsatkichga tatbiq etilishi.
- [ ] P0: vaqt zonasi, davr boshi/oxiri; oxirgi kun to‘liq kirishi.
- [ ] P0: yig‘indilar joriy sahifadan emas, barcha mos yozuvlardan olinishi.
- [ ] P0: sotuv, refund, nasiya va haqiqiy pul tushumi bir-biridan ajratilishi.
- [ ] P0: tannarx har qator `miqdor × tarixiy tannarx`dan hisoblanishi.
- [ ] P1: savdo, mahsulot, kategoriya, kassir, filial va to‘lov turi kesimidagi tahlil.
- [ ] P1: qoldiq qiymati, ombor harakati, kam qoldiq, yaroqlilik va sekin sotiladigan tovarlar.
- [ ] P1: smena, pul farqi, mijoz qarzi muddati, yetkazib beruvchi qarzi va xarid hisoboti.
- [ ] P1: to‘liq filtrlangan CSV/XLSX/PDF eksport; katta eksportni fon ishida bajarish.
- [ ] P1: jadvaldagi umumiy son, eksport va dashboard bir davr uchun mos kelishi.
- [ ] P2: rejalashtirilgan hisobot, filial taqqoslash, KPI va talab prognozi.

**Qabul mezoni:** oldindan natijasi hisoblangan savdo/nasiya/refund/xarid sinov ma’lumotlarida barcha ko‘rsatkichlar kutilgan natijaga teng. 50 dan ko‘p yozuvli hisobot to‘liq eksport qilinadi.

## 9. O‘zbekiston uchun fiskal va mahalliy integratsiyalar

### LOC-01 — fiskal ishlash doirasini aniqlash [P0, tegishli savdo uchun]

Mahalliy talabga mos fiskal chek va ro‘yxatdan o‘tgan kassa bilan ishlash masalasi chiqarishdan oldin hal qilinishi kerak. Brauzerdan oddiy chek chiqarishning o‘zi fiskallashtirishni ta’minlamaydi. [Adliya maslahat portalining kassa bo‘yicha tushuntirishi](https://advice.adliya.uz/oz/document/1341) bu ikki jarayonni farqlash uchun manba sifatida olindi.

- [ ] Mijoz faoliyati, soliq rejimi va savdo turiga tatbiq etiladigan amaldagi talablarni tekshirish.
- [ ] Shuni POS fiskal provayderga ulanadimi yoki mustaqil virtual kassa maqomini oladimi — qaror.
- [ ] Birinchi chiqarish uchun tegishli reestr/talablarga mos provayderni tanlash; shartnoma va test muhiti.
- [ ] Savdo, qaytarish, bekor qilish, aralash to‘lov va smena bo‘yicha provider oqimlarini xaritalash.
- [ ] Fiskal ID, raqam, vaqt, QR va holatni saqlash; qayta chiqarishda original fiskal ma’lumotni ishlatish.
- [ ] MXIK, birlik, soliq va zarur chek rekvizitlarini mahsulot/hujjatga qo‘shish va validatsiya qilish.
- [ ] Timeoutda provayder holatini tekshirish; takror fiskal chek yaratmaslik.
- [ ] Fiskal yuborish xatosini kassir va egaga ko‘rsatish; qo‘lda hal qilish/audit jarayoni.
- [ ] Fiskal va savdo summalarini kunlik solishtirish.

**Qabul mezoni:** tanlangan provayder talab qilgan test holatlari o‘tadi; bir savdo uchun bitta fiskal natija; qonuniy ish tartibi va nosozlik holati bo‘yicha yozma yo‘riqnoma bor. Aniq rekvizitlar va offline fiskallashtirish shartlari amalga oshirish paytida amaldagi normativ/provayder hujjatidan olinadi.

### LOC-02 — markirovka [P0, markirovkalanadigan tovarlar uchun]

Markirovkalangan mahsulotlar bilan ishlashda oddiy mahsulot barkodi va har bir birlikning Data Matrix kodi alohida tushunchalar. Tegishli savdo uchun qabul qilish va muomaladan chiqarish jarayonini moslashtirish kerak. Manba: [Asl Belgisi chakana savdo yo‘riqnomasi](https://help.crpt-turon.uz/hc/uz/articles/4459895684625-Ishni-boshlash-Chakana-savdo-uchun-markirovkalashni-amalga-oshirish-bosqichlari).

- [ ] 2D skaner va Data Matrix o‘qish; kodni mahsulot va birlik bilan bog‘lash.
- [ ] Takror, yaroqsiz yoki allaqachon sotilgan kodni nazorat qilish.
- [ ] Qabul qilish, savdo, qaytarish va hisobdan chiqarish uchun tegishli integratsiya.
- [ ] Markirovka kodini fiskal jarayon bilan bog‘lash va holatlar tarixini saqlash.
- [ ] Pilotdagi aniq mahsulot guruhlari bo‘yicha moslikni tasdiqlash.

### LOC-03 — to‘lov va hisob integratsiyalari [P1/P2]

- [ ] P1: tanlangan terminal/QR/to‘lov provayderi bilan pilot uchun integratsiya.
- [ ] Click/Payme yoki boshqa provayderlar — mijoz ehtiyoji, API va shartnoma imkoniyatiga qarab.
- [ ] Imzolangan callback, serverdan holat tekshirish, dublikatdan himoya va kunlik solishtirish.
- [ ] “Kutilmoqda”, “tasdiqlandi”, “bekor bo‘ldi”, “qaytarildi” holatlari; noma’lum to‘lovni muvaffaqiyatli deb olmaslik.
- [ ] Karta ma’lumotlarini POS bazasida saqlamaslik; to‘lovni provayder tomonida bajarish.
- [ ] P2: buxgalteriya/1C eksporti, EHF va bank bilan ulanish; tanlangan integratsiyaning ikki tomonlama mosligi.

## 10. Internet uzilishi, qurilmalar va mobil foydalanish

### OFF-01 — uzilishdan tiklanish [P0]

- [ ] Tarmoq holatini ko‘rsatish, savatni xavfsiz saqlash va muvaffaqiyatsiz so‘rovni nazoratli takrorlash.
- [ ] Savdo yozilgan, ammo javob kelmagan holatda serverdagi natijani topish.
- [ ] Printer ishlamasa savdoni ikkinchi marta yaratmasdan chekni qayta chiqarish.
- [ ] Qurilma ishdan chiqsa boshqa qurilmadan vakolatli davom ettirish.
- [ ] Integratsiya xatosi, savdo xatosi va faqat chek chop etish xatosini alohida ko‘rsatish.

### OFF-02 — to‘liq offline savdo [P1, talab etilgan mijoz uchun]

- [ ] PWA va lokal saqlash; mahsulot/narxlar uchun yangilanish chegarasi.
- [ ] Lokal savdo navbati, qurilma identifikatori va server bilan bir martalik sinxronlash.
- [ ] Offline qoldiqni bir nechta kassada mutlaq kafolatlab bo‘lmasligini siyosat bilan hal qilish: rezerv, limit yoki ruxsatli manfiy qoldiq.
- [ ] Eskirgan narx, nasiya limiti, bloklangan xodim va smena uchun alohida cheklov.
- [ ] Lokal ma’lumot xavfsizligi, chiqishda tozalash va sinxronlanmagan savdoni yo‘qotishdan himoya.
- [ ] Kartali to‘lov, markirovka va fiskal amallar offline rejimda faqat provayder/qoidalar ruxsat bergan tartibda.
- [ ] Navbat holati, xato savdolarni qo‘lda hal qilish, egaga ogohlantirish.

**Qabul mezoni:** kelishilgan offline limit ichidagi savdolar qayta ulanishda yo‘qolmasdan va dublikatlarsiz yoziladi; hal qilinmagan nizolar yashirin qolmaydi. To‘liq offline bitmaguncha mahsulot offline ishlaydi deb reklama qilinmaydi.

### HW-01 — qurilma mosligi [P1]

- [ ] USB/2D skaner, 58/80 mm printer, pul tortmasi va tanlangan elektron tarozi.
- [ ] Qurilmalar ro‘yxati, OS/brauzer, ulanish usuli va ishlaydigan modellar jadvali.
- [ ] Zarur bo‘lsa xavfsiz lokal printer/tarozi agenti; uni o‘rnatish va yangilash.
- [ ] Windows kassasi, planshet va mobil ekranlarda real sinov.
- [ ] Kassir ekrani uchun katta tugmalar; egaga telefon orqali dashboard.
- [ ] P2: mijoz displeyi, alohida mobil ilova va ombor terminali.

## 11. Interfeys, til va yordam

### UX-01 — mahsulotdan foydalanish sifati [P1]

- [ ] Birlamchi sozlash: tashkilot → filial/kassa → import → boshlang‘ich qoldiq → sinov savdo.
- [ ] O‘zbek lotin va rus tili; barcha ishchi matnlarni yagona tarjima tizimiga olish.
- [ ] Bir xil jadval/formalar, qidiruv, filtr, saralash, sahifalash va bo‘sh holatlar.
- [ ] Xatolarni odam tushunadigan qilib yozish; foydalanuvchi keyin nima qilishi ko‘rsatilishi.
- [ ] Loading, qayta urinish, saqlanmagan o‘zgarishlar va amaliy holatning aniq belgisi.
- [ ] Klaviatura bilan boshqarish, kontrast, label va fokus; kassa uchun katta o‘qiladigan matn.
- [ ] Rolga mos boshlang‘ich ekran va muhim ogohlantirishlar.
- [ ] Qisqa video/yo‘riqnoma, demo ma’lumotlar, yangi kassirni o‘rgatish.
- [ ] Import xatolari va printer/internet sozlash bo‘yicha yordam sahifalari.

**Qabul mezoni:** pilot egasi katalog import qilib, qoldiq kiritib, kassirni qo‘shib, birinchi savdoni yo‘riqnoma asosida bajara oladi.

## 12. Baza va backendga qo‘shiladigan tuzilmalar

Bu jadval tayyor sxema emas; funksiyalarni amalga oshirishda ma’lumot modelini loyihalash uchun ro‘yxat. Mavjud qaytarish/audit modellari qayta ishlatiladi, dublikat tuzilma yaratilmaydi.

| Tuzilma | Nima uchun kerak? |
| --- | --- |
| Sessiya, taklif, tiklash/tasdiq tokenlari | Hisob va kirishning to‘liq hayot sikli |
| Vakolat/tasdiq yozuvlari | Rol, do‘kon chegarasi va manager tasdig‘i |
| Mahsulot variantlari, barkodlar, birliklar | Rang/o‘lcham, bir nechta kod, quti/dona |
| Narx va soliq tarixi | Savdo paytidagi qiymatni ishonchli qayta hisoblash |
| Partiya, seriya, yaroqlilik, rezerv | Segmentga mos ombor hisobi |
| Xarid buyurtmasi/qabul/qaytarish | Yetkazib beruvchidan mahsulot olish zanjiri |
| Inventarizatsiya va tuzatish hujjatlari | Sanash farqini tasdiqlash va audit |
| Pul hisoblari va mijoz/ta’minotchi qarz jurnali | Haqiqiy pul va majburiyatlarni ajratish |
| To‘lov urinishlari va provider hodisalari | Callback, refund, komissiya va solishtirish |
| Fiskal hujjat, markirovka holati | Savdo va mahalliy tashqi tizim orasidagi bog‘lanish |
| Qurilma/offline amal/sinxronlash yozuvi | Offline savdo va qayta tiklash |
| Yagona amal kaliti va yuborish navbati | Dublikatdan himoya, tashqi xizmatga ishonchli yuborish |
| Tarif/obuna/limit/to‘lov yozuvlari | SaaS sifatida xizmatni sotish tanlansa |
| Bildirishnoma, rozilik va yetkazish tarixi | Xizmat xabarlari va marketing |

### DATA-01 — barcha modullar uchun qoidalar [P0]

- [ ] Moliyaviy hisobni aniq decimal bilan bajarish; pulni turli joyda turlicha yaxlitlamaslik.
- [ ] Foreign key, noyob indeks, son/holat cheklovi va kerakli qidiruv indekslari.
- [ ] Qoldiq/savdo/smena holatini atomik o‘zgartirish; deadlock/konfliktni nazoratli qayta urinish.
- [ ] Tashkilot kaliti va bog‘langan resurs egaligini butun modelda izchil qo‘llash.
- [ ] Audit yozuvini biznes o‘zgarishi bilan bir tranzaksiyada saqlash.
- [ ] Tashqi provayder chaqirig‘ini uzoq baza tranzaksiyasi ichida ushlamaslik; navbat va kompensatsiya jarayoni.
- [ ] Tashqi chaqiriq natijasi noma’lum bo‘lsa tekshirish va solishtirish; “ikki tizimda bitta tranzaksiya” deb faraz qilmaslik.
- [ ] Standart xato formati, so‘rov identifikatori, pagination/hajm cheklovi va API shartnomasi.
- [ ] Fayllar uchun vakolatli saqlash, yuklash cheklovi va o‘chirish siyosati.
- [ ] Migratsiya, ma’lumot ko‘chirish va mavjud hisobni tekshirish uchun skript/reja.

Hozirgi Next.js loyihasini saqlab, biznes hisob-kitoblarini sahifalardan ajratilgan xizmat qatlamiga yig‘ish tavsiya etiladi. Fon ishlariga alohida worker qo‘shiladi. Mikroservislarga bo‘lish faqat o‘lchangan ehtiyoj bo‘lsa; production uchun majburiy talab emas. Keyinchalik kod yozishda mahalliy Next.js yo‘riqnomalari o‘qilishi shart.

## 13. Server, monitoring va tiklash

### OPS-01 — xavfsiz chiqarish [P0]

- [ ] Development, staging va production alohida baza/kalit bilan.
- [ ] Builddan `db push`ni chiqarish; versiyalangan migratsiyani alohida chiqarish bosqichida bajarish.
- [ ] Yangi/avvalgi ilova bilan mos migratsiya, ma’lumot backfilli va qaytish rejasi.
- [ ] CI: lint → turlar → test → build → staging → qabul tekshiruvi → production.
- [ ] Image versiyasi, minimal vakolatli jarayon, xavfsiz secret saqlash va kalit aylantirish.
- [ ] TLS, domen, firewall; bazani umumiy internetga ochmaslik.
- [ ] Health/readiness endpoint, nazoratli restart, ulanish pooli va graceful shutdown.
- [ ] Yangilash vaqtida savdoni yo‘qotmaslik; texnik xizmat oynasi va xabar berish.

### OPS-02 — kuzatish va hodisalarni boshqarish [P0]

- [ ] Tuzilgan loglar, request ID, tashkilot ID; maxfiy/shaxsiy ma’lumotlarni niqoblash.
- [ ] API xatolari, sekin so‘rov, baza, disk, navbat, fiskal/to‘lov xatolari monitoringi.
- [ ] Savdo/to‘lov/qoldiq solishtirish farqi uchun biznes ogohlantirishlari.
- [ ] Navbatdagi ishlarni takrorlash va yechilmagan ishlar ro‘yxati.
- [ ] Xatoni mas’ul xodimga yuborish va eskalatsiya; kim javob berishi aniq bo‘lishi.
- [ ] Status sahifasi, hodisa jurnali va jiddiy hodisadan keyingi tahlil.

### OPS-03 — backup va tiklash [P0]

- [ ] Shifrlangan avtomatik backup; bazaning asosiy serveridan boshqa saqlash joyi.
- [ ] Baza bilan birga mahsulot rasmlari, hujjatlar va zarur konfiguratsiya zaxirasi.
- [ ] Nuqtaga tiklash imkoniyati, backup muddati va kirish vakolati.
- [ ] Alohida muhitga amaliy tiklash sinovi; faqat “backup olindi” xabari yetarli emas.
- [ ] Tashkilotga tegishli yozuvni tiklashda boshqa tashkilot ma’lumotiga ta’sirni tekshirish.
- [ ] Tiklashdan keyin provider, offline navbat va savdo holatlarini solishtirish.

Boshlang‘ich muhandislik maqsadlari: oylik mavjudlik **99,9%**, backupdagi ruxsat etilgan yo‘qotish oralig‘i (RPO) **15 daqiqagacha**, tiklanish vaqti (RTO) **2 soatgacha**. Bular hozirgi kafolat yoki bozor fakti emas; infratuzilma narxi va pilot sinovi bilan tasdiqlanadi. Yakunlangan savdo normal retry jarayonida yo‘qolmasligi alohida majburiy shart.

### OPS-04 — tezlik va hajm [P1]

- [ ] Pilotdan katalog, savdo hajmi, kassalar va parallel so‘rovlar profilini olish.
- [ ] Dastlabki test profili: bir tashkilotda 50 000 mahsulot, 1 million savdo qatori, 20 parallel faol kassa.
- [ ] Namuna yuklamada qidiruv p95 ≤ 500 ms, ichki savdo yakunlash p95 ≤ 2 s; provider vaqti alohida o‘lchanadi.
- [ ] N+1 so‘rovlarni kamaytirish, indekslar, cheklangan pagination va katta eksport uchun worker.
- [ ] Hisob/ruxsat ma’lumotini eskirgan keshdan olish xavfini boshqarish.
- [ ] Stress, uzoq davomli yuklama va tiklanish sinovlari.

Bu sonlar kelishish uchun taklif qilingan mezonlar. Test muhiti va o‘lchash shartlari yozilmaguncha tezlik kafolati sifatida ishlatilmaydi.

## 14. Test va qabul tekshiruvlari

### QA-01 — avtomatik tekshiruvlar [P0]

- [ ] Pul/chegirma/soliq/tannarx/nasiya formulalari uchun birlik testlari.
- [ ] Haqiqiy PostgreSQL bilan savdo, qoldiq, qaytarish va migratsiya integratsion testlari.
- [ ] Kassirning boshidan oxirigacha jarayonlari uchun brauzer testlari.
- [ ] Tashkilot/rol/do‘kon chegaralarining barcha API guruhlari bo‘yicha testlari.
- [ ] Parallel so‘rov va takror amal testlari.
- [ ] Provider sandbox, timeout, noto‘g‘ri imzo, takror/kechikkan callback testlari.
- [ ] Offline/reconnect, printer uzilishi, brauzer yopilishi va server restart sinovlari.
- [ ] Paket xavfsizligi, secret scanning va stagingda xavfsizlik tekshiruvi.
- [ ] Backup restore, migratsiya va chiqarishdan qaytish mashqi.

### Majburiy biznes ssenariylari

| Sinov | Kutilgan natija |
| --- | --- |
| A tashkilot B ma’lumotini so‘raydi | Ruxsat yo‘q; javobda ham ma’lumot chiqmaydi |
| Oxirgi dona ikki kassada sotiladi | Belgilangan qoldiq siyosati saqlanadi |
| Savdo tugmasi ikki marta bosiladi | Bitta savdo/to‘lov/chiqim |
| Savdo yozildi, javob uzildi | Natija topiladi, yangi savdo yaratilmaydi |
| Qoralamada faqat izoh o‘zgaradi | Mahsulot qatorlari va jami saqlanadi |
| Nasiya qisman naqd undiriladi | Qarz kamayadi, naqd kassa oshadi |
| Chegirmali savdo qisman qaytariladi | Original summaga mos refund va qoldiq |
| Transfer qisman qabul qilinadi | Qabul qilingan va yo‘ldagi qoldiq ajraladi |
| Sana chegarasi va 1 000 yozuv eksporti | Oxirgi kun to‘liq va barcha mos yozuvlar |
| Fiskal/to‘lov callbacki qayta keladi | Takror chek yoki tushum yo‘q |
| Xodim bloklanadi | Faol sessiyada ham amallar rad etiladi |
| Backupdan tiklanadi | Kelishilgan vaqtda mos hisob bilan ishlash tiklanadi |

## 15. Xizmatni sotish va mijozga yetkazish

### BIZ-01 — tijoriy model [P1, SaaS bo‘lsa]

- [ ] SaaS obuna, lokal o‘rnatish yoki ikkalasini qo‘llash modelini tanlash.
- [ ] Tarifni filial/kassa/xodim yoki funksiyalar bo‘yicha tushunarli belgilash.
- [ ] Sinov davri, obuna, hisob/invoice, to‘lov tarixi, yangilash va bekor qilish.
- [ ] Tarif limitlarini backendda tekshirish; mavjud ma’lumotni limitdan oshganda yo‘qotmaslik.
- [ ] Obuna tugaganda xabar, imtiyozli muddat, eksport va xavfsiz o‘qish rejimi siyosati.
- [ ] Fiskal provayder, SMS, printer agenti va integratsiya xarajatlarini alohida hisoblash.
- [ ] Marketing sahifasida haqiqatda ishlaydigan funksiyalar, narx, mos qurilmalar va yordam tartibi.

### BIZ-02 — platforma boshqaruvi va support [P1]

- [ ] Tashkilotlar, tarif, xizmat holati, integratsiyalar va hodisalar uchun platforma admin paneli.
- [ ] Support biznes ma’lumotiga faqat vaqtli, ruxsatli va auditli kira olishi.
- [ ] Kassir/egasi uchun murojaat, diagnostika, javob muddati va favqulodda aloqa.
- [ ] Mijozni o‘rnatish: import, boshlang‘ich qoldiq/qarz, qurilmalar, trening va ishga tushirish.
- [ ] Ishga tushirishdan oldingi hisobni imzolangan/kelishilgan solishtirish bilan tasdiqlash.
- [ ] Mavjud dasturdan ko‘chirishda ikki marta savdo yuritmaslik va o‘tish sanasini belgilash.
- [ ] Xizmatdan chiqishda to‘liq ma’lumot eksporti va saqlash/o‘chirish tartibi.

### LEG-01 — huquqiy va ma’lumot siyosati [P0/P1]

- [ ] Mijoz/xodim telefonlari, savdo va qarz tarixining maqsadi, kirishlari va saqlash muddatini belgilash.
- [ ] Amaldagi shaxsga doir ma’lumotlar, saqlash joyi va reestr talablarini tegishli ma’lumot toifasi uchun tekshirish; hostingni shu tekshiruvdan keyin tanlash.
- [ ] Maxfiylik siyosati, foydalanish shartlari, xizmat shartnomasi va javobgarlik chegarasi.
- [ ] Qonun talab qiladigan moliyaviy yozuvlarni saqlash bilan shaxsiy ma’lumotni o‘chirish talabini moslashtirish.
- [ ] Elektron chek, xizmat eslatmasi va reklama roziligini alohida qayd etish.
- [ ] Integratsiya, xosting va aloqa provayderlariga uzatiladigan ma’lumotlarni hujjatlashtirish.

Bu bo‘limda ma’lumot lokalizatsiyasining barcha holatlar uchun bitta umumiy talabi taxmin qilinmaydi. Aniq huquqiy doira chiqarishdan oldin amaldagi rasmiy hujjatlar bilan tekshiriladigan vazifa sifatida qo‘yilgan.

## 16. Keyingi segmentlar uchun kengaytmalar [P2]

| Yo‘nalish | Qo‘shilishi kerak bo‘lgan ishlar |
| --- | --- |
| Restoran/kafe | Stol, zal, buyurtma, oshxona displeyi, retseptura, ingredient qoldig‘i, xizmat haqi va bo‘lib to‘lash |
| Dorixona | Partiya/yaroqlilik, tegishli markirovka, maxsus katalog va ruxsat talablari, guruhga mos qoidalar |
| Elektronika | Seriya raqami, kafolat, servis va bo‘lib to‘lash shartlari |
| Ulgurji savdo | Tijoriy taklif, buyurtma, rezerv, yetkazish hujjati va korporativ narx |
| Onlayn savdo | Internet-do‘kon/marketplace, buyurtma, rezerv, yetkazish va bir xil qoldiq |
| Ishlab chiqarish | Retsept/BOM, xomashyo, ishlab chiqarish hujjati, chiqit va tayyor mahsulot tannarxi |
| Katta tarmoq | Markaziy xarid, murakkab ombor, filial KPI, API integratsiya va kengaytirilgan vakolat |
| Analitika | Talab prognozi, qayta buyurtma, anomaliya va tavsiya; ma’lumot sifati yaxshilangandan keyin |

Bu yo‘nalishlarning hammasini birinchi chiqarishga majburiy qo‘shish ish hajmini cheksiz kengaytiradi. Har biri mijoz segmenti va mustaqil qabul mezoni bilan alohida release bo‘ladi.

## 17. Amalga oshirish bosqichlari va bog‘liqliklar

| Bosqich | Vazifalar | Tugaganini qanday bilamiz? |
| --- | --- | --- |
| 0. Bozor va chegaralar | MKT-01, fiskal yo‘l, qurilmalar, tarif modeli, boshlang‘ich yuklama | Pilotlar va yozma talablar; chiqarish doirasi aniq |
| 1. Ishonchli poydevor | FIX-01, SEC-01/02, DATA-01, OPSning boshlang‘ich qismi | Xavfsizlik/tur/build xatolari yopilgan, ma’lumot chegaralari testdan o‘tgan |
| 2. Asosiy biznes hisobi | POS-01, RET-01, INV-01, CRM-01, FIN-01, REP-01 P0 | Savdo → qaytarish → qoldiq → pul → hisobot sonlari mos |
| 3. Bozorga tayyor modullar | POS-02, CAT-01, INV-02, PUR-01, UX-01, LOC/HW | Pilot talabidagi funksiyalar va real qurilmalar ishlaydi |
| 4. Uzilish va ekspluatatsiya | OFF, to‘liq OPS, QA, LEG, support/onboarding | Yuklama, restore, uzilish va provider sinovlari o‘tgan |
| 5. Cheklangan pilot | Real mijozlar, kunlik solishtirish, feedback va tuzatish | Kelishilgan pilot mezonlari bajarilgan |
| 6. Ommaviy production | Tijoriy paket, yordam, monitoring, chiqarish tartibi | Quyidagi yakuniy checklist to‘liq |
| 7. Kengaytirish | CRM P2, maxsus segment, qo‘shimcha provider/API | Mijoz talabi va alohida qabul sinovi bilan chiqariladi |

Asosiy bog‘liqliklar:

- Ruxsat va ma’lumot yaxlitligi → savdo/ombor → qaytarish/qarz → ishonchli hisobot.
- Katalog va soliq modeli → fiskal/markirovka integratsiyasi.
- Yagona amal kaliti va qayta tiklash → provider integratsiyasi → to‘liq offline.
- Versiyalangan migratsiya va backup → pilot bazasini xavfsiz yangilash.
- Mijoz jarayonlari tasdiqlanishi → segment funksiyalari → tijoriy paket.

Aniq muddat jamoa, provayderga kirish va pilot talablaridan keyin belgilanadi. Har bosqichni vaqt tugagani uchun emas, qabul mezoni bajarilgani uchun yopish kerak.

## 18. Pilot va productionga chiqish shartlari

### Pilot tavsiyasi

- [ ] Kamida uchta biznesda kelishilgan savdo hajmi va qurilmalar bilan sinash.
- [ ] Kamida ikki hafta odatiy savdo; oy/davr yopilishi ssenariysini ham alohida tekshirish.
- [ ] Har kuni savdo, pul, qarz, qoldiq va fiskal/to‘lov natijalarini solishtirish.
- [ ] Qaytarish, nasiya undirish, transfer, internet/printer uzilishi real yoki boshqariladigan sinovda bajarilishi.
- [ ] Kassir va egasi fikri, yordam murojaatlari va sarflangan vaqtni qayd qilish.
- [ ] Ma’lumot yo‘qolishi, ruxsatsiz kirish va hal qilinmagan pul farqi bo‘lmasligi.

### Yakuniy chiqarish checklisti

- [ ] Chiqarish doirasidagi barcha P0 va zarur P1 vazifalar yopilgan.
- [ ] Muhim hisob/ruxsat ssenariylari avtomatik va amaliy sinovdan o‘tgan.
- [ ] Qaytarish, nasiya, xarid va smena hisoblari bir-biriga mos.
- [ ] Fiscal/markirovka talabi tegishli mijozlar uchun bajarilgan.
- [ ] Tanlangan qurilmalar sinovdan o‘tgan va moslik ro‘yxati e’lon qilingan.
- [ ] Real backup tiklash, migratsiya va qaytish mashqi muvaffaqiyatli.
- [ ] Kuzatish, ogohlantirish va javobgar yordam xodimi mavjud.
- [ ] Yuklama natijalari va xizmat ko‘rsatish maqsadlari hujjatlashtirilgan.
- [ ] Import, boshlang‘ich hisob, trening va onboarding qo‘llanmasi tayyor.
- [ ] Xizmat shartlari, maxfiylik, tarif va eksport/o‘chirish siyosati tayyor.
- [ ] Pilotta ochiq kritik yoki yuqori darajadagi xatolar qolmagan.
- [ ] Bozorga va’da qilinadigan har funksiya haqiqatan shu release’da ishlaydi.

## 19. Har bir vazifani qanday yuritamiz?

Yuqoridagi har bir ID alohida task/issuega ajratiladi. Unda quyidagilar yoziladi:

1. Muammo va foydalanuvchi uchun natija.
2. P0/P1/P2, qaysi segment/release uchun majburiyligi.
3. Ekran, API, ma’lumot modeli va hisobga ta’siri.
4. Bog‘liq vazifalar va tashqi provayder talablari.
5. Normal, xato, parallel va qayta urinish holatlari.
6. Qabul mezoni, test, migratsiya va chiqarishdan qaytish tartibi.
7. Mas’ul, baholangan ish hajmi, holat va bajarilganini tasdiqlovchi dalil.

Tavsiya etilgan holatlar: **rejalashtirilgan → tayyor → bajarilmoqda → tekshiruvda → pilotda → tugallangan**. Kod yozilgani vazifa tugallanganini bildirmaydi; qabul mezoni, hisob mosligi va ishlatish yo‘riqnomasi ham bajarilishi kerak.

## 20. Manbalar va xulosalarning chegarasi

Loyiha holati [PROJECT.md](./PROJECT.md)dan olindi; yangi to‘liq kod auditi bajarilmadi. Bozor yo‘nalishi, ustuvorliklar, pilot sonlari va texnik maqsadlar ushbu loyiha uchun tavsiyalardir, tadqiqot bilan tasdiqlangan bozor statistikasi emas.

Tashqi manbalar 2026-yil 5-oktabrda ko‘rib chiqildi:

- [Odoo POS funksiyalari](https://www.odoo.com/app/point-of-sale-features) — POS imkoniyatlari uchun solishtirish nuqtasi.
- [Loyverse funksiyalari](https://loyverse.com/features) — chakana POS modullari uchun solishtirish nuqtasi.
- [Loyverse xodim boshqaruvi](https://loyverse.com/en-us/employee-management) — xodim/do‘kon ruxsatlari haqida mahsulot manbasi.
- [Loyverse advanced inventory](https://loyverse.com/en-us/advanced-inventory) — ombor va xarid imkoniyatlari haqida mahsulot manbasi.
- [Kassa texnikasidan foydalanish bo‘yicha Adliya maslahat portali](https://advice.adliya.uz/oz/document/1341) — mahalliy fiskal ish doirasini aniqlash uchun tushuntirish.
- [Asl Belgisi chakana savdo yo‘riqnomasi](https://help.crpt-turon.uz/hc/uz/articles/4459895684625-Ishni-boshlash-Chakana-savdo-uchun-markirovkalashni-amalga-oshirish-bosqichlari) — tegishli tovarlar uchun markirovka jarayoni.

Provayder APIlari, mahsulot guruhlariga tatbiq etiladigan talablar va huquqiy shartlar amalga oshirish/chiqarish vaqtida qayta tekshiriladi. Bu reja productionga yetishish ishlarini belgilaydi; barcha integratsiyalar mavjud yoki kelishilgan deb hisoblamaydi.
