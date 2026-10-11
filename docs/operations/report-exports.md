# To‘liq filtrlangan hisobot eksporti

Tashkilot egasi **Fon ishlari → Hisobot CSV/XLSX/PDF eksporti** orqali hisobotni, formatni va filtrlarni tanlaydi. Bo‘sh filtr qo‘shimcha cheklov qo‘ymaydi. Davr tashkilotning vaqt zonasida hisoblanadi; tarixiy `asOf` mavjud hisobot qoidalari bilan ishlaydi. Noma’lum filtrlar, tenantni almashtirish yoki pagination filtrini qo‘shish rad etiladi.

18 mavjud query bir xil service’dan API jadvali/CSV va background eksport uchun ishlaydi: savdo/qaytarishlar, mahsulot savdosi, xarid, savdo kesimlari, supplier balanslari, ombor qoldig‘i/harakati/disposition, mahsulot katalogi, kategoriya, birlik, mijoz, supplier, smena, stock document, transfer, audit va narx tarixi. Qamrov `src/lib/report-exports.ts` hamda `src/server/jobs/report-queries.ts` orqali tekshiriladi. Yangi yoki hali implementatsiya qilinmagan expiry/serial hisobotlari bu band bilan tayyor deb hisoblanmaydi.

Eksport UI sahifasi bilan cheklanmaydi. Row query’lar bir RepeatableRead transactionda 500-qatorli cursor bilan o‘qiladi; aggregate hisobotlar o‘z snapshot SQL va oldindan hisoblangan 10000-result chegarasini saqlaydi. Stock balance resurslarini 500 ta kalitdan guruhlab o‘qiydi. Stock document/transferda child line soni ham limitga kiradi. Natija 10000 qator/16MiB chegarasidan oshsa **qisman fayl berilmaydi**; filtrni toraytirish kerak. Avvalgi alohida katalog CSV workerining 100000-row chegarasi o‘zgarmadi.

CSV formula-safe escaping va exact decimal matnini saqlaydi. XLSX ExcelJS orqali yaratiladi; miqdor va pul qiymatlari matn hujayralaridir: Excelning binary precision cheklovi tannarxni buzmaydi, formulalar yaratilmaydi. Hisob-kitoblar mavjud Decimal/SQL report xizmatlarida bajariladi.

**PDF** uchun barcha qatorli xavfsiz `.print.html` yuklanadi. Faylni brauzerda ochib **Ctrl+P → PDF sifatida saqlash** tanlanadi. Bu original rejaning user print-to-PDF variantidir; avtomatik PDF server renderer yoki real printer integratsiyasi emas. Hujjat script/tashqi resurs talab qilmaydi, qiymatlar HTML-escaped, A3 landscape jadvalda ko‘rsatiladi. Chromium orqali 1001 qatorli haqiqiy PDF chiqarilishi va matni/ko‘rinishi qabul sinovida tekshiriladi.

Job original operation key bilan navbatga olinadi; lease/heartbeat, cheklangan retry, audit rollback va bitta immutable artifact mavjud worker contractidan foydalanadi. Worker generationga bog‘langan **joriy** sessiya/owner vakolatini o‘qishdan avval va publication commitidan oldin tekshiradi. Browser tokeni/pasword worker payloadga yozilmaydi, arbitrary URLga HTTP request yuborilmaydi. Foreign tenant yoki bekor qilingan source artifact chiqara olmaydi. Download ham joriy owner authorization, SHA256, 16MiB stream va actor rate limit bilan himoyalangan.

Artifact 24 soat yuklanadi; muddati tugagach 410 va byte erasure, metadata/audit saqlanadi. Faol eksportlar tashkilot uchun jami 32MiB bilan cheklangan. Mavjud expiration/worker restart job testlari report turiga ham qo‘llanadi. UI qo‘shimcha mijozlarga rasmiy SLA bermaydi.

Tekshiruvlar: `report-formats.unit.test.ts`, `report-export.integration.test.ts`, `tests/e2e/report-export.spec.ts`. Qabul fixturelari synthetic; real staging/production/pilot natijasi da’vo qilinmaydi.
