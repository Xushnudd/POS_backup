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
