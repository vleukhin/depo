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
}

function dropColumn(db: Database.Database, table: string, column: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) {
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
