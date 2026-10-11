# Saqlanmagan katalog o‘zgarishlari

Kategoriya, birlik, brend, mijoz va yetkazib beruvchi tahrirlari uchun `useUnsavedChanges` qo‘llanadi. Har bir sahifada bitta guard bo‘lsin. Draft organization/user/role bo‘yicha komponent kaliti bilan ajratiladi. Guard faqat dirty/saving belgilarini saqlaydi; forma mazmuni yoki maxfiy ma’lumotni localStoragega ko‘chirmaydi.

- Tahrirni almashtirish, bekor qilish va modalni Escape/X orqali yopish oldidan `confirmDiscard` chaqiriladi. Rad etilsa inputlar saqlanadi.
- Oddiy, shu oynada ochiladigan linklar capture bosqichida tekshiriladi. Hash-only o‘tish, boshqa tab, download va modifier bilan ochish amallari hozirgi formani tark etmaydi.
- Reload yoki oynani yopishda brauzerning `beforeunload` tasdig‘i ishlatiladi. Brauzer bunday dialogni cheklashi mumkin; u avtomatik draft backup hisoblanmaydi.
- Logout va biznes almashtirish `confirmPageNavigation` bilan **server sessiyasi o‘zgartirilishidan oldin** tekshiriladi. Biznes almashtirish serverda yakunlangach `commitPageNavigation` reload oldidagi ikkinchi tasdiqni olib tashlaydi. Bekor qilingan almashtirish sessiyani va draftni o‘zgartirmaydi.
- Guard API so‘rovi ketayotganida discardga ruxsat bermaydi. Muvaffaqiyatli saqlash baseline/draftni yangilaydi; rad etilgan saqlash draftni saqlaydi.
- Brendning boshqa qatorini arxivlash joriy tahrirni tozalamasligi kerak.
- Mijoz kredit limiti decimal **satr** sifatida yuboriladi; `parseFloat` orqali qayta yaxlitlanmaydi.

## Hozirgi chegaralar

Bu besh forma UX-01.05 ning qisman amalga oshirilishidir. Boshqa muharrirlar, History API orqali SPA back/forward va guard chaqirmaydigan programmatic router o‘tishlari hali to‘liq qabul qilinmagan. `confirmDiscard` yoki navigation requestni yangi shunday o‘tish yo‘liga ulash kerak. Bu ishlarni tekshirmasdan butun UX-01.05 ni `done` qilmang.

## Sinov

`tests/e2e/catalog-unsaved.spec.ts` faqat localhost:55439/pos_test bilan ishlaydi. Chromium, Firefox va WebKitda real lokal HTTPS sessiyasi orqali discardni rad etish/tasdiqlash, 409 javobidan keyin draft, haqiqiy saqlash, boshqa brendni arxivlash, modal Escape/X, aniq kredit limiti va serverga tegmasdan logout/biznes almashtirishni bekor qilishni tekshiradi. Tashqi provider va production resurslari ishlatilmaydi. Natijani dalil faylidagi haqiqiy yakuniy run bilan tekshiring.
