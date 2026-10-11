# Runbook: где живёт «Депо» и как проверить, что с ним происходит

Справка для агентов и людей. Подробная инструкция первого деплоя — в `DEPLOY.md`.

## Где что находится

| Что | Где | Как попадает |
| --- | --- | --- |
| Приложение (UI + API) | Vercel, проект из `vleukhin/depo`, регион `cdg1` | автодеплой при пуше в `master` |
| Прод-адрес | https://depo-ivory.vercel.app | — |
| Preview | отдельный URL на каждый PR (ссылка — в статусе деплоя Vercel в PR) | автодеплой при пуше в ветку |
| База данных | Turso (libSQL), база `depo` | схема и миграции применяются приложением при старте (`lib/db.ts`) |
| Ежедневный снимок | Vercel Cron, `GET /api/cron/snapshot`, 20:00 UTC | `vercel.json` |
| Telegram-бот | вебхук `POST /api/telegram` | регистрируется вручную, см. `DEPLOY.md` |
| Прокси для бирж | свой VPS (tinyproxy + stunnel), статический IP в whitelist Bitget | настраивается вручную, см. `DEPLOY.md` |
| Секреты | только Vercel → Settings → Environment Variables | вводит владелец |

Серверов с SSH у самого приложения нет: «зайти на сервер» здесь означает посмотреть
деплой и логи Vercel. VPS с прокси к приложению не относится, агентам доступ туда не нужен.

## Что агент может проверить сам (без секретов)

```bash
# Последние деплои и их статус (Production / Preview)
gh api repos/vleukhin/depo/deployments --jq '.[0:5][] | {id, environment, ref, created_at}'
gh api repos/vleukhin/depo/deployments/<id>/statuses --jq '.[0] | {state, environment_url, log_url}'

# Статусы проверок коммита (CI, Vercel)
gh api repos/vleukhin/depo/commits/<sha>/check-runs --jq '.check_runs[] | {name, conclusion}'

# Прод жив: страница входа 200, API без сессии 401
curl -s -o /dev/null -w '%{http_code}\n' https://depo-ivory.vercel.app/login
curl -s -o /dev/null -w '%{http_code}\n' https://depo-ivory.vercel.app/api/summary
```

После каждого успешного production-деплоя эту же проверку делает воркфлоу
`.github/workflows/smoke.yml`.

## Что видит только владелец

- Runtime-логи функций: Vercel → Project → Logs (или `vercel logs <url>` с его токеном).
- Данные: `turso db shell depo "<SQL>"`. Бэкап: `turso db shell depo ".dump" > depo-backup.sql`.
- Запуск крона вручную: `curl -H "Authorization: Bearer <CRON_SECRET>" https://depo-ivory.vercel.app/api/cron/snapshot`.

Если для диагностики агенту нужны логи или данные — он просит владельца приложить
вывод в задачу, а не просит доступ.

## Чего агенты не делают

- Не получают и не запрашивают `TURSO_AUTH_TOKEN`, ключи бирж, `APP_PASSWORD`,
  `CRON_SECRET`, токен Vercel. В секретах GitHub Actions лежит только токен Claude.
- Не ходят в прод-базу и на биржи. Не вызывают `withdraw-gas` и `rent-energy`.
- Не деплоят вручную и не меняют переменные окружения. Релиз = владелец мержит PR.

## Откат

Vercel → Deployments → предыдущий успешный production-деплой → **Promote to Production**
(или Instant Rollback). Код откатывается мгновенно; **миграции БД не откатываются** —
поэтому в PR с изменением схемы блок «Действия при релизе» обязателен, а перед мержем
стоит снять бэкап Turso.
