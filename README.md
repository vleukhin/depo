# Депо — учёт средств USDT

Небольшое однопользовательское веб-приложение для учёта депозита в USDT. Три блока и сводка со сверкой баланса.

## Возможности

- **Средства** — из чего состоит депо (название, сумма).
- **Размещение** — где средства находятся сейчас: внешний кошелёк (адрес) или биржа (KuCoin/Bitget, спотовый или основной счёт), плюс название, сумма, место, комментарий.
- **Долги** — кто и сколько взял из депо (менеджер из справочника, дата, сумма, сервис, откуда взял, комментарий).
- **Менеджеры** — справочник (имя, ник телеграм) для выбора в долгах вместо ввода текстом; кнопка «Менеджеры» в блоке «Долги» открывает форму управления списком.
- **Дашборд со сверкой** — всего в депо / размещено / выдано в долг / сверка: **размещено + долги = депо**. Избыток (больше депо) — зелёный, недостача (меньше депо) — красный.
- **Авторизация** — вход по паролю (`APP_PASSWORD` в `.env`, плюс `AUTH_SECRET` для подписи сессий). Сессия — httpOnly-cookie на 30 дней, все страницы и API закрыты через `src/proxy.ts`. Смена пароля разлогинивает все сессии.
- **Проверка балансов** — кнопка «Проверить балансы» в блоке «Размещение» обновляет строки: для кошельков — USDT (TRC-20) и нативный TRX по адресу через TronGrid, для бирж — балансы USDT и TRX счёта (спотового или основного/funding) через приватные API KuCoin и Bitget (нужны read-only ключи `KUCOIN_*`/`BITGET_*` в `.env`). USDT попадает в «Сумму» и участвует в сверке, TRX показывается отдельной справочной колонкой. Время последнего обновления — в подсказке. Опционально `TRONGRID_API_KEY` в env, чтобы не упираться в публичный rate limit.

## Стек

Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS · shadcn/ui · react-hook-form + zod · TanStack Query · libSQL (`@libsql/client`) — Turso в проде, локальный файл SQLite в разработке.

Единый процесс: Next.js отдаёт и UI, и REST API (`/api/*`).

## Запуск

```bash
npm install
npm run dev      # http://localhost:3000
```

Продакшн:

```bash
npm run build
npm run start
```

## Данные

- Слой данных — libSQL (`@libsql/client`), SQL-совместим с SQLite. Весь SQL в `src/lib/repo.ts`, соединение — `src/lib/db.ts`.
- **Разработка**: если `TURSO_*` не заданы, используется локальный файл `data/depo.db` (создаётся автоматически, в `.gitignore`; путь можно переопределить `DB_PATH`).
- **Прод**: с `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` приложение работает с Turso. См. [DEPLOY.md](DEPLOY.md).
- Суммы хранятся как целые micro-USDT (сумма × 1 000 000) для точной сверки; ввод/вывод — в десятичных USDT.

## Деплой

Vercel + Turso, бесплатно для личного использования. Пошагово — в [DEPLOY.md](DEPLOY.md).

## Модель данных

| Таблица      | Поля                                                                 |
| ------------ | ------------------------------------------------------------------- |
| `funds`      | name, amount                                                        |
| `managers`   | name, telegram (nullable)                                           |
| `placements` | name, amount, kind (wallet/exchange), place, address (для wallet), exchange (KuCoin/Bitget, для exchange), exchange_account (spot/main), comment |
| `debts`      | manager_id (FK → managers, `ON DELETE RESTRICT`), amount, date (YYYY-MM-DD), service (nullable: Lets/Mate/N-Obmen/Currex), placement_id (FK → placements, `ON DELETE SET NULL`), source_text, comment |

«Откуда взял» в долгах — либо ссылка на размещение (выпадающий список), либо свободный текст.

## API

REST под `/api`: `funds`, `managers`, `placements`, `debts` (CRUD: GET/POST/PUT/DELETE) и `summary` (GET, сводка со сверкой).

## Структура

```
src/
  app/            layout, page, api/*/route.ts (REST-хендлеры)
  components/     ui/ (shadcn), providers, SectionCard, DeleteButton
  features/       dashboard, funds, placements, debts (секции + формы)
  hooks/          use{Funds,Placements,Debts,Summary} + фабрика CRUD-хуков
  lib/            db, schema.sql, money, validate (zod), repo, api, format
  types.ts        доменные типы
```
