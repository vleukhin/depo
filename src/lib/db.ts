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
  // WAL и busy_timeout — настройки локального файлового SQLite; на Turso (libSQL-сервер)
  // эти PRAGMA запрещены и падают с SQL_PARSE_ERROR. Применяем их только к file:-драйверу.
  if (url.startsWith("file:")) {
    await client.execute("PRAGMA journal_mode = WAL");
    await client.execute("PRAGMA busy_timeout = 5000"); // сериализовать параллельные процессы (напр. воркеры сборки)
  }
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
  // Баланс нативного TRX (SUN = micro-TRX), NULL — ещё не проверяли.
  await ensureColumn(db, "placements", "trx_amount", "INTEGER", { backfillFromId: false });
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
  // Иконка размещения (выбирается вручную), NULL — без иконки.
  await ensureColumn(
    db,
    "placements",
    "icon",
    "TEXT CHECK (icon IS NULL OR icon IN ('kucoin','bitget','onekey','tangem'))",
    { backfillFromId: false },
  );
  // Дата долга: существующие строки получают дату создания записи.
  await ensureColumn(db, "debts", "date", "TEXT", { backfillFromId: false });
  await db.execute("UPDATE debts SET date = date(created_at) WHERE date IS NULL");
  // Справочник менеджеров: таблицу managers создаёт SCHEMA (initSchema) до migrate().
  // Колонку manager_id добавляем с column-level FK (SQLite это разрешает при
  // ADD COLUMN, если дефолт колонки NULL) — enforcement одинаков со свежими БД.
  // Гонок нет: инициализация выполняется один раз (промис мемоизирован на globalThis).
  await ensureColumn(db, "debts", "manager_id", "INTEGER REFERENCES managers(id) ON DELETE RESTRICT", {
    backfillFromId: false,
  });
  if ((await columnNames(db, "debts")).has("manager")) {
    // По одному менеджеру на каждое уникальное непустое имя из старых долгов.
    await db.execute(
      "INSERT INTO managers (name) SELECT DISTINCT trim(manager) FROM debts d " +
        "WHERE trim(manager) <> '' AND NOT EXISTS (SELECT 1 FROM managers m WHERE m.name = trim(d.manager))",
    );
    await db.execute(
      "UPDATE debts SET manager_id = (SELECT m.id FROM managers m WHERE m.name = trim(debts.manager)) " +
        "WHERE manager_id IS NULL AND trim(manager) <> ''",
    );
    await dropColumn(db, "debts", "manager"); // старая текстовая колонка больше не нужна
  }
  // Мягкое удаление: NULL — запись активна, иначе UTC-момент удаления.
  await ensureColumn(db, "placements", "deleted_at", "TEXT", { backfillFromId: false });
  await ensureColumn(db, "debts", "deleted_at", "TEXT", { backfillFromId: false });
  // Хэш ончейн-транзакции, если долг заведён из истории кошелька; NULL — вручную.
  await ensureColumn(db, "debts", "tx_id", "TEXT", { backfillFromId: false });
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
  icon       TEXT    CHECK (icon IS NULL OR icon IN ('kucoin','bitget','onekey','tangem')),
  comment    TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  chain_checked_at TEXT,
  trx_amount INTEGER,
  deleted_at TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS managers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  telegram   TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  manager_id   INTEGER,
  amount       INTEGER NOT NULL DEFAULT 0,
  date         TEXT    NOT NULL DEFAULT (date('now')),
  service      TEXT    CHECK (service IS NULL OR service IN ('Lets','Mate','N-Obmen','Currex')),
  placement_id INTEGER,
  source_text  TEXT,
  tx_id        TEXT,
  comment      TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  deleted_at   TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (placement_id) REFERENCES placements(id) ON DELETE SET NULL,
  FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE RESTRICT
);

-- Ежедневные снимки суммарного TRX по всем размещениям. Сумма — SUN (micro-TRX).
-- date — календарный день по МСК (UTC+3 без перехода на летнее время).
CREATE TABLE IF NOT EXISTS trx_snapshots (
  date       TEXT PRIMARY KEY,
  trx_amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Дедупликация обновлений Telegram: вебхук может доставить один update повторно.
CREATE TABLE IF NOT EXISTS tg_updates (
  update_id  INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Черновики долгов из Telegram-бота: состояние диалога между вызовами вебхука
-- (serverless не хранит память между запросами). Суммы — micro-USDT.
CREATE TABLE IF NOT EXISTS tg_drafts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id           INTEGER NOT NULL,
  status            TEXT    NOT NULL CHECK (status IN
    ('awaiting_amount','awaiting_manager','awaiting_service','awaiting_confirmation','done','cancelled')),
  source_text       TEXT,
  amount            INTEGER,
  manager_id        INTEGER,
  manager_name      TEXT,
  sender_username   TEXT,
  destination       TEXT,
  repay_source      TEXT,
  service           TEXT    CHECK (service IS NULL OR service IN ('Lets','Mate','N-Obmen','Currex')),
  comment           TEXT,
  prompt_message_id INTEGER,
  confidence        TEXT    CHECK (confidence IS NULL OR confidence IN ('high','low')),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE SET NULL
);
`;
