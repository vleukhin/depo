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
   | `BITGET_API_KEY` / `BITGET_API_SECRET` / `BITGET_API_PASSPHRASE` | ключ Bitget (read-only; для вывода TRX — с правом Withdraw) |
   | `EXCHANGE_PROXY_URL` | опционально — прокси со статическим IP для бирж (см. «Статический IP…» ниже) |
   | `EXCHANGE_PROXY_CA` / `EXCHANGE_PROXY_SERVERNAME` | опционально — для HTTPS-прокси с самоподписанным сертификатом |
   | `CRON_SECRET` | случайная строка (`openssl rand -hex 32`) — авторизация ежедневного снимка TRX (см. «Ежедневный снимок TRX» ниже) |

   Значения берите из вашего локального `.env`. **Вводите их только в интерфейсе Vercel**
   (не коммитьте в репозиторий).

4. Нажмите **Deploy**. После сборки откройте выданный URL и войдите по `APP_PASSWORD`.

---

## Регион серверных функций

KuCoin недоступен из США, а Vercel по умолчанию выполняет функции в `iad1` (США). Поэтому
в корне лежит `vercel.json` с `"regions": ["cdg1"]` (Париж) — функции идут из Франции, вне
блокировки. На плане Hobby регион один для всех функций; сменить можно, отредактировав файл
(или в Settings → Functions → Function Region) и передеплоив.

## Ежедневный снимок TRX (Vercel Cron)

Раз в сутки крон вызывает `GET /api/cron/snapshot`: эндпоинт обновляет балансы всех
размещений из сети/с бирж (как кнопка «Проверить балансы») и сохраняет суммарный TRX
за день в таблицу `trx_snapshots` — по ней строится график «Динамика TRX» на главной.

- Расписание задано в `vercel.json`: `"crons": [{ "path": "/api/cron/snapshot", "schedule": "0 20 * * *" }]`.
  20:00 UTC = 23:00 МСК; на плане Hobby крон может сработать с опозданием до ~часа,
  поэтому время выбрано так, чтобы даже с задержкой запись легла в тот же день по МСК.
  Лимит Hobby — один запуск в сутки.
- Добавьте в Vercel переменную `CRON_SECRET` (см. таблицу выше). Имя зарезервировано
  платформой: Vercel сам шлёт её значение в заголовке `Authorization: Bearer <CRON_SECRET>`
  при вызове крона, а эндпоинт сверяет его (timing-safe) и без совпадения отвечает 401.
- Кроны работают только в **production**-деплое (не в Preview). Проверить вручную:
  `curl -H "Authorization: Bearer <CRON_SECRET>" https://<домен>/api/cron/snapshot`.
- Ручная кнопка «Проверить балансы» тоже перезаписывает сегодняшний снимок —
  последняя запись за день побеждает.

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

## Статический IP для ключей бирж (whitelist)

У serverless-функций Vercel **нет фиксированного исходящего IP** — он меняется между
вызовами, деплоями и регионами, поэтому «узнать IP и вписать в whitelist ключа» не выйдет.
Для read-only проверки балансов проще всего **не ставить** IP-ограничение на ключ. Но
право **Withdraw** на ключе Bitget (нужно для вывода TRX на кошельки из приложения)
IP-allowlist требует. Тогда пускайте биржевые запросы через свой HTTP-прокси со
статическим IP и вписывайте IP прокси в whitelist ключа.

Приложение это уже поддерживает: задайте `EXCHANGE_PROXY_URL` — и **только** запросы к
Bitget/KuCoin пойдут через прокси (TronGrid, Telegram и БД Turso — напрямую, чтобы не
зависеть от аптайма прокси). Не задан — обычный прямой fetch (режим локальной разработки).

Через прокси идут **подписанные** запросы с вашим API-ключом (в т.ч. с правом Withdraw),
поэтому прокси должен быть **вашим**, а не сторонним посредником. Ниже — HTTPS-прокси на
своём VPS: TLS шифрует и пароль прокси в транзите (содержимое запроса к бирже и так в
end-to-end TLS внутри CONNECT-туннеля). Прокси должен быть в регионе, откуда биржа доступна
(KuCoin недоступен из США — см. «Регион серверных функций»).

Схема: `tinyproxy` слушает localhost и требует пароль, а `stunnel` терминирует TLS снаружи
и проксирует поток в tinyproxy. Так undici ходит по `https://…`, а сам tinyproxy TLS не умеет.

### 1. VPS и tinyproxy (только localhost)

```bash
sudo apt update && sudo apt install -y tinyproxy stunnel4
```

В `/etc/tinyproxy/tinyproxy.conf`:

```conf
Port 8888
Listen 127.0.0.1                 # только локально — наружу торчит stunnel, не tinyproxy
BasicAuth depo ДЛИННЫЙ_ПАРОЛЬ    # openssl rand -hex 24
ConnectPort 443                  # CONNECT только на 443; уберите строки про 563
# закомментируйте все `Allow ...` — IP Vercel динамические, доступ гейтит пароль
```

```bash
sudo systemctl enable --now tinyproxy
```

### 2. Самоподписанный сертификат (IP + DNS-метка в SAN)

Домена нет, поэтому сертификат самоподписанный. В SAN кладём **и** IP VPS, **и** DNS-метку
(`depo-proxy`): по этой метке приложение проверяет TLS, т.к. undici не умеет ставить SNI на
голый IP.

```bash
sudo openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout /etc/stunnel/proxy-key.pem -out /etc/stunnel/proxy-cert.pem \
  -subj "/CN=depo-proxy" \
  -addext "subjectAltName=DNS:depo-proxy,IP:IP_ВПС"
sudo chmod 600 /etc/stunnel/proxy-key.pem
```

### 3. stunnel: TLS снаружи → tinyproxy на localhost

`/etc/stunnel/stunnel.conf`:

```ini
[https-proxy]
accept  = 0.0.0.0:8443
connect = 127.0.0.1:8888
cert    = /etc/stunnel/proxy-cert.pem
key     = /etc/stunnel/proxy-key.pem
```

```bash
sudo sed -i 's/^ENABLED=0/ENABLED=1/' /etc/default/stunnel4   # включить автозапуск
sudo systemctl enable --now stunnel4
```

Файрвол — наружу только SSH и порт stunnel:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 8443/tcp && sudo ufw enable
```

### 4. Проверка (со своего ноутбука)

```bash
# через прокси (метка depo-proxy резолвится в IP через --resolve) -> JSON времени Bitget:
curl --proxy https://depo:ПАРОЛЬ@depo-proxy:8443 \
     --proxy-cacert proxy-cert.pem \
     --resolve depo-proxy:8443:IP_ВПС \
     https://api.bitget.com/api/v2/public/time
```

(`proxy-cert.pem` — скопируйте с VPS.) Успех = JSON, а не ошибка TLS/407.

### 5. Переменные в Vercel и whitelist

В Vercel (Settings → Environment Variables), scope Production + Preview:

| Переменная | Значение |
| --- | --- |
| `EXCHANGE_PROXY_URL` | `https://depo:ПАРОЛЬ@IP_ВПС:8443` (в URL — именно IP) |
| `EXCHANGE_PROXY_CA` | содержимое `proxy-cert.pem` (можно одной строкой, заменив переносы на `\n`) |
| `EXCHANGE_PROXY_SERVERNAME` | `depo-proxy` (DNS-метка из SAN сертификата) |

Передеплойте. Затем впишите **IP_ВПС** в whitelist ключа Bitget (для ключа с правом
Withdraw) и проверьте выводом малой суммы через `withdraw-trx`.

> **Проще, если есть домен.** Направьте A-запись (напр. `proxy.ваш-домен`) на IP VPS,
> получите сертификат Let's Encrypt (`certbot`) — тогда `EXCHANGE_PROXY_CA` и
> `EXCHANGE_PROXY_SERVERNAME` не нужны, а `EXCHANGE_PROXY_URL=https://user:pass@proxy.ваш-домен:8443`.

> **Хардининг.** `fail2ban` от перебора пароля; ограничьте права ключа Bitget минимально
> необходимым; храните секреты только в переменных Vercel.

## Важные замечания

- **IP-ограничения на ключах бирж.** См. раздел «Статический IP для ключей бирж» выше:
  на Vercel исходящие IP динамические, для whitelist используйте `EXCHANGE_PROXY_URL`.
- **Локальная разработка.** Держите `TURSO_*` пустыми в локальном `.env` — тогда `npm run dev`
  работает с файлом `data/depo.db` и не трогает прод. Если задать `TURSO_*` локально, dev
  будет писать в боевую Turso-базу.
- **Vercel Hobby** бесплатен для личного использования (этот трекадепо им является).
- **Бэкап Turso:** `turso db shell depo ".dump" > depo-backup.sql` в любой момент.
- **Смена пароля** (`APP_PASSWORD`) в переменных Vercel разлогинивает все сессии — так задумано.
