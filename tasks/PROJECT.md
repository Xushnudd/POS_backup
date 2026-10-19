# Shuni POS — loyiha haqida tushunarli qo‘llanma

O‘rganilgan sana: **2026-yil 5-oktabr**.

Bu hujjat loyihaning hozirgi manba kodi, ma’lumotlar bazasi sxemasi, konfiguratsiyalari va mavjud hujjatlari asosida yozildi. Dastur kodi o‘zgartirilmadi. Quyida “mavjud” deyilganda shu imkoniyat uchun kod borligi nazarda tutiladi; barcha funksiyalar ishlayotgan serverda sinovdan o‘tkazilgan degani emas.

## 1. Loyiha nima uchun kerak?

**Shuni POS** — kichik va o‘rta bizneslar uchun brauzer orqali ishlaydigan savdo va ombor boshqaruvi tizimi. POS — kassada savdoni rasmiylashtirish dasturi degani.

Masalan, do‘konga 100 dona mahsulot keldi. Omborga kirim yoziladi. Kassir 3 donasini sotadi, to‘lovni qayd etadi va chek chiqaradi. Omborda 97 dona qoladi. Do‘kon egasi savdo summasi, mahsulot qoldig‘i, mijoz qarzi va kassadagi pulni ko‘rishi mumkin.

Loyiha bir nechta tashkilot, do‘kon va kassani yuritishga mo‘ljallangan. U faqat tashqi ko‘rinishdan iborat emas: interfeys, serverdagi hisob-kitoblar va bazaga yozish qismlari mavjud. Biroq hozirgi holatini to‘liq tayyor mahsulot deb hisoblashga to‘sqinlik qiladigan xatolar bor.

## 2. Kimlar foydalanadi?

| Rol | Maqsadi | Hozirgi menyudagi imkoniyatlari |
| --- | --- | --- |
| `owner` — egasi | Biznesni boshqarish | Barcha asosiy bo‘limlar, jumladan sozlamalar |
| `admin` — administrator | Katalog, ombor va savdoni nazorat qilish | Dashboard, mahsulotlar, ombor, mijozlar, hisobotlar, savdo va smenalar |
| `cashier` — kassir | Kassada savdo qilish | POS, savdolar va smenalar |

Menyu rolga qarab yashiriladi. Lekin menyuning yashirilishi serverdagi ruxsat nazorati bilan bir narsa emas. Ko‘p APIlarda token tekshiriladi, ammo foydalanuvchining aynan shu tashkilot, do‘kon yoki amal uchun vakolati tekshirilmaydi. Bu kamchilik 10-bo‘limda tushuntirilgan.

## 3. Texnik tuzilishi

Loyiha **bitta Next.js ilovasi** sifatida qurilgan. Frontend — foydalanuvchi ko‘radigan ekranlar; backend — ma’lumotni tekshiradigan, hisoblaydigan va bazaga yozadigan server qismi. Ikkalasi ham shu repozitoriyda.

| Texnologiya | Hozir o‘rnatilgan versiya | Vazifasi |
| --- | --- | --- |
| Next.js | 16.3.4 | Sahifalar va server API |
| React | 19.2.4 | Interfeys komponentlari |
| TypeScript | 5-seriya, `package.json` talabi | Koddagi ma’lumot turlarini tekshirish |
| Tailwind CSS | 4-seriya, `package.json` talabi | Dizayn va ekran o‘lchamiga moslashish |
| Prisma | 5.22.0 | PostgreSQL bilan ishlash |
| PostgreSQL | Dockerda 15-seriya | Ma’lumotlarni saqlash |
| Zod | 4.5.4 | APIga kelgan ma’lumotlarni tekshirish |
| bcryptjs va jsonwebtoken | `package.json`da mavjud | Parolni xeshlash va kirish tokeni |
| ZXing Browser | `package.json`da mavjud | Kamera orqali barkod/QR o‘qish |
| Font Awesome | `package.json`da mavjud | Ikonkalar |

Ko‘rib chiqilgan tuzilmada **16 ta sahifa fayli**, **39 ta API route fayli**, **25 ta Prisma modeli** bor. Bitta route fayli bir nechta HTTP amalini bajarishi mumkin; 39 soni amallar sonini bildirmaydi.

Ma’lumot almashish tartibi:

```text
Brauzerdagi ekran
    ↓ src/lib/api.ts orqali so‘rov
Next.js /api yo‘llari
    ↓ ma’lumot tekshiruvi va biznes amallari
Prisma
    ↓
PostgreSQL ma’lumotlar bazasi
```

Alohida Express yoki Fastify serveri mavjud emas. Amaldagi API bazaviy manzili **`/api`**. README ichidagi `/api/v1`, Express/Fastify, Swagger va ayrim kutubxonalar haqidagi qismlar reja yoki tavsiya bo‘lib, hozirgi kodni to‘liq ifodalamaydi.

## 4. Papka va fayllar xaritasi

| Joy | Unda nima bor? |
| --- | --- |
| `src/app/page.tsx` | Ochiq tanishtiruv sahifasi |
| `src/app/layout.tsx`, `globals.css` | Umumiy sahifa qobig‘i, uslublar va sayt metama’lumotlari |
| `src/app/(auth)` | Kirish va ro‘yxatdan o‘tish ekranlari |
| `src/app/(dashboard)` | Ishchi ekranlar: kassa, ombor, katalog, mijozlar va boshqalar |
| `src/app/api` | Serverdagi API amallari |
| `src/components/pos` | Savat, mahsulot qidirish, kamera skaneri, to‘lov, chek va smena oynalari |
| `src/components/layouts` | Yon menyu, yuqori panel va ishchi sahifalar qobig‘i |
| `src/components/ui` | Tugma, input, modal, karta, tanlash maydoni va bildirishnomalar |
| `src/context` | Kirgan foydalanuvchi, faol do‘kon/kassa/smena va xabarlar holati |
| `src/hooks` | Savat hisobi, qidiruvni kechiktirish va autentifikatsiyaga yordamchi funksiyalar |
| `src/lib/api.ts` | Interfeysdan APIga murojaat qilish uchun umumiy mijoz |
| `src/lib/auth.ts` | Parol xeshlash va JWT yaratish/tekshirish |
| `src/lib/prisma.ts` | Umumiy Prisma ulanishi |
| `src/lib/format.ts`, `constants.ts` | Pul, sana, telefon ko‘rinishi; birliklar, rollar va holatlar |
| `src/types/index.ts` | Frontend ishlatadigan ma’lumot turlari |
| `src/dictionary/uz.json` | Tanishtiruv sahifasidagi o‘zbekcha matnlar |
| `prisma/schema.prisma` | Bazadagi jadvallar va ularning bog‘lanishlari |
| `prisma/migrations` | Boshlang‘ich SQL migratsiyasi |
| `public/img/banner.png` | Tanishtiruv sahifasi uchun rasm |
| `Dockerfile`, `docker-compose.yml` | Ilova va bazani konteynerda ishga tushirish tavsifi |
| `.env`, `.env_backup` | Muhit sozlamalari; maxfiy qiymatlar bu hujjatga ko‘chirilmagan |
| `README.md` | Keng texnik topshiriq va arxitektura rejalari |
| `api.md` | Hozirgi API yo‘llari haqida alohida hujjat |
| `PLAN.md` | Hozir umumiy loyiha rejasi emas, kamera barkod skaneridan foydalanish yo‘riqnomasi |

`(auth)` va `(dashboard)` nomlari sahifalarni guruhlaydi; ular brauzer manzilining bir qismi bo‘lmaydi. Masalan, kassa manzili `/pos`.

## 5. Ekranlar va ularning vazifasi

| Manzil | Foydalanuvchi nima qiladi? | Holati |
| --- | --- | --- |
| `/` | Tizim haqida ma’lumot oladi | Tanishtiruv sahifasi mavjud |
| `/register` | Hisob va tashkilot yaratadi | Kod mavjud; javobda ayrim frontendga kerakli maydonlar yetishmaydi |
| `/login` | Telefon va parol bilan kiradi | API va forma mavjud |
| `/dashboard` | Kunlik savdo, o‘rtacha chek, naqd/karta, kam qoldiq va ochiq smenalarni ko‘radi | Hisoblash API mavjud; ayrim ko‘rsatkichlarning tashkilot filtri yetishmaydi |
| `/pos` | Mahsulot topadi, savat tuzadi, to‘lov va chekni rasmiylashtiradi | Asosiy oqim yozilgan |
| `/sales`, `/sales/[id]` | Savdolar ro‘yxati va chek tafsilotlarini ko‘radi, qoralamani bekor qiladi | Mavjud; yakunlangan savdoni qaytarish oqimi yo‘q |
| `/products`, `/products/[id]` | Mahsulot va kategoriyalarni boshqaradi | Yaratish, tahrirlash, tafsilot va mahsulotni arxivlash mavjud |
| `/inventory` | Qoldiqni ko‘radi, ombor hujjati yaratadi va tasdiqlaydi | Kirim va hujjatlar mavjud; kamaytiruvchi tuzatish cheklangan |
| `/inventory/transfers` | Do‘konlar o‘rtasida mahsulot yuboradi va qabul qiladi | Ekran va API mavjud; yaratish APIida xato bor |
| `/customers`, `/customers/[id]` | Mijoz, nasiya limiti, qarz va qarz undirishni boshqaradi | Mavjud; tushgan pulning kassa bilan bog‘lanishi to‘liq emas |
| `/shifts` | Smenani, naqd pul kiritish/olishni va yopishdagi farqni yuritadi | Mavjud |
| `/reports` | Sana bo‘yicha savdo/mahsulot hisobotini va CSV eksportni oladi | Mavjud; savdo hisoboti serverida xato bor |
| `/settings` | Tashkilot rekvizitlari, do‘kon, kassa va xodimlarni boshqaradi | Yaratish va asosiy sozlamalarni yangilash mavjud |

Interfeys asosan o‘zbekcha. Ishchi ekranlarda matnlar ko‘pincha komponentning o‘zida yozilgan; barcha sahifalar uchun yagona ko‘p tillilik tizimi qurilmagan.

## 6. Asosiy ish jarayonlari

### Hisob yaratish va kirish

Ro‘yxatdan o‘tishda ism, telefon, parol va tashkilot nomi beriladi; e-mail va STIR ixtiyoriy. Server foydalanuvchi, tashkilot, egasi roli, “Asosiy do‘kon”, “Kassa 1”, do‘konga ruxsat va boshlang‘ich chegirma siyosatini yaratadi. Parol ochiq matn ko‘rinishida saqlanmaydi.

Kirish telefon va parol orqali bajariladi. Foydalanuvchining birinchi faol tashkilot a’zoligi olinadi va JWT token beriladi. Token brauzerning `localStorage` xotirasida `pos_token` nomi bilan saqlanadi. So‘rovlarga `Authorization: Bearer ...` sarlavhasi qo‘shiladi. Sahifa qayta ochilganda `/api/auth/me` orqali profil yangilanadi.

Chiqish brauzerdagi token va tanlangan do‘kon/kassa ma’lumotlarini tozalaydi. Alohida server logout yoki refresh endpointi mavjud emas.

### Savdo va chek

1. Do‘kon va kassa tanlanadi, boshlang‘ich naqd summa bilan smena ochiladi.
2. Mahsulot nom, SKU yoki barkod bo‘yicha qidiriladi. Kamera skaneri ham bor.
3. Mahsulot savatga qo‘shiladi; miqdor va chegirmalar o‘zgartiriladi.
4. Zarur bo‘lsa mijoz tanlanadi.
5. Naqd, karta, o‘tkazma yoki nasiya tanlanadi. Hozir to‘lov oynasi bitta usulni yuboradi; API esa bir nechta to‘lov qatorini qabul qiladi.
6. `/api/sales` orqali qoralama savdo yaratiladi.
7. `/api/sales/[id]/complete` orqali savdo yakunlanadi. To‘lov summasi tekshiriladi va manfiy qoldiq taqiqlangan bo‘lsa mavjud qoldiq tekshiriladi.
8. Tranzaksiya ichida savdo holati, to‘lovlar, ombor harakati va qoldiq yangilanadi.
9. Chek oynasi ochiladi; chop etish brauzerning `window.print()` funksiyasidan foydalanadi.

**Tranzaksiya** — bir-biriga bog‘liq bazaga yozish amallarini bir butun sifatida bajarish usuli. Lekin tranzaksiya ishlatilgani parallel so‘rovlar bilan bog‘liq barcha muammolar hal qilinganini anglatmaydi.

Savat React holatida saqlanadi; sahifa yangilanganda uning tiklanishi yozilmagan. Savdo ikki alohida API so‘rovida bajariladi. Yakunlash muvaffaqiyatsiz bo‘lsa yaratilgan qoralama qoladi; qayta urinish mavjud qoralamani davom ettirish o‘rniga yana yangisini yaratishi mumkin.

Kamera komponenti orqa kamerani tanlashga harakat qiladi, kod aniqlanganda skanerni to‘xtatadi. Kamera uchun brauzer ruxsati va HTTPS yoki localhost kerak. Tashqi fiskal printer yoki to‘lov provayderi bilan integratsiya mavjud emas: karta/o‘tkazma bu yerda to‘lovni qayd qilish usuli.

### Omborga kirim

Ombor hujjati mahsulotlar, miqdor va tannarx bilan qoralama sifatida yaratiladi. Tasdiqlanmaguncha qoldiq o‘zgarmaydi. Tasdiqlanganda ombor harakati va joriy qoldiq bir tranzaksiyada yoziladi.

`purchase`, `transfer_in` va `return_in` qoldiqni oshiradi; `transfer_out` kamaytiradi. `adjustment` ham berilgan miqdorni qo‘shadi, ammo forma va API faqat musbat miqdorni qabul qilgani uchun kamomadni manfiy tuzatish bilan yozish hozir to‘liq bajarilmaydi. `return_in` omborga kirim turi bo‘lib, original chek va pulni qaytarish bilan bog‘langan savdo qaytarish jarayonining o‘rnini bosmaydi.

### Do‘konlar o‘rtasidagi transfer

Rejalashtirilgan va kodda ifodalangan jarayon: `draft → sent → received`.

Yuborishda jo‘natuvchi do‘konda chiqim hujjati yaratiladi va qoldiq kamayadi. Qabul qilishda boshqa do‘konda kirim hujjati yaratiladi va qoldiq oshadi. Ammo transfer yaratishda `items` oddiy massiv sifatida Prisma modeliga berilgan; bog‘langan qatorlarni yaratish shakliga mos emas. Shu sabab bu oqimni tuzatishdan oldin ishonchli ishlaydi deb hisoblash mumkin emas.

### Nasiya

Nasiya savdosi `paymentType: credit`, `direction: in` yozuvi bilan qayd etiladi. Qarz undirilganda `credit`, `out` yozuvi yaratiladi. Mijoz qarzi shu ikki turdagi summalar farqidan hisoblanadi.

Bu yerda `out` pul kassadan chiqdi degani emas, qarz kamaydi degani sifatida ishlatilmoqda. Undirish APIi naqd/karta turini va smenani qayd qilmaydi. Shuning uchun undirilgan pul smenaning naqd tushumiga avtomatik qo‘shilmaydi.

### Smena yopish

Hozirgi hisob:

```text
Kutilgan naqd = boshlang‘ich pul + naqd savdo tushumi
               + alohida naqd kirim − alohida naqd chiqim
Farq = kassir sanagan pul − kutilgan naqd
```

Yopilgan smenani yana yopish rad etiladi. Biroq hisoblash va yopish umumiy tranzaksiyada bajarilmagan; hisobga naqd `out` to‘lovlar va nasiya undiruvi kiritilmagan.

## 7. Ma’lumotlar bazasi

| Guruh | Modellar | Oddiy tushuntirish |
| --- | --- | --- |
| Biznes va kirish | `Organization`, `User`, `OrganizationUser`, `Store`, `UserStore`, `Register` | Kim, qaysi biznesda, qanday rol bilan, qaysi do‘kon/kassada ishlaydi |
| Katalog va hamkorlar | `Category`, `Product`, `Customer`, `Supplier` | Nima sotiladi, kim xarid qiladi va kim yetkazib beradi |
| Ombor | `StockDocument`, `StockDocumentItem`, `InventoryMovement`, `InventoryBalance`, `StockTransfer`, `StockTransferItem` | Kirim/chiqim hujjatlari, harakat tarixi va joriy qoldiq |
| Savdo va kassa | `Shift`, `CashMovement`, `Sale`, `SaleItem`, `Payment`, `SaleReturn`, `SaleReturnItem` | Smena, chek, mahsulot qatorlari, to‘lov va qaytarish uchun tuzilma |
| Nazorat | `DiscountPolicy`, `AuditLog` | Chegirma qoidalari va muhim o‘zgarishlar tarixi uchun tuzilma |

Muhim xususiyatlar:

- Pul bazada ikki kasr xonasigacha, mahsulot miqdori uch kasr xonasigacha `Decimal` turida saqlanadi. Interfeysdagi pul formatlash esa butun so‘mga yaxlitlaydi.
- Joriy qoldiq har bir **do‘kon + mahsulot** juftligi uchun alohida.
- Savdo qatoriga mahsulot nomi, SKU, sotuv narxi va tannarx nusxasi yoziladi. Keyinchalik katalog narxi o‘zgarsa ham tarixdagi qiymat saqlanadi.
- Mahsulot, kategoriya va mijozni o‘chirish APIlari `isActive: false` orqali arxivlaydi.
- Holatlar va rollar bazada `String`; sxemada enum bilan cheklanmagan.
- SKU va barkod hozir **butun bazada noyob**. README esa ularni tashkilot ichida noyob bo‘lishini talab qiladi. Ikki tashkilot bir xil barkodli mahsulotni yaratishga urinsa, sxema bunga yo‘l qo‘ymaydi.
- `SaleReturn`, `SaleReturnItem`, `AuditLog` jadvallari mavjudligi ularga tegishli barcha ish jarayonlari tayyorligini bildirmaydi.

## 8. API xaritasi

Barcha yo‘llar quyida `/api`ga nisbatan berilgan. `:id` tegishli yozuv identifikatorini bildiradi.

| Guruh | Asosiy yo‘llar va amallar |
| --- | --- |
| Kirish | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Tashkilot | `GET/POST /organizations`, `GET/PUT /organizations/:id`, `GET/POST /organizations/:id/users` |
| Do‘kon va kassa | `GET/POST /stores`, `GET/PUT/DELETE /stores/:id`, `GET/POST /stores/:id/registers`, `PUT /registers/:id` |
| Kategoriyalar | `GET/POST /categories`, `PUT/DELETE /categories/:id` |
| Mahsulotlar | `GET/POST /products`, `GET/PUT/DELETE /products/:id`; barkod qidiruvi `GET /products?organizationId=...&barcode=...` |
| Mijozlar | `GET/POST /customers`, `GET/PUT/DELETE /customers/:id`, `GET /customers/:id/debt` |
| Yetkazib beruvchilar | `GET/POST /suppliers`, `PUT /suppliers/:id` |
| Savdolar | `GET/POST /sales`, `GET/PUT /sales/:id`, `POST /sales/:id/complete`, `POST /sales/:id/void` |
| Smenalar | `GET/POST /shifts`, `GET /shifts/:id`, `POST /shifts/:id` — yopish, `POST /shifts/:id/cash-movements` |
| Ombor | `GET /inventory/balances`, `GET /inventory/movements`, `GET/POST /stock-documents`, `GET/PUT /stock-documents/:id`, `POST /stock-documents/:id/confirm` |
| Transfer | `GET/POST /transfers`, `POST /transfers/:id/send`, `POST /transfers/:id/receive` |
| To‘lov | `GET/POST /payments`, `POST /payments/credit` — qarz undirish |
| Hisobot | `GET /reports/dashboard`, `GET /reports/sales`, `GET /reports/products` |

Javoblar odatda `success`, `data`, `message` yoki `error` maydonlari bilan qaytadi. Ro‘yxatlarning bir qismida sahifalash bor. Ko‘p so‘rovlarda `organizationId` query yoki so‘rov tanasidan olinadi; token bilan mosligi barcha joyda tekshirilmagan.

## 9. Ishga tushirish sozlamalari

`package.json`dagi mavjud buyruqlar:

| Buyruq | Nima qiladi? |
| --- | --- |
| `npm run dev` | Ishlab chiqish serverini ishga tushiradi |
| `npm run build` | Avval `prisma db push`, keyin `next build` bajaradi |
| `npm start` | Tayyor buildni ishga tushiradi |
| `npm run lint` | ESLint tekshiruvini bajaradi |
| `postinstall` | Prisma client yaratishga urinadi; xato bo‘lsa ham o‘rnatishni muvaffaqiyatli yakunlaydi |

**Build oddiy kompilyatsiya emas:** u bazaning sxemasini ham o‘zgartirishi mumkin. Shu o‘rganishda build, migratsiya yoki `db push` bajarilmadi.

Muhit o‘zgaruvchilari: `DATABASE_URL` — baza ulanishi; `JWT_SECRET` — token imzolash kaliti; `JWT_EXPIRES_IN` — token muddati; `NODE_ENV` — muhit; `NEXT_PUBLIC_API_URL` — brauzer API manzili, berilmasa `/api`. `.env` va `.env_backup`da `CORS_ORIGIN` ham bor, ammo manba kodida undan foydalanish topilmadi.

Docker Compose ikkita xizmatni belgilaydi: PostgreSQL va ilova. Baza uchun doimiy volume va healthcheck mavjud. Ilova 3000-portda, baza 5432-portda ko‘rsatilgan. Dockerfile Node.js 20 asosida uch bosqichli builddan foydalanadi.

Hozirgi Docker konfiguratsiyasida nomuvofiqlik bor: Dockerfile `.next/standalone` natijasini nusxalaydi, ammo `next.config.ts`da `output: 'standalone'` kommentga olingan. Builder ichidagi `npm run build` bazaga ulanishni ham talab qiladi. Compose bazaning tayyor bo‘lishini ilova ishga tushishida kutadi; bu build bosqichidagi baza ulanishini avtomatik hal qilmaydi. Docker orqali ishga tushirish ushbu o‘rganishda sinovdan o‘tkazilmadi.

`.gitignore` muhit fayllarini yashiradi. `.dockerignore`da esa `.env*` chiqarib tashlanmagan; Docker builder bosqichidagi `COPY . .` ularni ham build kontekstidan olishi mumkin.

## 10. Aniqlangan kamchiliklar

Quyidagi xulosalar kodni o‘qish va TypeScript tekshiruviga asoslangan. Bularni tuzatish ushbu vazifa doirasida bajarilmadi.

### Birinchi navbatda ko‘rib chiqiladigan masalalar

1. **Tashkilot va rol ruxsatlari to‘liq nazorat qilinmagan.** Masalan, mahsulot/savdo APIlari tashkilot identifikatorini so‘rovdan oladi, ID bo‘yicha amallar esa ko‘pincha faqat token haqiqiyligini tekshiradi. Ombor qoldig‘i APIi `organizationId`ni umuman filtrga qo‘shmaydi. Boshqa biznes ma’lumotlarini ko‘rish yoki o‘zgartirish xavfi bor. `stores` ro‘yxati va do‘kon yaratishda ruxsat tekshiruvlari mavjud, ammo ular barcha yo‘llarga tatbiq etilmagan. Manbalar: `src/app/api/products/route.ts`, `sales/[id]/complete/route.ts`, `inventory/balances/route.ts`, `stores/route.ts`.

2. **Ayrim javoblarda parol xeshi ham qaytishi mumkin.** Tashkilot tafsilotida `users.user`, smena so‘rovlarida `organizationUser.user` to‘liq olinadi; xodim yaratish javobida ham to‘liq `user` beriladi. `passwordHash` foydalanuvchi modelining maydoni. Manbalar: `src/app/api/organizations/[id]/route.ts`, `organizations/[id]/users/route.ts`, `shifts/route.ts`, `shifts/[id]/route.ts`.

3. **Savdo hisobotida aniq xato bor.** `sale.items.length` ishlatilgan, ammo so‘rovda `items` yuklanmagan. Bo‘sh bo‘lmagan hisobot server xatosiga olib kelishi mumkin. TypeScript ham shu xatoni ko‘rsatdi. Manba: `src/app/api/reports/sales/route.ts`.

4. **Transfer yaratishda noto‘g‘ri Prisma ma’lumot shakli ishlatilgan.** `items` massivini bog‘langan qatorlar yaratish shakliga aylantirish yo‘q. TypeScript buni ham tasdiqladi. Manba: `src/app/api/transfers/route.ts`.

5. **Qoralama savdoni tahrirlash qatorlarni yo‘qotishi mumkin.** API avval barcha qatorlarni o‘chiradi; yangi `items` berilgan bo‘lsagina qayta yaratadi. Faqat izoh yoki mijozni yangilashda mahsulot qatorlari yo‘qoladi. Chegirmani alohida yangilashda jami summa qayta hisoblanmaydi; nol chegirma `||` sabab avvalgi qiymat bilan almashtirilishi mumkin. Manba: `src/app/api/sales/[id]/route.ts`.

6. **Savdo narxi va biznes qoidalari serverda yetarlicha nazorat qilinmaydi.** Mahsulot nomi, narxi, tannarxi, kassir va boshqa IDlar mijoz yuborgan qiymatdan olinadi. Chegirma chegaralari, nasiya uchun mijoz majburiyligi va kredit limiti serverda yakunlash jarayoniga to‘liq qo‘shilmagan. Frontend nasiya uchun mijoz talab qiladi, lekin APIga to‘g‘ridan-to‘g‘ri murojaat bu cheklovni chetlab o‘tishi mumkin. Manbalar: `src/app/api/sales/route.ts`, `sales/[id]/complete/route.ts`, `src/components/pos/PaymentModal.tsx`.

7. **Parallel amallar takroriy hisoblashga olib kelishi mumkin.** Savdo/hujjat/transfer holati tranzaksiyadan oldin tekshiriladi. Qoldiq tekshiruvi ham savdoni yakunlash tranzaksiyasidan tashqarida. Chek raqami yozuvlar sonidan olinadi; bir vaqtdagi so‘rovlar bir xil raqam yaratishi mumkin. Bir kassada bitta ochiq smena qoidasi bazada noyob indeks bilan mustahkamlanmagan. Transfer yuborishda yetarli qoldiq tekshirilmaydi; qoldiq yozuvi yo‘q bo‘lsa jo‘natuvchi balans yaratilmaydi. Manbalar: savdo, smena, hujjat tasdiqlash va transfer APIlari; `prisma/schema.prisma`.

### Hisob-kitob va foydalanishdagi cheklovlar

- Mahsulot hisobotida tannarx `jami miqdor × o‘rtacha unitCost` bilan hisoblanadi. Har qatorning `miqdor × tannarx` yig‘indisi bilan har doim teng emas. Umumiy chek chegirmasi mahsulot tushumiga taqsimlanmaydi. Manba: `src/app/api/reports/products/route.ts`.
- Hisobot APIlari standart 50 yozuvni qaytaradi. Frontend barcha sahifalarni yig‘maydi, CSV joriy yuklangan natijani chiqaradi. Savdo yig‘indilari ham olingan sahifa asosida hisoblanadi; katta davrning to‘liq jami sifatida qabul qilib bo‘lmaydi.
- Hisobotning tugash sanasi yarim tun sifatida olinadi; tanlangan oxirgi kundagi keyingi savdolar kirmasligi mumkin. Tashkilot vaqt zonasi sana hisobiga izchil tatbiq etilmagan.
- Dashboarddagi ochiq smena va kam qoldiq hisoblarida tashkilot filtri yo‘q. Do‘kon berilmasa boshqa tashkilot natijalari qo‘shilishi mumkin. Manba: `src/app/api/reports/dashboard/route.ts`.
- Kam qoldiq filtri sahifalashdan keyin qo‘llanadi; jami son va sahifalar butun bazadagi mos natijani aks ettirmaydi. Manba: `src/app/api/inventory/balances/route.ts`.
- Ro‘yxatdan o‘tish javobida `role` va `organizationUserId` yo‘q. Frontend menyu va smena ochish uchun ularni kutadi; profil qayta yuklanmaguncha ayrim amallar ishlamasligi mumkin. Hisob yaratishdagi ko‘p bosqichlar bitta umumiy tranzaksiyada emas.
- Nasiya undirish qarzni kamaytiradi, lekin naqd/karta tushumi va smena hisobini to‘liq bog‘lamaydi.
- SKU/barkodning bazadagi global noyobligi ko‘p tashkilotli ishlash talabiga mos kelmaydi.

### Texnik moslik

- `next.config.ts`dagi `ignoreBuildErrors: true` TypeScript xatolarini build vaqtida chetlab o‘tadi. Build chiqishi kodda tur xatolari yo‘qligini anglatmaydi.
- `prisma.config.ts` `prisma/config`dan import qiladi, ammo o‘rnatilgan Prisma 5.22.0 bilan bu modul TypeScript tomonidan topilmadi.
- Zod 4 o‘rnatilgan, ko‘p xato javoblarida `error.errors` ishlatilgan; TypeScript bu maydon mavjud emasligini ko‘rsatdi. Ombor hujjati yaratish APIida `error.issues` ishlatilgan.
- Prisma `Decimal` bilan to‘g‘ridan-to‘g‘ri arifmetika va JWT muddati turi bo‘yicha ham TypeScript xatolari bor.
- JWT kaliti berilmasa kod standart kalitga qaytadi. Compose konfiguratsiyasidagi kalit ham ishlab chiqarish muhiti uchun almashtirishni talab qiladigan namunaviy qiymat.
- Next.js va `eslint-config-next` versiyalari bir xil emas: 16.3.4 va 16.2.12. Ushbu farqning alohida ta’siri sinovdan o‘tkazilmadi.

## 11. Rejada bor, ammo to‘liq amalga oshmagan qismlar

| Imkoniyat | Hozirgi dalil |
| --- | --- |
| Original chek bo‘yicha to‘liq/qisman qaytarish va pulni qaytarish | Bazada modellar bor; qaytarish uchun alohida API/ekran oqimi topilmadi |
| Muhim amallar auditi | `AuditLog` modeli bor; `src` ichida auditga yozish topilmadi |
| Kassir chegirma limiti va administrator tasdig‘i | Boshlang‘ich siyosat yaratiladi; savdo jarayonida majburiy qo‘llash yo‘q |
| Bir chekka aralash to‘lov | API massiv qabul qiladi; to‘lov interfeysi bitta usul yuboradi |
| Xodimni tahrirlash, bloklash yoki olib tashlash | Tashkilot xodimlari APIida ro‘yxat va qo‘shish bor; alohida xodimni yangilash/o‘chirish yo‘li yo‘q |
| To‘liq ombor/smena/qarz hisobotlari va eksportlari | Alohida ma’lumot ekranlari bor; hisobot ekranida savdo va mahsulot tablari mavjud |
| Soliq hisoblash va to‘liq biznes sozlamalari | READMEda talab bor; soliq uchun alohida to‘liq mexanizm topilmadi |
| Offline kassa, mobil ilova, Click/Payme, fiskal qurilmalar | Hozirgi kodda integratsiya topilmadi |
| Avtomatik testlar | Loyihaga tegishli test fayllari va test skripti topilmadi |

## 12. Qanday tekshirildi?

Manba tuzilishi, sahifalar va komponentlar, context/hooklar, API amallari, Prisma sxemasi va boshlang‘ich migratsiyasi, paketlar, Docker, muhit o‘zgaruvchilari nomlari hamda mavjud hujjatlar ko‘rib chiqildi. Maxfiy muhit qiymatlari hujjatga kiritilmadi.

Quyidagi tekshiruv bajarildi:

```text
./node_modules/.bin/tsc --noEmit --incremental false --pretty false
```

Natija: **tekshiruv muvaffaqiyatsiz, chiqish kodi 2**. Prisma konfiguratsiyasi, Zod xatolari maydoni, Decimal arifmetikasi, savdo hisoboti, transfer yaratish va JWT turi bo‘yicha xatolar aniqlandi. Buyruq kompilyatsiya natijasini yoki incremental kesh faylini yozmadi.

Ilova serveri ishga tushirilmadi; brauzer, real baza, kamera, printer va Dockerda funksional sinov bajarilmadi. Shuning uchun hujjat koddan aniqlangan holatni ko‘rsatadi, ishlab turgan tizimning qabul sinovi o‘rnini bosmaydi.

## 13. Keyingi ishlar uchun tavsiya etilgan tartib

1. Barcha APIlarda tashkilot, do‘kon va rol nazoratini bir xil qilish; parol xeshini javoblardan chiqarish.
2. TypeScript va paket mosligi xatolarini, savdo hisoboti, transfer yaratish va qoralama tahririni tuzatish.
3. Savdo summalari, nasiya limiti, chegirma qoidalari va smena bilan bog‘liqlikni serverda qat’iy tekshirish.
4. Parallel savdo/hujjat tasdiqlash/smena ochishda takroriy yozish va manfiy qoldiqdan himoyani mustahkamlash.
5. Qarz undiruvi, kassa hisobi, foyda, davr filtrlari va to‘liq CSV eksportni moslashtirish.
6. Docker build va bazani yangilash tartibini aniqlashtirish.
7. Qaytarish, audit va qolgan rejalashtirilgan imkoniyatlarni tugatish; eng muhim savdo va ruxsat oqimlarini avtomatik sinov bilan tekshirish.

Loyihaning asosiy modullari va ma’lumotlar modeli shakllangan. Navbatdagi bosqichda eng katta foyda mavjud savdo, ruxsat va hisob-kitob jarayonlarini ishonchli qilishdan keladi.
