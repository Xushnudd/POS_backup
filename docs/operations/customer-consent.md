# Mijozning aloqa roziliklari

`LEG-01.05` elektron chek, xizmat eslatmasi va reklama uchun alohida rozilik tarixini saqlaydi. Har bir maqsad `sms`, `email`, `telegram` kanali bilan alohida baholanadi. Rozilik yo‘qligi ruxsat hisoblanmaydi. Bir maqsadga berilgan rozilik boshqasiga o‘tmaydi.

Tashkilot egasi mijoz kartasidagi **Aloqa uchun roziliklar** bo‘limida qarorni qayd etadi. Boshlang‘ich tanlov — bekor qilish; ruxsat avtomatik tanlanmaydi. Manba shaxsan qayd, yozma hujjat yoki mijoz so‘rovi bo‘lishi mumkin. Dalil identifikatori haqiqiy, vakolat bilan saqlangan hujjat/so‘rovga havola bo‘lsin; telefon, hujjat mazmuni, token va boshqa maxfiy qiymatlarni kiritmang. Rozilik matnining haqiqiy versiyasini ko‘rsating. Maydonga identifikator yozishning o‘zi rozilik berilganini isbotlamaydi: operator tegishli dalilni olishi shart.

Har bir qarorda server vaqti, manba, dalil havolasi, matn versiyasi, maqsad/kanal, egasi va ketma-ket revision saqlanadi. Eski hodisani tahrirlash yoki alohida o‘chirish taqiqlangan. Bekor qilish yangi hodisa yozadi. Obuna read-only bo‘lsa ham bekor qilish mumkin; yangi ruxsat berish mumkin emas. Bu jurnal tashkilot ma’lumotlarini avtomatik o‘chirish siyosatini o‘zgartirmaydi.

## API va parallel tahrir

`GET /api/customers/{id}/consents` eng yangi 50 hodisa, umumiy `revision` va `nextBefore` qaytaradi. Eski sahifa `?before=<revision>` bilan olinadi; cursor exclusive. Faqat tashkilot egasi o‘qiydi va yozadi. Mavjud autentifikatsiya, CSRF, rate limit va tenant tekshiruvlari qo‘llanadi.

`POST /api/customers/{id}/consents` quyidagi qat’iy body oladi:

```json
{
  "operationId": "<yangi UUID>",
  "expectedRevision": 0,
  "purpose": "electronic_receipt",
  "channel": "sms",
  "granted": true,
  "source": "written",
  "evidenceRef": "document:haqiqiy-dalil-identifikatori",
  "policyVersion": "tasdiqlangan-matn-versiyasi"
}
```

Bu misol tashqi manzil yoki yuborish formati emas. `purpose`: `electronic_receipt`, `service_reminder`, `marketing`; `source`: `in_person`, `written`, `customer_request`. `granted:false` bekor qilishni bildiradi. Body vaqt yoki actorni boshqarolmaydi. Unknown field rad etiladi.

Bir amalning qayta yuborilishi shu operation turida bitta hodisani qaytaradi. Turli body bilan bir kalit ishlatilsa konflikt bo‘ladi. Parallel operator eski revision bilan yozolmaydi: `CONSENT_REVISION_CONFLICT`dan so‘ng tarix qayta olinadi va yangi qaror qayta ko‘rib chiqiladi. Unknown tarmoq javobi saqlangan original amal bilan tekshiriladi; yangi kalit bilan ko‘r-ko‘rona takrorlanmaydi.

## Keyingi xabar yuboruvchi worker uchun contract

Navbatga qo‘yishda aynan o‘sha maqsad/kanalga tegishli ruxsat hodisasining IDsi saqlanishi kerak. Yuborish vaqtida worker `assertCurrentConsent(tx, organizationId, customerId, purpose, channel, eventId)`ni dispatch tranzaksiyasida chaqirishi shart. Helper mijoz yozuvini qulflab joriy hodisani qayta tekshiradi. Bekor qilingan rozilik, qayta berilgan yangi rozilik yoki kartaning keyingi tahriri oldingi navbatdagi xabarga ruxsat bermaydi. Kartadagi har qanday tahrirdan keyin yangi rozilik talab qilinishi kontakt o‘zgarishiga konservativ himoyadir. Arxiv/merge qilingan kartadan foydalanish rad etiladi; boshqa kartaga rozilik avtomatik ko‘chmaydi.

Bu helper faqat rozilikni tekshiradi. Yetkazuvchi worker alohida kontakt tekshiruvi, ruxsat etilgan muhit, tashkilot holati, idempotency, provider natijasi va retry siyosatini ham tekshirishi kerak. Real SMS/e-mail/Telegram yuboruvchi bu o‘zgarishda qo‘shilmagan. Rozilik qaydi `delivered` natijasini yaratmaydi, akkauntni tasdiqlamaydi va provider sozlanmagan funksiyani ishlaydigan qilib ko‘rsatmaydi. `CRM-02.02` eslatmalari va real yetkazish qabul mezonlari alohida kuzatiladi.

## Migratsiya va tekshiruv

180–184 additive migratsiyalar yangi binarydan avval qo‘llanadi. 180 jurnal va immutable guard; 181 read-only davrda bekor qilish istisnosi; 182 tenant va shu tranzaksiyadagi faol owner/session audit dalili; 183 oldingi loyalty/report jurnallarining umumiy tenant guardlarini to‘ldiradi. 184 mijozning har tahririda baza oshiradigan `consentRevision` va grant snapshotini qo‘shadi. Kontakt aynan bir millisekundda o‘zgarsa yoki writer eski `updatedAt`ni saqlasa ham rozilik eskiradi; klient counter qiymatini tushira olmaydi.184dan oldingi hodisalarning native revisioni noma’lum bo‘lgani uchun ular tarixda saqlanadi va yangi dispatch uchun qayta rozilik talab qilinadi. Oldingi migratsiyalar tahrirlanmagan. Ishlab turgan biznes bazasiga ushbu mashq davomida migratsiya qo‘llanmagan.

`tests/customer-consent.integration.test.ts` izolyatsiyalangan PostgreSQLda maqsad/kanal, withdrawal, contact tahriri, idempotency, parallel revision, session revocation, tenant, HTTP, pagination va read-only holatini tekshiradi. `tests/e2e/customer-consent.spec.ts` formani to‘ldirish, yo‘qolgan javob va eski revisiondan xavfsiz tiklanishni tekshiradi. Sintetik dalil identifikatorlari haqiqiy mijoz roziligi sifatida ko‘rsatilmaydi.
