# ТЗ: Telegram-бот для заведения долгов в «Депо»

> Техническое задание на разработку. Документ описывает **что** и **как** нужно
> сделать; сам код — отдельный этап после утверждения ТЗ.

## 1. Контекст и цель

Менеджеры пишут в рабочий чат Telegram, когда хотят взять деньги из депо. Примеры
их сообщений (свободная форма, сленг):

```
Пришли пожалуйста на рапиру 9200 тез
Верну с кукойн
```
```
Отправьте пожалуйста на рапиру
10100 теза
Верну с кукойн
```
```
Нужно 4500 на рапиру для Питера
```

Владелец **пересылает** такое сообщение боту. Бот должен:

1. Определить **менеджера** (кто берёт в долг) — по нику автора пересланного сообщения.
2. Определить **сумму** — из текста.
3. При нехватке данных — переспросить (сумму / менеджера / сервис).
4. Показать сводку и по кнопке **создать запись в блоке «долги»**.

Расшифровка сленга: «тез»/«теза»/«тезер» = USDT (Tether), сумма в USDT; «рапира»
(Rapira) = площадка-получатель; «верну с кукойн» = источник, с которого менеджер
вернёт долг; «для Питера» = получатель/контекст.

Итог сверки в приложении: **размещено + долги = депо**. Бот увеличивает сумму
долгов, создавая корректную запись в таблице `debts`.

## 2. Продуктовые решения (согласованы)

| # | Решение |
|---|---------|
| 1 | Разбор текста — через **LLM (Anthropic Claude)**; парсер вынесен в отдельный модуль и заменяем (есть regex-фолбэк). |
| 2 | Менеджер определяется через **существующий справочник `managers`**: ник автора форварда сопоставляется с `managers.telegram`. Не нашли — переспросить кнопками из списка. |
| 3 | Перед созданием записи — **подтверждение кнопкой** (сводка + «Создать»/«Отмена»). |
| 4 | Оригинал форварда → `debts.source_text`; распознанные детали (назначение «рапира», возврат «кукойн», получатель) → `debts.comment`; при подтверждении бот **предлагает выбрать `service`** (Lets/Mate/N-Obmen/Currex) кнопками. |

## 3. Зависимость от фичи «Менеджеры» (важно)

Справочник менеджеров реализуется в **отдельной ветке** и вводит таблицу:

```sql
CREATE TABLE IF NOT EXISTS managers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,               -- имя
  telegram   TEXT,                            -- ник телеграм (необязательно)
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

Помимо таблицы фича «Менеджеры» вводит:

- `debts.manager_id` — FK → `managers(id)`, `ON DELETE RESTRICT`; LEFT JOIN отдаёт
  `manager_name` (по образцу `placement_id`/`placement_name`). Свободный текст
  `debts.manager` **заменяется** на `manager_id` (обязателен).
- Репо-функции `listManagers`/`createManager`/`updateManager`/`deleteManager`,
  тип `Manager`, схему `ManagerInput`, роуты `/api/managers`, UI
  `ManagersDialog`/`ManagerForm`, хук `useManagers`.

**Следствия для бота:**

- Таблицу `managers` бот **не создаёт и не меняет** — только читает.
- Долг создаётся с **`manager_id`**, а не со свободным текстом.
- Бот-фичу разрабатываем **поверх** ветки «Менеджеры» — она должна быть смёржена
  и перебазирована на текущий async-libSQL `master` до старта разработки бота.

## 4. Технические ограничения кодовой базы

- **Vercel (serverless) + Turso (libSQL)** → только **вебхук** Telegram, без
  long-polling. Между запросами нет памяти — состояние диалога хранится в БД.
- `src/proxy.ts` (замена middleware в Next 16) гейтит все маршруты, кроме точных
  путей в `PUBLIC_PATHS` (сравнение через `.has(pathname)`). Путь вебхука
  добавляется туда; аутентификация — секрет-заголовок Telegram, не cookie.
- Весь SQL — только в `src/lib/repo.ts` (все функции `async`). Схема — строка
  `SCHEMA` + идемпотентный `migrate()` в `src/lib/db.ts`.
- Деньги хранятся как целые **micro-USDT** (USDT × 1 000 000). Конверсия
  `toMicro`/`fromMicro`/`decimalToMicro` (`src/lib/money.ts`) — **только** в repo.
- HTTP-конвенция (`src/lib/tron.ts`, `kucoin.ts`, `bitget.ts`): нативный `fetch`,
  `signal: AbortSignal.timeout(10_000)`, `cache: "no-store"`, ретрай на HTTP 429
  до 3× с `sleep(1000*attempt)`, секреты из `process.env` внутри функции, ошибки —
  `throw new Error("<Prefix>: ...")`.
- Каждый route-хендлер: `export const runtime = "nodejs"`.
- В проекте **нет** AI-SDK и Telegram-библиотек — добавляем `@anthropic-ai/sdk`;
  Bot API вызываем вручную через `fetch`.
- Стек: Next 16.2.10, React 19, **zod v4**, `@libsql/client`.

## 5. Архитектура

Приём обновлений — через вебхук (serverless не позволяет long-polling):

```
Telegram  --POST Update-->  /api/telegram (route.ts)
   секрет-заголовок + owner allow-list + дедуп update_id
      -> dispatch.handleUpdate(update)          конечный автомат
           -> parse.ts (LLM)  |  manager.ts (managers.telegram)
           -> repo (tg_drafts / tg_updates / managers / createDebt)
           -> client.ts (sendMessage / editMessage / answerCallbackQuery)
   всегда HTTP 200 (иначе Telegram будет ретраить)
```

Путь вебхука: **`/api/telegram`** (одиночный сегмент, точное совпадение в
`PUBLIC_PATHS`). Route **не использует** `handle()`/`parseBody()` из
`api-helpers.ts` — они возвращают 4xx/5xx, а Telegram нужен 200.

## 6. Изменения в БД

Добавляются в строку `SCHEMA` в `src/lib/db.ts` (новые таблицы применяются в
`initSchema` через `executeMultiple(SCHEMA)` идемпотентно; `migrate()` нужен
только для новых **колонок существующих** таблиц). Суммы — micro-USDT.

### 6.1. `tg_drafts` — черновик диалога

| Колонка | Тип | Назначение |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | идентификатор черновика |
| `chat_id` | INTEGER NOT NULL | чат владельца |
| `status` | TEXT NOT NULL CHECK IN (`awaiting_amount`,`awaiting_manager`,`awaiting_service`,`awaiting_confirmation`,`done`,`cancelled`) | состояние автомата |
| `source_text` | TEXT | оригинальный текст форварда (→ `debts.source_text`) |
| `amount` | INTEGER | сумма в micro-USDT, NULL пока не распознана |
| `manager_id` | INTEGER | FK на `managers`, NULL пока не определён |
| `manager_name` | TEXT | имя для сводки (кэш `managers.name`) |
| `sender_username` | TEXT | ник автора форварда (для сопоставления/подсказки) |
| `destination` | TEXT | «рапира» и т.п. |
| `repay_source` | TEXT | «кукойн» и т.п. |
| `service` | TEXT CHECK (NULL OR IN Lets/Mate/N-Obmen/Currex) | выбранный сервис |
| `comment` | TEXT | собранный комментарий (→ `debts.comment`) |
| `prompt_message_id` | INTEGER | id последнего сообщения бота с вопросом/клавиатурой |
| `confidence` | TEXT | `high` \| `low` (уверенность парсера) |
| `created_at` / `updated_at` | TEXT DEFAULT (datetime('now')) | таймстемпы |

### 6.2. `tg_updates` — дедупликация

| Колонка | Тип | Назначение |
|---|---|---|
| `update_id` | INTEGER PRIMARY KEY | Telegram `update_id` |
| `created_at` | TEXT DEFAULT (datetime('now')) | когда обработали |

Таблицы `managers` и `debts` бот не меняет.

## 7. Конечный автомат диалога

### 7.1. Статусы

`awaiting_amount` · `awaiting_manager` · `awaiting_service` ·
`awaiting_confirmation` · `done` · `cancelled`.

### 7.2. Переходы

1. **Приходит форвард** → создаём черновик, синхронно: `parse.ts` (сумма/детали) +
   `manager.ts` (резолв по нику).
   - сумма однозначна и менеджер определён → `awaiting_service` (предложить сервис
     кнопками) → далее `awaiting_confirmation`;
   - суммы нет / несколько кандидатов → `awaiting_amount` («Укажите сумму в USDT»);
   - менеджер не определён → `awaiting_manager` (кнопки из `listManagers()`).
2. **`awaiting_amount` + текст с числом** → пишем `amount`, далее к менеджеру/сервису/подтверждению.
3. **`awaiting_manager` + callback `manager:<draftId>:<managerId>`** → пишем `manager_id`/`manager_name`.
4. **`awaiting_service` + callback `service:<draftId>:<svc>`** (или «без сервиса») → пишем `service` → `awaiting_confirmation`.
5. **`awaiting_confirmation` + callback**:
   - `confirm:<draftId>` → `createDebt(...)` → `status=done`, редактируем сообщение
     бота (снимаем клавиатуру, дописываем «✅ Долг создан #id»);
   - `cancel:<draftId>` → `status=cancelled`, снимаем клавиатуру;
   - `edit_amount:<draftId>` → `status=awaiting_amount`;
   - `pick_manager:<draftId>` → `status=awaiting_manager`.

### 7.3. Адресация черновика

- **Callback от кнопки**: `callback_data` несёт `draftId` (авторитетно); дополнительно
  сверяем `callback_query.message.message_id == prompt_message_id`.
- **Текстовое уточнение**: по `message.reply_to_message.message_id == prompt_message_id`;
  фолбэк — самый свежий черновик чата в статусе `awaiting_*`.
- Терминальные `done`/`cancelled` в фолбэк-поиск не попадают.

### 7.4. Определение менеджера

- Основной источник — ник автора форварда: `forward_origin.sender_user.username`
  (Bot API 7.0+) или legacy `forward_from.username`.
- `findManagerByTelegram(username)` ищет в `managers` по `telegram` регистронезависимо,
  с/без ведущего `@`. Совпало → `{ id, name }`; иначе `null`.
- `null` → `awaiting_manager`: кнопки из `listManagers()`
  (`manager:<draftId>:<managerId>`). Если ник есть, но не привязан — подсказать:
  «@ник не привязан к менеджеру; выберите из списка или добавьте его в разделе
  «Менеджеры».»
- `hidden_user`-форварды и форварды без публичного `username` не дают ника →
  всегда `awaiting_manager`.

## 8. Новые модули

| Файл | Ответственность |
|---|---|
| `src/app/api/telegram/route.ts` | `runtime="nodejs"`, `maxDuration=30`. POST: секрет-заголовок (timing-safe) + owner allow-list + дедуп `update_id`, вызов `dispatch.handleUpdate`, **всегда 200**. |
| `src/lib/telegram/types.ts` | Интерфейсы `Update`/`Message`/`CallbackQuery`/`ForwardOrigin` (`user`/`hidden_user` + legacy), narrowing-хелперы `isMessageUpdate`/`isCallbackUpdate`. |
| `src/lib/telegram/client.ts` | Bot API по HTTP-конвенции: `sendMessage` (+inline-клавиатура), `editMessageText`, `editMessageReplyMarkup`, `answerCallbackQuery`, `setWebhook`. Токен из `process.env`. |
| `src/lib/telegram/parse.ts` | `parseLoanRequest(text): Promise<ParsedRequest>` (LLM), валидация zod-схемой; `parseWithRegex(text)` с тем же контрактом (фолбэк). |
| `src/lib/telegram/manager.ts` | `resolveManager(forwardOrigin)` через `findManagerByTelegram`. |
| `src/lib/telegram/dispatch.ts` | Автомат `handleUpdate(update)`: чтение/запись черновиков, ответы/клавиатуры, на confirm — `createDebt` с `manager_id`. |
| `src/lib/repo.ts` (доп.) | CRUD `tg_drafts` (`createDraft`, `getDraftById`, `getDraftByPromptMsg`, `getLatestAwaitingDraft`, `updateDraft`, `setDraftStatus`), дедуп `markUpdateProcessed(updateId): Promise<boolean>` (`INSERT OR IGNORE` + `rowsAffected`), `findManagerByTelegram(username)`. `listManagers` — из фичи «Менеджеры». |
| `src/lib/validate.ts` (доп.) | zod-схема `parsedRequest`; разбор суммы из follow-up текста (через `decimalToMicro`). |
| `src/types.ts` (доп.) | `TgDraft`, `ParsedRequest` (десятичные суммы). `Manager` — из фичи «Менеджеры». |
| `src/proxy.ts` (правка) | `PUBLIC_PATHS` += `"/api/telegram"`. |
| `.env.example`, `DEPLOY.md` (доп.) | Новые env + инструкция регистрации вебхука. |
| `package.json` | + `@anthropic-ai/sdk`. |

## 9. Контракт парсера

zod-схема `parsedRequest` (наружу — десятичные USDT):

```ts
{
  amount: number | null,                 // однозначно распознанная сумма
  amount_candidates: number[],           // если чисел несколько
  manager: string | null,                // best-effort из текста (только подсказка)
  destination: string | null,            // «рапира»
  repay_source: string | null,           // «кукойн»
  service: "Lets" | "Mate" | "N-Obmen" | "Currex" | null,
  needs_clarification: boolean,
  clarification_field: "amount" | "manager" | null,
  confidence: "high" | "low"
}
```

**Требования к промпту:**

- трактовать сленг единиц (тез/теза/тезер/USDT/tether → сумма в USDT);
- выделять число суммы отдельно от прочих чисел в тексте;
- при нескольких числах **не угадывать**: заполнить `amount_candidates`,
  `needs_clarification=true`, `clarification_field="amount"`;
- возвращать **только JSON** (JSON/tool-mode Anthropic), `temperature=0`;
- id модели вынести в env `TELEGRAM_PARSE_MODEL`, не хардкодить устаревший.

**Маппинг на долг:**

- `amount` → `DebtInput.amount` (при `amount_candidates.length > 1` → `awaiting_amount`
  с кнопками-кандидатами);
- **менеджер — только по нику форварда через `managers.telegram`**; текстовый
  `manager` из LLM — не источник истины, максимум подсказка при уточнении;
- `service` заполняем только при явном совпадении с enum (рапира/кукойн **не входят**);
- `destination` + `repay_source` → `debts.comment` (например: «рапира; верну с KuCoin»);
- оригинал форварда → `debts.source_text`; в долг пишем `manager_id`.

Порог: `confidence="low"` или `needs_clarification` → не идём сразу в подтверждение,
а сперва уточняем.

## 10. Telegram Bot API

- Обрабатываем `update.message` (в т.ч. `forward_origin`) и `update.callback_query`.
- `callback_data` ≤ 64 байт: `confirm:<id>`, `cancel:<id>`, `edit_amount:<id>`,
  `pick_manager:<id>`, `manager:<id>:<managerId>`, `service:<id>:<svc>`.
- После любого callback обязателен `answerCallbackQuery(callback_query.id)`, затем
  `editMessageReplyMarkup`/`editMessageText` (чтобы клавиатура не жалась повторно).
- **Регистрация вебхука** (one-off, документируется в DEPLOY.md):
  ```bash
  curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
    -H "Content-Type: application/json" \
    -d '{"url":"https://<vercel-app>/api/telegram",
         "secret_token":"<TELEGRAM_WEBHOOK_SECRET>",
         "allowed_updates":["message","callback_query"]}'
  ```

## 11. Безопасность

- Секрет-заголовок `X-Telegram-Bot-Api-Secret-Token` сверяется с
  `TELEGRAM_WEBHOOK_SECRET` через `timingSafeEqual` (как в `src/lib/auth.ts`:
  буферы равной длины, иначе `false`). Несовпадение/отсутствие → тихий 200.
- **Owner allow-list**: `chat.id`/`from.id` == `TELEGRAM_OWNER_CHAT_ID` — только
  владельцу бот отвечает и от него заводит долги; иначе тихо 200.
- Путь `/api/telegram` в `PUBLIC_PATHS` снимает только cookie-гейт; фактическая
  защита — секрет + allow-list.
- Токен бота, ключ Anthropic, секрет — только из `process.env`, читаются внутри
  функций, в логи и ответы не попадают.

## 12. Обработка ошибок и идемпотентность

- Route **всегда** возвращает `NextResponse.json({ ok: true })` со статусом 200,
  даже при внутренней ошибке (иначе Telegram ретраит).
- Дедуп: `markUpdateProcessed(update_id)` через `INSERT OR IGNORE INTO tg_updates`;
  `rowsAffected === 0` → уже обрабатывали → 200 без действий.
- Сбой LLM/парсера → перехват, русское сообщение: «Не смог разобрать сообщение.
  Введите сумму (USDT) числом.» + `awaiting_amount` (regex-фолбэк как страховка).
- Сбой Telegram API (`client.ts` бросает `Error`) → `console.error`, 200; повтор
  не шлём (дедуп предотвращает дубль при ретрае Telegram).
- Таймауты: `AbortSignal.timeout(10_000)` на вызовах Telegram; для Anthropic —
  таймаут SDK; в сегменте route — `maxDuration=30`.

## 13. Переменные окружения

Добавить в `.env.example` (с русскими комментариями по стилю файла) и в Vercel
(Settings → Environment Variables):

| Переменная | Назначение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | токен бота (BotFather) |
| `TELEGRAM_WEBHOOK_SECRET` | секрет вебхука (`openssl rand -hex 32`) |
| `TELEGRAM_OWNER_CHAT_ID` | chat id владельца (allow-list) |
| `ANTHROPIC_API_KEY` | ключ для парсинга через Claude |
| `TELEGRAM_PARSE_MODEL` (опц.) | id модели Anthropic (актуальный, не хардкод) |

## 14. Порядок разработки (по кросс-чеклисту CLAUDE.md)

1. Убедиться, что фича «Менеджеры» смёржена и перебазирована на async-libSQL `master`.
2. `src/lib/db.ts` — `SCHEMA` += `tg_drafts`, `tg_updates`.
3. `src/types.ts` — `TgDraft`, `ParsedRequest`.
4. `src/lib/validate.ts` — `parsedRequest`, разбор суммы.
5. `src/lib/repo.ts` — CRUD черновиков, дедуп, `findManagerByTelegram`.
6. `src/lib/telegram/*` — `types.ts` → `client.ts` → `parse.ts` → `manager.ts` → `dispatch.ts`.
7. `src/app/api/telegram/route.ts`.
8. `src/proxy.ts` (PUBLIC_PATHS), `.env.example`, `DEPLOY.md`, `package.json`.
9. Регистрация вебхука (см. §10).

## 15. Верификация (E2E; тест-фреймворка нет — `curl` по `next dev`)

Поднять `next dev`, задать env (owner = свой chat, реальный `TELEGRAM_BOT_TOKEN`
или мок клиента на этапе логики). Заранее завести в `managers` строку с известным
`telegram`-ником.

- **(a) Форвард от известного ника** → строка в `tg_drafts` со статусом
  `awaiting_service`/`awaiting_confirmation`, `manager_id` определён, `amount`
  = `9200000000` (micro для 9200), `comment` содержит рапиру/кукойн.
- **(b) Дедуп** — тот же `update_id` повторно → 200, второго черновика нет.
- **(c) Confirm** — callback `confirm:<draftId>` (при `message.message_id ==
  prompt_message_id`) → новая строка в `debts` с корректным `manager_id`,
  `source_text` = оригинал; черновик `status=done`.
- **(d) Уточнение суммы** — форвард без числа → `awaiting_amount`; текст-ответ
  «10100 теза» с `reply_to_message.message_id = prompt` → `amount` записан.
- **(e) Неизвестный ник** — форвард → `awaiting_manager`, выбор из `listManagers()`
  кнопкой; затем выбор `service` кнопкой.
- **(f) Негатив безопасности** — без/с неверным секрет-заголовком → 200, в БД
  ничего не меняется; `chat.id` ≠ owner → игнор.

Пример тела запроса (форвард):

```bash
curl -X POST localhost:3000/api/telegram \
  -H "X-Telegram-Bot-Api-Secret-Token: <secret>" \
  -H "Content-Type: application/json" \
  -d '{"update_id":1001,"message":{"message_id":10,"chat":{"id":<owner>},
        "from":{"id":<owner>},"text":"Пришли пожалуйста на рапиру 9200 тез\nВерну с кукойн",
        "forward_origin":{"type":"user","sender_user":{"id":555,"username":"ivan_mgr"}}}}'
```

## 16. Риски и открытые вопросы

- **Зависимость от фичи «Менеджеры»** — блокирующая: нужны таблица `managers`
  (с `telegram`) и `debts.manager_id`. Реализовывать только после её мержа;
  согласовать сигнатуру `createDebt` (`manager_id`).
- **Длительность функции Vercel** — синхронный LLM-парс в вебхуке может упереться
  в лимит; обязателен `maxDuration`. Альтернатива (мгновенный 200 + отложенная
  обработка) сложнее на serverless без очереди — на старте не рекомендуется.
- **Форварды без публичного ника** (`hidden_user`, скрытый аккаунт) → всегда
  ручной выбор менеджера.
- **Несколько чисел в тексте** — не угадывать, спрашивать кнопками-кандидатами.
- **Округление сумм** — использовать `decimalToMicro`/`money.ts`-логику, не
  «сырой» `float`.
- **Модель Anthropic** — id и цены брать из актуального справочника, вынести в env.
