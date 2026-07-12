-- Все суммы хранятся как целые micro-USDT (сумма × 1_000_000) для точной сверки.

CREATE TABLE IF NOT EXISTS funds (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,               -- название
  amount     INTEGER NOT NULL DEFAULT 0,     -- сумма (micro-USDT)
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS placements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,               -- название
  amount     INTEGER NOT NULL DEFAULT 0,     -- сумма (micro-USDT)
  place      TEXT,                           -- место / платформа
  address    TEXT,                           -- адрес
  comment    TEXT,                           -- комментарий
  sort_order INTEGER NOT NULL DEFAULT 0,     -- ручной порядок строк
  chain_checked_at TEXT,                     -- когда сумма обновлялась из сети TRON
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  manager      TEXT    NOT NULL,             -- менеджер
  amount       INTEGER NOT NULL DEFAULT 0,   -- сумма (micro-USDT)
  service      TEXT    CHECK (service IS NULL OR service IN ('Lets','Mate','N-Obmen','Currex')), -- необязательно
  placement_id INTEGER,                      -- откуда взял (FK -> placements)
  source_text  TEXT,                         -- свободный текст, если размещение не выбрано
  comment      TEXT,                         -- комментарий
  sort_order   INTEGER NOT NULL DEFAULT 0,   -- ручной порядок строк
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (placement_id) REFERENCES placements(id) ON DELETE SET NULL
);
