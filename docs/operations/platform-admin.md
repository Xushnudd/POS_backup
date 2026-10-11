# Platforma boshqaruvi

`/platform` — tayinlangan platforma administratorining umumiy paneli. POST `/api/platform/overview` faqat faol password sessiya, faol user/membership va mustaqil `PlatformOperator(role=platform_admin,isActive=true)` bilan ishlaydi. Oddiy owner/admin business roli platforma huquqi bermaydi. Endpoint `platform.overview` action, operationId va kanonik parsed payload hashga bog‘langan ikkinchi faktor proofni har so‘rovda talab qiladi; critical rollout flagdan mustaqil. Real SMS/e-mail mavjud emasligi sabab hozir TOTP sozlanishi zarur.

So‘rov: `{operationId: UUID, page: 1..10000, search: string(max100)}`; page/search default1/bo‘sh. Javob tashkilotlarning20lik qidirilgan sahifasi, shu filtr bo‘yicha total, tasdiqlangan tarif versiyalari, eng so‘nggi20 ochiq hodisaning metadata qismi, so‘rov vaqtida DB ulanishi va mavjud integration boundary holatlari. Hosting SLA yoki butun tizim monitoringi kafolati berilmaydi. Click biznes qarori ko‘rsatiladi, real API/hardware/fiskal adapterlar yo‘q.

Organization nomi/ID va subscription xizmat holati ruxsatli cross-tenant metadata hisoblanadi. Phone/email, password/PIN, session/token, provider payloadlari, SQL URL, incident evidence, mijoz moliyaviy yozuvlari va private diagnostika chiqarilmaydi. Operator grant row lock va live authorization butun RepeatableRead read davomida saqlanadi. Vakolat revocationdan keyingi so‘rov rad etiladi.

Har muvaffaqiyatli read `PlatformOverview/platform_overview_viewed` auditini shu transactionda yozadi. Result `Operation` yoki tenantga tegishli export artifactga saqlanmaydi; keyinchalik oddiy tenant status endpointi bilan platforma ma’lumotini olish yo‘li yo‘q. Private/no-store javob, shared API admission va20/min/user budget mavjud. UI parallel submitni bloklaydi, old data yangi request boshlanganda tozalanadi; denied/revoked holatda avvalgi panel ko‘rsatilmaydi. Tariff/obuna write boshqaruvi mavjud `/billing`da alohida vakolat va MFA bilan qoladi.

Real provider, hardware, hosting va incident monitoring tashqi ishlarining bajarilgani haqida da’vo yo‘q. Platforma paneli faqat mavjud core servis va sozlanmagan chegaralarni rost ko‘rsatadi.
