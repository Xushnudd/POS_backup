# TOTP core va qabul chegarasi

2026-10-11. SEC-02.06 core qabuli `done`. HTTP va `/security` UI ulash/recovery/rotation oqimlariga ulangan. Quyidagi 21 action uchun markaziy MFA siyosati bor; joriy xavfli amallar inventorysi va restore quarantine qabuli tekshirildi. `AUTH_TOTP_ENABLED=true` va private64hex kalit bo‘lsagina
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
  buzilgan yoki boshqa actor ciphertext409. Kalitni overlap konfiguratsiyasiz almashtirish eski ciphertextni
  ochmaydi. SQL123 va operator CLI workflow quyida alohida ko‘rsatilgan.
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

## Core qabul va tashqi rollout chegarasi

Restore quarantine va joriy mutation inventory izolatsiyalangan qabuldan o‘tdi.
Haqiqiy hosting rollout va operator credential/access review alohida. Operator
rekey va 21 action MFA core allaqachon amalga oshirilgan; production rollout
va tiklangan bazani ochish hali alohida tekshiruv talab qiladi.
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
authorize callback global majburiy bo‘lgan degani emas; bu tarixiy checkpointda SEC-02.06 hali ochiq edi.

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

Hozir nazorat qilinadigan operation turlari: `retention.closure.request`, `retention.closure.cancel`, `retention.policy.publish`, `billing.plan.publish`, `billing.plan.assign`, `billing.payment.confirm`, `billing.subscription.cancel`, `offline-cash.policy`, `billing.cost.record`, `billing.cost.cancel`, `support.policy.publish`, `support.grant`, `users.role.create`, `users.role.update`, `users.member.create`, `users.member.update`, `users.invitation.create`, `users.ownership.request`, `users.ownership.accept`, `users.ownership.cancel`, `auth.password.change` (owner/admin). Jami 21 action. Bu ro‘yxat barcha mutatsiyalar MFA bilan yopilgan degani emas; restore va boshqa xavfli yo‘llarning inventarizatsiyasi hali ochiq. Oddiy savdo har qatorida TOTP so‘ralmaydi.

Server live context va qo‘shimcha platforma vakolatini tekshirganidan so‘ng, work yoki old result replaydan oldin action/key/hash-bound step-upni tekshiradi. STEP_UP_REQUIRED javobining details maydoni faqat action, operationKey va kanonik payloadHashni beradi; credential yoki biznes request body berilmaydi. Proof approval va biznes yozuvi bitta transactionda; keyingi xato ikkisini ham rollback qiladi. MFA platforma rolini bermaydi; ruxsat bekor qilinsa replay rad etiladi.

Dashboard modal kodni faqat React memoryda ushlab turadi; /auth/totp/proof muvaffaqiyatli bo‘lsa asl serialized request body/key aynan saqlanib bir marta qayta yuboriladi. Auth requestlar qayta challenge qilinmaydi, stream body qayta yuborilmaydi. Cancel, besh daqiqalik timeout, dashboard unmount yoki user/organization almashishi pending requestni bekor qiladi. Parallel ikkinchi dialog rad etiladi. Har bir urinishdan keyin input kodi tozalanadi. Proof/business request server tomonidan sessiya va scope bo‘yicha qayta tekshiriladi.

Bu o‘zgarish rolloutni avtomatik yoqmaydi. Bu tarixiy checkpointda critical-action inventory va restore qabuli ochiq edi; operator re-encryption SQL123/CLI bilan tekshirildi; shu checkpointda SEC-02.06 done belgilanmagan edi.


## Operator key rotation core (2026-10-11)
SQL123 sealedSecret-only audited rotation, current/previous key tekshiruvi, authenticator/counter/recovery saqlanishi, default counts-only check va valid maintenance bilan apply: [operator yo‘riqnomasi](totp-key-rotation.md). 38 focused PostgreSQL/API/CLI regression va uch browser TOTP/critical oqimlari tekshirildi. Real kalit almashtirish yoki deployment amalga oshirilmagan.

## Xodim va egalik grantlari (2026-10-11)

MFA siyosati yoqilganda xodim yaratish/o‘zgartirish, taklif yaratish va egalik
so‘rovini boshlash/qabul qilish/bekor qilish UUID `operationId` talab qiladi.
Proof aynan action, sessiya, operationId va payloadga bog‘lanadi. Huquq,
active membership va tashkilot chegarasi proofdan mustaqil tekshiriladi.

Yangi xodim paroli payload tasdig‘iga private HMAC orqali kiradi: mavjud
`AUTH_CHALLENGE_SECRET`, aks holda kamida 32 bayt `JWT_SECRET`. Productionda
ikkalasi ham yaroqsiz bo‘lsa 503; development random process key productionda
ishlatilmaydi. Klasterda kalitlar bir xil bo‘lishi kerak. Kalit aylantirilganda
eski pending payload tasdig‘i yaroqsiz bo‘ladi; yangi operation va fresh MFA
kerak. Parol/hash operation result va auditga yozilmaydi.

Taklif tokeni faqat commit qilgan chaqiruvda bir marta qaytadi. Bir xil
operationId replay yoki parallel yutqazgan so‘rov metadata va
`invitationTokenUnavailable: true`, bo‘sh `invitationToken` oladi. Tokenni
Operationdan qaytarib olish yo‘q: metadata ID orqali eski taklif bekor qilinib
yangisi chiqariladi. Avtomatik yangi UUID bilan takrorlab qo‘shish yo‘q.

Egalikni qabul qilish yangi sessiya tokeni chiqaradi; ushbu amalning javobi
Operationga saqlanmaydi. Har ikki tomon mustaqil proof beradi; audit xatosi
role/session/proof approval yozuvlarini atomik rollback qiladi. Xodim o‘zgarishi
replayida yangi kirgan target sessiyalari yana bekor qilinmaydi.

MFA dialogi ustuvor qatlamda ochiladi. Quyi forma inert, faqat yuqori dialog
Escape va fokusga javob beradi; quyi forma ochiq qolsa body scroll lock saqlanadi.


## Restore yakuniy qabul oqimi

SQL124–125, `AuthRestoreCheckpoint`, session SQL guard va app gate qo‘shildi.
Shifrlangan restore avval karantin gate commit, keyin session/factor/challenge/
invitation sweep bajaradi. Operator credential/access reconciliation attestatsiyasi
va immutable review bo‘lmaguncha eski/yangi login va readiness yopiq.
[Restore contract](auth-restore-quarantine.md) va
[xavfli amallar inventari](critical-action-inventory.md) qabul chegaralarini beradi.
Owner/admin password change ham action-bound private HMAC MFAga ulandi;
parol o‘zgarishi, PIN/session revoke va approval/audit atomik.

Yakuniy core qabul: `tasks/evidence/critical-mfa-restore-20261011.json`, SQL125, 21 action. Real production rollout ushbu dalilga kirmaydi.

## Action nomlari va SQL133

Mavjud `offline-cash.policy` original amal nomini saqlaydi. Brauzer bindingi, server proof schema va native CHECK lowercase harf bilan boshlangan3–81belgili `[a-z0-9_.-]` nomni qabul qiladi; newline, yo‘l, query va script belgilarini qabul qilmaydi. Biror nomni yuborish o‘zi shu amalga vakolat bermaydi. Action, original kalit, payload hash, sessiya va factor identity tekshiruvlari majburiy.

SQL133ni yangi appdan oldin migrate deploy bilan qo‘llang. Yangi cheklov avval existing proof yozuvlariga validate bo‘ladi, eski check bir transactionda olib tashlanadi. Proof tarixini rename/delete/backfill qilmang. Oldingi app hali defisli proof yaratmaydi, qolgan eski nomlar expanded constraintga mos. SQL133ning fresh install va synthetic dump/restore sinovi real staging/production qabulini almashtirmaydi.
