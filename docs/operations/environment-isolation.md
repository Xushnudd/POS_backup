# Muhitlar izolatsiyasi: konfiguratsiya va amaliy mashq

Haqiqiy staging/production serverlari tasdiqlanmagan. Quyidagi sinov yangi lokal, sintetik muhitlarga tegishli; haqiqiy production izolyatsiyasi qabul qilindi degani emas. OPS-01.01 tashqi operator qabuli tugaguncha `blocked_external` qoladi.

Har muhit uchun `ops/environments/` dagi alohida namuna ishlatiladi. Development `.env` yoki uning backupini staging/productionga ko‘chirmang. Baza, parol, asosiy va avvalgi TOTP kalitlari, Compose project, tarmoq, PostgreSQL volume, maintenance katalogi va recovery vakolatlari alohida bo‘lsin. Provayder tanlanganda uning kalitlari ham muhit bo‘yicha alohida yaratiladi; hozir real provayder bindinglari yo‘q.

Operator egasi bo‘lgan, symlink bo‘lmagan 0600 fayllarni tarmoqqa ulanmasdan tekshirish:

```bash
node scripts/ops/check-environment-isolation.mjs "$dev_env" "$staging_env" "$production_env"
node scripts/ops/check-compose-isolation.mjs "$dev_env" "$staging_env" "$production_env"
```

Ikkinchi buyruq haqiqiy Compose konfiguratsiyasini xotirada render qiladi, secretli JSONni chiqarmaydi. Shell’dagi boshqa credentiallar env faylini yashirin almashtirmaydi. Umumiy/external network/volume, boshqa host volume driveri, host network, undeclared network, DB port publish, noto‘g‘ri runtime DB URL/key, hamda bir-biriga ichma-ich yoki symlink orqali bir xil maintenance kataloglari rad etiladi. Faqat oldindan ko‘rilgan, read-only `/run/pos-state` bindiga ruxsat bor; yangi mount qo‘shilsa qoidani ko‘rib chiqing. `ready_for_operator_review` real host, DNS, secret-store ACL yoki firewall sinovi o‘rnini bosmaydi.

Yangi PostgreSQL volumelari host va local ulanishlarda SCRAM bilan yaratiladi. Bu env sozlamasi mavjud bazaning `pg_hba.conf`ini o‘zgartirmaydi. Eski bazaga buni tatbiq etish operatorning backup va access tekshiruvi bilan alohida o‘tishi kerak. `POSTGRES_USER` bootstrap roli o‘z klasterida superuser; ushbu sinov uni minimal vakolatli runtime roli deb ko‘rsatmaydi. Docker daemon vakolati ham izolyatsiya chegarasidan yuqori: unga kirishni cheklang.

Takrorlanadigan, real PostgreSQL bilan lokal sinov:

```bash
node scripts/ops/test-environment-isolation.mjs
```

Avval mavjud `postgres:15-alpine` image’i talab qilinadi; avtomatik pull yo‘q. Script `.env`ni o‘qimaydi. Base/release/maintenance konfiguratsiyalarini sintetik private kalitlar bilan render qiladi, uchta yangi private internal network, volume va DB yaratadi. Har muhit o‘z bazasiga yozadi. Boshqa muhit paroli targetning to‘g‘ri username’i bilan ham rad qilinadi; hatto target credentiali bilan boshqa tarmoqdan yozish ham rad. DB portlari publish qilinmaydi. Yakunda faqat shu script yaratgan resurslar va kalitlar tozalanadi.

Dalil: `tasks/evidence/environment-isolation-20261016.json`: 3 ta ruxsatli yozish, 6 ta credential rad javobi, 6 ta tarmoq rad javobi, kutilmagan yozish 0. Haqiqiy muhitlar tayyor bo‘lganda uchta private operator env fayli, actual mounted path/network/volume, host ACL va test credentialining productionga ulana olmasligi qayta tekshiriladi. Stagingga haqiqiy shaxsiy ma’lumotni niqobsiz ko‘chirish ruxsati berilmagan.
