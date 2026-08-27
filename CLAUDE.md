# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

«Депо» — a single-user web app for tracking a USDT deposit: funds (средства), placements (**«свободные средства»** in the UI — the code keeps the `placement` naming), debts (долги), and a dashboard that reconciles them (**свободные средства + долги = депо**). One Next.js 16 (App Router) process serves both the UI and the REST API under `/api/*`. All user-facing text, validation messages, API error messages, and most code comments are in Russian — keep it that way.

## Commands

```bash
npm install      # required first; also materializes node_modules/next/dist/docs/ (see AGENTS.md)
npm run dev      # dev server at http://localhost:3000
npm run build    # production build
npm run start    # serve production build
npm run lint     # ESLint (flat config, eslint-config-next core-web-vitals + typescript)
```

There is no test framework configured.

Before running: copy `.env.example` to `.env`. `APP_PASSWORD` is mandatory — without it login is completely closed. `AUTH_SECRET` signs session cookies; `TRONGRID_API_KEY` is optional (raises TronGrid rate limits); `BSC_RPC_URL`/`ETH_RPC_URL` override the default public EVM nodes; `ETHERSCAN_API_KEY` (Etherscan API v2, one key for every EVM chain) is required only for USDT transfer history in BSC/Ethereum; `KUCOIN_*`/`BITGET_*` (key/secret/passphrase) enable exchange balance checks; `EXCHANGE_PROXY_URL` (optional) routes **only** the exchange (Bitget/KuCoin) requests through an HTTP(S) proxy with a static IP so it can be whitelisted on the exchange key (TronGrid/Telegram/DB stay direct); for an HTTPS proxy with a self-signed cert on a bare IP, `EXCHANGE_PROXY_CA` (PEM, pinned) and `EXCHANGE_PROXY_SERVERNAME` (the cert's SAN label — undici can't SNI a bare IP) are also read — see `lib/proxy.ts` and the "Static IP" section in `DEPLOY.md`. **Database**: with `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` set the app uses Turso (prod); unset, it falls back to a local SQLite file at `DB_PATH` (default `data/depo.db`, auto-created, gitignored) — the normal dev setup. See `DEPLOY.md` for the Vercel + Turso deploy.

## Next.js 16 specifics used here

This repo relies on conventions that differ from older Next.js — check `node_modules/next/dist/docs/` before assuming:

- **`src/proxy.ts` replaces `middleware.ts`**: it exports a `proxy(request)` function plus a `config.matcher`. It gates every route except `/login` and `/api/login` — unauthenticated API calls get a 401 JSON response, pages redirect to `/login`.
- **Typed route handler context**: dynamic API routes take `ctx: RouteContext<"/api/funds/[id]">` and `params` is a Promise (`(await ctx.params).id`).
- Every route handler declares `export const runtime = "nodejs"` (required for `@libsql/client` and `node:crypto`).
- `next.config.ts` keeps `@libsql/client` in `serverExternalPackages` — it pulls a native addon (for the local `file:` driver) that must stay external to the server bundle.
- `src/proxy.ts` runs on the **Node.js runtime** (Next 16 default for Proxy) — so `verifySessionToken`'s `node:crypto` works on Vercel without an Edge shim.

## Architecture

Request flow for every entity (funds, placements, debts):

```
features/<entity>/*Section.tsx + *Form.tsx      UI (client components, dialogs, tables)
  → hooks/use<Entity>.ts                        instances of createResourceHooks factory
    → lib/api.ts                                thin fetch wrapper, throws Error with server message
      → app/api/<entity>/route.ts (+[id], +reorder)   REST handlers
        → lib/api-helpers.ts                    handle() / parseBody() / parseId() / notFound()
        → lib/validate.ts                       zod input schemas
          → lib/repo.ts                         ALL SQL lives here (async, @libsql/client)
            → lib/db.ts                         libSQL client (Turso in prod, local file in dev)
```

### Money: micro-USDT everywhere below the API boundary

Amounts are stored as **integer micro-USDT** (USDT × 1 000 000) for exact reconciliation; the API and client work in **decimal USDT**. The conversion (`toMicro`/`fromMicro`, plus `decimalToMicro` for exchange balance strings, from `lib/money.ts`) happens **only in `lib/repo.ts`** — the `to*` row mappers read libSQL `Row`s (micro), domain types in `src/types.ts` are decimal. TRC-20 USDT and TRX both have 6 decimals, so TronGrid balances are already micro and are written to the DB as-is. **EVM breaks that identity**: BEP-20 USDT has 18 decimals (ERC-20 USDT has 6), and BNB/ETH have 18 — `lib/evm.ts` parses those with `BigInt` and scales them via `baseUnitsToMicro(raw, decimals)` (`lib/money.ts`) before any value reaches `Number`.

### Chains (сети)

Свободные средства ведутся в трёх сетях — TRON, BSC, Ethereum. **Одна запись = одна сеть**: колонка `placements.chain` (`DEFAULT 'tron'`, CHECK-констрейнт), она же определяет формат адреса, источник баланса, монету газа и обозреватель. Все параметры сетей — в `lib/chains.ts` (`CHAIN_META`: контракт USDT и его decimals, нативная монета, ссылки обозревателя, имя сети в API Bitget, `evmChainId`). Модуль намеренно **client-safe** (без `node:crypto`), потому что `isChainAddress`/`explorer*Url` нужны и клиентским компонентам; `lib/tron.ts` остаётся серверным.

Нативный баланс («газ») лежит в `placements.native_amount` в micro-единицах **своей** монеты — суммировать между сетями нельзя, поэтому `Summary.total_native`, `depo_snapshots.total_native` и снимки `native_snapshots` разбиты по сетям. У биржевых строк `chain` задаёт, баланс какой монеты тянуть с биржи и какую выводить.

### Database

- **libSQL via `@libsql/client`** (SQLite-compatible). `lib/db.ts` exposes `getClient(): Promise<Client>` — a memoized async init (schema + migrations run once) cached on `globalThis` so dev HMR doesn't re-run it. In prod it connects to **Turso** (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`); with those unset it falls back to a local file (`file:${DB_PATH}` or `data/depo.db`). **All repo functions are `async`** — every route handler `await`s them.
- The schema is an **embedded `SCHEMA` string in `lib/db.ts`** (not a separate `.sql` file, so it survives serverless bundling), applied idempotently via `executeMultiple` (`CREATE TABLE IF NOT EXISTS`).
- **Migrations**: `SCHEMA` only covers fresh databases. Changes to existing databases go into `migrate()` in `lib/db.ts` using the async `ensureColumn`/`dropColumn` helpers. When adding a column, update *both* the `SCHEMA` string and `migrate()`.
- **Tags (теги)**: `tags` (name + `color` from a fixed 10-value palette, CHECK-constrained; the list is mirrored by `TAG_COLORS` in `src/types.ts` and the `--tag-*` CSS vars in `globals.css`) and the join table `placement_tags`, `ON DELETE CASCADE` on **both** FKs — deleting a tag strips it from every placement. Both tables live in `SCHEMA` only: `CREATE TABLE IF NOT EXISTS` is itself the migration, so `migrate()` needs no entry (same precedent as `managers`). `Placement.tags` is **not** a JOIN — `lib/repo.ts` fills it with a second query (`tagsByPlacement`/`withTags`), and `setPlacementTags` rewrites the join rows in one `db.batch`, silently dropping unknown tag ids.
- `debts.placement_id` is a FK to placements with `ON DELETE SET NULL`; debt queries LEFT JOIN to expose `placement_name`. (Turso enforces FKs per the `PRAGMA foreign_keys = ON` set at init; the LEFT JOIN keeps the UI correct even if a stale id lingered.)
- **Soft delete (placements & debts only)**: `DELETE /api/{placements,debts}/[id]` sets `deleted_at` instead of removing the row (funds/managers still hard-delete). Active queries filter `deleted_at IS NULL` — including `getSummary`, balance checks, and gas snapshots. The active debt JOIN adds `AND p.deleted_at IS NULL`, so an archived placement's name disappears from its debts until restored (`placement_id` is kept). Archive pages `/archive/{placements,debts}` list only deleted rows via `GET ?deleted=1` (newest deletions first); `POST /api/<entity>/[id]/restore` un-deletes and appends to the end of the visible sort order.

### API conventions

- Handlers wrap their body in `handle()` from `lib/api-helpers.ts`. Helpers **throw `NextResponse`** for error short-circuits (`notFound()`, `parseId()`, `parseBody()`); `handle()` catches thrown responses and `ZodError`s and turns everything into `{ error: "<русское сообщение>" }` JSON.
- Endpoints: CRUD `GET/POST /api/<entity>`, `PUT/DELETE /api/<entity>/[id]`; `POST /api/{placements,debts}/reorder` (body `{ ids: number[] }` — array position becomes `sort_order`); `GET /api/summary`; снимки депо `GET/POST /api/snapshots`, `GET/DELETE /api/snapshots/[id]` (POST замораживает копию всех блоков в JSON-колонке `data` + итоги в micro-колонках; страницы `/snapshots` и `/snapshots/[id]`); `POST /api/placements/check-balances`; `GET /api/placements/exchange-gas-info?exchange=&chain=` и `POST /api/placements/withdraw-gas` (вывод газа с биржи — сеть и адрес сервер берёт из записи по `placementId`); `GET /api/native-snapshots?chain=<chain>&days=N` (gas history for the dashboard chart); `GET /api/native-prices` (TRX/BNB/ETH rates from Bitget's public tickers, `null` per chain on failure); `GET /api/cron/snapshot` (Vercel Cron: сверка балансов + снимок депо, authenticated by `Authorization: Bearer <CRON_SECRET>` inside the route — the path is in `PUBLIC_PATHS` of `src/proxy.ts`); `GET /api/funds/balance?name=<название>` (внешний read-only эндпоинт: баланс средства по точному названию, `{ amount }` в десятичных USDT, `0` если такого средства нет; authenticated by `Authorization: Bearer <EXTERNAL_API_TOKEN>` inside the route via `verifyBearerToken` from `lib/auth.ts` — the path is in `PUBLIC_PATHS` of `src/proxy.ts`; описан в `openapi.yaml` в корне — при изменении контракта правьте и его); справочник тегов `GET/POST /api/tags`, `PUT/DELETE /api/tags/[id]` (все четыре отдают `TagWithUsage` — тег со счётчиком активных записей; дубль названия → 409); `POST /api/login`, `POST /api/logout`.

### Client conventions

- `hooks/createResourceHooks.ts` generates `useList/useCreate/useUpdate/useDelete/useReorder` per entity. Every mutation invalidates both the entity's list key **and `["summary"]`** so the dashboard reconciliation stays fresh. `useReorder` does an optimistic cache reorder with rollback.
- Forms use react-hook-form + zod resolvers; use `z.input<typeof schema>` types (e.g. `FundFormValues`) for form values since schemas apply transforms.
- shadcn/ui components live in `src/components/ui/` (`components.json`: style `radix-nova`, lucide icons, aliases `@/components`, `@/lib`, `@/hooks`). Row drag-and-drop uses dnd-kit via `components/SortableRows.tsx`.
- Format amounts with `formatUsdt`/`formatUsdtSigned` from `lib/format.ts` (ru-RU locale, no fraction digits).

### Auth

Single password (`APP_PASSWORD`); session is an HMAC-signed `exp.signature` token in an httpOnly cookie (30 days), implemented in `lib/auth.ts`. The signing key is derived from `AUTH_SECRET` + `APP_PASSWORD`, so changing the password invalidates all sessions by design.

### Balance check

The check-balances logic lives in `lib/check-balances.ts` (`checkAllBalances()`), shared by two routes: `POST /api/placements/check-balances` (the UI button) and `GET /api/cron/snapshot` (daily Vercel Cron, 20:00 UTC = 23:00 MSK, see `vercel.json` and `DEPLOY.md`). It iterates placements (wallets by address in their `chain`, exchange rows by KuCoin/Bitget API) and **overwrites** their `amount` with the USDT balance and `native_amount` with the native coin balance via `updateBalancesFromChain` (`chain_checked_at` records when). Gas is informational — shown in its own column, not part of the USDT reconciliation.

Wallet balances are dispatched by chain: TRON goes to `lib/tron.ts`, BSC/Ethereum to `lib/evm.ts` (plain JSON-RPC: `eth_call` with the `balanceOf` selector + `eth_getBalance`, no web3 library). `lib/tron.ts` deliberately calls `balanceOf(address)` on the USDT contract via TronGrid's `triggerconstantcontract` instead of the accounts endpoint — the accounts endpoint returns empty data for unactivated addresses even when they hold USDT. Both clients retry on 429 and pace requests (the TRON pause is shorter when `TRONGRID_API_KEY` is set). Exchange rows read `fetchCoinBalanceMicro(coin, account)` from `lib/{kucoin,bitget}.ts` — USDT plus the native coin of the row's chain.

Transfer history has the same shape: `lib/transfers.ts` is the single entry point and dispatches TRON → TronGrid (`lib/tron.ts`, cursor = `fingerprint`) vs EVM → Etherscan API v2 (`lib/etherscan.ts`, cursor = page number, requires `ETHERSCAN_API_KEY`). `UsdtTransfersPage.next` is an **opaque** cursor.

The cron route additionally calls `createDepoSnapshot({ comment: "Автоснимок" })` after the balance check, so `/snapshots` gets one frozen copy of депо per day (unlike the gas snapshot it is not deduped by date — every run appends a row).

After every run `checkAllBalances()` upserts the day's total-gas snapshot **per chain** into `native_snapshots` (PK `(date, chain)`, date computed in MSK via `date(datetime('now','+3 hours'))`, amount in micro-units of that coin; last write of the day wins). The dashboard chart (`features/dashboard/GasChartCard.tsx`, recharts) reads one chain at a time through `GET /api/native-snapshots?chain=…&days=N` — thousands of TRX and hundredths of ETH share no sensible Y axis, so the card has a chain switcher instead of stacked series. The legacy single-column `trx_snapshots` table survives only as the source of the one-off migration in `migrate()`.

### Tags UI

Теги живут на своей странице `/tags` (`features/tags/TagsManager.tsx` + `TagForm.tsx`) — единый список без пары «таблица/карточки». Чипы рисует `components/TagBadge.tsx` (`TagBadge` / `TagToggle` / `TagColorPicker`; классы цветов перечислены буквально, иначе Tailwind их не соберёт). В `PlacementForm` теги выбираются инлайновыми чипами, а не поповером. Фильтр в `PlacementsSection` **клиентский** (`useMemo`, семантика ИЛИ): серверный сменил бы ключ запроса и сломал оптимистичный `useReorder`, у которого `listKey` жёстко зашит. Пока фильтр активен, перетаскивание выключено через проп `disabled` у `SortableRows`/`SortableRow`/`SortableCard` — `reorder` пишет `sort_order` позицией в массиве и испортил бы порядок на подмножестве.

## Adding a field or entity — the cross-cutting checklist

Changes typically touch, in order: the `SCHEMA` string + `migrate()` in `lib/db.ts` → `src/types.ts` (decimal domain type) → `lib/validate.ts` (zod schema) → `lib/repo.ts` (row mapper + async SQL + micro conversion) → `app/api/.../route.ts` (`await` the repo call) → hooks → the feature's form and section components.
