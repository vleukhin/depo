import { createClient, type Client } from "@libsql/client";
import { join } from "node:path";

// Клиент libSQL. В проде — Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN),
// в разработке — локальный файл SQLite (file:./data/depo.db).
// Инициализация (схема + миграции) выполняется один раз и мемоизируется:
// храним Promise на globalThis, чтобы dev-HMR не плодил соединения и не гонял миграции.
const globalForDb = globalThis as unknown as { __depoClient?: Promise<Client> };

function resolveUrl(): { url: string; authToken?: string } {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    return { url, authToken: process.env.TURSO_AUTH_TOKEN };
  }
  // Локальный файл: DB_PATH или ./data/depo.db.
  const path = process.env.DB_PATH ?? join(process.cwd(), "data", "depo.db");
  return { url: `file:${path}` };
}

async function createAndInit(): Promise<Client> {
  const { url, authToken } = resolveUrl();
  // intMode "number": суммы в micro-USDT укладываются в безопасный диапазон Number.
  const client = createClient({ url, authToken, intMode: "number" });
  await client.execute("PRAGMA foreign_keys = ON");
  await initSchema(client);
  await migrate(client);
  return client;
}

/** Единая точка доступа к БД: возвращает готовый (инициализированный) клиент. */
export function getClient(): Promise<Client> {
  if (!globalForDb.__depoClient) {
    globalForDb.__depoClient = createAndInit();
  }
  return globalForDb.__depoClient;
}

// Схема идемпотентна (CREATE TABLE IF NOT EXISTS) — покрывает только новые БД.
async function initSchema(db: Client) {
  await db.executeMultiple(SCHEMA);
}

/** Догоняющие миграции для существующих БД (SCHEMA покрывает только новые). */
async function migrate(db: Client) {
  await ensureColumn(db, "placements", "sort_order", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "debts", "sort_order", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "placements", "chain_checked_at", "TEXT", { backfillFromId: false });
  await dropColumn(db, "placements", "chain_balance"); // колонка из ранней версии, сумма пишется в amount
  await dropColumn(db, "placements", "place"); // поле «место / платформа» убрано
  // Размещение на бирже: существующие строки — внешние кошельки (kind = 'wallet').
  await ensureColumn(
    db,
    "placements",
    "kind",
    "TEXT NOT NULL DEFAULT 'wallet' CHECK (kind IN ('wallet','exchange'))",
    { backfillFromId: false },
  );
  await ensureColumn(
    db,
    "placements",
    "exchange",
    "TEXT CHECK (exchange IS NULL OR exchange IN ('KuCoin','Bitget'))",
    { backfillFromId: false },
  );
  await ensureColumn(
    db,
    "placements",
    "exchange_account",
    "TEXT CHECK (exchange_account IS NULL OR exchange_account IN ('spot','main'))",
    { backfillFromId: false },
  );
}

async function columnNames(db: Client, table: string): Promise<Set<string>> {
  const rs = await db.execute(`PRAGMA table_info(${table})`);
  return new Set(rs.rows.map((r) => String(r.name)));
}

async function dropColumn(db: Client, table: string, column: string) {
  if ((await columnNames(db, table)).has(column)) {
    await db.execute(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  }
}

async function ensureColumn(
  db: Client,
  table: string,
  column: string,
  ddl: string,
  opts: { backfillFromId: boolean } = { backfillFromId: true },
) {
  if (!(await columnNames(db, table)).has(column)) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    if (opts.backfillFromId) {
      // Существующие строки сохраняют порядок по id.
      await db.execute(`UPDATE ${table} SET ${column} = id`);
    }
  }
}

// Схема встроена в модуль (а не читается из отдельного .sql-файла), чтобы работать
// в serverless-сборке, где произвольный файл может не попасть в бандл. Суммы — micro-USDT.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS funds (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  amount     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS placements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  amount     INTEGER NOT NULL DEFAULT 0,
  kind       TEXT    NOT NULL DEFAULT 'wallet' CHECK (kind IN ('wallet','exchange')),
  address    TEXT,
  exchange   TEXT    CHECK (exchange IS NULL OR exchange IN ('KuCoin','Bitget')),
  exchange_account TEXT CHECK (exchange_account IS NULL OR exchange_account IN ('spot','main')),
  comment    TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  chain_checked_at TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  manager      TEXT    NOT NULL,
  amount       INTEGER NOT NULL DEFAULT 0,
  service      TEXT    CHECK (service IS NULL OR service IN ('Lets','Mate','N-Obmen','Currex')),
  placement_id INTEGER,
  source_text  TEXT,
  comment      TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (placement_id) REFERENCES placements(id) ON DELETE SET NULL
);
`;
