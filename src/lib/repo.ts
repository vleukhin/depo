import type { Row } from "@libsql/client";
import { getClient } from "@/lib/db";
import { fromMicro, toMicro } from "@/lib/money";
import type {
  Fund,
  Manager,
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
  TrxSnapshot,
} from "@/types";
import type { FundInput, ManagerInput, PlacementInput, DebtInput } from "@/lib/validate";

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
  address: (r.address as string | null) ?? null,
  exchange: (r.exchange as Exchange | null) ?? null,
  exchange_account: (r.exchange_account as ExchangeAccount | null) ?? null,
  icon: (r.icon as PlacementIconId | null) ?? null,
  comment: (r.comment as string | null) ?? null,
  chain_checked_at: (r.chain_checked_at as string | null) ?? null,
  trx_amount: r.trx_amount === null ? null : fromMicro(Number(r.trx_amount)),
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

const toDebt = (r: Row): Debt => ({
  id: Number(r.id),
  manager_id: r.manager_id === null ? null : Number(r.manager_id),
  manager_name: (r.manager_name as string | null) ?? null,
  amount: fromMicro(Number(r.amount)),
  date: String(r.date),
  service: (r.service as Service | null) ?? null,
  placement_id: r.placement_id === null ? null : Number(r.placement_id),
  placement_name: (r.placement_name as string | null) ?? null,
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

// ================= PLACEMENTS =================
export async function listPlacements(): Promise<Placement[]> {
  const db = await getClient();
  const rs = await db.execute(
    "SELECT * FROM placements WHERE deleted_at IS NULL ORDER BY sort_order ASC, id ASC",
  );
  return rs.rows.map(toPlacement);
}
/** Удалённые размещения — для страницы архива, свежеудалённые сверху. */
export async function listDeletedPlacements(): Promise<Placement[]> {
  const db = await getClient();
  const rs = await db.execute(
    "SELECT * FROM placements WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC, id DESC",
  );
  return rs.rows.map(toPlacement);
}
export async function getPlacement(id: number): Promise<Placement | null> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "SELECT * FROM placements WHERE id = ? AND deleted_at IS NULL",
    args: [id],
  });
  return rs.rows[0] ? toPlacement(rs.rows[0]) : null;
}
export async function createPlacement(input: PlacementInput): Promise<Placement> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "INSERT INTO placements (name, amount, kind, address, exchange, exchange_account, icon, comment, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM placements))",
    args: [
      input.name,
      toMicro(input.amount),
      input.kind,
      input.address,
      input.exchange,
      input.exchange_account,
      input.icon,
      input.comment,
    ],
  });
  const row = await db.execute({
    sql: "SELECT * FROM placements WHERE id = ?",
    args: [Number(rs.lastInsertRowid)],
  });
  return toPlacement(row.rows[0]);
}
export async function updatePlacement(
  id: number,
  input: PlacementInput,
): Promise<Placement | null> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "UPDATE placements SET name = ?, amount = ?, kind = ?, address = ?, exchange = ?, exchange_account = ?, icon = ?, comment = ?, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
    args: [
      input.name,
      toMicro(input.amount),
      input.kind,
      input.address,
      input.exchange,
      input.exchange_account,
      input.icon,
      input.comment,
      id,
    ],
  });
  if (rs.rowsAffected === 0) return null;
  const row = await db.execute({ sql: "SELECT * FROM placements WHERE id = ?", args: [id] });
  return toPlacement(row.rows[0]);
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
const DEBT_FIELDS = "d.*, p.name AS placement_name, m.name AS manager_name";
// Активные представления: имя источника скрыто, пока размещение в архиве (JOIN не матчится).
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
async function getDebt(id: number): Promise<Debt> {
  const db = await getClient();
  const rs = await db.execute({ sql: `${DEBT_SELECT} WHERE d.id = ?`, args: [id] });
  return toDebt(rs.rows[0]);
}
export async function createDebt(input: DebtInput): Promise<Debt> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "INSERT INTO debts (manager_id, amount, date, service, placement_id, source_text, tx_id, comment, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM debts))",
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

// ================= CHAIN / EXCHANGE BALANCE =================
/** Строки размещений с адресами — кандидаты на проверку баланса в сети. */
export async function listPlacementsWithAddress(): Promise<
  { id: number; name: string; address: string }[]
> {
  const db = await getClient();
  const rs = await db.execute(
    "SELECT id, name, address FROM placements WHERE address IS NOT NULL AND address != '' AND deleted_at IS NULL",
  );
  return rs.rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    address: String(r.address),
  }));
}

/** Строки размещений на биржах — кандидаты на проверку баланса через API биржи. */
export async function listExchangePlacements(): Promise<
  { id: number; name: string; exchange: Exchange; exchange_account: ExchangeAccount }[]
> {
  const db = await getClient();
  const rs = await db.execute(
    "SELECT id, name, exchange, exchange_account FROM placements WHERE kind = 'exchange' AND exchange IS NOT NULL AND exchange_account IS NOT NULL AND deleted_at IS NULL",
  );
  return rs.rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    exchange: r.exchange as Exchange,
    exchange_account: r.exchange_account as ExchangeAccount,
  }));
}

/** Перезаписывает балансы размещения (USDT в amount, TRX в trx_amount) из сети или с биржи. */
export async function updateBalancesFromChain(
  id: number,
  usdtMicro: number,
  trxMicro: number,
): Promise<void> {
  const db = await getClient();
  await db.execute({
    sql: "UPDATE placements SET amount = ?, trx_amount = ?, chain_checked_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
    args: [usdtMicro, trxMicro, id],
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
export async function getSummary(): Promise<Summary> {
  const db = await getClient();
  const one = async (table: string, activeOnly = false): Promise<number> => {
    const rs = await db.execute(
      `SELECT COALESCE(SUM(amount), 0) AS s FROM ${table}${activeOnly ? " WHERE deleted_at IS NULL" : ""}`,
    );
    return Number(rs.rows[0].s);
  };
  // Сверка в micro-единицах: размещено + долги против депо.
  // diff > 0 — избыток, diff < 0 — недостача. Архивные записи в сверку не входят.
  const funds = await one("funds");
  const placements = await one("placements", true);
  const debts = await one("debts", true);
  // TRX информационный, в сверку не входит (SUM пропускает NULL непроверенных строк).
  const trx = await db.execute(
    "SELECT COALESCE(SUM(trx_amount), 0) AS s FROM placements WHERE deleted_at IS NULL",
  );
  const diff = placements + debts - funds;
  return {
    total_funds: fromMicro(funds),
    total_placements: fromMicro(placements),
    total_debts: fromMicro(debts),
    total_trx: fromMicro(Number(trx.rows[0].s)),
    diff: fromMicro(diff),
    balanced: diff === 0,
  };
}

// ================= TRX SNAPSHOTS =================
const toTrxSnapshot = (r: Row): TrxSnapshot => ({
  date: String(r.date),
  trx_amount: fromMicro(Number(r.trx_amount)),
});

/** Апсертит снимок за сегодня (по МСК): сумма trx_amount активных размещений. */
export async function upsertTodayTrxSnapshot(): Promise<void> {
  const db = await getClient();
  await db.execute(
    "INSERT INTO trx_snapshots (date, trx_amount) " +
      "VALUES (date(datetime('now','+3 hours')), (SELECT COALESCE(SUM(trx_amount), 0) FROM placements WHERE deleted_at IS NULL)) " +
      "ON CONFLICT(date) DO UPDATE SET trx_amount = excluded.trx_amount, updated_at = datetime('now')",
  );
}

/** Снимки за последние N дней (по МСК), по возрастанию даты. */
export async function listTrxSnapshots(days: number): Promise<TrxSnapshot[]> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "SELECT date, trx_amount FROM trx_snapshots WHERE date >= date(datetime('now','+3 hours'), ?) ORDER BY date ASC",
    args: [`-${days - 1} days`],
  });
  return rs.rows.map(toTrxSnapshot);
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
