# Chekning tarixiy rekvizitlari

Migration `202610100109_receipt_identity_snapshot` yangi savdo yakunlanayotganda tashkilot nomi/telefoni/STIR, valyuta, vaqt zonasi, chek yakuni matni, filial nomi/manzili/telefoni, kassa nomi/kodi va original kassir nomini server bazasidagi haqiqiy manbalardan saqlaydi. Bu `Sale.receiptSnapshot` ichidagi version=1 yozuvdir. UI yoki API orqali yuborilgan o‘zboshimcha snapshot ishlatilmaydi; draftda snapshot NULL.

Snapshot savdo/to‘lov/stock tranzaksiyasining bir qismidir. Checkout rollback bo‘lsa snapshot ham yozilmaydi. Qayta so‘rov original Operation natijasini qaytaradi. Yakunlangan chek snapshoti to‘g‘ridan-to‘g‘ri SQL/Prisma bilan ham tahrirlanmaydi. Keyinchalik tashkilot, filial, kassir yoki chek sozlamalari o‘zgarsa, 58/80 mm nusxa original rekvizitlardan foydalanadi. UI matnlarni React orqali xavfsiz chiqaradi.

Eski yakunlangan cheklarga bugungi rekvizitlar tarixiy ma’lumot deb backfill qilinmaydi. NULL snapshotli eski chekda asl rekvizitlar saqlanmaganligi ko‘rsatiladi; cashier ID saqlanadi va sana joriy tashkilot vaqt zonasida ko‘rsatilgani tushuntiriladi. Mahsulot/miqdor/narx/soliq/chegirma tarixiy SaleItem snapshotidan olinadi.

Brauzerdagi chop etish/PDF — fiskal emas. `receipt_print_requested` faqat dialog so‘ralganini auditlaydi, fizik chop bo‘lganini tasdiqlamaydi. Bir operationId bilan qayta urinish yangi savdo yoki qo‘shimcha iqtisodiy posting yaratmaydi. Haqiqiy printer integratsiyasi bu o‘zgarishga kirmaydi.

POS-02.09 hali to‘liq qabul qilinmaydi: tasdiqlangan kontaktga muddatli tokenli elektron chek yetkazish SMS/e-mail provayderi tanlanishini kutadi. Production mock yuborish yoki uydirma vendor endpointi qo‘shilmaydi.
