# Barcha sahifalar va qo‘lda test qilish qo‘llanmasi

Dastlabki inventar: 2026-10-16; tuzatishlarga mos yangilanish: 2026-10-17. Asosiy commit: `a456a5185fdaea6ba34082b5b3dac6c02f6c5f51`.

**69 ta Next.js sahifasi**, qo‘shimcha **2 ta PWA HTML sahifasi**, **1 ta alohida status xizmati** topildi. Sahifa ichidagi modal, tab va panellar tegishli sahifa ostida keltirilgan. API endpointlari alohida sahifa sifatida sanalmagan. Bu hujjat koddagi ekranlar va ularni tekshirish rejasi; barcha ekranlar shu safar brauzerda sinovdan o‘tkazildi degani emas. 2026-10-17 kuni topilgan nuqsonlar tuzatildi; tekshiruv chegarasi va dalillar `tasks/CODE_REVIEW_20261017.md`da.

Asosiy manzil: **http://localhost:3000**. Quyidagi `/products` kabi manzilni shu manzil oxiriga qo‘shing. `(dashboard)` va `(auth)` URLga yozilmaydi. `[id]` o‘rniga tegishli ro‘yxatdan ochilgan haqiqiy mahsulot/mijoz/savdo/murojaat IDsi keladi; `[id]`ni aynan yozib ochmang.

## Sinovga tayyorgarlik

1. Alohida **test tashkiloti** yarating. Quyidagi savdo, kirim, qarz va smena testlari haqiqiy jurnal yozuvlarini yaratadi; kundalik biznes hisobida mashq qilmang. Faqat `/training` iqtisodiy yozuvsiz mashqdir.
2. Uch rol tayyorlang: **E — egasi**, **A — administrator**, **K — kassir**. Admin/kassirga kerakli filialni biriktiring. Alohida brauzer profillari orqali tekshirish qulay. Maxsus rol qo‘shimcha cheklov qo‘yadi.
3. **P — platforma administratori**, **S — support operatori** oddiy egasi/admin roli bilan bir xil emas. Ular alohida tayinlangan bo‘lishi kerak. Mavjud bo‘lmasa tegishli sinovni `BLOCKED` deb qayd eting; hisobga o‘zingizdan vakolat bermang.
4. Dastlab E bilan sozlamalar, katalog, kirim va mijozlarni tayyorlang; keyin K bilan smena va savdoni tekshiring. Kamida bitta qo‘shimcha filial va yana bir test tashkiloti chegaralarni tekshirish uchun kerak.
5. Ko‘rinayotgan tashkilot/filial/kassa va o‘z smenangizni tekshiring. Bir nechta ruxsatli filial yoki kassa bo‘lsa headerdagi almashtirgichni tekshiring; savat va pending operatsiyalar bo‘yicha cheklovlar quyida.
6. Fon ishlari, ko‘chirma tayyorlash va rejalashtirilgan hisobotlar uchun **jobs worker ishlashi shart**. Worker ishlamasa navbatga tushish bilan ish bajarilishi bir xil natija emas.
7. SMS/e-mail, real Click, fiskalizatsiya, E-POS va maxsus hardware adapterlari hali ulanmagan. Ulardan haqiqiy yetkazish, bank o‘tkazish yoki fizik chek kutmang. Karta/bankning mavjud qo‘lda qayd oqimi tashqi to‘lovni bajarmaydi.

**Natijani belgilash:** `PASS` — kutilgan natija bajarildi; `FAIL` — tayyor sharoitda noto‘g‘ri ishladi; `BLOCKED` — talab qilinadigan rol, worker, uskuna, provider yoki ma’lumot yo‘q. Oddiy bo‘sh ro‘yxat xato emas. Xato paytida sahifa, rol, vaqt, qadamlar, kutilgan/haqiqiy natija va so‘rov raqamini yozing; parol, cookie, token yoki mijozning shaxsiy ma’lumotini qo‘shmang.

## Barcha sahifalarga tegishli tekshiruvlar

- [ ] Sahifa ochiladi; yuklanish belgisi cheksiz qolmaydi. Xato va haqiqiy «ma’lumot yo‘q» holati farqlanadi; qayta yuklash ishlaydi.
- [ ] UZ/RU almashtirish, telefon va desktop ko‘rinishi, uzun nomlar va jadvalning gorizontal aylanishi ishlaydi. Mahsulot/mijoz kiritgan nomlar tarjima qilinmaydi.
- [ ] Qidiruv, mavjud filtrlar, saralash va sahifalash to‘g‘ri; Back/Forward va sahifani yangilash filtrni saqlaydi. Mavjud bo‘lmagan sahifadan birinchi sahifaga qaytish mumkin.
- [ ] Noto‘g‘ri `page=0`, noma’lum saralash yoki yaroqsiz sana xabar bilan rad etiladi. Ro‘yxat yuklanmagan paytda eskirgan ma’lumot bilan yangi amal tasdiqlanmaydi.
- [ ] Majburiy maydon, son/miqdor, manfiy qiymat, birlik aniqligi, ortiqcha summa va dublikatlar tekshiriladi. Tegishli joyda xato aynan qaysi amalni to‘xtatgani tushunarli.
- [ ] Ikki marta tez bosish bitta iqtisodiy natija beradi. Javob kechiksa tugma band holatida; natija noaniq bo‘lsa asl amalni tekshirish taklif qilinadi.
- [ ] Saqlanmagan forma bilan chiqishda ogohlantirish mavjud joylarda ishlaydi. Server xatosidan keyin kiritilgan qiymatlar yo‘qolmaydi. Lokal pending navbatni tozalab yubormang.
- [ ] E/A/K va maxsus rol bilan qayta tekshiring. Menyu yashirilishi yetarli emas: taqiqlangan URL yoki boshqa tashkilotning IDsi orqali ma’lumot ochilmasligi kerak. Rol/filial/sessiya bekor qilinsa eski ochiq oynadagi keyingi amal ham rad etilsin.
- [ ] CSV/XLSX/PDF bor sahifalarda fayl aynan tanlangan filtr/snapshotni aks ettiradi; jadvalning faqat joriy sahifasi bilan adashtirmang. Pul va miqdor aniqligi yo‘qolmasin.
- [ ] Yopilgan savdo/smena/kirimning tarixiy summasi keyingi tahrirdan o‘zgarmaydi; tuzatish alohida hujjat va audit orqali yuradi.

## 1. Ochiq sahifalar va hisobga kirish — 8 sahifa

### 01. `/` — bosh sahifa

**Kim:** hamma. **Vazifa:** mahsulot imkoniyatlari, tariflar va kirish nuqtalarini ko‘rsatish.

- [ ] Shuni POS nomi, «Imkoniyatlar», «Tariflar», «Moslik», «Kirish», ro‘yxatdan o‘tish/sinovni boshlash, «POSni ochish» havolalari bor.
- [ ] Savdo/mijoz hisobi, ombor/xarid, smena/hisobot kartalari; qurilmalar va ulanmagan integratsiyalar haqidagi aniq izohlar bor.
- [ ] Tarif nomi, UZS/oy narxi, filial/kassa/xodim limitlari bazadan ko‘rinadi. Dastlabki tasdiqlangan qiymatlar Start 99 000/1/1/3, Business 249 000/3/5/15, Pro 499 000/10/20/50; administrator o‘zgartirgan bo‘lsa joriy qiymat asos bo‘ladi.
- [ ] Yangi tashkilotning Pro triali 14 kun, grace 7 kun ekani joriy tarifdan ko‘rsatiladi. Tarif yuklanmasa uydirma narx o‘rniga mavjud emas xabari chiqadi.
- [ ] Login qilmagan odam POS/onboarding/helpga o‘tsa tegishli kirish talabi ishlaydi. Sahifadagi imkoniyat yozuvi real integratsiya bor degan noto‘g‘ri taassurot bermasin.

### 02. `/login` — tizimga kirish

**Kim:** hisob egasi. **Maydonlar:** telefon, parol. **Havolalar:** parolni unutish, ro‘yxatdan o‘tish.

- [ ] To‘g‘ri hisob bilan kirish va rolga mos davom etish; noto‘g‘ri parol/telefon, bloklangan yoki faol a’zoligi yo‘q hisob rad etilishi.
- [ ] Jo‘natishda band holat, takror bosishdan himoya; xatoda telefon va parol drafti saqlanishi.
- [ ] Sahifani qayta ochganda faol sessiya tanilishi. Chiqishdan keyin himoyalangan sahifa qayta kirishni talab qilishi.
- [ ] Parol yoki haqiqiy sessiya tokeni URLga/javobdagi ochiq token maydoniga chiqarilmasligi.

### 03. `/register` — biznesni ro‘yxatdan o‘tkazish

**Kim:** yangi biznes egasi. **Maydonlar:** ism-familiya, telefon, biznes nomi, ixtiyoriy STIR/INN va e-mail, 8–72 belgili parol; UTF-8 da 72 bayt chegarasi ham bor.

- [ ] Yangi noyob hisob 200 bilan yaratiladi: tashkilot, owner, asosiy do‘kon, `REG001` kassa, chegirma siyosati, sessiya va bir martalik trial birga yaratilishi.
- [ ] STIR/e-mailni bo‘sh qoldirib bir nechta alohida test biznes yaratish mumkin. Chetki bo‘sh joylar olinadi; bo‘sh qiymat noyob oddiy string sifatida saqlanmaydi.
- [ ] Band STIR uchun `TIN_EXISTS`, e-mail uchun `EMAIL_EXISTS`, telefon uchun `USER_EXISTS` tushunarli chiqadi. Bu holat umumiy 500 bo‘lmasin; mavjud tashkilot rekvizitlari ko‘rsatilmasin.
- [ ] Dublikat yoki server xatosida yarim tashkilot/foydalanuvchi qolmasligi; forma saqlanishi; qiymat tuzatilgach qayta yuborish mumkinligi.

### 04. `/forgot-password` — parol tiklashni so‘rash

**Maydonlar:** kanal, telefon/e-mail. **Amallar:** tiklashni so‘rash, token kiritish sahifasi, login.

- [ ] Kanal/identifier validatsiyasi, band holat, qayta yuborishni cheklash va xatoda formani saqlash.
- [ ] Hozir real SMS/e-mail provider yo‘q: xizmat mavjud emas javobi xavfsiz chiqishi kutiladi. «Akkaunt tasdiqlandi» yoki «yetkazildi» deb soxta muvaffaqiyat bo‘lmasin.
- [ ] Yetkazish providerini talab qiladigan haqiqiy token olish sinovi `BLOCKED`. Sozlangan kelajakdagi oqimda mavjud/noma’lum hisob javobi orqali hisobni oshkor qilmaslik tekshiriladi.

### 05. `/reset-password` — yangi parol o‘rnatish

**Maydonlar:** tiklash tokeni, yangi parol, uni takrorlash. **Amal:** parolni yangilash.

- [ ] Mos kelmaydigan parollar, yaroqsiz/eskirgan/ishlatilgan token bilan o‘zgartirish bajarilmasin.
- [ ] Vakolatli test muhitida haqiqiy yetkazilgan token bo‘lsa bir marta ishlashi; keyin eski parol, sessiyalar va PIN bilan kirish ishlamasligi.
- [ ] Provider yo‘q sharoitda haqiqiy muvaffaqiyatli tiklashni taxmin qilmang. Tokenni URL query yoki umumiy chatga yozmang; sahifa xatoda maxfiy diagnostika chiqarmasin.

### 06. `/invite#…` — xodim taklifini qabul qilish

**Kirish yo‘li:** egasi yaratgan bir martalik havola. Token fragmentda bo‘ladi. Yangi hisob uchun ism/parol; mavjud hisob uchun avval login qilish kerak.

- [ ] To‘g‘ri taklif aynan tanlangan tashkilot, rol va filiallar uchun a’zolik yaratadi; yangi owner vakolati o‘zboshimcha olinmaydi.
- [ ] Muddati o‘tgan, bekor qilingan, allaqachon ishlatilgan yoki boshqa tegishli shartga mos kelmagan taklif rad etiladi.
- [ ] Qabuldan keyin token/parol forma va manzildan tozalanadi; muvaffaqiyat xabari va login/biznesni almashtirish yo‘li bor.
- [ ] Taklif havolasi 72 soatlik; uni oddiy `/invite` bilan yoki tokenni qo‘lda yasab test qilish muvaffaqiyatli holat hisoblanmaydi.

### 07. `/r#…` — mijozga elektron chek nusxasi

**Kim:** amaldagi maxsus havolaga ega mijoz; login shart emas. **Yaratish:** original chek oynasidagi «Elektron chek» paneli.

- [ ] Tashkilot/filial, original chek raqami/sanasi, qatorlar, miqdor/birlik/narx/chegirma/jami, soliq qismi va to‘lovlar bor. «Nusxa» va «fiskal emas» belgisi bor.
- [ ]58/80 mm eni va chop etish/PDF ko‘rinishi ishlaydi. Boshqa mijozlar, tannarx va admin boshqaruvlari yo‘q.
- [ ] Alohida shu chek uchun mijoz roziligi berilgandan keyingina havola yaratiladi. Bir soatlik muddat, bekor qilish va buzilgan fragmentda mavjud emas xabari tekshiriladi.
- [ ] Oddiy `/r`ni havolasiz ochish muvaffaqiyatli chek ko‘rsatmasligi kerak.

### 08. `/d#…` — shaxsan beriladigan qarz ko‘chirmasi

**Kim:** amaldagi ko‘chirma havolasiga ega mijoz. **Yaratish:** mijoz kartasi → shaxsan xizmat eslatmasi → worker tayyorlagan QR/havola.

- [ ] Tashkilot/mijoz nomi, hisob holati va vaqt zonasi, jami/kechikkan/muddati kelmagan/muddatsiz/taqsimlanmagan qarz, sana-hujjat-summa-qoldiq-muddat jadvali bor.
- [ ] Chop etish/PDF ishlaydi. Bu snapshot: undan joriy live balans deb foydalanmang.
- [ ] Rozilik bekor qilinsa, mijoz kartasi o‘zgarsa yoki havola eskirsa eski ko‘chirma ochilmasligi. Taqsimot muammosi bor bo‘lsa ogohlantirish ko‘rinishi.
- [ ] Bu SMS/e-mail yetkazish emas; navbatda tayyor bo‘lish mijozga yetkazildi degani emas.

## 2. Kassa, savdo va smena — 8 sahifa

### 09. `/dashboard` — kunlik boshqaruv paneli

**Kim:** E/A; K kassaga yo‘naltiriladi.

- [ ] Sana bo‘yicha sof tovar tushumi, cheklar soni, o‘rtacha chek, kam qoldiq, naqd/karta taqsimoti va eng ko‘p sotilgan 5 mahsulot ko‘rinadi.
- [ ] Hisobning holat sanasi, yangilash va shu holatdagi CSV/jadval amallari bor; tegishli POS, katalog, ombor, smena havolalari ochiladi.
- [ ] Nazorat savdosi/qaytarmasidan keyin yangilash ko‘rsatkichni to‘g‘ri o‘zgartiradi. Naqd pul, tovar tushumi va nasiya aralashtirilmaydi; adminning filial chegarasi saqlanadi.

### 10. `/pos` — asosiy savdo kassasi

**Kim:** E/A/K, ruxsatli filial/kassa va o‘z faol smenasi bilan.

- [ ] Aloqa holati va qayta tekshirish; smena ochish; mahsulot nomi/SKU/barkod qidiruvi, kategoriya, tezkor mahsulotlar; savat va mijoz tanlash bor.
- [ ] Savat qatori: mahsulot, miqdor, birlik/konvertatsiya, narx, qator chegirmasi, chiqarish; chek bo‘yicha chegirma/sabab, subtotal va jami; izoh/xizmat turi mavjud.
- [ ] Qoralamani serverda saqlash, server qoralamalarini ochish, offline ruxsatga o‘tish, lokal saqlanish holati va noaniq natijani tekshirish ishlaydi.
- [ ] F 2 qidiruv, F 4 qidiruv filtrlarini tozalash, F 9 to‘lov oynasi, Esc yopish; tugma o‘zi avtomatik to‘lov yubormaydi. Oddiy klaviatura barkodi savatga tegishli SKU qo‘shadi.
- [ ] To‘lov oynasi: naqd, qo‘lda karta, o‘tkazma, nasiya va aralash to‘lov; haqiqiy berilgan naqd, qaytim, mijoz/nasiya muddati, ixtiyoriy bank hujjati, serial tanlash va server soliq/jami preview.
- [ ] Bo‘sh savat, yetarli bo‘lmagan pul/qoldiq, manfiy miqdor, mijozsiz nasiya, limitdan oshgan chegirma rad etilsin. Boshqa kassir smenasida ruxsatsiz savdo bo‘lmasin.
- [ ] Narx/qoldiq o‘zgarsa eski-yangi qiymat va tiklash yo‘li ko‘rinsin. Reload savatni shu hisob/qurilmada tiklasin; boshqa hisobga oshkor qilmasin.
- [ ] Muvaffaqiyatli yakunda bir savdo/to‘lov/stock harakati; original chek va yangi savdo amali. Bank/Click haqiqatan yuborildi yoki printer chop etdi degan soxta natija bo‘lmasin.

### 11. `/pos/offline` — oldindan ruxsatlangan offline naqd savdo

**Kim:** o‘z qoralamasi uchun E/A/K; siyosat va noaniq real natijani yakuniy hal qilish egasi vakolatida.

- [ ] Joriy siyosat, summa/muddat limiti, o‘z server qoralamasini tanlash, lokal unlock iborasi, preview va aynan shu savatga ruxsat olish bor.
- [ ] Egasi uchun yoqish/o‘chirish, filialning jami hal qilinmagan summasi, 30–300 soniyalik muddat va sabab; ruxsatlar tarixi bor.
- [ ] Yetarli available stock rezervlanadi. Muddatsiz/ruxsatsiz yangi offline savdo, boshqa savat, karta/nasiya, miqdor tahriri rad etiladi.
- [ ] Uzilishda shifrlangan savatni ochish, faqat bir naqd qabul va internet qaytgach original natijani sinxronlash tekshiriladi. Muddati tugagan yoki qurilma vaqti orqaga ketgan ruxsat bilan pul olinmasin.
- [ ] Egasi dalil bilan tovar/pul qaytganini bekor qilishi yoki asl savdoni qayd etishi; eski narx/soliq/tannarx va asl kassir/kassa saqlanishi. Bu ikki yo‘lni bir savdoga birga qo‘llab bo‘lmasin.

### 12. `/drafts` — server qoralamalari

**Kim:** E/A/K, ko‘rinish doirasi rolga mos.

- [ ] Chek/mijoz qidiruvi, vaqt/summa saralashi, summa/sana/qatorlar, yangilash va sahifalash mavjud.
- [ ] O‘z qoralamasini ayni kassa/faol smenada `/pos?draft=…` orqali davom ettirish; qoralama raqami va qatorlari saqlanishi.
- [ ] Rahbar qoralamani bekor qilishi mumkin; kassir rahbarning bekor qilish vakolatini olmasin. Boshqa qurilmadagi faqat lokal, serverga yetmagan savat bu ro‘yxatda bo‘lishi shart emas.

### 13. `/sales` — savdolar jurnali

**Kim:** E/A/K; kassir o‘z ruxsatli savdolarini ko‘radi.

- [ ] Chek yoki mijoz qidiruvi, holat/sana kabi mavjud filtrlar, saralash, yangilash, sahifalash; chek raqami, vaqt, mijoz, qatorlar soni, summa va holat jadvali bor.
- [ ] «Ko‘rish» chek oynasini, «Tafsilotlar» alohida savdo sahifasini ochadi; qoralamani bekor qilish tegishli vakolatdagina ishlaydi. Completed hujjatni oddiy delete/tahrir bilan yo‘qotish mumkin emas.
- [ ] Yakunlangan, qoralama, bekor qilingan va qaytarilgan holatlarni o‘z test yozuvlaringiz bilan solishtiring; boshqa tenant cheki ochilmasin.

### 14. `/sales/[id]` — savdo tafsiloti, qaytarish va chek

**Kim:** E/A/K ko‘rish; bu ekrandagi qaytarish/almashtirish boshqaruvlari E/Aga ko‘rsatiladi.

**Qanday ochiladi:** `/sales` → «Tafsilotlar», mijoz kartasi → «Mijoz savdolari» yoki original xarid tarixi → chek raqami. «Ko‘rish» chek modalini ochadi; «Tafsilotlar» mijozsiz savdo uchun ham alohida sahifaga olib boradi.

- [ ] Chek raqami, mijoz, holat, jami va mahsulot-miqdor-narx-chegirma-jami jadvali; qoralamani kassada davom ettirish, original chek va qaytarish tarixi bor.
- [ ] Chek oynasi: original rekvizit, kassir, izoh/xizmat, serial/kafolat/partiya, soliq, to‘lovlar, berilgan naqd/qaytim, 58/80 mm nusxa va elektron QR/havola paneli.
- [ ] Qaytarish oynasi: qator miqdori, sotiladigan/brak/hisobdan chiqarish holati, tegishli serial/partiyalar, sabab va server hisoblaydigan naqd/karta/bank/qarz taqsimoti.
- [ ] Qisman qaytaring, keyin qolganini; sotilganidan ortiq yoki takror qaytarish rad etilsin. Brak/write-off sotiladigan stockni oshirmasin.
- [ ] Qo‘lda bank/karta refundi uchun haqiqiy tashqi hujjat va tasdiq talabini tekshiring; test real pul yubormaydi. Nasiya qismi qarzni kamaytirsin.
- [ ] Qoralamadagi mijoz uchun karta/promo, ball va sertifikat panellari tegishli siyosat/rozilik bilan ishlaydi; mavjud tanlovni bekor qilish va stale holatni tekshiring. Oldingi noaniq qaytarish yangi amal bilan takrorlanmasin.

### 15. `/sales/[id]/exchange` — tovar almashtirish

**Kim:** E/A; original filialda ochiq smena kerak.

- [ ] Original qaytariladigan qatorlar/seriallar/partiyalar; yangi mahsulot qidirish, miqdor/seriallar; nasiya qismi, sabab va haqiqiy naqd farq maydonlari bor.
- [ ] Previewda qaytarish qiymati, yangi savdo qiymati, naqd va nasiya farqi ko‘rinadi. Musbat farq olinadi, manfiy farq qaytariladi; faqat farq uchun tender olinadi.
- [ ] Original return va yangi savdo birga yoziladi. Yangi SKU stocki yetmasa ikkala iqtisodiy hujjat ham yaratilmasin. Bog‘langan yangi chek va almashtirish tarixi ochilsin.

### 16. `/shifts` — smena va naqd pul boshqaruvi

**Kim:** E/A/K; farqni tasdiqlash, inkassatsiya/bankka topshirish va yopilgan smena tuzatishlarida rahbar cheklovi bor.

- [ ] Smena ochish: mavjud kassa tanlash, boshlang‘ich naqd, izoh, oldingi smena qabulini tekshirish. Bir kassada ikkinchi ochiq smena yaratilmasin.
- [ ] Joriy smena: kassir/kassa/ochilgan vaqt/boshlang‘ich pul, pul kiritish/olish va yopish; pul manbalari summarysi bor.
- [ ] Naqd harakat: turi, summa, sabab. Bankka topshirish/inkassatsiya kassa chiqimi; haqiqiy bank transferi bajarilgan deb olinmaydi.
- [ ] Yopish: sanalgan pul va izoh; kutilgan/sanalgan/farq. Farq bo‘lsa rahbar tasdiqlashi yoki qayta sanashga qaytarishi; pending paytda yangi savdo/naqd amal bloklanishi.
- [ ] Tarix: vaqt/holat/kassa/xodim filtrlari, boshlang‘ich/kutilgan/sanalgan/farq ustunlari, sahifalash va vakolatli CSV.
- [ ] Yopilgan smena tuzatishi: original smena, yo‘nalish/summa/sabab, shu filialning ochiq posting smenasi. Eski smena o‘zgarmasin, savdo daromadi sun’iy oshmasin.

## 3. Mahsulotlar katalogi — 11 sahifa

### 17. `/products` — mahsulotlar ro‘yxati va yaratish

**Kim:** asosiy boshqaruv E/A; tannarx o‘zgarishlarida egasi cheklovi mavjud.

- [ ] Qidiruv nom/SKU/barkod, kategoriya, saralash, sahifalash, CSV; import, kategoriyalar va birliklarga o‘tish.
- [ ] Jadvalda mahsulot, SKU/barkod, kategoriya, birlik, ruxsatli tannarx, sotuv narxi, minimum stock; variant, tavsif/rasm, tasnif, birlik nisbati va tahrirlash yo‘llari.
- [ ] Yaratish/tahrir: nom, SKU, barkod, kategoriya, faol birlik, sotuv/tannarx, minimal qoldiq. Kategoriya yaratish kichik oynasi ham bor.
- [ ] Bir biznesda dublikat SKU/barkod rad etiladi; boshqa test biznesidagi ayni kod avtomatik konflikt bo‘lmasin. Mahsulot yaratish ombor qoldig‘ini o‘zi ko‘paytirmasin.
- [ ] Dona uchun kasr cheklovi, kg uchun aniqlik, noto‘g‘ri/manfiy narx, bo‘sh majburiy maydon va kamera ruxsati rad etilgan holatni tekshiring. Kamera yordamchisi maxsus hardware adapteri emas.

### 18. `/products/[id]` — mahsulot kartasi va barkodlar

**Kim:** mahsulot ko‘rish ruxsati bor hisob; tahrir E/A, tannarxda qo‘shimcha owner cheklovi.

- [ ] Asosiy nom/SKU/barkod/kategoriya/birlik/narx/tannarx/minimum formasi; saqlash, bekor qilish va arxivlashga oid amal mavjud.
- [ ] Qo‘shimcha barkodlar: qidiruv, asosiy belgisi, qo‘shish/olib tashlash, ichki barkod yaratish, CSV, etiketka va nusxalar soni.
- [ ] Qo‘shimcha barkod bilan aynan shu SKU topilishi; dublikat boshqa mahsulotga birikmasligi; asosiy barkod xavfsizligi va etiketkadagi to‘g‘ri kod.
- [ ] Katalog narxi o‘zgarsa eski chek snapshoti o‘zgarmasin. Kassir tannarx yoki tahrir vakolatini olmasin.

### 19. `/products/categories` — kategoriya daraxti

**Kim:** E/A.

- [ ] Nomi, tartib raqami, ota kategoriya; yangi/tahrir, faol/arxiv/barcha filtri, qidiruv, CSV, arxivlash/tiklash.
- [ ] Asosiy va ichki kategoriya yarating; o‘zini ota qilish yoki daraxtda aylana yaratish rad etilsin. Tartib ro‘yxatga ta’sir qilsin.
- [ ] Kategoriya arxivlanishi mahsulot yoki eski savdoni o‘chirmasin; tiklanganda qayta tanlash mumkin bo‘lsin.

### 20. `/products/brands` — brendlar

**Kim:** E/A.

- [ ] Brend nomi yaratish/tahrir; qidiruv, nom/vaqt saralashi, holat, sahifalash, arxivlash/faollashtirish bor.
- [ ] Saqlangan brend mahsulot media sahifasida tanlanadi; arxivlash tarixiy mahsulot ma’lumotini o‘chirmaydi. Xatoda draft va original amalni tiklash ishlaydi.

### 21. `/products/units` — o‘lchov birliklari

**Kim:** E/A.

- [ ] Kod, nom, kasr aniqligi; qidiruv, holat, CSV, tahrir/arxiv/faollashtirish.
- [ ] Dona aniqligi 0, kilogramm ko‘pi bilan 6 kasr bo‘lishi kabi qoida savdoda tekshirilsin. Ishlatilgan birlikning precision/faol holati xavfsiz cheklansin.
- [ ] «Quti» yaratish o‘zi 12 dona konvertatsiyasini yaratmaydi; buning alohida sahifasi bor.

### 22. `/products/[id]/units` — mahsulotning birlik nisbati

**Kim:** bu ekran Ega mo‘ljallangan.

- [ ] Asosiy birlik va mavjud nisbatlar; savdo birligi kodi, asosiy birliklar soni, faol belgisi va sabab.
- [ ] Masalan, 1 quti=12 dona belgilang.1 quti savdoda 12 asosiy birlik ketishini, narx/qoldiq asosiy birlikda hisoblanishini tekshiring. Kirim tannarxi asosiy birlik uchun.
- [ ] Nol/manfiy nisbat yoki birlik precisioniga mos kelmagan miqdor rad etilsin. Nisbat yangilanganda ochiq savat qayta tekshirilsin; eski hujjatdagi nisbat o‘zgarmasin.

### 23. `/products/[id]/variants` — mustaqil mahsulot variantlari

**Kim:** ruxsatli hisob ko‘rishi mumkin; E/A yaratadi.

- [ ] Default/original va rang/o‘lcham kabi variantlar, atributlar, SKU/barkod/narx/qoldiq, faol/arxiv filtri va tanlash.
- [ ] Yangi variant: nom, noyob SKU/barkod, sotuv narxi, atribut nom/qiymatlari va sabab. Har variant alohida qoldiqka ega.
- [ ] Yangi variant stocki 0; unga kirim alohida qilinadi. POSda variant barkodi boshqa variantga emas, aynan shu variantga tushsin.

### 24. `/products/[id]/compliance` — tasnif va savdo cheklovlari

**Kim:** E.

- [ ] MXIK kodi va tekshirilgan manba, MXIK/soliq/markirovka majburiy belgisi, soliq profili, sabab va saqlash/review bor.
- [ ] Majburiy MXIK yoki soliq ma’lumoti yo‘q mahsulot savdosi tegishli xabar bilan rad etilsin.
- [ ] Markirovka majburiy mahsulot real servis ulanmaguncha checkoutdan o‘tmasin. Bu sahifa rasmiy MXIK katalogi yoki fiskal adapter tayyor degani emas.

### 25. `/products/[id]/media` — brend, tavsif va rasm

**Kim:** E/A.

- [ ] Brend qidirish/tanlash yoki brendsiz, mahsulot tavsifi, soliq profili mavjud joyda tanlash va metama’lumotni saqlash.
- [ ] Ichki rasm yuklash/ko‘rish/o‘chirish, hajm/holat/muddat va sahifalash. PNG/JPEG/WebP, 512 KiBgacha; server statik WebPga qayta kodlaydi.
- [ ] Noto‘g‘ri fayl, katta hajm va boshqa mahsulot/tenant rasmini bog‘lash rad etilsin. Eski tashqi URL avtomatik yuklanmasin; rasm ichki `/api/files`dan olinsin.
- [ ] Rasm o‘chirilganda uning tarkibi ishlatilmasin, audit saqlansin. Tavsifdagi HTML/script bajarilmasin.

### 26. `/products/import` — CSV/XLSX import va katalog eksporti

**Kim:** ekranning asosiy boshqaruvi Ega mo‘ljallangan.

- [ ] Andoza/katalog CSV va Excel yuklash, eksport qidiruvi, fayl tanlash, preview, jami/yaroqli/xatoli qatorlar, xato hisoboti va sabab bilan tasdiq.
- [ ] Bitta jadval, 512 KB/1000 qator chegarasi, oddiy qiymatlar; kategoriya va birlik avval mavjud bo‘lishi kerak.
- [ ]2 yaroqli, 1 dublikat, 1 xatoli qatorli faylda natijalarni ajratish; faqat yaroqli qatorlar kirishi, mavjud SKU/barkod yangilanmasligi va stock yaratilmasligi.
- [ ] Formula/tashqi havola, noto‘g‘ri narx va katta fayl rad etilsin. Importni takror bosish mahsulotni ikki marta yaratmasin; aniq decimal eksportda buzilmasin.

### 27. `/products/prices` — ommaviy narx va narxlar tarixi

**Kim:** E/A sotuv narxi; tannarxni qo‘lda o‘zgartirish va eksport qilish E.

- [ ] Narx maydoni, mahsulot qidirish, joriy/yangi narx, 100 tagacha mahsulot, sabab, preview/tasdiq va original noaniq amalni tekshirish.
- [ ] Sotuv narxi 2, tannarx 6 kasrgacha aniqlik; bir vaqtda boshqa oynada narx o‘zgarsa eski preview rad etilishi.
- [ ] Tarixda mahsulot, avval/keyin qiymat, manba/xodim, vaqt; field/qidiruv/saralash/CSV. Eski chek o‘zgarmasin.

## 4. Ombor va zaxira — 9 sahifa

### 28. `/inventory` — qoldiq, kirim va tuzatish hujjatlari

**Kim:** E/A, filial doirasi bilan.

- [ ] Qoldiqlar va hujjatlar tablari; kam qoldiq, 30/60/90 kun savdosiz musbat qoldiq, mahsulot/SKU/barkod, hujjat raqami/sana/turi/holati/supplier filtrlari va CSV.
- [ ] Qoldiq jadvali: mahsulot, birlik, mavjud/minimal miqdor, kam/yetarli holati. Hujjatlar: raqam, turi, supplier, qatorlar, sana/holat va amallar.
- [ ] Yangi kirim: xarid/boshlang‘ich qoldiq/tuzatish, supplier, izoh, mahsulotlar, hujjat birligi, miqdor va **asosiy birlik tannarxi**. Nazorat yoqilgan mahsulotga serial/partiya/sanalar kiritiladi.
- [ ] Draft yaratish qoldiqni o‘zgartirmasin; tasdiq stock va jurnalni bir marta yozsin. Manfiy stockga olib keluvchi chiqim rad etilsin.
- [ ] Tasdiqlangan hujjatni yashirin tahrir qilish o‘rniga sababli qarshi hujjat; original saqlanadi, yetarli qoldiq shart. Savdosiz kunlar filtri omborda turish yoshi deb ko‘rsatilmasin.

### 29. `/inventory/transfers` — filiallararo transfer

**Kim:** E/A, tegishli filiallar vakolati bilan.

- [ ] Jo‘natuvchi/qabul qiluvchi, holat/sana/qidiruv, CSV; qatorlar, seriallar, izoh bilan yangi draft.
- [ ] Draftni bekor qilish stockga tegmaydi. Jo‘natish faqat yetarli stockdan chiqarsin; tovar yo‘lda tursin, darhol qabul filialining sotiladigan qoldig‘iga tushmasin.
- [ ] Qisman qabul: soz/brak/kamomad, sabab va tegishli serial/partiya tanlovi. Masalan 5 jo‘natib 3 soz+1 brak qabul qiling; 1 yo‘lda qolsin.
- [ ] Yo‘ldagi qismini manbaga qaytarish; ortiqcha/qayta qabul, bir filialdan o‘ziga transfer va vakolatsiz filial rad etilsin. Qabul farqlari va yakuniy holat to‘g‘ri ko‘rinsin.

### 30. `/inventory/counts` — inventarizatsiya

**Kim:** E/A.

- [ ] To‘liq katalog 2000 tagacha yoki tanlangan mahsulotlar; blind countda kutilgan miqdorni yashirish, mahsulot qidirish va sanashni boshlash.
- [ ] Sanashlar tarixi, tugaganlarni ko‘rsatish, mahsulot/kutilgan/oldingi sanash/yangi miqdor; saqlash, tekshirishga yuborish, sabab bilan tasdiq/bekor qilish.
- [ ] Sanalayotgan SKUlar uchun savdo/kirim/transfer vaqtincha bloklansin. Farq bo‘lsa qayta sanash/manager tasdig‘i ishlasin.
- [ ] Tasdiq faqat farq hujjati bilan stockni o‘zgartirsin; bekor qilish blokni olib tashlasin. Offline/noaniq saqlash qayta yuborilganda ikki tuzatish bo‘lmasin.

### 31. `/inventory/movements` — ombor harakatlari jurnali

**Kim:** E/A.

- [ ] Davr, filial/mahsulot ID, harakat/manba turi/ID, qidiruv/saralash/CSV; sana, mahsulot, signed miqdor, tannarx va manba/xodim ustunlari.
- [ ] Nazorat kirimining musbat, savdoning manfiy va sotiladigan qaytarmaning musbat harakatini tegishli hujjatlar bilan solishtiring.
- [ ] Jurnaldan to‘g‘ridan-to‘g‘ri miqdorni tahrirlash yo‘li bo‘lmasin; ko‘rinish va eksport filial doirasini saqlasin.

### 32. `/inventory/dispositions` — brak va hisobdan chiqarish

**Kim:** E/A.

- [ ] Mahsulot/SKU/filial, damaged/write-off yo‘nalishi, saralash/CSV; mahsulot-filial kesimidagi brak va write-off yig‘indisi hamda original return-item jurnali.
- [ ] Brak qaytarmasi tegishli brak joylashuviga; write-off saqlash qoldig‘i sifatida olinmasin. Ikkalasi sotiladigan stockni oshirmasin.
- [ ] Tannarx original chekdan olinsin; keyingi katalog narxi o‘zgarishi tarixni qayta yozmasin.

### 33. `/inventory/locations` — zonalar va rezerv

**Kim:** E/A; faol filial kerak.

- [ ] Zona yaratish, mahsulot qidirish, fizik/rezerv/mavjud/biriktirilmagan/brak qoldiqlar va zona kesimi.
- [ ] Manba/qabul zona, miqdor va sabab bilan ko‘chirish umumiy fizik stockni o‘zgartirmasin.
- [ ] Rezerv: mahsulot/zona/miqdor/tugashISO/sabab; mavjud qoldiqdan ortig‘i rad etilsin. Available = on-hand − faol rezerv.
- [ ] Rezerv tarixi/holati/turi/qidiruv; bo‘shatish va aynan mos POS draftini tanlab naqd sotish. Bekor/muddati tugagan/begona rezerv bilan savdo bo‘lmasin.
- [ ] Offline rezervning muddati tugashi tovar/pul masalasi avtomatik hal bo‘ldi degani emas; egasi tekshiruvini talab qilsin.

### 34. `/inventory/batches` — partiyalar va yaroqlilik

**Kim:** E/A/K ruxsatli ko‘rish; nazoratni yoqish E, sanash E/A.

- [ ] Mahsulot, partiya kodi, qoldiq, kirim/yaroqlilik sanasi, holat; qidiruv, muddati bo‘yicha saralash, holat va CSV.
- [ ] Egasi tarixsiz yangi SKU uchun nazorat va yaqin muddat ogohlantirish kunlarini sabab bilan sozlaydi. Mavjud tarixni taxminiy partiyalarga bo‘lish yoki yoqilgan nazoratni o‘chirish rad etilsin.
- [ ] Ikki partiyani kirim qiling: ertaroq yaroqlisi FEFO bilan chiqishi, muddati o‘tgan partiya savdo/transferga ketmasligi.
- [ ] Partiya sanashida ma’lum partiyalarning haqiqiy miqdori/sabab; previewdan keyin stock/tannarx o‘zgarsa eski tasdiq rad etilsin.

### 35. `/inventory/serials` — seriallar va kafolat

**Kim:** ruxsatli ko‘rish E/A/K; tarix/servis E/A, nazorat siyosati E.

- [ ] Mahsulot, serial, available/sold/transit/damaged/retired holati, original kirim/savdo/qaytarish izi va kafolat; qidiruv/saralash/sahifalash.
- [ ] Egasi tarixsiz, butun birlikli SKUda serial nazoratini yoqadi; kafolat kuni/sharti va sababni belgilaydi. Eski qoldiqqa uydirma serial yozilmasin.
- [ ] Har birlikka noyob serial, sotishda tanlash, qaytarishda original serialni tanlash. Begona/sotilgan serial qayta sotilmasin; seriallar normalizatsiyasi to‘g‘ri bo‘lsin.
- [ ] Servis: original kafolat, yangi/jarayonda/hal qilingan/rad etilgan holat va izoh. Servis yozuvi o‘zi pul yoki stock harakati yaratmasin; eski kafolat sharti yangi siyosatdan o‘zgarmasin.

### 36. `/replenishment` — qayta buyurtma tavsiyasi

**Kim:** E/A.

- [ ] Filial/mahsulot, minimal va maksimal qoldiq; saqlash. Hisobotda qoldiq/minimum/maksimum/tavsiya, filial/qidiruv/saralash.
- [ ] Stock minimumga teng yoki kichik bo‘lsa yozuv chiqadi. Max belgilanganida max−stock, bo‘lmasa minimumgacha to‘ldirish ko‘rsatiladi.
- [ ] Tavsiyani ko‘rish yoki limitni sozlash buyurtma, rezerv, pul yoki ombor kirimini yaratmasin. Sotuv tezligi/yetkazish muddati taxmin qilinmasin.

## 5. Xarid va moliya — 3 sahifa

### 37. `/suppliers` — yetkazib beruvchilar

**Kim:** E/A.

- [ ] Nom/telefon/STIR qidiruvi, holat/saralash/sahifalash/CSV; yaratish, tahrir, arxiv/tiklash.
- [ ] Forma: nom, telefon, STIR, manzil, izoh, bank nomi/hisob raqami, to‘lov va yetkazish shartlari.
- [ ] Saqlangan kartani ochish; rekvizit tahriri eski invoice/to‘lovni yo‘qotmasligi; arxivlangan supplier yangi amallarda tegishli cheklov bilan ishlashi.

### 38. `/suppliers/[id]` — supplier, buyurtma, invoice va xarajat tannarxi

**Kim:** E/A; tannarxga yakuniy qo‘llash/reversal E.

- [ ] Rekvizitlar va shartlar; davr/filial/holat/hujjat qidiruvi, xarid/qarshi/sof xarid qiymati va kirim tarixi/CSV. Xarid yig‘indisi supplierga to‘langan pul bilan adashtirilmasin.
- [ ] **Buyurtma:** filial, raqam, mahsulot/miqdor/narx, sabab, qator qo‘shish. Buyurtma stock/pulga tegmaydi. Qisman qabul: kelgan miqdor, serial/partiya/sanalar, invoice raqami/muddati/sabab; kirim va invoice birga yaratiladi.
- [ ] **Supplier ledger:** invoice jami, taqsimlangan, qarz, to‘langan va avans; tasdiqlangan xaridni alohida invoicega olish; eski xaridlar avtomatik qarz bo‘lmasin.
- [ ] **To‘lov/avans:** hisob, summa, invoicega ajratish yoki avans, sabab va qo‘lda bank hujjati/tasdiq. Mavjud avansni keyin invoicega bog‘lash yangi pul chiqimi yaratmasin; filiallar yashirin net qilinmasin.
- [ ] **Credit:** original invoice mahsulotini qaytarish yoki kelishilgan narx kamayishi; miqdor/summa/serial/sabab/preview/tasdiq/tarix. Original chegaradan oshmasin; to‘langan qism avansga qaytsin, o‘zi cash refund bo‘lmasin.
- [ ] **Original qabul ostidagi landed cost:** qo‘shimcha summa; qiymat, mos birlik miqdori yoki vazn bo‘yicha taqsimot; qator vazni, xarajat ulushi va yaxlitlash. Preview hech narsa post qilmaydi.
- [ ] **Saqlanadigan taqsimot:** o‘sha filialning mavjud, taqsimlanmagan kapitalizatsiya xarajatini tanlash, usul/vazn/sabab; tayyorlash yangi to‘lov yoki tannarx yozmaydi.
- [ ] **Tannarxga qo‘llash:** E preview va sabab bilan stock/COGS/qiymat farqi/yaxlitlash/tranzit/filial jurnallarini ko‘radi va tasdiqlaydi; keyin reversal tekshiriladi. Eski savdo/kirim qayta yozilmasin, xarajat qayta to‘lanmasin; keyingi qiymat o‘zgarishlari correction tarixida ko‘rinsin.

### 39. `/finance` — hisoblar, xarajatlar, ichki o‘tkazma va foyda

**Kim:** E/A; ayrim foyda/tannarx ko‘rinishlari Ega bog‘liq.

- [ ] Hisoblar: nom, bank/registr/provayder ichki kitobi, boshlang‘ich summa/asos, filial/kassa. Naqd balans ochiq smenaning kutilgan puliga, yopilganda sanalgan pulga mos bo‘lsin.
- [ ] Xarajat toifasi: nom va operatsion/kapitalizatsiya tasnifi. Xarajat: hisob/toifa/summa/sabab; naqd hisobga mos ochiq smena talab qilinsin.
- [ ] Ichki o‘tkazma: manba/qabul hisob, summa/sabab; bir martalik qarama-qarshi yozuvlar, ichki transferni savdo tushumi deb hisoblamaslik.
- [ ] Foyda davri, sof savdo/tarixiyCOGS/yalpi foyda, kech tannarx tuzatishi/qiymat farqi, operatsion xarajat/write-off/operatsion foyda/kapitalizatsiya summarysi.
- [ ] Moliyaviy hujjatlar: qidiruv/tur/davr/saralash/CSV; originalga sababli qarshi hujjat. Yetarli pul bo‘lmasa chiqim rad etilsin; eski hujjat o‘zgarmasin.
- [ ] Bu sahifa haqiqiy bank yoki Click transferini yubormaydi. Tovar yoki tannarxga qo‘shilgan yetkazishni ikkinchi marta operatsion xarajat qilib hisoblamang.

## 6. Mijoz va sodiqlik — 5 sahifa

### 40. `/customers` — mijozlar va nasiya

**Kim:** asosiy boshqaruv E/A; ayrim ro‘yxat ma’lumotini kassir API doirasida ko‘rishi mumkin, menyu boshqaruvga mo‘ljallangan.

- [ ] Ism/telefon qidiruvi, saralash/sahifalash/CSV; ism, telefon, manzil, kredit limiti, joriy qarz, avans net qoldig‘i va amallar.
- [ ] Yaratish/tahrir: ism-familiya, telefon, manzil, maksimal kredit, izoh. Noto‘g‘ri/dublikat telefon tekshirilsin; xatoda draft yo‘qolmasin.
- [ ] Mijoz kartasi/qarz undirish/xarid tarixi/dublikat tekshiruvi havolalari. Nasiya savdo va to‘lovdan keyin qarz to‘g‘ri o‘zgarsin; yuklanmagan balans 0 deb ko‘rsatilmasin.

### 41. `/customers/[id]` — mijoz kartasi va ichki hisob

**Kim:** ruxsatli mijozni ko‘rish doirasi; quyidagi kengaytirilgan avans/ledger/rozilik/eslatma/sertifikat panellari asosan Ega ko‘rsatiladi.

- [ ] Mijoz rekvizitlari, kredit limiti, joriy qarz; savdolar va qaytarmalar tarixi/qidiruvi, original chekga o‘tish.
- [ ] **Qarz undirish:** summa, naqd/qo‘lda karta/bank, hujjat raqami/haqiqiy bajarilganlik, izoh; ownerga FIFO yoki aniq qarzlar taqsimoti. Ortiqcha undirish, begona filial va noaniq to‘lovni yangi kalit bilan qaytarish rad etilsin.
- [ ] **Qarz ko‘chirmasi:** davr bosh/oxir/current qarz; kechikkan/kelgusi/muddatsiz/taqsimlanmagan; qatorlar, CSV va print. Boshlang‘ich qarz, oshirish/kamaytirish, write-off: manba hujjat/sana/muddat/summa/sabab. Bular cash to‘lovi emas.
- [ ] **Avans:** naqd hisob/summa/sabab bilan olish; original avansni tanlangan qarzga ajratish; faqat ishlatilmagan qismini qaytarish. Qarz va avans alohida, avans qabul qilinishi qarzni avtomatik yopmasin.
- [ ] **Rozilik:** elektron chek/xizmat eslatmasi/reklama maqsadlari; SMS/e-mail/shaxsan kabi kanal, manba, berish/bekor qilish, dalil IDsi va matn versiyasi. Har maqsad alohida.
- [ ] **Shaxsan eslatma:** amaldagi xizmat roziligi, navbatga qo‘yish, worker holati, muddatli QR/ko‘chirma/havola. Tayyor ≠ yetkazilgan. Rozilik/contact o‘zgarsa eski havola yopilsin.
- [ ] **Chegirma kartasi:** kod, policy bo‘yicha foiz/muddat, chiqarish/bekor qilish va jurnal; **sertifikat:** kod, olish/sarflash/refund turi, original yozuv/savdo/naqd hisob/summa/rozilik/sabab, majburiyat/qoldiq/muddat. Siyosat yoqilmaganida tegishli amal mavjud emas.
- [ ] Mijoz kredit limiti faqat tanlangan mijozning nasiya savdosiga ta’sir qilsin. Boshqa tashkilot mijoz IDsi ochilmasin; kassirga owner panellari/tannarx/umumiy ledger vakolati berilmasin.

### 42. `/customers/[id]/history` — original tarix va dublikat kartani birlashtirish

**Kim:** ruxsatli tarix; merge E.

- [ ] Asosiy/original birlashtirilgan kartalar, original qarz ko‘chirmasiga yo‘l, cheklar/qaytarmalar va qidiruv/saralash/sahifalash.
- [ ] Merge: faol asosiy mijozni qidirish/tanlash, sabab va qat’iy preview/tasdiq. Eski chek/qarz original IDda qolsin; tarixiy summalar qayta yozilmasin.
- [ ] Ochiq qarzi/qoralamasi bor kartani birlashtirish rad etilsin. Merge qaytarilmaydi; faqat alohida test kartalarida bajaring. Birlashtirilgan eski karta yangi savdoga qo‘yilmasin.

### 43. `/customers/duplicates` — eski telefon dublikatlari

**Kim:** E.

- [ ] Nomi/to‘liq telefon qidiruvi, normalizatsiyalangan telefon guruhlari, original kartalar va tarix/merge havolalari.
- [ ] Telefonning o‘xshashligi odamlar avtomatik birlashtirilganini anglatmasin. Egasi tekshiradi; yangi dublikat yaratish himoyasi saqlanadi.
- [ ] Eski dublikat bo‘lmasa bo‘sh natija normal. Ro‘yxatni to‘ldirish uchun ishlaydigan validatsiyani chetlab o‘tib real bazaga xato yozuv kiritmang.

### 44. `/loyalty` — bonus, karta, promo va sertifikat siyosati

**Kim:** E. Qoidalar taxminiy standartdan emas, egasi saqlagan versiyadan olinadi.

- [ ] **Ball:** yoqish, 1 ball uchun UZS, sarflash qiymati, max foiz, minimal soliqsiz savdo, muddat/cheklanmagan, chegirmali/nasiyali savdoga berish.
- [ ] **Sertifikat:** yoqish, min/max summa, muddat, ishlatilmagan pulning naqd refundiga ruxsat.
- [ ] **Karta/promo:** yoqish, karta foizi/muddati, promo+karta va promo+ball birga qo‘llanishi; sabab va yangi policy versiyasi.
- [ ] **Promo kampaniya paneli:** kod, foiz/UZS, qiymat, minimal chek, max chegirma, global/mijoz foydalanish limiti, boshlanish/tugash(Toshkent), filiallar/sabab; qidiruv/tarix/bekor qilish.
- [ ] Policy yoqilgach tegishli mijoz/savdo panelida ishlasin; limit yoki muddat buzilsa checkout rad etilsin. Eski grant/sertifikat/kafolatlangan shartlar keyingi versiyadan qayta yozilmasin.
- [ ] Tartib original chegirma → karta → promo → ball; kassir chegirma cheklovi saqlansin. Qaytarish promo limitini qayta ochmasin; ballning original qaytarish hisobini tekshiring.

## 7. Hisobotlar — 6 sahifa

### 45. `/reports` — savdo va mahsulot hisoboti

**Kim:** E/A, foyda/tannarxda vakolat cheklovi.

- [ ] Sana oralig‘i, savdolar/mahsulotlar tablari, chek/mijoz yoki mahsulot/SKU qidiruvi, saralash/sahifalash, yangilash va to‘liq CSV.
- [ ] Yalpi savdo, qaytarilgan qiymat, naqd savdo/qarz undirish/refund, nasiya, umumiy tushum/chek soni/o‘rtacha; mahsulot miqdori/tushum/tannarx/yalpi foyda.
- [ ] Hisob `asOf` holati bilan ko‘rinsin; eksport shu holatga mos bo‘lsin. Qidiruv chek ro‘yxatini tanlashi bilan davr bo‘yicha pul/qarz summarylarini adashtirmang.
- [ ] Quyidagi nazorat ssenariysidagi yalpi/sof savdo va nasiya summalarini qo‘lda hisoblab solishtiring; refund alohida to‘g‘ri davrda ko‘rinsin.

### 46. `/reports/breakdowns` — savdo kesimlari

**Kim:** E/A.

- [ ] Davr/filial, product/category/cashier/store/payment kesimi, nom/ID qidiruv, saralash, jami/sahifalar va CSV.
- [ ] Sof miqdor/savdo, tarixiy tannarx va yalpi foyda tegishli kesimga yig‘ilsin. Kategoriya joriy kategoriyadan, return kassiri original savdodan olinadi.
- [ ] To‘lov kesimini cash-flow deb olmang: keyingi qarz undirish va ichki o‘tkazma kirmaydi; sof kanal manfiy bo‘lishi mumkin.

### 47. `/reports/purchases` — xarid narxlari va taqqoslash

**Kim:** E/A.

- [ ] Narx tarixi yoki mahsulot/supplier taqqoslash; sana/filial, mahsulot/supplier katalog filtrlari, qidiruv/saralash/CSV va to‘liq yig‘indi.
- [ ] Xarid, qarshi hujjat, supplier return va narx creditini alohida ko‘ring. Narx creditida fizik miqdor 0; har xil birliklar qo‘shilmasin.
- [ ] Vaznli o‘rtacha faqat xarid qatorlaridan; eski `confirmedAt` yo‘q hujjatda foydalanilgan sana belgilansin. Bu supplier qarzi/to‘lovi emas.

### 48. `/reports/supplier-balances` — supplier qarzi va muddati

**Kim:** E/A.

- [ ] Filial/supplier filtrlari, qidiruv, qarz/kechikkan qarz saralashi, joriy snapshot/CSV, supplier-filial kesimlari.
- [ ] Faqat ro‘yxatga olingan invoice va to‘lovlar; qarz/avans va muddat guruhlari alohida. Oddiy eski kirim avtomatik qarz bo‘lmasin.
- [ ] Qisman to‘lov va avans ajratishdan keyin yangilab tekshiring; boshqa filiallar yashirin net qilinmasin.

### 49. `/reports/reconciliation` — hisoblarni solishtirish

**Kim:** E/A.

- [ ] Ombor, savdo/to‘lov, qaytarish va yopilgan smena tekshiruv turlari, filial/qidiruv/saralash va qayta tekshirish.
- [ ] Kutilgan/saqlangan/farq hamda source-chek yoki mahsulot ma’lumoti bor. To‘g‘ri nazorat oqimida tushuntirilmagan farq bo‘lmasin.
- [ ] Tekshirish balansni tuzatmasin. Eski jurnalga bog‘lanmagan boshlang‘ich qoldiq chiqsa, sababini qayd eting; real yozuvni buzib sun’iy xato hosil qilmang.

### 50. `/reports/plans` — rejalashtirilgan hisobot/KPI/prognoz

**Kim:** E; jobs worker kerak.

- [ ] Jadval nomi/sababi, yoqish, kunlik/haftalik/oylik, soat-daqiqa/hafta kuni/oy kuni, saqlash 1–720 soat, missed-period siyosati.
- [ ] Davr: oxirgiNkun/oldingi hafta/oy, faqat tugagan yoki joriy qisman kun, 20 tagacha filial va KPI tanlash.
- [ ] Prognoz SKU/barkod tanlovi, moving-average/hafta-kuni baseline, oyna/tarix/backtest/horizon; previewda filial KPI va MAE/RMSE/WAPE ko‘rinadi.
- [ ] Tarix kam bo‘lsa «prognoz yo‘q», yetarli bo‘lsa o‘lchangan baseline; bu kafolatlangan talab bashorati emas.
- [ ] Saqlash, tahrir, to‘xtatish, keyingi run, urinish/tarix va JSON/XLSX/PDF-print eksport. SMS/e-mailga yuborish kutmang; worker o‘chiq bo‘lsa scheduled natija `BLOCKED`.

## 8. Sozlamalar, xavfsizlik va yordam — 19 sahifa

### 51. `/settings` — tashkilot, filial, kassa va xodimlar

**Kim:** asosiy boshqaruv E.

- [ ] **Tashkilot tabi:** biznes nomi, telefon, STIR, chek footeri; saqlash. Manfiy stock taqiqlangani ko‘rinsin; uni yoqish amali bo‘lmasin.
- [ ] **Filial/kassa tabi:** filial nomi/manzil/telefon; filialdagi kassa nomi/kodi, faol holati va yangi kassa yaratish. Tarif filial/kassa limitlari API orqali ham tekshirilsin.
- [ ] **Xodim tabi:** ism/telefon/rol/filiallar/holat; qidiruv/saralash/filtr/sahifalash; xodim yaratish yoki 72 soatlik taklif, taklifni yashirish/bekor qilish.
- [ ] **Vakolat oynasi:** admin/kassir va biriktirilgan filiallar; bloklash/faollashtirish/arxiv/tiklash. Bloklangach eski sessiya bilan amal bajarilmasin; arxiv moliyaviy tarixni yo‘qotmasin.
- [ ] **Egalikni topshirish:** tegishli faol xodimga so‘rov va headerda qabul/rad oqimi. Oxirgi egani bloklab/arxivlab yoki vakolatdan chiqarib tashkilotni egasiz qoldirish mumkin bo‘lmasin.
- [ ] Bir nechta filial/kassa yaratilganda headerdagi tanlov orqali o‘ting; xavfsiz almashtirish cheklovlari quyida ko‘rsatilgan. Headerda o‘qilgan filial bilan posting filiali farq qilmasin.

### 52. `/settings/prices` — narx darajalari va mijoz guruhlari

**Kim:** E/A; guruh va ayrim amallarda owner cheklovi saqlanadi.

- [ ] Mijoz guruhini yaratish va mijozni guruhga biriktirish; tanlangan mijoz/guruh boshqa sahifaga o‘tganda yo‘qolmasligi.
- [ ] Narx qoidasi: mahsulot, chakana/ulgurji/guruh/mijoz darajasi, filial yoki umumiy, minimal miqdor, birlik narxi, UTC boshlanish/tugash va sabab.
- [ ] Ustuvorlik mijoz → guruh → ulgurji → chakana → asosiy; har darajada filial qoidasiga, keyin mos eng katta minimal miqdorga ustunlik.
- [ ] Boshlanish kiradi, tugash kirmaydi; qoidani arxivlash/tarix va eski chek o‘zgarmasligi. POSdan miqdor/mijoz o‘zgartirib server narxini solishtiring.

### 53. `/settings/taxes` — soliq profillari va tarixiy stavka

**Kim:** E.

- [ ] Profil nomi, faol/arxiv ko‘rinish, yaratish/arxiv/tiklash, tarixni ochish; narx ichida/ustiga/imtiyoz, stavka, imtiyoz sababi va kuchga kirishUTC sanasi.
- [ ] Keyingi versiya oldingisidan keyingi sanada; tarixni ortga o‘zgartirish rad etilsin. Mahsulotga profil biriktirib, yangi savdoda server hisobini tekshiring.
- [ ] Eski savdoning soliq snapshoti saqlansin. Bu ichki siyosat ekrani; rasmiy fiskal integratsiya yoki huquqiy tasdiq hisoblanmaydi.

### 54. `/settings/support` — supportga vaqtli o‘qish ruxsati

**Kim:** E; oldindan tayinlangan S kerak.

- [ ] Faol operator, ruxsatli filiallar, o‘qish scope, 1–60 daqiqa, sabab, review/tasdiq; berilgan ruxsatlar/muddat va sabab bilan bekor qilish.
- [ ] Operator yo‘q bo‘lsa tushunarli mavjud emas holati. Ruxsat savdo/pul/stock yozish huquqini bermasin.
- [ ] S bilan `/support`da tekshiring: scope/filialdan tashqari ma’lumot yo‘q; expiry/revoke keyingi o‘qishni darhol yopadi; har ko‘rish auditlanadi.

### 55. `/roles` — maxsus rollar va vakolatlar

**Kim:** E.

- [ ] Maxsus rol ro‘yxati, qidiruv, holat/versiya/biriktirilganlar; Omborchi/Buxgalter/Kuzatuvchi namunalaridan boshlash.
- [ ] Nom, asosiy admin/kassir roli, GET/POST/PUT/PATCH/DELETE bo‘yicha explicit vakolatlar, faol belgi, sabab va tasdiq.
- [ ] Xodimga profil biriktirish/olib tashlash; eski versiya bilan ustidan yozish rad etilsin. Vakolat yoki faol holat o‘zgarsa biriktirilgan sessiyalar bekor qilinsin.
- [ ] Profil asosiy rol chegarasidan yuqoriga ko‘tarmasin; boshqa filialga kirish bermasin. Profilni olib tashlash asosiy rolning kengroq huquqlarini qaytarishi mumkin — alohida tekshiring.

### 56. `/security` — hisob xavfsizligi

**Kim:** har kim o‘z hisobi bo‘yicha; PINda kassir va filial cheklovi.

- [ ] Faol/tarixiy sessiyalar, joriy/boshqa sessiya, biznes/usul/sana/expiry/idle/revoke; boshqa sessiyani bekor qilish, tarix sahifalari.
- [ ] Parol: joriy/yangi/takror; muvaffaqiyatdan keyin barcha sessiyalar yopilishi. Barcha sessiyadan chiqish lokal pending amallarni o‘chirmasin.
- [ ] Kassir PIN: joriy parol bilan 6 raqamli PIN saqlash/o‘chirish; filial va kassir tanlab PIN switch. PIN rahbar vakolatini bermasin; eski kassir savati uning hisobida qolsin.
- [ ] Kontakt tasdiqlash: SMS/e-mail holati, kanal/kod so‘rash/kodni tekshirish. Provider yo‘qligida xavfsiz mavjud emas javobi; akkaunt avtomatik tasdiqlanmasin.
- [ ] Authenticator sozlangan bo‘lsa parol bilan ulash, vaqtli kalit/kod tasdiqlash, bir martalik recovery kodlarini saqlash/tozalash/yangilash va recovery bilan bekor qilish. Ulanmagan konfiguratsiyada mavjud emas holati normal; hech qaysi kalitni test hisobotiga qo‘shmang.
- [ ] Xavfsizlik hodisalari/bildirishnomalari: shubhali kirish belgisi, o‘qilmagan soni, o‘qildi deb belgilash va bounded qayta yetkazish; 90 kunlik tarix. Qurilma joylashuvi uydirilmasin.

### 57. `/billing` — tarif, obuna, retention va yopish

**Kim:** o‘z obunasini ko‘rish; ownerning boshqaruvlari alohida. Tarif/bank tasdig‘i **P** uchun, oddiy E/A uchun emas.

- [ ] Trial/active/grace/expired/legacy holat, trial/paid/grace sanalari, tarif va jami filial/kassa/xodim limitlari. Limitda arxiv yozuvlari ham hisoblanadi.
- [ ] Invoice yaratish/tarix/bekor qilish, yangilash niyati va muddat oxirida bekor qilish. Invoice yaratish pul yechmasin; Click ulanmagan izoh ko‘rinsin.
- [ ] P: tarif nomi/UZS narxi/filial-kassa-xodim limitlari/trial/grace/sabab bilan yangi versiya; tashkilotni alohida tarifga ko‘chirish va mustaqil tekshirilgan bank dalili bilan to‘lov tasdig‘i. Oddiy owner bu vakolatni olmasin.
- [ ] Pga platforma integratsiya xarajat budjeti: tur/manba/davr/valyuta/miqdor/birlik narxi/taxminiy yoki tasdiqli/sabab, CSV va bekor qilish. Bu POS kassasi yoki foyda jurnali emas.
- [ ] Retention: versiya, 90 kunlik dastlabki reja, 30 kunlik closure oynasi va alohida audit/log/backup toifalari; avtomatik o‘chirish o‘chiq. Platforma sozlamasi o‘zgarsa eski versiya saqlansin.
- [ ] Closure faqat test tashkilotida: avval ochiq smena/amallarni hal qilish, to‘liq biznes JSON eksportini tayyorlash va yuklab olish, jobID/sabab/joriy parol/review. Faol yopish yangi biznes amallarini to‘xtatadi; ko‘rish/eksport saqlanadi; oynada bekor qilish mumkin.
- [ ] Grace tugagan obunada read-only; to‘lov tasdiqlansa imkoniyatlar tiklanadi; mavjud ma’lumot o‘chmaydi. Katta web-eksport va yakuniy huquqiy o‘chirish qabuli hali ochiq — bu test avtomatik deletionni talab qilmaydi.

### 58. `/platform` — platforma boshqaruvi

**Kim:** P; oddiy tashkilot egasi yoki admin bo‘lish yetarli emas. Har ko‘rishda ikkinchi faktor/haqiqiy platforma vakolati tekshiriladi.

- [ ] Tashkilot nomi qidirish va tasdiqlangan ko‘rish; service/DB tekshirilgan vaqt, integratsiya mavjudligi, tashkilotlar/tariflar/obuna holati/ochiq hodisalar va sahifalash.
- [ ] Billing boshqaruviga o‘tish va eng so‘nggi 20 ochiq hodisa; umumiy panelga mijoz rekvizitlari yoki ichki dalillar chiqmasin.
- [ ] P yo‘q bo‘lsa 403/kirish yopiq holati to‘g‘ri; buni sahifa buzuq deb belgilamang. Asossiz cross-tenant ko‘rish bo‘lmasin.

### 59. `/support` — support operatorining konsoli

**Kim:** S, egasi bergan amaldagi grant bilan.

- [ ] Grantlarni yangilash, ruxsatli biznes, muddat, filial, scope va sahifa tanlash, ma’lumotni ko‘rish.
- [ ] Faqat grantdagi tenant/filial/ma’lumot ko‘rinsin; qayd etilgan kirish auditlansin. Pul/stock/savdo o‘zgartirish tugmasi bo‘lmasin.
- [ ] Grant yo‘q, bekor yoki muddati tugaganida ma’lumot chiqmasin. Support roli business owner o‘rnini egallamasin.

### 60. `/tickets` — yordam murojaatlari

**Kim:** xodim o‘z murojaati doirasida, E biznes doirasida; vakolatli support uchun platforma navbati.

- [ ] Holat/daraja/qidiruv/tenant-platform rejimi, mavzu/mas’ul/vaqt/eskalatsiya ro‘yxati; sahifalash va yangi ticket.
- [ ] Yangi ticket: mavzu, tavsif, oddiy/muhim/kritik daraja, ixtiyoriy requestId va xato kodi; review/yuborish va original ticketga o‘tish.
- [ ] Ichki ish tartibi loyihasi: ish vaqti/hafta kunlari/timezone, birinchi javob va eskalatsiya minuti; tahrir faqat vakolatli operatorga. Bu rasmiy SLA yoki favqulodda kanal emas.
- [ ] Kassir boshqa xodimning yopiq murojaatini ochmasin; owner o‘z biznesini ko‘rsin. Ticket yuborish SMS/Telegram ketdi degani emas.

### 61. `/tickets/[id]` — murojaat tafsiloti

**Kim:** ticket egasi/tegishli owner/vakolatli support; har buyruqda alohida vakolat.

- [ ] Original mavzu/tavsif/holat/daraja/mas’ul, birinchi support javobi va birinchi yechim vaqti, ichki eskalatsiya va tarix.
- [ ] Javob yoki sabab yozish, holat/daraja/mas’ulni o‘zgartirish yoki mas’ulni olib tashlash; preview/tasdiq va sahifalangan voqealar.
- [ ] Mas’ul tayinlashning o‘zi birinchi javob hisoblanmasin. Hal qilish va qayta ochish tarixi yo‘qolmasin; boshqa tenant IDsi ochilmasin.

### 62. `/jobs` — fon ishlari va eksportlar

**Kim:** UI boshqaruvi E; password-owner sessiyasi tenant eksport uchun talab qilinadi; worker kerak.

- [ ] Ish turi: reconciliation, katalogCSV, hisobotCSV/XLSX/PDF-print, tashkilotJSON; kerakli filtrlar/barcha filiallar/sabab, review va navbatga qo‘yish.
- [ ] Ro‘yxat holat/qidiruv/saralash; urinish/max, keyingi urinish, heartbeat, xavfsiz xato kodi; tarixni ochish va sabab bilan qo‘shimcha retry tasdig‘i.
- [ ] Katalog eksporti 100000 qator/16 MiB; hisobot 10000 natija/16 MiB; tenantJSON 100000 qator/16 MiB. Limit oshsa to‘liq xato, qisman fayl emas. Tayyor artifact 24 soatlik.
- [ ] Worker o‘chiq bo‘lsa queued holatni «tayyor» deb ko‘rsatmang. Tayyor fayl yuklanadi; boshqa tenant/begona rol/expired fayl rad etilsin.
- [ ] TenantJSON manifest/qatorlar/hashlar va biznes fayllarini saqlaydi; parol/PIN/sessiya/kodlar chiqarilmaydi. Katta operator fayl eksporti bu browser chegarasini almashtirmaydi.

### 63. `/audit` — audit tarixi

**Kim:** UI Ega mo‘ljallangan; API admission va DALdagi qo‘shimcha cheklovlar saqlanadi.

- [ ] Davr, resurs turi/ID, amal, xodimID, qidiruv/saralash/CSV; sana/xodim/resurs/amal jadvali.
- [ ] Sinov savdo, qaytarish, narx, grant va sozlama amallari bilan tegishli yozuvni toping. Sana tashkilot vaqt zonasiga mos.
- [ ] Payload/IP/parol/token kabi ichki ma’lumot bu jadvalda ochilmasin; auditni o‘chirib/tahrirlab yuborish amali bo‘lmasin.

### 64. `/archive` — arxivlangan katalog va mijozlar

**Kim:** E/A.

- [ ] Mahsulot/mijoz/kategoriya turi, faol/arxiv/barcha, nom qidirish/saralash/sahifalash; arxivlash va tiklash.
- [ ] Arxivlash eski savdo/stockni yo‘qotmasin; qarz/avans qoldig‘i bor mijoz rad etilsin. Kategoriya arxivi barcha mahsulotlarni avtomatik arxivlamasin.
- [ ] Tiklangan mahsulot/mijoz yangi tegishli operatsiyada yana tanlanishi; begona tenant yozuvi tiklanmasligi.

### 65. `/incidents` — hisob tafovutlari va hal qilish

**Kim:** E/A; worker yoki qo‘lda reconciliation tekshiruvi bilan bog‘liq.

- [ ] Hisoblarni solishtirishni tasdiqlash, open/closed/qidiruv/saralash; tur/manba/jiddiylik/oxirgi aniqlanish va yopish sababi.
- [ ] Tekshiruv faqat dalil/incident yaratadi, balansni o‘zi tuzatmaydi. Tafovut saqlanib turganda yopish rad etilsin.
- [ ] Vakolatli correctiondan keyin qayta tekshirish va sabab bilan yopish; yashirilgan yoki yo‘qotilgan eski hodisa bo‘lmasin. Real biznes ma’lumotini buzib incident yasamang.

### 66. `/sync-review` — lokal navbat va server konfliktlari

**Kim:** har hisob o‘z qurilmasi navbati; server konfliktini E ko‘rib chiqadi.

- [ ] Pending/conflict/synced holatlar, original amalID/turi/qidiruv/saralash; asl kalit bilan sinxronlash va ichki hujjat/narx/draft natijasini tekshirish.
- [ ] Signed offline naqd uchun alohida shifrlangan savatga yo‘l; oddiy lokal navbat bilan adashtirilmasin.
- [ ] Owner server konflikti/sabab/terminal natija dalilini tekshiradi. Original payload yoki moliyaviy tarix tahrirlanmasin; konfliktni o‘chirib yashirish yo‘li bo‘lmasin.
- [ ] Aloqani uzib yuborilgan amal keyin bir marta terminal natijaga kelsin. Boshqa qurilmaning lokal savati bulutdan avtomatik kelishi kutilmaydi; boshqa hisob ma’lumoti ochilmasin.

### 67. `/onboarding` — filialning birlamchi tayyorgarligi

**Kim:** E, faol filial tanlangan holda.

- [ ]6 bosqich: tashkilot, filial/kassa, katalog, boshlang‘ich qoldiq, kassir/o‘qitish, nazorat savdosi.
- [ ] Har birida joriy tayyorlik/tasdiq vaqti/dalil, tegishli sahifaga o‘tish, sabab bilan review/tasdiq. Oldingi bosqichsiz keyingi tasdiq o‘tmasin.
- [ ] Reload/serverda qayta kirganda bosqichlar saqlansin. Keyin ma’lumot bloklansa oldingi tasdiqni yashirin o‘chirmay, joriy tekshiruvdan o‘tmayotgani ko‘rinsin.
- [ ] Oxirgi bosqich real nazorat savdo yozuvidir; `/training` natijasi haqiqiy checkout qilingan deb olinmasin. Har filial alohida tekshiriladi.

### 68. `/help` — foydalanish va tiklash qo‘llanmasi

**Kim:** kirgan foydalanuvchi.

- [ ] Internet/server javobi kelmagani, printer chiqarmagani, import xatosi, qurilma/brauzer buzilgani, vakolat/narx/qoldiq konflikti bo‘yicha bo‘limlar bor.
- [ ] Qo‘llanmadagi navbat, original savdo, katalog, server drafti, POS va training havolalari ishlasin.
- [ ] Yo‘riqnoma savat/IndexedDBni o‘chirish yoki noma’lum savdoni qayta yaratishni buyurmasin. Chop etish xatosi savdo muvaffaqiyatsiz degani emasligi tushunarli bo‘lsin.

### 69. `/training` — kassirning iqtisodiy yozuvsiz mashqi

**Kim:** kirgan foydalanuvchi.

- [ ] Bosqichlar, 10000 so‘mlik misol mahsulotini qo‘shish, miqdor/jami, to‘lovga o‘tish, berilgan naqd/qaytim, faqat mashqni yakunlash/qayta boshlash.
- [ ] Masalan 2 ta mahsulot va 30000 naqd →20000 jami/10000 qaytim. Miqdor/pul cheklovlari tushunarli.
- [ ] Real savdo/payment/stock/fiscal/printerga yozuv ketmasin. Yordam va haqiqiy POSga o‘tish havolalari ishlasin.

## 9. Qo‘shimcha PWA va status ekranlari

### PWA-01. `/pwa/offline.html` — aloqa yo‘q fallbacki

- [ ] Aloqa yo‘qligi, mavjud ochiq oynadagi savat/navbatni saqlash yo‘riqnomasi, aloqani qayta tekshirish va oldindan ruxsatlangan offline savatga havola.
- [ ] Yangi oynada maxfiy katalog/sessiya ochilmasin; bu oynadan oddiy yangi savdo/to‘lov yuborilmasin. UZ/RU statik til tanlovi ishlasin.
- [ ] Fallbackning internet uzilganda avtomatik chiqishini tekshirish uchun service worker oldindan o‘rnatilgan/cached bo‘lishi kerak. Bevosita URL ochilishi avtomatik fallback ishlashini isbotlamaydi.

### PWA-02. `/pwa/cash.html` — shifrlangan offline savat oynasi

- [ ] Oldindan olingan ruxsatni tanlash, lokal unlock iborasi, qator/jami/expiry tafsiloti, mijoz bergan naqd va bir martalik qabul; original natijani sinxronlash.
- [ ] Muddati o‘tgan/noto‘g‘ri ibora/noto‘g‘ri qurilma va savat tahriri rad etilsin. Faqat naqd; karta/nasiya yoki yangi ruxsatsiz mahsulot qo‘shish bo‘lmasin.
- [ ] Internet qaytgach aynan asl key/payload bilan yakunlansin; oynani qayta ochish ikkinchi to‘lov yaratmasin. Server ruxsatlari/rahbar tekshiruviga yo‘l bor.

### STATUS-01. Alohida xizmatning `/` sahifasi — odatda `http://127.0.0.1:8091/`

Bu asosiy POSning 3000 portidagi sahifa emas. Xizmat alohida ishga tushirilmagan bo‘lsa manzil ochilmasligi tabiiy; bu uning ishlayotganiga doir da’vo emas.

- [ ] Xizmat qismlarining holatlari, oxirgi tasdiq vaqti, investigating/identified/monitoring/resolved voqealar timelinei.
- [ ] Ma’lumot eskirganda `unknown`/tasdiqlanmagan; avtomatik eski «yashil» holat qolmasin. Bo‘sh hodisa ro‘yxati «hech qanday uzilish bo‘lmagan» degani emas.
- [ ] POS/DB bilan aloqasiz public sahifa; ticket sirlarini, login yoki biznes boshqaruvini ko‘rsatmasin. Real boshqa hostdagi qabul hali tashqi vazifa.

## 10. Alohida URL bo‘lmagan umumiy ekranlar

- **404:** mavjud bo‘lmagan `/test-sahifa-yoq` kabi yo‘lda «Sahifa topilmadi», til almashtirish, saqlangan amallar va bosh sahifaga qaytish. Begona resurs IDsi real ma’lumotni oshkor qilmasin.
- **Dashboard error boundary va global error:** sahifa ochilmadi, qayta ochish/retry va original saqlangan amalni tekshirish yo‘li; texnik stack/secret ko‘rsatilmasin. Buni real kodni buzib emas, alohida test muhitida boshqariladigan xato bilan sinang.
- **Loading:** sahifa/ma’lumot yuklanmoqda indikatori; tugma yoki bo‘sh ro‘yxat bilan adashtirmaslik.
- **Umumiy header/sidebar:** tashkilot nomi, rol/xodim, joriy filial/kassa/smena, til, POS, chiqish, ko‘p biznes bo‘lsa biznesni almashtirish; mobil menyu/yopish. Pending amallar borida biznesni almashtirish xavfsiz cheklansin.
- **Obuna/maintenance/muhim holatlar bannerlari:** trial/grace/read-only, maintenance yoki versiya yangilanishi, pending savdo/ochiq smena/tafovut/sync ogohlantirishlari.
- **Muhim amal uchun ikkinchi faktor:** zarur bo‘lsa TOTP/step-up tasdiq; owner roli bilan o‘zi bypass qilinmasin.
- **Yangilangan PWA versiyasi:** savat/amallarni saqlash va oynalarni qayta ochish ko‘rsatmasi; pending savdo yo‘qolmasin.

## 11. Bitta to‘liq hisoblash ssenariysi

Bu yangi test biznesida boshqa operatsiyasiz bajariladigan nazorat namunasi. Soliq, promo, ball, konvertatsiya, serial/partiya va oldingi qarz bu namunaga qo‘shilmaydi. Keyin ularni alohida tekshiring.

1. E bilan dona birligida **Test mahsulot A**, tannarx 8000 UZS, sotuv 12000 UZS yarating; noyob SKU/barkod tanlang.
2. Boshlang‘ich/kirim hujjati bilan 10 dona qoldiqni tasdiqlang. Mijoz yarating: boshlang‘ich qarz 0, kredit limiti kamida 12000 UZS.
3. Hisoblarni aralashtirmaslik uchun bu nazoratni E hisobida bitta filial/kassaning bitta smenasida bajaring: boshlang‘ich naqd 100000 UZS. K vakolatlarini keyin alohida smenada tekshiring.
4. 2 dona mahsulotni naqd soting: shu test mijozini tanlang; jami 24000, berilgan 30000, qaytim 6000. Qoldiq 8, smena kutilgan puli 124000.
5. Mijoz kartasidagi savdo havolasidan o‘sha chek tafsilotini ochib, 1 donasini sotiladigan stockka naqd qaytaring: 12000 refund. Qoldiq 9, kassa 112000.
6. 1 donani shu mijozga to‘liq nasiya soting: 12000 qarz. Qoldiq 8, kassa 112000.
7. Vakolatli hisobda 5000 naqd qarz undiring: qarz 7000, kassa 117000.
8. `/finance`da mos naqd hisob va operatsion toifa orqali 2000 xarajat yozing: kassa 115000. Bu amalni bajarmasangiz yopish uchun 117000 kutiladi.
9. Savdo/hisobot/ledgerlarni solishtiring: yalpi savdo 36000, qaytarilgan qiymat 12000, sof savdo 24000, mijoz qarzi 7000, fizik stock 8. Shu shartlarda sof COGS 16000, yalpi foyda 8000; 2000 operatsion xarajat bilan operatsion foyda 6000.
10. Hech qanday boshqa cash harakati bo‘lmasa 115000 sanalgan pul bilan smenani yoping. Qo‘shimcha xato sinovi uchun alohida smenada farqli summa kiritib manager tasdig‘ini tekshiring.
11. `/reports/reconciliation`, `/incidents`, `/inventory/movements`, `/audit`, mijoz tarixi va original cheklar bilan izni tekshiring. Summalarni tuzatish uchun mavjud hujjatlarni qo‘lda tahrirlamang.

## 12. Kuzatilgan cheklovlar va natijani to‘g‘ri baholash

1. **Filial/kassa almashtirish.** Bir nechta ruxsatli filial yoki kassa bo‘lsa headerda tanlov bor. Egasi administrator yaratgan faol filialni ham ko‘radi; boshqa xodim faqat biriktirilgan filiallarni ko‘radi. Tanlashdan oldin serverdagi ro‘yxat yangilanadi. Lokal savat bo‘sh bo‘lishi, yozilishi tugagan bo‘lishi va pending/konflikt/offline naqd ruxsat hal qilingan bo‘lishi kerak. Savatni avval server qoralamasiga saqlang yoki ongli ravishda tozalang; so‘ng boshqa filialga o‘ting. Saqlangan qoralama original filial/kassada qoladi. LocalStorage qiymatini qo‘lda almashtirmang.
2. **Yon menyu va server vakolati bir xil tushuncha emas.** Masalan, ayrim ko‘rish APIlari kassirga ruxsatli, lekin boshqaruv sahifasi menyuda yashirilgan yoki UI ownerga toraytirilgan. Ushbu qo‘llanmadagi rol asosiy ekran ishlatish doirasidir; maxsus rol, filial, smena, platforma va DAL tekshiruvlari baribir ustuvor.
3. **Hamma sahifa menyuda turmaydi.** `/settings/prices`, `/settings/taxes`, mahsulot child sahifalari va ayrim hisobotlar boshqa ekranlardan yoki yuqoridagi to‘g‘ridan-to‘g‘ri URL orqali ochiladi. Havolaning mavjudligi/qulayligi ham sinov natijasiga yoziladi; yo‘q menyu bandini bor deb hisoblamang.
4. **Bo‘sh partiya/serial/dublikat/incident tarixi xato emas.** Ular uchun tegishli test ma’lumoti oldindan kerak. Vendor/hardware formatlarini o‘ylab topib to‘ldirmang.
5. **Job navbati workerni talab qiladi.** Real to‘lov/fiskal/SMS/e-mailga bog‘liq bandlarni lokal mock bilan productionda ishladi deb belgilamang. Brauzer print oynasi fizik printer mosligi emas.
6. **Katta web-eksport tugallanmagan.** `/jobs`dagi 16 MiB/100000 qator chegarasi amaldagi chegara. Operatorning katta fayl eksporti browser/closurening cheksiz eksportga tayyorligini bildirmaydi.
7. **Huquqiy tasdiq va real pilot hali alohida.** `/billing`dagi retention/closure ma’lumotni avtomatik o‘chirmaydi; support draft tartibi rasmiy SLA emas; elektron chek fiskal chek emas.
8. Sidebarning Online/Offline holati endi readiness so‘rovi orqali tekshiriladi; POSda ham alohida aloqa ko‘rsatkichi bor. Tekshiruvlar davriy, shuning uchun avvalgi Online yozuvi keyingi amal muvaffaqiyatini kafolatlamaydi. Statik versiya yorlig‘i production qabul dalili emas.

Qo‘shimcha regressiyalar: sozlamalarda STIR va chek footerini bo‘shatib saqlang, qayta yuklab tekshiring; kasr miqdorining +/- tugmalarini va savat qayta ochilganda birlik/serial tanlovlarini tekshiring. Chiqish so‘rovi tarmoqda xato bersa savat o‘chmasligi kerak; tasdiqlangan logout sessiyani bekor qilib lokal ma’lumotlarni tozalaydi. Savdolar ro‘yxatida «Tafsilotlar» original savdo sahifasiga, «Ko‘rish» chek oynasiga olib boradi.

## 13. Natija yozish andozasi

| Sahifa / ssenariy | Rol / filial | Qadam va test ma’lumoti | Kutilgan | Haqiqiy | PASS / FAIL / BLOCKED | RequestId / izoh |
| --- | --- | --- | --- | --- | --- | --- |
| Masalan, `/register`: takroriy STIR | Yangi hisob | Oldin ishlatilgan test STIR |409 TIN_EXISTS; forma saqlanadi | To‘ldiring | To‘ldiring | Faqat maxfiy bo‘lmagan so‘rov raqami |

Har asosiy oqimdan keyin pul, mijoz qarzi, stock va auditni birga tekshiring. Faqat «tugma bosildi» yoki «yashil xabar chiqdi» iqtisodiy natija to‘g‘riligini isbotlamaydi.
