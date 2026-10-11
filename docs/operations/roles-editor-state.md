# Rol va profil tahriri holatlari

UX-01.05 doirasidagi qisman implementatsiya. Rol yaratish/tahrirlash va xodimga profil biriktirish alohida qoralama hamda alohida original operationId bilan ishlaydi. Bir forma amali boshqa formaning noma’lum natijasini almashtirmaydi.

Saqlanmagan tahrirni bekor qilish tasdiq talab qiladi. Permissions ro‘yxatining tartibi o‘zgarsa, lekin vakolatlar to‘plami o‘zgarmasa, forma dirty hisoblanmaydi. Xodim tanlanganda uning amaldagi customRoleId yuklanadi; profilni o‘zgartirmasdan saqlash o‘chiq. Boshqa xodimga o‘tish rad etilsa joriy tanlov saqlanadi.

Javob yo‘qolsa, yuborilgan path, method, payload va operationId komponent xotirasida o‘zgarmas snapshot bo‘lib qoladi. Tegishli forma maydonlari qulflanadi; original amalni tekshirish tugmasi aynan shu so‘rovni qaytaradi. Ikkinchi mustaqil forma o‘z kaliti bilan ishlashi mumkin. Muddati tugamagan MFA proof faqat o‘sha session/action/key/payload uchun qayta ishlatiladi; yangi amal uchun yangi tasdiq kerak. Backend MFA siyosati o‘zgartirilmagan.

Aniq validation yoki revision conflict qoralamani saqlaydi va tuzatishga imkon beradi. Server saqlashni tasdiqlaganidan keyingi list refresh xatosi saqlash xatosi deb ko‘rsatilmaydi: muvaffaqiyat xabari saqlanadi va ro‘yxatni qayta yuklash mumkin.

## Chegaralar

Snapshot faqat komponent xotirasida. Reload yoki tasdiqlangan navigationdan keyin avtomatik durable recovery yo‘q. Pending amal bilan ketish xavfi haqida ogohlantirish mavjud, lekin bu reload recovery yakunlanganligini anglatmaydi. Barcha boshqa sahifalar va SPA back/forward qabul mezonlari tugamaguncha original UX-01.05 in_progress qoladi. Production deployment, vendor yoki pilot dalili yaratilmagan.
