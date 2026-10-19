# API tezlik va hajm cheklovlari

Himoyalangan barcha API handlerlar `withApi` orqali tashkilot + foydalanuvchiga bog‘langan umumiy PostgreSQL limitdan o‘tadi. Default: o‘qish 600/minut, yozish 300/minut. Hisoblagich instance xotirasida emas; shu bazaga ulangan ilova nusxalari bitta counter ishlatadi. Limit authorizationdan keyin, reference scan, body parse, import worker va business handlerdan oldin tekshiriladi. Qimmat report, import, finance, sync, file, job va auth amallarining mavjud torroq limitlari ham saqlanadi. Limitlar bir-birini almashtirmaydi.

Public auth yozishlarida default1200/minut admission limiti mavjud. `TRUST_PROXY_IP=true` va haqiqiy IP formatli `x-real-ip` bo‘lsa IP bo‘yicha; aks holda umumiy `unattributed` bucket. Oddiy clientning `x-forwarded-for` yoki `x-real-ip` headeri vakolat hisoblanmaydi. `TRUST_PROXY_IP` faqat ilovaga bevosita tashqi kirish yopilgan va reverse proxy headerni o‘zi almashtiradigan deploymentda yoqiladi. Proxy o‘rnatilgani ushbu local test bilan tasdiqlanmaydi. Login/register/resetning account/token bo‘yicha alohida limitlari saqlanadi. Health probe va logout umumiy admission limitiga kirmaydi: monitoring va sessiyani yopish imkoniyati saqlanadi.

## Konfiguratsiya

- `API_READS_PER_MINUTE=600`
- `API_WRITES_PER_MINUTE=300`
- `API_PUBLIC_WRITES_PER_MINUTE=1200`
- `API_BODY_TIMEOUT_MS=10000`

Request limitlari 10–100000/minut, body deadline50–30000ms oralig‘idagi butun sonlar. Noto‘g‘ri production konfiguratsiya startupda rad etiladi; runtime qiymati noto‘g‘ri bo‘lsa himoya ochilib qolmaydi,503 qaytadi. Bu qiymatlar throughput yoki mijoz SLA kafolati emas; operator o‘z kuzatilgan trafikiga moslaydi.

## Hajm, vaqt va import

JSON body eng ko‘pi1MiB. `Content-Length` ham, amalda o‘qilgan stream baytlari ham tekshiriladi; headerni olib tashlash hajm cheklovini chetlab o‘tmaydi. Body belgilangan umumiy muddatda yetib kelmasa408 `REQUEST_BODY_TIMEOUT`; handler hali boshlanmagan. Timeout biznes transactionni yo‘lda to‘xtatish uchun ishlatilmaydi. Bu app ingress himoyasi; TCP header/socket/flood himoyasi hosting/reverse proxy konfiguratsiyasiga ham bog‘liq.

Import base64≤700000belgi, bir sheet,1000data qatori,30ustun,4000belgi/katak. Hajm/qator/ustun/katak limiti413; buzilgan fayl yoki active/formula qiymat400. Parsing alohida Node workerda128MiB heap,2parallel worker,10s deadline bilan. Worker band bo‘lsa429 va Retry-After5. Raw parser exception va rad etilgan fayl baytlari error response yoki logga chiqarilmaydi; muvaffaqiyatli authorized preview o‘z qatorlarini ko‘rsatadi. Qimmat eksportlarning mavjud10000row/bounded artifact va download slot limitlari saqlanadi; to‘liq filtrni jim qisqartirish yo‘q.

## Qayta urinish

429 `RATE_LIMITED` javobida `Retry-After` sekund keladi. Shu muddatni kuting, original operationId va payloadni saqlang. Yo‘qolgan javobdan keyin yangi kalit bilan qayta yozmang. DurableMutation429ni yakuniy rad etish deb hisoblamaydi: pending amal va original kalit qoladi. Limit oynasi tugaganda original committed amal faqat joriy vakolat tekshiruvidan keyin qaytariladi.413da fayl/so‘rovni kichraytirish,408da ulanishni tekshirish kerak. Provaydersiz auth503 holati limit tugashi bilan real yuborishga aylanmaydi.

Qabul dalili SEC-02.05: barcha protected handler429 inventari, public auth/admission/IP spoofing, shared counter race, tenant isolation, expiry/retry, declared va real body413, slow-body408, import413, public account/reset limitlari va original-key browser recovery. Live hosting, tashqi WAF yoki vendor SMS/e-mail deploymenti bu bandga qo‘shib da’vo qilinmaydi.
