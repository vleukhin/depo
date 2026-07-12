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
