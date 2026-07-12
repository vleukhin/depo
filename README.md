# Депо — учёт средств USDT

Небольшое однопользовательское веб-приложение для учёта депозита в USDT. Три блока и сводка со сверкой баланса.

## Возможности

- **Средства** — из чего состоит депо (название, сумма).
- **Размещение** — где средства находятся сейчас: внешний кошелёк (адрес) или биржа (KuCoin/Bitget, спотовый или основной счёт), плюс название, сумма, место, комментарий.
- **Долги** — кто и сколько взял из депо (менеджер, сумма, сервис, откуда взял, комментарий).
- **Дашборд со сверкой** — всего в депо / размещено / выдано в долг / сверка: **размещено + долги = депо**. Избыток (больше депо) — зелёный, недостача (меньше депо) — красный.
- **Авторизация** — вход по паролю (`APP_PASSWORD` в `.env`, плюс `AUTH_SECRET` для подписи сессий). Сессия — httpOnly-cookie на 30 дней, все страницы и API закрыты через `src/proxy.ts`. Смена пароля разлогинивает все сессии.
- **Проверка балансов из сети TRON** — кнопка «Проверить балансы» в блоке «Размещение» запрашивает USDT (TRC-20) по адресам строк через TronGrid и перезаписывает суммы. Время последнего обновления — в подсказке на сумме. Опционально `TRONGRID_API_KEY` в env, чтобы не упираться в публичный rate limit.

## Стек

Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS · shadcn/ui · react-hook-form + zod · TanStack Query · SQLite (better-sqlite3).

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

- Хранилище — SQLite, файл `data/depo.db` (создаётся автоматически при первом запросе, в `.gitignore`).
- Путь к БД можно переопределить переменной `DB_PATH`.
- Суммы хранятся как целые micro-USDT (сумма × 1 000 000) для точной сверки; ввод/вывод — в десятичных USDT.

## Модель данных

| Таблица      | Поля                                                                 |
| ------------ | ------------------------------------------------------------------- |
| `funds`      | name, amount                                                        |
| `placements` | name, amount, kind (wallet/exchange), place, address (для wallet), exchange (KuCoin/Bitget, для exchange), exchange_account (spot/main), comment |
| `debts`      | manager, amount, date (YYYY-MM-DD), service (nullable: Lets/Mate/N-Obmen/Currex), placement_id (FK → placements, `ON DELETE SET NULL`), source_text, comment |

«Откуда взял» в долгах — либо ссылка на размещение (выпадающий список), либо свободный текст.

## API

REST под `/api`: `funds`, `placements`, `debts` (CRUD: GET/POST/PUT/DELETE) и `summary` (GET, сводка со сверкой).

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
