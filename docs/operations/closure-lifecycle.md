# Tashkilotni yopish va bekor qilish core

ADR-062 asosida migration117–118, `src/server/retention/closure.ts`, lifecycle helper va `/billing` owner paneli ishlatiladi. Avtomatik o‘chirish yo‘q; review huquqiy qaror yoki purge ruxsati emas. Tashqi servis/provayder adapteri talab qilinmaydi.

## Owner oqimi

Avval `/jobs` orqali tenant biznes JSON eksportini tayyorlash va yuklab olish kerak. Reviewed doira va 16MiB/100000 qator chegarasi `tenant-export.md`da ko‘rsatilgan. Eksport idempotent mavjud workerda tayyorlanadi. Faol, butun artifact va shu ownerning auditli downloadi talab qilinadi. Keyin owner `/billing` yopish paneliga job ID, sabab va joriy parolini kiritadi, oqibatlarni ko‘rib tasdiqlaydi. Ochiq smena, draft savdo, unresolved provider intent yoki issued offline lease bo‘lsa avval hal qilish shart; yopish ularni yo‘qotmaydi.

Yopish onidan barcha reviewed biznes yozuvlari bloklanadi. Ko‘rish, eksport, billing, autentifikatsiya, sessiya revoke va support recovery o‘z vakolat tekshiruvlari bilan qoladi. Owner siyosatning so‘rovga olingan kunlari ichida joriy paroli bilan bekor qilishi mumkin. Bekor qilish obunani uzaytirmaydi: expired obuna read-only bo‘lib qoladi. Deadlinega aynan yetganda bekor qilish yopiladi, review_required ko‘rsatiladi. Ma’lumotlar o‘chirilmaydi; muddati tugagan so‘rovni administrator orqali avtomatik qayta ochish qo‘shilmagan.

## HTTP contract

GET /api/billing/closure: faqat actual owner/password sessiyasi, no-touch session; 30/min user limit. current snapshot, phase, joriy policyVersionId/cancellationDays va DB wall-clock qaytadi. Noma’lum yoki bekor qilingan sessiya rad etiladi.

POST: operationId(UUID), expectedPolicyVersionId, exportJobId(UUID), reason(3..2000), password. PATCH: operationId(UUID), closureId(UUID), reason, password. Strict schema qo‘shimcha propertylarni rad etadi. Request/cancel qayta autentifikatsiyasi user bo‘yicha jami 5/15min, xato va replay urinishlari ham hisoblanadi. SMS/e-mail yetkazish tanlanmaganligi uchun bu parol qayta tasdig‘i; ikki faktor/MFA deb sanalmaydi.

Password operation payload/hash/result/auditga kiritilmaydi va browser storagega yozilmaydi. User, session va membership row locks bilan live owner/current password yangi work hamda stored-result replay uchun qayta tekshiriladi. Original actor/hash/key turlicha bo‘lsa replay yo‘q. UI faqat public intent va original operation keyni localStoragega saqlaydi; acknowledgment yo‘qolganda reload/retry shu key bilan, parolni qayta kiritib ishlaydi. Double-submit disabled. Aniq RETENTION_POLICY_CHANGED rejection yangi policy reviewga qaytaradi; noaniq javobda intent saqlanadi.

## DB invariants

OrganizationClosure joriy policy version, kun, requestedAt, deadline, export ID/hash, owner/sabab va cancellation eventni saqlaydi. Faol so‘rov uchun tenant bo‘yicha partial unique index. Tarix va deadline immutable; faqat bir marta owner cancellation mumkin. Cancellation reason NULL bo‘lishi mumkin emas. DB clock tekshiruvi backdated cancellation bilan deadline bypass qilishni rad etadi. Policy o‘zgarishi eski so‘rov muddatini o‘zgartirmaydi. Kun 86400000ms; lokal timezone/DSTga bog‘liq emas.

Tenant FOR UPDATE close/cancelni biznes FOR SHARE guard bilan tartiblaydi. closureRevisionning nested closure trigger ichidagi bitta incrementi haqiqiy tuple fence: oldin snapshot olgan Serializable transaction closure yo‘qligi haqidagi eski natijani ishlata olmaydi, retry qilishi kerak. Bu ichki maydonning oddiy direct updatei taqiqlanadi va eksportdan chiqarilgan. Closure tarixining public biznes metadata maydonlari tenant exportga qo‘shilgan; schema fingerprint va barcha model read-only classificationlari review qilingan.

74 biznes jadvali va terminal Operation guard assert_business_writable orqali closure holatini tekshiradi. Exact request/cancel exceptions faqat closure history/auditni yozishga yo‘l beradi; boshqa Product/Payment/Stock yozuvini ochmaydi. Closing holatdagi biznes yozuvi HTTP409 ORGANIZATION_CLOSING. Late audit failureda closure, tenant revision va operation birga rollback. Parent organization delete app oqimi emas; isolated fixture cascade cleanup tarixni productionda o‘chirish funksiyasi deb sanalmaydi.

117 isolated bazaga applied bo‘lgach source/terminal intent va cancellation reason checks additive118da kuchaytirildi; applied117 qayta yozilmadi. Readiness118 talab qiladi. Real biznes bazasiga migratsiya/deploy qilinmagan.

## Hali ochiq qabul doirasi

BIZ-02.07 butun bandi in_progress: hajm chegarasidan katta eksport arxitekturasi, yakuniy huquqiy retention/legal-hold toifalari va irreversible deletion qarorlari qoladi. Oxirgisi blocked_external. Bu core tugashi bandni yoki production release’ni avtomatik done qilmaydi. Test dalillari EXECUTION_STATUS va evidence JSONda alohida qayd etiladi.
