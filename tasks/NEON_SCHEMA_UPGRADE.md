# Neon bazasining strukturasi yangilanishi

2026-10-17 kuni foydalanuvchi `.env_backup`dagi Neon bazasini loyihaning hozirgi strukturasi bilan moslashtirishni so‘radi. Faol ilovani ushbu bazaga ulash so‘ralmadi. Ulanish manzili va parol ushbu hujjatga yoki dalil fayliga kiritilmagan.

## Bajarilgan ish

- Boshlang‘ich bazada 25 ta jadval, ularda jami 0 ta yozuv va migratsiya tarixi yo‘qligi tekshirildi.
- AES-256-GCM bilan shifrlangan backup olindi va yangi, ajratilgan PostgreSQL 18 konteyneriga tiklandi. Mavjud lokal POS bazasiga tegilmadi.
- Tiklangan schema `20260907100516_init` bilan solishtirildi: farq yo‘q. Initial migratsiya baseline sifatida qayd etilib, qolgan 189 migratsiya avval lokal nusxada, keyin Neon’da `prisma migrate deploy` bilan bajarildi.
- Reset, `db push`, jadvalni qayta yaratish yoki mahalliy biznes ma’lumotlarini Neon’ga ko‘chirish bajarilmadi. Loyiha kodi, `.env`, `.env_backup` va faol Docker ulanishi o‘zgartirilmadi.

## Yakuniy tekshiruv

Mashina dalili: [neon-schema-upgrade-20261017.json](evidence/neon-schema-upgrade-20261017.json).

- **190/190** migratsiya muvaffaqiyatli qayd etilgan; tugallanmagan migratsiya yo‘q. Barcha SHA-256 checksumlar repozitoriydagi SQL fayllarga mos.
- **139 ta jadval**, **138 ta Prisma modelining barcha saqlanadigan ustunlari** o‘qish so‘rovi bilan tekshirildi. Bu sinov biznes yozuvlarini yaratmaydi.
- Ustunlar, constraintlar, indekslar, funksiyalar va triggerlardan tuzilgan **5 023 ta catalog obyekti** yangilangan lokal nusxa bilan aynan bir xil SHA-256 berdi.
- `auth_restore_ready() = true`; baza vaqt zonasi `GMT` — ilovaning UTC readiness mezoniga mos.
- Eski 25 ta jadvaldagi jami yozuvlar soni 0 holatida qoldi.

Native tenant/ledger guardlari va qo‘shimcha indekslar SQL migratsiyalarda saqlanadi; faqat `schema.prisma`ga qarab `db push` qilish ularning o‘rnini bosmaydi. Yakuniy moslik sinovdan o‘tgan migratsiyalar nusxasi bilan tekshirildi.

## Zaxira nusxa va chegara

Private lokal katalog: `.local/neon-upgrade/` (Git va Docker build contextidan chiqarilgan). `before.dump.aes` — yangilanishdan oldingi shifrlangan custom-format dump; `backup-key.json` — uni ochish uchun maxfiy kalit, IV va authentication tag. Ikkalasini himoyalangan joyda saqlash kerak; kalitni ulashmang. Private diagnostika va bajarish skriptlari ham shu katalogda. Backup shu ish davomida lokal nusxaga muvaffaqiyatli tiklandi; bu off-site backup xizmati emas.

Bu natija **baza strukturasi** tayyorligini bildiradi. Haqiqiy production deployment, ilovaning Neon bilan to‘liq biznes/E2E sinovi yoki pilot qabuli bajarilmadi. Faol ilova o‘zining avvalgi lokal bazasida ishlaydi. Original PLAN1 done sanog‘i o‘zgarmaydi: **185/259**; 190 — migratsiyalar soni.

Neon’ning pooled ulanishi uchun qo‘llangan yondashuv [rasmiy Prisma compatibility izohi](https://neon.com/blog/better-postgres-with-prisma-experience) bilan tekshirildi; URL parametrlari va loyiha Prisma 5.22 versiyasi saqlandi, yangi adapter qo‘shilmadi.
