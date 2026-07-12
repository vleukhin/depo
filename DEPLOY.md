# Деплой на Vercel + Turso

Приложение хранит данные в SQLite. На Vercel (serverless, эфемерная ФС) локальный файл
не годится, поэтому в проде БД живёт в **Turso** (libSQL — тот же SQLite, но по сети).
Код уже это поддерживает: если заданы `TURSO_DATABASE_URL` и `TURSO_AUTH_TOKEN` — приложение
идёт в Turso; если нет — использует локальный файл (`data/depo.db`) для разработки.

Всё ниже вы делаете сами — регистрацию и ввод секретов за вас никто не сделает.

---

## 1. Turso: создать БД и перенести данные

**Установить CLI** (macOS):

```bash
brew install tursodatabase/tap/turso
# или: curl -sSfL https://tur.so/install.sh | bash
```

**Войти / зарегистрироваться** (откроется браузер):

```bash
turso auth signup     # первый раз; потом turso auth login
```

**Создать БД сразу с текущими данными.** Turso умеет импортировать готовый SQLite-файл —
это перенесёт всё депо (средства, размещения, долги) как есть:

```bash
turso db create depo --from-file data/depo.db
```

> Схема уже в актуальном виде (поле «место» удалено, биржевые колонки добавлены),
> так что импортируется корректная структура. Догоняющие миграции приложение при
> старте проверит идемпотентно — ничего не сломают.

**Получить URL и токен** (это и есть две переменные окружения):

```bash
turso db show depo --url          # -> libsql://depo-<ваш-аккаунт>.turso.io  = TURSO_DATABASE_URL
turso db tokens create depo       # -> длинная строка                        = TURSO_AUTH_TOKEN
```

Проверить, что данные на месте:

```bash
turso db shell depo "SELECT name, amount FROM placements;"
```

---

## 2. GitHub: запушить код

Репозиторий уже есть (`origin` = `github.com:vleukhin/depo`). Закоммитьте изменения
этой миграции и запушьте в `master`:

```bash
git add -A
git commit -m "Deploy: migrate DB layer to libSQL/Turso for Vercel"
git push origin master
```

`.env` и `data/` в `.gitignore` — секреты и локальная БД в репозиторий не попадут.

---

## 3. Vercel: импорт и переменные окружения

1. Зайдите на **vercel.com** → **Add New… → Project** → импортируйте репозиторий `vleukhin/depo`.
2. Framework (Next.js) определится сам, build-команда — по умолчанию. Ничего менять не нужно.
3. Откройте **Settings → Environment Variables** и добавьте (scope: Production + Preview):

   | Переменная | Значение |
   | --- | --- |
   | `APP_PASSWORD` | пароль для входа в приложение |
   | `AUTH_SECRET` | случайная строка (`openssl rand -hex 32`) |
   | `TURSO_DATABASE_URL` | из шага 1 (`libsql://…`) |
   | `TURSO_AUTH_TOKEN` | из шага 1 |
   | `TRONGRID_API_KEY` | ключ TronGrid (опционально) |
   | `KUCOIN_API_KEY` / `KUCOIN_API_SECRET` / `KUCOIN_API_PASSPHRASE` | read-only ключ KuCoin |
   | `BITGET_API_KEY` / `BITGET_API_SECRET` / `BITGET_API_PASSPHRASE` | read-only ключ Bitget |

   Значения берите из вашего локального `.env`. **Вводите их только в интерфейсе Vercel**
   (не коммитьте в репозиторий).

4. Нажмите **Deploy**. После сборки откройте выданный URL и войдите по `APP_PASSWORD`.

---

## Регион серверных функций

KuCoin недоступен из США, а Vercel по умолчанию выполняет функции в `iad1` (США). Поэтому
в корне лежит `vercel.json` с `"regions": ["cdg1"]` (Париж) — функции идут из Франции, вне
блокировки. На плане Hobby регион один для всех функций; сменить можно, отредактировав файл
(или в Settings → Functions → Function Region) и передеплоив.

## Telegram-бот для заведения долгов

Бот принимает пересланные сообщения менеджеров, распознаёт сумму и менеджера
(по нику из справочника «Менеджеры») и по подтверждению создаёт запись в «долгах».
Работает через вебхук — long-polling на serverless невозможен.

1. Создайте бота у **@BotFather** (`/newbot`) — получите `TELEGRAM_BOT_TOKEN`.
2. Узнайте свой chat id (например, через **@userinfobot**) — это `TELEGRAM_OWNER_CHAT_ID`.
3. Сгенерируйте секрет вебхука: `openssl rand -hex 32` — это `TELEGRAM_WEBHOOK_SECRET`.
4. Добавьте в переменные Vercel (Settings → Environment Variables):
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_OWNER_CHAT_ID`,
   `ANTHROPIC_API_KEY` (ключ с console.anthropic.com — для LLM-разбора текста;
   без него работает запасной regex-разбор), опционально `TELEGRAM_PARSE_MODEL`.
   Передеплойте, чтобы переменные подхватились.
5. Зарегистрируйте вебхук (один раз, подставьте свои значения):

   ```bash
   curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://<ваш-домен-vercel>/api/telegram",
       "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
       "allowed_updates": ["message", "callback_query"]
     }'
   ```

   Проверить: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`.
6. В приложении, в разделе «Менеджеры», заполните каждому менеджеру поле
   «ник телеграм» — по нему бот определяет, кто берёт в долг, из метаданных
   пересланного сообщения. Форварды от скрытых аккаунтов ник не содержат —
   в этом случае бот предложит выбрать менеджера кнопками.

## Важные замечания

- **IP-ограничения на ключах бирж.** У serverless-функций Vercel исходящие IP динамические.
  Если в KuCoin/Bitget ключ ограничен по «белому списку» IP — проверка балансов на Vercel
  работать не будет. Либо не ставьте IP-ограничение на read-only ключ, либо пускайте
  биржевые запросы через прокси со статичным IP.
- **Локальная разработка.** Держите `TURSO_*` пустыми в локальном `.env` — тогда `npm run dev`
  работает с файлом `data/depo.db` и не трогает прод. Если задать `TURSO_*` локально, dev
  будет писать в боевую Turso-базу.
- **Vercel Hobby** бесплатен для личного использования (этот трекадепо им является).
- **Бэкап Turso:** `turso db shell depo ".dump" > depo-backup.sql` в любой момент.
- **Смена пароля** (`APP_PASSWORD`) в переменных Vercel разлогинивает все сессии — так задумано.
