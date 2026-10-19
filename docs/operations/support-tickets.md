# Ichki support ticket tizimi

`/tickets` orqali murojaat yaratiladi, kuzatiladi va javob beriladi. Oddiy, muhim va kritik darajalar mavjud. Kassir/admin o‘z murojaatlarini, biznes egasi tashkilotning barcha murojaatlarini ko‘radi. Platforma navbati uchun alohida faol `PlatformOperator` vakolati va parol bilan ochilgan sessiya kerak. Biznesdagi owner roli platforma vakolati bermaydi. Ticketga kirish biznesning katalogi, naqd puli yoki boshqa ma’lumotlariga kirish huquqi bermaydi; bunday kirish uchun mavjud alohida SupportGrant tartibi saqlanadi.

## Ish tartibi — taklif, rasmiy SLA emas

Dastlabki bazadagi versiya: dushanba–shanba 09:00–18:00, Asia/Tashkent, birinchi javob uchun 240 ish minuti, eskalatsiya belgisi uchun 240 ish minuti. Bu mijozga kafolat emas. Telefon, e-mail, Telegram yoki navbatchi mas’ul uydirilmagan; tashqi xabar yuborish yo‘q. Haqiqiy operatorni faol platforma xodimlari ichidan tayinlash mumkin. Tasdiqlangan favqulodda kanal va rasmiy xizmat shartlari hozircha tashqi qarorga bog‘liq.

Platforma administratori ish kunlari, ochilish/yopilish vaqti, javob va eskalatsiya muddatini sabab bilan yangi o‘zgarmas versiya sifatida chiqaradi. Yangi versiya yangi murojaatlarga qo‘llanadi; eski ticketning kelishilgan ichki maqsadi va tarixini qayta yozmaydi. Hozir barcha versiyalar `draft`, favqulodda kontakt `null`. Ish vaqtidan tashqaridagi vaqt va yakshanba muddat hisobiga kirmaydi.

## Amallar va xavfsizlik

Yaratish, javob, holat, daraja va mas’ulni o‘zgartirish original `operationId` bilan tranzaksiyada bajariladi. Audit yoki tarix yozish muvaffaqiyatsiz bo‘lsa butun amal qaytadi. Yo‘qolgan HTTP javobidan keyin aynan original amalni tekshirish tugmasi ishlatiladi; yangi kalit bilan takror murojaat yaratish kerak emas. Replay ham joriy vakolatni tekshiradi.

Faqat vakolatli operatorning haqiqiy ichki javobi birinchi javob vaqtini belgilaydi. Mas’ul tayinlash yoki holatni o‘zgartirish javob hisoblanmaydi. Birinchi yechim vaqti alohida saqlanadi. Qayta ochishda birinchi yechim tarixi yo‘qolmaydi. Yopiq murojaatga javob berishdan oldin uni qayta ochish kerak. Tarix o‘zgarmas, oxirgi 20 hodisa va sahifalash bilan ko‘rsatiladi.

Diagnostikaga faqat tekshirilgan request UUID, ma’lum sahifa, xato kodi va ilova versiyasi ruxsat etiladi. Raw log, header, token, parol, kalit va karta ma’lumotlari kiritilmaydi. Mavzu va izoh foydalanuvchi matni bo‘lgani uchun maxfiy ma’lumot yubormaslik kerak. Ro‘yxatlar 20 qatorli, qidiruv va API limitlari chegaralangan. HTTP yozish amallarida mavjud CSRF va sessiya himoyasi saqlanadi.

## API

- `GET /api/support/tickets`: `scope=tenant|platform`, `page`, `state`, `severity`, `search`.
- `POST /api/support/tickets`: `operationId`, `title`, `description`, `severity`, ixtiyoriy `diagnostics`.
- `GET /api/support/tickets/:id`: `scope`, tarix uchun `page`.
- `POST /api/support/tickets/:id/commands`: `operationId`, `scope`, `action=reply|state|assignment|severity`, `message` va tanlangan amalning maydoni.
- `GET /api/support/tickets/operators`: faqat platforma operatorlariga faol mas’ullar.
- `GET /api/support/policy`: joriy ichki taklif.
- `POST /api/support/policy`: faqat platforma administratori; `operationId`, `timezone`, `weekdays`, `opensMinute`, `closesMinute`, `firstResponseMinutes`, `escalationMinutes`, `reason`.

Bu ichki funksiyalar real aloqa integratsiyasi yoki inson tomonidan SLA bajarilishini isbotlamaydi. Rasmiy SLA va favqulodda kanal tasdiqlanmaguncha BIZ-02.03 bandining tashqi qismi `blocked_external` bo‘lib qoladi.
