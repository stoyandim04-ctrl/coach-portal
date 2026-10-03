# FitCheck SaaS — седмичен чек-ин портал за фитнес треньори

Mobile-first прототип с тъмен интерфейс: треньорът добавя клиенти и им изпраща личен линк. Клиентът попълва седмичен отчет (тегло, сън, енергия, мерки, снимки Front/Side/Back, коментар), а треньорът вижда цялата история по седмици.

**Технологии:** HTML + Tailwind CSS (CDN) + Vanilla JS (ES modules). Без build стъпка.
**Данни:** localStorage за бърз MVP или Firebase (Auth + Firestore + Storage). Превключва се с една настройка.

## Продукт и дизайн

- [PRODUCT.md](PRODUCT.md) — проблем, персони, модули, обхват и метрики.
- [DESIGN.md](DESIGN.md) — премиум тъмна дизайн система: токени за цветове, 2 шрифта (Space Grotesk + Inter), 6 размера текст и строга скала от 4 px.

Мигрираните секции (засега **Треньорско табло**) зареждат `design-tokens.js` + `tailwind.strict.js`, които **подменят** стандартната Tailwind скала. Клас извън системата просто не работи. Проверка:

```bash
node scripts/design-lint.mjs
```

## Стартиране

ES модулите изискват HTTP сървър (не работи с `file://`):

```bash
python3 -m http.server 8080
# или
npx serve .
```

Отворете http://localhost:8080 и натиснете **„пробвай веднага с демо акаунт“** (`demo@fitcheck.app` / `demo1234`) или се регистрирайте.

> Тест от телефон в същата мрежа: `http://<IP-на-компютъра>:8080`.

## Страници

| Файл | Описание |
|---|---|
| `index.html` | Landing + вход / регистрация (bottom sheet на мобилни). `#login` / `#register` отварят формата директно. |
| `dashboard.html` | Треньорски панел. `#/` — клиенти с индикатор за последен чек-ин, търсене и филтри; `#/client/:id` — история: графика на теглото, мерки, снимки (lightbox), коментари и бележки на треньора. |
| `checkin.html?t=<token>` | Публична форма за клиента — без регистрация. |

Индикатор за последен чек-ин: 🟢 ≤ 7 дни · 🟡 8–14 дни · 🔴 > 14 дни · ⚪ няма.

## Структура

```
assets/
  css/app.css                  слайдери, анимации, safe-area
  js/
    config.js                  избор на backend + Firebase конфигурация
    tailwind.config.js         тема (цветове, шрифт)
    lib/utils.js               DOM, дати, ID, компресия на снимки
    lib/model.js               валидация, статуси, производни данни
    lib/ui.js                  икони, toast, модали, lightbox, confirm
    services/backend.js        фасада — единствената точка за достъп до данни
    services/local-adapter.js  localStorage реализация
    services/firebase-adapter.js  Firebase реализация (същия интерфейс)
    services/demo-data.js      демо данни
    pages/landing.js | dashboard.js | checkin.js
firestore.rules, storage.rules, firebase.json
```

Страниците говорят само с `getBackend()` — двата адаптера имат еднакъв интерфейс (описан в `services/backend.js`), така че смяната на backend не засяга UI кода.

## Демо режим (localStorage) — ограничения

- Данните живеят **само в този браузър**. Линк за чек-ин, отворен на друго устройство, няма да намери клиента. Бутонът „Форма“ в профила на клиента отваря формата в същия браузър за тест.
- Снимките се компресират (720px, JPEG) и се пазят като data URL; лимитът на localStorage е ~5 MB.
- Паролите се хешират (SHA-256 + salt), но това е прототип — не е реална защита.

## Firebase (production)

1. Създайте проект в [Firebase Console](https://console.firebase.google.com) и добавете **Web app**.
2. Включете **Authentication → Email/Password**, **Firestore** и **Storage**.
3. Поставете конфигурацията в `assets/js/config.js` и задайте `backend: 'firebase'`.
4. Деплой на правилата и хостинга:

```bash
npm i -g firebase-tools
firebase login
firebase use --add            # изберете проекта
firebase deploy               # hosting + firestore.rules + storage.rules
```

Модел на данните:

```
coaches/{uid}           { name, email, createdAt }
clients/{id}            { coachId, name, email, goal, token, createdAt }
checkinLinks/{token}    { clientId, coachId, clientName, coachName }   // публично четене само по точен token
checkins/{id}           { token, clientId, coachId, clientName, weight, sleep, energy,
                          measurements, comment, photos{front,side,back → storage path},
                          coachNote, createdAt }
Storage: checkins/{token}/{checkinId}/{front|side|back}.jpg
```

Правилата гарантират, че треньорът вижда само своите данни, а клиентът може единствено да прочете своя линк и да създаде чек-ин към него (без да чете чужди отчети или снимки).

Сайтът е статичен и може да се хоства и на Netlify, Vercel, GitHub Pages и др.

## Идеи за следващи стъпки

- Имейл/push напомняния за чек-ин (Cloud Functions + cron)
- Сравнение на снимки „преди / след“ една до друга
- Абонаменти за треньори (Stripe) и лимити по план
- PWA офлайн режим (service worker)
