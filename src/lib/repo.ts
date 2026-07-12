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
  Exchange,
  ExchangeAccount,
} from "@/types";
import type { FundInput, ManagerInput, PlacementInput, DebtInput } from "@/lib/validate";

// --- Внутренние формы строк БД (amount в micro-USDT) ---
interface FundRow {
  id: number;
  name: string;
  amount: number;
  created_at: string;
  updated_at: string;
}
interface PlacementRow extends FundRow {
  kind: PlacementKind;
  place: string | null;
  address: string | null;
  exchange: Exchange | null;
  exchange_account: ExchangeAccount | null;
  comment: string | null;
  chain_checked_at: string | null;
}
interface ManagerRow {
  id: number;
  name: string;
  telegram: string | null;
  created_at: string;
  updated_at: string;
}
interface DebtRow {
  id: number;
  manager_id: number | null;
  manager_name: string | null;
  amount: number;
  date: string;
  service: Service | null;
  placement_id: number | null;
  placement_name: string | null;
  source_text: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}
// --- Мапперы строк БД (amount в micro-USDT) в доменные типы (amount в USDT) ---
// Явно перечисляем поля, чтобы в JSON не утекали служебные свойства Row из libSQL.
const toFund = (r: Row): Fund => ({
  id: Number(r.id),
  name: String(r.name),
  amount: fromMicro(Number(r.amount)),
  created_at: String(r.created_at),
  updated_at: String(r.updated_at),
});

const toFund = (r: FundRow): Fund => ({ ...r, amount: fromMicro(r.amount) });
const toPlacement = (r: Row): Placement => ({
  id: Number(r.id),
  name: String(r.name),
  amount: fromMicro(Number(r.amount)),
  kind: r.kind as PlacementKind,
  address: (r.address as string | null) ?? null,
  exchange: (r.exchange as Exchange | null) ?? null,
  exchange_account: (r.exchange_account as ExchangeAccount | null) ?? null,
  comment: (r.comment as string | null) ?? null,
  chain_checked_at: (r.chain_checked_at as string | null) ?? null,
  trx_amount: r.trx_amount === null ? null : fromMicro(Number(r.trx_amount)),
  created_at: String(r.created_at),
  updated_at: String(r.updated_at),
});
const toDebt = (r: DebtRow): Debt => ({ ...r, amount: fromMicro(r.amount) });
const toManager = (r: ManagerRow): Manager => ({ ...r });

const toDebt = (r: Row): Debt => ({
  id: Number(r.id),
  manager: String(r.manager),
  amount: fromMicro(Number(r.amount)),
  service: (r.service as Service | null) ?? null,
  placement_id: r.placement_id === null ? null : Number(r.placement_id),
  placement_name: (r.placement_name as string | null) ?? null,
  source_text: (r.source_text as string | null) ?? null,
  comment: (r.comment as string | null) ?? null,
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
export function listManagers(): Manager[] {
  const rows = db
    .prepare("SELECT * FROM managers ORDER BY name COLLATE NOCASE ASC")
    .all() as ManagerRow[];
  return rows.map(toManager);
}
export function createManager(input: ManagerInput): Manager {
  const info = db
    .prepare("INSERT INTO managers (name, telegram) VALUES (?, ?)")
    .run(input.name, input.telegram);
  return toManager(
    db.prepare("SELECT * FROM managers WHERE id = ?").get(info.lastInsertRowid) as ManagerRow,
  );
}
export function updateManager(id: number, input: ManagerInput): Manager | null {
  const info = db
    .prepare("UPDATE managers SET name = ?, telegram = ?, updated_at = datetime('now') WHERE id = ?")
    .run(input.name, input.telegram, id);
  if (info.changes === 0) return null;
  return toManager(db.prepare("SELECT * FROM managers WHERE id = ?").get(id) as ManagerRow);
}
export function deleteManager(id: number): boolean {
  return db.prepare("DELETE FROM managers WHERE id = ?").run(id).changes > 0;
}
/** Есть ли долги, ссылающиеся на менеджера (удаление таких запрещено). */
export function managerInUse(id: number): boolean {
  return !!db.prepare("SELECT 1 FROM debts WHERE manager_id = ? LIMIT 1").get(id);
}

// ================= PLACEMENTS =================
export async function listPlacements(): Promise<Placement[]> {
  const db = await getClient();
  const rs = await db.execute("SELECT * FROM placements ORDER BY sort_order ASC, id ASC");
  return rs.rows.map(toPlacement);
}
export async function createPlacement(input: PlacementInput): Promise<Placement> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "INSERT INTO placements (name, amount, kind, address, exchange, exchange_account, comment, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM placements))",
    args: [
      input.name,
      toMicro(input.amount),
      input.kind,
      input.address,
      input.exchange,
      input.exchange_account,
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
    sql: "UPDATE placements SET name = ?, amount = ?, kind = ?, address = ?, exchange = ?, exchange_account = ?, comment = ?, updated_at = datetime('now') WHERE id = ?",
    args: [
      input.name,
      toMicro(input.amount),
      input.kind,
      input.address,
      input.exchange,
      input.exchange_account,
      input.comment,
      id,
    ],
  });
  if (rs.rowsAffected === 0) return null;
  const row = await db.execute({ sql: "SELECT * FROM placements WHERE id = ?", args: [id] });
  return toPlacement(row.rows[0]);
}
export async function deletePlacement(id: number): Promise<boolean> {
  const db = await getClient();
  const rs = await db.execute({ sql: "DELETE FROM placements WHERE id = ?", args: [id] });
  return rs.rowsAffected > 0;
}

// ================= DEBTS =================
const DEBT_SELECT =
  "SELECT d.*, p.name AS placement_name, m.name AS manager_name " +
  "FROM debts d " +
  "LEFT JOIN placements p ON p.id = d.placement_id " +
  "LEFT JOIN managers m ON m.id = d.manager_id";

export async function listDebts(): Promise<Debt[]> {
  const db = await getClient();
  const rs = await db.execute(`${DEBT_SELECT} ORDER BY d.sort_order ASC, d.id ASC`);
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
    sql: "INSERT INTO debts (manager_id, amount, date, service, placement_id, source_text, comment, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM debts))",
    args: [
      input.manager_id,
      input.amount,
      input.date,
      input.service,
      input.placement_id,
      input.source_text,
      input.comment,
      toMicro(input.amount),
      input.date,
      input.service,
      input.placement_id,
      input.source_text,
      input.comment,
    ],
  });
  return getDebt(Number(rs.lastInsertRowid));
}
export async function updateDebt(id: number, input: DebtInput): Promise<Debt | null> {
  const db = await getClient();
  const rs = await db.execute({
    sql: "UPDATE debts SET manager_id = ?, amount = ?, date = ?, service = ?, placement_id = ?, source_text = ?, comment = ?, updated_at = datetime('now') WHERE id = ?",
    args: [
      input.manager_id,
      input.amount,
      input.date,
      input.service,
      input.placement_id,
      input.source_text,
      input.comment,
      id,
      toMicro(input.amount),
      input.date,
      input.service,
      input.placement_id,
      input.source_text,
      input.comment,
      id,
    ],
  });
  if (rs.rowsAffected === 0) return null;
  return getDebt(id);
}
export async function deleteDebt(id: number): Promise<boolean> {
  const db = await getClient();
  const rs = await db.execute({ sql: "DELETE FROM debts WHERE id = ?", args: [id] });
  return rs.rowsAffected > 0;
}

// ================= CHAIN / EXCHANGE BALANCE =================
/** Строки размещений с адресами — кандидаты на проверку баланса в сети. */
export async function listPlacementsWithAddress(): Promise<
  { id: number; name: string; address: string }[]
> {
  const db = await getClient();
  const rs = await db.execute(
    "SELECT id, name, address FROM placements WHERE address IS NOT NULL AND address != ''",
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
    "SELECT id, name, exchange, exchange_account FROM placements WHERE kind = 'exchange' AND exchange IS NOT NULL AND exchange_account IS NOT NULL",
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
      sql: `UPDATE ${table} SET sort_order = ? WHERE id = ?`,
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
  const one = async (table: string): Promise<number> => {
    const rs = await db.execute(`SELECT COALESCE(SUM(amount), 0) AS s FROM ${table}`);
    return Number(rs.rows[0].s);
  };
  // Сверка в micro-единицах: размещено + долги против депо.
  // diff > 0 — избыток, diff < 0 — недостача.
  const funds = await one("funds");
  const placements = await one("placements");
  const debts = await one("debts");
  const diff = placements + debts - funds;
  return {
    total_funds: fromMicro(funds),
    total_placements: fromMicro(placements),
    total_debts: fromMicro(debts),
    diff: fromMicro(diff),
    balanced: diff === 0,
  };
}
