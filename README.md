# Shuni POS — MVP texnik topshiriq

Kichik va o‘rta bizneslar uchun brauzerda ishlovchi savdo va ombor boshqaruvi tizimi. MVPning vazifasi: kassada savdoni tez rasmiylashtirish, qoldiqni aniq yuritish va egaga kunlik moliyaviy ko‘rinish berish.

Amaldagi ishlab chiqish holati [EXECUTION_STATUS.md](tasks/EXECUTION_STATUS.md)da yuritiladi. Egasi `/products/import` orqali CSV/XLSXni oldindan tekshiradi, xato qatorlarni ko‘radi va yaroqli yangi mahsulotlarni tasdiqlaydi; mavjud narx/qoldiq avtomatik almashtirilmaydi. `/onboarding` har filialning haqiqiy import, tasdiqlangan boshlang‘ich qoldiq, kassir va odatiy savdo bosqichlarini qayta davom ettirish imkonini beradi. `/training` mashqi haqiqiy pul/qoldiqka ta’sir qilmaydi.

Chek oynasida mijoz roziligi bilan bir soatlik elektron chek QR/havolasi yaratiladi va bekor qilinadi. Egasi mijoz kartasida alohida shaxsan xizmat roziligini qayd etib, qarz ko‘chirmasini mavjud worker navbatiga qo‘yadi. Bu SMS/e-mail yetkazish yoki fiskal/hardware integratsiyasi emas; [ishlatish va xavfsizlik tartibi](docs/operations/shared-documents.md). Mahsulot rasmlari faqat protected ichki upload orqali ko‘rsatiladi; eski tashqi URL metadata saqlanadi, avtomatik yuklanmaydi. [Ma’lumot oqimlari reyestri](docs/operations/provider-data-flows.md) current first-party va disabled vendor chegaralarini ko‘rsatadi.

Savdo sahifasidagi “Tovar almashtirish” owner/admin uchun original qaytarish va yangi savdoni bir tranzaksiyada bog‘laydi. Naqd/nasiya farqi oldindan ko‘riladi; haqiqiy berilgan naqd va qaytim ikkala savdoda ko‘rinadi. Yetarli qoldiq yoki nasiya limiti bo‘lmasa qaytarish ham yozilmaydi. Noma’lum javobda saqlangan original amalni tekshiring. Bu oqim ichki naqd/nasiya uchun; real fiskal/Click/hardware integratsiyalari hozir ulanmagan.

`/security` hisobning90kunlik xavfsizlik/sessiya tarixini, shubhali kirish xabarlarini va o‘qilganlik holatini ko‘rsatadi. Bildirishnoma ichki inboxga jobs worker orqali atomik yetkaziladi; yetkazish xatosiga auditli cheklangan retry bor. Background badge sessiya idle muddatini uzaytirmaydi. 085/086 migration va worker ishga tushirish tartibi [OPERATIONS_RUNBOOK.md](tasks/OPERATIONS_RUNBOOK.md)da.

Owner `/jobs`da ichki hisob solishtirishni fon navbatiga qo‘yadi, xatoli ish tarixini ko‘radi va sabab bilan qayta tasdiqlaydi. `npm run worker:build`dan keyin `npm run worker:jobs` navbatni bajaradi; productionda worker ham alohida ishga tushiriladi. Uchta cheklangan urinish, lease/heartbeat va original idempotency kaliti duplicate natijani himoya qiladi. Batafsil ishga tushirish va tiklash tartibi [OPERATIONS_RUNBOOK.md](tasks/OPERATIONS_RUNBOOK.md)da.

## MVP doirasi

| Modul | MVPda bo‘ladi | Natija |
| --- | --- | --- |
| Tashkilot va do‘kon | Kompaniya, do‘kon va kassa yaratish | Bir biznesning bir nechta nuqtasi yuritiladi |
| Foydalanuvchilar | Egasi, administrator, kassir rollari | Har kim faqat vakolati doirasida ishlaydi |
| Katalog | Kategoriya, mahsulot, barkod, narx va minimal qoldiq | Savdoga tayyor mahsulotlar ro‘yxati |
| POS kassa | Skaner/qidiruv, savat, chegirma, to‘lov, chek | Savdo bir necha harakatda yakunlanadi |
| Ombor | Kirim, qaytarish, tuzatish va transfer | Qoldiq har doim hisoblanadi |
| Mijoz | Mijoz kartasi va qarzdorlik | Takroriy mijozlar va nasiya nazorati |
| Smena va kassa | Smenani ochish/yopish, naqd pul qoldig‘i | Kassir hisobdorligi |
| Hisobot | Savdo, to‘lov, mahsulot, qoldiq, foyda | Egaga operativ tahlil |
| Sozlamalar | Valyuta, soliq, chek rekvizitlari | Biznesga moslashtirilgan tizim |

MVPga kirmaydi: onlayn-do‘kon, mobil ilova, buxgalteriya integratsiyasi, yetkazib berish, bonus/loyallik ballari, ishlab chiqarish/retseptura hamda avtomatik tashqi fiskal yoki to‘lov provayderi integratsiyalari. Ular uchun keyinchalik kengaytma nuqtalari qoldiriladi.

## Rollar va ruxsatlar

| Amal | Egasi | Administrator | Kassir |
| --- | :---: | :---: | :---: |
| Barcha do‘konlar va hisobotlarni ko‘rish | ✓ | Belgilangan do‘konlar | — |
| Do‘kon, foydalanuvchi va umumiy sozlamalarni boshqarish | ✓ | Qisman | — |
| Mahsulot, narx va kategoriya boshqaruvi | ✓ | ✓ | Ko‘rish/qidirish |
| Kirim, transfer va inventar tuzatish | ✓ | ✓ | — |
| Smena ochish/yopish | ✓ | ✓ | ✓ |
| Savdo, qaytarish va chek chiqarish | ✓ | ✓ | ✓ |
| Chegirma qo‘llash | ✓ | Chegarasiz | Sozlamadagi limitgacha |
| Sotuvni bekor qilish yoki tahrirlash | ✓ | ✓ | Faqat yakunlanmaguncha |

## Asosiy funksional talablar

### Kirish va biznesni sozlash

- Telefon/e-mail va parol bilan ro‘yxatdan o‘tish hamda kirish.
- Birinchi kirishda tashkilot nomi, STIR (ixtiyoriy), valyuta (`UZS`), vaqt zonasi, do‘kon va boshlang‘ich kassa yaratiladi.
- Egasi foydalanuvchini taklif qiladi, unga rol va ishlashi mumkin bo‘lgan do‘konlarni belgilaydi.
- Parol xeshlangan holda saqlanadi; sessiya xavfsiz cookie yoki token orqali yuritiladi.

### Katalog va narxlar

- Kategoriya: nomi, tartib raqami va faol/nofaol holati.
- Mahsulot: nomi, SKU, barkod, kategoriya, o‘lchov birligi, sotuv narxi, tannarx, minimal qoldiq, rasm (ixtiyoriy), faol holati.
- SKU va barkod bitta tashkilot ichida takrorlanmaydi; barkod skaner kiritmasi sifatida ishlaydi.
- Mahsulot arxivi savdo tarixini buzmaydi: u o‘chirilmaydi, `is_active = false` qilinadi.
- Narx o‘zgarganda joriy mahsulot narxi yangilanadi; savdo qatorida esa o‘sha vaqtdagi narx nusxasi saqlanadi.

### POS kassa

- Kassir faqat bir ochiq smenada savdo qiladi.
- Mahsulot barkod orqali, nom/SKU orqali qidirib yoki tezkor katalogdan savatga qo‘shiladi.
- Savatdagi miqdor o‘zgartiriladi yoki qator olib tashlanadi; miqdor kasr bo‘lishi mumkinligi mahsulot birligiga bog‘liq.
- Har qatorga va/yoki butun chekka chegirma beriladi. Kassir chegirma limiti oshsa administrator tasdig‘i talab qilinadi.
- Mijoz ixtiyoriy tanlanadi. Nasiya savdoda mijoz majburiy.
- To‘lov turlari: naqd, karta, o‘tkazma va nasiya. Bir chekka bir nechta to‘lov turi bilan to‘lash mumkin.
- Yakunlashdan oldin qoldiq tekshiriladi; manfiy qoldiq faqat tashkilot sozlamasi ruxsat etsa mumkin.
- Yakunlangan savdo uchun noyob chek raqami yaratiladi, ombor harakati yoziladi, to‘lovlar kiritiladi va chop etishga mos chek ko‘rsatiladi.
- Qoralama savdo saqlanishi mumkin; yakunlangan savdo tahrir qilinmaydi.

### Qaytarish, bekor qilish va nasiya

- Savdo yakunlanmaguncha kassir uni bekor qilishi mumkin.
- Yakunlangan savdo bo‘yicha to‘liq yoki qisman qaytarish original chek qatorlariga bog‘langan holda bajariladi.
- Qaytarishda mahsulot qoldig‘i qayta oshadi; pul qaytarilishi `refund` turidagi to‘lov bilan yoziladi.
- Nasiya qarzi mijoz kesimida sotuv summasi minus nasiya to‘lovlari sifatida hisoblanadi.
- Qarzni undirish alohida to‘lov sifatida kiritiladi va hech qanday mahsulot qatorini yaratmaydi.

### Ombor va inventar

- Har bir do‘kon uchun mahsulot qoldig‘i alohida yuritiladi.
- Kirim: yetkazib beruvchi (ixtiyoriy), hujjat raqami, mahsulotlar, miqdor va tannarx.
- Chiqim/tuzatish: sabab, miqdor va izoh bilan; manfiy yoki musbat farq yoziladi.
- Do‘konlar orasidagi transfer jo‘natuvchi do‘kondan chiqim, qabul qiluvchi do‘konga kirim sifatida qayd etiladi.
- Qoldiq `inventory_movements` yozuvlari asosida yoki tezkorlik uchun `inventory_balances` jadvalida agregat ko‘rinishda yuritiladi. Har bir tasdiqlangan harakat ikkalasini bitta tranzaksiyada yangilaydi.
- Minimal qoldiqdan past mahsulotlar uchun dashboard ogohlantirishi chiqariladi.

### Smena va kassa nazorati

- Kassir smenani boshlang‘ich naqd summa bilan ochadi.
- Har kassa uchun bir paytda faqat bitta ochiq smena bo‘lishi mumkin.
- Smena davomida naqd pul kiritish/olish (`cash_in`, `cash_out`) sabab va izoh bilan qayd qilinadi.
- Yopishda tizim kutayotgan naqd summa va kassir sanagan summa solishtiriladi; farq saqlanadi.
- Yopilgan smena qayta tahrir qilinmaydi.

### Hisobotlar

| Hisobot | Filtrlar | Asosiy ko‘rsatkichlar |
| --- | --- | --- |
| Dashboard | Sana, do‘kon | Bugungi savdo, chek soni, o‘rtacha chek, naqd/karta, ochiq smenalar, kam qoldiq |
| Savdolar | Davr, do‘kon, kassir, holat, to‘lov turi | Chek raqami, summa, chegirma, to‘lov, qaytarish |
| Mahsulotlar | Davr, do‘kon, kategoriya | Sotilgan miqdor, tushum, tannarx, yalpi foyda |
| Ombor qoldig‘i | Do‘kon, kategoriya, kam qoldiq | Joriy qoldiq, qiymat, minimal qoldiq |
| Kassa/smena | Davr, kassa, kassir | Boshlang‘ich, kutilgan, sanalgan summa, farq |
| Mijoz qarzlari | Mijoz, do‘kon | Jami qarz, oxirgi savdo, oxirgi to‘lov |

Hisobotlar ekranda ko‘rinadi va CSV formatida yuklab olinadi. Yalpi foyda = sotuv qatorlari summasi − sotuv vaqtida saqlangan tannarx.

## Asosiy ish oqimlari

```text
Smena ochish → mahsulot tanlash → savat → mijoz/to‘lov tanlash
→ savdoni yakunlash → to‘lov + chek + ombor chiqimi → hisobotlar

Kirim/tuzatish/transfer → ombor harakati → qoldiq yangilanishi
Qaytarish → qaytarma chek + refund → ombor qoldig‘i oshishi
```

## Ma’lumotlar modeli

Quyidagi sxema PostgreSQL uchun mo‘ljallangan. Pul qiymatlari `numeric(14,2)`, miqdorlar `numeric(14,3)` turida saqlanadi. Barcha jadvalda `id UUID`, `created_at timestamptz`, zarur joyda `updated_at timestamptz` mavjud deb qabul qilinadi.

### Tashkilot va kirish

| Jadval | Ustunlar | Izoh |
| --- | --- | --- |
| `organizations` | `id`, `name`, `tin`, `phone`, `currency_code`, `timezone`, `allow_negative_stock`, `receipt_footer`, `created_at` | Tenant/biznes chegarasi |
| `users` | `id`, `full_name`, `phone`, `email`, `password_hash`, `is_active`, `last_login_at`, `created_at` | Global foydalanuvchi profili; `phone` va `email` noyob |
| `organization_users` | `id`, `organization_id FK`, `user_id FK`, `role`, `is_active`, `created_at` | Rol: `owner`, `admin`, `cashier`; `(organization_id, user_id)` noyob |
| `stores` | `id`, `organization_id FK`, `name`, `address`, `phone`, `is_active`, `created_at`, `updated_at` | Savdo nuqtasi |
| `user_stores` | `organization_user_id FK`, `store_id FK` | Administrator/kassirga ruxsatli do‘konlar; juftlik noyob |
| `registers` | `id`, `store_id FK`, `name`, `code`, `is_active`, `created_at` | Kassa terminali; `(store_id, code)` noyob |

### Katalog va hamkorlar

| Jadval | Ustunlar | Izoh |
| --- | --- | --- |
| `categories` | `id`, `organization_id FK`, `name`, `sort_order`, `is_active`, `created_at`, `updated_at` | Kategoriya; tashkilot ichida nom noyob |
| `products` | `id`, `organization_id FK`, `category_id FK nullable`, `name`, `sku`, `barcode`, `unit`, `sale_price`, `cost_price`, `min_stock`, `image_url`, `is_active`, `created_at`, `updated_at` | `sku`/`barcode` tashkilot bo‘yicha noyob; `unit`: dona, kg, litr va h.k. |
| `customers` | `id`, `organization_id FK`, `full_name`, `phone`, `address`, `note`, `credit_limit`, `is_active`, `created_at`, `updated_at` | Mijoz va nasiya limiti; telefon bo‘yicha indeks |
| `suppliers` | `id`, `organization_id FK`, `name`, `phone`, `tin`, `address`, `note`, `is_active`, `created_at`, `updated_at` | Kirim manbasi |

### Ombor

| Jadval | Ustunlar | Izoh |
| --- | --- | --- |
| `stock_documents` | `id`, `organization_id FK`, `store_id FK`, `supplier_id FK nullable`, `document_type`, `document_no`, `status`, `note`, `created_by FK`, `confirmed_by FK nullable`, `confirmed_at`, `created_at` | `document_type`: `purchase`, `adjustment`, `transfer_out`, `transfer_in`, `return_in`; faqat `confirmed` hujjat qoldiqni o‘zgartiradi |
| `stock_document_items` | `id`, `stock_document_id FK`, `product_id FK`, `quantity`, `unit_cost`, `note`, `created_at` | Hujjat qatorlari; miqdor musbat, yo‘nalishni hujjat turi belgilaydi |
| `inventory_movements` | `id`, `organization_id FK`, `store_id FK`, `product_id FK`, `movement_type`, `quantity_delta`, `unit_cost`, `source_type`, `source_id`, `occurred_at`, `created_by FK`, `note` | O‘zgarmas audit jurnali; `quantity_delta` ±; `source_type`: sale, return, stock_document |
| `inventory_balances` | `store_id FK`, `product_id FK`, `quantity`, `updated_at` | Tezkor joriy qoldiq; PK `(store_id, product_id)` |
| `stock_transfers` | `id`, `organization_id FK`, `from_store_id FK`, `to_store_id FK`, `status`, `note`, `created_by FK`, `sent_at`, `received_at`, `created_at` | Transfer sarlavhasi; `from_store_id != to_store_id` |
| `stock_transfer_items` | `id`, `stock_transfer_id FK`, `product_id FK`, `quantity`, `unit_cost` | Transfer mahsulotlari |

### Savdo, to‘lov va kassa

| Jadval | Ustunlar | Izoh |
| --- | --- | --- |
| `shifts` | `id`, `register_id FK`, `organization_user_id FK`, `opened_at`, `opening_cash`, `closed_at nullable`, `expected_cash nullable`, `counted_cash nullable`, `cash_difference nullable`, `status`, `note` | `status`: `open`, `closed`; kassa uchun bitta ochiq smena |
| `cash_movements` | `id`, `shift_id FK`, `movement_type`, `amount`, `reason`, `created_by FK`, `created_at` | `cash_in` yoki `cash_out`; savdo to‘lovlaridan alohida |
| `sales` | `id`, `organization_id FK`, `store_id FK`, `register_id FK`, `shift_id FK`, `cashier_id FK`, `customer_id FK nullable`, `receipt_no`, `status`, `subtotal`, `discount_amount`, `total_amount`, `note`, `completed_at nullable`, `voided_at nullable`, `voided_by FK nullable`, `created_at` | `status`: `draft`, `completed`, `voided`, `partially_returned`, `returned`; `(register_id, receipt_no)` noyob |
| `sale_items` | `id`, `sale_id FK`, `product_id FK`, `product_name`, `sku`, `quantity`, `unit_price`, `discount_amount`, `line_total`, `unit_cost`, `created_at` | Tarix buzilmasligi uchun nom, SKU, narx va tannarx nusxalanadi |
| `payments` | `id`, `organization_id FK`, `store_id FK`, `shift_id FK nullable`, `sale_id FK nullable`, `customer_id FK nullable`, `payment_type`, `direction`, `amount`, `reference_no`, `paid_at`, `received_by FK`, `note`, `created_at` | `payment_type`: `cash`, `card`, `transfer`, `credit`; `direction`: `in`, `out`; nasiya undiruvida `sale_id` bo‘sh bo‘lishi mumkin |
| `sale_returns` | `id`, `sale_id FK`, `return_receipt_no`, `status`, `refund_amount`, `reason`, `processed_by FK`, `returned_at`, `created_at` | Original savdoga bog‘langan qaytarish |
| `sale_return_items` | `id`, `sale_return_id FK`, `sale_item_id FK`, `product_id FK`, `quantity`, `unit_price`, `line_total` | Miqdor original sotilgan miqdordan oshmasligi kerak |

### Nazorat va servis

| Jadval | Ustunlar | Izoh |
| --- | --- | --- |
| `discount_policies` | `id`, `organization_id FK`, `cashier_max_percent`, `admin_max_percent`, `require_reason_from_percent`, `is_active`, `updated_at` | Chegirma cheklovlari |
| `audit_logs` | `id`, `organization_id FK`, `actor_id FK nullable`, `entity_type`, `entity_id`, `action`, `before_data jsonb`, `after_data jsonb`, `ip_address`, `created_at` | Muhim o‘zgarishlar: narx, qaytarish, smena, ombor va ruxsatlar |

## Ma’lumotlar yaxlitligi qoidalari

- Barcha biznes ma’lumotlari `organization_id` orqali ajratiladi; so‘rovlarda tenant filtri majburiy.
- Savdo yakunlash, qaytarish, ombor hujjatini tasdiqlash va smena yopish bitta ma’lumotlar bazasi tranzaksiyasida bajariladi.
- `completed` savdo qatorlari, to‘lovlari va ombor harakatlari o‘chirilmaydi; tuzatish faqat qaytarish yoki qarshi yozuv bilan qilinadi.
- `payments` summasi yakunlangan savdo uchun `total_amount`ga teng bo‘lishi kerak; nasiya qismi ham to‘lov sifatida yoziladi.
- Nasiya savdosida mijozning yangi qarzi `credit_limit`dan oshmasligi kerak (egasi/admin tasdig‘i bo‘lmasa).
- `sale_return_items.quantity` original qator bo‘yicha avval qaytarilgan miqdorni hisobga olganda sotilgan miqdordan katta bo‘lmaydi.
- Qoldiq va `inventory_movements` izchil bo‘lishi uchun savdo/ombor yozuvlari ketma-ket bloklash yoki atomik update bilan ishlaydi.

## Tavsiya etilgan ekranlar

| Ekran | Maqsad |
| --- | --- |
| Kirish / ro‘yxatdan o‘tish | Hisob yaratish va autentifikatsiya |
| Birlamchi sozlash | Tashkilot, do‘kon, kassa yaratish |
| Dashboard | Kunlik ko‘rsatkichlar va ogohlantirishlar |
| POS | Tez savdo va chek chiqarish |
| Savdolar | Chek qidirish, tafsilot va qaytarish |
| Mahsulotlar / kategoriyalar | Katalog va narxlar boshqaruvi |
| Ombor | Qoldiq, kirim, tuzatish, transfer |
| Mijozlar | Mijoz profili, savdo tarixi, qarz undirish |
| Smenalar | Ochish/yopish va kassa harakatlari |
| Hisobotlar | Filtr, jadval va CSV eksport |
| Sozlamalar | Do‘konlar, kassalar, foydalanuvchilar, chegirma siyosati |

## Qabul mezonlari

1. Kassir mahsulotni barkod yoki qidiruv orqali topib, ochiq smenada 3 soniyadan kam vaqtda chekni yakunlay oladi (oddiy lokal tarmoq sharoitida).
2. Yakunlangan savdo qoldiqni kamaytiradi; qisman qaytarish aynan qaytarilgan miqdorga qoldiqni oshiradi.
3. Har bir savdo, qaytarish, kirim va kassa farqi kim va qachon qilgani bilan auditga tushadi.
4. Do‘kon A foydalanuvchisi Do‘kon B qoldig‘i yoki savdosini ruxsatsiz ko‘ra/yangilay olmaydi.
5. Savdo hisobotidagi tushum, to‘lovlar va smena hisoboti bir xil davr/do‘kon uchun o‘zaro mos keladi.
6. CSV eksporti ekrandagi faol filtrlarni to‘liq aks ettiradi.

## Keyingi bosqich uchun kengaytmalar

- Click/Payme/terminal/fiskal printer integratsiyasi va QR-chek.
- Yetkazib beruvchiga buyurtma, xarid narxi tarixi va partiya/yaroqlilik muddati.
- Telegram bildirishnomalari, sodiqlik dasturi va promo-kodlar.
- Filiallar bo‘yicha analitika, xodim KPI va rejalashtirilgan hisobotlar.
- Offline-first kassa hamda mobil ilova.

## Backend arxitekturasi

### Texnologiya stack

- **Backend framework**: Node.js + Express.js yoki Fastify
- **Database**: PostgreSQL 15 (docker-compose orqali ishlaydi)
- **ORM**: Prisma yoki TypeORM
- **Authentication**: JWT token + bcrypt
- **Validation**: Zod yoki Joi
- **API Documentation**: Swagger/OpenAPI
- **CORS**: cors middleware
- **Rate limiting**: express-rate-limit
- **Logging**: Winston yoki Pino
- **Environment variables**: dotenv

### API arxitekturasi

**REST API** quyidagi prinsiplar asosida ishlaydi:

- Base URL: `/api/v1`
- JSON formatida ma'lumot almashinuvi
- Authentication: Bearer token (JWT)
- Tenant isolation: `organization_id` header orqali
- Error handling: uniform error response format
- Pagination: `page` va `limit` parametrlari
- Filtering, sorting, searching: query parametrlar

### Authentication & Authorization

**Auth endpoints:**
- `POST /api/v1/auth/register` - Ro'yxatdan o'tish
- `POST /api/v1/auth/login` - Tizimga kirish
- `POST /api/v1/auth/logout` - Tizimdan chiqish
- `POST /api/v1/auth/refresh` - Token yangilash
- `GET /api/v1/auth/me` - Joriy foydalanuvchi ma'lumotlari

**Middleware:**
- `authMiddleware` - JWT token tekshirish
- `roleMiddleware` - Rolga asoslangan ruxsatlar
- `tenantMiddleware` - Organization filtr

### API endpoints

#### Organization & Users
- `GET /api/v1/organizations` - Tashkilotlar ro'yxati (egasi uchun)
- `POST /api/v1/organizations` - Yangi tashkilot yaratish
- `GET /api/v1/organizations/:id` - Tashkilot tafsilotlari
- `PUT /api/v1/organizations/:id` - Tashkilot yangilash
- `GET /api/v1/organizations/:id/users` - Foydalanuvchilar ro'yxati
- `POST /api/v1/organizations/:id/users` - Foydalanuvchi qo'shish
- `PUT /api/v1/organizations/:id/users/:userId` - Foydalanuvchi yangilash
- `DELETE /api/v1/organizations/:id/users/:userId` - Foydalanuvchi o'chirish

#### Stores & Registers
- `GET /api/v1/stores` - Do'konlar ro'yxati
- `POST /api/v1/stores` - Yangi do'kon yaratish
- `GET /api/v1/stores/:id` - Do'kon tafsilotlari
- `PUT /api/v1/stores/:id` - Do'kon yangilash
- `DELETE /api/v1/stores/:id` - Do'kon o'chirish
- `GET /api/v1/stores/:id/registers` - Kassalar ro'yxati
- `POST /api/v1/stores/:id/registers` - Yangi kassa yaratish
- `PUT /api/v1/registers/:id` - Kassa yangilash

#### Categories & Products
- `GET /api/v1/categories` - Kategoriyalar ro'yxati
- `POST /api/v1/categories` - Yangi kategoriya yaratish
- `PUT /api/v1/categories/:id` - Kategoriya yangilash
- `DELETE /api/v1/categories/:id` - Kategoriya o'chirish (soft delete)
- `GET /api/v1/products` - Mahsulotlar ro'yxati (filter, search, pagination)
- `POST /api/v1/products` - Yangi mahsulot yaratish
- `GET /api/v1/products/:id` - Mahsulot tafsilotlari
- `PUT /api/v1/products/:id` - Mahsulot yangilash
- `DELETE /api/v1/products/:id` - Mahsulot o'chirish (soft delete)
- `GET /api/v1/products/barcode/:barcode` - Barkod bo'yicha qidirish

#### Customers & Suppliers
- `GET /api/v1/customers` - Mijozlar ro'yxati
- `POST /api/v1/customers` - Yangi mijoz yaratish
- `GET /api/v1/customers/:id` - Mijoz tafsilotlari
- `PUT /api/v1/customers/:id` - Mijoz yangilash
- `DELETE /api/v1/customers/:id` - Mijoz o'chirish (soft delete)
- `GET /api/v1/customers/:id/debt` - Mijoz qarzi
- `GET /api/v1/suppliers` - Yetkazib beruvchilar ro'yxati
- `POST /api/v1/suppliers` - Yangi yetkazib beruvchi yaratish
- `PUT /api/v1/suppliers/:id` - Yetkazib beruvchi yangilash

#### POS & Sales
- `GET /api/v1/shifts` - Smenalar ro'yxati
- `POST /api/v1/shifts/open` - Smena ochish
- `POST /api/v1/shifts/:id/close` - Smena yopish
- `GET /api/v1/shifts/:id` - Smena tafsilotlari
- `POST /api/v1/shifts/:id/cash-movements` - Naqd pul harakati
- `GET /api/v1/sales` - Savdolar ro'yxati
- `POST /api/v1/sales` - Yangi savdo yaratish (draft)
- `GET /api/v1/sales/:id` - Savdo tafsilotlari
- `PUT /api/v1/sales/:id` - Savdo yangilash (faqat draft)
- `POST /api/v1/sales/:id/complete` - Savdoni yakunlash
- `POST /api/v1/sales/:id/void` - Savdoni bekor qilish
- `POST /api/v1/sales/:id/return` - Savdodan qaytarish
- `GET /api/v1/sales/:id/receipt` - Chek ma'lumotlari

#### Inventory
- `GET /api/v1/stock-documents` - Ombor hujjatlari ro'yxati
- `POST /api/v1/stock-documents` - Yangi hujjat yaratish
- `GET /api/v1/stock-documents/:id` - Hujjat tafsilotlari
- `PUT /api/v1/stock-documents/:id` - Hujjat yangilash
- `POST /api/v1/stock-documents/:id/confirm` - Hujjatni tasdiqlash
- `GET /api/v1/inventory/balances` - Qoldiq balansi
- `GET /api/v1/inventory/movements` - Ombor harakatlari tarixi
- `GET /api/v1/transfers` - Transferlar ro'yxati
- `POST /api/v1/transfers` - Yangi transfer yaratish
- `POST /api/v1/transfers/:id/send` - Transferni yuborish
- `POST /api/v1/transfers/:id/receive` - Transferni qabul qilish

#### Payments
- `GET /api/v1/payments` - To'lovlar ro'yxati
- `POST /api/v1/payments` - Yangi to'lov yaratish
- `POST /api/v1/payments/credit` - Nasiya undirish
- `GET /api/v1/payments/:id` - To'lov tafsilotlari

#### Reports
- `GET /api/v1/reports/dashboard` - Dashboard ma'lumotlari
- `GET /api/v1/reports/sales` - Savdo hisoboti
- `GET /api/v1/reports/products` - Mahsulot hisoboti
- `GET /api/v1/reports/inventory` - Ombor hisoboti
- `GET /api/v1/reports/shifts` - Smena hisoboti
- `GET /api/v1/reports/customers-debt` - Mijoz qarzlari hisoboti
- `GET /api/v1/reports/export` - CSV eksport

#### Settings
- `GET /api/v1/settings/discount-policies` - Chegirma siyosati
- `PUT /api/v1/settings/discount-policies` - Chegirma siyosatini yangilash
- `GET /api/v1/settings/organization` - Tashkilot sozlamalari
- `PUT /api/v1/settings/organization` - Tashkilot sozlamalarini yangilash

### Ma'lumotlar bazasi ulanishi

**Prisma schema structure:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Models based on the database schema defined above
```

**Environment variables:**
```env
DATABASE_URL="postgresql://pos_user:pos_password@localhost:5432/pos_db"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
NODE_ENV="development"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
```

### API response format

**Success response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operatsiya muvaffaqiyatli yakunlandi"
}
```

**Error response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Ma'lumotlar noto'g'ri",
    "details": [ ... ]
  }
}
```

### Security considerations

- Barcha API endpointlar (authdan tashqari) authentication talab qiladi
- Role-based access control (RBAC) implementatsiya qilinadi
- Rate limiting har bir endpoint uchun sozlanadi
- Input validation barcha requestlar uchun majburiy
- SQL injection prevention (ORM parameterized queries)
- XSS protection
- CORS properly configured
- Security headers (helmet middleware)
- Sensitive data loggingdan chiqariladi

### Project structure

```
backend/
├── src/
│   ├── controllers/      # Request handlers
│   ├── middleware/      # Auth, validation, error handling
│   ├── models/          # Database models (Prisma)
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Helper functions
│   ├── validators/      # Request validation schemas
│   └── app.ts           # Express app setup
├── prisma/
│   └── schema.prisma    # Database schema
├── tests/               # API tests
└── package.json
```

### Development workflow

1. Database start: `docker-compose up -d`
2. Migrations: `npx prisma migrate dev`
3. Generate Prisma client: `npx prisma generate`
4. Development server: `npm run dev`
5. API documentation: `http://localhost:3001/api-docs`

## Frontend arxitekturasi

### Texnologiya stack

- **Framework**: Next.js 16.2.12 (App Router)
- **UI Library**: React 19.2.4
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Icons**: FontAwesome 7.3.1
- **State Management**: React Context API + useState/useReducer
- **Form Handling**: React controlled components
- **HTTP Client**: Fetch API
- **Authentication**: JWT token (localStorage/cookie)
- **Routing**: Next.js App Router (file-based routing)
- **Type Safety**: TypeScript with strict mode
- **Build Tool**: Next.js built-in bundler
- **Development**: ESLint, TypeScript strict mode

### Application Architecture

**Component-based architecture** quyidagi prinsiplar asosida:

- **Atomic Design Pattern**: Atoms, Molecules, Organisms, Templates, Pages
- **Container/Presenter Pattern**: Logic vs UI separation
- **Custom Hooks**: Reusable stateful logic
- **Context Providers**: Global state management
- **Server Components**: Performance optimization
- **Client Components**: Interactive UI elements

### Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Auth route group
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (dashboard)/             # Dashboard route group
│   │   ├── layout.tsx           # Dashboard layout
│   │   ├── page.tsx             # Dashboard home
│   │   ├── pos/
│   │   │   └── page.tsx         # POS interface
│   │   ├── sales/
│   │   │   ├── page.tsx         # Sales list
│   │   │   └── [id]/
│   │   │       └── page.tsx     # Sale details
│   │   ├── products/
│   │   │   ├── page.tsx         # Products list
│   │   │   └── [id]/
│   │   │       └── page.tsx     # Product details
│   │   ├── inventory/
│   │   │   ├── page.tsx         # Inventory management
│   │   │   └── transfers/
│   │   │       └── page.tsx     # Stock transfers
│   │   ├── customers/
│   │   │   ├── page.tsx         # Customers list
│   │   │   └── [id]/
│   │   │       └── page.tsx     # Customer details
│   │   ├── shifts/
│   │   │   └── page.tsx         # Shift management
│   │   ├── reports/
│   │   │   ├── page.tsx         # Reports overview
│   │   │   └── [type]/
│   │   │       └── page.tsx     # Specific report
│   │   └── settings/
│   │       ├── page.tsx         # Settings overview
│   │       ├── organization/
│   │       │   └── page.tsx     # Organization settings
│   │       ├── stores/
│   │       │   └── page.tsx     # Store management
│   │       ├── users/
│   │       │   └── page.tsx     # User management
│   │       └── discounts/
│   │           └── page.tsx     # Discount policies
│   ├── api/                     # API routes (if needed)
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing page
│   └── globals.css              # Global styles
├── components/                  # Reusable components
│   ├── ui/                      # UI components (atoms)
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Modal.tsx
│   │   ├── Table.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── DatePicker.tsx
│   │   └── LoadingSpinner.tsx
│   ├── forms/                   # Form components
│   │   ├── LoginForm.tsx
│   │   ├── ProductForm.tsx
│   │   ├── CustomerForm.tsx
│   │   └── StockDocumentForm.tsx
│   ├── layouts/                 # Layout components
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Footer.tsx
│   │   └── DashboardLayout.tsx
│   ├── pos/                     # POS-specific components
│   │   ├── ProductSearch.tsx
│   │   ├── Cart.tsx
│   │   ├── CartItem.tsx
│   │   ├── PaymentModal.tsx
│   │   ├── ReceiptPreview.tsx
│   │   └── CustomerSelector.tsx
│   ├── tables/                  # Table components
│   │   ├── SalesTable.tsx
│   │   ├── ProductsTable.tsx
│   │   ├── InventoryTable.tsx
│   │   └── CustomersTable.tsx
│   └── charts/                  # Chart components
│       ├── SalesChart.tsx
│       ├── RevenueChart.tsx
│       └── InventoryChart.tsx
├── lib/                         # Utility functions
│   ├── api.ts                   # API client
│   ├── auth.ts                  # Auth utilities
│   ├── format.ts                # Formatting functions
│   ├── validation.ts            # Validation schemas
│   └── constants.ts             # App constants
├── hooks/                       # Custom React hooks
│   ├── useAuth.ts               # Authentication hook
│   ├── useCart.ts               # Cart management
│   ├── useProducts.ts           # Products data
│   ├── useInventory.ts          # Inventory data
│   ├── useDebounce.ts           # Debounce utility
│   └── useLocalStorage.ts       # Local storage hook
├── context/                     # React Context providers
│   ├── AuthContext.tsx          # Authentication context
│   ├── OrganizationContext.tsx  # Organization context
│   ├── ThemeContext.tsx         # Theme context
│   └── NotificationContext.tsx  # Notification context
├── types/                       # TypeScript types
│   ├── api.types.ts             # API response types
│   ├── auth.types.ts            # Auth types
│   ├── product.types.ts         # Product types
│   ├── sale.types.ts            # Sale types
│   ├── inventory.types.ts       # Inventory types
│   └── common.types.ts          # Common types
├── utils/                       # Helper functions
│   ├── date.utils.ts            # Date utilities
│   ├── currency.utils.ts        # Currency formatting
│   ├── validation.utils.ts      # Validation helpers
│   └── api.utils.ts             # API helpers
└── dictionary/                  # Internationalization
    ├── uz.json                  # Uzbek translations
    └── ru.json                  # Russian translations
```

### Design System

#### Color Palette

**Primary Colors:**
- Primary Blue: `#3B82F6` (blue-500)
- Primary Dark: `#1E40AF` (blue-800)
- Primary Light: `#93C5FD` (blue-300)

**Secondary Colors:**
- Success Green: `#10B981` (emerald-500)
- Warning Orange: `#F59E0B` (amber-500)
- Error Red: `#EF4444` (red-500)
- Info Blue: `#06B6D4` (cyan-500)

**Neutral Colors:**
- White: `#FFFFFF`
- Light Gray: `#F3F4F6` (gray-100)
- Medium Gray: `#9CA3AF` (gray-400)
- Dark Gray: `#4B5563` (gray-600)
- Black: `#111827` (gray-900)

#### Typography

**Font Family:**
- Primary: Inter or system-ui
- Monospace: JetBrains Mono or monospace

**Font Sizes:**
- Text-xs: 0.75rem (12px)
- Text-sm: 0.875rem (14px)
- Text-base: 1rem (16px)
- Text-lg: 1.125rem (18px)
- Text-xl: 1.25rem (20px)
- Text-2xl: 1.5rem (24px)
- Text-3xl: 1.875rem (30px)
- Text-4xl: 2.25rem (36px)

**Font Weights:**
- Normal: 400
- Medium: 500
- Semibold: 600
- Bold: 700

#### Spacing System

**Scale:** 4px base unit
- xs: 0.25rem (4px)
- sm: 0.5rem (8px)
- md: 1rem (16px)
- lg: 1.5rem (24px)
- xl: 2rem (32px)
- 2xl: 3rem (48px)
- 3xl: 4rem (64px)

#### Border Radius

- sm: 0.25rem (4px)
- md: 0.375rem (6px)
- lg: 0.5rem (8px)
- xl: 0.75rem (12px)
- full: 9999px

#### Shadows

- sm: `0 1px 2px 0 rgb(0 0 0 / 0.05)`
- md: `0 4px 6px -1px rgb(0 0 0 / 0.1)`
- lg: `0 10px 15px -3px rgb(0 0 0 / 0.1)`
- xl: `0 20px 25px -5px rgb(0 0 0 / 0.1)`

### Key Components Specifications

#### 1. Authentication Components

**LoginForm Component:**
- Phone/email input with validation
- Password input with show/hide toggle
- Remember me checkbox
- Submit button with loading state
- Error message display
- Link to registration page

**RegisterForm Component:**
- Full name input
- Phone input with format validation
- Email input (optional)
- Password input with strength indicator
- Confirm password input
- Organization setup wizard
- Terms and conditions checkbox

#### 2. Dashboard Layout

**DashboardLayout Component:**
- Responsive sidebar with navigation
- Header with user info and notifications
- Main content area with max-width
- Breadcrumb navigation
- Mobile menu toggle
- Organization selector
- Theme toggle (optional)

**Sidebar Component:**
- Navigation menu with icons
- Active state highlighting
- Role-based menu items
- Collapse/expand functionality
- Logo and organization name
- User profile section

#### 3. POS Interface

**POSPage Component:**
- Product search with barcode scanning
- Category quick filters
- Product grid/list view
- Shopping cart panel
- Customer selector
- Discount application
- Payment methods selection
- Receipt preview
- Quick actions (hold, void, return)

**ProductSearch Component:**
- Search input with debounce
- Barcode scanner integration
- Recent products display
- Category filter dropdown
- Search results with images
- Keyboard navigation support

**Cart Component:**
- Cart items list with quantity controls
- Line item editing
- Remove item functionality
- Subtotal calculation
- Discount display
- Tax calculation
- Total amount display
- Quick add buttons

**PaymentModal Component:**
- Payment method selection (cash, card, transfer, credit)
- Amount input with validation
- Change calculation for cash payments
- Multiple payment methods support
- Payment confirmation
- Receipt generation options

#### 4. Data Tables

**GenericTable Component:**
- Sortable columns
- Filterable rows
- Pagination
- Row selection
- Bulk actions
- Export functionality
- Responsive design
- Loading state
- Empty state

**SalesTable Component:**
- Receipt number column
- Date and time
- Customer name
- Total amount
- Payment methods
- Status badges
- Action buttons (view, return, print)
- Filters by date, status, cashier

#### 5. Forms

**ProductForm Component:**
- Product name input
- SKU input with uniqueness check
- Barcode input with scanner support
- Category selection
- Unit selection (dona, kg, litr, etc.)
- Sale price input
- Cost price input
- Minimum stock input
- Image upload with preview
- Active status toggle
- Validation with error messages

**CustomerForm Component:**
- Full name input
- Phone input with format validation
- Address input
- Credit limit input
- Notes textarea
- Active status toggle
- Purchase history display

#### 6. Dashboard Components

**DashboardCards Component:**
- Today's sales card
- Number of receipts card
- Average check amount card
- Cash vs card ratio card
- Open shifts indicator
- Low stock alerts
- Revenue trend chart
- Top products list

**RevenueChart Component:**
- Line chart for daily/weekly/monthly revenue
- Bar chart for comparison
- Date range selector
- Export as image
- Interactive tooltips
- Responsive sizing

### State Management Strategy

**Global State (Context API):**
- `AuthContext`: User authentication state, permissions
- `OrganizationContext`: Current organization, store, register
- `ThemeContext`: Theme preferences, color scheme
- `NotificationContext`: Toast notifications, alerts

**Local State (useState/useReducer):**
- Component-specific state
- Form state
- UI state (modals, dropdowns)
- Temporary data

**Server State (Fetch API):**
- API data caching
- Automatic refetching
- Loading and error states

### API Integration

**API Client Structure:**
```typescript
// lib/api.ts
class ApiClient {
  private baseURL: string;
  private token: string | null;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    this.token = localStorage.getItem('token');
  }

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // Implementation with error handling, token refresh, etc.
  }

  // Specific methods for each endpoint
  auth: AuthAPI;
  products: ProductsAPI;
  sales: SalesAPI;
  // etc.
}
```

**Error Handling:**
- Global error boundary
- API error interceptor
- User-friendly error messages
- Retry logic for failed requests
- Network error detection

### Performance Optimization

**Code Splitting:**
- Dynamic imports for heavy components
- Route-based code splitting
- Lazy loading for charts and heavy libraries

**Image Optimization:**
- Next.js Image component
- Responsive images
- WebP format
- Lazy loading

**Caching Strategy:**
- API response caching
- Static page generation where possible
- Service worker for offline support (future)

**Bundle Optimization:**
- Tree shaking
- Minification
- Compression
- CDN for static assets

### Accessibility

**WCAG 2.1 AA Compliance:**
- Semantic HTML
- ARIA labels and roles
- Keyboard navigation
- Focus management
- Color contrast ratios
- Screen reader support
- Alt text for images
- Error announcements

### Responsive Design

**Breakpoints:**
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

**Mobile-First Approach:**
- Touch-friendly UI elements
- Swipe gestures for navigation
- Optimized forms for mobile
- Bottom navigation for mobile
- Hamburger menu for navigation

### Internationalization (i18n)

**Supported Languages:**
- Uzbek (primary)
- Russian (secondary)

**Implementation:**
- Dictionary-based translations
- Language switcher component
- Date/time localization
- Currency formatting
- Number formatting

### Security Considerations

**Client-Side Security:**
- XSS prevention
- CSRF protection
- Secure token storage
- Input sanitization
- Content Security Policy
- HTTPS enforcement

**Data Protection:**
- Sensitive data encryption
- Secure local storage usage
- Token expiration handling
- Session management

### Testing Strategy

**Unit Testing:**
- Component testing with React Testing Library
- Hook testing
- Utility function testing

**Integration Testing:**
- API integration testing
- Component integration testing
- User flow testing

**E2E Testing:**
- Critical user paths
- Authentication flows
- POS operations
- Form submissions

### Development Workflow

1. **Setup:** `npm install`
2. **Development:** `npm run dev`
3. **Build:** `npm run build`
4. **Production:** `npm start`
5. **Linting:** `npm run lint`
6. **Type checking:** Automatic with TypeScript

### Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_NAME=Shuni POS
NEXT_PUBLIC_DEFAULT_LANGUAGE=uz
NEXT_PUBLIC_CURRENCY_CODE=UZS
NEXT_PUBLIC_DATE_FORMAT=DD.MM.YYYY
```

### Deployment Considerations

**Build Optimization:**
- Static export where possible
- Server-side rendering for dynamic content
- Edge deployment support
- Environment-specific configurations

**Monitoring:**
- Error tracking (Sentry)
- Performance monitoring
- User analytics
- A/B testing capability

### Future Enhancements

- Progressive Web App (PWA) support
- Offline functionality
- Push notifications
- Voice commands for POS
- Advanced animations
- Dark mode implementation
- Custom themes support
- Widget system for dashboard

### Core POS holati — 2026-10-06

Amaldagi implementation va qolgan ishlar [EXECUTION_STATUS.md](tasks/EXECUTION_STATUS.md), API contractlar [api.md](api.md)da yuritiladi. Coreda shaxsiy sessiyalar/parol boshqaruvi, audit tarixi, mahsulot/mijoz/kategoriya arxivi va tiklash, yetkazib beruvchi kartalari, filtrlangan ombor jurnali, bounded CSV eksportlari, POS tezkor tugmalari va58/80mm browser receipt/PDF mavjud. Mijozning qarz/avans qoldig‘i bor bo‘lsa arxivlash bloklanadi. Supplier/ombor/smena/audit CSV hamda idempotent print-request auditi qo‘shildi. Kategoriya boshqaruvi, birlik/barkod paginatsiyasi, supplier kontakt kartasi va filialga cheklangan xarid tarixi/yig‘indisi bor. Kategoriya/birlik/barkod, ombor hujjati/transfer/qoldiq eksportlari to‘liq filtrlangan, cap10000 bilan; xarid qiymati supplier qarzi yoki pul to‘lovi emas. Real Click, fiskal va hardware integratsiyalari hali ulanmagan.

Production yangilashda yangi image ishga tushishidan oldin `npm run db:migrate` (`prisma migrate deploy`) bajariladi. Readiness `202610060016_audit_history_guards` migration tugaganini tekshiradi.016 AuditLog UPDATE/DELETEni taqiqlaydi; developmentdagi `migrate dev` yoki `db push` production deploy o‘rnida ishlatilmaydi. Haqiqiy biznes bazasiga bu ish davomida migration qo‘llanmagan.

Oldingi 20 ta ish bosqichi tekshiruvlari:57 integratsion,11 unit va2 production HTTPS browser scenario; typecheck/lint/build o‘tgan. Fresh/legacy17 migration va encrypted backup/restore avvalgi bosqichda tekshirilgan; ushbu 20 ta ish schema/migrationni o‘zgartirmaydi. Bu pilot, production hosting yoki butun PLAN1 qabul shartlari yakunlangani degani emas.

### Savdo tarixi va xavfsiz regressiya testlari

Completed chekni yashirin tahrirlash yoki o‘chirish DB darajasida bloklanadi. Tuzatish uchun original savdodan qaytarish oqimini oching; sabab va original qatorlar saqlanadi. Katalogdagi keyingi narx/tannarx o‘zgarishi original chek va qaytarish qiymatini almashtirmaydi. Mahsulot, mijoz va katalog tarixini saqlash uchun arxivlashdan foydalaning. Checkout oldingi qoralama chegirmasini joriy vakolat bilan qayta tekshiradi; siyosat o‘zgargan bo‘lsa savatni qayta ko‘rib chiqing. Takror mahsulot qatorlari bitta qatorga birlashtiriladi, birlik aniqligi har kirish qatorida tekshiriladi.

Deploymentdan oldin mavjud `npm run db:migrate` yo‘li yangi `202610060017_sale_history` va `202610060018_sale_item_lock` migratsiyalarini qo‘llashi kerak. Build migratsiya o‘rnini bosmaydi. Mahsulot/store/shift/register hard-delete cascade bilan posted tarixni yo‘qotishga urinish ham rad etiladi; public delete oqimi qo‘shilmagan.

`npm run test:integration` faqat `127.0.0.1:55439`, `pos_test` bazasi va `pos_test` foydalanuvchisini qabul qiladi. Guard compilation va connectiondan oldin ishlaydi, noto‘g‘ri URL qiymatini logga chiqarmaydi. Test fayllaridagi alohida guardlar ham shu bazani tekshiradi. Migration smoke test fresh va legacy fixture uchun vaqtinchalik bazalar yaratib o‘chiradi. Real biznes bazasi yoki uning credentiallarini test buyrug‘iga bermang.

2026-10-06 yakuniy qabul: aynan10 ta PLAN1 bandi done — POS-01.01/.02/.03/.04/.05/.07/.08, FIN-01.01, FIN-02.03, QA-01.02. 68/68 real PostgreSQL,11/11 unit,2/2 production HTTPS scenario; typecheck/lint/build o‘tdi. Fresh/legacy19 migration va encrypted backup/restore ham shu bosqichda qayta tekshirildi. Har bir bandning qabul dalili tasks/EXECUTION_STATUS.md oxirgi bo‘limida.

## Moliyaviy core: qo‘shimcha15 band (2026-10-06)

“Smenalar”da cash manbalari alohida ko‘rinadi: savdo, qarz undirish, refund, qo‘lda kirim/chiqim, bankka topshirish va inkassatsiya. Yopilgan smenadagi xatoni original hisobni tahrirlab tuzatish mumkin emas. Owner/admin shu filialdagi yangi ochiq smenaga sababli tuzatish hujjatini yozadi; original expected/counted/difference va audit tarixi saqlanadi. Bankka topshirish tashqi bank tasdig‘i degani emas. Unknown cash/correction request reloadga chidamli IndexedDB intentda qoladi; aynan original requestni qayta tekshirish/yuborish kerak.

Hisobot sahifasi global chek soni va moliyaviy jamilarni barcha matching yozuvdan oladi; sahifalash ularni qisqartirmaydi. Naqd savdo, qarz undirish, cash refund va nasiya alohida. Sahifalar/CSV/dashboard havolasi bir cutoff bilan ochiladi; yangi savdolarni qo‘shish uchun “Yangilash”. Sana biznesning timezoneida hisoblanadi. Cutoff event/createdAt bo‘yicha filtr; tarixiy katalog yoki durable DB snapshot emas. Dashboard stock/open shift soni joriy holat. Mahsulot tannarxi original sale snapshotidan olinadi.

Return historydan HTML qaytarma chek nusxasi yuklanadi. Manager sababi, actor/approval va original chek havolasi saqlanadi; fiskal/printer integratsiyasi yo‘q. Sellable qaytarish original tannarx bilan vaznli o‘rtachani yangilaydi; zero stockda original cost, damaged/write-offda available valuation o‘zgarmaydi. Manfiy stock avval reconciliation talab qiladi.

Deployment uchun yangi uchta versioned migratsiya: `202610060019_finance_history`, `202610060020_correction_cash_link`, `202610060021_return_approval_check`. Backup va staging tekshiruvidan keyin existing `npm run db:migrate` yo‘lini qo‘llang; build schema migratsiyasini bajarmaydi. Real biznes bazasiga bu ish jarayonida tegilmagan. Batafsil API contracti api.mdda; task qabul protokoli tasks/EXECUTION_STATUS.mdda. Real Click/fiscal/E-POS/hardware adapterlar keyingi alohida integratsiya doirasida qoladi.

Yakuniy qabul:15 ta PLAN1 ID done, jami25→40. PostgreSQL integration78/78, unit14/14, production HTTPS Chromium3/3; typecheck/lint/build va fresh/legacy22 migration hamda encrypted backup/restore o‘tdi. QA-01.03 (to‘liq ko‘p brauzerli acceptance) bu15 orasida emas. Bu lokal qabul dalili butun tizim production release/pilot tayyorligini anglatmaydi.

## Savat, uzilish va haqiqiy naqd hisob (2026-10-06)

POS server readiness asosida aloqa holatini ko‘rsatadi. Uzilishda savat saqlanadi, savdoni yakunlash bloklanadi; aloqa GET probe orqali chegaralangan backoff bilan tekshiriladi. Mijoz, chek izohi va optional xizmat turi oynani yopib qayta ochganda ham o‘z user/business/device savatidan tiklanadi. Yangi savatlarda keraksiz customer kontaktlari/nested data va katalog tannarxi lokal saqlanmaydi.

Naqd modalda mijoz bergan haqiqiy pulni kiriting. Aralash to‘lovda cash/card(ichki qo‘lda qayd)/credit qismlari va berilgan naqd pul alohida. Server qaytimni hisoblab chekda saqlaydi; tender tushumga qo‘shilmaydi. Masalan100000chek/120000tender →20000qaytim va100000cash receipt. Legacy tender unknown NULL; tarix taxmin qilinmaydi. Click/terminal API settlement ulanmagan.

Natijasi noma’lum savdoda “Natijani tekshirish” asl server yozuvini topadi. “Navbatni sinxronlash” persisted original commandlarni operator ko‘rsatmasi bilan yuboradi; yangi receipt/payment yaratib dublikatlamaydi. Pending/conflict navbat bilan logout/clear bloklanadi. Boshqa tabdagi kechikkan javob terminal amalni qayta ochmaydi; sync/clear atomic IndexedDB transactionlarida. Bu rezervli offline sale emas: signed lease/stock quota hali alohida vazifa.

Deploymentdagi yangi additive migratsiyalar: `202610060022_cash_tender`, `202610060023_sale_metadata`; jami24. Existing `npm run db:migrate`ni staging/backup protokoli bilan alohida qo‘llang; build migratsiyani almashtirmaydi. Yangi ilova readiness oxirgi schema contract tayyor bo‘lmaguncha503. Lokal testlarda real biznes DBga tegilmadi.

Keyingi10 band qabul qilindi, jami done40→50. Final real PostgreSQL83/83, unit15/15, HTTPS Chromium5/5; typecheck/lint/build, fresh/legacy24 migration va encrypted backup/restore o‘tdi. Individual qabul/versiya dalili tasks/EXECUTION_STATUS.md oxirgi bo‘limida.

### Boshlang‘ich qoldiq, etiketka va egalikni topshirish

Ombor hujjatlari oynasida **Boshlang‘ich qoldiq** turi mavjud: yangi filial/mahsulotning avvalgi harakatsiz qoldig‘ini sabab bilan kiriting, keyin manager tasdiqlaydi. Keyingi sanash farqi uchun **Tuzatish** tanlang: manfiy miqdor kamomad, musbat miqdor qo‘shimcha qoldiq. Sabab majburiy, nol/takror mahsulot qatori rad. Tasdiqlangan harakatni almashtirib o‘chirish o‘rniga qarshi hujjat ishlatiladi. Eski movement jurnalini bazaning o‘zi ham o‘zgartirishdan himoyalaydi.

Mahsulot tafsilotidagi barkodlar oynasida **Ichki barkod yaratish** va **Etiketka** bor. Nusxa soni 1–100; yuklangan HTML faylni brauzerda ochib print/PDF qilish mumkin. Andoza 80×35 mm, Code128 encoder bwip-js; decoder testlari yetakchi nollar va ASCII belgilar saqlanishini tekshiradi. Printer, uning transporti va fizik bosma sifati hali tasdiqlangan hardware integratsiyasi sifatida va’da qilinmaydi.

Sozlamalar → Xodimlarda **Egalikni topshirish** qabul qiluvchiga 24 soatlik so‘rov yuboradi. So‘rov yuborilganda rollar o‘zgarmaydi. Qabul qiluvchi headerdagi so‘rovni qabul qilgandan keyin yangi owner, avvalgi owner admin bo‘ladi. Ikki accountning eski biznes sessiyalari bekor qilinadi; yangi owner davom etish uchun yangilangan cookie oladi. So‘rovni ikki ishtirokchi ham bekor qilishi mumkin. Oxirgi ownerni bloklash/demote qilish himoyasi saqlangan.

Biznes almashtirish savat/filial/terminal/smena holatlarini joriy biznesga moslaydi. A biznesning lokal savati B biznesga o‘tmaydi; A ga qaytganda tiklanadi. Narx, stock va vakolat serverda jonli qayta tekshiriladi, API javoblari `private, no-store`.

Yangi additive/versioned migratsiyalar 024 va 025, jami26. Builddan alohida `npm run db:migrate` staging/backup protokoli bilan bajariladi; readiness025siz503. O‘zgarishlar faqat izolyatsiyalangan local test bazasida tekshirildi, productionga deploy qilinmadi. +50 vazifa so‘rovi hali yakunlangan deb ko‘rsatilmaydi; individual qabul holati tasks/EXECUTION_STATUS.mdda.

### Xarid narxlarini mahsulot va supplier bo‘yicha taqqoslash

Hisobotlar → **Xarid narxlari tahlili** orqali narx tarixi yoki mahsulot/supplier taqqoslashni oching. Yetkazib beruvchi va mahsulotni nom orqali qidirib tanlang, filial/davrni belgilang va **Xaridni filtrlash**ni bosing. Jami barcha mos hujjatlardan, jadval esa sahifalangan qatorlardan hisoblanadi. CSV barcha mos qatorlarni oladi; juda katta natijada filtrni toraytirish kerak.

Narxlar tasdiqlangan xarid hujjatidan olinadi, katalogning keyinchalik o‘zgargan tannarxidan emas. Bekor qiluvchi qarshi hujjat xarid qiymatini kamaytiradi; qoralama xarid hisobga kirmaydi. O‘rtacha narx miqdor bilan vaznlangan, birinchi/oxirgi va minimal/maksimal narxlar purchase qatorlariga tegishli. Eski tasdiq sanasi yo‘q hujjatlar alohida belgi bilan ko‘rsatiladi. Bu supplierga to‘langan pul yoki qarz hisobi emas.

Nasiya bo‘yicha qabul testi: 100000 savdo → debt100000, revenue100000, cash0. Mijozsiz/faol bo‘lmagan mijoz/limitdan yuqori nasiya postingdan oldin rad etiladi. Parallel limit himoyasi saqlangan. Yangi schema, migration, provider yoki hardware integratsiyasi qo‘shilmadi.

Xodimlar boshqaruvi: Sozlamalar → Xodimlar bo‘limida rol/filialni tahrirlash, vaqtincha bloklash, arxivlash va arxivdan tiklash mavjud. Arxivlash savdo tarixini saqlaydi va sessiyalarni bekor qiladi. Tiklash xodimni bloklangan holatda qaytaradi; vakolatlarni tekshirib alohida faollashtirish kerak. Migration `202610060026_member_archive`ni deploydan oldin qo‘llang.

POS konfliktni mahsulot va eski/yangi qiymatlar bilan ko‘rsatadi. Eski urinish bekor qilingach narxlarni yangilash va qayta to‘lov tasdig‘i bor. Real printer adapterisiz browser print/PDF ishlaydi; chop etish xatosi savdoni qayta yaratmaydi.

Smenadagi har qanday naqd farq uchun sabab va manager tasdig‘i talab qilinadi (limit0). Kassir so‘rovi pending paytda savdo/pul yozuvi bloklanadi. Rahbar Shifts ekranida tasdiqlaydi yoki qayta sanashga qaytaradi. Keyingi kassir smena ochishda oldingi sanalgan pulni topshirish sifatida qabul qilishi mumkin. Boshlang‘ich qarz hujjatlari endi individual FIFO/explicit to‘lovga bog‘lanadi; muddati ham alohida hisoblanadi. Eski noma’lum taqsimotlar taxmin qilinmaydi. Deploydan oldin additive migration027ni qo‘llang.

Browser tekshiruvi: odatiy `npm run test:e2e` Chromium; `POS_E2E_ALL_BROWSERS=1 npm run test:e2e` Chromium/Firefox/WebKit. CI uchala browserni `playwright install --with-deps chromium firefox webkit` bilan tayyorlaydi va failure screenshot/trace saqlaydi. 360/768/1280px touch/mobile acceptance bor. Test bazasi faqat isolated pos_test bo‘lishi kerak.

Server qoralamasi va tiklash: POSda **Qoralamani serverda saqlash** savdoni hali yakunlamaydi. `/drafts`dan ayni hisobning faol kassa/smena qoralamasi boshqa qurilmada ochiladi; explicit “Tanlangan server qoralamasini ochish” va qayta tasdiqlash talab etiladi. Yangi Sale yaratilmaydi. Faqat buzilgan qurilmada qolgan lokal savat cloud backup hisoblanmaydi. `/sync-review` pending/conflict/synced/rejected holatlarini va asl saqlangan payloadni ko‘rsatadi. Owner terminal result yoki authorized void dalilisiz server konfliktini yashira olmaydi. Review economic posting emas.

`/incidents` ombor jurnali, sale-payment, returns va shift tafovutlarini saqlaydi; mas’ul biznes egasi/filial rahbari. `/replenishment` filial+mahsulot min/max chegaralari va exact tavsiya (max−qoldiq; maxsiz minimumgacha) beradi; buyurtma/rezervni o‘zi yaratmaydi. Avtomatik worker: `npm run worker:build`, so‘ng sozlangan muhitda `npm run worker:reconcile -- --once` yoki interval rejimi. Docker image worker artifactini saqlaydi; compose `monitoring` profili uni internal DB bilan yuritadi. Worker har organizationni alohida transaction/lockda tekshiradi, faqat incident/system audit yozadi. Productionda migratsiya jobi avval bajariladi; worker web build yoki migration bilan avtomatik ishga tushmaydi. Graceful SIGTERM va minimum60s interval, default5min. `api_response/api_error` JSON loglari request/tenant/operation correlation va duration beradi; payload, parol, phone/email, cookie yoki raw error logga kirmaydi.

Yordam: `/help` internet/server, original receipt reprint, qurilma tiklash, vakolat/konflikt va katalog validatsiyasini tushuntiradi. Bulk import hali yoqilmaganligi aniq yozilgan. `/training` yangi kassir uchun izolyatsiyalangan interactive mashq; demo mahsulot/pul real bazaga yozilmaydi. Owner/admin home `/dashboard`, cashier `/pos`; server DTO vakolatli draft/shift/incident/conflict counts bilan muhim holatlarni ko‘rsatadi.

Release mashqi: `bash scripts/ops/test-release-drill.sh` faqat isolated pos_test va vaqtinchalik fresh/legacy/restore DBlarda ishlaydi: migrate, encrypted backup/restore, RELEASE_BASE bilan tanlangan (default HEAD^) oldingi Git source bilan yangi additive schema ustida exactly-once checkout. Elapsed/app rollback seconds va fixture RPO loss0 qayd etiladi. Bu local controlled environment dalili; real hosting RPO/RTO yoki pilot SLA kafolati emas. API chegaralari [reyestrda](tasks/API_ACCESS_MATRIX.md); yakuniy task dalillari [statusda](tasks/EXECUTION_STATUS.md).

Packaged worker qabul: isolated `pos-plan-test-db` tayyor va `docker build -t pos-app:twenty-test .` bajarilgach, `node scripts/ops/test-worker.mjs`. Ikki bir martalik scan va uchinchi recurring scan bitta durable incidentni yangilashi, system audit va stock/paymentga tegmasligi tekshiriladi. Owned recurring worker SIGTERM bilan exit0 yopiladi; fixture yakunda tozalanadi.


POS tezkor mahsulotlari mahalliy brauzerda organization/user/register bo‘yicha saqlanadi (maksimum12 ta, faqat IDlar). Mahsulot tanlashda serverdan hozirgi narx/vakolat tekshiriladi. F2 — qidiruv fokus, F4 — qidiruvni tozalash, F9 — to‘lov, Escape — modalni yopish. Keyboard-wedge skaner Enter yuborganda exact primary/additional barcode server lookup ishlaydi; barkod topilmasa aniq SKU yoki nom izlanadi. Kamera faqat barkod izlaydi. Eski debounced natija ishlatilmaydi; qidiruv tugamaguncha F9 va to‘lov yopiq. Maxsus scanner hardware driveri qo‘shilmagan.

Bank qaytarmasi: original qo‘lda qayd etilgan payment uchun manager avval server previewni ko‘radi, so‘ng tashqarida haqiqatan qaytarilgan summa hujjatini qayd etadi. Preview o‘zgarsa yoki bank hujjati ishlatilgan bo‘lsa return transaction rad etiladi. Click/fiskal/vendor integratsiyasi yo‘q.

`bash scripts/ops/test-release-drill.sh` fresh/legacy migratsiya, shifrlangan backup/empty-db restore va eski app bilan checkout/replayni isolated test muhitida tekshiradi. Restore qabulida `scripts/ops/verify-restored-app.mjs` haqiqiy app handlerlari orqali debt/countni o‘qiydi; iqtisodiy row count o‘zgarmaydi. Fixture RPO/RTO natijasi haqiqiy hosting SLA yoki offsite backup scheduler kafolati emas.


### Narxlar va qaytarilgan brak hisobi

Menyudagi **Narxlar tarixi** sahifasida mahsulotlarni toping, yangi narx va sabab kiriting, **Oldindan ko‘rish** orqali tekshiring va tasdiqlang. Har tasdiq 100 mahsulotgacha atomic; o‘zgargan eski narx batchni bekor qiladi. Tannarxni qo‘lda tahrirlash, uning tarixini ko‘rish va katalog/history eksporti biznes egasiga tegishli. Adminning mahsulot tahririda tannarx readonly; narxlar Decimal satr sifatida yuboriladi. Eski cheklar o‘zgarmaydi. Javob yo‘qolganda sahifani qayta ochib **Original amalni qayta tekshirish**ni bosing — yangi amal bilan almashtirmang.

**Brak va hisobdan chiqarish** sahifasi qaytarilgan sotilmaydigan tovarlarni alohida ko‘rsatadi. Brak filialning alohida joylashuvi/qoldig‘ida, hisobdan chiqarilgan mahsulot esa disposal jurnalida qoladi. Ular sotiladigan ombor qoldig‘iga qo‘shilmaydi. Jadval va CSV original chek nomi/SKU/tannarxini saqlaydi; admin faqat biriktirilgan filiallarni ko‘radi. Brakni ta’mirlash/release va umumiy rezerv boshqaruvi alohida ochiq reja bandlari.


### Ichki xarajat va hisoblar

Owner/admin `/finance` orqali ichki hisob balanslari, sababli biznes xarajatlari, hisoblararo teng debit/credit o‘tkazmalar va original hujjatga qarshi qaytarish hujjatini yuritadi. Hisob/toifa yaratish owner-only. Naqd balans mavjud smena kitobidan olinadi; bank/provider kitobi qo‘lda qayd etilgan ichki hisobdir. Ichki o‘tkazma savdo tushumiga kirmaydi.

Yalpi foyda va operatsion foyda alohida ko‘rsatiladi; hisobot ichki boshqaruv uchun. Har amal oldindan ko‘riladi va tasdiqlanadi; noma’lum javobda original kalit/payload lokal saqlanib, sahifa yangilanganda qayta tekshiriladi. Vendor-specific bank/Click/fiskal/hardware integratsiyasi qo‘shilmagan. Contract va cheklovlar `api.md` ichidagi “Ichki moliyaviy hisoblar” bo‘limida.


`/reports/breakdowns` mahsulot, kategoriya, kassir, filial va to‘lov kanali bo‘yicha sof savdoni ko‘rsatadi. Davr qaytarmalari va tarixiy tannarx hisobga olinadi; barcha kesimlar jami umumiy sof savdoga mosligi serverda tekshiriladi. Exact Decimal qiymatlar, pagination va full CSV mavjud. To‘lov kesimi pul oqimi emas: keyingi qarz undirish va ichki o‘tkazmalar savdo tushumiga qayta qo‘shilmaydi.

Supplier kartasida tekshirilgan xarid hisob-fakturasi, invoicega qisman to‘lov, alohida avans va avansni keyin taqsimlash mavjud. Naqd chiqim smena journalida, bank/provayder chiqimi operator tasdiqlagan haqiqiy hujjat bilan yoziladi. Vendor API ishlatilmaydi. Noaniq javobdan keyin original intent tiklanadi. Eski xaridlar avtomatik qarz hisoblanmaydi; qarz/avans nol bo‘lmasdan arxivlash mumkin emas. API kontrakti `api.md`da.

Supplier kartasidagi xarid buyurtmasi qisman qabul qilinadi: original qator→receipt→stock→invoice→payment allocation bog‘lanishi saqlanadi. Qabul bitta tranzaksiyada, unknown javob original kalit bilan tekshiriladi. Supplier qarzi/muddati hisoboti alohida Sidebar sahifasida; eski ro‘yxatga olinmagan xaridni unpaid deb taxmin qilmaydi.

Katalog brendlari `/products/brands`, tavsif va himoyalangan rasm `/products/:id/media`da boshqariladi. Static PNG/JPEG/WebP512KiBgacha sanitizatsiya qilinadi; bytes va immutable metadata existing PostgreSQL durable volume/encrypted backupda saqlanadi. `POS_FILE_QUOTA_BYTES` optional default104857600 (100MiB), valid1..1073741824; noto‘g‘ri sozlama503. Expired image o‘qilmaydi, explicit deletion bytes/linkni tozalaydi; tarix qoladi. Arbitrary document/video upload qo‘shilmadi. Nonce CSP uchun Next layout dynamic; private HTML/public cachega berilmaydi. Migration052..055 staging/backup tartibida alohida deploy qilinadi; local fixture sinov real hosting acceptance emas. ADR-035 va API contractsni ko‘ring.

`/security`da kassir o‘z paroli bilan 6 raqamli PINni sozlaydi; faol filialga tayinlangan kassirga tez almashish mavjud. PIN session faqat kassir/bitta filial/8soat; rahbarga o‘tish yoki biznes almashtirish uchun parol login kerak. PIN yoki rol/filial vakolati bekor bo‘lsa eski session ishlamaydi; parol rotatsiyasi barcha PIN va sessionsni bekor qiladi. Sinxronlanmagan amallar bilan UI switch bloklanadi; oldingi actorning saqlangan savati yo‘qolmaydi. Migration056 additive, alohida staging/migration tartibi bilan. ADR-036.

Soliq core sozlamalari `/settings/taxes`da: biznes kiritadigan included/excluded/exempt profil, o‘zgarmas sanali stavka tarixi, mahsulot bilan bog‘lash `/products/:id/media`da. POS to‘lov oldidan `/sales/preview` server hisobini ko‘rsatadi; eskirgan narx/soliq bilan posting rad. Yangi cheklarda historical cost, receipt discount, tax base/amount, payable va `money-half-up-2-v1` saqlanadi; partial/final refund original snapshotdan centsni saqlaydi. Hisobot gross/paymentni saqlaydi, foyda soliqsiz revenue va tarixiy costdan. Legacy receiptga tax to‘qib backfill qilinmaydi. Rasmiy fiskal/provider implementatsiyasi qo‘shilmadi.

POS qator va butun chek chegirmasi summa/foiz bilan, configured thresholdda sabab majburiy; manager o‘z faol hisobida tasdiqlaydi, actor/role/policy/date saqlanadi. Savat foiz/sababi restartdan keyin tiklanadi; lokal saqlanish indikatori commitdan keyin ko‘rsatiladi. Migration057..059 builddan alohida staging/backup tartibida qo‘llanadi. Barcha hisoblar serverda Decimal bilan, clientda fixed-point BigInt bilan.

Backup v1: `scripts/ops/backup.sh` uchun `POS_BACKUP_APP_VERSION` (aniq image digest/release ID) va `POS_SECRET_RECOVERY_REFERENCE` (alohida himoyalangan secret nusxasining locatori) majburiy. Yangi `.bundle-v1.dump.gpg` bilan `.manifest.gpg` va ikki `.sha256` birga saqlanadi; manifest dump SHA256iga bog‘langan, file bytes/business hujjatlar DBning shu pg_dump snapshotida. Env to‘liq ko‘chirilmaydi: faqat APP_ORIGIN/POS_FILE_QUOTA_BYTES/RECONCILE_INTERVAL_MS allowlisti. `RESTORE_CONFIGURATION_DIRECTORY` optional private0700 katalogga review uchun600 JSON chiqaradi; runtime konfiguratsiyasini avtomatik yoqmaydi. Eski `.dump.gpg` tiklash mosligi saqlangan, ular konfiguratsiya manifestiga ega deb ko‘rsatilmaydi.

Secret nusxasi alohida: `scripts/ops/backup-secrets.sh` faqat explicit `POS_SECRET_BACKUP_FILE`ni qabul qiladi (operatorga tegishli regular file,0600/0400,1..1MiB, symlink rad), recipient GPG bilan shifrlaydi. `.env` auto-discovery yo‘q. Secret filename/locatorni manifest recovery referenceiga kiriting, secret qiymatlarini kiritmang. Tiklashda uning checksumini tekshirib, GPG bilan alohida private joyga decrypt qiling; deploymentga operator o‘z secret manager tartibida ulaydi. Fixture sinovi haqiqiy secret/offsite scheduler/production recovery mavjudligini anglatmaydi.

PWA HTTPSda `/manifest.webmanifest` va `/sw.js` orqali ishlaydi; brauzerning o‘rnatish menyusi bilan qurilmaga qo‘shiladi (iOS: Share → Add to Home Screen). Worker faqat `/pwa/`dagi uchta public shell/icon faylini cache qiladi. Private API, shaxsiy sahifa HTML, receipt, file va Next chunklar cachega tushmaydi. Server uzilganda yangi oynaga shaxsiy ma’lumotsiz aloqa sahifasi chiqadi. Ochiq POSda oxirgi 50 mahsulotli qidiruv sahifasi IndexedDBda organization/user/device/register bo‘yicha saqlanadi; server-issued content version va 5 daqiqalik TTL bor. Tannarx/qoldiq/rasm/PIN/token bu katalogga kirmaydi; boshqa qidiruv offline to‘liq katalog deb ko‘rsatilmaydi. Expiry/clock rollback/ruxsat xatosida lokal fallback rad. Checkout faqat online server quote va transaction validationdan keyin. Yangi worker ochiq oynalarni majburan almashtirmaydi: pending amallarni saqlab, barcha POS oynalarini yopishdan so‘ng yangi versiya faollashadi. Bu offline to‘lov yoki hardware/fiskal integratsiya emas.

Support kirishi: biznes egasi `/settings/support`da explicit PlatformOperatorni, filiallarni, ma’lumot turini va1–60min muddatni tasdiqlaydi. Operator `/support`da faqat berilgan read-only doirani ko‘radi; har read/known deny biznes auditiga yoziladi. Egasi revoke qilsa yoki muddat tugasa keyingi so‘rov bloklanadi, eski ochiq sessiya bypass bermaydi. Platforma admini ham avtomatik owner emas. Operator ro‘yxatini trusted infratuzilma boshqaruvi `PlatformOperator(userId,role,isActive)` orqali provision qiladi; mavjud aktiv User identityga bog‘langan, `role` faqat `support` yoki `platform_admin`. Birlamchi staff tayinlash POS business APIga ochilmagan; productionda infrastruktura change approval/audit jarayoni bilan boshqariladi. Secret yoki real staff hisob bu ishlovda yaratilmadi. Bu readonly diagnostic support core; tarif/platforma managementning qolgan doirasi BIZ-02.01da ochiq.

Narx darajalari `/settings/prices`da: chakana, ulgurji, guruh va individual mijoz narxi; filial, minimal miqdor va kuchga kirish/tugash sanasi. Mijoz/guruh/ulgurji/chakana ustuvorligi aniq; overlapping qoida rad etiladi. POS joriy server narxini review qiladi; tarixiy chek va qaytarma o‘z price/cost/tax snapshotini saqlaydi. Barcha filial narxini egasi, o‘z filiali narxini administrator boshqaradi.

Mijoz valid telefoni normalizatsiya qilinadi va faol tenant kartalarida dublikatdan himoyalanadi. Eski ambiguous kartalar avtomatik tanlanmaydi/o‘chirilmaydi: egasi `/customers/duplicates` orqali ko‘radi. `/customers/:id/history` original cheklar/qisman qaytarmalar va bog‘langan kartalarni ko‘rsatadi; qoralama va qarzi yopilgan source reviewed durable merge bilan inactive alias bo‘ladi, moliyaviy hujjatlar original IDlarda qoladi. Ochiq qarz ko‘chirilmaydi, avval original ledgerda yakunlanadi. Guruh yangi savdo narx darajasini belgilaydi, eski receiptni o‘zgartirmaydi.

Receipt/history/FK indekslari066–073da har biri alohida `CREATE INDEX CONCURRENTLY` migration. Ularni boshqa migration bilan umumiy SQL transactionga o‘ramang. Live rolloutdan oldin staging restore + yangi/legacy migration drill talab qilinadi. Agar concurrent build uzilsa, migration log va `pg_index.indisvalid`ni tekshiring; faqat o‘sha failed, invalid indeksni operator nazoratida `DROP INDEX CONCURRENTLY` qilib, failed migrationni rolled-back qayd etib asl SQLni qayta qo‘llang. Applied migration checksumlari tahrirlanmaydi. Bu repodagi tekshiruvlar isolated test DB uchun; real deployment qilinmagan.

Ombor `/inventory/locations`: zonaga ajratish, exact rezerv, bo‘shatish va tanlangan qoralamani rezerv bilan naqd sotish. Fizik, rezerv, mavjud, zonaga biriktirilmagan va brak alohida; oddiy POS boshqa rezervni yechmaydi. `worker:reconcile` organization-scoped expired manual holdsni100tadan immutable journal bilan yakunlaydi. Migration074/075 eski qoldiqni qayta yozmaydi. Katalog cache o‘zi offline savdo ruxsati emas; offline naqd oqimi quyida.


Offline naqd: POSda aniq savatni serverda qoralama qilib saqlang, `/pos/offline`da o‘z filial/kassa/smenangiz uchun ruxsat oling. Default o‘chiq; egasi filialning jami hal qilinmagan summasi limitini va30–300soniya muddatni tasdiqlaydi. Ruxsat aynan bitta savat va bitta naqd to‘lovga; nasiya/karta yoki boshqa savat offline qabul qilinmaydi. Qurilmadagi ticket unlock iborasi bilan shifrlanadi; ibora serverga yuborilmaydi. `/pwa/cash.html` real tarmoq uzilishida ochiladi, bir ticket ikki tabda takroran ishlatilmaydi. Aloqa qaytganda shu sahifada original natijani sinxronlang, noma’lum natijada yangi pul olmang.

Expiry yoki narx/sessiya/smena konflikti original amalni yo‘qotmaydi. Noma’lum tovar rezervi avtomatik bo‘shamaydi, shiftclose/count ham cheklanadi. Egasi `/pos/offline`da haqiqiy tovar/pul qaytarilganini qayd etib draftni bekor qiladi yoki tovar berilgan va cash shu smenaga haqiqatan olinganini dalil bilan tekshirib asl savdoni qayd etadi. Ikkinchi yo‘l original narx/soliq/tannarxni saqlaydi, hisobga olish serverning hozirgi vaqti bilan; actual owner audit/pul qabul qiluvchi, original cashier tarixi saqlanadi. Committed sale qaytarilishi oddiy refund orqali. Bloklangan xodim haqidagi yangi qaror offline qurilmaga darhol yetmaydi; qisqa muddat, summa va stock rezervi xavfni cheklaydi. Tashqi Click/fiskal/hardware bu oqimga ulanmagan.


Katta owner katalog eksporti `/jobs` sahifasida “Katalog CSV eksporti” sifatida tasdiqlanadi. Mavjud `worker:jobs` ayni organization-scoped filtered snapshotni cursor500 bilan chiqaradi:100000qator/16MiB perfile/32MiB organization activeartifact. Tannarx owner fayliga kiradi; formula-safe CSV va exact Decimal strings. Fayl24soat owner authenticated download bilan olinadi, so‘ng worker uning baytlarini o‘chirib tarix/metadatani saqlaydi. Sinxron eksportlarning10000cap’i saqlanadi. Worker build va service alohida ishga tushirilishi shart; vendor API/hardware ulanmaydi.

Mijoz kartasidagi **Mijoz avansi** egasiga haqiqiy naqd kirimni alohida saqlash, uni tanlangan savdo/boshlang‘ich qarzga ajratish va ishlatilmagan qoldiqni qaytarish imkonini beradi. Har amal oldindan ko‘riladi va original kalit bilan lokal saqlanadi; javob yo‘qolsa asl amal tekshiriladi. Avans qarzni yashirin manfiy balansga aylantirmaydi. Avans qoldig‘i bo‘lgan karta arxivlanmaydi/birlashtirilmaydi. Bank/Click avansi integratsiya tasdig‘isiz bajarilmaydi.

Boshqariladigan yangilash uchun [maintenance qo‘llanmasi](docs/operations/maintenance.md) va `scripts/ops/set-maintenance.mjs` bor. Operatorning read-only mount qilingan katalogidagi flag yangi durable core amallarini va workerning yangi cyclelarini pauza qiladi; admitted/committed amallar va lokal savat/navbat saqlanadi. Readiness drain503, dashboard notice va original-key recovery bor. Native Nextdeployment protection uchun build/runtime `NEXT_DEPLOYMENT_ID` bir xil bo‘lishi kerak; real host routing va barcha non-durable writes uchun release discipline alohida tekshiriladi.

### Tashkilot biznes ma’lumotlarini eksport qilish

Egasi `/jobs` orqali barcha filiallarning reviewed biznes JSON eksportini oldindan ko‘rib, navbatga qo‘yishi mumkin. Manifest qatorlar soni va SHA256larni beradi; credential/internal proof toifalari ochiq chiqarib tashlangan. Mavjud worker kerak;100000qator/16MiB limit,24soat yuklab olish muddati. Bu database backup yoki tashkilotni yopish amali emas. [Eksport contracti](docs/operations/tenant-export.md).

### Bitta tashkilot uchun recovery rejasi

`npm run worker:tenant-recovery-plan` offline recovered copy va current targetni read-only snapshotlarda solishtiradi. Private0600 reja missing/changed/current-only yozuvlar va FKlarni review uchun chiqaradi; avtomatik import, overwrite yoki delete qilmaydi. Operator parametrlari, cheklovlar va isolated qabul [tenant recovery qo‘llanmasida](docs/operations/tenant-recovery.md). Haqiqiy production recovery alohida operator ruxsati va tekshiruvini talab qiladi.


MVP schemasidan migratsiya uchun read-only baseline/ledger CLI va takrorlanadigan dump/restore/backfill/fresh/rollback rehearsal [migration dataset qo‘llanmasida](docs/operations/migration-dataset-readiness.md). `bash scripts/ops/test-migration-dataset.sh` faqat vaqtinchalik isolated bazalarni ishlatadi. Real customer/staging/production migration va uning tasdig‘i alohida rollout darvozasi.

Tenant modellarning scope/insert/native FK guardlari: [tenant model contract](docs/operations/tenant-model-scope.md). To‘liq filtrlangan CSV/XLSX va browser print-to-PDF eksportini `/jobs` orqali navbatga qo‘yish: [hisobot eksporti](docs/operations/report-exports.md). Real staging/production/pilot va vendor integratsiyalari ushbu lokal qabuldan alohida.

Stress/soak va mahalliy restart qabul tartibi: [operatsion protokol](docs/operations/stress-soak.md). `--smoke` original OPS-04.06 qabulini almashtirmaydi.

Ichki bonus, chegirma kartasi, promo-kod va sovg‘a sertifikati administrator `/loyalty`da sozlaydigan immutable siyosat bilan ishlaydi. Mijoz kartasida karta/haqiqiy cash-backed sertifikat beriladi; saqlangan mijozli qoralamada kassir server tasdiqlagan karta/promo/bonus yoki sertifikatni ishlatadi. Unknown javobda original durable amal tiklanadi. Sertifikat majburiyati oddiy avans bilan ikki marta jamlanmaydi; checkout/refund asl pul manbasini saqlaydi. [Qoidalar va operatsion qo‘llanma](docs/operations/loyalty-marketing.md). Native migrations174–179 yangi binarydan avval qo‘llanadi; actual rollout/operator/backup tasdig‘i alohida. Real Click/fiskal/hardware/SMS integratsiyasi qo‘shilmagan.

Ro‘yxat, hisobot va original jurnallarning URL/paging hamda financial draft chegaralari: [qamrov xaritasi](docs/operations/list-query-coverage.md). UX-01.03 lokal core dalili: [manifest](tasks/evidence/list-journals-20261015.json).

Interfeys o‘zbek lotin va rus tillarida ishlaydi. Sarlavha yoki modal ichidagi `UZ / RU` tanlovi savat, kiritilgan summa, sana va javobi kutilayotgan original amallarni saqlaydi. Til afzalligi qurilmada saqlanadi; foydalanuvchi va original chek ma’lumotlari tarjima qilinmaydi. [Tarjima, exact pul/sana, xatolar va offline qo‘llanmasi](docs/operations/localization.md). Yangi matn uchun ikkala JSON dictionaryni yangilang va `npm run i18n:check`ni bajaring.

Ommaviy va’dalarning release imkoniyatlari va qabul dalillariga mosligi [public claim qo‘llanmasida](docs/operations/public-release-claims.md). `npm run release:claims:check` typed matnlar, ikki tarjima, original qabul bandlari, dalil/source SHA va integratsiya cheklovlarini tekshiradi. Trial konfiguratsiyasi yuklanmasa sahifa uni va’da qilmaydi; tariflar DBdan olinadi.

Lokal Docker uchun [HTTP development qo‘llanmasi](docs/operations/local-docker-https.md): `bash scripts/local/setup-https.sh`, private envni moslash, so‘ng `docker compose up --build`. http://localhost:3000 va http://localhost:3443 HTTPSga yo‘naltirilmaydi; CA talab qilinmaydi. Alohida development image ishlaydi, production HTTPS/Secure cookie talablari saqlanadi. Eski bazani reset qilmang.

Vercel web deploymenti uchun [Vercel qo‘llanmasi](docs/operations/vercel.md)ni ko‘ring: hosted DATABASE_URL, aniq production APP_ORIGIN va Node24 talab qilinadi. Build bazani read-only tekshiradi; migratsiya yoki fon workerlarni avtomatik ishga tushirmaydi.


Mijoz kartasida tashkilot egasi elektron chek, xizmat eslatmasi va reklama roziliklarini har aloqa kanali bo‘yicha alohida qayd etadi yoki bekor qiladi. Tarix o‘zgarmaydi; bekor qilish read-only davrda ham ochiq. Unknown javob original durable amal bilan tiklanadi. [Roziliklar, dalil va keyingi dispatch contracti](docs/operations/customer-consent.md). Bu modul real SMS/e-mail/Telegram yetkazishni yoqmaydi.

Release texnik tekshiruvlari: [image va kalit xavfsizligi](docs/operations/release-image-security.md), [PostgreSQL WAL/PITR](docs/operations/pitr.md), [yuklama va xizmat maqsadlari](docs/operations/release-service-targets.md). `node scripts/release/check-service-targets.cjs` joriy source, migratsiya, namuna, raw xatolar va recovery dalillarini tekshiradi. Lokal natijalar real production/pilot/SLA qabuli o‘rnini bosmaydi.
