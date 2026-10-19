# Bonus ballari: original savdo, sarflash va qaytarish

Tashkilot egasi `/loyalty`da bonusni alohida yoqadi. Faol standart stavka yo‘q: ball berish uchun summa, ballning sarflash qiymati, maksimal foiz, minimal soliqsiz savdo, muddat, chegirmali va nasiyali savdoda ball berish egasi tanlovidir. Barcha qiymatlar immutable database policy versiyasida saqlanadi, o‘zgarish MFA va audit bilan tasdiqlanadi. Joriy pul contracti UZS. Karta/promo/sertifikat hali faol emas; ular alohida CRM-02.03 qabulidan oldin yoqilmaydi. Inactive sertifikat qiymati0 hech qanday real narx yoki limit emas.

## Ball berish

Faol policy va tanlangan mijoz bilan yakunlangan online savdo uchun `floor(soliqsiz netAmount / earnMoneyPerPoint)` integer ball beriladi. Administratorning minimal summa, chegirmali/nasiyali savdo tanlovlari tekshiriladi. Bitta original sale bitta `LoyaltyPointLot` beradi; replay ikkinchi grant yaratmaydi. Lot original policy ID va expiry sanasini saqlaydi. Keyingi qoida eski grantni o‘zgartirmaydi. Source lot va journal qo‘lda tahrirlanmaydi/o‘chirilmaydi.

Signed offline cash v1 snapshot bonus policy versiyasini saqlamaydi. Uning qayta ijrosi taxminiy bonus qo‘shmaydi; eski cash/stock/owner reconciliation contracti o‘z holida ishlaydi. Ball sarflash tanlovi bor chek uchun offline v1 lease berilmaydi. Tashqi servis, tarozi yoki printer protokoli kiritilmagan.

## Ball sarflash

Mijozli savdoning `/sales/:id` sahifasida walletni ko‘rish, ball tanlash va mijozning shu savdo uchun roziligini operator orqali qayd etish mumkin. Bu rozilik operator attestasiyasi; SMS/e-mail orqali mijoz autentifikatsiyasi sifatida ko‘rsatilmaydi. Sarflash summasi `points × redeemMoneyPerPoint`; subtotalning mavjud receipt chegirmasidan qolgan qismiga administrator maksimal foizi qo‘llanadi. Cap pastga, sentgacha yumaloqlanadi. Server barcha hisob va scope/actor/chegirma vakolatlarini tekshiradi; xodimning odatiy chegirma vakolati ham saqlanadi.

Tanlov tayyorlashda wallet hali sarflanmaydi. Bir draftda bitta faol original tanlov bor. Undagi mijoz, subtotal va item narx/miqdor/tax/price-rule snapshotiga o‘zgartirish kiritishdan oldin tanlov bekor qilinadi. Bekor qilish faqat yakunlanmagan tanlovning original manual chegirmasini tiklaydi. Note kabi moliyaviy bo‘lmagan maydonlar o‘zgarishi mumkin. Eski noma’lum natija yangi key bilan takrorlanmaydi: IndexedDBdagi original amal tekshiriladi.

Checkoutda joriy policy ID, wallet, expiry va receipt yana tekshiriladi. Faol lotlar yaratilgan sana/ID tartibida FIFO olinadi. Receipt o‘zining hali berilmagan ballari bilan o‘z chegirmasini moliyalashtirmaydi: debit triggeri earn triggeridan oldin ishlaydi. Actual customer/alias wallet lock, row locks va SERIALIZABLE/SSI retry parallel kassalarning bir qoldiqni ortiqcha sarflashini to‘sadi. Yutqazgan checkout stock/payment/pointsni qisman yozmaydi. Currency yoki qoida o‘zgarsa qayta review talab qilinadi.

## Qaytarish va suiiste’mol himoyasi

Receipt grantini qaytarishda original itemning receipt chegirmasidan oldingi qiymati vazn sifatida olinadi: `returnedQty × originalLineTotal / soldQty`. Cumulative weighted qiymat original subtotalga bo‘linadi. Earned grant reversal cumulative **ceiling**, sarflangan original lotga restore cumulative **floor** bilan hisoblanadi. Har bosqichda avvalgi yozuv ayiriladi; oxirgi to‘liq qaytarish aynan original miqdorni yopadi. Mayda bo‘lib qaytarish ortiqcha ball bermaydi. Monetary cash refundning amaldagi nonfinal rounding/final remainder contracti o‘zgarmaydi. Nol cashli to‘liq bonus receipt qaytarsa stock va original ball qaytadi, fake cash payment yaratilmaydi.

Qaytgan sarflangan ball aynan oldingi lotga tiklanadi, eski expiry uzaytirilmaydi. Muddati o‘tgan lotga tiklangan ball sarflanadigan qoldiqqa kirmaydi. Expiry vaqtida ma’lumot o‘chirilmaydi; active qoldiq `expiresAt > serverClock` bo‘yicha aniqlanadi.

Oldin berilgan ball sarflanib bo‘lganidan keyin uning tovari qaytarilsa, goods/cash refund bloklanmaydi. Alohida bonus recovery debt paydo bo‘lishi mumkin; foydalanuvchining sarflanadigan qoldig‘i manfiy ko‘rsatilmaydi. Mavjud faol ball yoki yangi grant qarzni paired `LoyaltyRecoveryTransfer` bilan bir marta qoplaydi: biri minus, ikkinchisi plus, yig‘indi0. Refundning restore va clawback qismlaridan keyin bitta final settlement ishlaydi. Shuning uchun credit keyin expiry bo‘lganda oldin qoplangan qarz qayta paydo bo‘lmaydi.

## Scope, audit, backup va chegaralar

- `LoyaltyPolicyVersion` faqat egasi; kassir/admin original source receipt scope va branch/own-shift qoidalariga amal qiladi. Kassir boshqa kassir chekiga ball tanlamaydi.
- GET wallet/selection exact string DTO beradi. Secret, original session ID va tannarx public point DTOga kirmaydi. Customer merge original lot/sale IDni qayta yozmaydi; eski va yangi alias bitta canonical walletga qaraydi.
- Source lot, debit, reversal, restore va recovery transfer native guardlar bilan himoyalangan. Earn/debit/refund audit xatosi butun economic transactionni rollback qiladi. Original operation replay bitta natijani qaytaradi.
- Active wallet ko‘pi10,000 lot; katta holatda qisman hisob chiqarilmaydi. Expiry va integer points validation saqlanadi. Money uchun Decimal precision50, points uchun bigint; JS floating-point bilan pul hisoblanmaydi.
- Tenant JSON eksporti model coverage/fingerprint guardidan o‘tadi; redemptionning sessionId maydoni eksport qilinmaydi. To‘liq PG backup native journalsni saqlaydi. Mahalliy restore rehearsal policy/grant/debit/partial restore/recovery metadata va pul/stock source hashlarini tekshiradi; real production/off-site backup yoki pilot qabulini bildirmaydi.

API: `GET/POST /api/loyalty/policy` (owner; publish critical MFA), `GET /api/customers/:id/points`, `GET/POST /api/sales/:id/points`, `POST /api/sales/:id/points/cancel`. Prepare strict body `{operationId,policyVersionId,points:integer-string,customerConsent:true,reason}`; cancel `{operationId,reason}`. Rate, body size, CSRF va authorization umumiy API admission orqali.
