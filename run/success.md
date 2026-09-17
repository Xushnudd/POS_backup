# API Muvaffaqiyatli So'rovlar Jurnali (Success Log)
Yuborilgan sana: Thu Sep 17 05:27:31 PM +05 2026
Base URL: http://localhost:3000/api

## [SUCCESS] POST /auth/register
- **Tavsif:** Yangi foydalanuvchi va tashkilot ro'yxatdan o'tkazish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{
  "fullName": "Test Admin",
  "phone": "+99890104679",
  "email": "admin_104679@example.com",
  "password": "password123",
  "organizationName": "Test Org 104679",
  "tin": "123456789"
}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzNTgzY2ZjYi04ZTYxLTRjNzUtYjk1ZC02MjE2ZGM4YTZiNDQiLCJvcmdhbml6YXRpb25JZCI6ImYzYmUzOWViLTlkNDUtNDVmZC1iMDg0LWY3OGQzNjU3MDkzNSIsInJvbGUiOiJvd25lciIsImlhdCI6MTc4OTY0ODA1MSwiZXhwIjoxNzkwMjUyODUxfQ.9PvELeUBfOg3L5KObPFI1SOVkIIHPSD3Zws3KZqCCwQ","user":{"id":"3583cfcb-8e61-4c75-b95d-6216dc8a6b44","fullName":"Test Admin","phone":"+99890104679","email":"admin_104679@example.com"},"organization":{"id":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Test Org 104679","currencyCode":"UZS"}},"message":"Muvaffaqiyatli ro'yxatdan o'tdingiz"}
```

---
## [SUCCESS] POST /auth/login
- **Tavsif:** Tizimga kirish (Login)
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{
  "phone": "+99890104679",
  "password": "password123"
}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzNTgzY2ZjYi04ZTYxLTRjNzUtYjk1ZC02MjE2ZGM4YTZiNDQiLCJvcmdhbml6YXRpb25JZCI6ImYzYmUzOWViLTlkNDUtNDVmZC1iMDg0LWY3OGQzNjU3MDkzNSIsInJvbGUiOiJvd25lciIsImlhdCI6MTc4OTY0ODA1MSwiZXhwIjoxNzkwMjUyODUxfQ.9PvELeUBfOg3L5KObPFI1SOVkIIHPSD3Zws3KZqCCwQ","user":{"id":"3583cfcb-8e61-4c75-b95d-6216dc8a6b44","fullName":"Test Admin","phone":"+99890104679","email":"admin_104679@example.com","organizationUserId":"a2369068-c7a8-438e-ab8a-e8bce6cf2b7d"},"organization":{"id":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Test Org 104679","currencyCode":"UZS"},"role":"owner"},"message":"Muvaffaqiyatli kirdingiz"}
```

---
## [SUCCESS] GET /auth/me
- **Tavsif:** Joriy foydalanuvchi ma'lumotlarini olish (/auth/me)
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"user":{"id":"3583cfcb-8e61-4c75-b95d-6216dc8a6b44","fullName":"Test Admin","phone":"+99890104679","email":"admin_104679@example.com","organizationUserId":"a2369068-c7a8-438e-ab8a-e8bce6cf2b7d"},"organization":{"id":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Test Org 104679","tin":"123456789","phone":"+99890104679","currencyCode":"UZS","timezone":"Asia/Tashkent","allowNegativeStock":false,"receiptFooter":null},"role":"owner","stores":[{"id":"fa5e4203-b447-43a7-bcab-8c1ebe179f27","name":"Asosiy do'kon","address":"","phone":"+99890104679"}]}}
```

---
## [SUCCESS] GET /organizations
- **Tavsif:** Tashkilotlar ro'yxatini olish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":[{"id":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Test Org 104679","tin":"123456789","phone":"+99890104679","currencyCode":"UZS","timezone":"Asia/Tashkent","allowNegativeStock":false,"receiptFooter":null,"role":"owner","createdAt":"2026-09-17T12:27:31.888Z"}]}
```

---
## [SUCCESS] POST /organizations
- **Tavsif:** Yangi tashkilot yaratish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{
  "name": "Ikkinchi Tashkilot 104679",
  "tin": "987654321",
  "phone": "+998911234567",
  "currencyCode": "UZS",
  "timezone": "Asia/Tashkent",
  "allowNegativeStock": false,
  "receiptFooter": "Rahmat"
}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"id":"a6bfbf77-dd95-46fa-8d22-97890dfb1e28","name":"Ikkinchi Tashkilot 104679","tin":"987654321","phone":"+998911234567","currencyCode":"UZS","timezone":"Asia/Tashkent","allowNegativeStock":false,"receiptFooter":"Rahmat","createdAt":"2026-09-17T12:27:32.023Z"},"message":"Tashkilot muvaffaqiyatli yaratildi"}
```

---
## [SUCCESS] GET /organizations/f3be39eb-9d45-45fd-b084-f78d36570935
- **Tavsif:** Tashkilot tafsilotlarini olish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"id":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Test Org 104679","tin":"123456789","phone":"+99890104679","currencyCode":"UZS","timezone":"Asia/Tashkent","allowNegativeStock":false,"receiptFooter":null,"createdAt":"2026-09-17T12:27:31.888Z","stores":[{"id":"fa5e4203-b447-43a7-bcab-8c1ebe179f27","organizationId":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Asosiy do'kon","address":"","phone":"+99890104679","isActive":true,"createdAt":"2026-09-17T12:27:31.894Z","updatedAt":"2026-09-17T12:27:31.894Z","registers":[{"id":"6e6b63f2-4c46-43ed-b343-dd597bd743a0","storeId":"fa5e4203-b447-43a7-bcab-8c1ebe179f27","name":"Kassa 1","code":"REG001","isActive":true,"createdAt":"2026-09-17T12:27:31.897Z"}]}],"users":[{"id":"a2369068-c7a8-438e-ab8a-e8bce6cf2b7d","organizationId":"f3be39eb-9d45-45fd-b084-f78d36570935","userId":"3583cfcb-8e61-4c75-b95d-6216dc8a6b44","role":"owner","isActive":true,"createdAt":"2026-09-17T12:27:31.892Z","user":{"id":"3583cfcb-8e61-4c75-b95d-6216dc8a6b44","fullName":"Test Admin","phone":"+99890104679","email":"admin_104679@example.com","passwordHash":"$2b$10$feuM3w3Vobd53FmgSi/ghucF5QA/Dp0eILY81H5JKBHkqsqztIam2","isActive":true,"lastLoginAt":"2026-09-17T12:27:31.975Z","createdAt":"2026-09-17T12:27:31.890Z"}}]}}
```

---
## [SUCCESS] PUT /organizations/f3be39eb-9d45-45fd-b084-f78d36570935
- **Tavsif:** Tashkilot sozlamalarini yangilash
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{"receiptFooter": "Xaridingiz uchun rahmat!"}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"id":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Test Org 104679","tin":"123456789","phone":"+99890104679","currencyCode":"UZS","timezone":"Asia/Tashkent","allowNegativeStock":false,"receiptFooter":"Xaridingiz uchun rahmat!","createdAt":"2026-09-17T12:27:31.888Z"},"message":"Tashkilot muvaffaqiyatli yangilandi"}
```

---
## [SUCCESS] GET /organizations/f3be39eb-9d45-45fd-b084-f78d36570935/users
- **Tavsif:** Tashkilot foydalanuvchilarini olish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":[{"id":"a2369068-c7a8-438e-ab8a-e8bce6cf2b7d","user":{"id":"3583cfcb-8e61-4c75-b95d-6216dc8a6b44","fullName":"Test Admin","phone":"+99890104679","email":"admin_104679@example.com","isActive":true},"role":"owner","isActive":true,"stores":[{"id":"fa5e4203-b447-43a7-bcab-8c1ebe179f27","name":"Asosiy do'kon"}],"createdAt":"2026-09-17T12:27:31.892Z"}]}
```

---
## [SUCCESS] POST /organizations/f3be39eb-9d45-45fd-b084-f78d36570935/users
- **Tavsif:** Tashkilotga foydalanuvchi qo'shish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{
  "fullName": "Test Kassir",
  "phone": "+99893104679",
  "email": "cashier_104679@example.com",
  "password": "password123",
  "role": "cashier"
}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"id":"cf3648cc-83c4-4d56-aa5d-28caa8a323ba","organizationId":"f3be39eb-9d45-45fd-b084-f78d36570935","userId":"be291fe6-440e-4a18-88f0-78a6e120755f","role":"cashier","isActive":true,"createdAt":"2026-09-17T12:27:32.200Z","user":{"id":"be291fe6-440e-4a18-88f0-78a6e120755f","fullName":"Test Kassir","phone":"+99893104679","email":"cashier_104679@example.com","passwordHash":"$2b$10$uS4ke0nh8t3OJAqLdT9uG.RQaAF9GeuTqvJugrmTy2TZepncgQ/qS","isActive":true,"lastLoginAt":null,"createdAt":"2026-09-17T12:27:32.195Z"}},"message":"Foydalanuvchi muvaffaqiyatli qo'shildi"}
```

---
## [SUCCESS] GET /stores?organizationId=f3be39eb-9d45-45fd-b084-f78d36570935
- **Tavsif:** Do'konlar ro'yxatini olish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":[{"id":"fa5e4203-b447-43a7-bcab-8c1ebe179f27","organizationId":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Asosiy do'kon","address":"","phone":"+99890104679","isActive":true,"createdAt":"2026-09-17T12:27:31.894Z","updatedAt":"2026-09-17T12:27:31.894Z","registers":[{"id":"6e6b63f2-4c46-43ed-b343-dd597bd743a0","storeId":"fa5e4203-b447-43a7-bcab-8c1ebe179f27","name":"Kassa 1","code":"REG001","isActive":true,"createdAt":"2026-09-17T12:27:31.897Z"}]}]}
```

---
## [SUCCESS] POST /stores
- **Tavsif:** Yangi do'kon yaratish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{
  "organizationId": "f3be39eb-9d45-45fd-b084-f78d36570935",
  "name": "Chilonzor Filiali",
  "address": "Toshkent",
  "phone": "+998901234567"
}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"id":"b85c3a3b-5d5b-418f-a990-782af9537711","organizationId":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Chilonzor Filiali","address":"Toshkent","phone":"+998901234567","isActive":true,"createdAt":"2026-09-17T12:27:32.253Z","updatedAt":"2026-09-17T12:27:32.253Z"},"message":"Do'kon muvaffaqiyatli yaratildi"}
```

---
## [SUCCESS] GET /stores/b85c3a3b-5d5b-418f-a990-782af9537711
- **Tavsif:** Do'kon tafsilotini olish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"id":"b85c3a3b-5d5b-418f-a990-782af9537711","organizationId":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Chilonzor Filiali","address":"Toshkent","phone":"+998901234567","isActive":true,"createdAt":"2026-09-17T12:27:32.253Z","updatedAt":"2026-09-17T12:27:32.253Z","registers":[]}}
```

---
## [SUCCESS] PUT /stores/b85c3a3b-5d5b-418f-a990-782af9537711
- **Tavsif:** Do'konni yangilash
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{"address": "Toshkent, Chilonzor 19"}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"id":"b85c3a3b-5d5b-418f-a990-782af9537711","organizationId":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Chilonzor Filiali","address":"Toshkent, Chilonzor 19","phone":"+998901234567","isActive":true,"createdAt":"2026-09-17T12:27:32.253Z","updatedAt":"2026-09-17T12:27:32.373Z"},"message":"Do'kon muvaffaqiyatli yangilandi"}
```

---
## [SUCCESS] POST /stores/b85c3a3b-5d5b-418f-a990-782af9537711/registers
- **Tavsif:** Do'konga kassa qo'shish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{"name": "Kassa 2", "code": "REG002"}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"id":"7b0e0079-4325-4246-954e-7cb6a32e78e6","storeId":"b85c3a3b-5d5b-418f-a990-782af9537711","name":"Kassa 2","code":"REG002","isActive":true,"createdAt":"2026-09-17T12:27:32.399Z"},"message":"Kassa muvaffaqiyatli yaratildi"}
```

---
## [SUCCESS] GET /stores/b85c3a3b-5d5b-418f-a990-782af9537711/registers
- **Tavsif:** Do'konga tegishli kassalarni olish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":[{"id":"7b0e0079-4325-4246-954e-7cb6a32e78e6","storeId":"b85c3a3b-5d5b-418f-a990-782af9537711","name":"Kassa 2","code":"REG002","isActive":true,"createdAt":"2026-09-17T12:27:32.399Z"}]}
```

---
## [SUCCESS] PUT /registers/7b0e0079-4325-4246-954e-7cb6a32e78e6
- **Tavsif:** Kassa nomini yangilash
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{"name": "Kassa 2 (Asosiy)"}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"id":"7b0e0079-4325-4246-954e-7cb6a32e78e6","storeId":"b85c3a3b-5d5b-418f-a990-782af9537711","name":"Kassa 2 (Asosiy)","code":"REG002","isActive":true,"createdAt":"2026-09-17T12:27:32.399Z"},"message":"Kassa muvaffaqiyatli yangilandi"}
```

---
## [SUCCESS] GET /categories?organizationId=f3be39eb-9d45-45fd-b084-f78d36570935
- **Tavsif:** Kategoriyalar ro'yxatini olish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":[]}
```

---
## [SUCCESS] POST /categories
- **Tavsif:** Kategoriya yaratish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{
  "organizationId": "f3be39eb-9d45-45fd-b084-f78d36570935",
  "name": "Ichimliklar 104679",
  "sortOrder": 1
}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"id":"ed3ce649-2feb-4100-8475-5954dec4bb59","organizationId":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Ichimliklar 104679","sortOrder":1,"isActive":true,"createdAt":"2026-09-17T12:27:32.491Z","updatedAt":"2026-09-17T12:27:32.491Z"},"message":"Kategoriya muvaffaqiyatli yaratildi"}
```

---
## [SUCCESS] PUT /categories/ed3ce649-2feb-4100-8475-5954dec4bb59
- **Tavsif:** Kategoriyani yangilash
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{"name": "Salqin Ichimliklar"}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"id":"ed3ce649-2feb-4100-8475-5954dec4bb59","organizationId":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Salqin Ichimliklar","sortOrder":1,"isActive":true,"createdAt":"2026-09-17T12:27:32.491Z","updatedAt":"2026-09-17T12:27:32.515Z"},"message":"Kategoriya muvaffaqiyatli yangilandi"}
```

---
## [SUCCESS] GET /products?organizationId=f3be39eb-9d45-45fd-b084-f78d36570935
- **Tavsif:** Mahsulotlar ro'yxatini olish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":[],"pagination":{"page":1,"limit":20,"total":0,"totalPages":0}}
```

---
## [SUCCESS] POST /products
- **Tavsif:** Mahsulot yaratish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{
  "organizationId": "f3be39eb-9d45-45fd-b084-f78d36570935",
  "categoryId": "ed3ce649-2feb-4100-8475-5954dec4bb59",
  "name": "Cola 1.5L",
  "sku": "COLA-104679",
  "barcode": "478000104679",
  "unit": "dona",
  "salePrice": 12000,
  "costPrice": 9000,
  "minStock": 5
}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"id":"9a363600-a8c8-4521-a36b-00482ddcaf46","organizationId":"f3be39eb-9d45-45fd-b084-f78d36570935","categoryId":"ed3ce649-2feb-4100-8475-5954dec4bb59","name":"Cola 1.5L","sku":"COLA-104679","barcode":"478000104679","unit":"dona","salePrice":"12000","costPrice":"9000","minStock":"5","imageUrl":null,"isActive":true,"createdAt":"2026-09-17T12:27:32.590Z","updatedAt":"2026-09-17T12:27:32.590Z","category":{"id":"ed3ce649-2feb-4100-8475-5954dec4bb59","organizationId":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Salqin Ichimliklar","sortOrder":1,"isActive":true,"createdAt":"2026-09-17T12:27:32.491Z","updatedAt":"2026-09-17T12:27:32.515Z"}},"message":"Mahsulot muvaffaqiyatli yaratildi"}
```

---
## [SUCCESS] GET /products/9a363600-a8c8-4521-a36b-00482ddcaf46
- **Tavsif:** Mahsulot tafsilotini olish
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"id":"9a363600-a8c8-4521-a36b-00482ddcaf46","organizationId":"f3be39eb-9d45-45fd-b084-f78d36570935","categoryId":"ed3ce649-2feb-4100-8475-5954dec4bb59","name":"Cola 1.5L","sku":"COLA-104679","barcode":"478000104679","unit":"dona","salePrice":"12000","costPrice":"9000","minStock":"5","imageUrl":null,"isActive":true,"createdAt":"2026-09-17T12:27:32.590Z","updatedAt":"2026-09-17T12:27:32.590Z","category":{"id":"ed3ce649-2feb-4100-8475-5954dec4bb59","organizationId":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Salqin Ichimliklar","sortOrder":1,"isActive":true,"createdAt":"2026-09-17T12:27:32.491Z","updatedAt":"2026-09-17T12:27:32.515Z"}}}
```

---
## [SUCCESS] PUT /products/9a363600-a8c8-4521-a36b-00482ddcaf46
- **Tavsif:** Mahsulot narxini yangilash
- **HTTP Status:** 200
- **Yuborilgan Payload:**
```json
{"salePrice": 12500}
```
- **Qaytgan Javob:**
```json
{"success":true,"data":{"id":"9a363600-a8c8-4521-a36b-00482ddcaf46","organizationId":"f3be39eb-9d45-45fd-b084-f78d36570935","categoryId":"ed3ce649-2feb-4100-8475-5954dec4bb59","name":"Cola 1.5L","sku":"COLA-104679","barcode":"478000104679","unit":"dona","salePrice":"12500","costPrice":"9000","minStock":"5","imageUrl":null,"isActive":true,"createdAt":"2026-09-17T12:27:32.590Z","updatedAt":"2026-09-17T12:27:32.707Z","category":{"id":"ed3ce649-2feb-4100-8475-5954dec4bb59","organizationId":"f3be39eb-9d45-45fd-b084-f78d36570935","name":"Salqin Ichimliklar","sortOrder":1,"isActive":true,"createdAt":"2026-09-17T12:27:32.491Z","updatedAt":"2026-09-17T12:27:32.515Z"}},"message":"Mahsulot muvaffaqiyatli yangilandi"}
```

---
