import { db } from "@/lib/db";
import { fromMicro, toMicro } from "@/lib/money";
import type {
  Fund,
  Placement,
  Debt,
  Summary,
  Service,
  PlacementKind,
  Exchange,
  ExchangeAccount,
} from "@/types";
import type { FundInput, PlacementInput, DebtInput } from "@/lib/validate";

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
interface DebtRow {
  id: number;
  manager: string;
  amount: number;
  service: Service | null;
  placement_id: number | null;
  placement_name: string | null;
  source_text: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

const toFund = (r: FundRow): Fund => ({ ...r, amount: fromMicro(r.amount) });
const toPlacement = (r: PlacementRow): Placement => ({ ...r, amount: fromMicro(r.amount) });
const toDebt = (r: DebtRow): Debt => ({ ...r, amount: fromMicro(r.amount) });

// ================= FUNDS =================
export function listFunds(): Fund[] {
  const rows = db.prepare("SELECT * FROM funds ORDER BY id DESC").all() as FundRow[];
  return rows.map(toFund);
}
export function createFund(input: FundInput): Fund {
  const info = db
    .prepare("INSERT INTO funds (name, amount) VALUES (?, ?)")
    .run(input.name, toMicro(input.amount));
  return toFund(db.prepare("SELECT * FROM funds WHERE id = ?").get(info.lastInsertRowid) as FundRow);
}
export function updateFund(id: number, input: FundInput): Fund | null {
  const info = db
    .prepare("UPDATE funds SET name = ?, amount = ?, updated_at = datetime('now') WHERE id = ?")
    .run(input.name, toMicro(input.amount), id);
  if (info.changes === 0) return null;
  return toFund(db.prepare("SELECT * FROM funds WHERE id = ?").get(id) as FundRow);
}
export function deleteFund(id: number): boolean {
  return db.prepare("DELETE FROM funds WHERE id = ?").run(id).changes > 0;
}

// ================= PLACEMENTS =================
export function listPlacements(): Placement[] {
  const rows = db
    .prepare("SELECT * FROM placements ORDER BY sort_order ASC, id ASC")
    .all() as PlacementRow[];
  return rows.map(toPlacement);
}
export function createPlacement(input: PlacementInput): Placement {
  const info = db
    .prepare(
      "INSERT INTO placements (name, amount, kind, place, address, exchange, exchange_account, comment, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM placements))",
    )
    .run(
      input.name,
      toMicro(input.amount),
      input.kind,
      input.place,
      input.address,
      input.exchange,
      input.exchange_account,
      input.comment,
    );
  return toPlacement(
    db.prepare("SELECT * FROM placements WHERE id = ?").get(info.lastInsertRowid) as PlacementRow,
  );
}
export function updatePlacement(id: number, input: PlacementInput): Placement | null {
  const info = db
    .prepare(
      "UPDATE placements SET name = ?, amount = ?, kind = ?, place = ?, address = ?, exchange = ?, exchange_account = ?, comment = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .run(
      input.name,
      toMicro(input.amount),
      input.kind,
      input.place,
      input.address,
      input.exchange,
      input.exchange_account,
      input.comment,
      id,
    );
  if (info.changes === 0) return null;
  return toPlacement(db.prepare("SELECT * FROM placements WHERE id = ?").get(id) as PlacementRow);
}
export function deletePlacement(id: number): boolean {
  return db.prepare("DELETE FROM placements WHERE id = ?").run(id).changes > 0;
}

// ================= DEBTS =================
const DEBT_SELECT =
  "SELECT d.*, p.name AS placement_name FROM debts d LEFT JOIN placements p ON p.id = d.placement_id";

export function listDebts(): Debt[] {
  const rows = db
    .prepare(`${DEBT_SELECT} ORDER BY d.sort_order ASC, d.id ASC`)
    .all() as DebtRow[];
  return rows.map(toDebt);
}
function getDebt(id: number): Debt {
  return toDebt(db.prepare(`${DEBT_SELECT} WHERE d.id = ?`).get(id) as DebtRow);
}
export function createDebt(input: DebtInput): Debt {
  const info = db
    .prepare(
      "INSERT INTO debts (manager, amount, service, placement_id, source_text, comment, sort_order) VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM debts))",
    )
    .run(
      input.manager,
      toMicro(input.amount),
      input.service,
      input.placement_id,
      input.source_text,
      input.comment,
    );
  return getDebt(Number(info.lastInsertRowid));
}
export function updateDebt(id: number, input: DebtInput): Debt | null {
  const info = db
    .prepare(
      "UPDATE debts SET manager = ?, amount = ?, service = ?, placement_id = ?, source_text = ?, comment = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .run(
      input.manager,
      toMicro(input.amount),
      input.service,
      input.placement_id,
      input.source_text,
      input.comment,
      id,
    );
  if (info.changes === 0) return null;
  return getDebt(id);
}
export function deleteDebt(id: number): boolean {
  return db.prepare("DELETE FROM debts WHERE id = ?").run(id).changes > 0;
}

// ================= CHAIN BALANCE =================
/** Строки размещений с адресами — кандидаты на проверку баланса. */
export function listPlacementsWithAddress(): { id: number; name: string; address: string }[] {
  return db
    .prepare("SELECT id, name, address FROM placements WHERE address IS NOT NULL AND address != ''")
    .all() as { id: number; name: string; address: string }[];
}

/** Перезаписывает сумму размещения балансом из сети. */
export function updateAmountFromChain(id: number, micro: number): void {
  db.prepare(
    "UPDATE placements SET amount = ?, chain_checked_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
  ).run(micro, id);
}

// ================= REORDER =================
/** Перезаписывает sort_order по позиции id в массиве (в транзакции). */
function reorderTable(table: "placements" | "debts") {
  const stmt = db.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`);
  return db.transaction((ids: number[]) => {
    ids.forEach((id, index) => stmt.run(index, id));
  });
}
const reorderPlacementsTx = reorderTable("placements");
const reorderDebtsTx = reorderTable("debts");

export function reorderPlacements(ids: number[]): void {
  reorderPlacementsTx(ids);
}
export function reorderDebts(ids: number[]): void {
  reorderDebtsTx(ids);
}

// ================= SUMMARY =================
export function getSummary(): Summary {
  const sum = (table: string) =>
    (db.prepare(`SELECT COALESCE(SUM(amount), 0) AS s FROM ${table}`).get() as { s: number }).s;
  // Сверка в micro-единицах: размещено + долги против депо.
  // diff > 0 — избыток, diff < 0 — недостача.
  const funds = sum("funds");
  const placements = sum("placements");
  const debts = sum("debts");
  const diff = placements + debts - funds;
  return {
    total_funds: fromMicro(funds),
    total_placements: fromMicro(placements),
    total_debts: fromMicro(debts),
    diff: fromMicro(diff),
    balanced: diff === 0,
  };
}
