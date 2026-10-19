# Tarozi barkodi: xavfsiz parser chegarasi

CAT-01.05 uchun real tarozi modeli va rasmiy format tasdiqlanmagan. Real integratsiya `blocked_external`; quyidagi modul uning mustaqil core chegarasidir. Unda birorta real vendor profili yoki taxminiy EAN/checksum qoidasi yo‘q.

`src/server/catalog/barcodes/scale-parser.ts` server konfiguratsiyasidan `ScaleBarcodeProfile` qabul qiladi. Profil ID/versiya, tasdiqlanish holati, uzunlik, prefiks, productCode maydoni, quantity/unit_price/total_price maydoni, decimal aniqlik va explicit checksum siyosatini belgilaydi. Offsetlar nol asosidan hisoblanadi. Maydonlar kesishishi, satrdan tashqariga chiqishi yoki takror profil ID rad etiladi. Raqamli formatlar va bazaning 6 kasr aniqligi qo‘llanadi; boshqa format uchun keyin alohida parser adapteri kerak bo‘ladi.

Faqat tasdiqlangan, yagona mos profil ishlaydi. Tasdiqlanmagan/nomalum format, ambiguous profile, nol qiymat, noto‘g‘ri belgilar va ishlamagan checksum xavfsiz rad etiladi. Provider checksum implementatsiyasi yo‘q bo‘lsa `SCALE_CHECKSUM_UNAVAILABLE`; xato/exception tasdiq hisoblanmaydi. Profil konfiguratsiyasi parse vaqtida o‘zgartirilmaydigan snapshotga olinadi. Qiymat decimal string sifatida chiqadi; floating-point ishlatilmaydi va productCode boshidagi nollar saqlanadi.

Parser natijasi savdoga ruxsat yoki narx tasdig‘i emas. Keyingi real ulashda server tashkilot/profil vakolatini, faol SKU/unitni, stock/reservationni, quantity aniqligini, amaldagi narxni va chegirma vakolatini mavjud sale transactionida qayta tekshirishi shart. Clientdan profil yoki checksum-verifier qabul qilinmaydi. Hozir parser POS checkoutga ulanmagan; oddiy barkod va kasr savdosi o‘zgarmagan. Hech qanday real hardware yoki tashqi API chaqirilmaydi.

`tests/scale-parser.unit.test.ts` dagi format faqat sintetik test uchun. U real tarozi, scanner yoki pilot qabul dalili emas. Rasmiy model/format/checksum va qabul sinovi tayyor bo‘lmaguncha original CAT-01.05 `done` bo‘lmaydi.
