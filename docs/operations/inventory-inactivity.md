# Savdosiz qoldiq tahlili

Ombor → Qoldiqlar → “Filialda yakunlangan savdosiz qoldiq” tanlovi: barcha qoldiqlar yoki oxirgi30/60/90kun yakunlangan savdosiz mahsulotlar. Filial, qidiruv va kam-qoldiq filtri birgalikda qo‘llanadi; tanlov o‘zgarsa ro‘yxat birinchi sahifadan ochiladi. CSV ham aynan shu filtrni, barcha mos qatorlarni (mavjud10000cap doirasida) eksport qiladi.

API `GET /api/inventory/balances?inactiveDays=30`: optional safe integer1–3650; invalid400. Filtr berilmasa eski qoldiq ro‘yxati ishlashi saqlanadi. Natijada musbat joriy InventoryBalance.quantity bo‘lishi va shu organization/product/branch uchun oyna boshidan keyin yakunlangan savdo bo‘lmasligi kerak. Draft/held savdo aktivlik emas; completed/partially_returned/returned savdo aktivlik. Qaytarish original savdo harakatini tarixdan o‘chirmaydi. Oyna boshidagi savdo ham aktivlik: `completedAt >= inactiveSince`. Yakunlanish sanasi NULL eski yozuv yoki kelajak sanasi mavjud bo‘lsa mahsulotni ishonch bilan “savdosiz” deb ko‘rsatmaymiz.

Oyna N×24soat, UTC instant; tenantning lokal kalendar kuni emas. Root `meta` observedAt/inactiveSince/inactiveDays va definitionni beradi; CSVda shu oynaning UTC metadata qatorlari bor. Qoldiq va joriy tannarx RepeatableRead snapshotdan olinadi, hisob tarixiy asOf stock yoki tarixiy tannarx rekonstruksiyasi emas. Pul/miqdor Decimal string bo‘lib qoladi.

Bu mezon omborda turish yoshi yoki sotilish tezligining to‘liq prognozi emas. Yangi kirim qilingan va hali sotilmagan tovar ham natijaga kirishi mumkin. Reservationlardan keyingi available balance, partiya yoshi, yaroqlilik muddati yoki FEFO sifatida talqin qilmang. Partiya/yaroqlilik INV-02.06 core vazifasida ochiq; REP-01.07 shuning uchun butunlay done emas.

Owner own-tenant filiallar, admin faqat assigned filiallar; global tenant/live-session/custom-role admission saqlanadi. Begona/yashirin branch explicit filter404; CSV original role/rate/cap/formula-escape himoyalarini saqlaydi. Hech qanday posting, iqtisodiy tuzatish, avtomatik chegirma yoki qayta buyurtma yaratilmaydi.
