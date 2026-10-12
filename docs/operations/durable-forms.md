# Ichki forma natijasini xavfsiz qayta tekshirish

`DurableMutation` serverga yozishdan oldin ko‘rib chiqilgan request body va original operationId ni IndexedDBga saqlaydi. Yozuv organization/user/device bilan chegaralangan. Server tasdig‘i kelmaguncha yangi kalit bilan qayta operatsiya yaratilmaydi. Network timeout serverda amal bajarilmaganini anglatmaydi.

`PendingActions` forma ko‘rinmay turganda ham aynan shu yozuvni tekshiradi. Lokal transaction tugagandan keyingi `pos:local-operations-changed` xabarnomasida faqat o‘zgarish fakti uzatiladi; payload yoki credential uzatilmaydi. Formada va umumiy panelda ko‘rsatilgan pending holat bir xil lokal manbadan qayta o‘qiladi. Boshqa oynadan qaytganda focus ham tekshiruvni yangilaydi. Bu xabarnoma server tasdig‘i o‘rnini bosmaydi.

Eski yozuvlarda HTTP usuli saqlanmagan bo‘lsa POST ishlatiladi. PUT recovery faqat aniq UUIDli `/taxes/{id}` profilini arxivlash/tiklash va `/brands/{id}` brend metama’lumoti/holati uchun ruxsat etilgan. DELETE recovery faqat aniq UUIDli `/files/{id}` rasm o‘chirish amali uchun ruxsat etilgan. PATCH, boshqa DELETE, ixtiyoriy PUT va noto‘g‘ri manzillar rad etiladi. Serverdagi tirik sessiya, tashkilot, actor, permission, original payload hash va idempotency tekshiruvlari har doim saqlanadi.

Metadata o‘qilishi muvaffaqiyatsiz bo‘lganda mavjud draft va oxirgi yuklangan ma’lumot saqlanadi. Tegishli editor yangi amalni metadata tiklanguncha bloklaydi; oldingi original natijani tekshirishga bu cheklov to‘sqinlik qilmaydi. ACK boshqa mustaqil forma draftini o‘chirmaydi. Bir nechta incident yoki support ruxsatida umumiy sabab ishlatilsa, faqat original saqlangan sababga hali mos keladigan maydon tozalanadi.

Incident scan va resolve balansni avtomatik tuzatmaydi. Server farq qolganini aniqlasa yopish rad etiladi. Sync review ham moliyaviy amalni manager nomidan takrorlamaydi: original terminal natija dalili tekshiriladi va keyin lokal konfliktga bog‘lanadi.

Birlik nisbati, soliq stavkasi, narx va qoldiq miqdorlarining formati Decimal hisoblashdan oldin tekshiriladi. Noto‘g‘ri matn validation xatosi bo‘lib qaytadi. Miqdorlar va chegaralar yaxlitlash yoki Number orqali o‘zgartirilmaydi.

Lokal navbat cloud backup emas. Bu hujjat barcha editorlar UX qabulidan o‘tganini yoki real production integratsiyalar ishlayotganini tasdiqlamaydi; original UX-01.05 holati EXECUTION_STATUS.md da alohida yuritiladi.

Almashtirish previewsi iqtisodiy posting emas. Miqdor/sabab/product snapshoti preview davomida muzlatiladi; yaroqsiz qaytarish qatori jim tashlab ketilmaydi. Posting vaqtida `onSavingChange` tashqi inputlarni ham bloklaydi. Unknown ACKdan keyin yaratilgan mustaqil draft original replay tasdig‘i bilan tozalanmaydi. Yangi almashtirish serverdagi qolgan qaytarish imkoniyatlari va narx/stock qoidalari bilan yana tekshiriladi.

PendingActions ACK callback server natijasi, operationId chiqarilgan original body va original pathni olishi mumkin. Callback faqat joriy draft original payloadga mos bo‘lsa uni tozalaydi. Originalni tiklash paytida boshqa fayl/tavsif/komanda draftini o‘chirmang. Panel va inline editor bir IndexedDB commit hodisasi orqali pending holatni qayta o‘qiydi; event authorization yoki server ACK o‘rnini bosmaydi.

Brendning mavjud oddiy saqlash/holat tugmasi `direct` rejimidan foydalanadi: original operatsiya kaliti va payload avval IndexedDBga yoziladi, keyin serverga yuboriladi. Double click flight bilan cheklanadi; noma’lum natija yangi kalit bilan takrorlanmaydi. Moliyaviy formalarning mavjud oldindan ko‘rish/tasdiqlash bosqichi saqlanadi. Shared `/jobs` endpointida type, `/onboarding` endpointida step, brend PUTda esa nom/holat komandasi recovery tanlash uchun ajratiladi. Mutable sabab/nom/filter qiymati operatsiyani tanlash kaliti emas; server actor/tenant/payload hash tekshiruvini davom ettiradi.

Billing recovery ham shu chegaradan foydalanadi. `/billing/payments` invoice ID, `/billing/plans` tarif code, `/billing/assign` va `/billing/costs` target organization ID bo‘yicha ajratiladi. Bekor qilish endpointi original hujjat IDga bog‘langan. `PendingActions exact` faqat ko‘rsatilgan endpointni oladi; prefix paneli yashirin yoki yopilgan hujjatning original amalini ham tiklaydi. Invoice yopilganidan keyin `allowNew=false` yangi amalni yashiradi, lekin original ACKni tekshirishni olib tashlamaydi.

Retention drafti o‘zi ochilgan `expectedVersionId`ni saqlaydi. Keyingi GET draftni yangi versiyaga jim ko‘chirmaydi; operator joriy siyosatni draftga olishni alohida tasdiqlaydi. Har bir invoice va xarajat bekor qilish sababi o‘z hujjatiga tegishli; yangi quote yoki boshqa invoice sababi eski amal ACKsi bilan o‘chmaydi. Umumiy editor `saved` holatini faqat joriy body original ACK payloadga mos bo‘lganda qo‘yadi.

Legacy categories, units, customers va suppliers formalarida synchronous flight va `useAcknowledgedMutation` qo‘llanadi. Ularning eski endpointlariga mavjud bo‘lmagan idempotency kafolati berilmaydi. Write ACKdan keyingi list GET xatosi write muvaffaqiyatsizligini anglatmaydi; unknown natija avtomatik yangi request bilan qaytarilmaydi. Rollar o‘zining existing immutable request kalitlari bilan tiklanadi. Barkod generatsiyasi ham original generation kalitini noma’lum natijada saqlaydi; yangi alias/generation read xatosida bloklanadi.
