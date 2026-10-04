# Coach Portal

Мобилно приложение (PWA-подобен уеб) за онлайн фитнес треньори и техните клиенти. Треньорът вижда какво изисква вниманието му, а клиентът вижда какво трябва да направи днес.

**Технологии:** HTML + Tailwind CSS (CDN) + Vanilla JS (ES modules), без build стъпка.
**Данни:** localStorage за демо или Firebase (Auth + Firestore + Storage). Превключва се в `assets/js/config.js`.

- [PRODUCT.md](PRODUCT.md): роли, екрани, потоци, модел на данните.
- [DESIGN.md](DESIGN.md): неутрална тъмна дизайн система (токени, компоненти, мобилни правила).

## Стартиране

```bash
python3 -m http.server 8080   # или: npx serve .
```

Отворете http://localhost:8080. За бърз преглед има демо акаунти в долната част на входния екран:
- **Треньор:** `coach@demo.coachportal.app` / `demo1234`
- **Клиент:** `client@demo.coachportal.app` / `demo1234`

## Страници

| Файл | Роля | Съдържание |
|---|---|---|
| `index.html` | публична | Вход, избор на роля, регистрация, покана (`?invite=<token>`) |
| `coach.html` | coach | `#/` Начало · `#/clients` · `#/client/:id/:tab` · `#/messages` · `#/profile` |
| `client.html` | client | `#/` Начало · `#/plan` · `#/progress` · `#/chat` |
| `checkin.html?t=<token>` | публична | Check-in в 4 стъпки (също от клиентското приложение) |
| `dashboard.html` | — | Пренасочване към `coach.html` за стари линкове |

## Структура

```
assets/
  css/app.css                  safe-area, движение, плъзгач, skeleton
  js/
    config.js                  избор на backend + Firebase конфигурация
    design-tokens.js           дизайн токени
    tailwind.strict.js         строга Tailwind тема от токените
    lib/utils.js               DOM, дати, числа, ID, компресия на снимки
    lib/model.js               роли, валидация, статуси, програма, приоритети
    lib/session.js             проверка на роля, поздрав
    lib/ui.js                  компоненти (бутони, полета, списъци, навигация, sheet-ове)
    lib/views.js               общи изгледи (ред на клиент, графика, check-in)
    services/backend.js        фасада — единствената точка за достъп до данни
    services/local-adapter.js  localStorage (+ миграция от FitCheck v1)
    services/firebase-adapter.js  Firebase (същият интерфейс)
    services/demo-data.js      демо данни
    pages/entry.js | coach.js | client.js | checkin.js
firestore.rules, storage.rules, firebase.json
scripts/design-lint.mjs
```

## Демо режим (localStorage): ограничения

- Данните са **само в този браузър**. Покана или check-in линк, отворен на друго устройство, няма да намери клиента.
- Снимките се компресират (720 px JPEG); лимитът на localStorage е ~5 MB.
- Паролите се хешират (SHA-256 + salt), но това е прототип.

## Firebase

1. Създайте проект в Firebase Console, добавете Web app и включете Email/Password, Firestore и Storage.
2. Поставете конфигурацията в `assets/js/config.js` и задайте `backend: 'firebase'`.
3. `firebase deploy --only firestore:rules,storage` (хостингът е във Vercel).

Правилата: ролята е неизменна; треньорът вижда само своите клиенти, check-ins и бележки; клиентът вижда само своя запис (програма) и своите check-ins; бележките на треньора (`clientNotes`) никога не са видими за клиента.

Адаптерът и правилата не са тествани срещу реален Firebase проект. Check-ins, изпратени преди клиентът да си направи акаунт, не се виждат в неговото приложение при Firebase (треньорът ги вижда), защото не носят `clientUserId`.

## Проверка на дизайна

```bash
node scripts/design-lint.mjs
```
