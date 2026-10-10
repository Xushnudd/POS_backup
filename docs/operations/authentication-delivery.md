# Tasdiqlash va parol tiklash core contracti

2026-10-10 mahsulot egasi SMS/e-mail provayderi hali tanlanmaganini tasdiqladi.
Production registry bo‘sh: real yuborish mavjud emas, API503
AUTH_DELIVERY_UNAVAILABLE qaytaradi. Akkaunt avtomatik tasdiqlanmaydi.
Mock faqat test/development uchun; production resolver mockni rad etadi va
oldingi mock bilan olingan contact proofni haqiqiy tasdiq sifatida ko‘rsatmaydi.
`tests/helpers/auth-delivery.ts` kodni faqat test xotirasida tutadi, logga yozmaydi.

## Almashtiriladigan chegaralar

SmsProvider/EmailProvider ichki AuthenticationMessage contractini oladi:
purpose, destination, secret va expiresAt. Bu vendor endpoint, protokol yoki
request/response taxmini emas. Production binding faqat rasmiy hujjat va
tasdiqlangan provayder bilan keyinchalik qo‘shiladi. AuthenticatorProvider
TOTP/WebAuthn uchun kelajak chegarasi; o‘z TOTP algoritmi yoki fake factor yo‘q.

`AUTH_CHALLENGE_SECRET`: alohida32bayt random,64hex, private environment/secret
managerda. Hech qanday default qiymat yo‘q. OTP6raqam crypto.randomInt; hash
challenge UUID bilan HMAC-SHA256. Reset32bayt random opaque token, SHA256 hash.
HMAC keydan HKDF orqali alohida AES256-GCM delivery key olinadi, random12bayt
IV va16bayt tag; challenge UUID AAD. Secret bazada faqat shifrlangan queue va
hash sifatida. Yetkazilganda yoki terminal/expired holatda ciphertext o‘chadi.
Kod, destination, token, key yoki provider exception API/audit/logga chiqmaydi.

## Navbat va tekshirish

OTP5min, reset15min. Yetkazish worker jobs ichida: SKIP LOCKED,30sec lease,
10sec transport timeout, maksimum3urinish,60sec backoff, original ciphertext
va token. Network transaction tashqarisida; lease UUID fencing. Unknown delivery
qayta shu original kodni yuborishi mumkin, at-most-once SMS va’dasi yo‘q.
Bu moliyaviy posting emas; challenge esa faqat bir marta iste’mol qilinadi.
Yangi resend avvalgi shu purpose/session challengeni bekor qiladi.
Muddati tugagan navbatdagi ciphertext provayder yoki encryption key olib tashlangan
bo‘lsa ham worker tomonidan tozalanadi. Har aylanishdagi cleanup delivery batch
limitidan oshmaydi va band qatorlarni SKIP LOCKED bilan chetlab o‘tadi. Tarixiy
metadata qoladi; cleanup yuborilgan/tasdiqlangan holat yaratmaydi.
Public reset known/unknown akkaunt uchun bir xil accepted DTO qaytaradi,
transportni response yo‘lida kutmaydi; source va token qaytarilmaydi.
Akkauntga bog‘liq resend cheklovi ham accepted qaytaradi, yangi token yaratmaydi;
shu cheklovning status kodi orqali akkaunt mavjudligini aniqlash mumkin emas.
Identifier bo‘yicha umumiy request limiti esa mavjud va yo‘q akkauntga bir xil.

DeliveredAt bo‘lmasa verification rad. OTP5noto‘g‘ri urinishda lockout; urinish
hisobi xato javobidan oldin commit bo‘ladi. Expiry/replay/foreign session/current
destination o‘zgarishi rad. Verification, contact proof va audit bir transaction;
contact tasdig‘i telefon yoki e-mailning aynan current hashiga tegishli.
Parol reset contact verified deb belgilanmaydi. Reset old password hashiga ham
bog‘langan: parol allaqachon o‘zgargan bo‘lsa eski token ishlamaydi.
Successful reset: yangi bcrypt hash, barcha sessiyalar revoke, kassir PINlari
clear, qolgan pending challengelar bekor, active memberships audit — bir transaction.
Lokal offline iqtisodiy amallar avtomatik o‘chirilmaydi; original-key reconciliation
yo‘li saqlanadi. Token URL query/log/localStoragega yozilmaydi; UI tokenni yashirin
inputda qabul qiladi. Login → forgot-password/reset-password mavjud.

Resend1/min user/purpose, issue5/15min user, verify20/15min user;
reset request3/15min identifier, resend1/min user, complete5/15min token hash.
Trusted overwritten x-real-ip sozlanganida public IP10/15min; reverse proxy
traffic controls production deploymentda alohida qabul qilinadi.

## Step-up qabul chegarasi

Step-up verified contact + password session talab qiladi. Challenge action,
operation UUID, canonical payload hash va current sessionga bog‘lanadi.
`assertStepUp` runOperation authorize callbackida transaction bilan qo‘llanadi:
proof iste’moli va iqtisodiy amal/audit birga rollback/commit. Faqat aynan o‘sha
original action/key/hash/session replay qilishi mumkin. Muddati tugagan proof
yoki boshqa amal rad. Testda haqiqiy Operation/audit orqali late rollback va
original retry tekshirildi.

Bu hozircha tayyor primitive. Barcha xavfli business/platform endpointlar uchun
MFA policy va client challenge flow hali global ulanmagan; SEC-02.06 done emas.
Real OTP transport, audited TOTP binding va production MFA enforcement qabul
qilinmaguncha tizimni MFA bilan to‘liq himoyalangan deb ko‘rsatmang.

106–107 additive migratsiyalar: immutable source, attempt/one-use proof guard,
encrypted queue, VerifiedContact source va logical historical session identity.
Contact akkauntga tegishli; organization o‘chishi global contact proofni yo‘qotmaydi.
Consumption har safar current live sessionni tekshiradi. Applied migratsiyalarni
tahrirlamang. Key rotation pending OTP/ciphertextni yaroqsiz qiladi: yopiq queued
source va eski proof uchun yangi challenge so‘raladi; eski key bilan silent
fallback yo‘q. Rotate avval navbatni drain qilib, expiry/resend rejasini qo‘llang.
