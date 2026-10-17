import { describe, expect, it } from "vitest";
import { diffDepoStates } from "@/lib/snapshot-diff";
import type { Debt, DepoState, Fund, Placement, Tag } from "@/types";

const fund = (id: number, amount: number, extra: Partial<Fund> = {}): Fund => ({
  id,
  name: `Средство ${id}`,
  amount,
  created_at: "2026-10-01 00:00:00",
  updated_at: "2026-10-01 00:00:00",
  ...extra,
});

const tag = (id: number, name: string): Tag => ({
  id,
  name,
  color: "blue",
  created_at: "2026-10-01 00:00:00",
  updated_at: "2026-10-01 00:00:00",
});

const placement = (id: number, extra: Partial<Placement> = {}): Placement => ({
  id,
  name: `Кошелёк ${id}`,
  amount: 100,
  kind: "wallet",
  chain: "tron",
  address: "TXYZ",
  exchange: null,
  exchange_account: null,
  icon: null,
  comment: null,
  chain_checked_at: null,
  native_amount: 50,
  tags: [],
  deleted_at: null,
  created_at: "2026-10-01 00:00:00",
  updated_at: "2026-10-01 00:00:00",
  ...extra,
});

const debt = (id: number, extra: Partial<Debt> = {}): Debt => ({
  id,
  manager_id: 1,
  manager_name: "Пётр",
  amount: 10,
  date: "2026-10-01",
  service: null,
  placement_id: null,
  placement_name: null,
  placement_chain: null,
  source_text: null,
  tx_id: null,
  comment: null,
  deleted_at: null,
  placement_deleted_at: null,
  created_at: "2026-10-01 00:00:00",
  updated_at: "2026-10-01 00:00:00",
  ...extra,
});

const state = (blocks: Partial<DepoState> = {}): DepoState => ({
  funds: [],
  placements: [],
  debts: [],
  total_funds: 0,
  total_placements: 0,
  total_debts: 0,
  total_native: { tron: 0, bsc: 0, ethereum: 0, arbitrum: 0 },
  diff: 0,
  balanced: true,
  ...blocks,
});

describe("diffDepoStates", () => {
  it("сопоставляет записи по id: добавленные, удалённые, изменённые, без изменений", () => {
    const d = diffDepoStates(
      state({ funds: [fund(1, 100), fund(2, 200), fund(3, 300)] }),
      state({ funds: [fund(2, 200), fund(3, 350), fund(4, 400)] }),
    );
    expect(d.funds.added.map((f) => f.id)).toEqual([4]);
    expect(d.funds.removed.map((f) => f.id)).toEqual([1]);
    expect(d.funds.changed).toHaveLength(1);
    expect(d.funds.changed[0].id).toBe(3);
    expect(d.funds.changed[0].fields).toEqual([
      {
        field: "amount",
        label: "Сумма",
        kind: "usdt",
        before: 300,
        after: 350,
        delta: 50,
        chain: null,
      },
    ]);
    expect(d.funds.unchanged).toBe(1);
  });

  it("считает дельты сумм в micro без дрейфа float", () => {
    const d = diffDepoStates(
      state({ funds: [fund(1, 0.1)], total_funds: 0.1 }),
      state({ funds: [fund(1, 0.1 + 0.2)], total_funds: 0.3 }),
    );
    expect(d.funds.changed[0].fields[0].delta).toBe(0.2);
    expect(d.delta.total_funds).toBe(0.2);
  });

  it("не видит изменений там, где разница меньше micro (float-шум)", () => {
    const d = diffDepoStates(
      state({ funds: [fund(1, 0.3)] }),
      state({ funds: [fund(1, 0.1 + 0.2)] }),
    );
    expect(d.funds.changed).toHaveLength(0);
    expect(d.funds.unchanged).toBe(1);
  });

  it("игнорирует служебные поля: updated_at, chain_checked_at, порядок", () => {
    const d = diffDepoStates(
      state({ placements: [placement(1), placement(2)] }),
      state({
        placements: [
          placement(2, { updated_at: "2026-10-10 00:00:00" }),
          placement(1, { chain_checked_at: "2026-10-10 00:00:00" }),
        ],
      }),
    );
    expect(d.placements.changed).toHaveLength(0);
    expect(d.placements.unchanged).toBe(2);
  });

  it("сравнивает теги как набор: перестановка — не изменение, новый тег — изменение", () => {
    const a = tag(1, "Альфа");
    const b = tag(2, "Бета");
    const same = diffDepoStates(
      state({ placements: [placement(1, { tags: [a, b] })] }),
      state({ placements: [placement(1, { tags: [b, a] })] }),
    );
    expect(same.placements.changed).toHaveLength(0);

    const added = diffDepoStates(
      state({ placements: [placement(1, { tags: [a] })] }),
      state({ placements: [placement(1, { tags: [a, b] })] }),
    );
    expect(added.placements.changed[0].fields).toMatchObject([
      { field: "tags", before: "Альфа", after: "Альфа, Бета" },
    ]);
  });

  it("газ: дельта в монетах своей сети, при смене сети дельты нет", () => {
    const same = diffDepoStates(
      state({ placements: [placement(1, { native_amount: 50 })] }),
      state({ placements: [placement(1, { native_amount: 20.5 })] }),
    );
    expect(same.placements.changed[0].fields).toMatchObject([
      { field: "native_amount", kind: "gas", delta: -29.5, chain: "tron" },
    ]);

    const moved = diffDepoStates(
      state({ placements: [placement(1, { chain: "tron", native_amount: 50 })] }),
      state({ placements: [placement(1, { chain: "bsc", native_amount: 0.01 })] }),
    );
    const gas = moved.placements.changed[0].fields.find((f) => f.field === "native_amount");
    expect(gas).toMatchObject({ delta: null, chain: "bsc" });
    expect(moved.placements.changed[0].fields.find((f) => f.field === "chain")).toMatchObject({
      before: "TRON",
      after: "BSC",
    });
  });

  it("газ, который раньше не проверяли (null), — изменение без дельты", () => {
    const d = diffDepoStates(
      state({ placements: [placement(1, { native_amount: null })] }),
      state({ placements: [placement(1, { native_amount: 5 })] }),
    );
    expect(d.placements.changed[0].fields).toMatchObject([
      { field: "native_amount", before: null, after: 5, delta: null },
    ]);
  });

  it("долги: источник и менеджер сравниваются по id, показываются по имени", () => {
    // Источник ушёл в архив: placement_name пропал, но placement_id тот же — не изменение.
    const archived = diffDepoStates(
      state({ debts: [debt(1, { placement_id: 7, placement_name: "Кошелёк 7" })] }),
      state({ debts: [debt(1, { placement_id: 7, placement_name: null })] }),
    );
    expect(archived.debts.changed).toHaveLength(0);

    const renamedManager = diffDepoStates(
      state({ debts: [debt(1, { manager_id: 1, manager_name: "Пётр" })] }),
      state({ debts: [debt(1, { manager_id: 1, manager_name: "Пётр И." })] }),
    );
    expect(renamedManager.debts.changed).toHaveLength(0);

    const moved = diffDepoStates(
      state({ debts: [debt(1, { placement_id: 7, placement_name: "Кошелёк 7" })] }),
      state({ debts: [debt(1, { placement_id: null, source_text: "наличные" })] }),
    );
    expect(moved.debts.changed[0].fields).toMatchObject([
      { field: "source", before: "Кошелёк 7", after: "наличные" },
    ]);
  });

  it("дельты итогов: USDT, расхождение и газ по каждой сети отдельно", () => {
    const d = diffDepoStates(
      state({
        total_funds: 1000,
        total_placements: 900,
        total_debts: 100,
        diff: 0,
        total_native: { tron: 100, bsc: 0.5, ethereum: 0, arbitrum: 0 },
      }),
      state({
        total_funds: 1000,
        total_placements: 850,
        total_debts: 120,
        diff: -30,
        balanced: false,
        total_native: { tron: 80, bsc: 0.75, ethereum: 0, arbitrum: 0 },
      }),
    );
    expect(d.delta).toEqual({
      total_funds: 0,
      total_placements: -50,
      total_debts: 20,
      diff: -30,
      total_native: { tron: -20, bsc: 0.25, ethereum: 0, arbitrum: 0 },
    });
    expect(d.before.balanced).toBe(true);
    expect(d.after.balanced).toBe(false);
  });
});
