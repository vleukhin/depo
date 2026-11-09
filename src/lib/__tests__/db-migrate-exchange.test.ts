import { createClient, type Client } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CHAINS } from "@/types";

// Пересборка placements с устаревшим CHECK по биржам и иконкам (добавление Bybit).
// БД заводится в форме прода «до Bybit»: CHECK по сетям уже актуален, а колонки
// exchange и icon добавлялись через ALTER со старыми списками. Затем её открывает
// getClient(), который гоняет SCHEMA и migrate().

const CHAIN_CHECK = `CHECK (chain IN (${CHAINS.map((c) => `'${c}'`).join(",")}))`;

const OLD_SCHEMA = `
CREATE TABLE placements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'wallet' CHECK (kind IN ('wallet','exchange')),
  chain TEXT NOT NULL DEFAULT 'tron' ${CHAIN_CHECK},
  address TEXT,
  comment TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  chain_checked_at TEXT,
  native_amount INTEGER,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE placements ADD COLUMN exchange TEXT CHECK (exchange IS NULL OR exchange IN ('KuCoin','Bitget'));
ALTER TABLE placements ADD COLUMN exchange_account TEXT CHECK (exchange_account IS NULL OR exchange_account IN ('spot','main'));
ALTER TABLE placements ADD COLUMN icon TEXT CHECK (icon IS NULL OR icon IN ('kucoin','bitget','onekey','tangem'));
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
INSERT INTO placements (id, name, amount, kind, chain, exchange, exchange_account, icon, sort_order) VALUES
  (1, 'Bitget спот', 7000000, 'exchange', 'tron', 'Bitget', 'spot', 'bitget', 1),
  (3, 'Кошелёк', 1000000, 'wallet', 'arbitrum', NULL, NULL, 'onekey', 2);
UPDATE sqlite_sequence SET seq = 4 WHERE name = 'placements';
INSERT INTO tags (id, name) VALUES (1, 'Основной');
INSERT INTO placement_tags (placement_id, tag_id) VALUES (1, 1);
INSERT INTO debts (id, amount, placement_id) VALUES (1, 500000, 3);
`;

let dir: string;
let db: Client;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "depo-migrate-exchange-"));
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

describe("миграция CHECK по биржам и иконкам", () => {
  it("принимает биржу Bybit и иконку bybit", async () => {
    await db.execute(
      "INSERT INTO placements (name, kind, chain, exchange, exchange_account, icon) " +
        "VALUES ('Bybit фандинг', 'exchange', 'tron', 'Bybit', 'main', 'bybit')",
    );
    expect(await scalar("SELECT id FROM placements WHERE exchange = 'Bybit'")).toBe(5);
  });

  it("по-прежнему отвергает неизвестные биржу и иконку", async () => {
    await expect(
      db.execute("INSERT INTO placements (name, kind, exchange) VALUES ('x', 'exchange', 'Binance')"),
    ).rejects.toThrow(/CHECK/);
    await expect(db.execute("INSERT INTO placements (name, icon) VALUES ('x', 'binance')")).rejects.toThrow(
      /CHECK/,
    );
  });

  it("сохраняет строки, теги и привязку долгов", async () => {
    const rows = await db.execute(
      "SELECT id, exchange, exchange_account, icon, amount FROM placements WHERE id <= 3 ORDER BY id",
    );
    expect(rows.rows.map((r) => [r.id, r.exchange, r.exchange_account, r.icon, r.amount])).toEqual([
      [1, "Bitget", "spot", "bitget", 7000000],
      [3, null, null, "onekey", 1000000],
    ]);
    expect(await scalar("SELECT count(*) FROM placement_tags")).toBe(1);
    expect(await scalar("SELECT placement_id FROM debts WHERE id = 1")).toBe(3);
  });

  it("оставляет внешние ключи включёнными и целыми", async () => {
    expect(await scalar("PRAGMA foreign_keys")).toBe(1);
    expect((await db.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);
    expect(await scalar("SELECT count(*) FROM sqlite_master WHERE name LIKE '%__rebuild'")).toBe(0);
  });
});
