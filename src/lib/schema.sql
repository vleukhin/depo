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
  kind       TEXT    NOT NULL DEFAULT 'wallet' CHECK (kind IN ('wallet','exchange')), -- внешний кошелёк или биржа
  place      TEXT,                           -- место / платформа
  address    TEXT,                           -- адрес (только для kind = 'wallet')
  exchange   TEXT    CHECK (exchange IS NULL OR exchange IN ('KuCoin','Bitget')), -- биржа (только для kind = 'exchange')
  exchange_account TEXT CHECK (exchange_account IS NULL OR exchange_account IN ('spot','main')), -- тип счёта на бирже
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
  date         TEXT    NOT NULL DEFAULT (date('now')), -- дата долга (YYYY-MM-DD)
  service      TEXT    CHECK (service IS NULL OR service IN ('Lets','Mate','N-Obmen','Currex')), -- необязательно
  placement_id INTEGER,                      -- откуда взял (FK -> placements)
  source_text  TEXT,                         -- свободный текст, если размещение не выбрано
  comment      TEXT,                         -- комментарий
  sort_order   INTEGER NOT NULL DEFAULT 0,   -- ручной порядок строк
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (placement_id) REFERENCES placements(id) ON DELETE SET NULL
);
