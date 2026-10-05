# Shuni POS API hujjati

Bu hujjat `src/app/api` ichidagi mavjud Next.js Route Handlerlarga asoslangan. Bazaviy manzil: `/api`.

## Umumiy qoidalar

- So‘rov va javoblar JSON formatida; `Content-Type: application/json` yuboriladi.
- Kirish (`/auth/login`) va ro‘yxatdan o‘tish (`/auth/register`)dan tashqari barcha endpointlarda quyidagi sarlavha talab qilinadi:

  ```http
  Authorization: Bearer <token>
  ```

- `:id` — UUID ko‘rinishidagi resurs identifikatori. `?` bilan belgilangan maydon ixtiyoriy.
- Sahifalangan javoblarda `pagination` mavjud: `page`, `limit`, `total`, `totalPages`.
- Standart muvaffaqiyat formati: `{ "success": true, "data": ... , "message": "..." }`.
- Standart xato formati: `{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }`.
- Ko‘p endpointlarda token haqiqiyligi tekshiriladi. Biroq barcha route handlerlarda tashkilot/rol ruxsatlari bir xil darajada tekshirilmagan; bu API iste’molchilari uchun xavfsizlik cheklovi sifatida e’tiborga olinishi kerak.

## Autentifikatsiya

| Metod | Endpoint | Tavsif |
| --- | --- | --- |
| POST | `/auth/register` | Yangi foydalanuvchi, tashkilot, asosiy do‘kon va kassa yaratadi |
| POST | `/auth/login` | Telefon va parol orqali token oladi |
| GET | `/auth/me` | Joriy foydalanuvchi, faol tashkilot va ruxsatli do‘konlarni qaytaradi |

### `POST /auth/register`

```json
{
  "fullName": "Ali Valiyev",
  "phone": "+998901234567",
  "email": "ali@example.com",
  "password": "kamida-6-belgi",
  "organizationName": "Ali Market",
  "tin": "123456789"
}
```

Majburiy maydonlar: `fullName` (kamida 2 belgi), `phone` (kamida 9 belgi), `password` (kamida 6 belgi), `organizationName` (kamida 2 belgi). Muvaffaqiyatli javob `data.token`, `data.user` va `data.organization`ni qaytaradi. Standart sozlama sifatida `UZS`, `Asia/Tashkent`, “Asosiy do‘kon”, `REG001` kodli “Kassa 1” va chegirma siyosati yaratiladi.

### `POST /auth/login`

```json
{ "phone": "+998901234567", "password": "parol" }
```

Javob: `token`, foydalanuvchi, uning birinchi faol tashkiloti va roli. Xatolar: `INVALID_CREDENTIALS` (401), `USER_INACTIVE` (403), `NO_ORGANIZATION` (403).

### `GET /auth/me`

Body va query kerak emas. Javob: `user`, `organization`, `role`, `stores[]`. Har bir do‘kon ichida `id`, `name`, `address`, `phone` qaytariladi.

## Tashkilotlar va foydalanuvchilar

| Metod | Endpoint | Tavsif |
| --- | --- | --- |
| GET | `/organizations` | Token egasining faol tashkilotlari |
| POST | `/organizations` | Tashkilot yaratish, joriy foydalanuvchini `owner` qilish |
| GET | `/organizations/:id` | Tashkilot tafsiloti, do‘konlari va foydalanuvchilari |
| PUT | `/organizations/:id` | Tashkilot sozlamalarini yangilash |
| GET | `/organizations/:id/users` | Tashkilot foydalanuvchilari |
| POST | `/organizations/:id/users` | Foydalanuvchi va uning do‘kon ruxsatlarini yaratish |

### `POST /organizations`

```json
{
  "name": "Yangi biznes",
  "tin": "123456789",
  "phone": "+998901234567",
  "currencyCode": "UZS",
  "timezone": "Asia/Tashkent",
  "allowNegativeStock": false,
  "receiptFooter": "Xaridingiz uchun rahmat"
}
```

Majburiy: `name`, `phone`. `currencyCode`, `timezone`, `allowNegativeStock` mos ravishda `UZS`, `Asia/Tashkent`, `false` qiymatlariga ega.

### `PUT /organizations/:id`

Quyidagi maydonlarning istalgan qismini qabul qiladi: `name`, `tin`, `phone`, `currencyCode`, `timezone`, `allowNegativeStock`, `receiptFooter`.

### `POST /organizations/:id/users`

```json
{
  "fullName": "Kassir Ismi",
  "phone": "+998901112233",
  "email": "cashier@example.com",
  "password": "kamida-6-belgi",
  "role": "cashier",
  "storeIds": ["<store-uuid>"]
}
```

`role`: `owner`, `admin` yoki `cashier`. `storeIds` berilsa yaratilgan foydalanuvchiga shu do‘konlarga ruxsat yoziladi.

## Do‘konlar va kassalar

| Metod | Endpoint | Tavsif |
| --- | --- | --- |
| GET | `/stores?organizationId=:orgId` | Foydalanuvchi kira oladigan do‘konlar va faol kassalar |
| POST | `/stores` | Do‘kon yaratish |
| GET | `/stores/:id` | Do‘kon va uning faol kassalari |
| PUT | `/stores/:id` | Do‘konni yangilash |
| DELETE | `/stores/:id` | Do‘konni soft-delete (`isActive=false`) qilish |
| GET | `/stores/:id/registers` | Do‘konning faol kassalari |
| POST | `/stores/:id/registers` | Kassa yaratish |
| PUT | `/registers/:id` | Kassa nomi/kodini yangilash |

### `POST /stores`

```json
{
  "organizationId": "<organization-uuid>",
  "name": "Chilonzor filiali",
  "address": "Toshkent shahri",
  "phone": "+998901234567"
}
```

`organizationId` va `name` majburiy. Endpoint faqat `owner` yoki `admin` rolini tekshiradi.

### `PUT /stores/:id`

Qabul qilinadigan maydonlar: `name`, `address`, `phone`, `isActive`.

### `POST /stores/:id/registers`

```json
{ "name": "Kassa 2", "code": "REG002" }
```

`name` va `code` majburiy, har biri kamida 2 belgi. `PUT /registers/:id` shu maydonlarning ixtiyoriy qismini qabul qiladi; `isActive` ham yuborilishi mumkin.

## Katalog

| Metod | Endpoint | Tavsif |
| --- | --- | --- |
| GET | `/categories?organizationId=:orgId` | Faol kategoriyalar |
| POST | `/categories` | Kategoriya yaratish |
| PUT | `/categories/:id` | Kategoriyani yangilash |
| DELETE | `/categories/:id` | Kategoriyani soft-delete qilish |
| GET | `/products` | Mahsulotlar ro‘yxati yoki barkod bo‘yicha bitta mahsulot |
| POST | `/products` | Mahsulot yaratish |
| GET | `/products/:id` | Mahsulot tafsiloti |
| PUT | `/products/:id` | Mahsulotni yangilash |
| DELETE | `/products/:id` | Mahsulotni soft-delete qilish |

### Kategoriyalar

`POST /categories` body:

```json
{ "organizationId": "<organization-uuid>", "name": "Ichimliklar", "sortOrder": 0 }
```

`PUT /categories/:id`: `name`, `sortOrder`, `isActive` maydonlari. DELETE faqat `isActive=false` qiladi.

### `GET /products`

| Query | Majburiy | Izoh |
| --- | :---: | --- |
| `organizationId` | ✓ | Tashkilot UUIDsi |
| `search` | — | Nom, SKU yoki barkod bo‘yicha qidiruv |
| `categoryId` | — | Kategoriya UUIDsi |
| `barcode` | — | Berilsa bitta faol mahsulot qaytadi; topilmasa 404 |
| `page` | — | Standart: 1 |
| `limit` | — | Standart: 20 |

### `POST /products`

```json
{
  "organizationId": "<organization-uuid>",
  "categoryId": "<category-uuid>",
  "name": "Coca-Cola 1L",
  "sku": "CC-1L",
  "barcode": "478000000001",
  "unit": "dona",
  "salePrice": 14000,
  "costPrice": 11000,
  "minStock": 10,
  "imageUrl": "https://example.com/coca-cola.jpg"
}
```

Majburiy: `organizationId`, `name`, `sku`, `barcode`, `salePrice`, `costPrice`. Narxlar 0 dan katta. Bir tashkilot ichida SKU yoki barkod takrorlansa `DUPLICATE` xatosi qaytadi. `PUT /products/:id` yuqoridagi maydonlarning ixtiyoriy qismini hamda `isActive`ni qabul qiladi.

## Mijozlar va yetkazib beruvchilar

| Metod | Endpoint | Tavsif |
| --- | --- | --- |
| GET | `/customers` | Mijozlar ro‘yxati |
| POST | `/customers` | Mijoz yaratish |
| GET | `/customers/:id` | Mijoz tafsiloti |
| PUT | `/customers/:id` | Mijozni yangilash |
| DELETE | `/customers/:id` | Mijozni soft-delete qilish |
| GET | `/customers/:id/debt` | Mijoz nasiya qarzi va tarixlari |
| GET | `/suppliers?organizationId=:orgId` | Faol yetkazib beruvchilar |
| POST | `/suppliers` | Yetkazib beruvchi yaratish |
| PUT | `/suppliers/:id` | Yetkazib beruvchini yangilash |

### `GET /customers`

`organizationId` majburiy. Ixtiyoriy: `search` (ism/telefon), `page` (standart 1), `limit` (standart 20).

### `POST /customers`

```json
{
  "organizationId": "<organization-uuid>",
  "fullName": "Mijoz Ismi",
  "phone": "+998901234567",
  "address": "Toshkent",
  "note": "Doimiy mijoz",
  "creditLimit": 500000
}
```

`organizationId`, `fullName`, `phone` majburiy. Bir tashkilot ichida telefon takrorlansa `DUPLICATE` qaytadi. `PUT /customers/:id` bu maydonlarning ixtiyoriy qismini hamda `isActive`ni qabul qiladi.

### `GET /customers/:id/debt`

Javobda `customerId`, `customerName`, `creditLimit`, `totalDebt`, `remainingCredit` va oxirgi 10 ta `recentPayments` qaytadi.

### Yetkazib beruvchilar

`POST /suppliers` body:

```json
{
  "organizationId": "<organization-uuid>",
  "name": "Distribyutor MChJ",
  "phone": "+998901234567",
  "tin": "123456789",
  "address": "Toshkent",
  "note": "Haftalik yetkazib berish"
}
```

`organizationId` va `name` majburiy. `PUT /suppliers/:id` shu maydonlarning ixtiyoriy qismini va `isActive`ni qabul qiladi.

## Ombor

| Metod | Endpoint | Tavsif |
| --- | --- | --- |
| GET | `/inventory/balances` | Joriy qoldiqlar |
| GET | `/inventory/movements` | Ombor harakatlari jurnali |
| GET | `/stock-documents` | Kirim/tuzatish hujjatlari |
| POST | `/stock-documents` | Qoralama ombor hujjati yaratish |
| GET | `/stock-documents/:id` | Hujjat va qatorlari |
| PUT | `/stock-documents/:id` | Qoralama hujjatni tahrirlash |
| POST | `/stock-documents/:id/confirm` | Hujjatni tasdiqlash va qoldiqni yangilash |
| GET | `/transfers` | Do‘konlararo transferlar |
| POST | `/transfers` | Qoralama transfer yaratish |
| POST | `/transfers/:id/send` | Transferni jo‘natish, manba qoldig‘ini kamaytirish |
| POST | `/transfers/:id/receive` | Transferni qabul qilish, manzil qoldig‘ini oshirish |

### `GET /inventory/balances`

Ixtiyoriy query: `storeId`, `categoryId`, `lowStock=true`, `page` (standart 1), `limit` (standart 50). `lowStock=true` bo‘lsa miqdori minimal zaxiradan past bo‘lgan qatorlar qaytariladi.

### `GET /inventory/movements`

`organizationId` majburiy. Ixtiyoriy: `storeId`, `productId`, `movementType`, `page` (1), `limit` (50). Harakat bilan mahsulot, do‘kon va yaratuvchi qaytariladi.

### `GET /stock-documents`

`organizationId` majburiy. Ixtiyoriy: `storeId`, `documentType`, `status`, `page` (1), `limit` (20).

### `POST /stock-documents`

```json
{
  "organizationId": "<organization-uuid>",
  "storeId": "<store-uuid>",
  "supplierId": "<supplier-uuid>",
  "documentType": "purchase",
  "documentNo": "KIRIM-001",
  "note": "1-sentabr kirimi",
  "items": [
    { "productId": "<product-uuid>", "quantity": 10, "unitCost": 11000, "note": "" }
  ]
}
```

`organizationId`, `storeId`, `documentType`, `documentNo` va kamida bitta `items` qatori majburiy. `documentType`: `purchase`, `adjustment`, `transfer_out`, `transfer_in`, `return_in`. `quantity` 0 dan katta, `unitCost` manfiy bo‘lmasligi kerak. Yaratilgan hujjat `draft` holatida bo‘ladi.

### `PUT /stock-documents/:id`

Faqat `draft` hujjat tahrirlanadi. Body: `supplierId?`, `note?`, `items?`; `items` berilsa eski qatorlar o‘chirilib, yuborilgan qatorlar bilan almashtiriladi. Ushbu endpointdagi `unitCost` 0 dan katta bo‘lishi kerak.

### `POST /stock-documents/:id/confirm`

Body kerak emas. Faqat `draft` hujjat tasdiqlanadi. Tizim `InventoryMovement` yozuvlarini yaratadi va `InventoryBalance`ni mos ravishda o‘zgartiradi: `transfer_out` uchun manfiy, boshqa hujjat turlari uchun musbat miqdor.

### `GET /transfers`

`organizationId` majburiy. Ixtiyoriy: `status`, `page` (1), `limit` (20).

### `POST /transfers`

```json
{
  "organizationId": "<organization-uuid>",
  "fromStoreId": "<source-store-uuid>",
  "toStoreId": "<destination-store-uuid>",
  "note": "Filialga jo‘natildi",
  "items": [
    { "productId": "<product-uuid>", "quantity": 5, "unitCost": 11000 }
  ]
}
```

Barcha IDlar va kamida bitta qator majburiy. `fromStoreId` va `toStoreId` teng bo‘lsa `INVALID_STORES` qaytadi. Transfer holatlari: `draft` → `sent` → `received`. `send` va `receive` endpointlariga body kerak emas.

## Smena va kassa harakatlari

| Metod | Endpoint | Tavsif |
| --- | --- | --- |
| GET | `/shifts` | Smenalar ro‘yxati |
| POST | `/shifts` | Smena ochish |
| GET | `/shifts/:id` | Smena, savdolar, to‘lovlar va naqd harakatlari |
| POST | `/shifts/:id` | Smenani yopish |
| POST | `/shifts/:id/cash-movements` | Naqd pul kiritish yoki olish |

### `GET /shifts`

Ixtiyoriy query: `registerId`, `status`, `page` (1), `limit` (20).

### `POST /shifts`

```json
{
  "registerId": "<register-uuid>",
  "organizationUserId": "<organization-user-uuid>",
  "openingCash": 100000,
  "note": "Ertalabki smena"
}
```

`registerId` va `organizationUserId` majburiy. `openingCash` standart `0`. Kassada ochiq smena bo‘lsa `SHIFT_ALREADY_OPEN` xatosi qaytadi.

### `POST /shifts/:id`

```json
{ "countedCash": 350000, "note": "Smena yopildi" }
```

Faqat ochiq smenani yopadi. Javobda `expectedCash`, `countedCash`, `cashDifference` va yopilgan smena qaytadi.

### `POST /shifts/:id/cash-movements`

```json
{ "movementType": "cash_out", "amount": 50000, "reason": "Inkassatsiya" }
```

`movementType`: `cash_in` yoki `cash_out`; `amount` 0 dan katta, `reason` majburiy. Faqat ochiq smenada ishlaydi.

## Savdolar va to‘lovlar

| Metod | Endpoint | Tavsif |
| --- | --- | --- |
| GET | `/sales` | Savdolar ro‘yxati |
| POST | `/sales` | Qoralama savdo yaratish |
| GET | `/sales/:id` | Savdo tafsiloti |
| PUT | `/sales/:id` | Qoralama savdoni yangilash |
| POST | `/sales/:id/complete` | Savdoni yakunlash, to‘lov va qoldiqni yozish |
| POST | `/sales/:id/void` | Qoralama savdoni bekor qilish |
| GET | `/payments` | To‘lovlar ro‘yxati |
| POST | `/payments` | Umumiy to‘lov yozuvi yaratish |
| POST | `/payments/credit` | Mijoz nasiya qarzidan to‘lov olish |

### `GET /sales`

`organizationId` majburiy. Ixtiyoriy: `storeId`, `shiftId`, `status`, `page` (1), `limit` (20). Javobda mijoz, savdo qatorlari va to‘lovlar ham mavjud.

### `POST /sales`

```json
{
  "organizationId": "<organization-uuid>",
  "storeId": "<store-uuid>",
  "registerId": "<register-uuid>",
  "shiftId": "<shift-uuid>",
  "cashierId": "<user-uuid>",
  "customerId": "<customer-uuid>",
  "discountAmount": 1000,
  "note": "",
  "items": [
    {
      "productId": "<product-uuid>",
      "productName": "Coca-Cola 1L",
      "sku": "CC-1L",
      "quantity": 2,
      "unitPrice": 14000,
      "discountAmount": 0,
      "unitCost": 11000
    }
  ]
}
```

Yuqoridagi asosiy IDlar va `items` qatori majburiy. Har qatorning `quantity`, `unitPrice`, `unitCost` qiymati 0 dan katta. Smena ochiq bo‘lishi kerak, aks holda `INVALID_SHIFT`. Chek raqami avtomatik hosil qilinadi va savdo `draft` holatida yaratiladi.

### `PUT /sales/:id`

Faqat `draft` savdo yangilanadi. Body: `customerId?`, `items?`, `discountAmount?`, `note?`. `items` yuborilsa mavjud qatorlar almashtiriladi va summalar qayta hisoblanadi.

### `POST /sales/:id/complete`

```json
{
  "payments": [
    { "paymentType": "cash", "amount": 10000 },
    { "paymentType": "card", "amount": 17000, "referenceNo": "terminal-123" }
  ]
}
```

`paymentType`: `cash`, `card`, `transfer`, `credit`. To‘lovlar yig‘indisi savdo summasiga teng bo‘lishi shart (`INVALID_PAYMENT`). Tashkilot manfiy qoldiqni taqiqlagan bo‘lsa yetarli ombor qoldig‘i bo‘lishi kerak (`INSUFFICIENT_STOCK`). Muvaffaqiyatda savdo `completed` bo‘ladi, to‘lovlar va ombor chiqimi yoziladi.

### `POST /sales/:id/void`

Body kerak emas. Faqat `draft` savdoni `voided` holatiga o‘tkazadi.

### `GET /payments`

`organizationId` majburiy. Ixtiyoriy: `customerId`, `paymentType`, `page` (1), `limit` (20).

### `POST /payments`

```json
{
  "organizationId": "<organization-uuid>",
  "storeId": "<store-uuid>",
  "shiftId": "<shift-uuid>",
  "saleId": "<sale-uuid>",
  "customerId": "<customer-uuid>",
  "paymentType": "cash",
  "direction": "in",
  "amount": 50000,
  "referenceNo": "",
  "note": ""
}
```

`organizationId`, `storeId`, `paymentType`, `direction`, `amount` majburiy. `direction`: `in` yoki `out`; qolgan IDlar ixtiyoriy.

### `POST /payments/credit`

```json
{
  "organizationId": "<organization-uuid>",
  "storeId": "<store-uuid>",
  "customerId": "<customer-uuid>",
  "amount": 50000,
  "referenceNo": "",
  "note": "Nasiya to‘lovi"
}
```

Mijozning amaldagi qarzidan katta summa yuborilsa `INVALID_AMOUNT` qaytadi. Muvaffaqiyatda `credit` turidagi kirim to‘lovi yaratiladi.

## Hisobotlar

| Metod | Endpoint | Tavsif |
| --- | --- | --- |
| GET | `/reports/dashboard` | Kunlik dashboard ko‘rsatkichlari |
| GET | `/reports/sales` | Yakunlangan savdolar bo‘yicha hisobot |
| GET | `/reports/products` | Mahsulot kesimidagi sotuv va foyda |

### `GET /reports/dashboard`

| Query | Majburiy | Izoh |
| --- | :---: | --- |
| `organizationId` | ✓ | Tashkilot UUIDsi |
| `storeId` | — | Do‘kon bo‘yicha filtrlash |
| `date` | — | `YYYY-MM-DD`; standart bugungi sana |

Javob: `totalSales`, `totalRevenue`, `averageCheck`, `cashPayments`, `cardPayments`, `openShifts`, `lowStockCount`, `topProducts`.

### `GET /reports/sales`

`organizationId` majburiy. Ixtiyoriy: `storeId`, `startDate`, `endDate`, `page` (1), `limit` (50). Faqat `completed` savdolar qaytariladi. `summary`: `totalRevenue`, `totalDiscount`, `totalItems`, `averageSale`.

### `GET /reports/products`

`organizationId` majburiy. Ixtiyoriy: `storeId`, `categoryId`, `startDate`, `endDate`, `page` (1), `limit` (50). Har mahsulot uchun `quantitySold`, `revenue`, `cost`, `profit`, `profitMargin` qaytariladi.

## Muhim status va enum qiymatlari

| Maydon | Qiymatlar |
| --- | --- |
| `role` | `owner`, `admin`, `cashier` |
| `documentType` | `purchase`, `adjustment`, `transfer_out`, `transfer_in`, `return_in` |
| `stockDocument.status` | `draft`, `confirmed` |
| `transfer.status` | `draft`, `sent`, `received` |
| `shift.status` | `open`, `closed` |
| `sale.status` | `draft`, `completed`, `voided`, `partially_returned`, `returned` |
| `paymentType` | `cash`, `card`, `transfer`, `credit` |
| `payment.direction` | `in`, `out` |
| `cashMovement.movementType` | `cash_in`, `cash_out` |

### Qarz undirish: aniq taqsimot

`POST /api/payments/credit` mavjud payloadiga ixtiyoriy `allocations` qo‘shildi.
`/api/sync` dagi `debt.collect` ham shu contractdan foydalanadi.

```json
{"allocations":[{"saleId":"<birinchi-savdo-UUID>","amount":"40.00"},{"saleId":"<ikkinchi-savdo-UUID>","amount":"10.00"}]}
```

Bu misolda asosiy `amount` `50.00` bo‘lishi kerak; qolgan majburiy organization/store/customer/shift/operation maydonlari avvalgidek yuboriladi. Summa Decimal bilan hisoblanadi. Har bir target faqat bir marta, 1–200 ta allocation, musbat summa; jami payment summasiga aynan teng bo‘lishi shart. Targetning ayni tashkilot va mijozga tegishli qarz qoldig‘idan ortiq ajratish rad etiladi. Bitta target xato bo‘lsa, payment va barcha qarz yozuvlari rollback qilinadi. Retry bir xil operationId va o‘zgarmagan to‘liq payload bilan bajariladi.

`allocations` yuborilmasa mavjud FIFO ishlaydi. `saleId: null` umumiy boshlang‘ich/tuzatish qarz guruhini bildiradi; alohida opening hujjatiga taqsimot deb talqin qilinmaydi. Opening hujjatlari bo‘yicha individual allocation va tarixiy noaniq taqsimotni tuzatish hali bajarilmagan. Mijoz kartasida biznes egasi FIFO yoki explicit tanlashdan foydalanadi; mijozlar ro‘yxatidagi ism havolasi kartani ochadi. Admin/cashier uchun mavjud FIFO saqlangan.


`GET /api/customers/:id/debt?targetsPage=1` — faqat owner uchun ochiq qarz targetlari. Ixtiyoriy parametr bo‘lmasa oldingi javob contracti saqlanadi. Parametr musbat butun son, ko‘pi bilan 100000. `data.allocationTargets` ichida `page`, `hasMore`, `items` (har sahifada 50 ta) keladi. Har item: `saleId` (UUID yoki null), `receiptNo` (string yoki null), `balance` (Decimal string). Faqat musbat net qoldiqlar qaytadi; yopilgan qarzlar chiqariladi. Boshqa tashkilot mijoziga 404, owner bo‘lmagan a’zoga target so‘rovida 403. Ko‘rsatilgan qoldiq maslahat uchun; undirish vaqtida transaction ichida qayta tekshiriladi.
