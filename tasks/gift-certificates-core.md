# Sovg‘a sertifikati: ichki production core

2026-10-14. Bu CRM-02.03 ning sertifikat qismi. Karta va promo-kod tugamaguncha original band `done` emas. Haqiqiy production, pilot, fiskal, Click yoki hardware qabul dalili hisoblanmaydi.

## Ishlaydigan jarayon

Tashkilot egasi `/loyalty` sahifasida sertifikatni yoqadi, minimal/maksimal summani, muddatni va ishlatilmagan pulni qaytarish ruxsatini belgilaydi. Policy saqlash mavjud TOTP/MFA va revision/idempotency tekshiruvidan o‘tadi. Stavkalar koddagi yashirin biznes narxlari emas, `LoyaltyPolicyVersion`da saqlanadi.

Egasi mijoz sahifasida ochiq smenaning haqiqiy naqd hisobini tanlab, sertifikat chiqaradi. Sertifikat **mijozga biriktirilgan**; kod bearer to‘lov tokeni emas. Chiqarish `FinancialDocument(customer_advance)`, haqiqiy `AccountEntry`/`CashMovement` va `CustomerAdvance` bilan bitta tranzaksiyada yoziladi. `GiftCertificate` shu original avansga bog‘lanadi. Chegaradan oshish, takror kod, noto‘g‘ri policy yoki source proof xatosi naqd kirimni ham rollback qiladi.

Mijoz tanlangan qoralama savdoda owner/admin/assigned cashier sertifikat va qolgan naqd summani ko‘rsatib checkout qiladi. Server narx, soliq, qoldiq, smena, kassir vakolati va chegirma chegaralarini oddiy checkout kabi tekshiradi. Sertifikat qoldig‘i qulflanadi. `GiftCheckout`, goods sale, to‘lov, stock va real avans allocation birga commit bo‘ladi. Oldindan to‘langan qism uchun mijozning nasiya limitini ko‘tarish talab qilinmaydi; oxirida yangi qarz qolmaydi.

Backend settlement uchun mavjud credit + advance allocation mexanizmini qayta ishlatadi. `GiftCheckout` native proof haqiqiy sarflashni talab qiladi; tasdiqlanmagan intent orqali nasiya bonus istisnosini soxtalashtirib bo‘lmaydi. Gift-funded goods sale administratorning non-credit bonus siyosati bo‘yicha ball olishi mumkin; sertifikatning chiqarilishi o‘zi goods revenue yoki bonus bermaydi. Chekda original funding kodi bilan **Sertifikat** ko‘rsatiladi.

## Pul va majburiyat

- Chiqarish: naqd pul kiradi, avans majburiyati oshadi; goods sale yaratilmaydi.
- Sarflash: majburiyat actual salega ajratiladi; ikkinchi naqd kirim yoki ikkinchi goods revenue yaratilmaydi.
- Goods return: mavjud, oldin qabul qilingan cash-advance return qoidasi bilan real original goods qiymati naqd qaytariladi. Sertifikatga yana mablag‘ qo‘shilmaydi. Shunday qilib bitta return ham cash payout, ham gift restore bilan ikki marta qoplanmaydi.
- Ishlatilmagan pulni qaytarish: faqat original issuance policy ruxsat bergan bo‘lsa va available qoldiq yetarli bo‘lsa, real cash-out jurnaliga yoziladi.
- Expiry yoki policy suspension: sarflash to‘xtaydi; majburiyat saqlanadi. Avtomatik write-off yoki daromadga o‘tkazish yo‘q.

Gift liability `CustomerAdvanceBalance`ning **bir qismi**. Gift va umumiy advance available summalarini qo‘shib yangi umumiy qarz deb hisoblash mumkin emas. Shu original avans ikki widgetda ko‘rinishi yangi moliyaviy yozuv degani emas.

## Native xavfsizlik va tiklash

174–176 yangi append-only migratsiyalar. Avval qo‘llangan migratsiyalar tahrirlanmagan. Gift source faqat o‘sha tranzaksiyada haqiqiy cash journal bilan yaratilgan avansni oladi. Hujjat va avans sanasi bazaning bir xil transaction timestampidan olinadi. Original code, expiry, amount/source va checkout jurnali immutable. Customer archive/merge uchun mavjud unused-advance himoyasi saqlanadi.

Expiry, current enabled state, original unused-refund permission va actual sale source **oddiy advance allocation/refund endpointida ham** tekshiriladi. Native proof soxta checkout yoki qoplanmagan gift creditni rad etadi. Journal yozuvlari read-only subscription guard va tenant eksporti bilan qamrab olingan. Gift checkout authorization `sessionId` eksportga chiqmaydi. Cashier gift variantlarini faqat o‘zining scoped savdosidagi mijoz uchun ko‘radi; issuer/refund operatori owner bo‘lib qoladi.

`runOperation` deferred constraintlarni acknowledgementdan oldin `SET CONSTRAINTS ALL IMMEDIATE` bilan tekshiradi. Bir original amalni qayta yuborish ikki cash-in, ikki allocation, ikki stock issue yoki ikki bonus bermaydi. IndexedDB original intent saqlaydi; committed issuance va completed checkout javobi yo‘qolsa, reloaddan keyin ham original recovery ko‘rinadi.

Backup rehearsal haqiqiy local cash source, gift liability va checkout journalni dump/restore qilib solishtiradi. Production off-site backup yoki pilot natijasi deb yozilmaydi. Database session timezone **UTC** bo‘lishi shart; readiness noto‘g‘ri timezone yoki 133–176 core migrationlaridan biri yetishmasa 503 qaytaradi. Business ko‘rsatish sanalari Asia/Tashkent bilan formatlanadi.

## API

- `GET /api/loyalty/gifts?page=1&limit=20&search=CODE&customerId=UUID` — owner scoped list/liability.
- `POST /api/loyalty/gifts` — strict `action: issue | redeem | refund`. `redeem` owner tomonidan mavjud actual credit salega allocation; current gift expiry/term guards amal qiladi.
- `GET /api/sales/[id]/gift?page=1&search=CODE` — scoped customer gift choices; private authorization/source fields yo‘q.
- `POST /api/sales/[id]/gift` — atomic checkout: `operationId`, `giftId`, `giftAmount`, `customerConsent: true`, `reason`, remaining non-credit `payments`; mavjud `cashTendered`/serial selection/reservation maydonlari qo‘llanadi.

Offline cash v1 kontrakti o‘zgarmagan. Gift sarflash authoritative online transaction talab qiladi. Vendor-specific payment, fiscal va hardware transport qo‘shilmagan.
