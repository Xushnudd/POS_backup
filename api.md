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


Mijoz kartasidagi undirish so‘rovi yuborilishidan oldin to‘liq payload IndexedDB `operations` navbatida tashkilot/xodim/qurilma kesimida saqlanadi. Reload shu kalit va original smena bilan natijani tekshirishni tiklaydi; yopilgan smenada ham avval committed bo‘lgan operation idempotency orqali qaytadi, yangi undirish yopilgan smenada bajarilmaydi. Qarz qoldig‘i kamayganligi eski retry summasini o‘zgartirmaydi. Lokal `synced` server muvaffaqiyatini, `rejected` esa birinchi yuborishdagi aniq validation/debt rad javobini bildiradi; ular yangi API endpoint yoki payment statusi emas. Noaniq urinishning keyingi auth/business xatosi original payloadni o‘chirmaydi. Mijozlar ro‘yxatidagi undirish tugmasi ham shu yagona mijoz kartasi oqimini ochadi. `?collect=1` bir martalik UI ko‘rsatma, payment yaratmaydi va o‘qilgach URLdan chiqariladi.


Manual qarz hujjati (`POST /api/customers/:id/ledger`) ham HTTPdan oldin lokal `debt.document` intenti sifatida saqlanadi. Mijoz kartasi reload’da original kind/amount/reason/saleId/effectiveAt/dueAt va operationIdni tiklaydi. API payloadi o‘zgarmagan; lokal payloaddagi customerId routing uchun ishlatiladi va strict ledger requestiga qo‘shilmaydi. Hujjatlar avtomatik `/api/sync`ga yuborilmaydi — owner shu kartada ayni hujjatni explicit qayta tekshiradi. Bu yangi vendor yoki payment integratsiyasi emas; hujjat pul to‘lovi yaratmaydi.


### Mijoz qarz ko‘chirmasini CSV eksport qilish

`GET /api/customers/:id/ledger?format=csv&from=2026-01-01&to=2026-01-31` — faqat owner uchun. From/to ixtiyoriy; mavjud organization-timezone davr qoidalari ishlaydi. JSON `data.filename` va `data.content` (UTF-8 BOM CSV string) qaytadi; UI Blob orqali `.csv` yuklaydi. Page/limit e’tiborga olinmaydi, davr to‘liq eksport qilinadi. 10000 yozuvdan oshsa `413 EXPORT_TOO_LARGE`; davrni qisqartiring. Summary va satr qoldiqlari bitta database snapshotdan. CSVda tashkilot timezone va satrlar uchun UTC sana/muddat bor, moliyaviy qiymatlar Decimal 2 xonali. Matnli ustunlar spreadsheet formula injectiondan himoyalangan. Endpoint private/no-store; boshqa tenant va owner bo‘lmagan a’zoga eksport berilmaydi. Bu qarz ledgeri eksporti; naqd-only savdolarni qamrab oladigan to‘liq mijoz commercial statementi hali alohida qolgan.


### Mijoz savdolari tarixi

`GET /api/sales?organizationId=<UUID>&customerId=<UUID>&page=1&limit=20` — mavjud savdo listiga ixtiyoriy customerId filtri qo‘shildi. Naqd yoki nasiya turidan qat’i nazar ayni mijozning vakolatdagi savdolari qaytadi; tenant/branch/own-cashier cheklovlari saqlanadi. Customer filterli javobdagi har sale uchun `saleReturns` array (id, refundAmount Decimal string, returnReceiptNo, returnedAt) qo‘shiladi. Payments avvalgidek qaytadi. Qaytarish `refundAmount` tovar qiymati; uning hammasi cash refund degani emas. Customer karta shu pagination API va sales detail havolalarini ishlatadi; mijozga bog‘lanmagan eski savdolar taxminiy ravishda biriktirilmaydi. Bu jadval full commercial statement eksporti emas.


### Birlashtirilgan mijoz ko‘chirmasi

`GET /api/customers/:id/ledger?format=commercial-csv&from=2026-01-01&to=2026-01-31` — owner-only. JSON `data.filename` (`customer-statement-<UUID>.csv`) va UTF-8 BOM CSV `data.content` qaytadi. From/to ixtiyoriy, organization timezone ishlaydi; maksimal 10000 hodisa, oshsa 413 EXPORT_TOO_LARGE.

Eksport yakunlangan savdo, qaytarish, mijozga yoki uning savdosiga bog‘langan payment va debt yozuvlarini bitta snapshotda birlashtiradi. Savdo/qaytarish qiymati va pul harakati alohida ustunlar. Credit payment kirimga qo‘shilmaydi; faqat DebtEntry qarzni o‘zgartiradi. `recorded` non-credit payment kirim/chiqimda hisoblanadi; card/transfer uchun bu tashqi provider confirmation degani emas. Draft/voided sale savdo qiymatiga kirmaydi. Row timestamp/due UTC, actor ID va source/detail/reference saqlanadi; summary davr boshidagi/oxiridagi qarzni ko‘rsatadi. Xavfsiz CSV quoting/formula himoyasi va private/no-store mavjud. Oldingi `format=csv` faqat qarz ko‘chirmasi eksporti sifatida saqlangan.


### Nasiya savdosi muddati

`POST /api/sales/:id/complete` uchun ixtiyoriy `creditDueAt` offsetli ISO datetime. U faqat musbat credit payment qismi bo‘lsa va muddat hali o‘tmagan bo‘lsa qabul qilinadi; aks holda `400 INVALID_CREDIT_DUE_DATE`, posting rollback. Credit DebtEntry shu dueAtni saqlaydi. POS credit/mixed oynasi tanlangan sanani tashkilot timezone bo‘yicha kun oxiriga aylantiradi. Original completion payloadi muddat bilan IndexedDB’da saqlanadi; ayni operation kaliti bilan boshqa muddatga almashtirish payload conflict. Committed replay muddat keyinchalik o‘tgan bo‘lsa ham mavjud natijani qaytaradi; yangi posting uchun sana qayta tekshiriladi. Optional field yuborilmagan avvalgi so‘rovlar o‘zgarmaydi.


### Qarz ko‘chirmasini chop etish

`GET /api/customers/:id/ledger?format=html&from=2026-01-01&to=2026-01-31` — owner-only, JSON `data.filename` (`customer-debt-<UUID>.html`) va `data.content` (standalone HTML) qaytadi. Date/tenant/snapshot va 10000 yozuv cap qarz CSV bilan bir xil. Customer kartadagi tugma faylni yuklaydi; brauzerda ochib Ctrl+P bilan chop etish yoki PDF saqlash mumkin. HTMLda summary, barcha period ledger rows, due dates/actor/reason bor; JavaScript yo‘q, dynamic text escaped va CSP qo‘yilgan. Bu qarz ko‘chirmasi print ko‘rinishi; full commercial CSV format alohida saqlangan. Hech qanday real printer/hardware/vendor integratsiyasi qo‘shilmagan.


### Qarz qoldig‘ining joriy muddat guruhlari

`GET /api/customers/:id/ledger` javobiga `data.aging` qo‘shildi: `asOf` ISO, Decimal strings `overdue`, `upcoming`, `noDueDate`, `unallocated`, `debtTotal`, `creditBalance`; boolean `requiresReconciliation`. Bu joriy qoldiqning aging holati, from/to bilan historical aging emas. Sale debt qoldig‘i original dueAt bilan guruhlanadi; general opening/correction document settlement hali individual bo‘lmagani uchun unallocated. Negative group yoki legacy null-sale payment reduction aniqlansa taxminiy sale aging chiqarilmaydi: debtTotal unallocated va requiresReconciliation true. Buckets jami debtTotalga, debtTotal-creditBalance esa currentBalancega teng. Aging owner-only ledger snapshot ichida hisoblanadi; oldingi summary/pagination contract saqlangan. Debt CSVga shu current buckets qo‘shilgan.


### Ko‘chirma va eksport request limitlari

Owner ledger GET eksport formatlari (`csv`, `commercial-csv`, `html`) tashkilot+xodim kesimida umumiy 10 request/60s budgetga ega. Customer, davr yoki formatni almashtirish yangi budget ochmaydi. Oddiy ledger GET alohida 60 request/60s. Limit oshsa `429 RATE_LIMITED` va `Retry-After` (qolgan butun sekund) qaytadi; shu muddatdan keyin qayta uriniladi. Budgetlar PostgreSQL atomic counter bilan saqlanadi, process-local emas. Owner va tenant qoidalari saqlangan. Mavjud shared auth/operation rate-limit javoblari ham Retry-After headerini oladi; ularning o‘z window/limitlari o‘zgarmagan.

### Yangi hisoblar uchun yagona parol siyosati

Register, owner orqali staff yaratish, invitation orqali yangi hisob ochish va change-password bir xil `newPasswordSchema`dan foydalanadi:8..72 belgi, UTF-8 bo‘yicha maksimum72 bayt. `hashPassword` yordamchisi ham shu tekshiruvni bajaradi; uzun Unicode parol bcrypt tomonidan yashirin qisqartirilmaydi. Mavjud hashlar qayta yozilmaydi; loginning eski hisoblar bilan mosligi saqlangan.

Registerda validated phone bo‘yicha5 urinish/15min; faqat `TRUST_PROXY_IP=true` bo‘lsa trusted reverse proxy yuborgan `x-real-ip` bo‘yicha qo‘shimcha30/15min. Header yo‘q bo‘lsa shu rejimdagi `unknown` umumiy budgetga tushadi. Limit bcrypt va hisob/tashkilot yaratilishidan oldin tekshiriladi;429 RATE_LIMITED/Retry-After. Bu application budget; hosting/DDoS himoyasi alohida.

### Katalog va mijozlar CSV eksporti

`GET /api/products?organizationId=<UUID>&format=csv&search=...&categoryId=<UUID>` — owner/admin; cashier403. Mavjud active-product qidiruv va category filtri, tenant nazorati saqlangan. Asosiy/qo‘shimcha barkodlar, birlik, kategoriya, narx,6-decimal tannarx/minStock eksport qilinadi. `barcode` bilan CSV birga yuborilmaydi (400 INVALID_FILTER).

`GET /api/customers?organizationId=<UUID>&format=csv&search=...` — owner-only. Active mijoz qidiruviga mos ID/ism/telefon/manzil/credit limit va DebtEntrydan joriy net qoldiq; bu due aging yoki davriy ko‘chirma emas. Negative qoldiq ham aniq saqlanadi.

Ikkalasida page/limit satrlarni qisqartirmaydi: to‘liq filtrlangan count bir repeatable-read snapshotda tekshiriladi;10000dan oshsa413 EXPORT_TOO_LARGE va fayl berilmaydi. JSON data.filename/content, UTF-8 BOM/CRLF, quote/newline/formula injection himoyasi, numeric Decimal ustunlar. Catalog va customers export alohida organization+user10/min budget. UI tugmalari mavjud filtrlarni yuboradi va Blob download/error holatini ko‘rsatadi. XLSX/import/archived export bu bosqichga kirmaydi.

### To‘liq savdo va mahsulot hisobotlari CSV

`GET /api/reports/sales?...&format=csv` va `/api/reports/products?...&format=csv` — mavjud organization/store/startDate/endDate qoidalari; productsda categoryId ham qo‘llanadi. Tenant/assigned branch/role saqlangan. JSON data.filename/content; UI hisobot CSV tugmasi ayni date/store filtrlarini yuboradi. Har biri to‘liq natija, UI paginationdan mustaqil,10000 cap/repeatable-read/Decimal/formula protection. Ikkalasi organization+user bo‘yicha bitta report.export10/min budgetni va umumiy report.read60/min limitni sarflaydi.

Sales CSV davr ichida yakunlangan savdolar va davr ichida qaytarilgan tovar hodisalarini alohida satr/ustunlarda beradi. Davrdan oldingi original savdoning davr ichidagi returni ham kiradi. Yalpi savdo, returned goods value va gross-minus-return sof tovar tushumi metadata bor; bular actual cash flow emas. Products CSV mavjud signed sales/returns SQLdan sof quantity/revenue/historical cost/gross profit chiqaradi. Eski client faqat joriy50 satrni CSV qilishi olib tashlandi. XLSX, scheduled/background export va PDF reports hali alohida ishlar.

### POS tezkor tugmalari va chek nusxasi

POS: F2 qidiruv fokus; F4 qidiruv/category filtrlarini tozalash; F9 bo‘sh bo‘lmagan savat uchun payment oynasi (smena yo‘q bo‘lsa open-shift oynasi); Esc payment/receipt oynasini yopish. Tugmalar automatic financial posting qilmaydi. Local recovery tayyor bo‘lmasa, processing/unknown checkout, boshqa dialog yoki boshqa editable fieldda shortcut cheklangan; key repeat/composition/modifier holatlari tashlanadi.

ReceiptPreviewda58/80mm tanlov. Brauzer printi faqat chek DOMidan isolated iframe yaratadi; qog‘oz eni va297mm sahifa CSSi beriladi, actual driver sozlamasi print dialogda tanlanadi. Detaildan ochilgan chek CHEK NUSXASI/FISKAL EMAS; draft QORALAMA. Original cashier name/ID va organization-timezone sana, payments kirim/chiqim belgisi. Print so‘ralgani fizik printer muvaffaqiyati deb ko‘rsatilmaydi va yangi Sale/Payment yaratmaydi. Real printer/fiscal/SDK integratsiyasi yo‘q.

### Audit tarixi append-only migration

`202610060016_audit_history_guards` bazada AuditLog UPDATE/DELETEni taqiqlaydi, organization/time/id indeksini qo‘shadi. Organization cascade delete va haqiqiy User delete uchun existing actorId→null anonimlashtirish istisnolari saqlangan; oddiy actorId o‘zgartirish rad. Deploymentda migration avval qo‘llanadi: readiness endi016 finished holatini talab qiladi. Bu runtime DB guard, superuser yoki table owner vakolatini almashtirmaydi; retention/security event model alohida.

### Parolni xavfsiz almashtirish

Mavjud `POST /api/auth/change-password` body `{currentPassword,newPassword}` strict: yangi parol8..72 belgi va UTF-8 bo‘yicha72 baytdan oshmaydi (bcrypt truncation oldini olish). Current password tekshiruvi, existing5/15min user budget va CSRF saqlangan. Hash hisoblanganidan keyin transactionda User/Session row lock, live session/user va original hash qayta tekshiriladi; parallel request oldingi parol bilan yangi natijani bosib ketolmaydi. Muvaffaqiyatli password update, barcha user session revokelari va password_changed audit bir transactionda. Cookie tozalanadi. Auditga parol yoki hash yozilmaydi.

`/security` sahifasida current/new/confirm password form mavjud; mismatch clientda rad etiladi. Joriy organization/user/device scoped pending/conflict operations bo‘lsa UI almashtirishni bloklaydi; local queue read xatosida ham HTTP yuborilmaydi. Lokal amallar o‘chirilmaydi va parollar offline queuega yozilmaydi. Successdan keyin auth state yangilanadi va login sahifasiga o‘tiladi. Tarmoq uzilgach server committed bo‘lishi mumkin; retrydan oldin yangi parol bilan loginni tekshirish kerak. Bu password change, parolni unutganda reset/delivery integratsiyasi emas.

### Shaxsiy faol sessiyalar

`GET /api/auth/sessions?page=1&limit=20` — barcha rollar uchun faqat joriy foydalanuvchining barcha bizneslardagi revoked bo‘lmagan va absolute/idle muddati tugamagan sessiyalari. `data` satri: `id`, `organizationId`, `createdAt`, `expiresAt`, `idleExpiresAt`, `current`; token/tokenHash yoki boshqa user profili yo‘q. Pagination default20/max200, count va rows repeatable-read snapshotda. User bo‘yicha60/min limit.

`POST /api/auth/sessions` body `{sessionId: UUID}` — faqat shu userning boshqa sessiyasini bekor qiladi. Boshqa user target404; joriy session409 CURRENT_SESSION (mavjud logoutdan foydalaning). Takroriy bekor qilish200, actual revoke va audit yozuvi bitta tranzaksiyada, parallel retry qo‘shimcha audit yaratmaydi. User bo‘yicha30/min limit; mavjud session/CSRF/no-store himoyalari amal qiladi. Sessiya bekor bo‘lgach keyingi so‘rovi401. `/security` barcha rollarga menyudan ochiladi; qurilma turi/IP/location saqlanmagan va taxmin qilinmaydi. Bu active session boshqaruvi, to‘liq security-event tarixi yoki login notification emas.

### Audit tarixi summary

`GET /api/audit?view=summary&page=1&limit=50` — faqat owner uchun. Ixtiyoriy exact-match filtrlar: `entityType`, `action` (100 belgigacha), `entityId`, `actorId` (UUID); `from`/`to` tashkilot timezone bo‘yicha date range, oxirgi kun to‘liq kiradi. Javob `data` va `pagination`; rows createdAt descending/id ascending. Count va rows bir repeatable-read snapshotdan. Summary DTO `id`, `actorId`, `entityType`, `entityId`, `action`, `createdAt`, nullable `actor.fullName` maydonlariga ega. Before/after payload, IP va xodimning boshqa ma’lumotlari berilmaydi. Tashkilot+xodim uchun60/min limit, oshsa429/Retry-After. `view` berilmagan audit API ham owner-only va ayni filtr/snapshot/umumiy60/min budget bilan ishlaydi; ownerga qo‘shimcha organizationId/beforeData/afterData qaytadi. IP manzil chiqarilmaydi, payload existing recursive API sanitizationdan o‘tadi. Admin endi org-wide raw auditga kira olmaydi: audit yozuvlarida ishonchli filial scope yo‘q. Noma’lum view400 INVALID_VIEW; haddan tashqari pagination offset400 INVALID_PAGINATION. View almashtirish budgetni yangilamaydi.

Owner `/audit` sahifasini menyudan ochadi; filtrlar,50 tadan pagination va loading/error/retry mavjud. Bu yozilgan audit hodisalari tarixi; har bir tizim hodisasi qamrab olingan yoki alohida security-event bildirishnomasi yaratilgan degan da’vo yo‘q.

### Hisobot request limitlari

`GET /api/reports/sales`, `/products`, `/dashboard`, `/reconciliation` tashkilot+xodim kesimida umumiy 60 request/60s limitdan foydalanadi. Reconciliation qo‘shimcha 10 request/60s limitga ega; ikkala limit ham amal qiladi. Endpoint, davr, filial yoki reconciliation `kind` parametrini almashtirish yangi budget ochmaydi. Vakolat va tenant/filial reference tekshiruvlari limitdan oldin bajariladi. Limit oshsa `429 RATE_LIMITED`, private/no-store va `Retry-After` qaytadi. Hisobot natijalarining mavjud scope va hisoblash qoidalari saqlangan.

### Qaytarilgan tovar holati

`GET /api/sales/:id/returns?page=1&limit=20` — savdoga tegishli qaytarishlar tarixi. Mavjud Sale tenant/branch/own-cashier scope amal qiladi; kassir faqat vakolatdagi o‘z savdosi tarixini o‘qiydi, qaytarish yaratish uchun manager talabi saqlanadi. Limit 1..200; default20. JSON `data` array va `pagination` (`page`, `limit`, `total`, `totalPages`) qaytadi. Qatorlar returnedAt/id kamayish tartibida, count va qatorlar bir repeatable-read snapshotdan.

Har hujjat `id`, `returnReceiptNo`, `returnedAt`, `status`, `refundAmount` Decimal string, `reason`, minimal `processor.fullName` va `items` qaytaradi. Itemda `id`, `saleItemId`, `quantity`, `lineTotal`, `disposition`, original chekning `saleItem.productName/sku/unit` qiymatlari bor; joriy katalog nomi tarixni o‘zgartirmaydi. Parol, token, tannarx yoki keraksiz xodim profili berilmaydi. Savdo detail ekranida pagination, loading/error/retry mavjud; qaytarish success/replaydan keyin tarix yangilanadi. Qiymat tovar qaytarish summasi, naqd refund summasi deb talqin qilinmaydi.

`POST /api/sales/:id/returns` mavjud `items[].disposition` maydonini qabul qiladi: `sellable` sotiladigan qoldiqqa qaytaradi; `damaged` va `write_off` qaytarish hujjatida saqlanadi, sotiladigan qoldiqni oshirmaydi. Maydon berilmasa mavjud `sellable` default saqlanadi. Savdo detail ekranida har bir qator uchun shu uch tanlov bor. Alohida brak omboriga ko‘chirish hozir amalga oshirilmaydi. Refund va debt hisoblari tovar holatidan qat’i nazar original chek qoidalari bo‘yicha; manager vakolati, ochiq smena va idempotency talablari saqlangan.

Qaytarish UI so‘rovni HTTPdan oldin mavjud IndexedDB operations storega `sale.return` sifatida saqlaydi (`saleId`, original `operationId`, `shiftId`, `reason`, `items`). Scope tashkilot+foydalanuvchi+qurilma. Noma’lum natija/reload holatida ayni savdo oynasi asl payloadni tiklaydi, maydonlarni qulflaydi va “Oldingi qaytarishni tekshirish” tugmasini ko‘rsatadi. Original operation serverda committed bo‘lsa, eski smena yopilgan va savdo returned bo‘lganidan keyin ham bir xil payload bilan replay oldingi natijani qaytaradi; yangi posting uchun mavjud ochiq smena talabi saqlanadi. Local save muvaffaqiyatsiz bo‘lsa HTTP yuborilmaydi; local recovery xatosi yangi amalni bloklaydi. Server successdan keyin local synced acknowledgment yoziladi. Birinchi aniq validation/business rad javoblari rejected sifatida yopiladi; noma’lum natijadan keyingi retry rad javobi asl intentni yo‘qotmaydi. Mavjud sync contract o‘zgarmagan.

### Arxiv, yetkazib beruvchilar va ombor jurnali

`GET /api/products`, `/api/customers`, `/api/categories`, `/api/suppliers` uchun `status=active|archived|all` filtri bor; default `active`. Arxiv va `all` faqat owner/admin uchun; cashier `403`. Tashkilot ID majburiy, boshqa tashkilot `403`. `/archive` sahifasida mahsulot/mijoz/kategoriyani arxivlash va tiklash mavjud: `PUT /api/:kind/:id {"isActive":false|true}`. Bu tarixni o‘chirmaydi. Kategoriya arxivi mahsulotlarga kaskad qilmaydi. Mijoz PUT/DELETE arxivlashdan oldin Customer row lock ostida DebtEntry net qoldig‘ini tekshiradi: qarz yoki avans nol bo‘lmasa `409 CUSTOMER_HAS_BALANCE`; qarz yozuvlari o‘chirilmaydi. Tiklashga qoldiq to‘siq emas.

Kategoriya va supplier GET eski parametrsiz faol array kontraktini saqlaydi. `page`, `limit` yoki `status` (supplierda `search` ham) berilsa `data` va `pagination` qaytadi; default20, limit1..200, stable ID tie-break va repeatable-read snapshot. Mahsulot/mijoz paginated list ham count bilan bir snapshotdan olinadi. Supplier `search` nomi (case insensitive), telefon yoki STIRni qidiradi; maksimum200 belgi. `/suppliers` sahifasida yaratish/tahrirlash/arxiv/tiklash bor. POST/PUT name2..200 (trim), phone/tin64, address500, note2000 belgi bilan cheklangan; supplierga bog‘liq xarid hujjatlari saqlanadi.

`GET /api/inventory/movements?organizationId=...` owner/adminga jurnal qaytaradi; admin faqat assigned filiallarga kira oladi. Filtrlar `storeId`, `productId`, `movementType`, `sourceType`, `sourceId` (UUID), `from`, `to`; page1/limit50 default, limit1..200. `from/to` tashkilot vaqt zonasida, sana ko‘rinishidagi `to` butun kunni qamraydi. Qatorlar `occurredAt desc, id asc`, count va qatorlar repeatable-read. Musbat/manfiy `quantityDelta` va `unitCost` Decimal strings. Mahsulot nomi/birligi joriy katalog qiymati; tarixiy nom snapshoti degan da’vo yo‘q. `/inventory/movements` ekrani filtrlash/pagination/error/retry beradi. Jurnal read budget60/min organization+user; export10/min alohida.

### Qo‘shimcha to‘liq CSV eksportlari

Quyidagi GET endpointlarda `format=csv` JSON `{success:true,data:{filename,content}}` qaytaradi. Eksport UI paginationiga bog‘liq emas, barcha filtrlangan qatorlarni bitta repeatable-read snapshotdan oladi. Har format cap10000; oshsa `413 EXPORT_TOO_LARGE`, partial file berilmaydi. UTF-8 BOM/CRLF, matn formulalariga/quote/newlinega himoya; trusted Decimal numeric cells pul2, qty/cost6 kasr. Vaqt ustunlari UTC ISO deb belgilangan. Download mavjud Blob API bilan; vendor integration yo‘q.

| Endpoint | Vakolat va filtr | Ustunlar / limit |
| --- | --- | --- |
| `/api/suppliers` | owner/admin; organizationId, status, search | ID, nom, telefon, STIR, manzil, izoh, faol; supplier.export10/min |
| `/api/inventory/movements` | owner/admin; scoped branch va yuqoridagi jurnal filtrlar | Sana, filial, mahsulot/joriy birlik, signed delta, unit cost, source/actor/note; inventory.export10/min |
| `/api/shifts` | owner/admin; registerId, storeId, status=open/closed, from/to (openedAt) | Filial/kassa/xodim/times/openingCash va frozen close amounts; open expected/count/difference unknown bo‘lsa bo‘sh; shift.export10/min |
| `/api/audit` | owner only; mavjud entity/action/actor/date filtrlar | Faqat summary ID/time/actor/resource/action; beforeData/afterData/IP yoki token chiqarilmaydi; audit.export10/min + audit.summary60/min |

Budget organization+user kesimida; filtr/filial/sessiya almashishi uni yangilamaydi. Limit429 va Retry-After. `/suppliers`, `/inventory/movements`, `/shifts`, `/audit` ekranlarida CSV tugmasi bor; smena tugmasi joriy register tarixini eksport qiladi, API boshqa date/store filtrlarni ham qo‘llaydi.

### Chek chop etish so‘rovi auditi

`POST /api/sales/:id/print-requests` strict body: `{"operationId":"UUID","width":58|80,"copy":true|false}`. Sale tenant/branch/own-cashier scope, live session, CSRF va30/min organization+user budget. `runOperation` Serializable transactionda Operation va `receipt_print_requested` AuditLog yozadi. Parallel/same-key/same-body replay bitta audit va bir xil natija `{saleId,operationId,requested:true}` qaytaradi; changed width/copy/payload409. Sale/payment/stock o‘zgarmaydi. Audit print **so‘rovi**, fizik printer/fiskal muvaffaqiyat tasdig‘i emas.

Receipt UI audit muvaffaqiyatidan keyin isolated browser iframe ochadi; transport xatosida ayni in-memory operationId/width/copy/markup saqlanadi va paper tanlovi qulflanadi. Retry original intentni yuboradi. Reload bu nomoliyaviy in-memory intentni tiklamaydi; keyingi explicit chop etish yangi so‘rov hisoblanadi. Real hardware yoki tashqi yuborish endpointlari qo‘shilmagan.

### Katalog boshqaruvi: kategoriya, birlik va barkod

`/products/categories` — kategoriya yaratish/tahrirlash/tartiblash/arxiv/tiklash va qidiruv. POST/PUT kategoriya nomi trim qilinadi, 2..200 belgi; sortOrder PostgreSQL Int diapazonidagi butun son (`-2147483648..2147483647`). Noto‘g‘ri kirish400. `GET /api/categories` qo‘shimcha `search` (nom, case insensitive, max200) oladi; search/status/page/limit berilganda stable sortOrder/id va snapshot pagination. Eski faqat organizationId bilan active array kontrakti saqlanadi. Kategoriya daraxti, brend yoki yangi nested model bu bosqichda yaratilmagan.

`GET /api/units?status=all|active|archived&search=...&page=...&limit=...` — kod/nom bo‘yicha qidiruv, default status=all, page1/limit200 (eski chaqiruvga mos), limit1..200. Count va qatorlar repeatable-read, sort name/id. `pagination` har doim bor; 200 dan keyingi qatorlar explicit keyingi page bilan olinadi. `/products/units` management20/page, qidiruv/holat/oldingi-keyingi/retry beradi. Mavjud create/update va ishlatilgan birlik aniqligi/faol holatini o‘zgartirishga qarshi guard saqlangan; unit conversion qo‘shilmagan.

`GET /api/products/:id/barcodes?search=...&page=...&limit=...` — default page1/limit200, stable primary desc/createdAt asc/id asc, snapshot total. Search value bo‘yicha, max200. Product detailda50/page qidiruv/pagination/retry; qo‘shish/o‘chirish va primary deletion guard saqlangan. Kassir scoped read qiladi; mutation yoki exportga vakolati yo‘q. Vendor scanner protokoli yoki barcode label encoder qo‘shilmagan.

Uchala GET uchun `format=csv` manager-only `{filename,content}` qaytaradi: kategoriya ID/name/order/active; birlik ID/code/name/precision/active; barkod ID/productId/value/primary. UI page eksportni cheklamaydi; snapshot cap10000 va text formula/quote/newline himoyasi. Alohida organization+user budget: category.export/unit.export/barcode.export10/min; filtrlash/qurilma/sessiya budgetni yangilamaydi. Unknown format400, katta natija413, budget429 Retry-After.

### Supplier kartasi va ombor hujjatlari tarixi

`GET /api/suppliers/:id` — owner/adminga shu tashkilotdagi faol yoki arxivlangan kontakt kartasi. `/suppliers/:id` sahifasi telefon/STIR/manzil/izoh/holat, hujjat tarixi va xarid qiymatini ko‘rsatadi. Ro‘yxatdagi supplier nomidan shu kartaga o‘tiladi.

`GET /api/suppliers/:id/purchases` — supplierga bog‘langan **ombor hujjatlari**, to‘lov ledgeri emas. Filtrlar `storeId`, `from`, `to`, `status=draft|confirmed`, `documentType`, `search` (hujjat raqami). Default20/page; limit1..200; createdAt desc/id asc, count va rows repeatable-read. `from/to` organization timezone va document **createdAt** bo‘yicha. Admin faqat assigned branch hujjatlarini ko‘radi. Minimal store, reversal link va items/product name/unit qaytadi; narx/miqdor Decimal strings. Supplier ID path bilan qat’iy bog‘langan; q.supplierId boshqa shu-tenant ID bo‘lsa400 SUPPLIER_FILTER_CONFLICT (cross-tenant reference avval404). supplier.history60/min organization+user. Card UI status/raqam/date/branch/paging/error/retry va supplier tarixi CSV tugmasiga ega.

Supplier tarixi CSV alohida takrorlangan hisoblashga ega emas: `GET /api/stock-documents?organizationId=...&supplierId=:id&...filters&format=csv` mavjud umumiy hujjat eksportini ishlatadi. CSV barcha filtrlangan hujjat qatorlarini, qarshi hujjat va signed miqdorni chiqaradi; UI paging cheklamaydi.

`GET /api/suppliers/:id/purchase-totals?storeId=...&from=...&to=...` — confirmed purchase va faqat purchasega tegishli confirmed reversal hujjatlarining qiymati. Har hujjat o‘z **createdAt** davriga kiradi: oldingi davr xaridining joriy davrdagi qarshi hujjati ham joriy davrni kamaytiradi. Draft/adjustment/other kinds kirmaydi. Status/documentType/search bu fixed-summary APIga berilsa400 INVALID_TOTAL_FILTER. API SQL Decimal hisob bilan `{purchases,reversals,purchaseValue,reversalValue,netPurchaseValue,basis:"confirmed_documents_created_at",currency}` qaytaradi; summalar string2 kasr. Har qator `ROUND(quantity*unitCost,2)` qilib keyin yig‘iladi; CSV line qiymati bilan mos, displayed gross−reversal=net. supplier.totals60/min budget. Bu supplier qarzi, haqiqiy pul to‘lovi yoki buxgalteriya ledgeri degan da’vo yo‘q. UI yig‘indi date/branch bo‘yicha, row status/search filtridan mustaqilligini aniq yozadi. History va totals alohida read snapshotlar; parallel yangi hujjatda bir sahifadagi ikkala natija bir vaqtda olingan degan kafolat berilmaydi, “Qayta yuklash” ikkalasini yangilaydi.

### Ombor hujjati va transferlar uchun filtr/pagination/CSV

`GET /api/stock-documents` organizationId bilan `storeId`, `supplierId`, `documentType=purchase|adjustment|transfer_out|transfer_in|return_in|reversal`, `status=draft|confirmed`, `search` (documentNo,max200), `from/to` (createdAt) oladi. Invalid type/status/date400. Stable createdAt desc/id asc, default20/page, repeatable-read count+rows. `/inventory` hujjat tabida shu filtrlar, current branch, page20, error/retry va CSV mavjud. Moliyaviy confirm/reverse/create xizmatlari o‘zgarmagan.

`GET /api/transfers` organizationId bilan `fromStoreId`, `toStoreId`, `status=draft|sent|received|closed|cancelled`, `from/to` (createdAt) oladi. Admin scoping ikkala filialga tatbiq etiladi; hidden reference404. Stable createdAt desc/id asc, snapshot count+rows,20/page default. `/inventory/transfers` shu filtrlar/page20/error/retry beradi. CSVda planned qty, received qty, source-returned qty, **unallocated** qty=planned−received−returned va cost6 chiqariladi. Unallocated qty draft/cancelled holatda jismoniy transit qoldig‘i deb talqin qilinmaydi.

Ikkala GET `format=csv`da bitta qator/item formatida to‘liq filtrlangan eksport beradi; itemsiz legacy/test hujjati bir metadata qatori bilan saqlanadi. Cap10000 **output rows** va parent count, shuning uchun21×500-item hujjat20/page bo‘lsa ham eksport413 qaytaradi, qisman fayl bermaydi. Stock CSV document times/type/status/original/reversal link/current product/unit/signed qty/cost6/line value2/note beradi. CSV formula/quote/newline himoyasi; UTC vaqtlar label bilan. Budget stock-document.export va transfer.export10/min. Supplier history eksporti umumiy stock-document budgetni ishlatadi.

### Qoldiq eksporti va snapshot

`GET /api/inventory/balances` qo‘shimcha `search` (current name/SKU/main barcode,max200), page/limit oladi; store/category/lowStock filtrlar saqlangan. lowStock faqat true/false, noto‘g‘ri qiymat400. Low-stock `minStock>0 && quantity<minStock`; teng qoldiq low-stock emas. Endi SQL keys/count va ORM details bir repeatable-read transactionda; oldingi ikki alohida snapshot orasidagi race olib tashlandi. Stable updatedAt desc/storeId/productId; ORM details max500 keys per batch, mapping linear Map, transaction timeout15s.

`format=csv` current scoped store/product balance uchun full cap10000, inventory-balance.export10/min. Qatorlar store/product IDs va names/SKU/barcode/category/unit/active, qty6, minStock6, min-threshold shortage6, current cost6, current valuation2 va updatedAt UTC. Yo‘q InventoryBalance qatori avtomatik yaratilmaydi; eksport mavjud scoped balance rowsni chiqaradi. Valuation current catalog moving-average cost, checkout historical cost yoki cash income emas. `/inventory` qoldiq tabida20/page, qidiruv/low-stock va CSV bor.

CSV valuationda NUMERIC(20,6)×NUMERIC(20,6) uchun lokal50-digit Decimal clone ishlatiladi; global Prisma.Decimal precision o‘zgarmaydi. Shortage ham shu aniq arithmeticdan. Katta miqdor/costdagi pastki kasrlar floating-point yoki default20-digit multiplication sabab yo‘qolmaydi. API code/schema/hardware vendor contract taxminlari yo‘q.

### Savdo contracti: tekshiruvlar va yozilgan tarix himoyasi (2026-10-06)

`POST /api/sales` narx, tannarx, birlik va kassirni katalog/sessiondan oladi. Clientdagi `unitPrice`, `unitCost`, `unit` va jami summalar hisob manbasi emas. Bir mahsulotning takror qatorlari miqdor va qator chegirmalarini qo‘shib, productId tartibida bitta snapshotga birlashtiriladi. Har original qator uchun birlik precision tekshiriladi: masalan, dona uchun ikkita `0.5` qator ularni qo‘shib `1` olish bahonasida qabul qilinmaydi. Birlashtirilgan miqdor/summa ham schema chegarasidan oshmasligi kerak. Narx override oqimi mavjud emas; client narxi server narxini almashtirmaydi.

Yaroqsiz son, bo‘sh savat va schema xatosi `400 VALIDATION_ERROR`; katalog summasidan katta qator yoki chek chegirmasi `409 INVALID_DISCOUNT`; vakolat chegirmasi `403 DISCOUNT_LIMIT`. `NaN`/`Infinity`/yaroqsiz decimal exception sababli `500`ga aylanmaydi. Yakunlashda joriy rolning chegirma limiti qayta tekshiriladi; qoralama yaratilgandan keyingi siyosat o‘zgarishi eski ruxsatni saqlab qolmaydi. Mavjud draftda price/unit conflict bo‘lsa savat yangilanadi.

`POST /api/sales/:id/complete` uchun original operationId va original payload saqlanadi. Bir xil replay original natijani qaytaradi, boshqa payload `409 OPERATION_PAYLOAD_CONFLICT`. `GET /api/operations?organizationId=...&type=sale.complete&operationId=...` commitdan keyingi uzilgan javobni aniqlash uchun original sale IDni beradi. Unknown javobda yangi kalit bilan boshqa savdo ochilmaydi; mavjud offline queue/retry UI ishlatiladi. Sale/payment/debt/stock/audit/operation bitta Serializable transactionda; auditning oxirgi yozuvi xato bo‘lsa ham oldingi to‘lov va qoldiq o‘zgarishi rollback bo‘ladi.

Migratsiya `202610060017_sale_history` completed/partially_returned/returned Sale snapshotlarini va SaleItem qatorlarini DB trigger bilan edit/delete/adddan himoyalaydi. Store/register/shift/product cascade orqali tarixni yashirin o‘chirish ham rad. Mahsulot va mijoz uchun arxivlash oqimi ishlatiladi. Butun tashkilotni o‘chirishdagi existing cascade saqlanadi; bu yangi public delete endpoint emas. Sale status faqat originalga bog‘langan return va uning miqdorlariga mos holatga o‘tadi; completed chekning izohi, kassiri, summasi, tannarxi yoki qatorlari o‘zgarmaydi. Qaytarish yangi SaleReturn va audit hujjati bilan yuritiladi.

`202610060018_sale_item_lock` child yozishlarda parent Sale row lockini oladi: qoralama tahriri checkout tugashini kutgan bo‘lsa, lockdan keyin yangilangan status bilan qayta tekshirilib rad etiladi. Oldin qo‘llangan migratsiya o‘zgartirilmaydi. Chek chegirmasi original qator snapshotlariga deterministik largest-remainder bilan taqsimlanadi; partial returns shu qiymatlarni va oxirgi qismdagi rounding qoldig‘ini ishlatadi.

### Moliyaviy hisobotlarning umumiy contracti (2026-10-06)

`GET /api/reports/sales`, `/products`, `/dashboard`: `organizationId`, vakolatli `storeId`, `startDate`, `endDate`, ixtiyoriy `asOf` (offsetli ISO datetime). Dashboard `date`ni ham qabul qiladi; sana berilmasa biznesning mahalliy buguni. Date-only davr biznes timezoneidan UTCga o‘giriladi: start inclusive, keyingi kun boshi exclusive. Yaroqsiz sana yoki kelajakdagi cutoff400; boshqa tenant403, ruxsatsiz filial404.

Javob `meta`si `asOf`, timezone, currency, sanalar va filialni beradi. Savdo/jadval/dashboard/CSV bir shared filter va moliyaviy summarydan foydalanadi. Sahifalar uchun `page`/`limit`; global count va summary limitdan mustaqil. UI dastlabki javobning cutoffini keyingi sahifa va CSVga yuboradi; “Yangilash” yangi cutoff oladi. Dashboardning hisobotga havolasi ham shu sana/cutoffni tashiydi. CSV barcha mos yozuvlar uchun existing10000-row cheklovida, yashirin truncation yo‘q.

`grossRevenue` — davrdagi yakunlangan savdo summasi (chegirma hisoblangan); `refundAmount` — davrdagi qaytarishlar; `totalRevenue=grossRevenue-refundAmount`. `cashSales`, `cashDebtCollections`, `cashRefunds`, `creditSales` alohida; `cashPayments` — recorded cash in−out, qo‘lda pul amallarini ham qamrashi mumkin. Card/transfer ko‘rsatkichlari ichki recorded ledger, tashqi provayder settlement tasdig‘i emas. Eski davrdagi savdoga bugungi refund bugungi refund ko‘rsatkichiga kiradi. Mahsulot reportida COGS har original satr qty×unitCost va return reversal orqali hisoblanadi; katalogning joriy tannarxi tarixni o‘zgartirmaydi.

Har request repeatable-read snapshotda. Cross-request `asOf` economic event/createdAt cutoffidir, PostgreSQL snapshot tokeni yoki tarixiy katalog/inventory nusxasi emas; cutoffdan oldin boshlangan, keyin commit bo‘lgan transaction uchun alohida durable reporting snapshot talab qilinsa keyingi kengaytma kerak. Dashboard low-stock/open-shift `operationalCounts=current_snapshot`; topProducts gross sale-line reytingi, refund net mahsulot tahlili `/products`da. Joriy nom/kategoriya o‘zgarishi eski iqtisodiy snapshot narx/tannarxlarini o‘zgartirmaydi, lekin katalog sarlavhalari yangi bo‘lishi mumkin.

### Smena cash breakdown va tuzatish hujjati

`GET /api/shifts/:id` mavjud data bilan birga `cashSummary` beradi: `saleReceipts`, `debtCollections`, `refunds`, `manualIn`, `manualOut`, `cashIn`, `cashOut`, `bankDeposits`, `collections`, `correctionIn`, `correctionOut`, `paymentNet`, `movementNet`, `expectedCash`. Formula: openingCash+paymentNet+movementNet. Amountlar Decimal string; bankdeposit va inkassatsiya cash custody chiqimi, bank API orqali tasdiqlangan to‘lov emas.

`POST /api/shifts/:id/cash-movements` existing `cash_in`/`cash_out`dan tashqari manager-only `bank_deposit`/`collection`ni qabul qiladi. `amount` musbat2 kasrli string yoki valid number, `reason` majburiy, `operationId` UUID. Yopilgan smenaga yangi journal yozilmaydi; committed retry original natijani qaytaradi.

`POST /api/shifts/:closedId/corrections`: `{postingShiftId, direction:'cash_in'|'cash_out', amount:'3.50', reason, operationId}`. Owner/admin, original closed va yangi posting shift open, ikkala shift bir tenant/filialda. Original expected/counted/difference o‘zgarmaydi. Bitta transaction yangi signed ShiftCorrection, unga unique bog‘langan correction_in/out CashMovement, audit va operation yozadi. Bir key/payload replay bitta hujjat; o‘zgargan payload409. `GET .../corrections?page=1&limit=20` manager uchun scoped, stable paginated tarix va actor ismini qaytaradi.

Closed Shift, uning cash/payment tarixi, correction hujjati va correction cash yozuvi DBda immutable. Correction type uchun bog‘langan hujjat commit paytida majburiy; orphan cash correction rad. Organization lifecycle cleanup oldingi siyosatda qoladi. “Smenalar” UI oldingi smena hisobini ko‘rsatadi va manager correction yaratadi. `shift.cash`/`shift.correct` intentlar requestdan oldin IndexedDBga yoziladi; javob yo‘qolsa original payload saqlanib reload/manual retry orqali tiklanadi. Unknown intent maydonlari muzlatiladi, logout pending guard saqlanadi; bu amallar offline autosyncga kirmaydi.

### Qaytarma tasdig‘i va stock valuation

`POST /api/sales/:id/returns`: trim qilingan sabab majburiy; owner/admin vakolati serverda live qayta tekshiriladi. Yangi return `processedBy`, `approvedBy`, `approvedRole`, `approvedAt`, original sale/item linkni va auditni atomic saqlaydi. Approval bir martalik shu hujjatning manager amali; boshqa kassirga ko‘chirilgan reusable approval token emas. Legacy approval maydonlari NULL: tarixiy tasdiqlovchi taxmin qilinmaydi. Qisman approval DB CHECK bilan rad; completed return/item edit/delete/kechikkan child insert ham rad.

Return history javobi approval maydonlarini beradi. UI har qaytarma uchun escaped, CSPli80mm HTML chek nusxasini yuklaydi: original receipt ID, qaytarma raqami, sabab, actor/approval va frozen itemlar. Bu fiskal chek yoki printer hardware integratsiyasi emas; brauzerda ochib print/PDF qilish mumkin.

Global Product.costPrice siyosati vaznli o‘rtacha: `(oldQty*oldCost+incomingQty*incomingCost)/(oldQty+incomingQty)`, lokal50-digit Decimal va6 kasr. Sellable return incomingCost sifatida original saleItem.unitCostni oladi; zero stock original costga qaytadi; damaged/write-off available valuationni oshirmaydi. Manfiy aggregate stockda avtomatik valuation rad (`COST_RECONCILIATION_REQUIRED`); stockni yashirin tuzatmaydi. Product barcha filiallardagi available stock asosida baholanadi; FIFO/partiya layer hozir qo‘shilmagan. Replay stock yoki tannarxni ikkinchi marta o‘zgartirmaydi.

### Naqd tender/qaytim va optional sale metadata (2026-10-06)

`POST /api/sales/:id/complete` va `sale.complete` sync payloadi yangi optional `cashTendered` (valid money string/number)ni qabul qiladi. Applied cash = paymentType cash bo‘lgan qatorlar yig‘indisi. Server `cashChange=cashTendered-appliedCash`ni Decimal orqali hisoblaydi; tender applied cashdan kam bo‘lsa yoki naqd qism bo‘lmagan chekka musbat tender berilsa400 `INVALID_CASH_TENDER`. Paymentlar yig‘indisi oldingidek sale totalga teng bo‘lishi shart. Naqd paymentga tender emas applied cash yoziladi: total100000, tender120000, change20000, recorded cash100000. Mixed60000cash+40000card/credit uchun tender80000/change20000; debt faqat credit40000.

Sale javobi `cashTendered`, `cashChange`ni string/NULL sifatida beradi. Tender payload operation hashga faqat yuborilganda kiradi; bir keydagi o‘zgargan tender409. Legacy/missing tender ikkala maydonda NULL — tarixiy tender taxmin qilinmaydi. Posted receipt DB guard bu maydonlarni ham himoyalaydi. POS/receipt nusxasi haqiqiy tender va change hamda note/xizmatni ko‘rsatadi; cash summary va reports payment applied summasida qoladi.

`POST /api/sales` optional `sellerId` va `serviceType`ni qabul qiladi. Seller faol shu tenant a’zosi; kassir faqat o‘zini, manager vakolati bilan assigned branch doirasidagi sotuvchini belgilashi mumkin. Foreign seller404, kassir boshqa seller403; DB membership-chain trigger ham tenantni tekshiradi. Operator `cashierId` hali sessiondan olinadi; seller uni almashtirmaydi. `serviceType` trim1–100 belgi; note existing max2000. Optional maydonlarsiz checkout ishlaydi. POS joriy userni seller qilib belgilaydi, optional xizmat turi va chek izohini savat bilan saqlaydi. Existing draft PUT contracti alohida qolgan; yangi metadata checkout create paytida olinadi.

### Lokal navbat va haqiqiy server ulanish holati

POS `GET /api/health/ready` bilan haqiqiy server+DB readinessni tekshiradi; navigator.onLine faqat yordamchi. Probe timeout5s, uzilishda2/4/8/16/30s backoff, online30s interval; online/offline event va qo‘lda qayta tekshirish darhol uyg‘otadi. Faqat GET probe avtomatik takrorlanadi. Offline holatda savat saqlanadi, checkout blok; bu rezervga ega offline yakunlangan savdo deb ko‘rsatilmaydi. Readiness oxirgi `202610060023_sale_metadata` migratsiyasini ham talab qiladi.

`Navbatni sinxronlash` — operatorning explicit foreground amali. User+organization+device scope, persistent UUID, max25 commands; mavjud server idempotency asl natijani qaytaradi. Web Locks bir scoped navbatni bir nechta tabda parallel yuborishni cheklaydi; Web Locks bo‘lmasa server unique operation oxirgi duplicate himoya. Worker/background cash/vendor posting qo‘shilmadi. Response command IDlari, soni va holatlari yuborilgan batchga mos bo‘lmasa local acknowledge qilinmaydi. Unknown completion reload/retry/statusda original receiptga ulanadi; boshqa actor/tenant shu operationni ishlata olmaydi.

IndexedDB enqueue/read-modify-write bitta transaction; type/scope/payload conflict rad. Terminal synced/cancelled/rejected holat eski pending/conflict javobi bilan qayta ochilmaydi. clearScope operations+draftsni bitta transactionda tekshiradi: pending/conflict bor bo‘lsa hech narsa o‘chmaydi, logout shu guarddan o‘tmaguncha bajarilmaydi. Acknowledged tarix o‘z scopeida clear qilinadi; boshqa user/device scope saqlanadi. Draft envelope version1, eski versionless format qabul qilinadi, noma’lum versiya overwrite qilinmaydi. UI yangi scope hydrationigacha checkoutni bloklaydi va oldingi in-memory savatni tozalaydi.

Yangi draft customer email/address/qarz tafsilotlari va product tannarxi/nested supplierni persist qilmaydi; faqat savatga zarur identity/display/price/unit va customer identity/name/phone/limit. Session/token paroli storagega yozilmaydi. Bu browser origin/profile storageidir, XSS yoki shu profilga jismoniy kirishdan mutlaq account-level shifrlash kafolati emas. Server live membership/stock/price/debt/shift tekshiruvi authoritative; signed offline lease/reservation OFF-02.03/.04 alohida backlogda.

### Bounded transaction conflict

Economic `runOperation` serialization/deadlock va aniqlangan operation race uchun eng ko‘p3 urinish qiladi. Oxirgi retryable conflict `409 CONCURRENT_CONFLICT`; fresh biznes validation/permission bir marta rad, ko‘r-ko‘rona takrorlanmaydi. UI/operator original key bilan natijani tekshiradi; sync bunday conflictni pending qoldiradi. Tashqi provider charge/retry bu o‘zgarish doirasiga kirmaydi.

## Ombor boshlang‘ich qoldig‘i, ichki barkod va egalik tasdig‘i (2026-10-06)

`POST /api/stock-documents`: `documentType: "opening"` boshlang‘ich qoldiq uchun. Opening va adjustmentda `note` kamida 3, ko‘pi bilan 2000 belgi. Bir hujjatda takror productId rad. Opening musbat, adjustment esa musbat yoki manfiy, lekin nol emas. Miqdor va tannarxni aniq decimal string sifatida yuborish mumkin. Hujjat yaratish qoldiqni o‘zgartirmaydi; existing `/confirm` manager tasdig‘i bilan atomik posting qiladi. Opening faqat shu filial/mahsulotda oldingi harakat va noldan farqli qoldiq bo‘lmaganda mumkin. Keyingi o‘zgarishda adjustment ishlatiladi. Opening ham purchase kabi weighted-average tannarxni yangilaydi; existing `/reverse` asosiy hujjatni saqlab, qarshi hujjat yozadi. Insufficient stock, count freeze, tenant va unit precision himoyalari saqlangan. `InventoryMovement` UPDATE/DELETE taqiqlangan, yangi postingda source bo‘sh/nol delta/manfiy cost rad. Eski hujjatlarning yo‘q sababini taxminiy backfill qilmaymiz. `/api/inventory/balances` faqat GET; quantity CRUD mutatsiyasi 405.

- `POST /api/products/:id/barcodes/generate`, body `{ "operationId": "UUID" }`: owner/admin uchun ichki `INT-...` barkod. Operation bir xil actor/key/payload bilan qaytarilganda asl barkod keladi; mahsulot faol va joriy tenantga tegishli bo‘lishi kerak. Ichki kod GS1/EAN yoki fiskal identifikator emas.
- `GET /api/products/:id/barcodes/labels?barcodeId=UUID&copies=2`: owner/admin, 1–100 nusxa, 10 so‘rov/minut. `{ filename, content }` HTML artefakt; Code128 SVG bwip-js orqali, mahsulot/sku/kod matnlari HTML escaped. 80×35 mm browser print/PDF andozasi. Code128 uchun 2–64 printable ASCII belgi; mos kelmaydigan saqlangan kod uchun 422 `UNSUPPORTED_BARCODE_LABEL`, saqlangan kod o‘zgarmaydi. Bu real printer SDK/transport integratsiyasi emas. Fizik bosma sifati qurilma tasdiqlanganda alohida sinovlanadi.

`POST /api/organizations/:id/transfer-ownership`, body `{ "targetMembershipId": "UUID" }` endi **so‘rov yaratadi**. Faqat owner; target shu biznesdagi boshqa faol account/member. Javob pending OwnershipTransfer, 24 soat amal qiladi. Shu targetga takror so‘rov pending yozuvni qaytaradi; boshqa target uchun avval bekor qilish kerak. So‘rov yaratish rollarni yoki sessiyalarni o‘zgartirmaydi.

`GET /api/ownership-transfers` faqat joriy member yuborgan/qabul qiladigan, muddati tugamagan pending so‘rovlarni qaytaradi; `incoming` qabul qiluvchini bildiradi. `POST /api/ownership-transfers/:id`, body `{ "action": "accept" }` faqat qabul qiluvchiga; `{ "action": "cancel" }` ikki ishtirokchiga. Kassir shu cheklangan endpointlarda o‘z so‘rovini qabul/bekor qilishi mumkin, xodimlar/rol boshqaruvi unga ochilmaydi. Acceptance jonli sessiya va eski owner vakolatini qayta tekshiradi; target owner, yuboruvchi admin bo‘ladi. Ikkalasining eski biznes sessiyalari bekor qilinadi, qabul qiluvchiga yangi HttpOnly cookie beriladi; raw token JSON/auditga tushmaydi. Terminal so‘rov qayta o‘zgarmaydi, accepted request fresh sessiya bilan takrorlanganda economic/role side effect takrorlanmaydi. Accept javobi yo‘qolib eski cookie yaroqsiz bo‘lsa qayta login kerak. Audit: ownership_requested/cancelled/transferred. Last owner bloklash/demote parallel amallarda ham rad.

`POST /api/organizations/switch` faol membershipni organization locks ichida qayta tekshiradi, eski sessiyani bekor qilib yangi cookie beradi va organization_switched audit yozadi. UI pending sale bo‘lsa almashtirishni bloklaydi; keyin to‘liq sahifa qayta yuklanadi, filial/terminal eski tanlovi tozalanadi. Local cart org/user/device bo‘yicha saqlanadi: A savati Bda ko‘rinmaydi, A ga qaytilganda o‘z savati tiklanadi.

Yangi migratsiyalar: `202610060024_ownership_acceptance`, `202610060025_stock_journal_guards` (jami 26). `npm run db:migrate` release oldidan alohida bosqich; readiness 025 tugaganini talab qiladi. Build schema mutatsiyasini bajarmaydi. Real Click/fiscal/E-POS/hardware implementatsiyalari qo‘shilmadi.

## Xarid narxlari tahlili — PUR-01.06

`GET /api/reports/purchases` owner/admin uchun. Filtrlar: `view=history|comparison` (default history), `supplierId`, `productId`, `storeId`, `from`, `to` (biznes timezone bo‘yicha kalendar sana), `asOf` (ISO vaqt), `page`, `limit` (1–200). Filial va reference IDlar joriy tenant/vakolat bilan tekshiriladi. Kassir403; boshqa tenant yoki ruxsatsiz filial404. Report GET shared throttle, CSV esa qo‘shimcha export limit bilan.

JSON `{ success, data: { rows, summary, meta }, pagination }`. Summary `purchaseValue`, `reversalValue`, `netPurchaseValue` butun filtrli dataset bo‘yicha; sahifa limitiga bog‘liq emas. Narx, miqdor va jami JSON decimal string, cost hisobida floating-point ishlatilmaydi. Meta `asOf`, `timezone`, `currency`, `basis`, `names`, `view` hisob asosini bildiradi.

History tasdiqlangan purchase va aynan purchasega bog‘langan reversal qatorlari: line/document/source IDs, hujjat raqami, eventAt, legacyDate, filial, supplier/product, quantity/unitCost/value. Draft, opening va oddiy adjustment kirmaydi. Filtrlash confirmedAt bo‘yicha; legacy confirmedAt yo‘q bo‘lsa createdAt ishlatiladi va legacyDate=true bilan aniq belgilanadi. Price/quantity original StockDocumentItemdan, nomlar joriy katalogdan; joriy Product.costPrice hisobotga ta’sir qilmaydi.

Comparison product+supplier guruhlari: purchase/reversed/netQuantity, min/max/first/latestPrice, quantity-weighted averagePrice (6 kasr), purchase/reversal/netValue. O‘rtacha va trend faqat purchase qatorlari bo‘yicha; reversal miqdori/qiymati alohida, net qiymatda signed kamayadi. Reversal-only periodda purchase narxlar null. Turli mahsulot/birlik miqdorlari global jami sifatida qo‘shilmaydi. Qator qiymati ROUND(quantity*unitCost,2) bilan, jami shu yaxlitlangan qiymatlar yig‘indisi; weighted average xom quantity*unitCostdan hisoblanadi. Bu pul to‘lovi yoki supplier qarzi hisobi emas.

`format=csv` sahifalashdan mustaqil to‘liq tanlangan viewni qaytaradi, 10000 qator/guruhdan oshsa413 va qisman fayl yo‘q. Bounded CSV matn formulalari himoyalangan, raqamlar fixed decimal. UI `/reports/purchases`: supplier/product nom qidiruvi, sahifalangan tanlash (arxivlanganlar ham), filial/sana/view filtrlar, global jami va CSV. `asOf` event cutoff; cross-request durable DB snapshot deb va’da qilinmaydi.

Nasiya policy o‘zgarmadi: faol tenant/customer/session/own-or-authorized branch-shift, customer lock va creditLimit serverda; mijozsiz400, inactive customer404, limit409. Override/bank/provider yangi oqimi qo‘shilmadi. Credit Payment ichki obligation record, cash income emas; DebtEntry va cash/report oqimlari alohida.

## Xodimni arxivlash va tiklash (USR-01.01)

`PUT /api/organizations/:id/users/:membershipId` faqat joriy tashkilot egasiga. Oddiy body: `role`, `storeIds`, `isActive`; arxivlash uchun alohida `{ "action": "archive" }`, tiklash uchun `{ "action": "restore" }`. Action bilan boshqa maydonlarni aralashtirish validation xatosi. GET users javobida nullable `archivedAt` bor.

Arxivlash membershipni inactive qiladi, organization doirasidagi barcha sessiyalarni bekor qiladi va `membership_archived` auditini yozadi. User, savdo, payment, shift va filial biriktirishlari o‘chirilmaydi. Arxivlangan xodimni oddiy isActive/role/store update orqali o‘zgartirish `409 MEMBER_ARCHIVED`. Tiklash archivedAtni tozalaydi, lekin **bloklangan** holatda qoldiradi (`membership_restored`); owner vakolatlarini tekshirib alohida faollashtiradi. Eski cookie qayta ishlamaydi. Arxivda bo‘lmagan yozuvni restore qilish `409 NOT_ARCHIVED`. Oxirgi faol ownerni archive/block/demote qilish organization row lock ichida `409 LAST_OWNER`; begona membership404, non-owner403. Migration026 archivedAt nullable va archive→inactive CHECK qo‘shadi; mavjud bloklangan xodimlar avtomatik arxivlanmaydi.

## Chek counteri, konflikt va chop etish holatlari

`Sale.id` ichki UUID; `receiptNo` kassa doirasidagi atomik `Register.receiptSequence`dan `POS-1`, `POS-2`, … ajratiladi. Qoralama/create ham raqam oladi; bekor bo‘lgan qoralamalar sabab raqamlarda bo‘shliqlar bo‘lishi mumkin. Eski receiptNo o‘zgarmaydi. Bu fiskal raqam yoki huquqiy uzluksizlik kafolati emas. Nullable `Sale.fiscalReceiptNo` alohida reference boundary; hozir vendor yozish endpointi/chaqirig‘i yo‘q. Keyingi haqiqiy adapter uchun alohida fiscal history/append-only write policy tasdiqlanishi kerak; posted-sale guard hozir o‘zgarmagan.

Draft item ixtiyoriy `expectedUnitPrice` yuboradi; server ishonchli katalog narxi bilan mosligini tekshiradi, client narxini ishlatmaydi. Create yoki complete paytida `409 PRICE_CHANGED`ning `error.details`ida stage, productId/name, previousPrice/currentPrice bor. `409 INSUFFICIENT_STOCK` complete paytida requestedQuantity/availableQuantity qaytaradi. Decimal string sifatida, tannarx yo‘q. Payment/debt/movement/audit/operation rollback. POS konflikt paneli eski urinishni server proof bilan bekor qilib, katalog narxlarini yangilaydi va chegirmalarni tozalaydi; miqdor va to‘lov operator tomonidan qayta tasdiqlanadi. Kassir yaratilgan qoralamani rahbar bekor qilmaguncha o‘zi void qila olmaydi. Ulanish natijasi noma’lum bo‘lsa eski operation saqlanadi.

UI sale / integration / print bosqichlarini alohida ko‘rsatadi. `PRINT_REQUEST_FAILED` audit so‘rovi transporti; shu original print operation bilan retry. `PRINT_FAILED` brauzer print() chaqirig‘i xatosi; shu original sale ko‘rinishidan qayta chiqish. Ikkalasi ham sale/payment/stockni qayta yozmaydi. Brauzer jim cancel yoki fizik printer natijasini ishonchli tasdiqlamaydi; oynaning ochilishi faqat request holati. `INTEGRATION_UNAVAILABLE` kabi vendor-neutral boundary code uchun alohida panel; real provider sozlanmagan, taxminiy API yoki fake charge yo‘q.

## Smena yopish tasdig‘i va topshirish

`POST /api/shifts/:id`: countedCash (string/number, 2 kasr), note, ixtiyoriy operationId. Expected cash serverda row lock ichida hisoblanadi. Har qanday nonzero farq uchun kamida 3 belgili sabab talab qilinadi; approval threshold **0 so‘m**. Manager o‘zi sanab yopsa approvedBy o‘zi, countedBy o‘zi. Kassir farq bilan yuborsa status open va pendingClose (request ID, expected/count/difference, count actor, reason, date, snapshot fingerprint) qaytadi; close_approval_requested audit. Pending paytda requireOpenShift savdo va pul yozuvlarini SHIFT_CLOSE_PENDING bilan bloklaydi.

Owner yoki filialga vakolatli admin `POST /api/shifts/:id`ga pending countedCash va approvalRequestIdni yuboradi. Request/snapshot/amount mos bo‘lsa countedBy original kassir, approvedBy manager, closeReason original sabab bilan yopiladi va auditlanadi. Bekor qilingan/almashtirilgan so‘rov CLOSE_REQUEST_CHANGED; boshqa shiftga qayta ishlatilgan yangi key payload-conflict. Zero difference uchun approval shart emas. Ochiq drafts OPEN_DRAFTS va pending/unknown paymentlar UNRESOLVED_PAYMENTS bo‘lib yopishni bloklaydi.

`POST /api/shifts/:id/close-rejection`: requestId, operationId, reason (3–2000); faqat manager. Requestni tozalaydi, close_approval_rejected audit, kassir qayta sanaydi. Closed shiftga edit ruxsati yo‘q; mavjud correction journal saqlangan. Eski clientsning shift-id close keysi mos saqlangan; yangi UI requestlarda operationId ishlatadi.

`GET /api/operations/handover?registerId=…` shu organization/assigned branchdagi active register oxirgi smenasi closed bo‘lsa faqat id/count/closedAt qaytaradi. `POST /api/shifts` optional handoverFromId: qabul qiluvchi o‘z authenticated membershipi uchun yangi shift ochadi, register oxirgi closed shift bo‘lishi va openingCash old countedCashga aynan teng bo‘lishi shart. register lock, unique handoverFromId, audit handover_accepted; boshqa branch/tenant, stale shift yoki noto‘g‘ri summa rad. Eski shift egasi o‘zgarmaydi. Bu yangi tushum emas; new opening cash. OpenShiftModalda “Oldingi smenani qabul qilish” tanlovi bor.

## Boshlang‘ich qarzning hujjat bo‘yicha taqsimoti

`DebtEntry.debtOriginId` negative nonsale yozuvning original positive nonsale hujjatiga pointeri. FK+trigger organization/customer/positive origin invariantini tekshiradi. Eski unlinked yozuvlar avtomatik taqsimlanmaydi. Collection allocations contract: `{saleId, debtOriginId?, amount}`; saleId nonnull bo‘lsa debtOriginId bo‘lmaydi. Original opening document uchun `{saleId:null,debtOriginId:openingEntryId,amount:"50.00"}`. Jami payment amountga teng, duplicate target yoki target qoldig‘idan oshish rad; barcha yozuvlar customer lock bilan atomik va idempotent.

FIFO effectiveAt va deterministic target key bo‘yicha sale hamda individual opening hujjatlariga ajratadi. Customer debt targetsPage itemsda debtOriginId/sourceType/dueAt/legacyUnallocated qo‘shildi, UI har hujjatni alohida tanlaydi. Nonsale decrease/write_off uchun debtOriginId optional; bitta target bo‘lsa avtomatik, bir nechta bo‘lsa DEBT_TARGET_REQUIRED bilan aniq tanlov so‘raladi. Ledger JSON/CSV/HTML original debtOriginIdni ko‘rsatadi.

Aging yangi hujjatlarning original dueAtidan qolgan summani oladi. Eski nonsale negative yozuvda proven link yo‘q bo‘lsa umumiy guruh saqlanadi, requiresReconciliation=true, debtTotal unallocated sifatida ko‘rsatiladi; overdue taxmin qilinmaydi. Barcha debts net balance, statement opening/closing/running va commercial sales/returns/payment eksporti mavjud exact NUMERIC hisobini ishlatadi. Joriy aging va sana bo‘yicha statement davri alohida.

`IntegrationUnavailable` boundary xatosi HTTP503 / `INTEGRATION_UNAVAILABLE` bilan qaytadi. Vendor chaqiruvi yoki taxminiy endpoint qo‘shilmagan; UI integration bosqichini sale va printdan alohida ko‘rsatadi.

## Core monitoring, recovery va sync review (2026-10-06)

- GET `/operations/overview`: role home, scoped server draft/open shift/pending-close/incident/conflict counts. Cashierga owner incident summasi berilmaydi; fiscal status faqat `not_configured` boundary.
- GET `/incidents?page=1&state=open|resolved`: owner/admin assigned-store20-row pagination. POST `{operationId}` reconciliationni idempotent ishga tushiradi. POST `/incidents/:id` `{operationId,reason}` — manager, live scope; discrepancy qolgan bo‘lsa409 `DISCREPANCY_REMAINS`; yo‘q bo‘lsa resolution actor/time/reason+audit. Scanner iqtisodiy historyni o‘zgartirmaydi. Evidence numeric qiymatlari Decimal string.
- POST `/inventory/thresholds`: `{storeId,productId,minimum,maximum,operationId}` manager, NUMERIC20,6, min≥0/max≥min, FK/tenant guard. GET `/reports/replenishment?page&limit`: active scoped branches/products; zero/missing balances, minimum fallback Product.minStock, maximum mavjud bo‘lsa max−current; sahifalangan exact string natija. Purchase/stock reservation yaratilmaydi.
- POST `/sync`: mavjud command contract. Nonretryable reject server `SyncReview`ga source payload/hash/actor/key/code va audit bilan saqlanadi; failed command `conflict` hamda reviewId qaytaradi. `INTERNAL_ERROR/CONCURRENT_CONFLICT` pending bo‘lib qoladi. API validation/tenant guarddagi to‘liq batch reject iqtisodiy success deb belgilanmaydi; local source saqlanadi.
- GET `/sync/reviews?page`: owner organization scope yoki cashier own actor. Adminga unrestricted raw payload list berilmaydi. POST `/sync/reviews/:id` `{operationId,reason}` owner yoki explicit source branchga vakolatli manager; original operation terminal record yoki original draft authorized void proof talab qiladi. Noma’lum natija409 `RESULT_UNKNOWN`; yangi business operation yuborilmaydi. Resolved review immutable; payload update DBda rad. Original result hash va reviewed hash turli bo‘lsa ikkisi ham dalilda qoladi, yangi payload posted deb ko‘rsatilmaydi. Terminal manager proof own local conflictga `rejected` acknowledgement sifatida yoziladi; server source/audit saqlanadi.
- GET `/sales?organizationId&status=draft&page&limit`, GET `/sales/:id` existing scoped server drafts. UI boshqa qurilmada ayni cashier+register+active shift draftini explicit ochadi, complete ayni Sale/idempotent keyga. Local-only draft server ro‘yxatida bor deb ko‘rsatilmaydi; posted sale PUT rad.

Standart error `{success:false,error:{code,message,nextAction,details?},requestId}`; `X-Request-Id` ayni raqam. Validation details faqat path/code/message, input/stack emas. Body max1MiB; page≥1,limit1–200; no-store. Log allowlist event/requestId/organizationId/operationId/status/code/durationMs/kind/count; raw URL/query/body/error, auth va PII yo‘q. Shared audit helper source transaction ichida requestId va redacted JSON saqlaydi. Decimal API string; shared arithmetic50 significant digits, pul2 kasr HALF_UP, miqdor6 kasr/birlik precision, report NUMERIC aggregation. Pure tax arithmetic helper legal/business tax policy yoki real fiskal postingni yoqmaydi.


## 2026-10-07: qo‘lda qayd etilgan bank qaytarmasi

`POST /api/sales/:id/returns/preview` manager vakolati, original filial va ochiq smenani tekshiradi. Body mavjud return body bilan bir xil: `operationId`, `shiftId`, `reason`, `items`. Javob: `refundAmount` va `settlement` (`cash`, `card`, `transfer`, `debt`, `waived`), barcha summalar aniq decimal string. Preview sale/payment/stock/debt/Operation yozmaydi; 30/min actor budget bor.

Original qo‘lda (`recorded`) bank/karta to‘lovi yoki bank orqali undirilgan nasiya qaytarmasi uchun return bodyga `manualNonCash: { confirmed: true, referenceNo, expectedSettlement }` qo‘shiladi. `expectedSettlement` previewdagi beshta summa; server transaction ichida qayta tekshiradi. Bu operator tashqarida haqiqatan bajargan bank qaytarmasini ichki jurnalga qayd etadi. Bank/Click API, callback yoki provider-confirmed holati yaratilmaydi. Providerning boshqa statusidagi payment shu oqim orqali tasdiqlanmaydi.

Proofsiz noncash refund — `EXTERNAL_REFUND_REQUIRED`; eskirgan taqsimot — `REFUND_ALLOCATION_CHANGED`; bir xil tashkilot/kanalda ishlatilgan bank hujjati yangi key bilan ham SQL unique constraint orqali rad etiladi. Original key replay oldingi natijani beradi. Bank qismi cash ledgerga yozilmaydi. Bank amali noma’lum bo‘lsa uni takrorlash o‘rniga haqiqiy hujjat va Operation holatini tekshirish kerak.

Supplier POST/PUT: optional `bankName` (200), `bankAccount` (128), `paymentTerms` (2000 belgi), trim + server/DB length check. Format yoki bank protokoli taxmin qilinmaydi; ma’lumot manager-only karta va to‘liq CSVda ko‘rinadi. Supplier qarzi/to‘lov ledgeri alohida, hali yakunlanmagan.


### To‘lov kelib chiqishi va aniq klaviatura qidiruvi (2026-10-07)

`Payment.sourceType` — `manual` yoki `provider`. Hozirgi ichki jurnal xizmatlari `manual`ni serverda belgilaydi; mijoz bu qiymatni o‘zgartira olmaydi. `recorded` holatidagi `provider` yozuvi ham qo‘lda refund qilinmaydi. Migration033 mavjud ichki jurnalni `manual` sifatida saqlaydi. Real Click posting/refund hozir implementatsiya qilinmagan.

`GET /api/products?identifier=...` faol mahsulotni tashkilot ichida aniq SKU, keyin registrga bog‘liq bo‘lmagan aniq SKU/nom bilan izlaydi. `%` va `_` literal belgilar; qisman moslik emas. Bir nechta moslik `409 AMBIGUOUS_PRODUCT`, yo‘q bo‘lsa `404`; uzunlik 2–200. Kamera faqat barkod izlaydi; klaviatura Enter barkod topilmasa shu aniq qidiruvni ishlatadi. Qidiruv tugamaguncha F9/to‘lov/qoralama saqlash yopiq. Qaytarish miqdori UI dan Decimal satr sifatida yuboriladi.


### Qarz undirish: qo‘lda karta/bank hujjati (2026-10-07)

`POST /api/payments/credit`: `paymentType` = `cash` (default), `card`, `transfer`. Karta uchun `manualConfirmed:true` va 3–200 belgili `referenceNo` majburiy; aks holda400 `MANUAL_PAYMENT_PROOF_REQUIRED`. UI karta/o‘tkazma uchun tashqarida bajarilgan to‘lov tasdig‘i va hujjatni talab qiladi. Mavjud transfer API contracti saqlangan. Bu so‘rov bankdan pul yechmaydi, Click chaqirmaydi va provider tasdig‘ini yaratmaydi. Payment manbasi explicit `manual`, holati `recorded`; store/shift/receiver serverdagi jonli sessiya va smenaga bog‘liq.

Bir organization/channel ichidagi nonempty trim qilingan bank hujjati debt_collection uchun bir marta ishlatiladi: advisory lock + migration034 unique expression index. Yangi operationId bilan takrorlash409 `MANUAL_PAYMENT_DOCUMENT_REUSED`; transaction payment/debtni o‘zgartirmaydi. Original key bilan qaytarilgan natija idempotent. UI birinchi aniq rad etilgan urinishni rejected qiladi; javobi noma’lum/retry urinishning original payload/key/shift/proofini saqlaydi. Naqd jurnalga faqat cash collection kiradi; card/transfer alohida Payment journalda qoladi.

Migration034 mavjud takror organization/channel/reference hujjatlari bo‘lsa fail-fast qiladi; moliyaviy tarixni o‘zi o‘chirmaydi yoki birlashtirmaydi. Production rollout oldidan ma’lumot preflight va egasi bilan solishtirish kerak. Readiness034 qo‘llanmagan bo‘lsa503.

### Narxlar tarixi va tasdiqlanadigan batch (2026-10-08)

`GET /api/products/prices`: live owner/admin; `field=salePrice` (default), `productId`, `page`, `limit`, `format=csv`. `costPrice` tarixi/eksporti owner-only. CSV 10000 qatorgacha; undan ko‘p bo‘lsa413, qisman fayl berilmaydi. Katalog `/products` CSV tannarx ustunini faqat ownerga beradi. Adminning mavjud moliyaviy hisobot/katalog read vakolati saqlangan; bu alohida cheklov qo‘lda cost tahriri va katalog/history cost eksportiga tegishli.

`POST /api/products/prices`: `{operationId:UUID, field:"salePrice"|"costPrice", reason:string, preview:boolean, items:[{productId:UUID, expected:decimalString, value:decimalString}], confirmationHash?:string}`. 1–100 unique mahsulot; salePrice 2, costPrice 6 kasr belgigacha. Sotuv narxini owner/admin, tannarxni owner o‘zgartiradi. `preview:true` original narxlarni locked snapshotda tekshiradi, hech qanday iqtisodiy yozuv yaratmaydi; `{items,confirmationHash}` qaytaradi. Post uchun `preview:false` va shu hash majburiy. Narx o‘zgargan bo‘lsa409 `PRICE_CHANGED`, preview mos kelmasa409 `PRICE_PREVIEW_REQUIRED`; butun batch rollback. Field/reason/items server hashiga bog‘langan. Bir kalit/payload qayta yuborilsa bitta history/audit va oldingi natija; boshqa payload shu kalitda409.

Prisma/SQL trigger har bir haqiqiy salePrice/costPrice o‘zgarishini, shu jumladan weighted inventory costni tarixga yozadi. Individual edit `catalog.edit`, batch `catalog.bulk` va actor ID; tizimning boshqa cost hisoblari `database`, actor null. Migration035 hozirgi narxdan `migration_baseline` yaratadi, eski tarix/datesni taxmin qilmaydi. History o‘zgartirish/o‘chirish taqiqlangan (organization cascade istisno). Eski SaleItem narx/tannarx snapshotlari yangilanmaydi.

UI `/products/prices`: qidiruv, 100lik sahifa, sabab, preview, explicit tasdiq, history sahifalari, CSV. Ko‘rib tasdiqlangan batch POSTdan avval org/user/device-scoped IndexedDBda saqlanadi. Unknown response va reload original key/payload/hash bilan tekshiriladi; auto sync narx amalini qayta ko‘rib chiqmasdan yubormaydi. `/sync-review` original narx sahifasiga havola beradi. Katta katalog tasdiqlanadigan 100lik batchlarga bo‘linadi; turli batchlar bitta global transaction emas.

### Brak joylashuvi va hisobdan chiqarilgan qaytarmalar (2026-10-08)

Mavjud return item `disposition=sellable|damaged|write_off`. `sellable` original cost bilan InventoryMovement va available balancega qaytadi. `damaged` filialdagi yagona `DamageLocation` hamda immutable `ReturnDispositionEntry` yaratadi. `write_off` location null bo‘lgan disposal entry yaratadi; saqlash qoldig‘i emas. Hujjat/item/payment/audit/journal/operation bir transactionda; preview hech biri yozilmaydi, replay duplicate entry yaratmaydi. Snapshot nom/SKU/unit/tannarx original SaleItemdan olinadi.

`GET /api/inventory/dispositions`: owner yoki assigned branch admin; cashier403. `storeId`, `disposition=damaged|write_off`, `page`, `limit`, `format=csv`. `data` original return item, location, frozen product/cost va actor/UTC bilan. `summaryScope=pageProducts`: `summary` sahifadagi product/store juftliklarining barcha mos entrylari yig‘indisi; boshqa mahsulotlar sahifalarda. Damaged yig‘indisi brak qoldig‘i, write_off yig‘indisi hisobdan chiqarilgan miqdor. CSV barcha filtered rows (max10000), summary eksportda hisoblanmaydi.

UI `/inventory/dispositions` filtr/pagination/CSV va alohida damaged balances/disposal journalni ko‘rsatadi. Migration036 mavjud damaged/write_off returnlarni original returnedAt/cost/snapshot bilan backfill qiladi. Migration037 history tenant/actor va location identity chegaralarini himoya qiladi. Repair/release, general reservation/location management INV-02 bandlarida alohida; vendor yoki hardware implementatsiyasi qo‘shilmagan. Readiness035–037 ham tugagan bo‘lishini tekshiradi.

Narx batchi UI birinchi aniq transaction/validation radini `rejected` qiladi. Oldindan saqlangan noma’lum urinishni qayta tekshirishda, shu jumladan vaqtincha ruxsat radida, original intent yo‘qotilmaydi. Tasdiqlangan natija olingach navbat `synced` bo‘ladi. Katalog qayta yuklanayotganda tahrir qulflanadi; price input satrlari JavaScript Numberga aylantirilmaydi.

### Ichki moliyaviy hisoblar (2026-10-08)

`/finance` owner/admin uchun ichki moliyaviy kitob. Hisob/toifa yaratish owner-only; xarajat, o‘tkazma va qarshi hujjat owner yoki assigned filial admin. Cashier403. Hech qanday bank/Click so‘rovi yuborilmaydi: bank/provider balans operator hujjatlashtirgan boshlang‘ich pul va ichki jurnal asosida yuritiladi, provider integratsiyasi yoki real bank balansi deb da’vo qilinmaydi.

- `GET /api/finance/accounts`: tashkilot/assigned filiallardagi hisoblar va Decimal string balans. Naqd hisob registerga biriktiriladi; balans ochiq smenaning existing cash bookidan, yopiq smenaning countedCashidan olinadi. Naqd AccountEntry alohida yana qo‘shilmaydi. Bank/provider balans signed AccountEntry yig‘indisi. 10000 dan ortiq ro‘yxat413; jim qisman natija yo‘q.
- `POST /api/finance/accounts`: `{operationId,storeId,registerId?,name,kind:"cash"|"bank"|"provider",openingBalance?:decimalString,reason}`. Naqd openingBalance faqat0: ochilish puli smenadan olinadi. Bank/provider opening hujjati mavjud tasdiqlangan balansni operator kiritadi; eski to‘lovlar taxmin qilinmaydi.
- `GET/POST /api/finance/categories`: create `{operationId,name,treatment:"operating"|"capitalised"}`. Bir toifaning hisoblash turi tarix mavjudligida o‘zgarmaydi. Kapitalizatsiya qilingan to‘lov operatsion foydadan qayta ayirilmaydi; bu avtomatik inventory landed-cost taqsimoti emas.
- `POST /api/finance/expenses`: `{operationId,accountId,expenseCategoryId,shiftId?,amount:decimalString,reason}`. Positive amount, yetarli balans, scoped active account/category; naqd uchun shu registerdagi ochiq smena. Hujjat, CashMovement, AccountEntry, audit va operation bir transactionda. Amal actor manager vakolati bilan tasdiqlanadi.
- `POST /api/finance/transfers`: `{operationId,fromAccountId,toAccountId,fromShiftId?,toShiftId?,amount,reason}`. Ikki turli hisob, har bir cash uchun mos ochiq smena. Bitta FinancialDocument ostida teng debit/credit. Revenue va Payment savdo tushumi o‘zgarmaydi. Jami aktivlar ortmaydi.
- `POST /api/finance/documents/:id/reverse`: `{operationId,reason,shifts?:{[cashAccountId]:openShiftId}}`. Faqat original expense/transfer, bir marta, aynan original account/amountga qarshi posting. Original yozuv immutable. Yetarli mablag‘ bo‘lmasa409 va to‘liq rollback.
- `GET /api/finance/documents`: `storeId`, `page`, `limit` (max200), `format=csv` (max10000). Audit/hujjat/accountlar scoped; stable paging va repeatable read. CSV formula-safe.
- `GET /api/reports/profit`: `startDate`, `endDate`, `storeId`, `asOf`; tashkilot timezone. `netSales`, tarixiy `cogs`, `grossProfit`, `paidOperatingExpenses`, `inventoryWriteOff`, `operatingExpenses`, `operatingProfit`, `capitalisedPayments`: Decimal strings. Qaytarma original sale costni qaytaradi; write_off qiymati alohida operatsion yo‘qotish. Gross=netSales−COGS; operating=gross−operatingExpenses. Bu ichki boshqaruv hisobi, soliq deklaratsiyasi/to‘liq buxgalteriya emas. Soliq snapshot bandi hali alohida ochiq.

Har POST original operationId/payload/actor bilan idempotent; boshqa payload409. SQL balanced deferred triggers, tenant scope va immutable journals bazada ham himoyalangan. Finance o‘qish/yozish uchun actor bo‘yicha har biri60/min budget; profit existing report budgetga kiradi. Readiness038–041 ham tugaganini talab qiladi.

UI har amalni inson uchun preview qilib explicit tasdiqlatadi. POSTdan oldin original kalit/payload org/user/device-scoped IndexedDBga yoziladi. Noma’lum javob va reload original saqlangan intent bilan tekshiriladi; orphan reversal `/finance` recovery inboxida saqlanadi. `finance.action` avtomatik sync orqali tasdiqsiz yuborilmaydi. Toifa/account yaratish sababi va aynan kiritilgan puldan foydalaniladi; secret/vendor protokoli yo‘q.

Filiallararo transfer documentini admin ko‘rishi/reverse qilishi uchun ikkala account filialiga ham ruxsati bo‘lishi kerak. Migration041 AccountEntryga bog‘langan CashMovementni update/delete qilishdan himoyalaydi (organization cascade istisno); naqd mirror tarixdan ajralib qolmaydi.

### Savdo kesimlari

`GET /api/reports/breakdowns`: owner/admin, assigned filial chegaralari. `dimension=product|category|cashier|store|payment`, `storeId`, `startDate`, `endDate`, `asOf`, `page`, `limit` (max200), `format=csv` (full max10000). Default dimension store. Davr tashkilot timezone bilan; sale completedAt va return returnedAt. Barcha queries bitta RepeatableRead transactionda. Har kesimning barcha sahifalar bo‘yicha revenue jami overall sof savdoga teng bo‘lishi tekshiriladi; nomuvofiq tarix `REPORT_UNRECONCILED`409, qisman “to‘g‘ri” hisobot qaytarilmaydi.

Product/category/cashier/store revenue original lineTotal−receiptDiscount va original return lineTotaldan; tarixiy COGS original SaleItem unitCost bilan. Kategoriyasiz tovar alohida guruh; kategoriya va katalog nomlari joriy ma’lumot. Kassir qaytarma original savdo kassiriga tegishli, return processor emas. Quantity faqat product kesimida mavjud; kategoriya/kassir/filial kesimida null, chunki dona va kg qo‘shilib fizik miqdor sifatida ko‘rsatilmaydi.

Payment revenue original completed-sale recorded in payments (debt_collection excluded) minus davrdagi actual return cash/card/bank va return debt/write-off-reversal. Bu **sof savdo kanallari**, pul oqimi emas; keyingi qarz undirish, qo‘lda kassa, xarajat va ichki bank transfers kirmaydi. Return kanali original credit bo‘yicha keyin undirilgan cashdan qaytarilsa ayrim kanal sof natijasi manfiy bo‘lishi mumkin. Paymentda quantity/cost/profit null: tannarxni pul kanaliga taxminiy taqsimlash yo‘q.

Response `data` paginated rows `{id,name,quantity,revenue,cost,grossProfit}`; Decimal stringlar. `summary={netSales,quantity,cogs,grossProfit}` butun filtered davr uchun, sahifa jami emas. CSV formula-safe, paginationdan mustaqil, summary/asOf bilan. `/reports/breakdowns` UI exact string qiymatlar, davr/kesim, pagination, refresh/new snapshot va CSVni ko‘rsatadi; org/user/role almashsa eski UI holati reset. Existing report.read va scoped export rate budgets qo‘llanadi. Yangi vendor/SDK qo‘shilmadi.

## Supplier invoice, avans va qisman to‘lov

Owner/admin; barcha yozuvlar live organization va assigned filial bilan cheklangan. Cashier403. `operationId` majburiy UUID: noaniq javobdan keyin aynan original body/key qayta yuboriladi. Summa decimal string, floating-point emas.

- `GET /api/suppliers/{id}/ledger?page=1&limit=20`: `invoices`, `payments`, ikkita pagination va to‘liq scoped `summary` (invoiced/allocated/unpaid/paid/advance). Qatorning `allocatedAmount` qiymati barcha allocationlar yig‘indisi; sahifa limiti balansni kesmaydi.
- `POST /api/suppliers/{id}/ledger`: `{operationId,stockDocumentId,referenceNo,reason,expectedAmount?,dueAt?}`. Faqat shu supplierga tegishli confirmed, unreversed purchase. Summa original receipt satrlarining quantity×unitCost, har satr2 kasr rounding. Invoice ro‘yxatga olish stock yoki cashni qayta yozmaydi. Eski xaridlar avtomatik unpaid deb backfill qilinmaydi: operator haqiqiy hisob-fakturani tekshiradi.
- `POST /api/supplier-payments`: `{operationId,supplierId,accountId,amount,reason,shiftId?,referenceNo?,manualConfirmed?,allocations:[{invoiceId,amount}]}`. Cash mavjud account/ochiq shift journaliga atomik yoziladi. Bank/provider uchun tashqarida bajarilgan haqiqiy to‘lov tasdig‘i va referenceNo kerak; tashqi API chaqirilmaydi. Bo‘sh allocations to‘liq avans, qoldiq avans alohida hisoblanadi.
- `POST /api/supplier-payments/{id}/allocate`: `{operationId,reason,allocations:[{invoiceId,amount}]}`. Mavjud avansni invoicega bog‘laydi; yangi cash chiqimi yaratmaydi. Invoice/payment bir supplier va filialniki bo‘lishi kerak.
- `GET /api/supplier-payments/{id}/allocations?page=1&limit=20`: sahifalangan original invoice/reference/amount tarixi.

Supplier kartasida to‘lov preview/tasdiq va IndexedDBdagi original intentni tiklash bor. Avtomatik offline posting yo‘q. Allocation/invoice/payment immutable; overpayment, parallel takror, audit failure transactionda himoyalangan. Qarz yoki avansdan biri nol bo‘lmasa supplier archive409. Yangi tracked invoice receiptining oddiy reversal409: supplier return alohida original-bound workflow bilan bajarilishi kerak (`/api/supplier-invoices/[id]/credits`). Legacy receipt reverse o‘z kontraktini saqlaydi.

## Xarid buyurtmasi va original qabul zanjiri

Owner/admin, live organization/assigned branch, supplier/product/store faol.

- `POST /api/purchase-orders`: `{operationId,storeId,supplierId,referenceNo,reason,items:[{productId,quantity,unitCost}]}`; 1..200 unique mahsulot. Original nom/birlik/narx snapshoti; buyurtma stock/cash/payable yaratmaydi.
- `GET /api/purchase-orders?supplierId=…&page=1&limit=20`: bounded scoped tarix.
- `GET /api/purchase-orders/{id}`: har original qator quantity/receivedQuantity/remainingQuantity; derived ordered/partial/received holat.
- `POST /api/purchase-orders/{id}/receive`: `{operationId,referenceNo,reason,dueAt?,items:[{orderItemId,quantity}]}`. Qabul qilingan qatorlar uchun bitta confirmed purchase StockDocument, invoice, receipt va original line FK bitta Serializable Operationda. Supplier invoice raqami unique; stock qabul tasdig‘ida bir marta o‘zgaradi.
- `GET /api/purchase-orders/{id}/receipts?page=1&limit=20`: bounded original receipt/stock item/invoice tarixi.

Filial yoki mahsulot arxivlangan, original birlik o‘zgargan, qoldiqdan ko‘p qabul, takror line va foreign order rad etiladi. Invoice qiymati nol bo‘lgan complimentary receipt ham original iz bilan saqlanadi, qarz yoki to‘lov uydirilmaydi (migration048). Invoicega supplier payment/advance allocation yuqoridagi supplier ledger orqali ulanadi. Supplier kartasidagi preview/tasdiq saqlangan original key/payload bilan recovery qiladi; avtomatik sync emas. Qabuldan keyin tanlangan order saqlanadi va ledger/history yangilanadi.

## Supplier balans va muddati hisoboti

`GET /api/reports/supplier-balances?supplierId=…&storeId=…&asOf=ISO&page=1&limit=20&format=csv`: owner/admin, assigned branch. Invoice/payment/allocationsning immutable createdAt kesimi, supplier+filial guruhlari. `summary`: invoiced/allocated/unpaid/overdue/upcoming/noDueDate/paid/advance. `unpaid=invoiced−allocated=overdue+upcoming+noDueDate`; `advance=paid−allocated`. Qarz va avans netting qilinmaydi. Muddatsiz invoice muddati taxmin qilinmaydi; ro‘yxatga olinmagan legacy receipts excluded. Full CSV cap10000, formula-safe, summary barcha scoped guruhlar yig‘indisi. `asOf` kelajak bo‘lsa400; nom/currency/timezone joriy metadata, DB snapshot ko‘chirmasi emas.


### Supplier invoice credit va original mahsulot qaytarish

`GET /api/supplier-invoices/[id]` original invoice/receipt items, `netAmount`, `returnedQuantity`, `remainingQuantity`, `creditedAmount` qaytaradi. Owner/admin va assigned branch scope; foreign invoice404, cashier403.

`POST /api/supplier-invoices/[id]/credits`: `operationId` UUID, `kind` (`goods_return` yoki `price_correction`), `reason`3..2000, `items`1..200 noyob original `stockDocumentItemId`. Goods return satrida faqat positive `quantity`, price correction satrida faqat positive `amount`; decimal qiymatlar string sifatida yuboriladi. `preview:true` hech qanday journal/stock/Operation yozmaydi va `amount`, `invoiceNet`, item quote qaytaradi. Tasdiqda previewdan olingan `expectedAmount` va `expectedInvoiceNet` majburiy; o‘zgargan snapshot409 `SUPPLIER_CREDIT_PREVIEW_CHANGED`. Original key+payload qayta yuborilsa oldingi natija qaytadi, ikkinchi stock/credit yaratilmaydi.

Return original qolgan quantity va qolgan invoice qiymati bilan chegaralangan. Oldingi qaytarish/narx creditidan so‘ng qolgan qiymat qolgan miqdorga taqsimlanadi; oxirgi qaytarish qolgan sentni yopadi. Nol qiymatli original goods ham fizik qaytariladi. Price correction stockni o‘zgartirmaydi; to‘liq qaytarilgan satrga yangi price credit rad. Supplierdan haqiqiy pul qaytishi alohida jarayon: bu endpoint yangi cash/payment yozmaydi. To‘langan invoice creditida ortiqcha allocation original paymentning avansiga immutable `SupplierAllocationRelease` orqali qaytariladi.

Stock, inverse weighted cost, credit/items, allocation release, audit va Operation bitta Serializable transactionda. Negative stock va cost reconciliation rad; late audit/deferred SQL violation butun amalni rollback qiladi. Journal validation natija qaytarilishidan oldin `SET CONSTRAINTS ALL IMMEDIATE` bilan tekshiriladi. Original invoice/allocation/payment tahrirlanmaydi. Price credit tarixiy sale tannarxini qayta yozmaydi; landed-cost/sold-stock correction PUR-01.05 doirasida.

`GET /api/supplier-invoices/[id]/credits?page=1&limit=20` immutable history va pagination. Supplier ledger invoice `amount` original, `netAmount` creditdan keyingi payable, `creditAmount` cumulative credit; allocation tarixida `amount` original, `effectiveAmount` va `releasedAmount` alohida. Supplier balances report `asOf` cutoffdagi credit/release journalini hisoblaydi. Purchase report goods returnni negative quantity/value, price correctionni quantity0/negative value sifatida ko‘rsatadi; original receipt o‘zgarmaydi.


### Mahsulot variantlari

`GET /api/products/[id]/variants?page=1&limit=20`: root yoki child SKUdan bir oilaning sahifalangan variantlari. `root:{id,name}`, `data:[{id,name,sku,barcode,unit,salePrice,isActive,isDefault,options,quantity}]`, pagination qaytadi. Quantity aynan variantning stockKey/productIdsi bo‘yicha, ownerda barcha filiallar, admin/cashierda faqat assigned stores. Cost responsega kirmaydi. Archived variantlar tarix uchun ko‘rinadi; sahifada quantity jami oilaning stock jami deb berilmaydi. Foreign product404, live session talab.

`POST /api/products/[id]/variants`: owner/admin, `operationId` UUID, `name`2..200, `sku`2..100, `barcode`2..200, exact `salePrice`, `reason`3..2000, `options:[{name,value}]`1..8. Belgining nomi1..40, qiymati1..80; trim/lowercase canonical JSONB, takror belgi400, ayni kombinatsiya409 VARIANT_EXISTS. Tartib yoki case farqi yangi variantga sabab bo‘lmaydi. Oilada1000 SKUdan keyin413 VARIANT_LIMIT. Original unit oilada umumiy va child yaratishda rootdan olinadi; ishlayotgan oilaning unitini mustaqil o‘zgartirish rad.

Har variant alohida Product/SKU bo‘lib, barcodes, stock, sale/return/purchase hujjatlarida aynan uning productIdsi ishlatiladi. Eski barcha productga default metadata backfill qilinadi; yangi oddiy product ham SQL trigger orqali default variant oladi. Root original SKU bo‘lib sotilishi mumkin; oilaga umumiy stock yozilmaydi. Yangi variant current root category/unit/cost/minStock/image qiymatlaridan boshlanadi, lekin keyingi narx/tannarx/qoldiq har SKUda mustaqil. Boshlang‘ich stock0; bu API kirim/to‘lov yaratmaydi. SKU/barcode existing tenant unique qoidasi bilan himoyalangan.

Product, primary barcode, price history, variant relation, audit va original Operation transactionda. Late audit failure barchasini rollback qiladi; original key/payload replay aynan oldingi variantni qaytaradi. ProductVariant identifikatori/key/options assignmentdan keyin immutable. SQL composite tenant FKs root va childning tashkilotlari doim tengligini ta’minlaydi. UI `/products/[id]/variants` va katalogdagi Variantlar havolasi: tanlash, bounded ro‘yxat, preview/confirm, IndexedDBdagi original unknown intentni reload/retry qilish. Avtomatik offline posting yoki vendor scanner integration yo‘q.

## Himoyalangan rasmlar va katalog metadata (2026-10-08)

- `POST /files`: manager; strict `{operationId,productId,name,base64,expiresAt?}`. Canonical base64 static PNG/JPEG/WebP,512KiB input/output, decoded16Mp, normalized WebP≤2048px, original metadata stripped. SVG/HTML415, corrupt image400, body oversize413, foreign Product404. Original operation key/payload retry bitta asset/link/audit. Rate/tenant quota locked; quota exceeded409. `POS_FILE_QUOTA_BYTES` default104857600, valid1..1073741824; invalid configuration503.
- `GET /files?productId=UUID&page=1&limit=20`: manager metadata/history only; no bytes/base64. Bounded stable page, undeleted bytes/quota summary. Expired bytes explicit deletiongacha quota hisobida.
- `GET /files/:id`: own organization live session (cashier ham), binary image/webp, private/no-store/nosniff/sandbox CSP/request-id. Foreign404; deleted/expired410; anonymous401. Public uploads yoki public bucket yo‘q.
- `DELETE /files/:id`: manager `{operationId,reason}`. Bytes NULL/tombstone, matching Product.imageUrl cleared atomically, metadata/audit retained. Original replay image qayta yaratmaydi.
- `GET /brands`: page/limit/search/status(active|archived|all). Cashier faqatactive; manager archive history ham.
- `POST /brands`: `{operationId,name}`; `PUT /brands/:id`: `{operationId,name?,isActive?}`. Manager, org-scoped unique name, audit/original retry. Archive historical product linksni uzmaydi.
- Category POST/PUT optional `parentId:UUID|null`; own org, self/descendant cycle409, parent depth≤99, SQL graph max100. Parent archive child/product historyni o‘chirmaydi. GET parent{id,name}.
- Product POST/PUT optional `brandId:UUID|null`, `description`≤4000 plain text; imageUrl null, HTTP(S), yoki own live `/api/files/UUID`. Foreign link404, expired410/409; javascript/data/HTML URLs rad. Protected upload sahifasi `/products/:id/media`; brendlar `/products/brands`.

Barcha economic operationlar original durable retry/tenant/session contractni saqlaydi. Files uchun faqat static image allowlist mavjud; hujjat/video, vendor printer yoki tashqi payment integration qo‘shilmadi. Encrypted backup fixture asset bytes/hash/linkni empty DBda qayta tiklash va authenticated GETni tekshiradi.

## Kassir PIN (2026-10-08)

`POST /auth/pin`: own active cashier, strict `{currentPassword,pin: six-digit-string|null}`; valid password required, bcrypt12 membership hash only. Owner/admin403, invalid password403, malformed400;5 configuration attempts/15min. Set/disable revokes existing PIN sessions. Password rotation additionally clears all membership PINs. No PIN/hash in DTO/audit.

`GET /auth/pin-switch?storeId=UUID&page=1&limit=20`: live session/assigned branch; stable paginated available cashier `{id,fullName}` only, count; no credential hash. `POST /auth/pin-switch`: strict `{targetMembershipId,storeId,pin}`. Authenticated original source session required; foreign/hidden references404/403, noncashier target/wrongPIN401, wrong target5attempts/15min429/Retry-After; successful switch resets target/source budgets. Target role must remain cashier. Transaction consumes original source session once, new HttpOnly SameSite PIN session scoped to exactly one active branch for≤8h, audit. Parallel switch one200/one401; late audit failure rollback.

PIN session cannot organization-switch or become manager by membership role change; use password login for elevated access. Target retains own assigned shift identity; no shift takeover or hardware adapter. `/security` has password-protected own PIN controls and active-branch cashier switching; pending/conflict local actions block UI switch, full reload scopes new actor. Unknown switch response may require password login. No token/PIN in localStorage.

## Ichki soliq profili, preview va snapshot (2026-10-08)

- `GET /taxes?page&limit&search&status`: scoped profiles/current effective version; cashier active-only. `POST /taxes {operationId,name,isActive?}`, `PUT /taxes/:id {operationId,name?,isActive?}` owner-only; original retry/audit.
- `GET /taxes/:id/versions?page&limit`: scoped bounded immutable history/future schedules. `POST {operationId,mode:included|excluded|exempt,rate:decimal-string,effectiveAt:ISO-offset-date,exemptionReason?}` owner-only. Exact0..100%,≤2 decimals; exemptionrate0+reason mandatory. Later effective date must exceed last version and not retroactively alter current history; stale date409TAX_EFFECTIVE_DATE. Archive retains versions/SaleItem refs; no PUT/DELETE version.
- Product POST/PUT optional `taxProfileId:UUID|null` own org; variants copy initial profile, later SKU assignment independent. Unconfigured legacy does not mean a legal exemption. Assigned archived/no-effective-version409TAX_PROFILE_UNAVAILABLE. `/settings/taxes` owner controls; `/products/:id/media` scoped picker.
- `POST /sales/preview` existing saleDraft body + active own/authorized shift: `{totals:{subtotal,discountAmount,totalAmount,taxAmount,netAmount},taxFingerprint,items}` decimal strings; no Sale/receiptSequence/Payment/Stock/Audit/Operation posting. Rate120/minactor. SKU-combined deterministic receipt discount, after-discount included/excluded taxes, no browser-authoritative amounts.
- Sale create optional `expectedTotalAmount`, `expectedTaxFingerprint` binds reviewed server quote; changed quote409TAX_OR_TOTAL_CHANGED with no effects. Completion changed current version/profile409TAX_CHANGED, all stock/debt/payment work rolls back. POST completion total must equal tax-inclusive payable.
- Sale snapshots `taxAmount,netAmount`; SaleItem `taxVersionId,taxMode,taxRate,taxBase,taxAmount,payableAmount,roundingVersion`. Legacy null base/payable and legacy-unspecified remain, no guessed tax backfill. Original version/rate/cost/discount/rounding immutable after completion.
- SaleReturnItem tax/discount derived only from original: cumulative gross refund for tax, cumulative quantity for discounts, final exact remainder. `taxBase+taxAmount=lineTotal`; sum returned tax/discount never beyond original and full return exactly restores original totals. Current product cost/rate is not used to reprice original refund.
- Reports retain tax-inclusive gross/payment totals. `reports/profit` tax-free netSales/COGS/profit; products expose tax/netRevenue and profit excludes tax; breakdowns expose tax/revenueExcludingTax for nonpayment dimensions. Payment dimension tax/cost/profit null, gross channels reconciliation only. CSV has tax/tax-free columns. Dashboard top gross uses frozen payable; financial summary adds taxAmount/revenueExcludingTax. Receipt/payment preview explicitly display the tax portion.

Rates/modes above are business configuration, never a preset claim about Uzbekistan taxation. Fiscal/vendor/Click requests remain absent.

### Chegirma foizi va vakolat snapshoti (059)
`POST /sales`, `POST /sales/preview`da chek uchun `discountPercent` (0..100, ≤2 kasr), `discountReason` (3..2000 belgi), har item uchun `discountPercent` qo‘llanadi. Qator foizi avval `round(quantity × unitPrice,2)`ga, chek foizi qator chegirmalaridan keyingi subtotalga qo‘llanadi. `discountAmount` default0; foiz bilan birga musbat summa berilsa server hisobiga aynan teng bo‘lishi kerak, aks holda409 `DISCOUNT_AMOUNT_CHANGED`. Bir SKU uchun foizli takror qator400 `DUPLICATE_PERCENT_ITEM`; uni bir qatorda birlashtiring. Foiz0/100 qo‘llanadi, qaytarish original cents snapshotdan.

Faol DiscountPolicy `requireReasonFromPercent`iga yetgan umumiy chegirma sababsiz400 `DISCOUNT_REASON_REQUIRED`; cashier/admin limitidan oshish403 `DISCOUNT_LIMIT`. Owner/admin rahbar tasdig‘ini o‘z faol sessiyasi bilan aniq savdo uchun beradi: `discountApprovedBy/Role/At`, `discountPolicySnapshot` qoralamada va yakunlashda saqlanadi, qayta tekshiriladi. Boshqa foydalanuvchini requestda tasdiqlovchi deb ko‘rsatish mumkin emas. Kassir vakolatidan tashqari qoralamani avtomatik tasdiqlash/tasdiq tokeni ko‘chirish yo‘q. Receiptning yakunlangan ma’lumoti immutable.

`PUT /sales/:id` qoralamasida foiz tahriri/`null` bilan tozalash va sabab qo‘llanadi. Mahsulot almashtirilganda saqlangan receipt foizi qayta hisoblanadi; summa explicit o‘zgarsa foiz o‘chadi. Eski migrationdan oldingi qoralamaning o‘zgarmagan chegirma sababi to‘qib backfill qilinmaydi; yakunlash current role limit va yangi actor reviewini saqlaydi. Chegirma o‘zgartirilsa yangi sabab siyosati majburiy. POS savati percent/sabab bilan IndexedDBda scope doirasida saqlanadi; indikator commitdan keyin tasdiqlaydi, yozilish tugamasa beforeunload ogohlantiradi.

`GET /products`ning oddiy paged list javobida `catalogLease: {version, issuedAt, expiresAt}` qaytadi. Version — tashkilot/rol/query/page va authoritative product price/unit/update metama’lumotlarining SHA256si; expiry issuedAt+5min. Har bir javob `private, no-store`. Bu lease offline vakolat yoki narx kafolati emas; faqat lokal oxirgi qidiruv sahifasini freshness bilan ko‘rsatishga xizmat qiladi. Sales preview/create/complete current server narx/stavka/vakolat/qoldiq tekshiruvlari majburiy qoladi.

Transfer receive: `POST /transfers/:id/receive` accepts `{operationId, reason?, items:[{itemId, quantity, damagedQuantity?, shortageQuantity?}]}`. `quantity` — soz qabul; barcha miqdorlar exact base-unit string, nonnegative, qator yig‘indisi >0. Brak/kamomad uchun manager va3–2000 belgili sabab majburiy. `sent=received+returned+damaged+shortage+inTransit`; tasdiqlangan farq normal qoldiqqa kirmaydi. Bir xil operation/key/payload replay bitta natija; changed payload409. Partial receipt uchun har yangi amalda yangi kalit ishlating. Legacy bo‘sh body barcha qolganini soz sifatida qabul qiladi. List/CSVda barcha counters/in-transit, list item.dispositionsda immutable exact cost/actor/reason/time journal qaytadi. Parent/line posted snapshot va counters decrease SQLda rad; journal/counter totals deferred transaction constraintda mos bo‘lishi shart.

Support core: `GET /support/operators` owner-only active explicit operator IDs/names (credential/phone/email yo‘q). `POST /support/grants`: `{operationId,operatorUserId,storeIds:[uuid],scopes:['catalog.read'|'inventory.read'|'sales.read'|'diagnostics.read'],reason,expiresMinutes:1..60}`; consent sessionning tashkiloti va owner actoriga bog‘lanadi. `GET /support/grants?view=issued|received&page=1&limit=50` paging; issued owner-only, received live PlatformOperator own grants. `POST /support/grants/:id/revoke` owner-only `{operationId,reason}`. `GET /support/grants/:id/view?view=catalog|inventory|sales|diagnostics&branchKey=uuid&page=1`: faqat grantning explicit operatori va password-session;50 rows, every read audit, no write/export privilege. Catalog organization-wide SKU metadata, boshqa uch view approved branch bo‘yicha. Revoked/expired/disabled/scope deny403 va target audit; wrong actor404. Platform_admin ham grantdan ozod emas; oddiy `/products?organizationId=...`ga foreign access403. All API private/no-store; UI `/settings/support` owner consent/revoke va `/support` readonly operator console. Operator identity provisioning ishonchli infra DB orqali alohida; business HTTP endpoint orqali platform rol olish yo‘li mavjud emas.

### Narx darajalari (ichki core)

`GET /api/price-rules?page=1&limit=20&productId=<optional>` manager history; `POST` body operationId,productId,kind=retail/wholesale/group/customer, optionalstoreId/customerId/groupId,minimumQuantity exact string,unitPrice exact2-decimalstring,startsAt/endsAt ISO,reason. Shared rule owner, assigned branch owner/admin. `POST /api/price-rules/:id/archive` operationId/reason. Mutations original key bilan replay; overlapping same-tier dates409, applied rule edit/delete mumkin emas.

`POST /api/price-rules/quote` scoped cashier/manager read-only storeId,optionalcustomerId,items(productId,quantity),max500uniqueSKU; authoritative price/rule/canonical snapshot, no payment/stock change. Customer > group > wholesale > retail > base; specific store then highest eligible threshold. `[start,end)` time. POS mismatch explicitly reviewed then checkout rechecks live rule/price. Old receipt/refund immutable.

`GET/POST /api/customer-groups` paginated tenant groups / owner operationId,name; `POST /api/customer-groups/assign` owner operationId,customerId,groupId nullable,reason. Group change reprices new/draft sales; posted receipts remain original.

### Mijoz identity va original history

Customer create/update valid telephone input normalized; local9digits→998+number, punctuation removed, international9–15digits. Same tenant active valid number duplicate400; concurrency lock+partial unique index. Legacy ambiguous cards are preserved, no automatic merge or assumed phone verification. New creditLimit accepts exact string as well as compatible numeric input.

`POST /api/customer-merges`: owner only operationId,sourceCustomerId,targetCustomerId,reason. Source drafts and target-by-target debt must be settled; otherwise409 MERGE_OBLIGATIONS_OPEN. Source becomes inactive immutable alias; original Sale/Payment/DebtEntry IDs do not move. Target must be active same tenant root, no chains/cycles,99alias max. No endpoint can reactivate merged original card.

`GET /api/customers/:id/history?page=1&limit=20` root+alias original completed/partially_returned/returned receipts and refund amounts, scoped tenant/branch/own-cashier. Original debtor ledger remains `/customers/:id/ledger`; history does not combine or fabricate financial allocations. UI `/settings/prices` and `/customers/:id/history` uses reviewed durable intents/recovery.

Ombor zonalari/rezerv (owner/admin, own branch): `GET /inventory/locations?storeId=UUID&page=1&limit=20`; `POST /inventory/locations {operationId,storeId,name}`; `POST /inventory/locations/move {operationId,storeId,productId,fromLocationId:null|UUID,toLocationId:null|UUID,quantity:"3",reason}`; `POST /inventory/reservations {operationId,storeId,expiresAt:ISO,reason,items:[{productId,locationId:null|UUID,quantity:"2"}]}`; `POST /inventory/reservations/:id/release {operationId,reason}`; `GET /inventory/position?storeId=UUID&productId=UUID`. Position: onHand/reserved/available/unassigned/damaged + zone quantity/reserved/available. Server expires active holds; max24h,100SKU,100zones/branch, no counter overwrite. Sale complete optionally receives `reservationId`: manager manual reservation, exactly same basket/branch and active expiry, cash/payment+stock in existing atomic operation. Normal completion cannot spend other active reservations. Location movement has no financial/physical InventoryMovement side effect; immutable LocationEntry records physical reassignment. UI `/inventory/locations` supports reviewed original-key recovery and exact reserved cash sale. No vendor/hardware integration.

Offline cash (core, native; vendor integratsiyasi emas):
- `POST /offline-cash/policy {operationId,storeId,enabled,maxAmount,ttlSeconds:30..300,reason}` owner-only. maxAmount — filialdagi jami hal qilinmagan ticketlarning summasi limiti; default o‘chiq.
- `GET /offline-cash?storeId=UUID&page=1&limit=20` owner barcha own-branch lease, admin/cashier faqat own actor. Policy ham qaytadi.
- `POST /offline-cash {operationId,saleId,deviceId}` source userning own parked draftiga exact cash ticket; kassa/smena faol, quote/current discounts/tax, max100SKU, unassigned available stock. Result signed payload + public JWK/signature. Secret yo‘q. Issuance replay original ticketni beradi, terminal/expired/current policy/session/shift notusable bo‘lsa409; original terminal metadata details qaytadi.
- `/sync` command `offline.cash`, original fixed `operationId=payload.cashOperationId`, payload `{leaseId,deviceId,cashTendered:"20.00"}`. Boshqa iqtisodiy maydonlar qabul qilinmaydi. Server source context/role/session/current policy/expiry/customer/price/tax/shift/stockni tekshirib bitta cash/payment/stock operation qiladi. Conflict source kalit/payload bilan yoziladi. Offline nasiya limiti0, card/transfer/provider yo‘q.
- `GET /offline-cash/:id` original terminal proof (owner yoki own source actor, scoped branch). Source lease/org/user/device/cash key match bo‘lmasa lokal ack qilinmaydi.
- `POST /offline-cash/:id/cancel {operationId,reason,goodsReturnedOrNotDelivered:true,cashWasReceived:boolean,netCashRefunded}` ownerning haqiqiy pul/tovar reconciliationi. cashReceived bo‘lsa sof refund aynan signedtotal, olinmagan bo‘lsa0. Reservation release + source draft void + audit, yangi Payment/InventoryMovement yo‘q; committed sale uchun409 va odatiy refund kerak.

Expired offline ticket stocki automatic free qilinmaydi: noma’lum offline tovarning boshqa kassada sotilishiga yo‘l qo‘ymaslik uchun physical proof/synchronizationgacha hold qoladi. Manual reservations odatiy expiryworker bilan yakunlanadi. UI `/pos/offline`, static encrypted checkout `/pwa/cash.html`. Unlock iborasi API requestga kirmaydi. Hal qilinmagan ticket borida shiftclose/logout blocked. Node native Ed25519 + browser AES-GCM/PBKDF2/IndexedDB; tashqi SDK yoki hardware protocol yo‘q.

`POST /api/offline-cash/{leaseId}/settle` — faqat joriy live owner uchun, original tovar berilgan va naqd shu smenaga haqiqatan olinganini dalil bilan qayd etish. Body: `operationId` UUID, `goodsDeliveredAndNetCashReceived: true`, `observedSaleAt` ISO (asl signed issuedAt≤vaqt<expiresAt, kelajak emas), `cashTendered` exact decimal string, `evidenceReference` 3–300 belgi, `reason` 3–2000 belgi. Bu expired/revoked/current-price conflictni avtomatik qabul qilish emas: owner alohida tasdiqlaydi, asl server basket/narx/soliq/tannarxini saqlashni oldindan ko‘radi. Source shift hali ochiq bo‘lishi kerak. Payment.receivedBy/audit actor actual owner, Sale.cashierId original cashier. Accounting completedAt hozirgi server vaqti; kuzatilgan vaqt faqat audit dalili. Bitta transactionda source lease consumed, reservation consume, cash payment, stock va audit; bir xil operationId replay eski natija, changed payload409. Committed sale uchun keyingi refund odatiy `/returns` oqimidan. Original source GET proof consumed holatini ko‘rib lokal ack qiladi, original cashier nomidan soxta offline.cash operatsiya yaratilmaydi.

Offline qo‘shimcha himoya: filialda100ta unresolved ticket technical cap; offline-cash read120/write30 per org/user/min. Cash holdli SKU uchun physical stock count/opening/adjustment uncertainty hal bo‘lmaguncha rad; aks holda sanash va kechikkan offline stock debit bir tovarni ikki marta ayirishi mumkin. Migrations079..081 cash-count va owner-evidence DB guardlarini qo‘shadi; eski receiptlar/money tarixini qayta yozmaydi.

### Katalog CSV / XLSX importi

Owner uchun `POST /api/catalog-import/preview` body `{format:"csv"|"xlsx",content:<base64>}`;512KB/1000rows/30columns,1sheet,plain values. Preview business/staging/audit/Operation yozmaydi. Natija fileHash,confirmationHash,total,valid,invalid, har line/data/errors va CSV xato fayli. Ustunlar katalog eksportining Uzbek andozasi yoki name/sku/barcode/unit/salePrice/costPrice/minStock/category/additional. ID ignore; existing SKU/barcode update emas, error. Category own active name, unit own active code; metadata/stock/payment taxmin qilinmaydi.

`POST /api/catalog-import` shu filega `operationId`, `confirmationHash`, `acceptValidRows:true`, `reason` qo‘shadi. Faqat reviewed valid rows atomic create; skipped rows/error CSV original natijada qoladi. Current catalog conflict hashni o‘zgartirsa409IMPORT_CHANGED; repeat same original key old natija, changed payload409. Owner-only narx/cost access, priceActor/audit va live-session barcha commitda; rate preview10/commit5 per actor/min. Untrusted Excel parser native bounded Worker orqali; no external vendor.

`GET /api/catalog-import/export?format=csv|xlsx&search=...&categoryId=...` owner-only full active filtered catalog,10000cap,rate10/min. Decimal qiymatlar XLSXda aniq matn; strings formula emas. Response filename/content/encoding(utf8 yoki base64). `/products/import` haqiqiy upload→preview→error report→confirmation→original retry va Excel download UI; mavjud mahsulot/narx/qoldiqni yashirin almashtirmaydi.

### Birlamchi sozlash

`GET /api/onboarding?storeId=<UUID>` faqat live ownerning faol filialiga organization/register/catalog/opening/staff/sale bosqichlarini qaytaradi. Har bosqichda `ready`, `confirmed`, `complete`, `confirmationHash`, `confirmedAt` va haqiqiy source proof bor. Importning completed Operationi, tasdiqlangan/reverse qilinmagan opening hujjati, filialga biriktirilgan faol kassir va odatiy yakunlangan savdo talab qilinadi. Qoralama yoki `/training`dagi mahalliy mashq haqiqiy savdo hisoblanmaydi.

`POST /api/onboarding` body `{operationId,storeId,step,confirmationHash,reason}`. Oldingi bosqichlar complete bo‘lishi va joriy source o‘zgarmagan bo‘lishi shart; `409 ONBOARDING_PREREQUISITE` yoki `ONBOARDING_CHANGED` aks holda. Checkpoint va audit bitta transactionda; original key replay yangi checkpoint/audit yozmaydi. Checkpoint proof/actor/time o‘zgarmaydi. Source keyin bloklansa eski tasdiq saqlanadi, ammo joriy `complete` false bo‘ladi. `/onboarding` sahifasi har filial uchun qayta davom ettiriladigan tasdiq/recovery va tegishli bo‘lim havolalarini beradi. Bu API biznes ma’lumotlari yoki nazorat savdosini avtomatik yaratmaydi.

### Ichki tovar almashtirish

`POST /api/exchanges/preview`: `{originalSaleId,shiftId,reason,items:[{saleItemId,quantity,disposition}],replacement:{customerId?,items:[{productId,quantity,discountAmount}],discountAmount,...},creditAmount,creditDueAt?}`. Live owner/admin, original filialdagi ochiq smena. `replacement`da organization/store/register/shift/cashier/operationId client tomonidan berilmaydi; server original filial va joriy smenadan oladi. Natija original refund settlement, replacement total/cash/credit, signed cashDifference/debtDifference va confirmationHash. Preview biznes jurnallarini yozmaydi. Card/transfer/external refund talab qilinsa409; provayder natijasi taxmin qilinmaydi. Nasiya borida original mijozning o‘z kartasi majburiy.

`POST /api/exchanges`: preview body + `{operationId,confirmationHash,cashTendered}`. Musbat naqd farq uchun tender farqdan kam emas; nol/manfiy farqda tender0. Original return, yangi sale/payment/debt/stock, immutable exchange link va audit bitta transactionda. Yangi savdo/stock/credit/audit fail bo‘lsa qaytarish ham rollback; original key replay bir xil natija. Stale review409EXCHANGE_CHANGED. Gross cash journals bir-birini offset qiladi; actual physical tender/change va refundDue exchange hujjatida, yangi Sale.cashTendered null — full gross tender taxmin qilinmaydi.

`GET /api/exchanges?saleId=<UUID>` owner/adminning o‘z scoped original yoki replacement savdosiga bog‘langan oxirgi100exchange hujjatini qaytaradi. `/sales/[id]/exchange` return/replacement tanlash, server preview, sabab/tender review, durable original ACK recovery va bog‘langan receipt history beradi. Original va yangi savdo sahifalarida actual naqd/nasiya farqi ham ko‘rinadi. Oddiy keyingi return yangi savdoning original gross payment/tax/cost snapshotlari asosida ishlaydi.

### Ichki fon ishlar navbati

Owner `POST /api/jobs` `{operationId,type:"reconciliation",storeId?,reason}` bilan ish yaratadi. Store berilmasa shu tashkilotning barcha filiallari; store berilsa own active branch. Tenantda20activejob chegarasi,5enqueue/actor/min; original replay bitta job/authorization/audit. Payload qat’iy allowlist,4KB DB cap; tashqi endpoint/SQL/vendor chaqirig‘i ish payloadi bo‘la olmaydi.

`GET /api/jobs?page=1&state=queued|running|succeeded|dead|cancelled` owner-only20row paginated list. Lease token/payload/credential javobga chiqmaydi. `GET /api/jobs/[id]/events` own jobning oxirgi100immutable eventini beradi. `POST /api/jobs/[id]/retry` `{operationId,reason}` faqat `dead` job uchun: source payload o‘zgarmaydi, yangi live owner/session authorization proof, yangi generation va3qo‘shimcha urinish. Jami10generation/30attempt cap; original retry ACK noma’lum bo‘lsa shu kalit bilan tekshiriladi, yangi key duplicate retry qilmaydi.

Node worker `FOR UPDATE SKIP LOCKED` bilan claim,30slease,5sheartbeat; bounded2^attempt seconds/backoff max300s. Fail3marta→dead. Source session/owner/branch permission har run va yakuniy commitda joriy tekshiriladi; revoke→AUTHORIZATION_CHANGED/dead, egasi fresh authorization bilan retry qilishi mumkin. Source ish1h ichida boshlanib/yakunlanishi kerak; expired queue/lease recover qilinadi, old lease result yoza olmaydi. Reconciliation Incident/result/system audit bitta fenced transactionda; actual worker audit.actorId null, callerning queue/retry authorizationi alohida actual actor bilan. `/jobs` owner UI queue/history/dead filter/review/recovery beradi.

### Hisob xavfsizligi — SEC-02.09

`POST /api/auth/login` mavjud phone/passwordga optional UUID `deviceId` qabul qiladi. Bu brauzer hinti, login vakolati emas. Javob cookie/role kontrakti saqlanadi; raw qurilma belgisi/token/hash javobga chiqmaydi. Uchta noto‘g‘ri parol/15min va yangi brauzer belgisi own-account notice outbox yaratishi mumkin; login5/15min limiti saqlanadi.

`GET /api/auth/sessions?page=1&limit=20&state=active|all|revoked|expired`: defaultactive old behavior; explicit history90kun. Rows safe id/organizationId/createdAt/expiresAt/idleExpiresAt/revokedAt/authenticationMethod/current/status. Boshqa hisob sessiyalari ochilmaydi; `status` active/revoked/expired. Mavjud POST revoke actual live contextni transactionda tekshiradi, first revoke bitta tarix hodisasidir.

`GET /api/auth/security?page=1&limit=20` barcha actual owner/admin/cashier uchun faqat hisobining90kunlik tarixi. limit<=100. `data={events,notices,unread}`, pagination hodisalarga tegishli. Event: id/type/suspicious/organizationId/sourceSessionId/createdAt/expiresAt/deliveryState/deliveryAttempts/deliveryMaxAttempts/canRetry. Notice: id/eventId/type/organizationId/createdAt/readAt. Ko‘pi20notice, avval o‘qilmaganlar; unread barcha90kunlik xabarlar soni. Read60/min/account, no-store; automated GET sessiyaning idle muddatini uzaytirmaydi.

`POST /api/auth/security/read`: strict `{operationId:UUID,noticeId:UUID}`, read30/min/account. Own live notice; first readAt o‘zgarmas, original Operation replay bir xil natija. Foreign/muddati tugagan404, revoked401.

`POST /api/auth/security/retry`: strict `{operationId:UUID,eventId:UUID}`, retry10/min/account. Own live event outbox dead bo‘lsagina +3urinish bilan pending; jami30urinish. Old attempts saqlanadi, actual actor audit/Operation bilan original replay. Javob `{eventId,state,attempts,maxAttempts}`. Foreign/expired404; not-dead409 NOTICE_NOT_RETRYABLE; budget30tugasa409 NOTICE_RETRY_LIMIT. UI noaniq ACKni authoritative GET bilan tekshiradi, unresolved original kalitni saqlaydi. Worker yetkazishda eski login sessioni active bo‘lishini talab qilmaydi; actual global User.isActive talab qilinadi. Hech qanday tashqi servisga so‘rov yuborilmaydi.

### Mahsulot tasnifi — CAT-01.09

`GET /api/products/:id/compliance` joriy tashkilot mahsulotining MXIK/manba/soliq va markirovka cheklovlarini qaytaradi. `POST` faqat owner uchun: `{ operationId, mxik: string|null, mxikSource: string|null, mxikRequired: boolean, taxRequired: boolean, markingRequired: boolean, taxProfileId: UUID|null, reason: string }`. Noma’lum maydonlar rad etiladi; bir xil operationId ayni natijani qaytaradi, boshqa payload bilan qayta ishlatilmaydi. Faol soliq profili shu tashkilotga tegishli bo‘lishi kerak.

Checkout va offline naqd ruxsat olishda `CLASSIFICATION_REQUIRED` / `PRODUCT_TAX_REQUIRED` — 409; markirovka majburiy, xizmat hali ulanmagan bo‘lsa `MARKING_INTEGRATION_UNAVAILABLE` — 503. Payment/stock yozilmaydi. Rasmiy MXIK katalogi yoki markirovka protokoli taxmin qilinmaydi. Original receipt tasnifi `SaleItem.complianceSnapshot` bilan saqlanadi.

### Birlik konvertatsiyasi — CAT-01.04

`GET /api/products/:id/units` joriy mahsulot asosiy birligi va configured conversionsni beradi. `POST` owner-only strict body: `{ operationId, tradeUnit, ratio: decimalString, isActive, reason }`. `ratio` ko‘pi6 kasr, musbat va100000000dan kichik; 1 trade unit bazaviy birlik aniqligiga mos bo‘lishi shart. Faol shu tashkilot birliklari, original key va audit talab qilinadi.

Sale draft/quote `items[]`ga optional `tradeUnit` va `expectedConversionRatio` qo‘shildi. Unit yo‘q bo‘lsa avvalgi base-unit API ishlaydi. Masalan1quti ratio12 → SaleItem.quantity12dona, base price100 → total1200; `conversionSnapshot` original1quti/12dona nisbatini saqlaydi. `CONVERSION_CHANGED`/`CONVERSION_UNAVAILABLE`409, aralash SKU birliklari400. Konvertatsiya qoldiqni yaxlitlamaydi.

Stock document item optional `tradeUnit`; `unitCost` doim **asosiy birlik** tannarxi.2quti ratio12, unitCost50/dona → quantity24, cost50/dona; hujjat original2qutini snapshotda saqlaydi. Tasdiqlash stale ratio bilan bloklanadi. Sale return itemda optional original `tradeUnit` yuborilsa quantity original receipt ratio orqali base quantityga aylanadi. Unit ko‘rsatilmasa oldingi base quantity ishlatiladi; boshqa current trade unit qabul qilinmaydi. Fizik stock/payment/profit jurnallari base birlikda qoladi.
