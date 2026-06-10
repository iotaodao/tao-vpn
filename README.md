# TAO VPN

Личное PWA с уведомлениями для приватного VPN-сервиса. Один контейнер: Fastify API + статический фронт.

## Стек

- **Backend**: Node 22 · Fastify 5 · better-sqlite3 (WAL) · jose (JWT) · grammy (TG-бот) · web-push · nodemailer
- **Frontend**: Vite · React 18 · Service Worker · Web Push API
- **Infra**: один Docker-образ, том `/app/data` для SQLite, Cloudflare Zero Trust сверху

## Что внутри

- Авторизация через **Telegram-бота / SMS (MTS Exolve) / Email magic-link**. Только по приглашению (whitelist в БД).
- **Срочный баннер** на главном экране для пуш-публикации обновлённых конфигов или любого алерта.
- **Личные конфиги** на пользователя с принудительной подсветкой `NEW` ≤ 7 дней.
- **Web Push** с VAPID. Подписка на устройство, история уведомлений в БД.
- **Service Worker**: офлайн-кэш конфигов и статуса (stale-while-revalidate) — пользователь увидит последние ключи даже без сети.
- **Админ-API** для управления юзерами, серверами, конфигами, срочным баннером, рассылками.

## Быстрый старт (локально)

```bash
cp .env.example .env
# Заполни JWT_SECRET (openssl rand -base64 48)
# Заполни VAPID-ключи: npx web-push generate-vapid-keys
docker compose up --build
# Открой http://localhost:8080
```

Без `EXOLVE_API_TOKEN` / `SMTP_HOST` / `TELEGRAM_BOT_TOKEN` соответствующие сервисы работают в stub-режиме (коды и ссылки печатаются в логи контейнера) — удобно для разработки и для первичной выдачи кодов друзьям пока не подключены провайдеры.

## Деплой на Dokploy

1. **New App → Compose** в Dokploy, репозиторий с этим кодом.
2. В разделе **Environment** добавь переменные из `.env.example`.
3. Том `tao_data` создаётся автоматически из compose. Бэкапы — в `Volumes → Backups` или внешний cron (см. ниже).
4. **Domains** → `vpn.taodev.net`, порт `8080`, включи HTTPS через Cloudflare Tunnel (он уже есть в твоей инфре).
5. Deploy.

### Бэкапы SQLite

Раз в сутки внутри контейнера:

```bash
docker exec tao-vpn sh -c \
  'sqlite3 /app/data/tao.db ".backup /app/data/backups/tao-$(date +%F).db" \
   && gzip /app/data/backups/tao-*.db \
   && find /app/data/backups -name "*.db.gz" -mtime +14 -delete'
```

Положи это в Dokploy → Scheduled Jobs.

## Первоначальная настройка

После первого запуска контейнер пустой. Открой shell:

```bash
docker exec -it tao-vpn node
```

```js
import { db } from "./src/db.js";
import { nanoid } from "nanoid";

// 1. Добавь первого админа в whitelist (по своему Telegram ID или телефону)
db.prepare(`INSERT INTO invites (id, name, telegram_id, created_at) VALUES (?, ?, ?, ?)`)
  .run(nanoid(12), "Олег", "ТВОЙ_TG_ID", Date.now());

// 2. После твоего первого входа в приложение — пометь себя админом:
db.prepare(`UPDATE users SET is_admin = 1 WHERE telegram_id = ?`).run("ТВОЙ_TG_ID");
```

Свой Telegram ID можно узнать через бот `@userinfobot`.

## Админ-API

Все эндпоинты под `/api/admin/*`, требуют `Authorization: Bearer <JWT>` пользователя с `is_admin = 1`.

| Метод | Путь | Назначение |
|---|---|---|
| `PUT` | `/api/admin/urgent` | Включить срочный баннер + (опц.) разослать пуш |
| `DELETE` | `/api/admin/urgent` | Скрыть баннер |
| `POST` | `/api/admin/servers` | Добавить сервер |
| `PUT` | `/api/admin/servers/:id` | Обновить (статус, нагрузка, latency) |
| `DELETE` | `/api/admin/servers/:id` | Удалить |
| `POST` | `/api/admin/configs` | Выдать конфиг пользователю (+ авто-пуш + запись в notifications) |
| `PUT` | `/api/admin/configs/:id/uri` | Поменять URI существующего конфига |
| `DELETE` | `/api/admin/configs/:id` | Деактивировать |
| `POST` | `/api/admin/notifications` | Broadcast или адресная рассылка |
| `GET/POST` | `/api/admin/invites` | Управление whitelist |
| `GET` | `/api/admin/users` | Список пользователей |

Пример публикации обновлённого конфига с пушем всем владельцам:

```bash
curl -X POST https://vpn.taodev.net/api/admin/urgent \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "active": true,
    "type": "config_update",
    "title": "Обновлены конфиги NL-1 и DE-1",
    "body": "Перевыпущены ключи Reality. Откройте Конфиги и обновите импорт.",
    "cta_label": "Перейти к конфигам",
    "cta_tab": "configs",
    "push": true
  }'
```

## Цепочка авторизации (как это работает)

**Telegram**: фронт `POST /auth/telegram/start` → бэк создаёт `state`, возвращает `https://t.me/TaoVPNBot?start=<state>`. Юзер открывает бот, нажимает Start. Бот пишет `state → telegram_id`. Фронт раз в 2.5с дергает `/auth/telegram/poll` — пока `pending`, ждёт. Получает `confirmed` + JWT.

**Phone**: `POST /auth/phone/request` → 4-значный код через Exolve. `POST /auth/phone/verify` → JWT. Anti-bruteforce: 5 попыток на код, TTL 15 мин, лимит 60 req/мин на IP.

**Email**: то же самое, но 6-значный код + magic-link в письме (можно открыть на любом устройстве — приложение определит `?magic=...&code=...` параметры).

JWT хранится в `localStorage` (90 дней). Сессии в БД, можно отзывать по `sessions.revoked_at`.

## Telegram-бот

Один бот для авторизации. Создай через `@BotFather`, токен → `TELEGRAM_BOT_TOKEN`, username (без `@`) → `TELEGRAM_BOT_USERNAME`. Бот сам стартует при запуске контейнера в long-polling режиме (webhook не нужен).

## VAPID-ключи

Генерируются один раз:

```bash
npx web-push generate-vapid-keys
```

Положи в env, **не теряй приватный ключ** — потеря = все push-подписки умрут, юзерам придётся переподписываться.

## Структура репозитория

```
tao-vpn/
├── server/                 Fastify backend
│   ├── src/
│   │   ├── index.js
│   │   ├── db.js
│   │   ├── auth/           jwt, middleware, users
│   │   ├── routes/         auth.js, app.js, admin.js
│   │   └── services/       sms, mail, tgbot, webpush
│   └── migrations/         SQL schema
├── web/                    Vite + React PWA
│   ├── src/
│   │   ├── components/     GeodesicSphere, ui primitives
│   │   ├── screens/        Login, Status, Other (Configs/Alerts/Account)
│   │   ├── api.js          API client
│   │   ├── push.js         Web Push subscribe helpers
│   │   └── theme.js        Design tokens
│   └── public/             manifest, sw.js, icons
├── Dockerfile              multi-stage build
├── docker-compose.yml      single service
└── .env.example
```

## Дальше

- Админка как отдельная вкладка в самом PWA (когда понадобится — добавим CRUD UI для invites/servers/configs).
- Sub-ссылки (`https://vpn.taodev.net/sub/<user-id>`) для импорта всех конфигов одной ссылкой в v2rayNG/Streisand.
- Расширить `last_seen_at` юзера и активные устройства в личном кабинете.
- Если друзей станет 50+ — добавить отдельный SQLite-индекс на `notifications.audience`, либо мигрировать на Postgres (миграция простая, ORM не использовали — чистый SQL).
