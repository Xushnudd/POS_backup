# Tiklashdan keyin authentication karantini

SQL124–125 yangi o‘rnatilgan bazani bloklamaydi. `restore.sh` faqat aniq
nomi tasdiqlangan bo‘sh bazaga tiklaydi va uni authentication karantinida
qoldiradi. Target ilova/workerlarga hali ulanmagan, offline bo‘lishi shart.
Eski formatdagi backupda yangi checkpoint jadvali bo‘lmasa restore qabul
qilinmaydi: operator offline targetda zarur migratsiyalarni qo‘llaydi va
`auth-restore-quarantine.sql`ni muvaffaqiyatli bajaradi. Bu eski bazani ochishga
ruxsat yoki schema backfill o‘rnini bosmaydi.

## Karantin nimani qiladi

1. Pending `AuthRestoreCheckpoint`ni avval alohida commit qiladi. Keyingi sweep
   xatosi ushbu gate’ni rollback qilmaydi; target yopiq qoladi.
2. Barcha eski sessiyalarni revoke qiladi. Password/PIN yangi sessiyasi SQL
   trigger orqali ham rad qilinadi; app verify va live-context gate ham yopiq.
3. Barcha live TOTP faktorlarini revoke qiladi va shifrlangan seedni tozalaydi.
   Old proof/recovery kodlari revoked factor yoki session orqali yaroqsiz;
   counter va tarix qayta foydalanishga ochilmaydi.
4. Ishlatilmagan SMS/e-mail/step-up/reset challenge’larini failed qiladi,
   shifrlangan yuborish kodini va lease’ni tozalaydi. Consumed tarix saqlanadi.
5. Qabul qilinmagan invitation tokenlarini revoke qiladi.
6. Readiness503; eski login503, eski cookie valid session bermaydi. Savdo,
   payment, inventory, debt, user/membership va audit tarixi o‘chirilmaydi.

Karantin foydalanuvchi paroli, PIN, role yoki platform grant qayta tiklangan
snapshotda yangiroq production holatiga mosligini o‘zi aniqlay olmaydi.
Ilovani ochishdan oldin operator ishonchli, backupdan mustaqil incident/access
ma’lumotlari bilan ularni solishtiradi. Backupdan keyin parol/PIN almashtirilgan,
xodim bloklangan, profil/vakolat o‘zgargan yoki platform grant bekor qilingan
bo‘lsa, shu o‘zgarishlar offline targetda qayta qo‘llanadi. Kerakli farqlar
noma’lum bo‘lsa credentiallarni xavfsiz almashtirish/revocation qo‘llanadi;
karantin ochilmaydi. Barcha instance va workerlar shu targetga o‘tishidan oldin
provider/offline/shift iqtisodiy holatlar ham alohida reconciliation qilinadi.

## Qo‘lda qabul qilish

`review-restored-auth.sh` inherited `RESTORE_DATABASE_URL`dan foydalanadi;
secretni repo, terminal komandasi tarixi yoki dalil fayliga yozmang.
`RESTORE_CONFIRM_DATABASE` targetning aniq nomi bilan mos bo‘lishi kerak.
Quyidagilarni ishonchli operator muhitida belgilang:

- `AUTH_RESTORE_REVIEWER`: haqiqiy tekshirgan operator nomi, 3–200 belgi.
- `AUTH_RESTORE_REVIEW_EVIDENCE`: maxfiy bo‘lmagan reconciliation dalili yoki
  ticket reference, 10–2000 belgi; parol, PIN, token yoki key emas.
- `AUTH_RESTORE_CREDENTIALS_RECONCILED=yes`: password/PIN review haqiqatan tugagan.
- `AUTH_RESTORE_ACCESS_RECONCILED=yes`: users/profiles/roles/platform access review tugagan.

Keyin `scripts/ops/review-restored-auth.sh`ni ishga tushiring. Script business
siyosatini o‘zi taxmin qilmaydi, credentiallarni o‘zi almashtirmaydi, vendor API
chaqirmaydi. SQL live session/factor/pending challenge/invitation qolgan bo‘lsa
reviewni rad qiladi. Aynan bitta pending checkpoint talab qilinadi; reviewer va
evidence NULL yoki bo‘sh bo‘la olmaydi. Review tarixini API orqali yozish,
o‘zgartirish yoki o‘chirish yo‘li mavjud emas. DB superuser vakolati baribir
operator ishonch chegarasi: u triggerni chetlab o‘tishi mumkin, shuning uchun
ilova DB roliga schema/DDL/superuser vakolati berilmaydi.

Qabul eski tokenlarni qayta yoqmaydi. Yangi login va yangi authenticator
ulanishi/recovery kodlarini saqlash talab etiladi. AuthRestoreCheckpoint tenant
eksportiga kirmaydi. Bu core test haqiqiy production restore, SLA yoki off-site
backup ishlayotganini tasdiqlamaydi.
