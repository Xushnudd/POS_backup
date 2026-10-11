# TOTP core va qabul chegarasi

2026-10-10. SEC-02.06 hali `in_progress`. HTTP va `/security` UI ulash/recovery/rotation oqimlariga ulangan, lekin global
MFA enforcement hali yo‘q. `AUTH_TOTP_ENABLED=true` va private64hex kalit bo‘lsagina
availability true; standart holat o‘chiq. Mavjud login va biznes amallari shu
bosqichda majburiy MFAga o‘tkazilmaydi.

T07 zarur: baseline Next/Prisma/bcrypt TOTP protokolini bermaydi, reja o‘z TOTP
algoritmini yozishni taqiqlaydi. OTPAuth **9.5.2**, MIT, exact dependency ishlatiladi.
Manba: [maintainer repository](https://github.com/hectorm/otpauth),
[RFC6238](https://www.rfc-editor.org/rfc/rfc6238),
[RFC4226](https://www.rfc-editor.org/rfc/rfc4226).
Maintained kutubxona tanlangani mustaqil security auditdan o‘tganlik da’vosi emas.

## Hozir ishlaydigan ichki contract

- SHA1, olti raqam, 30 soniya, 20 random bayt seed; ±1 step chegarasi.
- `matchTotpCounter` caller bergan server vaqti va oxirgi counter bilan ishlaydi.
  Counter bir xil yoki kichik bo‘lsa kod qayta qabul qilinmaydi. Kod URL/logda yo‘q.
- Secret AES-256-GCM bilan shifrlanadi. `AUTH_CHALLENGE_SECRET`dan alohida HKDF
  purpose key; user/factor ID AADga bog‘langan. Default kalit yo‘q. Kalit yo‘q503;
  buzilgan yoki boshqa actor ciphertext409. Kalitni almashtirish eski ciphertextni
  ochmaydi; bu hali key rotation workflow emas.
- `beginTotpEnrollment`: live password session va fresh current password;
  user keyin session row lock. Rate5/15min. Pending enrollment10min, yangi
  enrollment oldingi pendingni revoke qiladi. Enabled factor ustiga yozilmaydi.
  Provisioning URI faqat reauthenticated callerga shu javobda beriladi. URI va
  parol audit, Operation, log, localStorage yoki tenant eksportga yozilmaydi.
- `confirmTotpEnrollment`: faqat original user+session, joriy password digest,
  muddati va5urinish. Wrong attempts HTTP errordan oldin commit bo‘ladi;
  beshinchi xato sealed secretni tozalab factorni revoke qiladi. Audit fault
  confirmation va counter yozuvini rollback qiladi.
- `createTotpProof`: active confirmed factor + live password session + current
  password digest. Umumiy verify20/15min budget. User lock parallel koddan
  bittagina proof yaratilishini ta’minlaydi. Factor counter/proof/audit atomik.
- Proof5min; action, operationKey, payloadHash, user, session va factor bilan
  bog‘langan. `assertTotpStepUp` ayni amalning replayiga ruxsat beradi, boshqa
  bindingni rad qiladi. Revoked factor yoki password o‘zgarishi proofni yopadi.
- SQL119 source/terminal/counter guards; SQL120 proof approval vaqtida active
  user/factor/password sessionni va DB wall clockni qayta tekshiradi.
- SQL121 recovery code immutable source/expiry/one-use guards. Confirmation
  o‘nta random128bit recovery kodni bir marta qaytaradi; bazada purpose/factor-bound
  SHA256 hash va365kun expiry saqlanadi. URI kabi bu kodlar ham log/storage/auditga
  yozilmaydi. Confirmation javobi yo‘qolsa kodlarni bazadan qaytarib olish yo‘q.
- `rotateTotpRecoveryCodes`: fresh password va hali ishlatilmagan TOTP counter;
  eski amaldagi kodlarni bekor qilish, yangi o‘nta kod, counter va audit atomik.
  Audit failure barcha o‘zgarishni rollback qiladi. Lost ACK uchun keyingi fresh
  TOTP bilan yana rotation qilish mumkin; eski plaintext retrieval yo‘q.
- `recoverTotpFactor`: live password session, fresh password va bir martalik
  recovery kod;5/15min. Faktor revoke/sealedSecret clear, kod consume va barcha
  foydalanuvchi sessiyalarini revoke atomik. Har faol tashkilotda safe audit;
  audit fault kod/faktor/sessionlarni rollback qiladi. Parol o‘zgargan bo‘lsa ham
  joriy parol+recovery code faktor replacementga yo‘l ochadi. Yangi login va
  yangi enrollment kerak; eski proof va kodlar revoked factor orqali ishlamaydi.
- `totpStatus` own-account metadata beradi: enabled/factorId/pending expiry,
  recovery count/password rebind flag. Secret/hash/URI/kod bermaydi, session row
  lock yoki activity touch yo‘q.
- TotpFactor, TotpProof va TotpRecoveryCode tenant business exportdan omit.
  Authentication recovery read-only organizationda ham ochiq bo‘lishi uchun
  read-only model classificationda exempt. Bu business-write vakolati emas.

## SEC-02.06 done uchun hali talab qilinadigan ishlar

Encrypted key rotation; owner/platform operatorning muhim
amallariga reviewed global policy va UI step-up; normal login/session lifecycle
bilan global recovery policy; full integration va critical-operation step-up
uch browser qabul.
SMS/e-mail vendor integratsiyasi alohida blocked_external bo‘lib qoladi.

121 migratsiya faqat isolated pos_test va fresh/legacy fixturesda tekshiriladi.
Productionga migratsiya yoki MFA rollout bu bosqich bilan bajarilmaydi. Apply
qilingan SQL119–121ni tahrirlash o‘rniga yangi additive migratsiya ishlating.
Fallback bo‘lsa ichki TOTP servislarini ulashni to‘xtating; faktor va audit tarixini
o‘chirib rollback qilish yoki encrypted secretni plaintextga aylantirish yo‘q.

## HTTP va UI qabul contracti

`GET /api/auth/totp` own-account no-touch status. O‘chiq bo‘lsa available:false; faol faktor yo‘q bo‘lsa metadata berilmaydi.
Mavjud enabled faktor own-account metadata/recoveryAvailable bilan qaytadi. `POST /enroll` password; `/confirm` factorId/code;
`/proof` code/action/operationKey/payloadHash; `/rotate` password/code; `/recover`
password/factorId/recoveryCode. Barcha yo‘llar shu `/api/auth/totp` prefiksida.
Live role/session, JSON bounds, CSRF, shared request budget va private/no-store
wrapper ishlaydi. O‘chiq enroll/confirm/proof/rotate POST503. Existing-factor recovery kalit
yoki feature flagga bog‘lanmaydi; fresh password+hash-bound one-use backup kerak. Yangi6action explicit permission matrixga kirdi.

Normal response sanitization passwordDigest/provisioningUri/recoveryCodesni ham
filtrlaydi. Faqat reviewed exact POST-success DTO: enroll URI, confirm/rotate
ten unique128bit recovery kodni bir martalik ko‘rsatishga ruxsat oladi. Boshqa
path/method/error/status yoki malformed credential normal filtrdan o‘tmaydi.
Bu generic row/credential javobiga blanket bypass bermaydi.

`/security` kalit/kod/parolni faqat React memoryda tutadi, local/sessionStorage
yoki IndexedDBga yozmaydi. Requestlardan keyin parol/kiritilgan kod tozalanadi,
confirm yoki enabled statusda enrollment seed clear. Reload secretni qaytarib
olmaydi. Lost confirmation ACK actual status orqali tiklanadi; zaxira kodlar
olingan bo‘lmasa yangi TOTP bilan rotate qilish kerak. Explicit save-ack backup
ro‘yxatni DOM/xotiradan tozalaydi. Recovery local pending offline operations
bo‘lsa UI logoutni oldin to‘xtatadi; server security recovery tarixni o‘chirmaydi.

Umumiy `assertStepUp` helper opt-in TOTP proofni ham qabul qiladi.
`runOperation` authorize callback bilan audit-fault rollbackda business row,
proof approval va Operation birga rollback; original key bilan retry/replay
bittagina natija beradi. Bu barcha critical business/platform yo‘llarida
authorize callback global majburiy bo‘lgan degani emas; SEC-02.06 hali ochiq.

Recovery outage exception: private encryption key/feature flag yo‘q bo‘lsa ham
avval ulangan faktor GET metadata/recoveryAvailable beradi. Recover seedni
unseal qilmaydi; existing own-account hash+current password bilan factor va
sessiyalarni bekor qiladi. Bu yangi faktor yaratish yoki proof chiqarishni
ochiq qoldirmaydi. Key va flag olib tashlangan actual HTTP test, unavailable
metadata fault-injected browser UI va actual recovery bilan tekshiriladi.

DB restore/PITR qabul chegarasi: eski snapshot factor/counter/one-use tarixini
qaytarishi mumkin. Traffic ochilishidan oldin restored session/factor/proof va
backup credentials invalidation protokoli tekshirilishi kerak; eski backup
kodni qayta ishlaydigan qilib ochish yo‘q. Bu avtomatlashtirilgan post-restore
auth acceptance ushbu bosqichda da’vo qilinmaydi, OPS-03.06 doirasida ochiq.

## Kalit almashtirish uchun vaqtinchalik moslik

`AUTH_CHALLENGE_SECRET` amaldagi yozish kaliti bo‘lib qoladi. Secret manager orqali `AUTH_TOTP_PREVIOUS_SECRETS` ga ko‘pi bilan ikki eski 64-hex kalitni vergul bilan ajratib berish mumkin. Eski kalitlar faqat mavjud AES-GCM envelope o‘qilishi uchun ishlatiladi; user/factor identity binding har bir urinishda tekshiriladi. Amaldagi kalit bo‘lmasa eski kalit bilan ishlash ham rad etiladi. Noto‘g‘ri overlap konfiguratsiyasi o‘qishda 503 qaytaradi. Kalitlarni HTTP request, log, Git yoki tenant eksportiga qo‘shmang.

Bu faqat rotation primitive: barcha faktorlarni transaction ichida qayta shifrlaydigan operator vositasi va nazorat qilingan rollout hali tayyor emas. Eski kalitni barcha faol va kutilayotgan faktorlar qayta shifrlanmaguncha olib tashlamang. Backupda qolgan ciphertext uchun recovery tartibi alohida zarur. AUTH_CHALLENGE_SECRET boshqa challenge funksiyalarida ham ishlatiladi; TOTP overlap ularning tokenlarini saqlab qoladi degan kafolat yo‘q. Production kalitlari ushbu ishda o‘zgartirilmadi.

Overlap konfiguratsiyasi noto‘g‘ri bo‘lsa, status `available:false`, yangi enrollment/proof 503; seal/unseal ham 503 qaytaradi. Kalit konfiguratsiyasi bitta contract orqali tekshiriladi. Mavjud recovery code orqali tiklash ushbu konfiguratsiyaga bog‘liq emas.

## Muhim operatsiyalar uchun markaziy MFA siyosati

`AUTH_CRITICAL_MFA_REQUIRED` deployment sozlamasi: yo‘q yoki `false` — mavjud oqim; `true` — quyidagi operatsiyalarga MFA talab qilinadi. Boshqa qiymat kritik amalda 503 qaytaradi. Talab TOTP mavjudligidan mustaqil: kalit/featureflag o‘chishi ikkinchi faktor talabini olib tashlamaydi. Standart konfiguratsiya mavjud tashkilotlarni birdan bloklamaslik uchun false. Production rolloutdan oldin tegishli owner/operator faktorlarini ulash, recovery kodlarni xavfsiz saqlash va stagingda tasdiqlangan oqimni tekshirish zarur.

Hozir nazorat qilinadigan operation turlari: `retention.closure.request`, `retention.closure.cancel`, `retention.policy.publish`, `billing.plan.publish`, `billing.plan.assign`, `billing.payment.confirm`, `billing.subscription.cancel`, `offline-cash.policy`, `billing.cost.record`, `billing.cost.cancel`, `support.policy.publish`, `support.grant`. Bu ro‘yxat qolgan barcha mutatsiyalar MFA bilan yopilgan degani emas; ownership/rol o‘zgarishi kabi runOperationdan tashqaridagi yo‘llar alohida ko‘rib chiqilishi kerak. Oddiy savdo har qatorida TOTP so‘ralmaydi.

Server live context va qo‘shimcha platforma vakolatini tekshirganidan so‘ng, work yoki old result replaydan oldin action/key/hash-bound step-upni tekshiradi. STEP_UP_REQUIRED javobining details maydoni faqat action, operationKey va kanonik payloadHashni beradi; credential yoki biznes request body berilmaydi. Proof approval va biznes yozuvi bitta transactionda; keyingi xato ikkisini ham rollback qiladi. MFA platforma rolini bermaydi; ruxsat bekor qilinsa replay rad etiladi.

Dashboard modal kodni faqat React memoryda ushlab turadi; /auth/totp/proof muvaffaqiyatli bo‘lsa asl serialized request body/key aynan saqlanib bir marta qayta yuboriladi. Auth requestlar qayta challenge qilinmaydi, stream body qayta yuborilmaydi. Cancel, besh daqiqalik timeout, dashboard unmount yoki user/organization almashishi pending requestni bekor qiladi. Parallel ikkinchi dialog rad etiladi. Har bir urinishdan keyin input kodi tozalanadi. Proof/business request server tomonidan sessiya va scope bo‘yicha qayta tekshiriladi.

Bu o‘zgarish rolloutni avtomatik yoqmaydi. Butun critical-action inventory, operator re-encryption va restoredan keyingi credential invalidation yakuniy qabulda ochiq; SEC-02.06 to‘liq done deb belgilanmagan.
