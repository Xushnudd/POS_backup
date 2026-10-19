# Maxsus rollar va vakolatlar

Tashkilot egasi `/roles` sahifasida rol yaratadi, tahrirlaydi va faol xodimga biriktiradi. Omborchi, Buxgalter, Kuzatuvchi — boshlang‘ich namuna; ular avtomatik yaratilmaydi yoki mavjud xodimlarga berilmaydi. Egasi vakolatlarni tekshirib, nom va sabab bilan saqlaydi. Ro‘yxat 20 tadan sahifalanadi va nom bo‘yicha qidiriladi.

Maxsus profil mavjud admin/kassir rolini cheklaydi. Profil owner vakolatini bera olmaydi, kassir foyda/tannarxning admin ma’lumotlarini ocholmaydi. Admin asosidagi o‘qish vakolati o‘sha API ning mavjud admin maydonlarini ochishi mumkin. Bu maydonlar uchun yangi yashirish siyosati emas. Filial, resurs egaligi, manager tasdig‘i va platforma/support vakolatlari tekshiruvlari davom etadi. Profil ro‘yxatida ko‘rsatilgan endpoint vakolati qo‘shimcha DAL shartlarini bekor qilmaydi.

GET — o‘qish; POST — yaratish/tasdiqlash; PUT/PATCH — tahrirlash; DELETE — olib tashlash. Dynamic `[id]` bir xil endpoint oilasini bildiradi; bu boshqa tenant resursiga huquq bermaydi. Shaxsiy autentifikatsiya, TOTP, parol boshqaruvi va tashkilot tanlash profil bilan to‘sib qo‘yilmaydi. Yangi endpoint avtomatik profilga qo‘shilmaydi.

Profil asosiy rolini keyin o‘zgartirib bo‘lmaydi: kerak bo‘lsa yangi profil yarating. Har bir tahrir `expectedRevision` bilan himoyalangan; parallel tahrirda faqat bir versiya qabul qilinadi. Saqlash original `operationId` va payload bilan qaytarilsa biznes o‘zgarishi takrorlanmaydi. Tahrirning sabab va oldingi/yangi matritsasi audit qilinadi. `AUTH_CRITICAL_MFA_REQUIRED=true` bo‘lsa yaratish/tahrirlash uchun TOTP step-up ham talab qilinadi.

Vakolat yoki faol holat o‘zgarganda SQL trigger shu tashkilotdagi barcha biriktirilgan sessiyalarni bekor qiladi. Xodim parol/PIN bilan qayta kiradi; nofaol profilda kirish rad qilinadi. Eski kontekst revision tekshiruvidan o‘tmaydi. Audit xatosida profil, sessiya revocation va operation bir tranzaksiyada orqaga qaytadi.

Xodimga profil biriktirish uning asosiy rolini profilga moslaydi; filial biriktirishlarini saqlaydi. Profilni olib tashlash asosiy rolning to‘liq mavjud vakolatlarini qaytaradi — bu huquq kengayishi, egasi ongli ravishda tasdiqlashi kerak. Oxirgi egani profil orqali ham demote qilish mumkin emas. Nofaol profil tarixdan o‘chirilmaydi; egasi xodimga faol profil yoki oddiy asosiy rol berishi mumkin. Egalik qabul qilinganda yangi egadan profil olib tashlanadi.

Migratsiya `202610110122_custom_roles`: tenant composite FK, base-role/identity/revision/source author cheklovlari, subscription/closure read-only guard va sessiya revocation trigger. Mavjud xodimlar `customRoleId=NULL` bilan oldingi tartibda davom etadi. Deploymentdan oldin odatiy migration preflight va backup tartibi bajariladi; ushbu ish production bazasiga migratsiya ishlatmaydi.
