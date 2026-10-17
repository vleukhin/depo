import { createClient, type Client } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Пересборка таблиц с устаревшим CHECK по сетям (добавление Arbitrum). Проверяем
// на настоящем SQLite-файле: БД заводится в форме «до Arbitrum», затем её
// открывает getClient(), который гоняет SCHEMA и migrate().

const OLD_CHECK = "CHECK (chain IN ('tron','bsc','ethereum'))";

const OLD_SCHEMA = `
CREATE TABLE placements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'wallet' CHECK (kind IN ('wallet','exchange')),
  address TEXT,
  exchange TEXT,
  exchange_account TEXT,
  icon TEXT,
  comment TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  chain_checked_at TEXT,
  native_amount INTEGER,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Колонка chain в старых БД добавлялась через ALTER — повторяем этот путь.
ALTER TABLE placements ADD COLUMN chain TEXT NOT NULL DEFAULT 'tron' ${OLD_CHECK};
CREATE TABLE managers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  telegram TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manager_id INTEGER,
  amount INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL DEFAULT (date('now')),
  service TEXT,
  placement_id INTEGER,
  source_text TEXT,
  tx_id TEXT,
  comment TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (placement_id) REFERENCES placements(id) ON DELETE SET NULL,
  FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE RESTRICT
);
CREATE TABLE native_snapshots (
  date TEXT NOT NULL,
  chain TEXT NOT NULL ${OLD_CHECK},
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (date, chain)
);
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'violet',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE placement_tags (
  placement_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (placement_id, tag_id),
  FOREIGN KEY (placement_id) REFERENCES placements(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
CREATE TABLE depo_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment TEXT,
  total_funds INTEGER NOT NULL,
  total_placements INTEGER NOT NULL,
  total_debts INTEGER NOT NULL,
  total_native TEXT NOT NULL DEFAULT '{}',
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO placements (id, name, amount, chain, address, sort_order) VALUES
  (1, 'Кошелёк TRON', 1000000, 'tron', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 1),
  (2, 'Кошелёк BSC', 2000000, 'bsc', '0x55d398326f99059fF775485246999027B3197955', 2),
  (5, 'Удалённая', 0, 'ethereum', NULL, 3);
-- Запись с id 9 была жёстко удалена: счётчик AUTOINCREMENT ушёл дальше max(id).
UPDATE sqlite_sequence SET seq = 9 WHERE name = 'placements';
INSERT INTO tags (id, name) VALUES (1, 'Основной');
INSERT INTO placement_tags (placement_id, tag_id) VALUES (1, 1), (2, 1);
INSERT INTO debts (id, amount, placement_id) VALUES (1, 500000, 2);
INSERT INTO native_snapshots (date, chain, amount) VALUES ('2026-10-01', 'tron', 42000000);
`;

let dir: string;
let db: Client;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "depo-migrate-"));
  const path = join(dir, "depo.db");
  const seed = createClient({ url: `file:${path}` });
  await seed.executeMultiple(OLD_SCHEMA);
  seed.close();

  delete process.env.TURSO_DATABASE_URL;
  process.env.DB_PATH = path;
  const { getClient } = await import("@/lib/db");
  db = await getClient();
});

afterAll(() => {
  db?.close();
  rmSync(dir, { recursive: true, force: true });
});

const scalar = async (sql: string) => (await db.execute(sql)).rows[0]?.[0];

describe("миграция CHECK по сетям", () => {
  it("принимает arbitrum в обеих таблицах", async () => {
    await db.execute(
      "INSERT INTO placements (name, chain, address) VALUES ('Кошелёк Arbitrum', 'arbitrum', " +
        "'0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9')",
    );
    await db.execute(
      "INSERT INTO native_snapshots (date, chain, amount) VALUES ('2026-10-01', 'arbitrum', 1500)",
    );
    expect(await scalar("SELECT count(*) FROM native_snapshots")).toBe(2);
  });

  it("по-прежнему отвергает неизвестную сеть", async () => {
    await expect(
      db.execute("INSERT INTO placements (name, chain) VALUES ('x', 'solana')"),
    ).rejects.toThrow(/CHECK/);
  });

  it("сохраняет строки, теги и привязку долгов", async () => {
    const rows = await db.execute("SELECT id, name, amount, chain FROM placements WHERE id <= 5 ORDER BY id");
    expect(rows.rows.map((r) => [r.id, r.chain, r.amount])).toEqual([
      [1, "tron", 1000000],
      [2, "bsc", 2000000],
      [5, "ethereum", 0],
    ]);
    expect(await scalar("SELECT count(*) FROM placement_tags")).toBe(2);
    expect(await scalar("SELECT placement_id FROM debts WHERE id = 1")).toBe(2);
    expect(await scalar("SELECT amount FROM native_snapshots WHERE chain = 'tron'")).toBe(42000000);
  });

  it("не выдаёт повторно id жёстко удалённых записей", async () => {
    // Запись Arbitrum из первого теста получила id после сохранённого счётчика (9).
    expect(await scalar("SELECT id FROM placements WHERE chain = 'arbitrum'")).toBe(10);
  });

  it("оставляет внешние ключи включёнными и целыми", async () => {
    expect(await scalar("PRAGMA foreign_keys")).toBe(1);
    expect((await db.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);
    // FK долгов по-прежнему указывает на placements, а не на временную таблицу.
    const fk = await db.execute("PRAGMA foreign_key_list(debts)");
    expect(fk.rows.map((r) => r.table)).toContain("placements");
    expect(await scalar("SELECT count(*) FROM sqlite_master WHERE name LIKE '%__rebuild'")).toBe(0);
  });
});
