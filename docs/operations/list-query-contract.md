# Ro‘yxatlarning URL va server contracti

2026-10-13. Bu UX-01.03 ning birinchi ish paketi; butun original band tugagan emas.

`/products`, `/customers`, `/sales` ekranlarida qo‘llangan qidiruv, saralash va sahifa URLda saqlanadi. Reload va brauzerning orqaga tugmasi shu filtrlangan sahifani qayta yuklaydi. Qidirish tugmasi yoki Enter qidiruvni qo‘llaydi; filtr/saralash o‘zgarsa birinchi sahifaga qaytiladi. Mahsulotlarda kategoriya ham URLda. Kamera skaneri mavjud oddiy barkod qidiruviga xizmat qiladi; real tarozi yoki maxsus hardware qo‘shilmagan.

`ListFilter`, `DataTable`, `Pagination`, `Input`, `Select`, `Button` mavjud React/Tailwind stackidan foydalanadi. Yangi framework/paket qo‘shilmadi. `DataTable` native table, row/header/cell va sahifaning ustunlarini saqlaydi. Mahsulot/mijoz formasi drafti, original saqlash oqimi va vakolatlar saqlangan.

Server qidiruvni 200 belgi, sahifani musbat butun son, limitni 1–200 va offsetni 2147483647 bilan cheklaydi. Saralash faqat har endpointning allowlistidan; xarajat yoki boshqa maxfiy ustun bo‘yicha ixtiyoriy sort yo‘q. Summa/narx PostgreSQL Decimal ustunida saralanadi; client faqat server sahifasini ko‘rsatadi. Bir xil qiymatlar id bilan ajratiladi. Filtrlangan count va rows bitta RepeatableRead snapshotda olinadi; turli HTTP sahifalar bir umumiy muzlatilgan snapshot emas. Jonli yozuvlar o‘zgarsa, ro‘yxatni qayta yuklash kerak.

JSON `totalPages=0` bilan bo‘sh natijani qaytarishi mumkin; UI kamida `1 / 1` ko‘rsatib, Keyingi tugmasini o‘chiradi. Oxirgi sahifa mavjud bo‘lmay qolsa, birinchi sahifaga qaytish tugmasi bor. Yuklash xatosi bo‘sh natija sifatida ko‘rsatilmaydi. Kechikkan oldingi so‘rov yangi filtr natijasini almashtirmaydi. Actor/tashkilot/rol (savdolarda filial ham) o‘zgarsa workspace qayta yaratiladi.

Mahsulot/mijoz CSV eksporti butun filtrlangan natijani ayni server sort bilan beradi; UI sahifasi eksportni qisqartirmaydi. 10000 qatorlik mavjud eksport capi saqlangan. Ushbu paket mavjud catalog lease vakolatini kengaytirmaydi va offline checkoutni o‘zgartirmaydi.

Mahalliy birinchi paket dalili: `tasks/evidence/list-query-core-20261013.json`. 105 qatorli synthetic browser fixture eski 100 qatorlik UI cheklovidan keyingi yozuvlarga yetishini tekshiradi. Bu real mijoz bazasi, real katta production hajmi yoki pilot dalili emas.

Ikkinchi paket `/products/categories` va `/products/units` ro‘yxatlarini shu contractga olib keladi. Qidiruv, holat, sort va page URLda; alohida tahrirlash formasi drafti filtr/sahifa o‘zgarganda yo‘qolmaydi. Original kategoriya sortOrder defaulti, opt-in pagination, birlik GETning 200 default limit va precision/archive mutatsiya cheklovlari saqlangan. UI aniq20 limit beradi. Bo‘sh sahifada qayta birinchi sahifaga o‘tish bor. Dalil: `tasks/evidence/list-query-reference-20261013.json`; birinchi paket manifestidagi hashlar uning tarixiy source checkpointiga tegishli, ikkinchi manifest yangi umumiy helper va beshta ro‘yxat versiyasini ko‘rsatadi.

Keyingi UX-01.03 ishlari: inventory/transfers, supplier, shift, audit, finance, reports va boshqa ro‘yxatlarning qo‘llangan filtr/page holatini URL bilan bog‘lash; moliyaviy journalning original ketma-ketligini saqlash; barcha loading/empty/error holatlarini tekshirish. Oddiy config formalari va transaction ro‘yxatlari bir xil talabga ko‘r-ko‘rona aylantirilmaydi. Uz/Ru tarjimalar original UX-01.02 da alohida ochiq.


2026-10-15 yangilanish: yuqoridagi ikki paket tarixiy checkpointlardir. Original UX-01.03 endi qabul qilindi; to‘liq qamrov va istisnolar `list-query-coverage.md`, yakuniy SHA/test dalili `../../tasks/evidence/list-journals-20261015.json` da. Uz/Ru original UX-01.02 hamon alohida ochiq.
