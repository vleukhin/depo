import type { Row } from "@libsql/client";
import { getClient } from "@/lib/db";
import { fromMicro, toMicro } from "@/lib/money";
import { CHAINS } from "@/types";
import type {
  Fund,
  Manager,
  Tag,
  TagColor,
  TagWithUsage,
  Placement,
  Debt,
  Summary,
  Service,
  PlacementKind,
  PlacementIconId,
  Exchange,
  ExchangeAccount,
  TgDraft,
  TgDraftStatus,
  Chain,
  NativeSnapshot,
  DebtsSummary,
  DebtsSummaryRow,
  DepoSnapshot,
  DepoSnapshotDetail,
  TransferDebtRef,
} from "@/types";
import type {
  FundInput,
  ManagerInput,
  TagInput,
  PlacementInput,
  DebtInput,
  SnapshotInput,
} from "@/lib/validate";

// --- Мапперы строк БД (amount в micro-USDT) в доменные типы (amount в USDT) ---
// Явно перечисляем поля, чтобы в JSON не утекали служебные свойства Row из libSQL.
const toFund = (r: Row): Fund => ({
  id: Number(r.id),
  name: String(r.name),
  amount: fromMicro(Number(r.amount)),
  created_at: String(r.created_at),
  updated_at: String(r.updated_at),
});

const toPlacement = (r: Row): Placement => ({
  id: Number(r.id),
  name: String(r.name),
  amount: fromMicro(Number(r.amount)),
  kind: r.kind as PlacementKind,
  chain: (r.chain as Chain | null) ?? "tron",
  address: (r.address as string | null) ?? null,
  exchange: (r.exchange as Exchange | null) ?? null,
  exchange_account: (r.exchange_account as ExchangeAccount | null) ?? null,
  icon: (r.icon as PlacementIconId | null) ?? null,
  comment: (r.comment as string | null) ?? null,
  chain_checked_at: (r.chain_checked_at as string | null) ?? null,
  native_amount: r.native_amount === null ? null : fromMicro(Number(r.native_amount)),
  // Теги догружает withTags отдельным запросом — в строке placements их нет.
  tags: [],
  deleted_at: (r.deleted_at as string | null) ?? null,
  created_at: String(r.created_at),
  updated_at: String(r.updated_at),
});
const toManager = (r: Row): Manager => ({
  id: Number(r.id),
  name: String(r.name),
  telegram: (r.telegram as string | null) ?? null,
  created_at: String(r.created_at),
  updated_at: String(r.updated_at),
});

const toTag = (r: Row): Tag => ({
  id: Number(r.id),
  name: String(r.name),
  color: r.color as TagColor,
  created_at: String(r.created_at),
  updated_at: String(r.updated_at),
});
// usage_count приходит только из TAG_SELECT (в тегах записи этой колонки нет).
const toTagWithUsage = (r: Row): TagWithUsage => ({
  ...toTag(r),
  usage_count: Number(r.usage_count),
});

const toDebt = (r: Row): Debt => ({
  id: Number(r.id),
  manager_id: r.manager_id === null ? null : Number(r.manager_id),
  manager_name: (r.manager_name as string | null) ?? null,
  amount: fromMicro(Number(r.amount)),
  date: String(r.date),
  service: (r.service as Service | null) ?? null,
  placement_id: r.placement_id === null ? null : Number(r.placement_id),
  placement_name: (r.placement_name as string | null) ?? null,
  placement_chain: (r.placement_chain as Chain | null) ?? null,
  source_text: (r.source_text as string | null) ?? null,
  tx_id: (r.tx_id as string | null) ?? null,
  comment: (r.comment as string | null) ?? null,
  deleted_at: (r.deleted_at as string | null) ?? null,
  // Колонка есть только в архивной выборке (DEBT_SELECT_ARCHIVE); в остальных undefined -> null.
  placement_deleted_at: (r.placement_deleted_at as string | null) ?? null,
  created_at: String(r.created_at),
  updated_at: String(r.updated_at),
});

// ================= FUNDS =================
export async function listFunds(): Promise<Fund[]> {
  const db = await getClient();
  const rs = await db.execute("SELECT * FROM funds ORDER BY id DESC");
  return rs.rows.map(toFund);
}
/**
 * Баланс средства по точному названию (регистрозависимо). У `funds.name` нет UNIQUE,
 * поэтому суммируем возможные одноимённые записи; SUM по пустой выборке даёт 0.
 */
export async function getFundAmountByName(name: string): Promise<number> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "SELECT COALESCE(SUM(amount), 0) AS s FROM funds WHERE name = ?",
    args: [name],
  });
  return fromMicro(Number(rs.rows[0].s));
}
export async function createFund(input: FundInput): Promise<Fund> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "INSERT INTO funds (name, amount) VALUES (?, ?)",
    args: [input.name, toMicro(input.amount)],
  });
  const row = await db.execute({
    sql: "SELECT * FROM funds WHERE id = ?",
    args: [Number(rs.lastInsertRowid)],
  });
  return toFund(row.rows[0]);
}
export async function updateFund(id: number, input: FundInput): Promise<Fund | null> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "UPDATE funds SET name = ?, amount = ?, updated_at = datetime('now') WHERE id = ?",
    args: [input.name, toMicro(input.amount), id],
  });
  if (rs.rowsAffected === 0) return null;
  const row = await db.execute({ sql: "SELECT * FROM funds WHERE id = ?", args: [id] });
  return toFund(row.rows[0]);
}
export async function deleteFund(id: number): Promise<boolean> {
  const db = await getClient();
  const rs = await db.execute({ sql: "DELETE FROM funds WHERE id = ?", args: [id] });
  return rs.rowsAffected > 0;
}

// ================= MANAGERS =================
export async function listManagers(): Promise<Manager[]> {
  const db = await getClient();
  const rs = await db.execute("SELECT * FROM managers ORDER BY name COLLATE NOCASE ASC");
  return rs.rows.map(toManager);
}
export async function createManager(input: ManagerInput): Promise<Manager> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "INSERT INTO managers (name, telegram) VALUES (?, ?)",
    args: [input.name, input.telegram],
  });
  const row = await db.execute({
    sql: "SELECT * FROM managers WHERE id = ?",
    args: [Number(rs.lastInsertRowid)],
  });
  return toManager(row.rows[0]);
}
export async function updateManager(id: number, input: ManagerInput): Promise<Manager | null> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "UPDATE managers SET name = ?, telegram = ?, updated_at = datetime('now') WHERE id = ?",
    args: [input.name, input.telegram, id],
  });
  if (rs.rowsAffected === 0) return null;
  const row = await db.execute({ sql: "SELECT * FROM managers WHERE id = ?", args: [id] });
  return toManager(row.rows[0]);
}
export async function deleteManager(id: number): Promise<boolean> {
  const db = await getClient();
  const rs = await db.execute({ sql: "DELETE FROM managers WHERE id = ?", args: [id] });
  return rs.rowsAffected > 0;
}
/** Есть ли долги, ссылающиеся на менеджера (удаление таких запрещено).
 * Архивные долги тоже считаются: они ссылаются на менеджера (FK RESTRICT). */
export async function managerInUse(id: number): Promise<boolean> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "SELECT 1 FROM debts WHERE manager_id = ? LIMIT 1",
    args: [id],
  });
  return rs.rows.length > 0;
}
export async function getManager(id: number): Promise<Manager | null> {
  const db = await getClient();
  const rs = await db.execute({ sql: "SELECT * FROM managers WHERE id = ?", args: [id] });
  return rs.rows[0] ? toManager(rs.rows[0]) : null;
}
/** Ищет менеджера по нику телеграм: регистронезависимо, с/без ведущего @. */
export async function findManagerByTelegram(username: string): Promise<Manager | null> {
  const normalized = username.trim().replace(/^@/, "").toLowerCase();
  if (!normalized) return null;
  const db = await getClient();
  const rs = await db.execute({
    sql: "SELECT * FROM managers WHERE telegram IS NOT NULL AND lower(ltrim(telegram, '@')) = ? LIMIT 1",
    args: [normalized],
  });
  return rs.rows[0] ? toManager(rs.rows[0]) : null;
}

// ================= TAGS =================
// Счётчик использования считает только активные записи (архивные не в счёт).
const TAG_SELECT =
  "SELECT t.*, (SELECT COUNT(*) FROM placement_tags pt JOIN placements p " +
  "ON p.id = pt.placement_id AND p.deleted_at IS NULL WHERE pt.tag_id = t.id) AS usage_count FROM tags t";

// SQLite (и libSQL) складывает регистр только для ASCII: COLLATE NOCASE и lower()
// оставляют «Холодные» и «холодные» разными строками. Названия тегов русские,
// поэтому и сравнение, и сортировка живут в JS.
const byName = (a: Tag, b: Tag) => a.name.localeCompare(b.name, "ru");

export async function listTags(): Promise<TagWithUsage[]> {
  const db = await getClient();
  const rs = await db.execute(TAG_SELECT);
  return rs.rows.map(toTagWithUsage).sort(byName);
}
export async function getTag(id: number): Promise<TagWithUsage | null> {
  const db = await getClient();
  const rs = await db.execute({ sql: `${TAG_SELECT} WHERE t.id = ?`, args: [id] });
  return rs.rows[0] ? toTagWithUsage(rs.rows[0]) : null;
}
export async function createTag(input: TagInput): Promise<TagWithUsage> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "INSERT INTO tags (name, color) VALUES (?, ?)",
    args: [input.name, input.color],
  });
  return (await getTag(Number(rs.lastInsertRowid)))!;
}
export async function updateTag(id: number, input: TagInput): Promise<TagWithUsage | null> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "UPDATE tags SET name = ?, color = ?, updated_at = datetime('now') WHERE id = ?",
    args: [input.name, input.color, id],
  });
  if (rs.rowsAffected === 0) return null;
  return getTag(id);
}
/** Жёсткое удаление: связи с записями снимает ON DELETE CASCADE. */
export async function deleteTag(id: number): Promise<boolean> {
  const db = await getClient();
  const rs = await db.execute({ sql: "DELETE FROM tags WHERE id = ?", args: [id] });
  return rs.rowsAffected > 0;
}
/** Занято ли название другим тегом (без учёта регистра, включая кириллицу). */
export async function tagNameTaken(name: string, exceptId = 0): Promise<boolean> {
  const db = await getClient();
  const rs = await db.execute("SELECT id, name FROM tags");
  const needle = name.toLocaleLowerCase("ru");
  return rs.rows.some(
    (r) => Number(r.id) !== exceptId && String(r.name).toLocaleLowerCase("ru") === needle,
  );
}

/**
 * id записи -> её теги (по алфавиту), одним запросом на весь список. Отдельным
 * запросом, а не JOIN'ом с json_group_array: мапперы здесь намеренно перечисляют
 * поля явно, а список записей заведомо мал.
 */
async function tagsByPlacement(ids: number[]): Promise<Map<number, Tag[]>> {
  const byPlacement = new Map<number, Tag[]>();
  if (ids.length === 0) return byPlacement;
  const db = await getClient();
  const rs = await db.execute({
    sql:
      "SELECT pt.placement_id, t.* FROM placement_tags pt JOIN tags t ON t.id = pt.tag_id " +
      `WHERE pt.placement_id IN (${ids.map(() => "?").join(", ")})`,
    args: ids,
  });
  for (const row of rs.rows) {
    const key = Number(row.placement_id);
    const list = byPlacement.get(key);
    if (list) list.push(toTag(row));
    else byPlacement.set(key, [toTag(row)]);
  }
  for (const list of byPlacement.values()) list.sort(byName);
  return byPlacement;
}

/** Догружает теги к уже отмапленным записям. */
async function withTags(placements: Placement[]): Promise<Placement[]> {
  const byPlacement = await tagsByPlacement(placements.map((p) => p.id));
  for (const p of placements) p.tags = byPlacement.get(p.id) ?? [];
  return placements;
}

/**
 * Переписывает набор тегов записи. Неизвестные id молча отбрасываются: иначе
 * нарушение внешнего ключа всплыло бы англоязычной 500-й.
 */
async function setPlacementTags(placementId: number, tagIds: number[]): Promise<void> {
  const db = await getClient();
  const unique = [...new Set(tagIds)];
  const known = new Set<number>();
  if (unique.length > 0) {
    const rs = await db.execute({
      sql: `SELECT id FROM tags WHERE id IN (${unique.map(() => "?").join(", ")})`,
      args: unique,
    });
    for (const row of rs.rows) known.add(Number(row.id));
  }
  await db.batch(
    [
      { sql: "DELETE FROM placement_tags WHERE placement_id = ?", args: [placementId] },
      ...unique
        .filter((id) => known.has(id))
        .map((tagId) => ({
          sql: "INSERT INTO placement_tags (placement_id, tag_id) VALUES (?, ?)",
          args: [placementId, tagId],
        })),
    ],
    "write",
  );
}

// ================= PLACEMENTS =================
export async function listPlacements(): Promise<Placement[]> {
  const db = await getClient();
  const rs = await db.execute(
    "SELECT * FROM placements WHERE deleted_at IS NULL ORDER BY sort_order ASC, id ASC",
  );
  return withTags(rs.rows.map(toPlacement));
}
/** Удалённые записи свободных средств — для страницы архива, свежеудалённые сверху. */
export async function listDeletedPlacements(): Promise<Placement[]> {
  const db = await getClient();
  const rs = await db.execute(
    "SELECT * FROM placements WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC, id DESC",
  );
  return withTags(rs.rows.map(toPlacement));
}
export async function getPlacement(id: number): Promise<Placement | null> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "SELECT * FROM placements WHERE id = ? AND deleted_at IS NULL",
    args: [id],
  });
  if (!rs.rows[0]) return null;
  return (await withTags([toPlacement(rs.rows[0])]))[0];
}
export async function createPlacement(input: PlacementInput): Promise<Placement> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "INSERT INTO placements (name, amount, kind, chain, address, exchange, exchange_account, icon, comment, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM placements))",
    args: [
      input.name,
      toMicro(input.amount),
      input.kind,
      input.chain,
      input.address,
      input.exchange,
      input.exchange_account,
      input.icon,
      input.comment,
    ],
  });
  const id = Number(rs.lastInsertRowid);
  await setPlacementTags(id, input.tag_ids);
  const row = await db.execute({ sql: "SELECT * FROM placements WHERE id = ?", args: [id] });
  return (await withTags([toPlacement(row.rows[0])]))[0];
}
export async function updatePlacement(
  id: number,
  input: PlacementInput,
): Promise<Placement | null> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "UPDATE placements SET name = ?, amount = ?, kind = ?, chain = ?, address = ?, exchange = ?, exchange_account = ?, icon = ?, comment = ?, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
    args: [
      input.name,
      toMicro(input.amount),
      input.kind,
      input.chain,
      input.address,
      input.exchange,
      input.exchange_account,
      input.icon,
      input.comment,
      id,
    ],
  });
  if (rs.rowsAffected === 0) return null;
  await setPlacementTags(id, input.tag_ids);
  const row = await db.execute({ sql: "SELECT * FROM placements WHERE id = ?", args: [id] });
  return (await withTags([toPlacement(row.rows[0])]))[0];
}
/** Мягкое удаление: запись остаётся в БД и видна на странице архива. */
export async function deletePlacement(id: number): Promise<boolean> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "UPDATE placements SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
    args: [id],
  });
  return rs.rowsAffected > 0;
}
/** Восстановление из архива: запись встаёт в конец видимого списка. */
export async function restorePlacement(id: number): Promise<Placement | null> {
  const db = await getClient();
  const rs = await db.execute({
    sql:
      "UPDATE placements SET deleted_at = NULL, updated_at = datetime('now'), " +
      "sort_order = (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM placements WHERE deleted_at IS NULL) " +
      "WHERE id = ? AND deleted_at IS NOT NULL",
    args: [id],
  });
  if (rs.rowsAffected === 0) return null;
  return getPlacement(id);
}

// ================= DEBTS =================
// Сеть источника берётся подзапросом, а не из JOIN: имя источника скрывается,
// пока запись в архиве, но ссылка на транзакцию должна вести в нужный обозреватель.
const DEBT_FIELDS =
  "d.*, p.name AS placement_name, m.name AS manager_name, " +
  "(SELECT chain FROM placements WHERE id = d.placement_id) AS placement_chain";
// Активные представления: имя источника скрыто, пока запись в архиве (JOIN не матчится).
const DEBT_SELECT =
  `SELECT ${DEBT_FIELDS} FROM debts d ` +
  "LEFT JOIN placements p ON p.id = d.placement_id AND p.deleted_at IS NULL " +
  "LEFT JOIN managers m ON m.id = d.manager_id";
// Архив: имя источника показываем всегда + флаг, что источник сам в архиве.
const DEBT_SELECT_ARCHIVE =
  `SELECT ${DEBT_FIELDS}, p.deleted_at AS placement_deleted_at FROM debts d ` +
  "LEFT JOIN placements p ON p.id = d.placement_id " +
  "LEFT JOIN managers m ON m.id = d.manager_id";

export async function listDebts(): Promise<Debt[]> {
  const db = await getClient();
  const rs = await db.execute(
    `${DEBT_SELECT} WHERE d.deleted_at IS NULL ORDER BY d.sort_order ASC, d.id ASC`,
  );
  return rs.rows.map(toDebt);
}
/** Удалённые долги — для страницы архива, свежеудалённые сверху. */
export async function listDeletedDebts(): Promise<Debt[]> {
  const db = await getClient();
  const rs = await db.execute(
    `${DEBT_SELECT_ARCHIVE} WHERE d.deleted_at IS NOT NULL ORDER BY d.deleted_at DESC, d.id DESC`,
  );
  return rs.rows.map(toDebt);
}
/** Долги (включая удалённые), привязанные к транзакциям: tx_id -> ссылка на долг (для меток в попапе). */
export async function findDebtsByTxIds(txIds: string[]): Promise<Map<string, TransferDebtRef>> {
  if (txIds.length === 0) return new Map();
  const db = await getClient();
  const placeholders = txIds.map(() => "?").join(", ");
  // Удалённые — первыми: при дубле tx_id активный долг перезапишет удалённый в Map.
  const rs = await db.execute({
    sql:
      "SELECT d.tx_id, d.id, d.service, d.deleted_at, m.name AS manager_name FROM debts d " +
      "LEFT JOIN managers m ON m.id = d.manager_id " +
      `WHERE d.tx_id IN (${placeholders}) ` +
      "ORDER BY (d.deleted_at IS NULL) ASC",
    args: txIds,
  });
  return new Map(
    rs.rows.map((r) => [
      String(r.tx_id),
      {
        id: Number(r.id),
        manager_name: (r.manager_name as string | null) ?? null,
        service: (r.service as Service | null) ?? null,
        deleted: r.deleted_at !== null,
      },
    ]),
  );
}
async function getDebt(id: number): Promise<Debt> {
  const db = await getClient();
  const rs = await db.execute({ sql: `${DEBT_SELECT} WHERE d.id = ?`, args: [id] });
  return toDebt(rs.rows[0]);
}
export async function createDebt(input: DebtInput): Promise<Debt> {
  const db = await getClient();
  const rs = await db.execute({
    // Новый долг встаёт в начало видимого списка (сортировка sort_order ASC).
    sql:
      "INSERT INTO debts (manager_id, amount, date, service, placement_id, source_text, tx_id, comment, sort_order) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MIN(sort_order), 0) - 1 FROM debts WHERE deleted_at IS NULL))",
    args: [
      input.manager_id,
      toMicro(input.amount),
      input.date,
      input.service,
      input.placement_id,
      input.source_text,
      input.tx_id,
      input.comment,
    ],
  });
  return getDebt(Number(rs.lastInsertRowid));
}
export async function updateDebt(id: number, input: DebtInput): Promise<Debt | null> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "UPDATE debts SET manager_id = ?, amount = ?, date = ?, service = ?, placement_id = ?, source_text = ?, tx_id = ?, comment = ?, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
    args: [
      input.manager_id,
      toMicro(input.amount),
      input.date,
      input.service,
      input.placement_id,
      input.source_text,
      input.tx_id,
      input.comment,
      id,
    ],
  });
  if (rs.rowsAffected === 0) return null;
  return getDebt(id);
}
/** Мягкое удаление: запись остаётся в БД и видна на странице архива. */
export async function deleteDebt(id: number): Promise<boolean> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "UPDATE debts SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
    args: [id],
  });
  return rs.rowsAffected > 0;
}
/** Восстановление из архива: запись встаёт в конец видимого списка. */
export async function restoreDebt(id: number): Promise<Debt | null> {
  const db = await getClient();
  const rs = await db.execute({
    sql:
      "UPDATE debts SET deleted_at = NULL, updated_at = datetime('now'), " +
      "sort_order = (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM debts WHERE deleted_at IS NULL) " +
      "WHERE id = ? AND deleted_at IS NOT NULL",
    args: [id],
  });
  if (rs.rowsAffected === 0) return null;
  return getDebt(id);
}

// ================= DEBTS SUMMARY =================
const toSummaryRow = (r: Row): DebtsSummaryRow => ({
  name: (r.name as string | null) ?? null,
  amount: fromMicro(Number(r.amount)),
  count: Number(r.count),
});

/** Сводка активных долгов за период [from, to]: суммы по менеджерам и по сервисам
 * + все даты с активными долгами (для подсветки в календаре, без учёта периода). */
export async function getDebtsSummary(from: string, to: string): Promise<DebtsSummary> {
  const db = await getClient();
  const byManager = await db.execute({
    sql:
      "SELECT m.name AS name, SUM(d.amount) AS amount, COUNT(*) AS count FROM debts d " +
      "LEFT JOIN managers m ON m.id = d.manager_id " +
      "WHERE d.deleted_at IS NULL AND d.date BETWEEN ? AND ? " +
      "GROUP BY d.manager_id ORDER BY SUM(d.amount) DESC",
    args: [from, to],
  });
  const byService = await db.execute({
    sql:
      "SELECT d.service AS name, SUM(d.amount) AS amount, COUNT(*) AS count FROM debts d " +
      "WHERE d.deleted_at IS NULL AND d.date BETWEEN ? AND ? " +
      "GROUP BY d.service ORDER BY SUM(d.amount) DESC",
    args: [from, to],
  });
  const totals = await db.execute({
    sql: "SELECT COALESCE(SUM(amount), 0) AS s, COUNT(*) AS c FROM debts WHERE deleted_at IS NULL AND date BETWEEN ? AND ?",
    args: [from, to],
  });
  const dates = await db.execute(
    "SELECT DISTINCT date FROM debts WHERE deleted_at IS NULL ORDER BY date ASC",
  );
  return {
    from,
    to,
    total: fromMicro(Number(totals.rows[0].s)),
    count: Number(totals.rows[0].c),
    by_manager: byManager.rows.map(toSummaryRow),
    by_service: byService.rows.map(toSummaryRow),
    dates: dates.rows.map((r) => String(r.date)),
  };
}

/** Внешние кошельки с адресом — источники переводов для дневной сводки транзакций. */
export async function listWalletPlacementsWithAddress(): Promise<
  { id: number; name: string; chain: Chain; address: string }[]
> {
  const db = await getClient();
  const rs = await db.execute(
    "SELECT id, name, chain, address FROM placements " +
      "WHERE kind = 'wallet' AND address IS NOT NULL AND address != '' AND deleted_at IS NULL " +
      "ORDER BY sort_order ASC, id ASC",
  );
  return rs.rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    chain: (r.chain as Chain | null) ?? "tron",
    address: String(r.address),
  }));
}

// ================= CHAIN / EXCHANGE BALANCE =================
/** Строки свободных средств с адресами — кандидаты на проверку баланса в сети. */
export async function listPlacementsWithAddress(): Promise<
  { id: number; name: string; chain: Chain; address: string }[]
> {
  const db = await getClient();
  const rs = await db.execute(
    "SELECT id, name, chain, address FROM placements WHERE address IS NOT NULL AND address != '' AND deleted_at IS NULL",
  );
  return rs.rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    chain: (r.chain as Chain | null) ?? "tron",
    address: String(r.address),
  }));
}

/** Строки свободных средств на биржах — кандидаты на проверку баланса через API биржи. */
export async function listExchangePlacements(): Promise<
  {
    id: number;
    name: string;
    chain: Chain;
    exchange: Exchange;
    exchange_account: ExchangeAccount;
  }[]
> {
  const db = await getClient();
  const rs = await db.execute(
    "SELECT id, name, chain, exchange, exchange_account FROM placements WHERE kind = 'exchange' AND exchange IS NOT NULL AND exchange_account IS NOT NULL AND deleted_at IS NULL",
  );
  return rs.rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    chain: (r.chain as Chain | null) ?? "tron",
    exchange: r.exchange as Exchange,
    exchange_account: r.exchange_account as ExchangeAccount,
  }));
}

/** Перезаписывает балансы записи (USDT в amount, газ в native_amount) из сети или с биржи. */
export async function updateBalancesFromChain(
  id: number,
  usdtMicro: number,
  nativeMicro: number,
): Promise<void> {
  const db = await getClient();
  await db.execute({
    sql: "UPDATE placements SET amount = ?, native_amount = ?, chain_checked_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
    args: [usdtMicro, nativeMicro, id],
  });
}

// ================= REORDER =================
/** Перезаписывает sort_order по позиции id в массиве (атомарной пачкой). */
async function reorder(table: "placements" | "debts", ids: number[]): Promise<void> {
  const db = await getClient();
  await db.batch(
    ids.map((id, index) => ({
      // Guard по deleted_at: устаревший клиент с архивным id не трогает архив.
      sql: `UPDATE ${table} SET sort_order = ? WHERE id = ? AND deleted_at IS NULL`,
      args: [index, id],
    })),
    "write",
  );
}
export function reorderPlacements(ids: number[]): Promise<void> {
  return reorder("placements", ids);
}
export function reorderDebts(ids: number[]): Promise<void> {
  return reorder("debts", ids);
}

// ================= SUMMARY =================
/** Пустая разбивка по сетям — база, на которую ложатся суммы из GROUP BY. */
const zeroByChain = (): Record<Chain, number> =>
  Object.fromEntries(CHAINS.map((c) => [c, 0])) as Record<Chain, number>;

export async function getSummary(): Promise<Summary> {
  const db = await getClient();
  const one = async (table: string, activeOnly = false): Promise<number> => {
    const rs = await db.execute(
      `SELECT COALESCE(SUM(amount), 0) AS s FROM ${table}${activeOnly ? " WHERE deleted_at IS NULL" : ""}`,
    );
    return Number(rs.rows[0].s);
  };
  // Сверка в micro-единицах: свободные средства + долги против депо.
  // diff > 0 — избыток, diff < 0 — недостача. Архивные записи в сверку не входят.
  const funds = await one("funds");
  const placements = await one("placements", true);
  const debts = await one("debts", true);
  // Газ информационный, в сверку не входит (SUM пропускает NULL непроверенных строк).
  const native = await db.execute(
    "SELECT chain, COALESCE(SUM(native_amount), 0) AS s FROM placements WHERE deleted_at IS NULL GROUP BY chain",
  );
  const totalNative = zeroByChain();
  for (const row of native.rows) {
    const chain = String(row.chain) as Chain;
    if (chain in totalNative) totalNative[chain] = fromMicro(Number(row.s));
  }
  const diff = placements + debts - funds;
  return {
    total_funds: fromMicro(funds),
    total_placements: fromMicro(placements),
    total_debts: fromMicro(debts),
    total_native: totalNative,
    diff: fromMicro(diff),
    balanced: diff === 0,
  };
}

// ================= СНИМКИ ГАЗА =================
const toNativeSnapshot = (r: Row): NativeSnapshot => ({
  date: String(r.date),
  amount: fromMicro(Number(r.amount)),
});

/** Апсертит снимки за сегодня (по МСК): сумма native_amount активных записей каждой сети. */
export async function upsertTodayNativeSnapshots(): Promise<void> {
  const db = await getClient();
  await db.batch(
    CHAINS.map((chain) => ({
      sql:
        "INSERT INTO native_snapshots (date, chain, amount) " +
        "VALUES (date(datetime('now','+3 hours')), ?, " +
        "(SELECT COALESCE(SUM(native_amount), 0) FROM placements WHERE deleted_at IS NULL AND chain = ?)) " +
        "ON CONFLICT(date, chain) DO UPDATE SET amount = excluded.amount, updated_at = datetime('now')",
      args: [chain, chain],
    })),
    "write",
  );
}

/** Снимки одной сети за последние N дней (по МСК), по возрастанию даты. */
export async function listNativeSnapshots(chain: Chain, days: number): Promise<NativeSnapshot[]> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "SELECT date, amount FROM native_snapshots WHERE chain = ? AND date >= date(datetime('now','+3 hours'), ?) ORDER BY date ASC",
    args: [chain, `-${days - 1} days`],
  });
  return rs.rows.map(toNativeSnapshot);
}

// ================= DEPO SNAPSHOTS =================
/** JSON-итоги газа из снимка (micro) -> десятичная разбивка по сетям. */
function parseTotalNative(value: unknown): Record<Chain, number> {
  const totals = zeroByChain();
  if (typeof value !== "string") return totals;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    for (const chain of CHAINS) {
      const micro = parsed[chain];
      if (typeof micro === "number") totals[chain] = fromMicro(micro);
    }
  } catch {
    // повреждённый JSON не должен ронять список снимков
  }
  return totals;
}

const toDepoSnapshot = (r: Row): DepoSnapshot => {
  const funds = Number(r.total_funds);
  const placements = Number(r.total_placements);
  const debts = Number(r.total_debts);
  const diff = placements + debts - funds;
  return {
    id: Number(r.id),
    comment: (r.comment as string | null) ?? null,
    total_funds: fromMicro(funds),
    total_placements: fromMicro(placements),
    total_debts: fromMicro(debts),
    total_native: parseTotalNative(r.total_native),
    diff: fromMicro(diff),
    balanced: diff === 0,
    created_at: String(r.created_at),
  };
};

/** Создаёт снимок текущего состояния депо: итоги + замороженные копии всех блоков. */
export async function createDepoSnapshot(input: SnapshotInput): Promise<DepoSnapshotDetail> {
  // В снимок входят активные записи — ровно то, что пользователь видит на дашборде.
  const [funds, placements, debts] = await Promise.all([
    listFunds(),
    listPlacements(),
    listDebts(),
  ]);
  // Итоги считаем по тем же строкам, что уходят в data, — снимок внутренне согласован.
  const sum = (rows: { amount: number }[]) => rows.reduce((s, r) => s + toMicro(r.amount), 0);
  const totalNative = zeroByChain();
  for (const p of placements) {
    if (p.native_amount !== null) totalNative[p.chain] += toMicro(p.native_amount);
  }
  const db = await getClient();
  const rs = await db.execute({
    sql: "INSERT INTO depo_snapshots (comment, total_funds, total_placements, total_debts, total_native, data) VALUES (?, ?, ?, ?, ?, ?)",
    args: [
      input.comment,
      sum(funds),
      sum(placements),
      sum(debts),
      JSON.stringify(totalNative),
      JSON.stringify({ funds, placements, debts }),
    ],
  });
  return (await getDepoSnapshot(Number(rs.lastInsertRowid)))!;
}

/** Список снимков без содержимого блоков (data не читается), свежие сверху. */
export async function listDepoSnapshots(): Promise<DepoSnapshot[]> {
  const db = await getClient();
  const rs = await db.execute(
    "SELECT id, comment, total_funds, total_placements, total_debts, total_native, created_at FROM depo_snapshots ORDER BY id DESC",
  );
  return rs.rows.map(toDepoSnapshot);
}

/** Полный снимок с замороженными копиями блоков. */
export async function getDepoSnapshot(id: number): Promise<DepoSnapshotDetail | null> {
  const db = await getClient();
  const rs = await db.execute({ sql: "SELECT * FROM depo_snapshots WHERE id = ?", args: [id] });
  const row = rs.rows[0];
  if (!row) return null;
  const data = JSON.parse(String(row.data)) as Pick<
    DepoSnapshotDetail,
    "funds" | "placements" | "debts"
  >;
  // Снимки, снятые до поддержки нескольких сетей: у записей нет chain, а
  // нативный баланс лежал в trx_amount. Достраиваем, чтобы старые снимки открывались.
  const placements = data.placements.map((p) => {
    const legacy = p as Placement & { trx_amount?: number | null };
    return {
      ...p,
      chain: p.chain ?? "tron",
      native_amount: p.native_amount ?? legacy.trx_amount ?? null,
    };
  });
  return { ...toDepoSnapshot(row), ...data, placements };
}

/** Снимки удаляются жёстко: это независимые копии, архив им не нужен. */
export async function deleteDepoSnapshot(id: number): Promise<boolean> {
  const db = await getClient();
  const rs = await db.execute({ sql: "DELETE FROM depo_snapshots WHERE id = ?", args: [id] });
  return rs.rowsAffected > 0;
}

// ================= TELEGRAM: ДЕДУП И ЧЕРНОВИКИ =================
const toTgDraft = (r: Row): TgDraft => ({
  id: Number(r.id),
  chat_id: Number(r.chat_id),
  status: r.status as TgDraftStatus,
  source_text: (r.source_text as string | null) ?? null,
  amount: r.amount === null ? null : fromMicro(Number(r.amount)),
  manager_id: r.manager_id === null ? null : Number(r.manager_id),
  manager_name: (r.manager_name as string | null) ?? null,
  sender_username: (r.sender_username as string | null) ?? null,
  destination: (r.destination as string | null) ?? null,
  repay_source: (r.repay_source as string | null) ?? null,
  service: (r.service as Service | null) ?? null,
  comment: (r.comment as string | null) ?? null,
  prompt_message_id: r.prompt_message_id === null ? null : Number(r.prompt_message_id),
  confidence: (r.confidence as "high" | "low" | null) ?? null,
  created_at: String(r.created_at),
  updated_at: String(r.updated_at),
});

/** INSERT OR IGNORE по update_id: true — свежий update, false — уже обрабатывали. */
export async function markTgUpdateProcessed(updateId: number): Promise<boolean> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "INSERT OR IGNORE INTO tg_updates (update_id) VALUES (?)",
    args: [updateId],
  });
  return rs.rowsAffected > 0;
}

export interface TgDraftInput {
  chat_id: number;
  status: TgDraftStatus;
  source_text: string | null;
  amount: number | null; // десятичные USDT
  manager_id: number | null;
  manager_name: string | null;
  sender_username: string | null;
  destination: string | null;
  repay_source: string | null;
  service: Service | null;
  comment: string | null;
  confidence: "high" | "low" | null;
}

export async function createTgDraft(input: TgDraftInput): Promise<TgDraft> {
  const db = await getClient();
  const rs = await db.execute({
    sql:
      "INSERT INTO tg_drafts (chat_id, status, source_text, amount, manager_id, manager_name, " +
      "sender_username, destination, repay_source, service, comment, confidence) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args: [
      input.chat_id,
      input.status,
      input.source_text,
      input.amount === null ? null : toMicro(input.amount),
      input.manager_id,
      input.manager_name,
      input.sender_username,
      input.destination,
      input.repay_source,
      input.service,
      input.comment,
      input.confidence,
    ],
  });
  return (await getTgDraft(Number(rs.lastInsertRowid)))!;
}

export async function getTgDraft(id: number): Promise<TgDraft | null> {
  const db = await getClient();
  const rs = await db.execute({ sql: "SELECT * FROM tg_drafts WHERE id = ?", args: [id] });
  return rs.rows[0] ? toTgDraft(rs.rows[0]) : null;
}

/** Черновик, чей последний вопрос бота — сообщение messageId (для reply-уточнений). */
export async function getTgDraftByPrompt(
  chatId: number,
  messageId: number,
): Promise<TgDraft | null> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "SELECT * FROM tg_drafts WHERE chat_id = ? AND prompt_message_id = ? ORDER BY id DESC LIMIT 1",
    args: [chatId, messageId],
  });
  return rs.rows[0] ? toTgDraft(rs.rows[0]) : null;
}

/** Самый свежий незавершённый черновик чата (фолбэк, когда ответ не reply). */
export async function getLatestAwaitingTgDraft(chatId: number): Promise<TgDraft | null> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "SELECT * FROM tg_drafts WHERE chat_id = ? AND status LIKE 'awaiting_%' ORDER BY id DESC LIMIT 1",
    args: [chatId],
  });
  return rs.rows[0] ? toTgDraft(rs.rows[0]) : null;
}

/** Частичное обновление черновика: пишутся только переданные поля. */
export interface TgDraftPatch {
  status?: TgDraftStatus;
  amount?: number | null; // десятичные USDT
  manager_id?: number | null;
  manager_name?: string | null;
  service?: Service | null;
  comment?: string | null;
  prompt_message_id?: number | null;
}

export async function updateTgDraft(id: number, patch: TgDraftPatch): Promise<TgDraft | null> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (patch.status !== undefined) {
    sets.push("status = ?");
    args.push(patch.status);
  }
  if (patch.amount !== undefined) {
    sets.push("amount = ?");
    args.push(patch.amount === null ? null : toMicro(patch.amount));
  }
  if (patch.manager_id !== undefined) {
    sets.push("manager_id = ?");
    args.push(patch.manager_id);
  }
  if (patch.manager_name !== undefined) {
    sets.push("manager_name = ?");
    args.push(patch.manager_name);
  }
  if (patch.service !== undefined) {
    sets.push("service = ?");
    args.push(patch.service);
  }
  if (patch.comment !== undefined) {
    sets.push("comment = ?");
    args.push(patch.comment);
  }
  if (patch.prompt_message_id !== undefined) {
    sets.push("prompt_message_id = ?");
    args.push(patch.prompt_message_id);
  }
  if (sets.length === 0) return getTgDraft(id);
  sets.push("updated_at = datetime('now')");
  const db = await getClient();
  await db.execute({
    sql: `UPDATE tg_drafts SET ${sets.join(", ")} WHERE id = ?`,
    args: [...args, id],
  });
  return getTgDraft(id);
}
