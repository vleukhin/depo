import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

// Singleton через globalThis, чтобы dev-HMR не плодил соединения.
const globalForDb = globalThis as unknown as { __depoDb?: Database.Database };

function createDb(): Database.Database {
  const dbPath = process.env.DB_PATH ?? join(process.cwd(), "data", "depo.db");
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000"); // сериализовать параллельные процессы (напр. воркеры сборки)

  const schema = readFileSync(join(process.cwd(), "src", "lib", "schema.sql"), "utf8");
  db.exec(schema);
  migrate(db);

  return db;
}

/** Догоняющие миграции для существующих БД (schema.sql покрывает только новые). */
function migrate(db: Database.Database) {
  ensureColumn(db, "placements", "sort_order", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "debts", "sort_order", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "placements", "chain_checked_at", "TEXT", { backfillFromId: false });
  dropColumn(db, "placements", "chain_balance"); // колонка из ранней версии, сумма пишется в amount
  // Размещение на бирже: существующие строки — внешние кошельки (kind = 'wallet').
  ensureColumn(
    db,
    "placements",
    "kind",
    "TEXT NOT NULL DEFAULT 'wallet' CHECK (kind IN ('wallet','exchange'))",
    { backfillFromId: false },
  );
  ensureColumn(
    db,
    "placements",
    "exchange",
    "TEXT CHECK (exchange IS NULL OR exchange IN ('KuCoin','Bitget'))",
    { backfillFromId: false },
  );
  ensureColumn(
    db,
    "placements",
    "exchange_account",
    "TEXT CHECK (exchange_account IS NULL OR exchange_account IN ('spot','main'))",
    { backfillFromId: false },
  );
  // Дата долга: существующие строки получают дату создания записи.
  ensureColumn(db, "debts", "date", "TEXT", { backfillFromId: false });
  db.exec("UPDATE debts SET date = date(created_at) WHERE date IS NULL");
  // Справочник менеджеров: таблицу managers создаёт schema.sql до migrate().
  // Колонку manager_id добавляем с column-level FK (SQLite это разрешает при
  // ADD COLUMN, если дефолт колонки NULL) — enforcement одинаков со свежими БД.
  // Всё в одной транзакции: проверка наличия старой колонки и её удаление
  // атомарны, поэтому параллельные процессы (воркеры сборки) не ловят
  // «no such column: manager» из-за гонки check-then-drop.
  db.transaction(() => {
    ensureColumn(db, "debts", "manager_id", "INTEGER REFERENCES managers(id) ON DELETE RESTRICT", {
      backfillFromId: false,
    });
    if (hasColumn(db, "debts", "manager")) {
      // По одному менеджеру на каждое уникальное непустое имя из старых долгов.
      db.exec(
        "INSERT INTO managers (name) SELECT DISTINCT trim(manager) FROM debts d " +
          "WHERE trim(manager) <> '' AND NOT EXISTS (SELECT 1 FROM managers m WHERE m.name = trim(d.manager))",
      );
      db.exec(
        "UPDATE debts SET manager_id = (SELECT m.id FROM managers m WHERE m.name = trim(debts.manager)) " +
          "WHERE manager_id IS NULL AND trim(manager) <> ''",
      );
      dropColumn(db, "debts", "manager"); // старая текстовая колонка больше не нужна
    }
  })();
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

function dropColumn(db: Database.Database, table: string, column: string) {
  if (hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  }
}

function ensureColumn(
  db: Database.Database,
  table: string,
  column: string,
  ddl: string,
  opts: { backfillFromId: boolean } = { backfillFromId: true },
) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    if (opts.backfillFromId) {
      // Существующие строки сохраняют порядок по id.
      db.exec(`UPDATE ${table} SET ${column} = id`);
    }
  }
}

export const db: Database.Database = globalForDb.__depoDb ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__depoDb = db;
}
