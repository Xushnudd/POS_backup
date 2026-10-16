# Mustaqil xizmat holati

OPS-02.06 uchun alohida, dependency-siz Node.js 24 HTTP xizmati. POS, PostgreSQL,
Next.js, internet, tashqi font yoki JavaScript kutubxonasiga ulanmaydi.
Windows/macOS/Linuxda Node.js 24 bilan yoki Docker/Podman orqali ishlaydi.
“Universal” Node.js yoki OCI runtime mavjud platformalarni bildiradi; runtimesiz
ishga tushmaydi. Haqiqiy boshqa host/domain/TLS hozir mavjud emas.

## Dockersiz

Repository ildizida `node ops/status/server.mjs`. Standart manzil
`http://127.0.0.1:8091`. `HOST`, `PORT`, `STATUS_FILE` process environment orqali
sozlanadi. `STATUS_FILE` berilmasa script yonidagi public JSON ishlatiladi;
joriy ish katalogiga bog‘liq emas. Node xizmatini OS service manager bilan
boshqarish mumkin. Internetga ochishda alohida host va TLS ingress kerak.

## Docker

`docker compose -f docker-compose.status.yml up -d --build`

Bu alohida Compose project: asosiy compose bilan birlashtirmang. Unda POS/DB,
umumiy volume, secret, app network yoki depends_on yo‘q. Container non-root,
read-only, cap-drop va no-new-privileges bilan ishlaydi. Default faqat hostning
127.0.0.1:8091 porti ochiladi. Alohida mashinaga faqat `ops/status` va compose
faylini ko‘chirish yetadi; main repository yoki business bazasi talab qilinmaydi.

Compose bo‘lmasa: `docker build -t pos-status ops/status`, keyin
`docker run --rm --read-only --cap-drop=ALL --security-opt=no-new-privileges
-p 127.0.0.1:8091:8091 pos-status`. Buyruq bir satrda bajariladi. `docker`
o‘rniga `podman` ham ishlatiladi. Container healthcheck status xizmatining
o‘zini tekshiradi; u POS ishlab turganini bildirmaydi.

## Holatni yangilash

`ops/status/public-status.json` faqat ommaga mo‘ljallangan matn uchun.
Default holatlar `unknown`: deployning o‘zi POS ishlashini tasdiqlamaydi.
`updatedAt` UTC, `validForMinutes` 1–1440; tasdiq eskirsa yoki kelajak sanasi
bo‘lsa barcha komponentlar `unknown`. Browser sahifasini qayta yuklang.
Status JSON va HTML `no-store`; offline “yashil” snapshot cache qilinmaydi.

Operator xizmatni tekshiradi, timestamp va component statusini yangilaydi,
hodisa uchun unique ID, ta’sirlangan componentlar va ketma-ket UTC updates
yozadi. Fazalar investigating/identified/monitoring/resolved. Eski timeline
yozuvlarini tahrirlash o‘rniga yangi update qo‘shing; tarix Git review orqali
saqlanadi. Resolved hodisani qayta ochish uchun yangi ID yarating.

Tekshirish: `node --input-type=module -e "import {load} from
'./ops/status/status.mjs'; load('ops/status/public-status.json')"` (bir satr).
Publish oldidan ikkinchi mas’ul matnda mijoz siri yo‘qligini ko‘rib chiqadi.
Schema noma’lum fieldlarni rad etadi, lekin inson yozgan matndan barcha sirlarni
aniqlay olmaydi. Raw ticket import/export endpointi mavjud emas.

Dockersiz faylni shu filesystemdagi vaqtinchalik fayldan atomic rename bilan
almashtiring. Windowsda open-file cheklovi bo‘lsa qisqa stop/replace/start
qiling. Container uchun yangi reviewed JSON bilan image rebuild/recreate;
rollback oldingi reviewed image orqali. Yangilash xatosida sahifa 503 va
“holat mavjud emas” beradi, eski green natijani qaytarmaydi.

`/`, `/style.css`, `/status.json`, `/healthz`dan boshqa yo‘llar 404;
GET/HEADdan boshqa metodlar 405. Admin/editor/login yo‘q. Ichki postmortem
va ticketlar imagega COPY qilinmaydi. Xizmat access logga URL/body yozmaydi.

## Qabul va chegaralar

`node --test scripts/status/status.test.mjs` faqat ushbu yangi modulni tekshiradi.
Docker va native runtime mashqi alohida dalil bilan qayd qilinadi. Mahalliy
container ajratilishi boshqa fizik hostning quvvat/tarmoq uzilishidan himoya
emas. Real mustaqil hosting, TLS va on-call tashqi deployment shartlari bo‘lib
qoladi. Qabul sanog‘i o‘zgarishi aniq tasdiqlangan scope va dalilga bog‘liq.
