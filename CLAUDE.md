# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

«Депо» — a single-user web app for tracking a USDT deposit: funds (средства), placements (размещение), debts (долги), and a dashboard that reconciles them (**размещено + долги = депо**). One Next.js 16 (App Router) process serves both the UI and the REST API under `/api/*`. All user-facing text, validation messages, API error messages, and most code comments are in Russian — keep it that way.

## Commands

```bash
npm install      # required first; also materializes node_modules/next/dist/docs/ (see AGENTS.md)
npm run dev      # dev server at http://localhost:3000
npm run build    # production build
npm run start    # serve production build
npm run lint     # ESLint (flat config, eslint-config-next core-web-vitals + typescript)
```

There is no test framework configured.

Before running: copy `.env.example` to `.env`. `APP_PASSWORD` is mandatory — without it login is completely closed. `AUTH_SECRET` signs session cookies; `TRONGRID_API_KEY` is optional (raises TronGrid rate limits); `KUCOIN_*`/`BITGET_*` (key/secret/passphrase) enable exchange balance checks; `EXCHANGE_PROXY_URL` (optional) routes **only** the exchange (Bitget/KuCoin) requests through an HTTP(S) proxy with a static IP so it can be whitelisted on the exchange key (TronGrid/Telegram/DB stay direct); for an HTTPS proxy with a self-signed cert on a bare IP, `EXCHANGE_PROXY_CA` (PEM, pinned) and `EXCHANGE_PROXY_SERVERNAME` (the cert's SAN label — undici can't SNI a bare IP) are also read — see `lib/proxy.ts` and the "Static IP" section in `DEPLOY.md`. **Database**: with `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` set the app uses Turso (prod); unset, it falls back to a local SQLite file at `DB_PATH` (default `data/depo.db`, auto-created, gitignored) — the normal dev setup. See `DEPLOY.md` for the Vercel + Turso deploy.

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

Amounts are stored as **integer micro-USDT** (USDT × 1 000 000) for exact reconciliation; the API and client work in **decimal USDT**. The conversion (`toMicro`/`fromMicro`, plus `decimalToMicro` for exchange balance strings, from `lib/money.ts`) happens **only in `lib/repo.ts`** — the `to*` row mappers read libSQL `Row`s (micro), domain types in `src/types.ts` are decimal. TRC-20 USDT has 6 decimals, so TronGrid balances are already micro and are written to the DB as-is.

### Database

- **libSQL via `@libsql/client`** (SQLite-compatible). `lib/db.ts` exposes `getClient(): Promise<Client>` — a memoized async init (schema + migrations run once) cached on `globalThis` so dev HMR doesn't re-run it. In prod it connects to **Turso** (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`); with those unset it falls back to a local file (`file:${DB_PATH}` or `data/depo.db`). **All repo functions are `async`** — every route handler `await`s them.
- The schema is an **embedded `SCHEMA` string in `lib/db.ts`** (not a separate `.sql` file, so it survives serverless bundling), applied idempotently via `executeMultiple` (`CREATE TABLE IF NOT EXISTS`).
- **Migrations**: `SCHEMA` only covers fresh databases. Changes to existing databases go into `migrate()` in `lib/db.ts` using the async `ensureColumn`/`dropColumn` helpers. When adding a column, update *both* the `SCHEMA` string and `migrate()`.
- `debts.placement_id` is a FK to placements with `ON DELETE SET NULL`; debt queries LEFT JOIN to expose `placement_name`. (Turso enforces FKs per the `PRAGMA foreign_keys = ON` set at init; the LEFT JOIN keeps the UI correct even if a stale id lingered.)

### API conventions

- Handlers wrap their body in `handle()` from `lib/api-helpers.ts`. Helpers **throw `NextResponse`** for error short-circuits (`notFound()`, `parseId()`, `parseBody()`); `handle()` catches thrown responses and `ZodError`s and turns everything into `{ error: "<русское сообщение>" }` JSON.
- Endpoints: CRUD `GET/POST /api/<entity>`, `PUT/DELETE /api/<entity>/[id]`; `POST /api/{placements,debts}/reorder` (body `{ ids: number[] }` — array position becomes `sort_order`); `GET /api/summary`; `POST /api/placements/check-balances`; `GET /api/trx-snapshots?days=N` (TRX history for the dashboard chart); `GET /api/cron/snapshot` (Vercel Cron, authenticated by `Authorization: Bearer <CRON_SECRET>` inside the route — the path is in `PUBLIC_PATHS` of `src/proxy.ts`); `POST /api/login`, `POST /api/logout`.

### Client conventions

- `hooks/createResourceHooks.ts` generates `useList/useCreate/useUpdate/useDelete/useReorder` per entity. Every mutation invalidates both the entity's list key **and `["summary"]`** so the dashboard reconciliation stays fresh. `useReorder` does an optimistic cache reorder with rollback.
- Forms use react-hook-form + zod resolvers; use `z.input<typeof schema>` types (e.g. `FundFormValues`) for form values since schemas apply transforms.
- shadcn/ui components live in `src/components/ui/` (`components.json`: style `radix-nova`, lucide icons, aliases `@/components`, `@/lib`, `@/hooks`). Row drag-and-drop uses dnd-kit via `components/SortableRows.tsx`.
- Format amounts with `formatUsdt`/`formatUsdtSigned` from `lib/format.ts` (ru-RU locale, no fraction digits).

### Auth

Single password (`APP_PASSWORD`); session is an HMAC-signed `exp.signature` token in an httpOnly cookie (30 days), implemented in `lib/auth.ts`. The signing key is derived from `AUTH_SECRET` + `APP_PASSWORD`, so changing the password invalidates all sessions by design.

### TRON balance check

The check-balances logic lives in `lib/check-balances.ts` (`checkAllBalances()`), shared by two routes: `POST /api/placements/check-balances` (the UI button) and `GET /api/cron/snapshot` (daily Vercel Cron, 20:00 UTC = 23:00 MSK, see `vercel.json` and `DEPLOY.md`). It iterates placements (wallets by TRON address, exchange rows by KuCoin/Bitget API) and **overwrites** their `amount` with the USDT balance and `trx_amount` with the native TRX balance via `updateBalancesFromChain` (`chain_checked_at` records when). TRX is informational — shown in its own column, not part of the USDT reconciliation. `lib/tron.ts` deliberately calls `balanceOf(address)` on the USDT contract via TronGrid's `triggerconstantcontract` instead of the accounts endpoint — the accounts endpoint returns empty data for unactivated addresses even when they hold USDT. It retries on 429 and paces requests (shorter pause when `TRONGRID_API_KEY` is set).

After every run `checkAllBalances()` upserts the day's total-TRX snapshot into `trx_snapshots` (date PK computed in MSK via `date(datetime('now','+3 hours'))`, amount in SUN; last write of the day wins). The dashboard chart (`features/dashboard/TrxChartCard.tsx`, recharts) reads it through `GET /api/trx-snapshots?days=N`.

## Adding a field or entity — the cross-cutting checklist

Changes typically touch, in order: the `SCHEMA` string + `migrate()` in `lib/db.ts` → `src/types.ts` (decimal domain type) → `lib/validate.ts` (zod schema) → `lib/repo.ts` (row mapper + async SQL + micro conversion) → `app/api/.../route.ts` (`await` the repo call) → hooks → the feature's form and section components.
