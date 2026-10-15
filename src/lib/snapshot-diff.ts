// Сравнение двух состояний депо (снимок ↔ снимок или снимок ↔ текущее).
//
// Чистая функция без БД: состояние приходит готовыми доменными объектами
// (десятичные суммы). Записи сопоставляются по id — при мягком удалении id
// не переиспользуются, а снимок хранит записи вместе с id. Денежные значения
// сравниваются и вычитаются в micro-единицах, чтобы не ловить дрейф float.

import { CHAIN_META } from "@/lib/chains";
import { fromMicro, toMicro } from "@/lib/money";
import { CHAINS } from "@/types";
import type {
  Chain,
  Debt,
  DepoDiff,
  DepoState,
  DepoTotals,
  DiffFieldKind,
  EntityChange,
  EntityDiff,
  FieldChange,
  Fund,
  Placement,
} from "@/types";

type Value = string | number | null;

interface FieldSpec<T> {
  field: string;
  label: string;
  kind: DiffFieldKind;
  /** Значение для сравнения: совпали ключи — поле не изменилось. */
  key: (r: T) => Value;
  /** Значение для показа; по умолчанию — сам ключ. */
  show?: (r: T) => Value;
}

const isMoney = (kind: DiffFieldKind) => kind === "usdt" || kind === "gas";

/** Ключ денежного поля — целые micro, иначе 0.1 + 0.2 ≠ 0.3 дал бы ложное изменение. */
function compareKey(kind: DiffFieldKind, v: Value): Value {
  return isMoney(kind) && typeof v === "number" ? toMicro(v) : v;
}

const FUND_FIELDS: FieldSpec<Fund>[] = [
  { field: "name", label: "Название", kind: "text", key: (f) => f.name },
  { field: "amount", label: "Сумма", kind: "usdt", key: (f) => f.amount },
];

const PLACEMENT_FIELDS: FieldSpec<Placement>[] = [
  { field: "name", label: "Название", kind: "text", key: (p) => p.name },
  { field: "amount", label: "Сумма", kind: "usdt", key: (p) => p.amount },
  { field: "native_amount", label: "Газ", kind: "gas", key: (p) => p.native_amount },
  {
    field: "chain",
    label: "Сеть",
    kind: "text",
    key: (p) => p.chain,
    show: (p) => CHAIN_META[p.chain]?.label ?? p.chain,
  },
  { field: "address", label: "Адрес", kind: "text", key: (p) => p.address },
  { field: "exchange", label: "Биржа", kind: "text", key: (p) => p.exchange },
  { field: "exchange_account", label: "Счёт", kind: "text", key: (p) => p.exchange_account },
  {
    field: "tags",
    label: "Теги",
    kind: "text",
    // Набор тегов, а не порядок: сортируем имена, чтобы перестановка не считалась правкой.
    key: (p) =>
      (p.tags ?? [])
        .map((t) => t.name)
        .sort((a, b) => a.localeCompare(b, "ru"))
        .join(", ") || null,
  },
  { field: "comment", label: "Комментарий", kind: "text", key: (p) => p.comment },
];

/** «Откуда взял»: название записи-источника или свободный текст. */
const debtSource = (d: Debt): Value => d.placement_name ?? d.source_text;

const DEBT_FIELDS: FieldSpec<Debt>[] = [
  {
    field: "manager",
    label: "Менеджер",
    kind: "text",
    // По id: переименование менеджера — не правка каждого его долга.
    key: (d) => (d.manager_id !== null ? `id:${d.manager_id}` : d.manager_name),
    show: (d) => d.manager_name,
  },
  { field: "amount", label: "Сумма", kind: "usdt", key: (d) => d.amount },
  { field: "date", label: "Дата", kind: "date", key: (d) => d.date },
  { field: "service", label: "Сервис", kind: "text", key: (d) => d.service },
  {
    field: "source",
    label: "Откуда взял",
    kind: "text",
    // По id источника: его переименование или архивирование видно в блоке
    // свободных средств и не должно размножаться на все долги.
    key: (d) => (d.placement_id !== null ? `id:${d.placement_id}` : d.source_text),
    show: debtSource,
  },
  { field: "comment", label: "Комментарий", kind: "text", key: (d) => d.comment },
];

function fieldChanges<T>(
  specs: FieldSpec<T>[],
  before: T,
  after: T,
  gasChain: (r: T) => Chain | null,
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const s of specs) {
    const kb = s.key(before);
    const ka = s.key(after);
    if (compareKey(s.kind, kb) === compareKey(s.kind, ka)) continue;
    const chainBefore = gasChain(before);
    const chainAfter = gasChain(after);
    // Дельта газа между разными монетами бессмысленна — только при той же сети.
    const sameUnit = s.kind !== "gas" || chainBefore === chainAfter;
    const delta =
      isMoney(s.kind) && typeof kb === "number" && typeof ka === "number" && sameUnit
        ? fromMicro(toMicro(ka) - toMicro(kb))
        : null;
    changes.push({
      field: s.field,
      label: s.label,
      kind: s.kind,
      before: (s.show ?? s.key)(before),
      after: (s.show ?? s.key)(after),
      delta,
      chain: s.kind === "gas" ? chainAfter : null,
    });
  }
  return changes;
}

function diffEntities<T extends { id: number }>(
  before: T[],
  after: T[],
  specs: FieldSpec<T>[],
  gasChain: (r: T) => Chain | null = () => null,
): EntityDiff<T> {
  const beforeById = new Map(before.map((r) => [r.id, r]));
  const afterIds = new Set(after.map((r) => r.id));
  const added: T[] = [];
  const changed: EntityChange<T>[] = [];
  let unchanged = 0;
  for (const a of after) {
    const b = beforeById.get(a.id);
    if (!b) {
      added.push(a);
      continue;
    }
    const fields = fieldChanges(specs, b, a, gasChain);
    if (fields.length > 0) changed.push({ id: a.id, before: b, after: a, fields });
    else unchanged++;
  }
  const removed = before.filter((r) => !afterIds.has(r.id));
  return { added, removed, changed, unchanged };
}

const subtract = (after: number, before: number) => fromMicro(toMicro(after) - toMicro(before));

const totalsOf = (s: DepoState): DepoTotals => ({
  total_funds: s.total_funds,
  total_placements: s.total_placements,
  total_debts: s.total_debts,
  total_native: s.total_native,
  diff: s.diff,
  balanced: s.balanced,
});

/** Разница состояний депо: base — «было», target — «стало». */
export function diffDepoStates(base: DepoState, target: DepoState): DepoDiff {
  const totalNative = Object.fromEntries(
    CHAINS.map((c) => [c, subtract(target.total_native[c] ?? 0, base.total_native[c] ?? 0)]),
  ) as Record<Chain, number>;
  return {
    before: totalsOf(base),
    after: totalsOf(target),
    delta: {
      total_funds: subtract(target.total_funds, base.total_funds),
      total_placements: subtract(target.total_placements, base.total_placements),
      total_debts: subtract(target.total_debts, base.total_debts),
      total_native: totalNative,
      diff: subtract(target.diff, base.diff),
    },
    funds: diffEntities(base.funds, target.funds, FUND_FIELDS),
    placements: diffEntities(base.placements, target.placements, PLACEMENT_FIELDS, (p) => p.chain),
    debts: diffEntities(base.debts, target.debts, DEBT_FIELDS),
  };
}
